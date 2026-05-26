import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    has_secret: !!process.env.NEXUS_SECRET,
    secret_length: process.env.NEXUS_SECRET?.length ?? 0,
    has_url: !!process.env.NEXUS_URL,
  });
}
