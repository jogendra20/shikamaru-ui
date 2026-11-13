"use client";
import { useState, useEffect } from "react";

const AUTH_KEY = "nexus_auth_v1";
const PASSWORD = process.env.NEXT_PUBLIC_NEXUS_PASSWORD ?? "";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    setAuthed(stored === "true");
  }, []);

  function handleUnlock() {
    if (input === PASSWORD) {
      localStorage.setItem(AUTH_KEY, "true");
      setAuthed(true);
    } else {
      setError("Wrong password");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput("");
    }
  }

  // Still checking
  if (authed === null) return null;

  // Already authed
  if (authed) return <>{children}</>;

  // Show password gate
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A0F",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "monospace"
    }}>
      <div style={{
        background: "#12121A",
        border: "1px solid #2D2D4E",
        borderRadius: "12px",
        padding: "40px",
        width: "320px",
        textAlign: "center",
        animation: shake ? "shake 0.4s ease" : "none"
      }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>⬡</div>
        <div style={{ color: "#C084FC", fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>
          NEXUS
        </div>
        <div style={{ color: "#64748B", fontSize: "12px", marginBottom: "24px" }}>
          Personal AI OS
        </div>

        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && handleUnlock()}
          placeholder="Enter password"
          autoFocus
          style={{
            width: "100%",
            background: "#0A0A0F",
            border: "1px solid #1E1E2E",
            borderRadius: "8px",
            padding: "10px 14px",
            color: "#F1F5F9",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "12px"
          }}
        />

        {error && (
          <div style={{ color: "#F472B6", fontSize: "12px", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleUnlock}
          style={{
            width: "100%",
            background: "#7C3AED",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            color: "#F1F5F9",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Unlock
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
