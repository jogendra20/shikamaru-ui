"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Role = "user" | "assistant";
type Difficulty = "easy" | "medium" | "hard";
type Tab = "chat" | "projects" | "activity";

interface Message {
  id: string;
  role: Role;
  content: string;
  provider?: string;
  difficulty?: Difficulty;
  timestamp: Date;
}

interface Project {
  id: string;
  name: string;
  repo: string;
  status: "active" | "idle";
  lastCommit: string;
}

interface SavedAutomation {
  id: string;
  name: string;
  prompt: string;
  filepath: string;
  createdAt: string;
}

interface PendingScript {
  filepath: string;
  prompt: string;
}

const PROVIDER_ICONS: Record<string, string> = {
  mistral: "💻", gemini: "✨", groq: "🚀", nvidia: "🧠",
  github_models: "🔮", cerebras: "⚡", openrouter: "🌐",
  huggingface: "🤗", nexus: "🎯", pollinations: "🌸",
};

const PROVIDER_COLOR: Record<string, string> = {
  github_models: "#F59E0B", gemini: "#FBBF24", groq: "#D97706",
  nvidia: "#FCD34D", cerebras: "#F59E0B", huggingface: "#FBBF24",
  mistral: "#D97706", openrouter: "#F59E0B", pollinations: "#FCD34D",
};

// Amber theme tokens
const A = {
  gold:    "#F59E0B",
  bright:  "#FCD34D",
  dim:     "#92400E",
  glow:    "rgba(245,158,11,0.15)",
  glowMd:  "rgba(245,158,11,0.25)",
  glowHi:  "rgba(245,158,11,0.45)",
  border:  "rgba(245,158,11,0.18)",
  borderHi:"rgba(245,158,11,0.4)",
  bg:      "#080806",
  surface: "rgba(245,158,11,0.04)",
  text:    "#FEF3C7",
  muted:   "#78716C",
  faint:   "#292524",
};

const IMAGE_KEYWORDS = [
  "generate image","create image","draw","make image","imagine",
  "sketch","paint","visualize","want an image","need an image",
  "image for","make a poster","create a poster","poster for",
  "an image of","a picture of","photo of","render a","design a","illustration",
];

const INITIAL_PROJECTS: Project[] = [
  { id: "onyx", name: "Onyx", repo: "jogendra20/onyx", status: "active", lastCommit: "PWA reading app" },
  { id: "hunter", name: "HUNTER", repo: "jogendra20/hunter", status: "active", lastCommit: "NSE journal tool" },
  { id: "automate", name: "Automate", repo: "jogendra20/Automate", status: "active", lastCommit: "GitHub Actions runner" },
];

function detectDifficulty(prompt: string): Difficulty {
  const p = prompt.toLowerCase();
  if (["architecture","analyze","compare","deep","comprehensive","strategy","build full","implement"].some(k => p.includes(k))) return "hard";
  if (["scrape","automate","extract","fill form","portal","multiple","fetch all","playwright"].some(k => p.includes(k))) return "medium";
  return "easy";
}

const SUGGESTIONS = [
  "Scrape NSE top gainers today",
  "Draw a dark cyberpunk city at night",
  "Analyze my Onyx codebase structure",
  "What is the latest Nifty 50 trend?",
];

