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
        const msg = data?.detail || data?.message || "Signup failed";
        setError(msg);
        setLoading(false);
        return;
      }

      // backend returns { message, access_token }
      const token = data?.access_token;
      if (!token) {
        setError("Signup succeeded but server returned no token.");
        setLoading(false);
        return;
      }

      localStorage.setItem("access_token", token);
      localStorage.setItem("user_email", email.trim());

      navigate("/dashboard");
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
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: "0.8rem 1rem",
            borderRadius: 8,
            border: "1px solid #ddd",
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
          type="submit"
          className="btn primary"
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
