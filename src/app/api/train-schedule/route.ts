import { NextRequest, NextResponse } from "next/server";
import { getTrainDetails } from "@/lib/trainchartScraper";

const API_BASE = "https://api2.trainapp.in/api";
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://trainchart.in/",
  Origin: "https://trainchart.in",
};

interface ChartCheckResponse {
  c1?: number;
  cpt?: string;
  cpts?: string;
  cp?: string[];
}

interface AvailableDate {
  date: string;
  chartPrepTime?: string;
}

/**
 * Simple schedule checker:
 * 1. Check chart API for today and the next 4 days
 * 2. Return ALL dates that have charts prepared (c1 > 0)
 * 3. Auto-select the first available one
 * 4. No departure-time guessing — just trust the API
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trainNo = searchParams.get("train_no");

  if (!trainNo) {
    return NextResponse.json(
      { status: "error", message: "Missing required parameter: train_no" },
      { status: 400 }
    );
  }

  try {
    // Get train name
    const details = await getTrainDetails(trainNo);
    const trainName = details?.name || trainNo;

    // Check chart status for today + next 4 days (5 total)
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const datesToCheck: string[] = [];
    for (let offset = 0; offset < 5; offset++) {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      datesToCheck.push(d.toISOString().split("T")[0]);
    }

    const availableDates: AvailableDate[] = [];
    const unavailableDates: string[] = [];

    // Check all dates in parallel
    const results = await Promise.allSettled(
      datesToCheck.map(async (date) => {
        try {
          const res = await fetch(`${API_BASE}/chart/${trainNo}/${date}`, {
            headers: HEADERS,
          });
          if (!res.ok) return { date, ready: false };

          const data: ChartCheckResponse = await res.json();
          return {
            date,
            ready: !!(data.c1 && data.c1 > 0),
            chartPrepTime: data.cpts || data.cpt,
          };
        } catch {
          return { date, ready: false };
        }
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { date, ready, chartPrepTime } = result.value;

      if (ready) {
        availableDates.push({ date, chartPrepTime });
      } else {
        unavailableDates.push(date);
      }
    }

    if (availableDates.length === 0) {
      return NextResponse.json({
        status: "not_ready",
        trainName,
        availableDates: [],
        message: "Chart not prepared for any upcoming date. Charts are usually prepared 4-6 hours before departure.",
      });
    }

    // Auto-select the first (most recent) available date
    const selected = availableDates[0];

    return NextResponse.json({
      status: "ready",
      date: selected.date,
      chartReady: true,
      chartPrepTime: selected.chartPrepTime || null,
      trainName,
      availableDates,
      message: `Chart prepared for ${selected.date}${selected.chartPrepTime ? ` (${selected.chartPrepTime})` : ""}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to check train schedule.";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
