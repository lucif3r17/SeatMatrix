import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/seatDataProvider";
import { getSegmentIndices, getAvailabilityStats, getAvailableSeats } from "@/lib/seatLogic";
import type { StationCode, DataSourceMode } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trainNo = searchParams.get("train_no");
  const date = searchParams.get("date");
  const from = searchParams.get("from") as StationCode | null;
  const to = searchParams.get("to") as StationCode | null;
  const mode = (searchParams.get("mode") || "mock") as DataSourceMode;

  if (!trainNo || !date) {
    return NextResponse.json(
      { status: "error", message: "Missing required parameters: train_no, date" },
      { status: 400 }
    );
  }

  try {
    const provider = getProvider(mode);
    const result = await provider.getSeats(trainNo, date);

    // Build station index from the result data
    const stations = result.stations;
    const fromIdx = from ? stations.findIndex((s) => s.toUpperCase() === from.toUpperCase()) : -1;
    const toIdx = to ? stations.findIndex((s) => s.toUpperCase() === to.toUpperCase()) : -1;

    // Calculate segment indices from the dynamic station list
    const segmentIndices: number[] = [];
    if (fromIdx >= 0 && toIdx > fromIdx) {
      for (let i = fromIdx; i < toIdx; i++) {
        segmentIndices.push(i);
      }
    }

    const coachStats: Record<string, {
      stats: ReturnType<typeof getAvailabilityStats>;
      seats: ReturnType<typeof getAvailableSeats>;
    }> = {};

    // Use coaches from the result data
    const availableCoaches = Object.keys(result.seatData);

    for (const coachId of availableCoaches) {
      const coachData = result.seatData[coachId];
      if (coachData && segmentIndices.length > 0) {
        coachStats[coachId] = {
          stats: getAvailabilityStats(coachData, segmentIndices),
          seats: getAvailableSeats(coachData, segmentIndices),
        };
      }
    }

    return NextResponse.json({
      status: "success",
      source: result.source,
      fetchedAt: result.fetchedAt,
      chartPrepTime: result.chartPrepTime,
      trainNo,
      trainName: result.trainName,
      date,
      from,
      to,
      stations,
      coaches: result.coaches || availableCoaches.map((id) => ({ id, name: id })),
      segmentIndices,
      seatData: result.seatData,
      coachStats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not fetch seat data. Please try again later.";
    console.error("[API /seats] Error:", message);

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 503 }
    );
  }
}
