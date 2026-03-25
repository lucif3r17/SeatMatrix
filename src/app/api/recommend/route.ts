import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/seatDataProvider";
import { generateRecommendations } from "@/lib/recommendationEngine";
import type { Preferences, DataSourceMode } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trainNo, date, from, to, preferences, mode } = body as {
      trainNo: string;
      date: string;
      from: string;
      to: string;
      preferences?: Partial<Preferences>;
      mode?: DataSourceMode;
    };

    if (!trainNo || !date || !from || !to) {
      return NextResponse.json(
        { status: "error", message: "Missing required parameters: trainNo, date, from, to" },
        { status: 400 }
      );
    }

    const provider = getProvider(mode || "mock");
    const result = await provider.getSeats(trainNo, date);

    const prefs: Preferences = {
      lowerBerthOnly: preferences?.lowerBerthOnly ?? false,
      sameCoachOnly: preferences?.sameCoachOnly ?? false,
      groupSize: preferences?.groupSize ?? 1,
    };

    const recommendations = generateRecommendations(
      result.seatData,
      from,
      to,
      result.stations,
      prefs
    );

    return NextResponse.json({
      status: "success",
      trainNo,
      date,
      from,
      to,
      preferences: prefs,
      recommendations,
      totalPlans: recommendations.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate recommendations. Please try again later.";
    console.error("[API /recommend] Error:", message);

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 503 }
    );
  }
}
