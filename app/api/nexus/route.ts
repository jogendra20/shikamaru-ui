import { NextRequest, NextResponse } from "next/server";

const NEXUS_URL = process.env.NEXUS_URL!;
const NEXUS_KEY = process.env.NEXUS_API_KEY!;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { endpoint, ...payload } = body;

  try {
    const res = await fetch(`${NEXUS_URL}/${endpoint === "delete-script" ? "delete-script" : endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": NEXUS_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Nexus unreachable" }, { status: 503 });
  }
}
