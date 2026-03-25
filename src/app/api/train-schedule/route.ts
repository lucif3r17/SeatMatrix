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

/**
 * Parse the `days` string from train details into an array of JS day numbers.
 *
 * The API uses a 7-character binary string where each character represents a
 * day of the week (index 0 = Sunday, index 6 = Saturday).
 * "1" = train runs, "0" = doesn't run.
 * e.g. "0111111" → runs Mon–Sat (day numbers [1,2,3,4,5,6])
 *      "1111111" → daily
 *
 * Also handles comma-separated names ("Mon,Thu,Sat") and "Daily" as fallbacks.
 */
const DAY_NAME_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function parseRunningDays(days: string): number[] {
  if (!days) return [];
  const trimmed = days.trim();

  // Binary format: "0111111" (length 7, all 0s and 1s)
  if (/^[01]{7}$/.test(trimmed)) {
    const result: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (trimmed[i] === "1") result.push(i);
    }
    return result;
  }

  // Fallback: "Daily" / "All Days"
  const lower = trimmed.toLowerCase();
  if (lower === "daily" || lower === "all days") {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  // Fallback: comma-separated names "Mon,Thu,Sat"
  return trimmed
    .split(",")
    .map((d) => DAY_NAME_MAP[d.trim()])
    .filter((n) => n !== undefined);
}

/**
 * Find the next date (from today) when the train departs from its origin.
 * Looks up to 7 days ahead.
 * Returns YYYY-MM-DD string or null.
 */
function findNextRunningDate(runningDays: number[], now: Date): string | null {
  for (let offset = 0; offset < 7; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    if (runningDays.includes(candidate.getDay())) {
      return candidate.toISOString().split("T")[0];
    }
  }
  return null;
}

interface ChartCheckResponse {
  c1?: number;
  cpt?: string;
  cpts?: string;
  cp?: string[];
}

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
    // 1. Get train details
    const details = await getTrainDetails(trainNo);
    if (!details) {
      return NextResponse.json({
        status: "error",
        message: "Train not found",
      });
    }

    const runningDays = parseRunningDays(details.days);
    if (runningDays.length === 0) {
      return NextResponse.json({
        status: "unavailable",
        trainName: details.name,
        days: details.days,
        message: "Could not determine running days for this train.",
      });
    }

    // 2. Use IST (UTC+5:30) as the reference timezone
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const nextDate = findNextRunningDate(runningDays, now);
    if (!nextDate) {
      return NextResponse.json({
        status: "unavailable",
        trainName: details.name,
        days: details.days,
        message: `Train ${trainNo} does not run in the next 7 days.`,
      });
    }

    // 3. Check chart status for the computed date
    let chartReady = false;
    let chartPrepTime: string | undefined;
    let chartMessage = "";

    try {
      const chartUrl = `${API_BASE}/chart/${trainNo}/${nextDate}`;
      const chartRes = await fetch(chartUrl, { headers: HEADERS });

      if (chartRes.ok) {
        const chartData: ChartCheckResponse = await chartRes.json();

        if (chartData.c1 && chartData.c1 > 0) {
          chartReady = true;
          chartPrepTime = chartData.cpts || chartData.cpt;
          chartMessage = `Chart prepared for ${nextDate}${chartPrepTime ? ` at ${chartPrepTime}` : ""}`;
        } else {
          chartMessage = `Chart not yet prepared for ${nextDate}. Charts are usually prepared 4-6 hours before departure.`;
        }
      } else {
        chartMessage = `Could not check chart status for ${nextDate}.`;
      }
    } catch {
      chartMessage = `Could not check chart status for ${nextDate}.`;
    }

    return NextResponse.json({
      status: chartReady ? "ready" : "not_ready",
      date: nextDate,
      chartReady,
      chartPrepTime: chartPrepTime || null,
      trainName: details.name,
      days: details.days,
      message: chartMessage,
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
