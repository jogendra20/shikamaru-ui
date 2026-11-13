import { NextRequest, NextResponse } from "next/server";
import { token } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/login") return NextResponse.next();
  if (req.cookies.get("nx_auth")?.value !== await token())
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
