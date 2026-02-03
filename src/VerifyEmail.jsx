// src/VerifyEmail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    // Restore cooldown after refresh
    const untilStr = localStorage.getItem("hay_resend_until");
    const until = untilStr ? Number(untilStr) : 0;
    if (until && !Number.isNaN(until)) {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setCooldown(left);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function verify() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.detail || "Verification failed";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }

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
        // Backend uses 429 + { code, retry_after_s }
        const detail = data?.detail;
        if (res.status === 429 && detail?.retry_after_s) {
          const seconds = Number(detail.retry_after_s) || 60;
          const until = Date.now() + seconds * 1000;
          localStorage.setItem("hay_resend_until", String(until));
          setCooldown(seconds);
          return;
        }
        const msg = detail || "Resend failed";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
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

  return (
    <div className="landing" style={{ minHeight: "100vh", paddingTop: "4rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: "0.75rem" }}>Verify your email</h1>
      <p style={{ textAlign: "center", marginBottom: "2rem", opacity: 0.8 }}>
        Enter the 6-digit code we sent to your email.
      </p>

      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          inputMode="numeric"
          maxLength={6}
          style={{
            padding: "0.8rem 1rem",
            borderRadius: 8,
            border: "1px solid #ddd",
            letterSpacing: "0.25em",
            textAlign: "center",
            fontSize: 18,
          }}
        />

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={verify}
          className="btn primary"
          disabled={loading || code.trim().length !== 6}
        >
          {loading ? "Verifying..." : "Verify"}
        </button>

        <button
          onClick={resend}
          className="btn"
          disabled={loading || cooldown > 0}
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
