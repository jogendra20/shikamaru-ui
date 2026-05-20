"use client";
import { useState, useCallback, useEffect } from "react";
import { Message, AgentActivity, Difficulty, Project } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Zap, FolderOpen, Activity, MessageSquare, ChevronRight } from "lucide-react";

const PROVIDER_ICONS: Record<string, string> = {
  mistral: "💻", gemini: "✨", groq: "🚀", nvidia: "🧠",
  github_models: "🔮", cerebras: "⚡", openrouter: "🌐", huggingface: "🤗", nexus: "🎯",
};

const IMAGE_KEYWORDS = ["generate image","create image","draw","make image","imagine","sketch","paint","visualize"];

const INITIAL_PROJECTS: Project[] = [
  { id: "onyx", name: "Onyx", repo: "jogendra20/onyx", status: "active", lastCommit: "PWA reading app" },
  { id: "hunter", name: "HUNTER", repo: "jogendra20/hunter", status: "active", lastCommit: "NSE journal tool" },
];

function detectDifficulty(prompt: string): Difficulty {
  const p = prompt.toLowerCase();
  const hard = ["architecture","analyze","compare","deep","comprehensive","strategy","build full","implement"];
  const medium = ["scrape","automate","extract","fill form","portal","multiple","fetch all","playwright"];
  if (hard.some(k => p.includes(k))) return "hard";
  if (medium.some(k => p.includes(k))) return "medium";
  return "easy";
}

