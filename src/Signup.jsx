import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";

const API = import.meta.env.VITE_API_URL || "https://haylinguav2.onrender.com";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.detail || data.message || "Signup failed";
        alert(msg);
      } else {
        alert("Account created successfully!");
        // Redirect to dashboard
        navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
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
          style={{ padding: "0.8rem 1rem", borderRadius: 8, border: "1px solid #ddd" }}
        />

        <input
          type="password"
          placeholder="Password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "0.8rem 1rem", borderRadius: 8, border: "1px solid #ddd" }}
        />

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
