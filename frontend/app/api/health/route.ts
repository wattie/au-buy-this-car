import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "Should I Buy This Car API",
    status: "ok"
  });
}
