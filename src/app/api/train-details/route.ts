import { NextRequest, NextResponse } from "next/server";
import { getTrainDetails } from "@/lib/trainchartScraper";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trainNo = searchParams.get("train_no");

  if (!trainNo) {
    return NextResponse.json(
      { error: "Missing required parameter: train_no" },
      { status: 400 }
    );
  }

  const details = await getTrainDetails(trainNo);

  if (!details) {
    return NextResponse.json(
      { error: "Train not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    number: details.number,
    name: details.name,
    from: details.from,
    to: details.to,
    days: details.days,
    stations: details.stns.map((s) => ({
      code: s.code,
      name: s.name,
    })),
  });
}
