"use client";
import OSINTPanel from "@/components/OSINTPanel";
import TaskBoard from "@/components/TaskBoard";
// @ts-ignore
import LZString from "lz-string";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Role = "user" | "assistant";
type Difficulty = "easy" | "medium" | "hard";
type Tab = "chat" | "projects" | "activity" | "osint";

interface Message {
  id: string;
  role: Role;
  content: string;
  provider?: string;
  difficulty?: Difficulty;
  timestamp: Date;
  agentLog?: AgentEvent[];
  queryType?: string;
  duration?: number;
}

interface AgentEvent {
  agent: string;
  action: string;
  status: "running" | "done" | "failed";
  duration?: number;
}

interface Chat {
  id: string;
  title: string;
  createdAt: string;
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

const T = {
  bg:       "#0A0A0F",
  surface:  "#12121A",
  border:   "#1E1E2E",
  borderHi: "#2D2D4E",
  purple:   "#C084FC",
  purpleDim:"#7C3AED",
  pink:     "#F472B6",
  green:    "#34D399",
  orange:   "#FB923C",
  blue:     "#60A5FA",
  text:     "#F1F5F9",
  muted:    "#64748B",
  codeBg:   "#0D1117",
  glow:     "rgba(192,132,252,0.15)",
};

const DIFF: Record<Difficulty, {color: string; label: string}> = {
  easy:   { color: "#34D399", label: "EASY" },
  medium: { color: "#FB923C", label: "MED"  },
  hard:   { color: "#F472B6", label: "HARD" },
};

const AGENT_ICONS: Record<string, string> = {
  Orchestrator: "🎯", Planner: "🧠", Search: "🔍",
  Jina: "🕸", Groq: "⚡", Formatter: "📐",
  HuggingFace: "🤗", "GitHub Actions": "⚙️",
};

const IMAGE_KEYWORDS = [
  "generate image","create image","draw","make image","imagine",
  "sketch","paint","visualize","image of","picture of","render","design a","illustration",
];

const INITIAL_PROJECTS: Project[] = [
  { id: "onyx",     name: "Onyx",     repo: "jogendra20/onyx",     status: "active", lastCommit: "PWA reading app"       },
  { id: "hunter",   name: "HUNTER",   repo: "jogendra20/hunter",   status: "active", lastCommit: "NSE journal tool"      },
  { id: "automate", name: "Automate", repo: "jogendra20/Automate", status: "active", lastCommit: "GitHub Actions runner" },
];

const SUGGESTIONS = [
  "What are the latest AI tools in 2025?",
  "Get content from https://arxiv.org/abs/2301.07041 and summarize",
  "Draw a dark cyberpunk city",
  "What is the current Nifty 50 level?",
];

const CHATS_KEY = "nexus_chats_v2";

function loadChats(): Chat[] {
  try { return JSON.parse(localStorage.getItem(CHATS_KEY) ?? "[]"); } catch { return []; }
}
function saveChats(c: Chat[]) {
  try { localStorage.setItem(CHATS_KEY, JSON.stringify(c)); } catch {}
}
function loadMessages(id: string): Message[] {
  try {
    const raw = localStorage.getItem(`nexus_msg_${id}`);
    if (!raw) return [];
    const d = LZString.decompress(raw);
    if (!d) return [];
    return JSON.parse(d).map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch { return []; }
}
function saveMessages(id: string, msgs: Message[]) {
  const sanitized = msgs.map(m => ({
    ...m,
    content: m.content.startsWith("__IMAGE__") ? "__IMAGE__[session only]" : m.content,
  }));
  const compressed = LZString.compress(JSON.stringify(sanitized));
  try {
    localStorage.setItem(`nexus_msg_${id}`, compressed);
  } catch (e: any) {
    if (e?.name === "QuotaExceededError") {
      const chats = loadChats();
      if (chats.length > 1) {
        const oldest = chats[chats.length - 1];
        localStorage.removeItem(`nexus_msg_${oldest.id}`);
        saveChats(chats.slice(0, -1));
        try { localStorage.setItem(`nexus_msg_${id}`, compressed); } catch {}
      }
    }
  }
}
function loadSummary(id: string): string {
  try { return localStorage.getItem(`nexus_sum_${id}`) ?? ""; } catch { return ""; }
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let codeBuffer: string[] = [];
  let codeLang = "";
  let inCode = false;
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLang = line.replace("```","").trim() || "text";
        codeBuffer = [];
      } else {
        elements.push(
          <div key={key++} style={{
            background: "#0D1117", border: "1px solid #1E1E2E",
            borderRadius: 8, margin: "8px 0", overflow: "hidden",
          }}>
            <div style={{ padding: "4px 12px", background: "#161b22",
              fontSize: 10, color: "#64748B", fontFamily: "JetBrains Mono, monospace",
              borderBottom: "1px solid #1E1E2E", letterSpacing: "1px" }}>
              {codeLang.toUpperCase()}
            </div>
            <pre style={{ margin: 0, padding: "12px 14px", fontSize: 12,
              color: "#C084FC", lineHeight: 1.6,
              fontFamily: "JetBrains Mono, monospace",
              overflowX: "auto", whiteSpace: "pre-wrap" }}>
              {codeBuffer.join("\n")}
            </pre>
          </div>
        );
        inCode = false; codeBuffer = [];
      }
      continue;
    }
    if (inCode) { codeBuffer.push(line); continue; }
    if (!line.trim()) { elements.push(<div key={key++} style={{ height: 4 }} />); continue; }

    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*");
    const text = isBullet ? line.replace(/^[•\-\*]\s*/,"") : line;
    const parts = text.split(/\*\*(.+?)\*\*/g).map((p,i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: "#F1F5F9", fontWeight: 700 }}>{p}</strong>
        : <span key={i}>{p}</span>
    );

    elements.push(
      <div key={key++} style={{ display: "flex", gap: 8, marginBottom: 5,
        alignItems: "flex-start", fontSize: 13, lineHeight: 1.6, color: "#CBD5E1" }}>
        {isBullet && <span style={{ color: "#C084FC", marginTop: 2, flexShrink: 0, fontSize: 10 }}>◆</span>}
        <span>{parts}</span>
      </div>
    );
  }
  return elements;
}

