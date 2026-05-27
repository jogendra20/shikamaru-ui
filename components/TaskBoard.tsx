"use client";
import { useState, useEffect } from "react";

const NEXUS_URL = process.env.NEXT_PUBLIC_NEXUS_URL ?? "";
const NEXUS_KEY = process.env.NEXT_PUBLIC_NEXUS_API_KEY ?? "";

const T = {
  bg:      "#0A0A0F",
  surface: "#12121A",
  border:  "#1E1E2E",
  purple:  "#C084FC",
  pink:    "#F472B6",
  green:   "#34D399",
  orange:  "#FB923C",
  muted:   "#64748B",
  text:    "#F1F5F9",
};

interface Step {
  name: string;
  type: string;
  prompt: string;
  depends_on: number;
}

interface Task {
  id: string;
  goal: string;
  steps: Step[];
  schedule: string;
  status: string;
  last_run: string | null;
  created_at: string;
}

function statusColor(s: string) {
  if (s === "active") return T.green;
  if (s === "paused") return T.orange;
  return T.muted;
}

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any[]>>({});
  const [debugInfo, setDebugInfo] = useState<string>("");

  async function fetchTasks() {
    setLoading(true);
    setDebugInfo(`URL: ${NEXUS_URL} | KEY: ${NEXUS_KEY ? NEXUS_KEY.slice(0,6)+"..." : "MISSING"}`);
    try {
      const res = await fetch(`${NEXUS_URL}/tasks`, {
        headers: { "X-API-Key": NEXUS_KEY }
      });
      const text = await res.text();
      setDebugInfo(`Status: ${res.status} | Body: ${text.slice(0,100)}`);
      const data = JSON.parse(text);
      setTasks(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setDebugInfo(`Error: ${e.message}`);
    }
    setLoading(false);
  }

  async function runTask(taskId: string) {
    setRunning(taskId);
    try {
      const res = await fetch(`${NEXUS_URL}/run-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": NEXUS_KEY },
        body: JSON.stringify({ task_id: taskId })
      });
      const data = await res.json();
      setResults(prev => ({ ...prev, [taskId]: data.results ?? [] }));
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
    setRunning(null);
  }

  useEffect(() => { fetchTasks(); }, []);

  if (loading) return (
    <div style={{ color: T.muted, fontSize: 10, fontFamily: "monospace", padding: 8 }}>{debugInfo || "Loading..."}</div>
  );

  const _loading = false; if (_loading) return (
    <div style={{ color: T.muted, fontSize: 11, textAlign: "center", marginTop: 40 }}>
      Loading tasks...
    </div>
  );

  if (tasks.length === 0) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ color: T.muted, fontSize: 10, fontFamily: "monospace", padding: 8, background: T.surface, borderRadius: 6 }}>{debugInfo}</div>
      <div style={{ color: T.muted, fontSize: 11, textAlign: "center", marginTop: 20 }}>No active tasks. Use /plan to create one.</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: "2px" }}>SCHEDULED TASKS</div>
        <button onClick={fetchTasks} style={{
          background: "transparent", border: "none",
          color: T.purple, fontSize: 10, cursor: "pointer"
        }}>↻ refresh</button>
      </div>

      {tasks.map(task => (
        <div key={task.id} style={{
          background: T.surface,
          border: `1px solid ${expanded === task.id ? T.purple + "60" : T.border}`,
          borderRadius: 10, padding: "12px 14px"
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: statusColor(task.status), flexShrink: 0
            }} />
            <div style={{ flex: 1, fontSize: 12, color: T.text, fontWeight: 600 }}>
              {task.goal}
            </div>
            <button onClick={() => setExpanded(expanded === task.id ? null : task.id)}
              style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>
              {expanded === task.id ? "▲" : "▼"}
            </button>
          </div>

          {/* Meta */}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 9, color: T.purple }}>⏱ {task.schedule}</span>
            <span style={{ fontSize: 9, color: T.muted }}>{task.steps.length} steps</span>
            <span style={{ fontSize: 9, color: T.muted }}>last run: {timeAgo(task.last_run)}</span>
          </div>

          {/* Expanded steps */}
          {expanded === task.id && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {task.steps.map((step, i) => {
                const stepResult = results[task.id]?.[i];
                const stepStatus = stepResult?.status;
                const color = stepStatus === "done" ? T.green
                  : stepStatus === "failed" ? T.pink
                  : stepStatus === "blocked" ? T.orange
                  : T.muted;
                return (
                  <div key={i} style={{
                    background: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: 6, padding: "8px 10px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9, color: T.purple, fontFamily: "monospace" }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 11, color: T.text }}>{step.name}</span>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3,
                        background: T.surface, color: T.muted, marginLeft: "auto" }}>
                        {step.type}
                      </span>
                      {stepStatus && (
                        <span style={{ fontSize: 9, color: color }}>● {stepStatus}</span>
                      )}
                    </div>
                    {stepResult?.output && (
                      <div style={{ fontSize: 10, color: T.muted, marginTop: 4,
                        fontFamily: "monospace", whiteSpace: "pre-wrap",
                        maxHeight: 60, overflow: "hidden" }}>
                        {stepResult.output.slice(0, 150)}...
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Run button */}
              <button onClick={() => runTask(task.id)} disabled={running === task.id}
                style={{
                  marginTop: 4, padding: "8px", borderRadius: 6,
                  background: running === task.id ? T.surface : T.purple + "20",
                  border: `1px solid ${T.purple}40`,
                  color: running === task.id ? T.muted : T.purple,
                  fontSize: 11, fontWeight: 600, cursor: running === task.id ? "not-allowed" : "pointer"
                }}>
                {running === task.id ? "Running..." : "▶ Run Now"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
