// src/Signup.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Handle field-specific errors
        if (data?.detail?.field) {
          const fieldErrors = data.detail.errors || [];
          setError(fieldErrors.join(". "));
        } else {
          const msg = data?.detail || data?.message || "Signup failed";
          setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        setLoading(false);
        return;
      }

      // backend returns { message, access_token, email_verified, verification_code (dev only) }
      const token = data?.access_token;
      if (!token) {
        setError("Signup succeeded but server returned no token.");
        setLoading(false);
        return;
      }

      // Store auth data
      localStorage.setItem("access_token", token);
      localStorage.setItem("hay_token", token);
      localStorage.setItem("user_email", email.trim());

      // Store verification code if in dev mode (backend only sends this if SMTP not configured)
      if (data.verification_code) {
        sessionStorage.setItem("dev_verification_code", data.verification_code);
        sessionStorage.setItem("email_sent", "false");
      } else {
        sessionStorage.setItem("email_sent", "true");
      }

      // Navigate to verify page (CHANGED from /dashboard)
      navigate("/verify");
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing" style={{ minHeight: "100vh", paddingTop: "4rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Create Account</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          maxWidth: "420px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: "0.8rem 1rem",
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: "0.8rem 1rem",
            borderRadius: 8,
            border: "1px solid #ddd",
          }}
        />

        <div style={{ fontSize: "12px", color: "#666", marginTop: "-0.5rem" }}>
          Password must be at least 8 characters with uppercase, lowercase, and a number.
        </div>

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
          type="submit"
          className="btn primary"
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <div style={{ textAlign: "center", fontSize: "14px", color: "#666" }}>
          Already have an account?{" "}
          <a
            href="/"
            style={{ color: "#ff6b35", textDecoration: "none", fontWeight: 500 }}
          >
            Sign in
          </a>
        </div>
      </form>
    </div>
  );
}
