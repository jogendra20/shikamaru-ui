"use client";
import { Message, Difficulty, AgentActivity } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Zap } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import DifficultyBadge from "./DifficultyBadge";

const PROVIDER_ICONS: Record<string, string> = {
  mistral: "💻", gemini: "✨", groq: "🚀", nvidia: "🧠",
  github_models: "🔮", cerebras: "⚡", openrouter: "🌐", huggingface: "🤗",
};

interface Props {
  messages: Message[];
  onSend: (prompt: string, difficulty: Difficulty) => void;
  loading: boolean;
  onActivityUpdate: (a: AgentActivity) => void;
}

function detectDifficulty(prompt: string): Difficulty {
  const p = prompt.toLowerCase();
  const hard = ["architecture","analyze","compare","deep","comprehensive","strategy","build full","implement"];
  const medium = ["scrape","automate","extract","fill form","portal","multiple","fetch all"];
  if (hard.some(k => p.includes(k))) return "hard";
  if (medium.some(k => p.includes(k))) return "medium";
  return "easy";
}

export default function ChatPanel({ messages, onSend, loading, onActivityUpdate }: Props) {
  const [input, setInput] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [detected, setDetected] = useState<Difficulty>("easy");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (input.trim()) {
      const d = detectDifficulty(input);
      setDetected(d);
      setDifficulty(d);
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input.trim(), difficulty);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="px-6 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">NEXUS</span>
          <span className="text-xs text-[var(--text-secondary)] ml-2 font-mono">/ shikamaru</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
          <span className="text-xs font-mono text-[var(--text-secondary)]">online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-3 text-center"
            >
              <div className="text-4xl">🎯</div>
              <div className="text-[var(--text-secondary)] text-sm font-mono">
                What needs to be done?
              </div>
            </motion.div>
          )}
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                {m.role === "assistant" && m.provider && (
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-xs">{PROVIDER_ICONS[m.provider] ?? "🤖"}</span>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)] capitalize">
                      {m.provider.replace("_", " ")}
                    </span>
                    {m.difficulty && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        m.difficulty === "hard"
                          ? "text-[var(--accent)] border-[var(--border-accent)] bg-[var(--accent-glow)]"
                          : m.difficulty === "medium"
                          ? "text-[var(--blue)] border-[#3B82F644] bg-[#3B82F622]"
                          : "text-[var(--green)] border-[#10B98144] bg-[#10B98122]"
                      }`}>
                        {m.difficulty}
                      </span>
                    )}
                  </div>
                )}
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[var(--accent)] text-black font-medium"
                    : "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)]"
                }`}>
                  {m.isCode ? (
                    <pre className="font-mono text-xs overflow-x-auto whitespace-pre-wrap">{m.content}</pre>
                  ) : (
                    m.content
                  )}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] font-mono px-1">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-2">
                <Zap size={12} className="text-[var(--accent)] animate-pulse" />
                <span className="text-xs font-mono text-[var(--text-secondary)]">routing to best agent...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="px-6 py-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 mb-2">
          <DifficultyBadge value={difficulty} onChange={setDifficulty} detected={detected} />
        </div>
        <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 focus-within:border-[var(--accent)] transition-colors">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask Nexus anything..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="text-[var(--accent)] disabled:text-[var(--text-secondary)] transition-colors"
          >
            <Send size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
