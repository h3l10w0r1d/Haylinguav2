// src/VerifyEmail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return (
    localStorage.getItem("hay_token") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

export default function VerifyEmail({ onVerified }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [devCode, setDevCode] = useState("");
  const [showDevMode, setShowDevMode] = useState(false);
  const navigate = useNavigate();

  const token = useMemo(() => getToken(), []);
  const userEmail = localStorage.getItem("user_email") || "your email";

  useEffect(() => {
    console.log("VerifyEmail mounted");
    console.log("Token:", token ? "present" : "missing");
    console.log("Email:", userEmail);
    
    // Check if we're in dev mode (email not actually sent)
    const emailSent = sessionStorage.getItem("email_sent");
    const storedDevCode = sessionStorage.getItem("dev_verification_code");
    
    console.log("Email sent:", emailSent);
    console.log("Dev code:", storedDevCode);
    
    if (emailSent === "false" && storedDevCode) {
      setShowDevMode(true);
      setDevCode(storedDevCode);
      setError("⚠️ Development Mode: Email sending not configured. Use the code below.");
    }

    // Restore cooldown after refresh
    const untilStr = localStorage.getItem("hay_resend_until");
    const until = untilStr ? Number(untilStr) : 0;
    if (until && !Number.isNaN(until)) {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setCooldown(left);
    }
  }, [token, userEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function verify() {
    setLoading(true);
    setError("");
    
    // Validate code format before sending
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
        
        // Handle specific error codes
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

      // Clear dev mode data
      sessionStorage.removeItem("dev_verification_code");
      sessionStorage.removeItem("email_sent");

      // Re-fetch profile so the app unlocks
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
        
        // Backend uses 429 + { code, retry_after_s }
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

      // Check if we got a dev code back
      if (data.verification_code) {
        setDevCode(data.verification_code);
        setShowDevMode(true);
        setError("⚠️ Development Mode: Check the code below.");
        sessionStorage.setItem("dev_verification_code", data.verification_code);
      } else {
        setError("");
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

  return (
    <div style={{ 
      minHeight: "100vh", 
      paddingTop: "4rem",
      background: "linear-gradient(180deg, #fff7ec 0%, #ffffff 55%, #f9fafb 100%)",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      <h1 style={{ 
        textAlign: "center", 
        marginBottom: "0.75rem",
        fontSize: "2rem",
        fontWeight: "700",
        color: "#111827"
      }}>
        Verify your email
      </h1>
      <p style={{ 
        textAlign: "center", 
        marginBottom: "2rem", 
        opacity: 0.8,
        color: "#4b5563",
        fontSize: "0.95rem"
      }}>
        We sent a 6-digit code to <strong>{userEmail}</strong>
      </p>

      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "0 1rem"
        }}
      >
        {/* Dev Mode Alert */}
        {showDevMode && devCode && (
          <div
            style={{
              background: "#fef3c7",
              color: "#92400e",
              border: "2px solid #fde68a",
              padding: "1.5rem",
              borderRadius: 12,
              fontSize: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "0.75rem", fontSize: "16px" }}>
              🔧 Development Mode
            </div>
            <div style={{ marginBottom: "1rem", lineHeight: "1.5" }}>
              Email sending is not configured on the server. Use the code below to verify.
            </div>
            <div
              style={{
                background: "#fff",
                padding: "1rem",
                borderRadius: 8,
                fontFamily: "monospace",
                fontSize: 28,
                letterSpacing: "0.3em",
                textAlign: "center",
                fontWeight: 700,
                marginBottom: "1rem",
                border: "2px solid #fbbf24",
              }}
            >
              {devCode}
            </div>
            <button
              onClick={useDevCode}
              style={{
                background: "#92400e",
                color: "#fff",
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                width: "100%",
              }}
            >
              Use this code
            </button>
          </div>
        )}

        <input
          value={code}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, ""); // Only digits
            setCode(val);
            if (error && val.length === 6) setError("");
          }}
          placeholder="000000"
          inputMode="numeric"
          maxLength={6}
          style={{
            padding: "1rem",
            borderRadius: 12,
            border: error && !error.includes("Development") 
              ? "2px solid #ef4444" 
              : "2px solid #e5e7eb",
            letterSpacing: "0.3em",
            textAlign: "center",
            fontSize: 24,
            fontFamily: "monospace",
            fontWeight: "600",
            background: "#fff",
            outline: "none",
          }}
        />

        {error && (
          <div
            style={{
              background: error.includes("Development") ? "#fef3c7" : "#fee2e2",
              color: error.includes("Development") ? "#92400e" : "#991b1b",
              border: error.includes("Development") 
                ? "2px solid #fde68a" 
                : "2px solid #fecaca",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              fontSize: 14,
              lineHeight: "1.5"
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={verify}
          disabled={loading || code.trim().length !== 6}
          className="btn btn-primary"
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            fontSize: "16px",
            opacity: loading || code.trim().length !== 6 ? 0.5 : 1,
            cursor: loading || code.trim().length !== 6 ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Verifying..." : "Verify Email"}
        </button>

        <div style={{ textAlign: "center", fontSize: "14px", color: "#6b7280", margin: "0.5rem 0" }}>
          Didn't receive the code?
        </div>

        <button
          onClick={resend}
          disabled={loading || cooldown > 0}
          className="btn btn-secondary"
          style={{
            width: "100%",
            padding: "0.75rem 1.5rem",
            fontSize: "16px",
            opacity: loading || cooldown > 0 ? 0.5 : 1,
            cursor: loading || cooldown > 0 ? "not-allowed" : "pointer",
          }}
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </button>

        <div style={{ textAlign: "center", fontSize: "13px", color: "#9ca3af", marginTop: "1rem" }}>
          The code expires in 10 minutes
        </div>
      </div>
    </div>
  );
}
