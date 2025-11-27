import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Invalid credentials");
        setLoading(false);
        return;
      }

      // store token
      localStorage.setItem("token", data.token);

      alert("Logged in!");
      navigate("/dashboard"); // <-- you will create soon
    } catch (err) {
      setError("Server error. Try again.");
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Log in</h1>

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
