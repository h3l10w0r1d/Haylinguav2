// src/Signup.jsx - Multi-step with inline verification
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Signup() {
  const [step, setStep] = useState(1); // 1 = signup form, 2 = verify email
  
  // Step 1 - Signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  
  // Step 2 - Verification
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const navigate = useNavigate();

  // Step 1: Handle Signup
  async function handleSignup(e) {
    e.preventDefault();
    setSignupLoading(true);
    setSignupError("");

    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: name.trim() || null,
          email: email.trim(), 
          password 
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.detail?.field) {
          const fieldErrors = data.detail.errors || [];
          setSignupError(fieldErrors.join(". "));
        } else {
          const msg = data?.detail || data?.message || "Signup failed";
          setSignupError(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        setSignupLoading(false);
        return;
      }

      const accessToken = data?.access_token;
      if (!accessToken) {
        setSignupError("Signup succeeded but server returned no token.");
        setSignupLoading(false);
        return;
      }

      // Store token and email
      setToken(accessToken);
      localStorage.setItem("hay_token", accessToken);
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("user_email", email.trim());

      // Store user object
      const baseName = email.split('@')[0];
      const newUser = {
        id: 1,
        email: email.trim(),
        name: name.trim() || baseName,
        firstName: '',
        lastName: '',
        avatarUrl: '',
        level: 1,
        xp: 0,
        streak: 0,
        completedLessons: [],
        email_verified: false,
      };
      localStorage.setItem("hay_user", JSON.stringify(newUser));

      // Check if we got a dev code
      if (data.verification_code) {
        setDevCode(data.verification_code);
        console.warn('🔧 DEV MODE: Verification code:', data.verification_code);
      }

      // Move to step 2 (verification)
      setStep(2);
    } catch (err) {
      console.error(err);
      setSignupError("Network error. Please try again.");
    } finally {
      setSignupLoading(false);
    }
  }

  // Step 2: Handle Verification
  async function handleVerify(e) {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyError("");

    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6) {
      setVerifyError("Please enter a 6-digit code");
      setVerifyLoading(false);
      return;
    }

    if (!/^\d{6}$/.test(trimmedCode)) {
      setVerifyError("Code must be 6 digits");
      setVerifyLoading(false);
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
          setVerifyError("Invalid code. Please check and try again.");
        } else if (detail === "CODE_EXPIRED") {
          setVerifyError("This code has expired. Please request a new one.");
        } else if (detail === "NO_CODE") {
          setVerifyError("No verification code found. Please request a new one.");
        } else if (detail === "TOO_MANY_ATTEMPTS") {
          setVerifyError("Too many failed attempts. Please request a new code.");
        } else {
          setVerifyError(typeof detail === "string" ? detail : JSON.stringify(detail));
        }
        setVerifyLoading(false);
        return;
      }

      // Success! Update user object and navigate to dashboard
      const userStr = localStorage.getItem("hay_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        user.email_verified = true;
        localStorage.setItem("hay_user", JSON.stringify(user));
      }

      // Force page reload to ensure App.jsx picks up the verified state
      window.location.href = "/dashboard";
    } catch (err) {
      console.error(err);
      setVerifyError("Network error. Please try again.");
      setVerifyLoading(false);
    }
  }

  // Handle Resend
  async function handleResend() {
    if (cooldown > 0) return;
    
    setVerifyLoading(true);
    setVerifyError("");

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
          setCooldown(seconds);
          setVerifyError(`Please wait ${seconds} seconds before requesting another code.`);
          
          // Start countdown
          const interval = setInterval(() => {
            setCooldown(prev => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          setVerifyLoading(false);
          return;
        }
        
        if (detail === "ALREADY_VERIFIED") {
          window.location.href = "/dashboard";
          return;
        }
        
        const msg = detail || "Resend failed";
        setVerifyError(typeof msg === "string" ? msg : JSON.stringify(msg));
        setVerifyLoading(false);
        return;
      }

      // Check if we got a new dev code
      if (data.verification_code) {
        setDevCode(data.verification_code);
        console.warn('🔧 DEV MODE: New verification code:', data.verification_code);
      }

      setVerifyError("");
      setVerifyLoading(false);
      
      // Start cooldown
      const seconds = Number(data?.retry_after_s) || 60;
      setCooldown(seconds);
      const interval = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      setVerifyError("Network error. Please try again.");
      setVerifyLoading(false);
    }
  }

  function useDevCode() {
    if (devCode) {
      setCode(devCode);
      setVerifyError("");
    }
  }

  // Render Step 1: Signup Form
  if (step === 1) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        paddingTop: "4rem",
        background: "linear-gradient(180deg, #fff7ec 0%, #ffffff 55%, #f9fafb 100%)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}>
        <h1 style={{ textAlign: "center", marginBottom: "0.5rem", fontSize: "2rem", fontWeight: "700", color: "#111827" }}>
          Create Account
        </h1>
        <p style={{ textAlign: "center", marginBottom: "2rem", fontSize: "0.95rem", color: "#6b7280" }}>
          Start your Armenian learning journey
        </p>

        <form
          onSubmit={handleSignup}
          style={{
            maxWidth: "420px",
            margin: "0 auto",
            padding: "0 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "0.9rem 1rem",
              borderRadius: 10,
              border: "2px solid #e5e7eb",
              fontSize: "15px",
              outline: "none",
            }}
          />

          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "0.9rem 1rem",
              borderRadius: 10,
              border: "2px solid #e5e7eb",
              fontSize: "15px",
              outline: "none",
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
              padding: "0.9rem 1rem",
              borderRadius: 10,
              border: "2px solid #e5e7eb",
              fontSize: "15px",
              outline: "none",
            }}
          />

          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "-0.5rem" }}>
            Password must be at least 8 characters with uppercase, lowercase, and a number.
          </div>

          {signupError && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                border: "2px solid #fecaca",
                padding: "0.75rem 1rem",
                borderRadius: 10,
                fontSize: 14,
                lineHeight: "1.5",
              }}
            >
              {signupError}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={signupLoading}
            style={{ 
              width: "100%",
              padding: "0.9rem 1.5rem",
              fontSize: "16px",
              opacity: signupLoading ? 0.6 : 1,
              cursor: signupLoading ? "not-allowed" : "pointer",
            }}
          >
            {signupLoading ? "Creating account..." : "Create account"}
          </button>

          <div style={{ textAlign: "center", fontSize: "14px", color: "#6b7280" }}>
            Already have an account?{" "}
            <a
              href="/"
              style={{ color: "#f97316", textDecoration: "none", fontWeight: 600 }}
            >
              Sign in
            </a>
          </div>
        </form>
      </div>
    );
  }

  // Render Step 2: Email Verification
  return (
    <div style={{ 
      minHeight: "100vh", 
      paddingTop: "4rem",
      background: "linear-gradient(180deg, #fff7ec 0%, #ffffff 55%, #f9fafb 100%)",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }}>
      <h1 style={{ textAlign: "center", marginBottom: "0.5rem", fontSize: "2rem", fontWeight: "700", color: "#111827" }}>
        Verify your email
      </h1>
      <p style={{ textAlign: "center", marginBottom: "2rem", fontSize: "0.95rem", color: "#6b7280" }}>
        We sent a 6-digit code to <strong>{email}</strong>
      </p>

      <form
        onSubmit={handleVerify}
        style={{
          maxWidth: "420px",
          margin: "0 auto",
          padding: "0 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {/* Dev Mode Alert */}
        {devCode && (
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
              Email sending is not configured. Use this code:
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
              type="button"
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
            const val = e.target.value.replace(/\D/g, "");
            setCode(val);
            if (verifyError && val.length === 6) setVerifyError("");
          }}
          placeholder="000000"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          style={{
            padding: "1rem",
            borderRadius: 12,
            border: verifyError && !verifyError.includes("wait")
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

        {verifyError && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "2px solid #fecaca",
              padding: "0.75rem 1rem",
              borderRadius: 10,
              fontSize: 14,
              lineHeight: "1.5",
            }}
          >
            {verifyError}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={verifyLoading || code.trim().length !== 6}
          style={{
            width: "100%",
            padding: "0.9rem 1.5rem",
            fontSize: "16px",
            opacity: verifyLoading || code.trim().length !== 6 ? 0.6 : 1,
            cursor: verifyLoading || code.trim().length !== 6 ? "not-allowed" : "pointer",
          }}
        >
          {verifyLoading ? "Verifying..." : "Verify Email"}
        </button>

        <div style={{ textAlign: "center", fontSize: "14px", color: "#6b7280", margin: "0.5rem 0" }}>
          Didn't receive the code?
        </div>

        <button
          type="button"
          onClick={handleResend}
          className="btn btn-secondary"
          disabled={verifyLoading || cooldown > 0}
          style={{
            width: "100%",
            padding: "0.9rem 1.5rem",
            fontSize: "16px",
            opacity: verifyLoading || cooldown > 0 ? 0.6 : 1,
            cursor: verifyLoading || cooldown > 0 ? "not-allowed" : "pointer",
          }}
        >
          {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
        </button>

        <div style={{ textAlign: "center", fontSize: "13px", color: "#9ca3af", marginTop: "0.5rem" }}>
          Code expires in 10 minutes
        </div>
      </form>
    </div>
  );
}
