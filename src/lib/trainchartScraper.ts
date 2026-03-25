/**
 * TrainChart.in API Scraper (v3)
 *
 * Uses the public API at api2.trainapp.in with IRCTC fallback:
 * 1. Train search:      GET /api/train/{partial}      → autocomplete
 * 2. Train details:     GET /api/train/{trainNo}       → stations, name, days
 * 3. Coach composition: GET /api/chart/{trainNo}/{date} → coach list + chart status
 * 4. Per-coach vacancy: GET /api/chart/{trainNo}/{date}/{class}:{coach} → bdd berth data
 *    Fallback:          POST irctc.co.in/online-charts/api/coachComposition → bdd berth data
 *
 * No Playwright needed — pure HTTP fetch.
 */

import type { TrainSeatData, CoachData, BerthType } from "./constants";

const API_BASE = "https://api2.trainapp.in/api";
const IRCTC_API_BASE = "https://www.irctc.co.in/online-charts/api";

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
  c1?: number;
  /** Source: "TC" = cached from IRCTC, absent = not cached */
  src?: string;
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

/** IRCTC trainComposition response */
interface IRCTCTrainCompositionResponse {
  cdd?: {
    coachName: string;
    classCode: string;
    positionFromEngine: number;
    vacantBerths: number;
  }[];
  chartStatusResponseDto?: {
    chartOneFlag: number;
    chartTwoFlag: number;
  };
  chartOneDate?: string;
  trainStartDate?: string;
  error?: string;
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
      headers: HEADERS, cache: "no-store",
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
      headers: HEADERS, cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── IRCTC Fallback helpers ───

/**
 * Fetch per-coach berth data from IRCTC's online-charts API.
 * This is the same data source trainchart.in uses as its fallback.
 */
async function fetchCoachFromIRCTC(
  trainNo: string,
  date: string,
  coachName: string,
  classCode: string,
  boardingStation: string,
  trainSourceStation: string
): Promise<CoachVacancyResponse> {
  try {
    const res = await fetch(`${IRCTC_API_BASE}/coachComposition`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "User-Agent": HEADERS["User-Agent"],
      },
      body: JSON.stringify({
        trainNo,
        jDate: date,
        coach: coachName,
        cls: classCode,
        boardingStation,
        remoteStation: boardingStation,
        trainSourceStation,
      }),
      cache: "no-store",
    });
    if (!res.ok) return { error: `IRCTC HTTP ${res.status}` };
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "IRCTC fetch failed" };
  }
}

/**
 * Fetch chart composition from IRCTC when TrainApp doesn't have src=TC.
 */
