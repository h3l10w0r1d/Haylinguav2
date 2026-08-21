// src/VerifyEmail.jsx - SECURE VERSION
// Receives devCode as prop instead of reading from sessionStorage

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Mail } from "lucide-react";
import grandma from "./assets/character-grandma.png";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return (
    localStorage.getItem("hay_token") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

export default function VerifyEmail({ onVerified, devCode = null }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  const token = getToken();
  const userEmail = localStorage.getItem("user_email") || "your email";
  const showDevMode = !!devCode; // Dev mode if code is passed as prop

  useEffect(() => {
    if (showDevMode) {
      console.warn('🔧 DEV MODE: Email sending not configured');
      setError("⚠️ Development Mode: Email sending not configured. Use the code below.");
    }

    // Restore cooldown after refresh
    const untilStr = localStorage.getItem("hay_resend_until");
    const until = untilStr ? Number(untilStr) : 0;
    if (until && !Number.isNaN(until)) {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setCooldown(left);
    }
  }, [showDevMode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function verify() {
    setLoading(true);
    setError("");
    
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setError("Please enter a 6-digit code");
      setLoading(false);
      return;
    }
    
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError("Code must be 6 digits");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmedCode }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail || "Verification failed";
        
        if (detail === "INVALID_CODE") {
          setError("Invalid code. Please check and try again.");
        } else if (detail === "CODE_EXPIRED") {
          setError("This code has expired. Please request a new one.");
        } else if (detail === "NO_CODE") {
          setError("No verification code found. Please request a new one.");
        } else if (detail === "TOO_MANY_ATTEMPTS") {
          setError("Too many failed attempts. Please request a new code.");
        } else {
          setError(typeof detail === "string" ? detail : JSON.stringify(detail));
        }
        return;
      }

      if (onVerified) await onVerified();
      navigate("/dashboard", { replace: true });
    } catch (e) {
      console.error(e);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail;
        
        if (res.status === 429 && detail?.retry_after_s) {
          const seconds = Number(detail.retry_after_s) || 60;
          const until = Date.now() + seconds * 1000;
          localStorage.setItem("hay_resend_until", String(until));
          setCooldown(seconds);
          setError(`Please wait ${seconds} seconds before requesting another code.`);
          return;
        }
        
        if (detail === "ALREADY_VERIFIED") {
          setError("Your email is already verified!");
          setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
          return;
        }
        
        const msg = detail || "Resend failed";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }

      // In dev mode, new code will be in console logs only
      if (data.verification_code) {
        console.warn('🔧 DEV MODE: New verification code:', data.verification_code);
        alert(`DEV MODE: Check console for new code: ${data.verification_code}`);
      }

      const seconds = Number(data?.retry_after_s) || 60;
      const until = Date.now() + seconds * 1000;
      localStorage.setItem("hay_resend_until", String(until));
      setCooldown(seconds);
    } catch (e) {
      console.error(e);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function useDevCode() {
    if (devCode) {
      setCode(devCode);
      setError("");
    }
  }

  // Six single-digit boxes that compose into the same `code` string the rest
  // of the component already works with — no changes needed to verify()'s
  // validation or submit logic, just how the digits get typed in.
  const digits = Array.from({ length: 6 }, (_, i) => code[i] || "");
  const boxRefs = useRef([]);
  const isDevError = error.includes("Development");

  function setDigit(i, raw) {
    const val = raw.replace(/\D/g, "");
    const chars = code.split("");
    if (!val) {
      chars[i] = "";
      setCode(chars.join("").slice(0, 6));
      return;
    }
    // Typing (or pasting) more than one digit into a single box — e.g. a
    // paste landed here — spreads the rest forward starting at this box.
    const spread = val.split("");
    spread.forEach((d, j) => { chars[i + j] = d; });
    const next = chars.join("").slice(0, 6);
    setCode(next);
    if (error && next.length === 6) setError("");
    const lastFilled = Math.min(i + spread.length, 5);
    boxRefs.current[lastFilled]?.focus();
  }

  function onBoxKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      boxRefs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) boxRefs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) boxRefs.current[i + 1]?.focus();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50/60 via-white to-white px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-lg ring-1 ring-slate-200">
        <img src={grandma} alt="" className="mx-auto mb-5 h-20 w-20 rounded-2xl object-cover ring-4 ring-brand-50" />

        <h1 className="font-display text-2xl font-extrabold text-slate-800">Check your inbox</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          We sent a 6-digit code to
          <br />
          <span className="text-slate-700">{userEmail}</span>
        </p>

        {/* Dev Mode Alert - Only shown if devCode prop is provided */}
        {showDevMode && devCode && (
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-left ring-1 ring-amber-200">
            <div className="flex items-center gap-1.5 text-sm font-extrabold text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Development mode
            </div>
            <p className="mt-1.5 text-xs font-semibold leading-snug text-amber-700">
              Email sending isn't configured on the server — this code only shows up in development.
            </p>
            <div className="mt-3 rounded-xl bg-white py-3 text-center font-display text-2xl font-extrabold tracking-[0.3em] text-amber-900 ring-1 ring-amber-200">
              {devCode}
            </div>
            <button
              type="button"
              onClick={useDevCode}
              className="btn3d btn3d-brand mt-3 w-full !py-2.5 text-sm"
            >
              Use this code
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-2" onPaste={(e) => {
          const pasted = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
          if (!pasted) return;
          e.preventDefault();
          setDigit(0, pasted);
        }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (boxRefs.current[i] = el)}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onBoxKeyDown(i, e)}
              inputMode="numeric"
              maxLength={1}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1} of 6`}
              className={
                "h-14 w-11 rounded-2xl text-center font-display text-2xl font-extrabold text-slate-800 ring-2 transition focus:outline-none focus:ring-brand-400 " +
                (error && !isDevError ? "ring-cardinal-400" : "ring-slate-200")
              }
            />
          ))}
        </div>

        {error && (
          <div
            className={
              "mt-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold leading-snug " +
              (isDevError ? "bg-amber-50 text-amber-800" : "bg-cardinal-50 text-cardinal-700")
            }
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={verify}
          disabled={loading || code.trim().length !== 6}
          className="btn3d btn3d-brand mt-6 w-full uppercase"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {loading ? "Verifying…" : "Verify email"}
        </button>

        <p className="mt-5 text-sm font-semibold text-slate-400">Didn't receive the code?</p>
        <button
          type="button"
          onClick={resend}
          disabled={loading || cooldown > 0}
          className="mt-1 text-sm font-extrabold text-brand-600 transition hover:text-brand-700 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </button>

        <p className="mt-4 text-xs font-semibold text-slate-400">Code expires in 10 minutes</p>
      </div>
    </div>
  );
}