const DIFF_COLOR: Record<Difficulty, string> = {
  easy: "#10B981", medium: "#60A5FA", hard: "#F59E0B",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [tab, setTab] = useState<Tab>("chat");
  const [pendingScript, setPendingScript] = useState<PendingScript | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedAutomations, setSavedAutomations] = useState<SavedAutomation[]>([]);
  const [forceAutomate, setForceAutomate] = useState(false);
  const [projects] = useState<Project[]>(INITIAL_PROJECTS);
  const [tickerItems, setTickerItems] = useState<string[]>([
    "NIFTY 50  — ", "SENSEX  — ", "BANKNIFTY  — ", "USDINR  — "
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await fetch("https://nexus-56tm.onrender.com/ticker", { signal: AbortSignal.timeout(15000) });
        const data = await res.json();
        if (data.items?.length) setTickerItems(data.items);
      } catch {
        // retry in 10s if failed (Render cold start)
        setTimeout(fetchTicker, 10000);
      }
    };
    fetchTicker();
    const interval = setInterval(fetchTicker, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("savedAutomations");
    if (stored) setSavedAutomations(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem("savedAutomations", JSON.stringify(savedAutomations));
  }, [savedAutomations]);

  const msgCount = messages.length;
  useEffect(() => {
    // Only scroll on new message, not on loading state change
    if (msgCount === 0) return;
    const el = document.getElementById("chat-scroll");
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isNearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgCount]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  const pollOutput = useCallback(async (runId: string, msgId: string) => {
    const maxAttempts = 24;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const res = await fetch("/api/nexus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "output", run_id: runId }),
        });
        const data = await res.json();
        if (data.status === "done" || data.status === "failed") {
          const emoji = data.status === "done" ? "✅" : "❌";
          const body = data.image_b64
            ? `__IMAGE__data:image/jpeg;base64,${data.image_b64}`
            : `${emoji} ${data.status.toUpperCase()}\n\n${data.output ?? "No output"}`;
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: body } : m));
          return;
        }
      } catch { /* keep polling */ }
    }
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, content: "⏱ Timed out waiting for output." } : m
    ));
  }, []);

  const handleSend = useCallback(async (forceAuto = false, overridePrompt?: string) => {
    const prompt = (overridePrompt ?? input).trim();
    if (!prompt || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const detected = detectDifficulty(prompt);
    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content: prompt,
      difficulty: detected, timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Intent classification
      let intent = "ask";
      if (forceAuto || forceAutomate) {
        intent = "automation";
      } else {
        try {
          const ir = await fetch("/api/nexus", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "classify", prompt }),
          });
          const id = await ir.json();
          intent = id.intent ?? "ask";
        } catch {
          intent = IMAGE_KEYWORDS.some(k => prompt.toLowerCase().includes(k)) ? "image" : "ask";
        }
      }

      const isImage = intent === "image";
      const isAutomation = intent === "automation";
      const finalDiff: Difficulty = forceAuto || forceAutomate ? (detected === "easy" ? "medium" : detected) : detected;

      const start = Date.now();
      const res = await fetch("/api/nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: isImage ? "image" : isAutomation ? "deploy" : "ask",
          prompt,
          task: isAutomation ? "automation" : undefined,
          difficulty: finalDiff,
        }),
      });

      const data = await res.json();
      const provider = data.provider ?? "nexus";
      const responseTime = Date.now() - start;

      const content = isImage
        ? (data.image_b64 ? `__IMAGE__data:image/jpeg;base64,${data.image_b64}` : data.image_url ? `__IMAGE__${data.image_url}` : "Image generation failed")
        : isAutomation
        ? `⏳ Running...\n\nProvider: ${provider} · ${finalDiff}\n\nFetching output...`
        : data.response ?? data.error ?? "No response";

      const assistantMsg: Message = {
        id: crypto.randomUUID(), role: "assistant", content,
        provider, difficulty: finalDiff, timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (isAutomation) {
        const scriptFile = data.file ?? null;
        if (scriptFile) setPendingScript({ filepath: scriptFile, prompt });
        // Use filename as run_id since GitHub Actions dispatch doesn't return run_id
        const runId = data.run_id ?? scriptFile?.replace("scripts/","").replace(".py","") ?? null;
        if (runId) {
          const mid = assistantMsg.id;
          setTimeout(() => pollOutput(runId, mid), 8000);
        }
      }

      setForceAutomate(false);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: "Connection error. Check Nexus.", timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, forceAutomate, pollOutput]);

  const glowPulse = `
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.08); }
    }
    @keyframes orbit {
      from { transform: rotate(0deg) translateX(22px) rotate(0deg); }
      to   { transform: rotate(360deg) translateX(22px) rotate(-360deg); }
    }
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes ticker {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 2px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #44403C; border-radius: 4px; }
    .msg-in { animation: fade-in 0.2s ease; }
    .gold-text {
      background: linear-gradient(90deg, #F59E0B, #FCD34D, #F59E0B);
      background-size: 200% auto;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: shimmer 4s linear infinite;
    }
    .suggestion:hover {
      border-color: rgba(245,158,11,0.45) !important;
      background: rgba(245,158,11,0.08) !important;
      color: #FCD34D !important;
    }
  `;

  // tickerItems loaded from Nexus /ticker endpoint

  return (
    <div style={{
      background: "#080806",
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      overflow: "hidden",
      position: "relative",
      color: "#FEF3C7",
    }}>
      <style>{glowPulse}</style>

      {/* Noise texture overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.025,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` ,
        backgroundSize: "200px 200px",
      }} />

      {/* Amber glow top */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 70% 35% at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 70%)",
      }} />

      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* Ticker tape */}
      <div style={{
        position: "relative", zIndex: 10, overflow: "hidden",
        background: "rgba(245,158,11,0.06)",
        borderBottom: "1px solid rgba(245,158,11,0.12)",
        height: 22, flexShrink: 0, display: "flex", alignItems: "center",
      }}>
        <div style={{
          display: "flex", gap: 40, whiteSpace: "nowrap",
          animation: "ticker 20s linear infinite",
        }}>
          {[...(tickerItems.some(t => t.includes("%")) ? tickerItems : ["LOADING MARKET DATA..."]), ...(tickerItems.some(t => t.includes("%")) ? tickerItems : ["LOADING MARKET DATA..."])].map((item, i) => (
            <span key={i} style={{
              fontSize: 9, letterSpacing: "1.5px", color: "#D97706", fontFamily: "inherit",
            }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <div style={{
        position: "relative", zIndex: 10,
        padding: "10px 16px",
        borderBottom: "1px solid rgba(245,158,11,0.12)",
        background: "rgba(8,8,6,0.85)",
        backdropFilter: "blur(24px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Gold orb */}
          <div style={{ position: "relative", width: 28, height: 28 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #FCD34D, #F59E0B 55%, #92400E)",
              boxShadow: "0 0 16px rgba(245,158,11,0.7), 0 0 32px rgba(245,158,11,0.2)",
              animation: "glow-pulse 3s ease-in-out infinite",
            }} />
            <div style={{
              position: "absolute", width: 4, height: 4, borderRadius: "50%",
              background: "#FEF3C7", boxShadow: "0 0 6px #FEF3C7",
              top: "50%", left: "50%", marginTop: -2, marginLeft: -2,
              animation: "orbit 5s linear infinite",
            }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "4px", color: "#FEF3C7" }}>
              NEXUS
            </div>
            <div style={{ fontSize: 8, color: "#92400E", letterSpacing: "2.5px", marginTop: -1 }}>
              SHIKAMARU · ONLINE
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 8, color: "#78716C", letterSpacing: "1px" }}>SYSTEM</div>
            <div style={{ fontSize: 9, color: "#F59E0B" }}>ACTIVE</div>
          </div>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#F59E0B",
            boxShadow: "0 0 10px #F59E0B",
            animation: "glow-pulse 2s ease-in-out infinite",
          }} />
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", padding: "0 12px",
        borderBottom: "1px solid rgba(245,158,11,0.1)",
        background: "rgba(8,8,6,0.7)", backdropFilter: "blur(10px)",
        flexShrink: 0,
      }}>
        {([
          { id: "chat", label: "CHAT", icon: "◈" },
          { id: "projects", label: "PROJECTS", icon: "◉" },
          { id: "activity", label: "ACTIVITY", icon: "◎" },
        ] as { id: Tab; label: string; icon: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px 7px", border: "none", cursor: "pointer",
            fontSize: 9, fontFamily: "inherit", letterSpacing: "2px",
            fontWeight: tab === t.id ? 700 : 400,
            background: "transparent",
            color: tab === t.id ? "#F59E0B" : "#44403C",
            borderBottom: tab === t.id ? "2px solid #F59E0B" : "2px solid transparent",
            transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: 5,
            marginBottom: -1,
          }}>
            <span style={{ fontSize: 10 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, position: "relative", zIndex: 5, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AnimatePresence mode="wait">

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (
          <motion.div key="chat"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>

            {/* Messages */}
            <div id="chat-scroll" style={{
              flex: 1, overflowY: "scroll", padding: "16px 12px 8px",
              WebkitOverflowScrolling: "touch",
              minHeight: 0,
              overflowX: "hidden",
            }}>
              {messages.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", height: "100%", paddingTop: 24, gap: 0 }}>
                  {/* Compact identity block */}
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div className="gold-text" style={{ fontSize: 32, fontWeight: 900, letterSpacing: "8px", lineHeight: 1 }}>NEXUS</div>
                    <div style={{ fontSize: 9, color: "#57534E", letterSpacing: "3px", marginTop: 4 }}>PERSONAL · AI · SYSTEM</div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                    {[
                      { label: "AGENTS", val: "9" },
                      { label: "STATUS", val: "LIVE" },
                      { label: "MODE", val: "AUTO" },
                    ].map((s, i) => (
                      <div key={i} style={{
                        flex: 1, padding: "8px 0", textAlign: "center",
                        background: "rgba(245,158,11,0.04)",
                        border: "1px solid rgba(245,158,11,0.12)",
                        borderRadius: 8,
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B" }}>{s.val}</div>
                        <div style={{ fontSize: 8, color: "#57534E", letterSpacing: "1px", marginTop: 1 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Suggestions */}
                  <div style={{ fontSize: 9, color: "#44403C", letterSpacing: "2px", marginBottom: 8 }}>QUICK COMMANDS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {SUGGESTIONS.map((s, i) => (
                      <button key={i} className="suggestion" onClick={() => handleSend(false, s)} style={{
                        background: "rgba(245,158,11,0.03)",
                        border: "1px solid rgba(245,158,11,0.1)",
                        borderRadius: 8, padding: "10px 14px",
                        color: "#78716C", fontSize: 11, fontFamily: "inherit",
                        textAlign: "left", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "all 0.15s",
                      }}>
                        <span>{s}</span>
                        <span style={{ color: "#44403C", fontSize: 12 }}>›</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {messages.map(m => (
                    <div key={m.id} className="msg-in" style={{
                      display: "flex",
                      justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                    }}>
                      <div style={{ maxWidth: "88%", display: "flex", flexDirection: "column", gap: 4, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>

                        {/* Meta row */}
                        {m.role === "assistant" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2 }}>
                            <span style={{ fontSize: 13 }}>{PROVIDER_ICONS[m.provider ?? ""] ?? "🤖"}</span>
                            <span style={{ fontSize: 9, color: "#57534E", letterSpacing: "1px", textTransform: "uppercase" }}>
                              {m.provider}
                            </span>
                            {m.difficulty && (
                              <span style={{
                                fontSize: 8, padding: "1px 5px", borderRadius: 3,
                                background: `${DIFF_COLOR[m.difficulty]}18`,
                                color: DIFF_COLOR[m.difficulty],
                                border: `1px solid ${DIFF_COLOR[m.difficulty]}40`,
                                letterSpacing: "1px",
                              }}>{m.difficulty.toUpperCase()}</span>
                            )}
                          </div>
                        )}

                        {/* Bubble */}
                        <div style={{
                          padding: "10px 14px",
                          borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                          background: m.role === "user"
                            ? "linear-gradient(135deg, #D97706, #92400E)"
                            : "rgba(255,255,255,0.03)",
                          border: m.role === "user" ? "none" : "1px solid rgba(245,158,11,0.1)",
                          color: m.role === "user" ? "#FEF3C7" : "#D6D3D1",
                          fontSize: 13, lineHeight: 1.65,
                          boxShadow: m.role === "user"
                            ? "0 4px 20px rgba(217,119,6,0.3)"
                            : "none",
                          wordBreak: "break-word",
                        }}>
                          {m.role === "assistant" && m.content.startsWith("__IMAGE__") ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <img
                                src={m.content.replace("__IMAGE__", "")}
                                alt="Generated"
                                style={{ maxWidth: "100%", borderRadius: 10, display: "block" }}
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                              <a
                                href={m.content.replace("__IMAGE__", "")}
                                download="nexus-image.jpg"
                                target="_blank" rel="noreferrer"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "5px 10px", borderRadius: 6, width: "fit-content",
                                  background: "rgba(245,158,11,0.08)",
                                  border: "1px solid rgba(6,182,212,0.3)",
                                  color: "#F59E0B", fontSize: 10, textDecoration: "none",
                                  letterSpacing: "1px",
                                }}>
                                ⬇ DOWNLOAD
                              </a>
                            </div>
                          ) : m.role === "assistant" ? (
                            m.content.split("\n").map((line, i) => {
                              if (line.startsWith("🧠 Think:")) return (
                                <div key={i} style={{ color: "#F59E0B", fontSize: 11, marginBottom: 5, padding: "3px 8px", background: "rgba(245,158,11,0.08)", borderRadius: 5, borderLeft: "2px solid #D97706" }}>{line}</div>
                              );
                              if (line.startsWith("⚡ Act:")) return (
                                <div key={i} style={{ color: "#F59E0B", fontSize: 11, marginBottom: 5, padding: "3px 8px", background: "rgba(245,158,11,0.08)", borderRadius: 5, borderLeft: "2px solid #F59E0B" }}>{line}</div>
                              );
                              if (line.startsWith("✅") || line.startsWith("❌")) return (
                                <div key={i} style={{ fontWeight: 700, marginBottom: 4, color: line.startsWith("✅") ? "#10B981" : "#EF4444" }}>{line}</div>
                              );
                              if (line === "") return <div key={i} style={{ height: 6 }} />;
                              return <div key={i}>{line}</div>;
                            })
                          ) : m.content}
                        </div>

                        {/* Timestamp */}
                        <div style={{ fontSize: 9, color: "#44403C", letterSpacing: "0.5px" }}>
                          {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {loading && (
                    <div style={{ display: "flex", gap: 5, padding: "12px 14px", alignItems: "center" }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: "#F59E0B",
                          animation: `glow-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                      ))}
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Pending script bar */}
            {pendingScript && !showSaveInput && (
              <div style={{
                margin: "0 12px 6px",
                padding: "8px 12px",
                background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, color: "#92400E", fontFamily: "inherit", letterSpacing: "0.5px" }}>
                  📄 {pendingScript.filepath.split("/").pop()}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setShowSaveInput(true)} style={{
                    fontSize: 9, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(245,158,11,0.3)",
                    background: "rgba(245,158,11,0.1)", color: "#F59E0B", cursor: "pointer", fontFamily: "inherit",
                  }}>SAVE</button>
                  <button onClick={async () => {
                    await fetch("/api/nexus", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ endpoint: "delete-script", filepath: pendingScript.filepath }) });
                    setPendingScript(null);
                  }} style={{
                    fontSize: 9, padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(239,68,68,0.3)",
                    background: "rgba(239,68,68,0.08)", color: "#EF4444", cursor: "pointer", fontFamily: "inherit",
                  }}>DELETE</button>
                </div>
              </div>
            )}

            {showSaveInput && pendingScript && (
              <div style={{
                margin: "0 12px 6px", padding: "8px 12px",
                background: "rgba(245,158,11,0.04)", border: "1px solid rgba(124,58,237,0.2)",
                borderRadius: 8, display: "flex", gap: 6, flexShrink: 0,
              }}>
                <input
                  value={saveName} onChange={e => setSaveName(e.target.value)}
                  placeholder="Name this automation..."
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "#C4C4E8", fontSize: 11, fontFamily: "inherit",
                  }}
                />
                <button onClick={() => {
                  if (!saveName.trim()) return;
                  const newAuto: SavedAutomation = {
                    id: crypto.randomUUID(), name: saveName,
                    prompt: pendingScript.prompt, filepath: pendingScript.filepath,
                    createdAt: new Date().toISOString(),
                  };
                  setSavedAutomations(prev => [...prev, newAuto]);
                  setPendingScript(null); setShowSaveInput(false); setSaveName("");
                }} style={{
                  fontSize: 9, padding: "3px 10px", borderRadius: 5,
                  border: "1px solid rgba(124,58,237,0.4)",
                  background: "rgba(245,158,11,0.1)", color: "#F59E0B",
                  cursor: "pointer", fontFamily: "inherit",
                }}>SAVE</button>
                <button onClick={() => { setShowSaveInput(false); setSaveName(""); }} style={{
                  fontSize: 9, padding: "3px 8px", borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent", color: "#57534E",
                  cursor: "pointer", fontFamily: "inherit",
                }}>✕</button>
              </div>
            )}

            {/* Input area */}
            <div style={{
              padding: "8px 12px 12px", flexShrink: 0,
              borderTop: "1px solid rgba(245,158,11,0.08)",
              background: "rgba(5,5,8,0.6)", backdropFilter: "blur(20px)",
            }}>
              {/* Difficulty selector */}
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {(["easy","medium","hard"] as Difficulty[]).map(d => (
                  <button key={d} onClick={() => setDifficulty(d)} style={{
                    padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                    fontSize: 9, fontFamily: "inherit", letterSpacing: "1px",
                    background: difficulty === d ? `${DIFF_COLOR[d]}20` : "transparent",
                    color: difficulty === d ? DIFF_COLOR[d] : "#44403C",
                    borderBottom: difficulty === d ? `1px solid ${DIFF_COLOR[d]}` : "1px solid transparent",
                    transition: "all 0.15s",
                  }}>{d.toUpperCase()}</button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={() => setForceAutomate(v => !v)} style={{
                  padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                  fontSize: 9, fontFamily: "inherit", letterSpacing: "1px",
                  background: forceAutomate ? "rgba(6,182,212,0.15)" : "transparent",
                  color: forceAutomate ? "#F59E0B" : "#44403C",
                  borderBottom: forceAutomate ? "1px solid #06B6D4" : "1px solid transparent",
                  transition: "all 0.15s",
                }}>⚡ AUTO</button>
              </div>

              {/* Text input row */}
              <div style={{
                display: "flex", gap: 8, alignItems: "flex-end",
                background: "rgba(245,158,11,0.03)",
                border: "1px solid rgba(245,158,11,0.15)",
                borderRadius: 12, padding: "8px 10px",
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(forceAutomate); }
                  }}
                  placeholder="Ask anything..."
                  rows={1}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "#E8E8F8", fontSize: 13, fontFamily: "inherit",
                    resize: "none", lineHeight: 1.5, maxHeight: 120,
                    overflowY: "auto",
                  }}
                />
                <button
                  onClick={() => handleSend(forceAutomate)}
                  disabled={!input.trim() || loading}
                  style={{
                    width: 34, height: 34, borderRadius: 8, border: "none",
                    background: input.trim() && !loading
                      ? "linear-gradient(135deg, #F59E0B, #D97706)"
                      : "rgba(255,255,255,0.04)",
                    color: input.trim() && !loading ? "#080806" : "#44403C",
                    cursor: input.trim() && !loading ? "pointer" : "default",
                    fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: input.trim() && !loading ? "0 0 16px rgba(245,158,11,0.5)" : "none",
                    transition: "all 0.2s", flexShrink: 0,
                  }}>
                  →
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PROJECTS TAB ── */}
        {tab === "projects" && (
          <motion.div key="projects"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ height: "100%", overflowY: "auto", padding: "16px 12px" }}>

            <div style={{ fontSize: 9, color: "#57534E", letterSpacing: "2px", marginBottom: 14 }}>ACTIVE REPOS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {projects.map(p => (
                <div key={p.id} style={{
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(124,58,237,0.15)",
                  borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#C4C4E8", marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: "#57534E" }}>{p.lastCommit}</div>
                  </div>
                  <div style={{
                    fontSize: 8, padding: "2px 8px", borderRadius: 4, letterSpacing: "1px",
                    background: p.status === "active" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                    color: p.status === "active" ? "#10B981" : "#57534E",
                    border: `1px solid ${p.status === "active" ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.05)"}`,
                  }}>{p.status.toUpperCase()}</div>
                </div>
              ))}
            </div>

            {savedAutomations.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: "#57534E", letterSpacing: "2px", marginBottom: 12 }}>SAVED AUTOMATIONS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {savedAutomations.map(a => (
                    <div key={a.id} style={{
                      padding: "10px 14px",
                      background: "rgba(245,158,11,0.03)",
                      border: "1px solid rgba(6,182,212,0.12)",
                      borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#F59E0B", marginBottom: 2 }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: "#57534E" }}>{a.prompt.slice(0, 48)}…</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button onClick={() => { setTab("chat"); handleSend(true, a.prompt); }} style={{
                          fontSize: 9, padding: "3px 8px", borderRadius: 5,
                          border: "1px solid rgba(6,182,212,0.3)",
                          background: "rgba(245,158,11,0.08)", color: "#F59E0B",
                          cursor: "pointer", fontFamily: "inherit",
                        }}>▶ RUN</button>
                        <button onClick={() => setSavedAutomations(prev => prev.filter(x => x.id !== a.id))} style={{
                          fontSize: 10, width: 22, height: 22, borderRadius: 5,
                          border: "1px solid rgba(239,68,68,0.2)",
                          background: "rgba(239,68,68,0.06)", color: "#EF4444",
                          cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
                        }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {tab === "activity" && (
          <motion.div key="activity"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ height: "100%", overflowY: "auto", padding: "16px 12px" }}>
            <div style={{ fontSize: 9, color: "#57534E", letterSpacing: "2px", marginBottom: 14 }}>SYSTEM ACTIVITY</div>
            {messages.filter(m => m.role === "assistant").length === 0 ? (
              <div style={{ color: "#44403C", fontSize: 11, textAlign: "center", marginTop: 40 }}>
                No activity yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {messages.filter(m => m.role === "assistant").map((m, i) => (
                  <div key={m.id} style={{
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(124,58,237,0.1)",
                    borderRadius: 8,
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 14 }}>{PROVIDER_ICONS[m.provider ?? ""] ?? "🤖"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: "#78716C", marginBottom: 2 }}>{m.provider?.toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: "#57534E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.content.startsWith("__IMAGE__") ? "🖼 Image generated" : m.content.slice(0, 60)}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: "#44403C", flexShrink: 0 }}>
                      {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        </AnimatePresence>
      </div>
    </div>
  );
}