async function fetchChartFromIRCTC(
  trainNo: string,
  date: string,
  boardingStation: string
): Promise<ChartCompositionResponse | null> {
  try {
    const res = await fetch(`${IRCTC_API_BASE}/trainComposition`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "User-Agent": HEADERS["User-Agent"],
      },
      body: JSON.stringify({ trainNo, jDate: date, boardingStation }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: IRCTCTrainCompositionResponse = await res.json();
    if (data.error || !data.cdd || data.cdd.length === 0) return null;

    // Convert IRCTC format to TrainApp format
    const c1Flag = data.chartStatusResponseDto?.chartOneFlag ?? 0;
    const cp = data.cdd
      .sort((a, b) => a.positionFromEngine - b.positionFromEngine || a.classCode.localeCompare(b.classCode))
      .map((c) => `${c.classCode}:${c.coachName}`);
    const cpts = data.chartOneDate
      ? (data.chartOneDate.slice(0, 10) === data.trainStartDate ? "same day at" : "prev day at") +
        data.chartOneDate.slice(10)
      : undefined;

    return {
      cp,
      c1: c1Flag > 0 ? c1Flag : 0,
      src: "TC",
      cpt: data.chartOneDate,
      cpts,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a single coach's vacancy, trying TrainApp first, then IRCTC fallback.
 */
async function fetchCoachVacancy(
  trainNo: string,
  date: string,
  coach: { id: string; classCode: string },
  boardingStation: string,
  trainSourceStation: string
): Promise<{ coach: { id: string; classCode: string }; data: CoachVacancyResponse } | null> {
  // Try 1: TrainApp API
  try {
    const vacancyUrl = `${API_BASE}/chart/${trainNo}/${date}/${coach.classCode}:${coach.id}`;
    const res = await fetch(vacancyUrl, { headers: HEADERS, cache: "no-store" });
    if (res.ok) {
      const data: CoachVacancyResponse = await res.json();
      if (data?.bdd && data.bdd.length > 0 && !data.error) {
        console.log(`[TrainChart] Got data from TrainApp for ${coach.classCode}:${coach.id}`);
        return { coach, data };
      }
    }
  } catch {
    // Fall through to IRCTC
  }

  // Try 2: IRCTC fallback
  try {
    console.log(`[TrainChart] TrainApp empty, trying IRCTC for ${coach.classCode}:${coach.id}`);
    const irctcData = await fetchCoachFromIRCTC(
      trainNo, date, coach.id, coach.classCode, boardingStation, trainSourceStation
    );
    if (irctcData?.bdd && irctcData.bdd.length > 0 && !irctcData.error) {
      console.log(`[TrainChart] Got data from IRCTC for ${coach.classCode}:${coach.id}`);
      // Save back to TrainApp cache (fire and forget)
      try {
        fetch(`${API_BASE}/chart/${trainNo}/${date}/${coach.classCode}:${coach.id}`, {
          method: "POST",
          headers: { ...HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify(irctcData),
          cache: "no-store",
        }).catch(() => {});
      } catch {}
      return { coach, data: irctcData };
    }
  } catch {
    // Both failed
  }

  return null;
}

// ─── Main chart scraper ───

/**
 * Scrape train chart vacancy data from trainchart.in API with IRCTC fallback.
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
    // Step 1: Fetch coach composition from TrainApp
    console.log(`[TrainChart] Fetching coach list for ${trainNo} on ${date}`);
    const compUrl = `${API_BASE}/chart/${trainNo}/${date}`;
    const compRes = await fetch(compUrl, { headers: HEADERS, cache: "no-store" });

    let compData: ChartCompositionResponse;

    if (!compRes.ok) {
      if (compRes.status === 404) {
        return fail("Train not found or no chart data available for this date.");
      }
      return fail(`API error: HTTP ${compRes.status}`);
    }

    compData = await compRes.json();

    // Step 1b: Get station list from train details (need it for boarding station)
    let stations: string[] = stationList || [];
    let trainName = "";

    if (stations.length === 0) {
      const details = await getTrainDetails(trainNo);
      if (details) {
        stations = details.stns.map((s) => s.code);
        trainName = details.name;
      }
    }

    // If TrainApp doesn't have full chart data (no src=TC), try IRCTC
    if ((!compData.cp || compData.cp.length === 0 || !compData.c1) && stations.length > 0) {
      console.log(`[TrainChart] TrainApp chart incomplete (c1=${compData.c1}, src=${compData.src}), trying IRCTC...`);
      const irctcChart = await fetchChartFromIRCTC(trainNo, date, stations[0]);
      if (irctcChart && irctcChart.cp && irctcChart.cp.length > 0) {
        console.log(`[TrainChart] Got chart from IRCTC: ${irctcChart.cp.length} coaches, c1=${irctcChart.c1}`);
        // Merge: prefer IRCTC data but keep TrainApp cpts if available
        compData = {
          ...compData,
          cp: irctcChart.cp,
          c1: irctcChart.c1 ?? compData.c1,
          src: "TC",
          cpt: irctcChart.cpt ?? compData.cpt,
          cpts: irctcChart.cpts ?? compData.cpts,
        };
        // Save back to TrainApp (fire and forget)
        try {
          fetch(`${API_BASE}/chart/${trainNo}/${date}`, {
            method: "POST",
            headers: { ...HEADERS, "Content-Type": "application/json" },
            body: JSON.stringify(compData),
            cache: "no-store",
          }).catch(() => {});
        } catch {}
      }
    }

    // Validate coach composition
    if (!compData.cp || compData.cp.length === 0) {
      return fail("No coach composition data available.");
    }

    const isChartReady = (compData.c1 && compData.c1 > 0) || !!compData.cpts;

    console.log(`[TrainChart] Chart status for ${trainNo}:`, {
      c1: compData.c1,
      src: compData.src,
      ready: isChartReady,
      time: compData.cpts,
    });

    // Parse coaches from composition
    const coaches = compData.cp.map((entry) => {
      const [classCode, coachId] = entry.split(":");
      return { id: coachId, classCode };
    });
    // Filter out known non-reservable coaches (luggage, guard, pantry, etc.)
    const NON_RESERVABLE = new Set(["GEN", "SLR", "EOG", "RMS", "PC", "LSLRD"]);
    const reservableCoaches = coaches.filter((c) => !NON_RESERVABLE.has(c.classCode.toUpperCase()));

    if (stations.length < 2) {
      return fail("Could not retrieve station list for this train.");
    }

    // Determine boarding and source stations for IRCTC fallback
    const boardingStation = stations[0];
    const trainSourceStation = stations[0];

    // Step 3: Fetch vacancy for each coach (TrainApp → IRCTC fallback)
    const seatData: TrainSeatData = {};
    let successCount = 0;

    // Fetch coaches in parallel batches of 3
    const batchSize = 3;
    for (let i = 0; i < reservableCoaches.length; i += batchSize) {
      const batch = reservableCoaches.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((coach) =>
          fetchCoachVacancy(trainNo, date, coach, boardingStation, trainSourceStation)
        )
      );

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) {
          continue;
        }
        const { coach, data } = result.value;

        if (!data || data.error || !data.bdd || data.bdd.length === 0) {
          continue;
        }

        if (!trainName && data.coachName) {
          trainName = trainNo;
        }

        const coachData = parseCoachBerthData(data.bdd, stations);
        console.log(`[TrainChart] Parsed ${coach.classCode}:${coach.id}: ${Object.keys(coachData).length} seats`);

        seatData[coach.id] = coachData;
        successCount++;
      }

      // Delay between batches to avoid rate limiting
      if (i + batchSize < reservableCoaches.length) {
        await delay(300);
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
        error: isChartReady
          ? "Chart is prepared but seat data could not be fetched. Try again in a moment."
          : `Chart not fully prepared yet. ${compData.cpts || ""}`,
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
          let fromCode = split.from.toUpperCase();
          let toCode = split.to.toUpperCase();
          
          let fromIdx = stationIndex.get(fromCode);
          let toIdx = stationIndex.get(toCode);

          if (fromIdx === undefined || toIdx === undefined) {
            if (berth.from && berth.to) {
              fromCode = berth.from.toUpperCase();
              toCode = berth.to.toUpperCase();
              fromIdx = stationIndex.get(fromCode);
              toIdx = stationIndex.get(toCode);
            }
          }

          if (fromIdx !== undefined && toIdx !== undefined && fromIdx < toIdx) {
            for (let seg = fromIdx; seg < toIdx && seg < numSegments; seg++) {
              segments[seg] = 0;
            }
          } else {
            markOccupiedFuzzy(segments, fromCode, toCode, stations, stationIndex, numSegments);
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
 * match the train's station list.
 */
function markOccupiedFuzzy(
  segments: number[],
  splitFrom: string,
  splitTo: string,
  stations: string[],
  stationIndex: Map<string, number>,
  numSegments: number
): void {
  const fromUpper = splitFrom.toUpperCase();
  const toUpper = splitTo.toUpperCase();

  let fromIdx = stationIndex.get(fromUpper);
  let toIdx = stationIndex.get(toUpper);

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
