import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ test: "ok", time: new Date().toISOString() });
}

export async function GET() {
  return NextResponse.json({ test: "ok", time: new Date().toISOString() });
}