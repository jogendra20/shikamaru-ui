"use client";
import { AgentActivity, AgentStatus } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

const PROVIDER_ICONS: Record<string, string> = {
  mistral: "💻",
  gemini: "✨",
  groq: "🚀",
  nvidia: "🧠",
  github_models: "🔮",
  cerebras: "⚡",
  openrouter: "🌐",
  huggingface: "🤗",
};

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "text-[var(--text-secondary)]",
  thinking: "text-[var(--accent)]",
  done: "text-[var(--green)]",
  failed: "text-[var(--red)]",
};

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: "bg-[var(--text-secondary)]",
  thinking: "bg-[var(--accent)] animate-pulse",
  done: "bg-[var(--green)]",
  failed: "bg-[var(--red)]",
};

interface Props {
  activities: AgentActivity[];
}

export default function AgentPanel({ activities }: Props) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] border-l border-[var(--border)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">
          Agent Activity
        </span>
      </div>

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {activities.length === 0 && (
            <div className="text-center text-[var(--text-secondary)] text-xs mt-8 font-mono">
              — awaiting tasks —
            </div>
          )}
          {activities.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {PROVIDER_ICONS[a.provider] ?? "🤖"}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)] capitalize">
                    {a.provider.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[a.status]}`} />
                  <span className={`text-xs font-mono ${STATUS_COLOR[a.status]}`}>
                    {a.status}
                  </span>
                </div>
              </div>

              <div className="text-xs text-[var(--text-secondary)] truncate mb-1">
                {a.task}
              </div>

              <div className="flex items-center justify-between">
                {a.responseTime && (
                  <span className="text-xs font-mono text-[var(--text-secondary)]">
                    {a.responseTime}ms
                  </span>
                )}
                {a.scoreChange !== undefined && (
                  <span className={`text-xs font-mono ${a.scoreChange >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                    {a.scoreChange >= 0 ? "+" : ""}{a.scoreChange.toFixed(2)}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Live indicator */}
      <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
        <span className="text-xs font-mono text-[var(--text-secondary)]">live</span>
      </div>
    </div>
  );
}
