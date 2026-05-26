import { NextRequest, NextResponse } from "next/server";

const NEXUS_URL = process.env.NEXUS_URL ?? "https://nexus-56tm.onrender.com";
const NEXUS_KEY = process.env.NEXUS_SECRET ?? "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate on frontend side too
    if (!body.type || !body.query) {
      return NextResponse.json(
        { error: "Both type and query are required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${NEXUS_URL}/osint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": NEXUS_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "OSINT request failed" },
      { status: 500 }
    );
  }
}