const DIFF_STYLE = {
  easy:   { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30", glow: "" },
  medium: { text: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/30",    glow: "" },
  hard:   { text: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/30",   glow: "shadow-[0_0_12px_rgba(251,191,36,0.2)]" },
};

type Tab = "chat" | "projects" | "activity";

interface PendingScript {
  filepath: string;
  prompt: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [detected, setDetected] = useState<Difficulty>("easy");
  const [tab, setTab] = useState<Tab>("chat");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [pendingScript, setPendingScript] = useState<PendingScript | null>(null);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [forceAutomate, setForceAutomate] = useState(false);
  const [savedAutomations, setSavedAutomations] = useState<{id:string;name:string;filepath:string;prompt:string;savedAt:number}[]>(() => {
    try {
      const stored = localStorage.getItem("shikamaru_automations");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const handleInput = (v: string) => {
    setInput(v);
    if (v.trim()) {
      const d = detectDifficulty(v);
      setDetected(d);
      setDifficulty(d);
    }
  };

  const isVague = (p: string) => {
    const words = p.trim().split(/\s+/);
    const actionVerbs = ["scrape","fetch","go to","open","analyze","compare","build","extract","automate","find","search","get","check","monitor","download","send","create","list","show"];
    const hasAction = actionVerbs.some(v => p.toLowerCase().includes(v));
    return words.length < 6 || !hasAction;
  };

  const handleEnhance = async () => {
    if (!input.trim() || loading || enhancing) return;
    if (!isVague(input.trim())) { handleSend(); return; }
    setEnhancing(true);
    try {
      const res = await fetch("/api/nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "enhance", prompt: input.trim() }),
      });
      const data = await res.json();
      if (data.enhanced) {
        setEnhancedPrompt(data.enhanced);
      } else {
        handleSend();
      }
    } catch {
      handleSend();
    } finally {
      setEnhancing(false);
    }
  };

  const handleAutomate = async () => {
    if (!input.trim() || loading || enhancing) return;
    setForceAutomate(true);
    if (difficulty === "easy") setDifficulty("medium");
    if (isVague(input.trim())) {
      await handleEnhance();
    } else {
      handleSend(true);
    }
  };

  const addActivity = useCallback((a: AgentActivity) => {
    setActivities(prev => [a, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("shikamaru_automations", JSON.stringify(savedAutomations));
    } catch { /* storage full or SSR */ }
  }, [savedAutomations]);

  const handleSend = async (forceAuto: boolean = false) => {
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setInput("");
    setForceAutomate(false);

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content: prompt,
      difficulty, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setTab("chat");

    addActivity({
      id: crypto.randomUUID(), provider: "nexus", status: "thinking",
      task: prompt.slice(0, 60), timestamp: Date.now(),
    });

    try {
      const isImage = IMAGE_KEYWORDS.some(k => prompt.toLowerCase().includes(k));

      const isAutomation = !isImage && (forceAuto || forceAutomate || ["scrape","automate","extract","fill form","playwright","portal","crawl"]
        .some(k => prompt.toLowerCase().includes(k));

      const start = Date.now();
      const res = await fetch("/api/nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: isImage ? "image" : isAutomation ? "deploy" : "ask",
          prompt,
          task: isAutomation ? "automation" : undefined,
          difficulty,
        }),
      });

      const data = await res.json();
      const elapsed = Date.now() - start;
      const provider = data.provider ?? "nexus";

      addActivity({
        id: crypto.randomUUID(), provider, status: data.error ? "failed" : "done",
        task: prompt.slice(0, 60), responseTime: elapsed, timestamp: Date.now(),
      });

      const scriptFile = data.file ?? null;
      if (isAutomation && scriptFile) {
        setPendingScript({ filepath: scriptFile, prompt });
      }
      const imageUrl = isImage ? (data.image_url ?? null) : null;
      const content = isImage
        ? (data.image_url ? `__IMAGE__${data.image_url}` : "Image generation failed")
        : isAutomation
        ? `Automation queued\n\nProvider: ${provider}\nDifficulty: ${difficulty}\n\nScript running — output will appear here.`
        : data.response ?? data.error ?? "No response";

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant", content, provider,
        task: data.task, difficulty, timestamp: Date.now(),
        isCode: content.includes("def ") || content.includes("import "),
      }]);
    } catch {
      addActivity({
        id: crypto.randomUUID(), provider: "nexus", status: "failed",
        task: prompt.slice(0, 60), timestamp: Date.now(),
      });
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: "Connection failed. Check Nexus status.",
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#07070E", height: "100dvh", display: "flex", flexDirection: "column", fontFamily: "Geist, sans-serif", overflow: "hidden" }}>
      
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #1a1a2e", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0A0A14", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#F1F1F1", letterSpacing: "-0.5px" }}>NEXUS</div>
          <div style={{ fontSize: 10, color: "#F59E0B", fontFamily: "monospace", letterSpacing: "2px", marginTop: 1 }}>SHIKAMARU · ONLINE</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
          <span style={{ fontSize: 11, color: "#8888AA", fontFamily: "monospace" }}>
            {activities.filter(a => a.status === "thinking").length > 0 ? "working..." : "ready"}
          </span>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}>

        {/* CHAT TAB */}
        <AnimatePresence mode="wait">
          {tab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
            >
              {/* Messages */}
              <div id="chat-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0", WebkitOverflowScrolling: "touch" }}>
                {messages.length === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                    <div style={{ fontSize: 40 }}>🎯</div>
                    <div style={{ color: "#8888AA", fontSize: 13, fontFamily: "monospace", textAlign: "center" }}>What needs to be done?</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 8 }}>
                      {["What is VWAP?", "Scrape NSE top gainers", "Analyze HUNTER codebase"].map(s => (
                        <motion.button
                          key={s}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setInput(s); handleInput(s); }}
                          style={{ background: "#12121C", border: "1px solid #1E1E2E", borderRadius: 10, padding: "10px 14px", color: "#8888AA", fontSize: 12, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                        >
                          <span>{s}</span>
                          <ChevronRight size={12} />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}
                    >
                      <div style={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 4, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                        {m.role === "assistant" && m.provider && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 2 }}>
                            <span style={{ fontSize: 12 }}>{PROVIDER_ICONS[m.provider] ?? "🤖"}</span>
                            <span style={{ fontSize: 10, color: "#8888AA", fontFamily: "monospace", textTransform: "capitalize" }}>
                              {m.provider.replace("_", " ")}
                            </span>
                            {m.difficulty && (
                              <span style={{
                                fontSize: 9, fontFamily: "monospace", padding: "1px 6px", borderRadius: 4,
                                color: DIFF_STYLE[m.difficulty].text.replace("text-", "").includes("emerald") ? "#34D399" : m.difficulty === "hard" ? "#F59E0B" : "#60A5FA",
                                background: m.difficulty === "hard" ? "rgba(245,158,11,0.1)" : m.difficulty === "medium" ? "rgba(96,165,250,0.1)" : "rgba(52,211,153,0.1)",
                                border: `1px solid ${m.difficulty === "hard" ? "rgba(245,158,11,0.3)" : m.difficulty === "medium" ? "rgba(96,165,250,0.3)" : "rgba(52,211,153,0.3)"}`,
                              }}>
                                {m.difficulty}
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{
                          borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          padding: "10px 14px",
                          background: m.role === "user" ? "#F59E0B" : "#12121C",
                          color: m.role === "user" ? "#000" : "#F1F1F1",
                          fontSize: 14,
                          lineHeight: 1.6,
                          border: m.role === "assistant" ? "1px solid #1E1E2E" : "none",
                          wordBreak: "break-word",
                        }}>
                          {m.role === "assistant" && m.content.startsWith("__IMAGE__") ? (
                            <img
                              src={m.content.replace("__IMAGE__", "")}
                              alt="Generated"
                              style={{ maxWidth: "100%", borderRadius: 10, marginTop: 4 }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : m.role === "assistant" ? m.content.split("\n").map((line: string, i: number) => {
                            if (line.startsWith("🧠 Think:")) return (
                              <div key={i} style={{ color: "#A78BFA", fontSize: 12, fontFamily: "monospace", marginBottom: 6, padding: "4px 8px", background: "rgba(167,139,250,0.08)", borderRadius: 6, borderLeft: "2px solid #A78BFA" }}>{line}</div>
                            );
                            if (line.startsWith("⚡ Act:")) return (
                              <div key={i} style={{ color: "#F59E0B", fontSize: 12, fontFamily: "monospace", marginBottom: 6, padding: "4px 8px", background: "rgba(245,158,11,0.08)", borderRadius: 6, borderLeft: "2px solid #F59E0B" }}>{line}</div>
                            );
                            if (line.startsWith("👁️ Observe:")) return (
                              <div key={i} style={{ color: "#10B981", fontSize: 12, fontFamily: "monospace", marginBottom: 6, padding: "4px 8px", background: "rgba(16,185,129,0.08)", borderRadius: 6, borderLeft: "2px solid #10B981" }}>{line}</div>
                            );
                            if (line.startsWith("```") || m.isCode) return (
                              <pre key={i} style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap", margin: "4px 0" }}>{line}</pre>
                            );
                            return <div key={i} style={{ marginBottom: 2 }}>{line}</div>;
                          }) : m.content}
                        </div>
                        <div style={{ fontSize: 10, color: "#8888AA", fontFamily: "monospace", paddingLeft: 2, paddingRight: 2 }}>
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div style={{ background: "#12121C", border: "1px solid #1E1E2E", borderRadius: "18px 18px 18px 4px", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                        <Zap size={12} color="#F59E0B" style={{ animation: "pulse 1s infinite" }} />
                        <span style={{ fontSize: 12, color: "#8888AA", fontFamily: "monospace" }}>routing to best agent...</span>
                      </div>
                    </motion.div>
                  )}
                </div>
                {/* Save / Delete prompt */}
                {pendingScript && !showSaveInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: "#12121C", border: "1px solid #F59E0B44", borderRadius: 14, padding: 14, margin: "4px 0" }}
                  >
                    <div style={{ fontSize: 12, color: "#8888AA", marginBottom: 10, fontFamily: "monospace" }}>
                      💾 Keep this script?
                    </div>
                    <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: "monospace", marginBottom: 12, wordBreak: "break-all" }}>
                      {pendingScript.filepath}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowSaveInput(true)}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#F59E0B", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}
                      >
                        Save
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          await fetch("/api/nexus", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ endpoint: "delete-script", filepath: pendingScript.filepath }),
                          });
                          setPendingScript(null);
                          setMessages(prev => [...prev, {
                            id: crypto.randomUUID(), role: "assistant",
                            content: "🗑️ Script deleted.",
                            timestamp: Date.now(),
                          }]);
                        }}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}
                      >
                        Delete
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* Save name input */}
                {pendingScript && showSaveInput && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: "#12121C", border: "1px solid #F59E0B44", borderRadius: 14, padding: 14, margin: "4px 0" }}
                  >
                    <div style={{ fontSize: 12, color: "#8888AA", marginBottom: 10, fontFamily: "monospace" }}>
                      Name this automation:
                    </div>
                    <input
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      placeholder="e.g. NSE Top Gainers"
                      autoFocus
                      style={{ width: "100%", background: "#0A0A14", border: "1px solid #1E1E2E", borderRadius: 8, padding: "8px 12px", color: "#F1F1F1", fontSize: 13, fontFamily: "Geist, sans-serif", outline: "none", marginBottom: 10 }}
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (!saveName.trim()) return;
                        setSavedAutomations(prev => [...prev, {
                          id: crypto.randomUUID(),
                          name: saveName.trim(),
                          filepath: pendingScript.filepath,
                          prompt: pendingScript.prompt,
                          savedAt: Date.now(),
                        }]);
                        setPendingScript(null);
                        setShowSaveInput(false);
                        setSaveName("");
                        setMessages(prev => [...prev, {
                          id: crypto.randomUUID(), role: "assistant",
                          content: `✅ Saved as "${saveName.trim()}" — visible in Projects tab.`,
                          timestamp: Date.now(),
                        }]);
                      }}
                      style={{ width: "100%", padding: "8px 0", borderRadius: 8, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#F59E0B", fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}
                    >
                      Confirm Save
                    </motion.button>
                  </motion.div>
                )}

                <div style={{ height: 16 }} />
              </div>

              {/* Enhanced Prompt Card */}
              {enhancedPrompt && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ margin: "0 16px 8px", background: "#12121C", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 14, padding: 14, flexShrink: 0 }}
                >
                  <div style={{ fontSize: 10, color: "#A78BFA", fontFamily: "monospace", letterSpacing: "1px", marginBottom: 8 }}>⚡ PROMPT ENHANCED</div>
                  <div style={{ fontSize: 13, color: "#F1F1F1", lineHeight: 1.6, marginBottom: 12 }}>{enhancedPrompt}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                      const p = enhancedPrompt!;
                      setEnhancedPrompt(null);
                      setInput(p);
                      setTimeout(() => handleSend(forceAutomate), 0);
                    }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.4)", color: "#A78BFA", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}>
                      Use This
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                      setInput(enhancedPrompt);
                      setEnhancedPrompt(null);
                    }} style={{ flex: 1, padding: "7px 0", borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}>
                      Edit
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEnhancedPrompt(null)}
                      style={{ flex: 1, padding: "7px 0", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}>
                      Cancel
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Input */}
              <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #1a1a2e", background: "#0A0A14", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {(["easy", "medium", "hard"] as Difficulty[]).map(d => (
                    <motion.button
                      key={d}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setDifficulty(d)}
                      style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 10, fontFamily: "monospace", cursor: "pointer", border: "1px solid",
                        background: difficulty === d ? (d === "hard" ? "rgba(245,158,11,0.15)" : d === "medium" ? "rgba(96,165,250,0.15)" : "rgba(52,211,153,0.15)") : "transparent",
                        borderColor: difficulty === d ? (d === "hard" ? "rgba(245,158,11,0.5)" : d === "medium" ? "rgba(96,165,250,0.5)" : "rgba(52,211,153,0.5)") : "#1E1E2E",
                        color: difficulty === d ? (d === "hard" ? "#F59E0B" : d === "medium" ? "#60A5FA" : "#34D399") : "#8888AA",
                        boxShadow: difficulty === d && d === "hard" ? "0 0 10px rgba(245,158,11,0.2)" : "none",
                      }}
                    >
                      {d}{detected === d && difficulty !== d ? " ●" : ""}
                    </motion.button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "#12121C", border: "1px solid #1E1E2E", borderRadius: 14, padding: "10px 14px" }}>
                  <textarea
                    value={input}
                    onChange={e => { handleInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnhance(); } }}
                    placeholder="Ask Nexus anything..."
                    rows={1}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#F1F1F1", fontSize: 14, fontFamily: "Geist, sans-serif", resize: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleAutomate}
                    disabled={!input.trim() || loading || enhancing}
                    style={{ background: input.trim() && !loading ? "rgba(96,165,250,0.15)" : "transparent", border: "1px solid", borderColor: input.trim() && !loading ? "rgba(96,165,250,0.4)" : "#1E1E2E", borderRadius: 8, padding: "0 10px", height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s", flexShrink: 0 }}
                  >
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: input.trim() && !loading ? "#60A5FA" : "#8888AA", whiteSpace: "nowrap" }}>⚡ Auto</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={handleEnhance}
                    disabled={!input.trim() || loading || enhancing}
                    style={{ background: input.trim() && !loading && !enhancing ? "#F59E0B" : "#1E1E2E", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s", flexShrink: 0 }}
                  >
                    <Send size={14} color={input.trim() && !loading && !enhancing ? "#000" : "#8888AA"} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* PROJECTS TAB */}
          {tab === "projects" && (
            <motion.div key="projects" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} style={{ height: "100%", overflowY: "auto", padding: 16 }}>
              <div style={{ fontSize: 11, color: "#8888AA", fontFamily: "monospace", letterSpacing: "2px", marginBottom: 16, textTransform: "uppercase" }}>
                Shikamaru Watching
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {INITIAL_PROJECTS.map(p => (
                  <motion.div
                    key={p.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedProject(p.id === selectedProject ? null : p.id)}
                    style={{
                      background: "#12121C", borderRadius: 14, padding: 16, cursor: "pointer",
                      border: `1px solid ${selectedProject === p.id ? "#F59E0B44" : "#1E1E2E"}`,
                      boxShadow: selectedProject === p.id ? "0 0 16px rgba(245,158,11,0.1)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: "#F1F1F1" }}>{p.name}</span>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#8888AA", fontFamily: "monospace", marginBottom: 4 }}>{p.repo}</div>
                    <div style={{ fontSize: 12, color: "#8888AA" }}>{p.lastCommit}</div>
                  </motion.div>
                ))}
              </div>
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 11, color: "#8888AA", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>Saved Automations</div>
                {savedAutomations.length === 0 && (
                  <div style={{ fontSize: 12, color: "#8888AA", fontFamily: "monospace" }}>None saved yet</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {savedAutomations.map(a => (
                    <motion.div
                      key={a.id}
                      style={{ background: "#12121C", borderRadius: 12, padding: 12, border: "1px solid #1E1E2E" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => { setInput(a.prompt); setTab("chat"); }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#F1F1F1", marginBottom: 4 }}>{a.name}</div>
                          <div style={{ fontSize: 11, color: "#8888AA", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.prompt}</div>
                          <div style={{ fontSize: 10, color: "#F59E0B", fontFamily: "monospace", marginTop: 4 }}>tap to rerun</div>
                        </div>
                        <button
                          onClick={() => setSavedAutomations(prev => prev.filter(x => x.id !== a.id))}
                          style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
                        >✕</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ACTIVITY TAB */}
          {tab === "activity" && (
            <motion.div key="activity" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} style={{ height: "100%", overflowY: "auto", padding: 16 }}>
              <div style={{ fontSize: 11, color: "#8888AA", fontFamily: "monospace", letterSpacing: "2px", marginBottom: 16, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", animation: "pulse 1s infinite" }} />
                Agent Activity
              </div>
              {activities.length === 0 && (
                <div style={{ textAlign: "center", color: "#8888AA", fontSize: 12, fontFamily: "monospace", marginTop: 40 }}>— awaiting tasks —</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activities.map(a => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: "#12121C", border: "1px solid #1E1E2E", borderRadius: 12, padding: 12 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{PROVIDER_ICONS[a.provider] ?? "🤖"}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#F1F1F1", textTransform: "capitalize" }}>{a.provider.replace("_", " ")}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: a.status === "done" ? "#10B981" : a.status === "failed" ? "#EF4444" : a.status === "thinking" ? "#F59E0B" : "#8888AA",
                          animation: a.status === "thinking" ? "pulse 1s infinite" : "none",
                        }} />
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: a.status === "done" ? "#10B981" : a.status === "failed" ? "#EF4444" : a.status === "thinking" ? "#F59E0B" : "#8888AA" }}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#8888AA", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.task}</div>
                    {a.responseTime && (
                      <div style={{ fontSize: 10, color: "#8888AA", fontFamily: "monospace" }}>{a.responseTime}ms</div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div style={{ display: "flex", borderTop: "1px solid #1a1a2e", background: "#0A0A14", flexShrink: 0 }}>
        {([
          { id: "chat", icon: MessageSquare, label: "Chat" },
          { id: "projects", icon: FolderOpen, label: "Projects" },
          { id: "activity", icon: Activity, label: "Activity" },
        ] as { id: Tab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
          <motion.button
            key={id}
            whileTap={{ scale: 0.9 }}
            onClick={() => setTab(id)}
            style={{
              flex: 1, padding: "12px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: "transparent", border: "none", cursor: "pointer",
              borderTop: tab === id ? "2px solid #F59E0B" : "2px solid transparent",
            }}
          >
            <Icon size={18} color={tab === id ? "#F59E0B" : "#8888AA"} />
            <span style={{ fontSize: 10, fontFamily: "monospace", color: tab === id ? "#F59E0B" : "#8888AA", letterSpacing: "0.5px" }}>
              {label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
