"use client";
import { Project } from "@/types";
import { motion } from "framer-motion";
import { GitBranch, Circle, Archive } from "lucide-react";

const STATUS_COLOR = {
  active: "text-[var(--green)]",
  idle: "text-[var(--text-secondary)]",
  error: "text-[var(--red)]",
};

interface Props {
  projects: Project[];
  selected: string | null;
  onSelect: (id: string) => void;
}

export default function ProjectsPanel({ projects, selected, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] border-r border-[var(--border)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-[var(--text-secondary)] uppercase tracking-widest">
            Projects
          </span>
        </div>
        <div className="text-[10px] text-[var(--text-secondary)] font-mono">
          SHIKAMARU watching
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {projects.map((p) => (
          <motion.div
            key={p.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(p.id)}
            className={`cursor-pointer rounded-lg p-3 border transition-all duration-200 ${
              selected === p.id
                ? "border-[var(--accent)] bg-[var(--accent-glow)] glow-amber"
                : "border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {p.name}
              </span>
              <Circle
                size={8}
                className={STATUS_COLOR[p.status]}
                fill="currentColor"
              />
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] font-mono">
              <GitBranch size={10} />
              <span className="truncate">{p.repo}</span>
            </div>
            {p.lastCommit && (
              <div className="text-[10px] text-[var(--text-secondary)] mt-1 truncate">
                {p.lastCommit}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Archive section */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Archive size={12} />
          <span className="font-mono uppercase tracking-widest text-[10px]">Archive</span>
        </div>
      </div>
    </div>
  );
}
