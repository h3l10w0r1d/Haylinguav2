// src/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      // backend usually returns JSON even on errors
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.detail || "Invalid credentials");
        setLoading(false);
        return;
      }

      // ✅ Your backend returns { access_token, token_type, email }
      const token = data?.access_token;
      if (!token) {
        setError("Login succeeded but server returned no token.");
        setLoading(false);
        return;
      }

      // ✅ Use the same key everywhere
      localStorage.setItem("access_token", token);
      localStorage.setItem("user_email", data?.email || email.trim());

      navigate("/dashboard");
    } catch (err) {
      setError("Server unavailable. Try again later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Log In</h1>

      <form onSubmit={handleLogin} style={{ maxWidth: 300, margin: "auto" }}>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: 8 }}
        />

        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: 8 }}
        />

        {error && <p style={{ color: "red" }}>{error}</p>}

        <button disabled={loading} className="btn primary">
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
