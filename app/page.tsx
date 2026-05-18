"use client";
import { useState, useCallback } from "react";
import { Message, AgentActivity, Difficulty, Project } from "@/types";
import ChatPanel from "@/components/ChatPanel";
import AgentPanel from "@/components/AgentPanel";
import ProjectsPanel from "@/components/ProjectsPanel";

const INITIAL_PROJECTS: Project[] = [
  { id: "onyx", name: "Onyx", repo: "jogendra20/onyx", status: "active", lastCommit: "Loading..." },
  { id: "hunter", name: "HUNTER", repo: "jogendra20/hunter", status: "active", lastCommit: "Loading..." },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const addActivity = useCallback((a: AgentActivity) => {
    setActivities(prev => [a, ...prev].slice(0, 20));
  }, []);

  const handleSend = async (prompt: string, difficulty: Difficulty) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      difficulty,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Add thinking activity
    const actId = crypto.randomUUID();
    addActivity({
      id: actId,
      provider: "nexus",
      status: "thinking",
      task: prompt.slice(0, 50),
      timestamp: Date.now(),
    });

    try {
      const isAutomation = ["scrape","automate","extract","fill form","playwright","portal"].some(k =>
        prompt.toLowerCase().includes(k)
      );

      const endpoint = isAutomation ? "deploy" : "ask";
      const start = Date.now();

      const res = await fetch("/api/nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          prompt,
          task: isAutomation ? "automation" : undefined,
          difficulty,
        }),
      });

      const data = await res.json();
      const elapsed = Date.now() - start;
      const provider = data.provider ?? "nexus";

      addActivity({
        id: crypto.randomUUID(),
        provider,
        status: data.error ? "failed" : "done",
        task: prompt.slice(0, 50),
        responseTime: elapsed,
        timestamp: Date.now(),
      });

      const content = isAutomation
        ? `✅ Automation queued

Provider: ${provider}
Difficulty: ${difficulty}

Check Telegram for output.`
        : data.response ?? data.error ?? "No response";

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        provider,
        task: data.task,
        difficulty,
        timestamp: Date.now(),
        isCode: content.includes("def ") || content.includes("import "),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      addActivity({
        id: crypto.randomUUID(),
        provider: "nexus",
        status: "failed",
        task: prompt.slice(0, 50),
        timestamp: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen grid grid-cols-[220px_1fr_240px] bg-[var(--bg-primary)]">
      <ProjectsPanel
        projects={INITIAL_PROJECTS}
        selected={selectedProject}
        onSelect={setSelectedProject}
      />
      <ChatPanel
        messages={messages}
        onSend={handleSend}
        loading={loading}
        onActivityUpdate={addActivity}
      />
      <AgentPanel activities={activities} />
    </div>
  );
}
