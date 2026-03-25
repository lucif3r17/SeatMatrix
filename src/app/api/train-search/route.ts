import { NextRequest, NextResponse } from "next/server";
import { searchTrains } from "@/lib/trainchartScraper";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const results = await searchTrains(q);
  return NextResponse.json(results);
}
