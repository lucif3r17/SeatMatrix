/**
 * TrainChart.in API Scraper (v2)
 *
 * Uses the public API at api2.trainapp.in:
 * 1. Train search:      GET /api/train/{partial}      → autocomplete
 * 2. Train details:     GET /api/train/{trainNo}       → stations, name, days
 * 3. Coach composition: GET /api/chart/{trainNo}/{date} → coach list + chart status
 * 4. Per-coach vacancy: GET /api/chart/{trainNo}/{date}/{class}:{coach} → bdd berth data
 *
 * No Playwright needed — pure HTTP fetch.
 */

import type { TrainSeatData, CoachData, BerthType } from "./constants";

const API_BASE = "https://api2.trainapp.in/api";

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://trainchart.in/",
  Origin: "https://trainchart.in",
};

// ─── API response types ───

/** Train search result entry */
export interface TrainSearchEntry {
  /** e.g. "11046 - DIKSHABHUMI EXP" */
  t: string;
}

/** Train detail station */
export interface TrainStation {
  code: string;
  name: string;
  pf?: string;
  day?: number;
  arr?: string;
  dep?: string;
  halt?: number;
  km?: number;
}

/** Train details response */
export interface TrainDetailsResponse {
  number: string;
  name: string;
  days: string;
  from: string;
  to: string;
  start: string;
  stns: TrainStation[];
}

/** Coach composition response */
interface ChartCompositionResponse {
  /** Coach position array, e.g. ["3A:B1", "2A:A1", "SL:S1", ...] */
  cp: string[];
  /** Chart status: 0 = not prepared, 1+ = prepared */
  c1: number;
  /** Chart preparation time string */
  cpt?: string;
  /** Human-readable chart prep time */
  cpts?: string;
  /** Date */
  date?: string;
}

/** Booking split data — one segment of a berth's journey */
interface BerthSplitData {
  splitNo: number;
  from: string;
  to: string;
  quota: string;
  /** true = occupied, false = vacant */
  occupancy: boolean;
}

/** Single berth data from the vacancy API */
interface BerthDatum {
  cabinCoupe: string | null;
  cabinCoupeNameNo: string;
  /** Berth code: L, U, M, R (side lower), P (side upper) */
  berthCode: string;
  /** Seat number */
  berthNo: number;
  /** Overall boarding station */
  from: string;
  /** Overall destination station */
  to: string;
  /** Booking split details — occupancy per segment */
  bsd: BerthSplitData[];
  quotaCntStn: string | null;
  enable: boolean;
}

/** Per-coach vacancy response */
interface CoachVacancyResponse {
  bdd?: BerthDatum[];
  coachName?: string;
  error?: string | null;
}

// ─── Result types ───

export interface TrainchartResult {
  success: boolean;
  seatData: TrainSeatData;
  stations: string[];
  trainName: string;
  coaches: { id: string; classCode: string }[];
  chartPrepTime?: string;
  error?: string;
}

// ─── Berth helpers ───

const BERTH_CODE_MAP: Record<string, BerthType> = {
  L: "LB",
  M: "MB",
  U: "UB",
  R: "SL", // R = Side Lower (RAC side)
  P: "SU", // P = Side Upper
  // CC/EC/2S chair car codes — map to LB as "seat"
  W: "LB", // Window seat
  A: "LB", // Aisle seat
  D: "LB", // Table-facing / Door side
  T: "LB", // Table seat
  F: "LB", // Forward-facing
  N: "LB", // Normal seat
};

const BERTH_PATTERN: BerthType[] = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"];

function mapBerthCode(code: string): BerthType {
  return BERTH_CODE_MAP[code.toUpperCase()] || "LB";
}

function guessBerthFromSeat(seatNum: number): BerthType {
  return BERTH_PATTERN[(seatNum - 1) % 8];
}

// ─── Delay utility ───

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Train search ───

/**
 * Search trains by partial number/name.
 * Returns parsed list of { number, name }.
 */
export async function searchTrains(
  query: string
): Promise<{ number: string; name: string }[]> {
  try {
    const res = await fetch(`${API_BASE}/train/${encodeURIComponent(query)}`, {
      headers: HEADERS,
    });
    if (!res.ok) return [];

    const data = await res.json();

    // When query is a full train number, API returns a single train details
    // object (with `number`, `name` fields) instead of a search result array.
    if (!Array.isArray(data)) {
      if (data && data.number && data.name) {
        return [{ number: String(data.number), name: String(data.name) }];
      }
      return [];
    }

    return (data as TrainSearchEntry[]).map((entry) => {
      const parts = entry.t.split(" - ");
      return {
        number: parts[0]?.trim() || "",
        name: parts.slice(1).join(" - ").trim() || "",
      };
    });
  } catch {
    return [];
  }
}

// ─── Train details ───

