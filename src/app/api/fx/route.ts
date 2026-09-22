import { NextResponse } from "next/server";
import { getRates } from "@/lib/fx";

export async function GET() {
  return NextResponse.json({ base: "USD", rates: await getRates() }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
