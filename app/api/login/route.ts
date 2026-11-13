import { NextRequest, NextResponse } from "next/server";
import { token } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const ok = req.cookies.get("nx_auth")?.value === await token();
  return NextResponse.json({ ok }, { status: ok ? 200 : 401 });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!process.env.NEXUS_PASSWORD || password !== process.env.NEXUS_PASSWORD)
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("nx_auth", await token(), {
    httpOnly: true, secure: true, sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  return res;
}