/**
 * Get full train details including station list.
 */
export async function getTrainDetails(
  trainNo: string
): Promise<TrainDetailsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/train/${encodeURIComponent(trainNo)}`, {
      headers: HEADERS,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Main chart scraper ───

/**
 * Scrape train chart vacancy data from trainchart.in API.
 *
 * @param trainNo Train number (e.g. "11046")
 * @param date    Date in YYYY-MM-DD format
 * @param stationList Optional pre-fetched station codes for the train route
 */
export async function scrapeTrainchart(
  trainNo: string,
  date: string,
  stationList?: string[]
): Promise<TrainchartResult> {
  try {
    // Step 1: Fetch coach composition
    console.log(`[TrainChart] Fetching coach list for ${trainNo} on ${date}`);
    const compUrl = `${API_BASE}/chart/${trainNo}/${date}`;
    const compRes = await fetch(compUrl, { headers: HEADERS });

    if (!compRes.ok) {
      if (compRes.status === 404) {
        return fail("Train not found or no chart data available for this date.");
      }
      return fail(`API error: HTTP ${compRes.status}`);
    }

    const compData: ChartCompositionResponse = await compRes.json();

    if (!compData.cp || compData.cp.length === 0) {
      return fail("No coach composition data available.");
    }

    // Check if chart is prepared (c1 > 0 means prepared; absent or 0 means not)
    if (!compData.c1 || compData.c1 <= 0) {
      return fail(
        `Chart not prepared yet. ${compData.cpts || "Charts are usually prepared 4-6 hours before departure."}`,
        compData.cpts
      );
    }

    // Parse coaches from composition
    const coaches = compData.cp.map((entry) => {
      const [classCode, coachId] = entry.split(":");
      return { id: coachId, classCode };
    });

    // Filter out known non-reservable coaches (luggage, guard, pantry, etc.)
    // Everything else gets tried — the API will just return "No seat data" for invalid ones
    const NON_RESERVABLE = new Set(["GEN", "SLR", "EOG", "RMS", "PC", "LSLRD"]);
    const reservableCoaches = coaches.filter((c) => !NON_RESERVABLE.has(c.classCode.toUpperCase()));

    // Step 2: Get station list from train details if not provided
    let stations: string[] = stationList || [];
    let trainName = "";

    if (stations.length === 0) {
      const details = await getTrainDetails(trainNo);
      if (details) {
        stations = details.stns.map((s) => s.code);
        trainName = details.name;
      }
    }

    if (stations.length < 2) {
      return fail("Could not retrieve station list for this train.");
    }

    // Step 3: Fetch vacancy for each coach
    const seatData: TrainSeatData = {};
    let successCount = 0;
    const failedCoaches: typeof reservableCoaches = [];

    // Fetch coaches in parallel batches of 3 (smaller to avoid rate limits)
    const batchSize = 3;
    for (let i = 0; i < reservableCoaches.length; i += batchSize) {
      const batch = reservableCoaches.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (coach) => {
          const vacancyUrl = `${API_BASE}/chart/${trainNo}/${date}/${coach.classCode}:${coach.id}`;
          console.log(`[TrainChart] Fetching vacancy: ${coach.classCode}:${coach.id}`);

          const res = await fetch(vacancyUrl, { headers: HEADERS });
          if (!res.ok) return null;

          const data: CoachVacancyResponse = await res.json();
          return { coach, data };
        })
      );

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) {
          // Track coach that failed for retry
          const idx = results.indexOf(result);
          if (batch[idx]) failedCoaches.push(batch[idx]);
          continue;
        }
        const { coach, data } = result.value;

        if (!data || data.error || !data.bdd || data.bdd.length === 0) {
          console.log(`[TrainChart] No data for ${coach.classCode}:${coach.id}: ${data?.error || "empty"}`);
          failedCoaches.push(coach);
          continue;
        }

        // Extract train name from coach name if not set
        if (!trainName && data.coachName) {
          trainName = trainNo; // fallback
        }

        // Parse berth data into segment-based seat data
        const coachData = parseCoachBerthData(data.bdd, stations);
        if (Object.keys(coachData).length > 0) {
          seatData[coach.id] = coachData;
          successCount++;
        }
      }

      // Longer delay between batches to avoid rate limiting
      if (i + batchSize < reservableCoaches.length) {
        await delay(500);
      }
    }

    // Retry failed coaches individually with longer delays
    if (failedCoaches.length > 0 && successCount > 0) {
      console.log(`[TrainChart] Retrying ${failedCoaches.length} failed coaches...`);
      for (const coach of failedCoaches) {
        try {
          await delay(300);
          const vacancyUrl = `${API_BASE}/chart/${trainNo}/${date}/${coach.classCode}:${coach.id}`;
          const res = await fetch(vacancyUrl, { headers: HEADERS });
          if (!res.ok) continue;

          const data: CoachVacancyResponse = await res.json();
          if (!data || data.error || !data.bdd || data.bdd.length === 0) continue;

          const coachData = parseCoachBerthData(data.bdd, stations);
          if (Object.keys(coachData).length > 0) {
            seatData[coach.id] = coachData;
            successCount++;
          }
        } catch {
          // Skip silently on retry
        }
      }
    }

    if (successCount === 0) {
      return {
        success: false,
        seatData: {},
        stations,
        trainName: trainName || trainNo,
        coaches: reservableCoaches,
        chartPrepTime: compData.cpts,
        error: `Could not fetch seat vacancy data for any coach (0/${reservableCoaches.length} coaches responded). The chart may not be fully available yet — try again in a few minutes.`,
      };
    }

    return {
      success: true,
      seatData,
      stations,
      trainName: trainName || trainNo,
      coaches: reservableCoaches,
      chartPrepTime: compData.cpts,
    };
  } catch (err) {
    console.error("[TrainChart] Error:", err);
    return fail(err instanceof Error ? err.message : "Failed to fetch train chart data.");
  }
}

// ─── Core parser: bdd → CoachData ───

/**
 * Parse the bdd (berth data) array into segment-based CoachData.
 *
 * Each berth has a `bsd` array of booking splits. Each split has a
 * `from`/`to` station pair and an `occupancy` boolean.
 *
 * We map these splits onto the train's station list to determine
 * which segments each berth is occupied on.
 */
function parseCoachBerthData(berthData: BerthDatum[], stations: string[]): CoachData {
  const numSegments = stations.length - 1;

  // Build station index map (uppercase for matching)
  const stationIndex = new Map<string, number>();
  stations.forEach((s, i) => stationIndex.set(s.toUpperCase(), i));

  const coachData: CoachData = {};

  for (const berth of berthData) {
    const seatKey = String(berth.berthNo);
    const berthType = mapBerthCode(berth.berthCode) || guessBerthFromSeat(berth.berthNo);

    // Initialize all segments as free (1)
    const segments = Array(numSegments).fill(1) as number[];

    // Process each booking split
    if (berth.bsd && berth.bsd.length > 0) {
      for (const split of berth.bsd) {
        if (split.occupancy) {
          // Mark the segments covered by this split as occupied (0)
          const fromIdx = stationIndex.get(split.from.toUpperCase());
          const toIdx = stationIndex.get(split.to.toUpperCase());

          if (fromIdx !== undefined && toIdx !== undefined && fromIdx < toIdx) {
            for (let seg = fromIdx; seg < toIdx && seg < numSegments; seg++) {
              segments[seg] = 0;
            }
          } else {
            // Station not in main route — try to find bounding stations
            // This handles intermediate stations not in the stop list
            markOccupiedFuzzy(segments, split.from, split.to, stations, stationIndex, numSegments);
          }
        }
      }
    }

    coachData[seatKey] = {
      berth: berthType,
      segments,
    };
  }

  return coachData;
}

/**
 * Fuzzy occupancy marking for when split station codes don't exactly
 * match the train's station list (e.g. intermediate halts not in stns).
 *
 * Falls back to marking between the berth's overall from/to.
 */
function markOccupiedFuzzy(
  segments: number[],
  splitFrom: string,
  splitTo: string,
  stations: string[],
  stationIndex: Map<string, number>,
  numSegments: number
): void {
  // Try to find the closest matching stations in the route
  const fromUpper = splitFrom.toUpperCase();
  const toUpper = splitTo.toUpperCase();

  // Find the station at or just before the split from
  let fromIdx = stationIndex.get(fromUpper);
  let toIdx = stationIndex.get(toUpper);

  // If exact match not found, try partial matching
  if (fromIdx === undefined) {
    for (let i = 0; i < stations.length; i++) {
      if (stations[i].toUpperCase().startsWith(fromUpper) || fromUpper.startsWith(stations[i].toUpperCase())) {
        fromIdx = i;
        break;
      }
    }
  }

  if (toIdx === undefined) {
    for (let i = stations.length - 1; i >= 0; i--) {
      if (stations[i].toUpperCase().startsWith(toUpper) || toUpper.startsWith(stations[i].toUpperCase())) {
        toIdx = i;
        break;
      }
    }
  }

  if (fromIdx !== undefined && toIdx !== undefined && fromIdx < toIdx) {
    for (let seg = fromIdx; seg < toIdx && seg < numSegments; seg++) {
      segments[seg] = 0;
    }
  }
}

// ─── Helpers ───

function fail(error: string, chartPrepTime?: string): TrainchartResult {
  return {
    success: false,
    seatData: {},
    stations: [],
    trainName: "",
    coaches: [],
    chartPrepTime,
    error,
  };
}
