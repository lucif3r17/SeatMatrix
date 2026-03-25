import {
  STATIONS,
  type StationCode,
  type SeatData,
  type CoachData,
  type AvailabilityStatus,
  type AvailabilityStats,
} from "./constants";

/**
 * Get the segment indices for a journey from station A to station B.
 * Uses hardcoded STATIONS list as default, or dynamic station list if provided.
 */
export function getSegmentIndices(from: string, to: string, stationList?: string[]): number[] {
  const stations = stationList || (STATIONS as unknown as string[]);
  const fromIdx = stations.findIndex((s) => s.toUpperCase() === from.toUpperCase());
  const toIdx = stations.findIndex((s) => s.toUpperCase() === to.toUpperCase());

  if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) {
    return [];
  }

  const indices: number[] = [];
  for (let i = fromIdx; i < toIdx; i++) {
    indices.push(i);
  }
  return indices;
}

/**
 * Classify a seat based on segment availability for the user's journey.
 */
export function classifySeat(seat: SeatData, segmentIndices: number[]): AvailabilityStatus {
  if (segmentIndices.length === 0) return "unavailable";

  const relevantSegments = segmentIndices.map((i) => seat.segments[i]);
  const freeCount = relevantSegments.filter((s) => s === 1).length;

  if (freeCount === relevantSegments.length) return "available";
  if (freeCount === 0) return "unavailable";
  return "partial";
}

/**
 * Get availability breakdown for each segment of a seat.
 * Uses dynamic station list if provided.
 */
export function getSeatSegmentBreakdown(
  seat: SeatData,
  segmentIndices: number[],
  stationList?: string[]
): { from: string; to: string; free: boolean }[] {
  const stations = stationList || (STATIONS as unknown as string[]);
  return segmentIndices.map((i) => ({
    from: stations[i] || `Stn ${i}`,
    to: stations[i + 1] || `Stn ${i + 1}`,
    free: seat.segments[i] === 1,
  }));
}

/**
 * Get availability stats for a coach.
 */
export function getAvailabilityStats(
  coachData: CoachData,
  segmentIndices: number[]
): AvailabilityStats {
  let available = 0;
  let partial = 0;
  let unavailable = 0;

  for (const seatNum of Object.keys(coachData)) {
    const status = classifySeat(coachData[seatNum], segmentIndices);
    if (status === "available") available++;
    else if (status === "partial") partial++;
    else unavailable++;
  }

  return {
    available,
    partial,
    unavailable,
    total: available + partial + unavailable,
  };
}

/**
 * Get all available seats in a coach.
 */
export function getAvailableSeats(
  coachData: CoachData,
  segmentIndices: number[]
): { seatNumber: string; seat: SeatData; status: AvailabilityStatus }[] {
  return Object.entries(coachData)
    .map(([seatNumber, seat]) => ({
      seatNumber,
      seat,
      status: classifySeat(seat, segmentIndices),
    }))
    .sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));
}
