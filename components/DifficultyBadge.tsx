"use client";
import { Difficulty } from "@/types";
import { motion } from "framer-motion";

const CONFIG = {
  easy: { label: "Easy", color: "text-[var(--green)]", bg: "bg-[#10B98122]", border: "border-[#10B98144]" },
  medium: { label: "Medium", color: "text-[var(--blue)]", bg: "bg-[#3B82F622]", border: "border-[#3B82F644]" },
  hard: { label: "Hard", color: "text-[var(--accent)]", bg: "bg-[var(--accent-glow)]", border: "border-[var(--border-accent)]" },
};

interface Props {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  detected?: Difficulty;
}

export default function DifficultyBadge({ value, onChange, detected }: Props) {
  const cfg = CONFIG[value];

  return (
    <div className="flex items-center gap-1">
      {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
        <motion.button
          key={d}
          whileTap={{ scale: 0.9 }}
          onClick={() => onChange(d)}
          className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
            value === d
              ? `${CONFIG[d].color} ${CONFIG[d].bg} ${CONFIG[d].border}`
              : "text-[var(--text-secondary)] border-[var(--border)] bg-transparent"
          }`}
        >
          {d}
          {detected === d && value !== d && (
            <span className="ml-1 text-[var(--accent)]">●</span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
