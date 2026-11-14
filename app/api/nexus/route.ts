import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const NEXUS_URL = process.env.NEXUS_URL!;
const NEXUS_KEY = process.env.NEXUS_API_KEY!;

const POST_ENDPOINTS = new Set(["orchestrate", "image", "deploy", "output", "plan", "run-task", "approve-deploy", "reject-deploy"]);
const GET_ENDPOINTS = new Set(["tasks"]);

async function forward(path: string, init: RequestInit) {
  try {
    const res = await fetch(`${NEXUS_URL}/${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-API-Key": NEXUS_KEY },
      signal: AbortSignal.timeout(55000),
    });
    const text = await res.text();
    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      return NextResponse.json({ error: "Bad response from Nexus", status: res.status }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Nexus unreachable" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const { endpoint, ...payload } = await req.json().catch(() => ({}));
  if (typeof endpoint !== "string" || !POST_ENDPOINTS.has(endpoint))
    return NextResponse.json({ error: "Endpoint not allowed" }, { status: 403 });
  return forward(endpoint, { method: "POST", body: JSON.stringify(payload) });
}

export async function GET(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get("endpoint") ?? "";
  if (!GET_ENDPOINTS.has(endpoint))
    return NextResponse.json({ error: "Endpoint not allowed" }, { status: 403 });
  return forward(endpoint, { method: "GET" });
}
