export type Difficulty = "easy" | "medium" | "hard";

export type AgentStatus = "idle" | "thinking" | "done" | "failed";

export interface AgentActivity {
  id: string;
  provider: string;
  status: AgentStatus;
  task: string;
  responseTime?: number;
  scoreChange?: number;
  timestamp: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  task?: string;
  difficulty?: Difficulty;
  timestamp: number;
  isCode?: boolean;
}

export interface Project {
  id: string;
  name: string;
  repo: string;
  status: "active" | "idle" | "error";
  lastCommit?: string;
  lastAnalyzed?: string;
}

export interface DeployResult {
  status: string;
  message: string;
  file?: string;
  provider?: string;
  triggered?: boolean;
}