function AgentLog({ log, duration }: { log: AgentEvent[]; duration?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        background: "none", border: "none", cursor: "pointer", padding: 0,
        display: "flex", alignItems: "center", gap: 6,
        color: "#64748B", fontSize: 10,
        fontFamily: "JetBrains Mono, monospace", letterSpacing: "1px",
      }}>
        <span style={{ color: "#7C3AED" }}>{open ? "▼" : "▶"}</span>
        AGENT TRACE {duration ? `· ${duration}s` : ""}
      </button>
      {open && (
        <div style={{ marginTop: 6, padding: "8px 10px",
          background: "#12121A", border: "1px solid #1E1E2E",
          borderRadius: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {log.map((e,i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
              fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>
              <span style={{ fontSize: 14, width: 20 }}>{AGENT_ICONS[e.agent] ?? "🤖"}</span>
              <span style={{ color: "#64748B", width: 100 }}>{e.agent}</span>
              <span style={{ color: "#60A5FA", width: 80, letterSpacing: "0.5px" }}>{e.action}</span>
              <span style={{
                color: e.status === "done" ? "#34D399" : e.status === "failed" ? "#F472B6" : "#FB923C",
                fontSize: 10,
              }}>
                {e.status === "done" ? "✓" : e.status === "failed" ? "✗" : "●"}
                {e.duration ? ` ${e.duration}s` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseBar({ phase }: { phase: number }) {
  const phases = ["PARSE","ANALYZE","ROUTE"];
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "6px 0" }}>
      {phases.map((p,i) => (
        <div key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "2px 8px", borderRadius: 4,
            background: i < phase ? "rgba(192,132,252,0.2)" : i === phase ? "rgba(192,132,252,0.1)" : "transparent",
            border: `1px solid ${i <= phase ? "#7C3AED" : "#1E1E2E"}`,
            transition: "all 0.3s",
          }}>
            <span style={{
              fontSize: 9, fontFamily: "JetBrains Mono, monospace",
              color: i < phase ? "#C084FC" : i === phase ? "#F1F5F9" : "#64748B",
              letterSpacing: "1px",
            }}>
              {i < phase ? "✓" : `${i+1}`} {p}
            </span>
          </div>
          {i < 2 && <span style={{ color: "#1E1E2E", fontSize: 10 }}>→</span>}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [input, setInput] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [tab, setTab] = useState<Tab>("chat");
  const [pendingScript, setPendingScript] = useState<PendingScript | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedAutomations, setSavedAutomations] = useState<SavedAutomation[]>([]);
  const [forceAutomate, setForceAutomate] = useState(false);
  const [projects] = useState<Project[]>(INITIAL_PROJECTS);
  const [tickerItems, setTickerItems] = useState<string[]>(["NIFTY 50  —","SENSEX  —","BANKNIFTY  —","USDINR  —"]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = loadChats();
    if (stored.length > 0) {
      setChats(stored);
      setActiveChatId(stored[0].id);
      setMessages(loadMessages(stored[0].id));
    } else {
      const c: Chat = { id: crypto.randomUUID(), title: "New Chat", createdAt: new Date().toISOString() };
      setChats([c]); setActiveChatId(c.id); saveChats([c]);
    }
    const sa = localStorage.getItem("savedAutomations");
    if (sa) setSavedAutomations(JSON.parse(sa));
  }, []);

  useEffect(() => {
    if (!activeChatId || messages.length === 0) return;
    saveMessages(activeChatId, messages);
    const firstUser = messages.find(m => m.role === "user");
    if (firstUser) {
      setChats(prev => {
        const u = prev.map(c => c.id === activeChatId
          ? { ...c, title: firstUser.content.slice(0,36) + "…" } : c);
        saveChats(u); return u;
      });
    }
  }, [messages, activeChatId]);

  useEffect(() => {
    localStorage.setItem("savedAutomations", JSON.stringify(savedAutomations));
  }, [savedAutomations]);

  useEffect(() => {
    const f = async () => {
      try {
        const r = await fetch("https://nexus-56tm.onrender.com/ticker", { signal: AbortSignal.timeout(15000) });
        const d = await r.json();
        if (d.items?.length) setTickerItems(d.items);
      } catch { setTimeout(f, 10000); }
    };
    f();
    const iv = setInterval(f, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const el = document.getElementById("chat-scroll");
    if (!el) return;
    const d = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (d < 300) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
  }, [messages.length]);

  const newChat = () => {
    const c: Chat = { id: crypto.randomUUID(), title: "New Chat", createdAt: new Date().toISOString() };
    const u = [c, ...chats].slice(0,20);
    setChats(u); saveChats(u); setActiveChatId(c.id); setMessages([]); setShowSidebar(false);
  };
  const switchChat = (id: string) => {
    saveMessages(activeChatId, messages);
    setActiveChatId(id); setMessages(loadMessages(id)); setShowSidebar(false);
  };
  const deleteChat = (id: string) => {
    localStorage.removeItem(`nexus_msg_${id}`);
    const u = chats.filter(c => c.id !== id);
    saveChats(u); setChats(u);
    if (id === activeChatId) {
      if (u.length > 0) { setActiveChatId(u[0].id); setMessages(loadMessages(u[0].id)); }
      else newChat();
    }
  };

  const pollOutput = useCallback(async (runId: string, msgId: string) => {
    for (let i = 0; i < 36; i++) {
      await new Promise(r => setTimeout(r, 10000));
      try {
        const res = await fetch("/api/nexus", { method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: "output", run_id: runId }) });
        const data = await res.json();
        if (data.status === "done" || data.status === "failed") {
          const body = data.image_b64
            ? `__IMAGE__data:image/jpeg;base64,${data.image_b64}`
            : `${data.status === "done" ? "✓" : "✗"} ${data.status.toUpperCase()}\n\n${data.output ?? "No output"}`;
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: body } : m));
          return;
        }
      } catch {}
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "⏱ Timed out." } : m));
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  const handleSend = useCallback(async (forceAuto = false, overridePrompt?: string) => {
    const prompt = (overridePrompt ?? input).trim();
    if (!prompt || loading) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: prompt, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true); setLoadingPhase(1);

    try {
      const isImage = !forceAuto && !forceAutomate && IMAGE_KEYWORDS.some(k => prompt.toLowerCase().includes(k));
      const isAuto  = forceAuto || forceAutomate;
      const summary = loadSummary(activeChatId);
      const recentMsgs = messages.slice(-4).map(m => `${m.role.toUpperCase()}: ${m.content.slice(0,300)}`).join("\n");
      const contextPrompt = (summary || recentMsgs)
        ? `${summary ? `Summary: ${summary}\n\n` : ""}${recentMsgs ? `Recent:\n${recentMsgs}\n\n` : ""}Query: ${prompt}`
        : prompt;

      setLoadingPhase(2);
      const res = await fetch("/api/nexus", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: isImage ? "image" : isAuto ? "deploy" : "orchestrate",
          prompt: isAuto ? prompt : contextPrompt,
          task: isAuto ? "automation" : undefined,
        }),
      });

      setLoadingPhase(3);
      const data = await res.json();
      const otype = data.type ?? "text";
      const content =
        isImage ? (data.image_b64 ? `__IMAGE__data:image/jpeg;base64,${data.image_b64}` : data.image_url ? `__IMAGE__${data.image_url}` : "Image generation failed")
        : isAuto  ? "⏳ Running...\n\nGitHub Actions setting up (~2 min). Polling every 10s..."
        : otype === "clarify" ? `❓ ${data.content}`
        : otype === "image"   ? `__IMAGE__${data.content}`
        : data.content ?? data.response ?? "No response";

      const assistantMsg: Message = {
        id: crypto.randomUUID(), role: "assistant", content,
        provider: data.phases?.analyze?.preferred_providers?.[0] ?? "nexus",
        difficulty: data.difficulty ?? difficulty,
        timestamp: new Date(),
        agentLog: data.agent_log,
        queryType: data.query_type,
        duration: data.total_duration,
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (isAuto && data.file) {
        setPendingScript({ filepath: data.file, prompt });
        const runId = data.run_id ?? data.file?.replace("scripts/","").replace(".py","");
        if (runId) setTimeout(() => pollOutput(runId, assistantMsg.id), 30000);
      }
      setForceAutomate(false);
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: "◆ Connection error. Check Nexus.", timestamp: new Date(),
      }]);
    } finally {
      setLoading(false); setLoadingPhase(0);
    }
  }, [input, loading, forceAutomate, difficulty, messages, activeChatId, pollOutput]);

  return (
    <div style={{ background: "#0A0A0F", height: "100dvh", display: "flex", flexDirection: "column",
      fontFamily: "Inter, -apple-system, sans-serif", overflow: "hidden", color: "#F1F5F9", position: "relative" }}>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: #1E1E2E; border-radius: 4px; }
        @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .msg-in { animation: fadeUp 0.2s ease; }
        .suggestion:hover { border-color: #7C3AED !important; background: rgba(192,132,252,0.08) !important; }
        .chat-item:hover { background: rgba(192,132,252,0.05) !important; }
      `}</style>

      <AnimatePresence>
        {showSidebar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 99 }} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 260,
                background: "#12121A", borderRight: "1px solid #1E1E2E",
                zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #1E1E2E",
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "#64748B", letterSpacing: "2px" }}>CHATS</span>
                <button onClick={newChat} style={{
                  fontSize: 10, padding: "4px 10px", borderRadius: 5,
                  border: "1px solid #7C3AED", background: "rgba(192,132,252,0.12)",
                  color: "#C084FC", cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px",
                }}>+ NEW</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {chats.map(c => (
                  <div key={c.id} className="chat-item" onClick={() => switchChat(c.id)} style={{
                    padding: "10px 16px", cursor: "pointer",
                    borderLeft: c.id === activeChatId ? "2px solid #C084FC" : "2px solid transparent",
                    background: c.id === activeChatId ? "rgba(192,132,252,0.06)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, color: c.id === activeChatId ? "#C084FC" : "#F1F5F9",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                      <div style={{ fontSize: 9, color: "#64748B", marginTop: 2 }}>
                        {new Date(c.createdAt).toLocaleDateString()}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteChat(c.id); }} style={{
                      background: "none", border: "none", color: "#64748B",
                      cursor: "pointer", fontSize: 12, padding: "2px 4px", flexShrink: 0,
                    }}>✕</button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Ticker */}
      <div style={{ height: 22, flexShrink: 0, overflow: "hidden",
        background: "rgba(192,132,252,0.05)", borderBottom: "1px solid #1E1E2E",
        display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 40, whiteSpace: "nowrap", animation: "ticker 25s linear infinite" }}>
          {[...tickerItems,...tickerItems].map((item,i) => (
            <span key={i} style={{ fontSize: 9, color: "#64748B", letterSpacing: "1.5px",
              fontFamily: "JetBrains Mono, monospace" }}>{item}</span>
          ))}
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid #1E1E2E",
        background: "rgba(18,18,26,0.9)", backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setShowSidebar(v => !v)} style={{
            background: "none", border: "1px solid #1E1E2E", borderRadius: 6,
            padding: "4px 8px", color: "#64748B", cursor: "pointer", fontSize: 14,
          }}>☰</button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "4px",
              background: "linear-gradient(90deg, #C084FC, #F472B6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NEXUS</div>
            <div style={{ fontSize: 8, color: "#64748B", letterSpacing: "2px", marginTop: -1 }}>
              SHIKAMARU · AGENTIC OS</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={newChat} style={{
            fontSize: 9, padding: "4px 10px", borderRadius: 5,
            border: "1px solid #7C3AED", background: "rgba(192,132,252,0.1)",
            color: "#C084FC", cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px",
          }}>+ NEW</button>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34D399",
            boxShadow: "0 0 8px #34D399", animation: "pulse 2s infinite" }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "0 14px",
        borderBottom: "1px solid #1E1E2E", background: "#0A0A0F", flexShrink: 0 }}>
        {([["chat","◈","CHAT"],["projects","◉","PROJECTS"],["activity","◎","ACTIVITY"],["osint","◈","OSINT"]] as const).map(([id,icon,label]) => (
          <button key={id} onClick={() => setTab(id as Tab)} style={{
            padding: "7px 12px 6px", border: "none", cursor: "pointer",
            fontSize: 9, fontFamily: "inherit", letterSpacing: "2px",
            fontWeight: tab === id ? 700 : 400, background: "transparent",
            color: tab === id ? "#C084FC" : "#64748B",
            borderBottom: tab === id ? "2px solid #C084FC" : "2px solid transparent",
            transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5, marginBottom: -1,
          }}>
            <span style={{ fontSize: 10 }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div id="chat-scroll" style={{ flex: 1, overflowY: "scroll", padding: "16px 14px 8px",
              WebkitOverflowScrolling: "touch", minHeight: 0 }}>
              {messages.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", paddingTop: 20 }}>
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "8px",
                      background: "linear-gradient(135deg, #C084FC, #F472B6)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NEXUS</div>
                    <div style={{ fontSize: 9, color: "#64748B", letterSpacing: "3px", marginTop: 4 }}>
                      AGENTIC · OPERATING · SYSTEM</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                    {[["AGENTS","9"],["STATUS","LIVE"],["PHASES","3"]].map(([l,v],i) => (
                      <div key={i} style={{ flex: 1, padding: "8px 0", textAlign: "center",
                        background: "#12121A", border: "1px solid #1E1E2E", borderRadius: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#C084FC" }}>{v}</div>
                        <div style={{ fontSize: 8, color: "#64748B", letterSpacing: "1px", marginTop: 1 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 9, color: "#64748B", letterSpacing: "2px", marginBottom: 8 }}>QUICK COMMANDS</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {SUGGESTIONS.map((s,i) => (
                      <button key={i} className="suggestion" onClick={() => handleSend(false, s)} style={{
                        background: "#12121A", border: "1px solid #1E1E2E", borderRadius: 8,
                        padding: "10px 14px", color: "#64748B", fontSize: 12, fontFamily: "inherit",
                        textAlign: "left", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "all 0.15s",
                      }}>
                        <span>{s}</span><span style={{ color: "#1E1E2E" }}>›</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {messages.map(m => (
                    <div key={m.id} className="msg-in" style={{
                      display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "90%", display: "flex", flexDirection: "column",
                        gap: 4, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                        {m.role === "assistant" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2 }}>
                            <span style={{ fontSize: 9, color: "#60A5FA",
                              fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.5px",
                              textTransform: "uppercase" }}>{m.queryType ?? "nexus"}</span>
                            {m.difficulty && (
                              <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 3,
                                background: `${DIFF[m.difficulty].color}18`,
                                color: DIFF[m.difficulty].color,
                                border: `1px solid ${DIFF[m.difficulty].color}40`,
                                fontFamily: "JetBrains Mono, monospace", letterSpacing: "1px",
                              }}>{DIFF[m.difficulty].label}</span>
                            )}
                          </div>
                        )}
                        <div style={{
                          padding: "10px 14px",
                          borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "3px 12px 12px 12px",
                          background: m.role === "user"
                            ? "linear-gradient(135deg, #7C3AED, #4C1D95)"
                            : "#12121A",
                          border: m.role === "user" ? "none" : "1px solid #1E1E2E",
                          color: m.role === "user" ? "#F1F5F9" : "#CBD5E1",
                          fontSize: 13, lineHeight: 1.65, wordBreak: "break-word",
                          boxShadow: m.role === "user" ? "0 4px 20px rgba(192,132,252,0.15)" : "none",
                        }}>
                          {m.role === "assistant" && m.content.startsWith("__IMAGE__") ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <img src={m.content.replace("__IMAGE__","")} alt="Generated"
                                style={{ maxWidth: "100%", borderRadius: 8 }}
                                onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                              <a href={m.content.replace("__IMAGE__","")} download target="_blank" rel="noreferrer"
                                style={{ fontSize: 10, color: "#C084FC", textDecoration: "none",
                                  padding: "4px 8px", border: "1px solid #1E1E2E",
                                  borderRadius: 5, display: "inline-block" }}>⬇ DOWNLOAD</a>
                            </div>
                          ) : m.role === "assistant" ? renderContent(m.content) : m.content}
                        </div>
                        {m.role === "assistant" && m.agentLog && m.agentLog.length > 0 && (
                          <AgentLog log={m.agentLog} duration={m.duration} />
                        )}
                        <div style={{ fontSize: 9, color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
                          {m.timestamp.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 0" }}>
                      <PhaseBar phase={loadingPhase} />
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        {[0,1,2].map(i => (
                          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%",
                            background: "#C084FC", animation: `pulse 1.2s ease ${i*0.2}s infinite` }} />
                        ))}
                        <span style={{ fontSize: 10, color: "#64748B",
                          fontFamily: "JetBrains Mono, monospace", marginLeft: 4 }}>
                          {loadingPhase === 1 ? "parsing..." : loadingPhase === 2 ? "analyzing..." : "routing..."}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: "8px 14px 14px", flexShrink: 0,
              borderTop: "1px solid #1E1E2E", background: "rgba(18,18,26,0.9)", backdropFilter: "blur(20px)" }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
                {(["easy","medium","hard"] as Difficulty[]).map(d => (
                  <button key={d} onClick={() => setDifficulty(d)} style={{
                    padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                    fontSize: 9, fontFamily: "inherit", letterSpacing: "1px",
                    background: difficulty === d ? `${DIFF[d].color}18` : "transparent",
                    color: difficulty === d ? DIFF[d].color : "#64748B",
                    borderBottom: difficulty === d ? `1px solid ${DIFF[d].color}` : "1px solid transparent",
                    transition: "all 0.15s",
                  }}>{d.toUpperCase()}</button>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={() => setForceAutomate(v => !v)} style={{
                  padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                  fontSize: 9, fontFamily: "inherit", letterSpacing: "1px",
                  background: forceAutomate ? "rgba(96,165,250,0.15)" : "transparent",
                  color: forceAutomate ? "#60A5FA" : "#64748B",
                  borderBottom: forceAutomate ? "1px solid #60A5FA" : "1px solid transparent",
                  transition: "all 0.15s",
                }}>⚡ AUTO</button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end",
                background: "#12121A", border: "1px solid #2D2D4E",
                borderRadius: 10, padding: "8px 10px" }}>
                <span style={{ color: "#7C3AED", fontSize: 14,
                  fontFamily: "JetBrains Mono, monospace", paddingBottom: 1, flexShrink: 0 }}>›</span>
                <textarea ref={textareaRef} value={input}
                  onChange={e => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(forceAutomate); }}}
                  placeholder="Command Nexus..." rows={1}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "#F1F5F9", fontSize: 13, fontFamily: "Inter, sans-serif",
                    resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }} />
                <button onClick={() => handleSend(forceAutomate)} disabled={!input.trim() || loading}
                  style={{ width: 30, height: 30, borderRadius: 7, border: "none",
                    background: input.trim() && !loading ? "linear-gradient(135deg, #C084FC, #7C3AED)" : "#1E1E2E",
                    color: input.trim() && !loading ? "#F1F5F9" : "#64748B",
                    cursor: input.trim() && !loading ? "pointer" : "default",
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: input.trim() && !loading ? "0 0 16px rgba(192,132,252,0.3)" : "none",
                    transition: "all 0.2s", flexShrink: 0 }}>→</button>
              </div>
            </div>
          </div>
        )}

        {tab === "projects" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            <div style={{ fontSize: 9, color: "#64748B", letterSpacing: "2px", marginBottom: 14 }}>ACTIVE REPOS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {projects.map(p => (
                <div key={p.id} style={{ padding: "12px 14px", background: "#12121A",
                  border: "1px solid #1E1E2E", borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#F1F5F9", marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: "#64748B" }}>{p.lastCommit}</div>
                  </div>
                  <span style={{ fontSize: 8, padding: "2px 8px", borderRadius: 4, letterSpacing: "1px",
                    background: p.status === "active" ? "rgba(52,211,153,0.12)" : "#12121A",
                    color: p.status === "active" ? "#34D399" : "#64748B",
                    border: `1px solid ${p.status === "active" ? "rgba(52,211,153,0.3)" : "#1E1E2E"}` }}>
                    {p.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
            {savedAutomations.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: "#64748B", letterSpacing: "2px", marginBottom: 12 }}>SAVED AUTOMATIONS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {savedAutomations.map(a => (
                    <div key={a.id} style={{ padding: "10px 14px", background: "#12121A",
                      border: "1px solid #1E1E2E", borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#C084FC", marginBottom: 2 }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: "#64748B" }}>{a.prompt.slice(0,48)}…</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setTab("chat"); handleSend(true, a.prompt); }} style={{
                          fontSize: 9, padding: "3px 8px", borderRadius: 5,
                          border: "1px solid #7C3AED", background: "rgba(192,132,252,0.1)",
                          color: "#C084FC", cursor: "pointer", fontFamily: "inherit" }}>▶ RUN</button>
                        <button onClick={() => setSavedAutomations(prev => prev.filter(x => x.id !== a.id))} style={{
                          fontSize: 10, width: 22, height: 22, borderRadius: 5,
                          border: "1px solid rgba(244,114,182,0.3)", background: "rgba(244,114,182,0.08)",
                          color: "#F472B6", cursor: "pointer", fontFamily: "inherit",
                          display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "osint" && (
          <OSINTPanel />
        )}

        {tab === "activity" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
            <div style={{ marginBottom: 20 }}><TaskBoard /></div>
            <div style={{ fontSize: 9, color: "#64748B", letterSpacing: "2px", marginBottom: 14 }}>AGENT ACTIVITY</div>
            {messages.filter(m => m.role === "assistant").length === 0 ? (
              <div style={{ color: "#64748B", fontSize: 11, textAlign: "center", marginTop: 40 }}>No activity yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {messages.filter(m => m.role === "assistant").map(m => (
                  <div key={m.id} style={{ padding: "10px 12px", background: "#12121A",
                    border: "1px solid #1E1E2E", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 9, color: "#C084FC",
                        fontFamily: "JetBrains Mono, monospace", letterSpacing: "1px" }}>
                        {m.queryType?.toUpperCase() ?? "QUERY"}
                      </span>
                      {m.difficulty && (
                        <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3,
                          color: DIFF[m.difficulty].color,
                          border: `1px solid ${DIFF[m.difficulty].color}40`,
                          background: `${DIFF[m.difficulty].color}12` }}>{DIFF[m.difficulty].label}</span>
                      )}
                      {m.duration && (
                        <span style={{ fontSize: 9, color: "#64748B", marginLeft: "auto",
                          fontFamily: "JetBrains Mono, monospace" }}>{m.duration}s</span>
                      )}
                    </div>
                    {m.agentLog && m.agentLog.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {m.agentLog.map((e,i) => (
                          <div key={i} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4,
                            background: e.status === "done" ? "rgba(52,211,153,0.1)" : e.status === "failed" ? "rgba(244,114,182,0.1)" : "rgba(251,146,60,0.1)",
                            color: e.status === "done" ? "#34D399" : e.status === "failed" ? "#F472B6" : "#FB923C",
                            fontFamily: "JetBrains Mono, monospace",
                            display: "flex", alignItems: "center", gap: 4 }}>
                            <span>{AGENT_ICONS[e.agent] ?? "🤖"}</span>
                            <span>{e.agent}</span>
                            {e.duration && <span style={{ color: "#64748B" }}>·{e.duration}s</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
