import {
  type TrainSeatData,
  type SeatPlan,
  type SeatPlanSegment,
  type BerthType,
  type Preferences,
} from "./constants";
import { classifySeat } from "./seatLogic";

/**
 * Generate smart seat recommendations with dynamic station support.
 *
 * Strategy (in order of preference):
 * 1. Find single seats covering the entire journey (full coverage, same coach)
 * 2. Find 2-seat combinations covering the entire journey (same coach preferred)
 * 3. Find 3-seat combinations covering the entire journey
 * 4. INTRA-CABIN: search across ALL coaches for optimal cross-coach combinations
 * 5. If no full coverage possible → find PARTIAL coverage plans
 */
export function generateRecommendations(
  seatData: TrainSeatData,
  from: string,
  to: string,
  stations: string[],
  preferences: Preferences = { lowerBerthOnly: false, sameCoachOnly: false, groupSize: 1 }
): SeatPlan[] {
  const segmentIndices = getSegmentIndicesFromStations(from, to, stations);
  if (segmentIndices.length === 0) return [];

  const totalSegs = segmentIndices.length;
  const fullPlans: SeatPlan[] = [];

  const allCoachIds = Object.keys(seatData);
  if (allCoachIds.length === 0) return [];

  // ─── Phase 1: Single fully-available seats (same coach) ───
  for (const coachId of allCoachIds) {
    const coachData = seatData[coachId];
    if (!coachData) continue;

    for (const [seatNum, seat] of Object.entries(coachData)) {
      if (preferences.lowerBerthOnly && seat.berth !== "LB" && seat.berth !== "SL") continue;

      const status = classifySeat(seat, segmentIndices);
      if (status === "available") {
        const fromStation = stations[segmentIndices[0]];
        const toStation = stations[segmentIndices[totalSegs - 1] + 1];
        fullPlans.push({
          segments: [{
            coachId, seatNumber: seatNum, berth: seat.berth,
            fromStation, toStation,
            fromIndex: segmentIndices[0], toIndex: segmentIndices[totalSegs - 1] + 1,
          }],
          score: 0, seatChanges: 0, coachChanges: 0, berthTypeChanges: 0,
          coveredSegments: totalSegs, totalSegments: totalSegs,
          coveragePercent: 100, planType: "full",
          explanation: `Seat ${seatNum} in ${coachId} (${seat.berth}) is available for your entire journey from ${fromStation} to ${toStation}.`,
        });
      }
    }
  }

  if (fullPlans.length >= 5) return sortAndRank(fullPlans).slice(0, 10);

  // ─── Phase 2: 2-seat full-coverage combinations (same coach first) ───
  const twoSeatSameCoach = generateMultiSeatFullPlans(seatData, segmentIndices, allCoachIds, stations, preferences, 2, true);
  fullPlans.push(...twoSeatSameCoach);

  if (fullPlans.length >= 5) return sortAndRank(fullPlans).slice(0, 10);

  // ─── Phase 3: 2-seat CROSS-COACH (intra-cabin) ───
  if (!preferences.sameCoachOnly && allCoachIds.length > 1) {
    const twoSeatCrossCoach = generateMultiSeatFullPlans(seatData, segmentIndices, allCoachIds, stations, preferences, 2, false);
    fullPlans.push(...twoSeatCrossCoach);
  }

  if (fullPlans.length >= 5) return sortAndRank(fullPlans).slice(0, 10);

  // ─── Phase 4: 3-seat combinations (same coach then cross-coach) ───
  if (segmentIndices.length >= 3) {
    const threeSeatSame = generateMultiSeatFullPlans(seatData, segmentIndices, allCoachIds, stations, preferences, 3, true);
    fullPlans.push(...threeSeatSame);

    if (!preferences.sameCoachOnly && allCoachIds.length > 1 && fullPlans.length < 5) {
      const threeSeatCross = generateMultiSeatFullPlans(seatData, segmentIndices, allCoachIds, stations, preferences, 3, false);
      fullPlans.push(...threeSeatCross);
    }
  }

  if (fullPlans.length > 0) return sortAndRank(fullPlans).slice(0, 10);

  // ─── Phase 5: PARTIAL COVERAGE ───
  const partialPlans = generatePartialCoveragePlans(seatData, segmentIndices, allCoachIds, stations, preferences);

  return sortAndRankPartial(partialPlans).slice(0, 10);
}

/**
 * Get segment indices from dynamic station list.
 */
function getSegmentIndicesFromStations(from: string, to: string, stations: string[]): number[] {
  const fromIdx = stations.findIndex((s) => s.toUpperCase() === from.toUpperCase());
  const toIdx = stations.findIndex((s) => s.toUpperCase() === to.toUpperCase());

  if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) return [];

  const indices: number[] = [];
  for (let i = fromIdx; i < toIdx; i++) {
    indices.push(i);
  }
  return indices;
}

// ═══════════════════════════════════════════════════════════
// Full-coverage multi-seat plans (2 or 3 seat splits)
// ═══════════════════════════════════════════════════════════

function generateMultiSeatFullPlans(
  seatData: TrainSeatData,
  segmentIndices: number[],
  coachIds: string[],
  stations: string[],
  preferences: Preferences,
  numSeats: 2 | 3,
  sameCoachOnly: boolean
): SeatPlan[] {
  const plans: SeatPlan[] = [];
  const totalSegs = segmentIndices.length;

  if (numSeats === 2) {
    for (let split = 1; split < totalSegs; split++) {
      const parts = [segmentIndices.slice(0, split), segmentIndices.slice(split)];
      const combos = findSeatsForParts(seatData, parts, coachIds, preferences, 5, sameCoachOnly);
      for (const combo of combos) {
        plans.push(buildPlan(combo, parts, totalSegs, "full", stations));
        if (plans.length > 100) return sortAndRank(plans).slice(0, 20);
      }
    }
  } else {
    for (let s1 = 1; s1 < totalSegs - 1; s1++) {
      for (let s2 = s1 + 1; s2 < totalSegs; s2++) {
        const parts = [
          segmentIndices.slice(0, s1),
          segmentIndices.slice(s1, s2),
          segmentIndices.slice(s2),
        ];
        const combos = findSeatsForParts(seatData, parts, coachIds, preferences, 3, sameCoachOnly);
        for (const combo of combos) {
          plans.push(buildPlan(combo, parts, totalSegs, "full", stations));
          if (plans.length > 50) return sortAndRank(plans).slice(0, 10);
        }
      }
    }
  }

  return plans;
}

// ═══════════════════════════════════════════════════════════
// PARTIAL COVERAGE: maximum journey coverage when full is impossible
// ═══════════════════════════════════════════════════════════

function generatePartialCoveragePlans(
  seatData: TrainSeatData,
  segmentIndices: number[],
  coachIds: string[],
  stations: string[],
  preferences: Preferences
): SeatPlan[] {
  const plans: SeatPlan[] = [];
  const totalSegs = segmentIndices.length;

  // Strategy A: Find the single seat covering the MOST contiguous segments
  const singlePartials = findBestSinglePartialSeats(seatData, segmentIndices, coachIds, stations, preferences);
  plans.push(...singlePartials);

  // Strategy B: Sub-ranges with single seats or 2-seat splits
  for (let len = totalSegs - 1; len >= Math.ceil(totalSegs / 2); len--) {
    for (let start = 0; start <= totalSegs - len; start++) {
      const subSegments = segmentIndices.slice(start, start + len);

      // Try single seat for this sub-range
      for (const coachId of coachIds) {
        const coach = seatData[coachId];
        if (!coach) continue;
        for (const [seatNum, seat] of Object.entries(coach)) {
          if (preferences.lowerBerthOnly && seat.berth !== "LB" && seat.berth !== "SL") continue;
          if (classifySeat(seat, subSegments) === "available") {
            const fromStation = stations[subSegments[0]];
            const toStation = stations[subSegments[subSegments.length - 1] + 1];
            plans.push({
              segments: [{
                coachId, seatNumber: seatNum, berth: seat.berth,
                fromStation, toStation,
                fromIndex: subSegments[0], toIndex: subSegments[subSegments.length - 1] + 1,
              }],
              score: 0, seatChanges: 0, coachChanges: 0, berthTypeChanges: 0,
              coveredSegments: len, totalSegments: totalSegs,
              coveragePercent: Math.round((len / totalSegs) * 100),
              planType: "partial",
              explanation: `Seat ${seatNum} in ${coachId} (${seat.berth}) covers ${len}/${totalSegs} segments: ${fromStation} → ${toStation}. ` +
                (start > 0 ? `Missing first ${start} segment(s). ` : "") +
                (start + len < totalSegs ? `Missing last ${totalSegs - start - len} segment(s).` : ""),
            });
            if (plans.length > 150) return plans;
          }
        }
      }

      // Try 2-seat split for this sub-range (including cross-coach)
      if (len >= 2) {
        for (let split = 1; split < len; split++) {
          const parts = [subSegments.slice(0, split), subSegments.slice(split)];
          const combos = findSeatsForParts(seatData, parts, coachIds, preferences, 3, false);
          for (const combo of combos) {
            const plan = buildPlan(combo, parts, totalSegs, "partial", stations);
            plan.coveredSegments = len;
            plan.coveragePercent = Math.round((len / totalSegs) * 100);
            plans.push(plan);
            if (plans.length > 200) return plans;
          }
        }
      }
    }
  }

  // Strategy C: Greedy maximum-coverage from partial seats
  const greedyPlans = greedyMaxCoverage(seatData, segmentIndices, coachIds, stations, preferences);
  plans.push(...greedyPlans);

  return plans;
}

function findBestSinglePartialSeats(
  seatData: TrainSeatData,
  segmentIndices: number[],
  coachIds: string[],
  stations: string[],
  preferences: Preferences
): SeatPlan[] {
  const plans: SeatPlan[] = [];
  const totalSegs = segmentIndices.length;

  for (const coachId of coachIds) {
    const coach = seatData[coachId];
    if (!coach) continue;

    for (const [seatNum, seat] of Object.entries(coach)) {
      if (preferences.lowerBerthOnly && seat.berth !== "LB" && seat.berth !== "SL") continue;

      const { bestStart, bestLen } = longestFreeRun(seat.segments, segmentIndices);

      if (bestLen > 0 && bestLen < totalSegs) {
        const fromStation = stations[segmentIndices[bestStart]];
        const toStation = stations[segmentIndices[bestStart + bestLen - 1] + 1];

        plans.push({
          segments: [{
            coachId, seatNumber: seatNum, berth: seat.berth,
            fromStation, toStation,
            fromIndex: segmentIndices[bestStart],
            toIndex: segmentIndices[bestStart + bestLen - 1] + 1,
          }],
          score: 0, seatChanges: 0, coachChanges: 0, berthTypeChanges: 0,
          coveredSegments: bestLen, totalSegments: totalSegs,
          coveragePercent: Math.round((bestLen / totalSegs) * 100),
          planType: "partial",
          explanation: `Seat ${seatNum} in ${coachId} (${seat.berth}) covers ${bestLen}/${totalSegs} segments: ${fromStation} → ${toStation}. Best contiguous availability.`,
        });
      }
    }
  }

  return plans;
}

/**
 * Greedy approach: stitch together seats for maximum segment coverage.
 * Searches across ALL coaches for optimal cross-coach combinations.
 */
function greedyMaxCoverage(
  seatData: TrainSeatData,
  segmentIndices: number[],
  coachIds: string[],
  stations: string[],
  preferences: Preferences
): SeatPlan[] {
  const totalSegs = segmentIndices.length;
  const covered = new Set<number>();
  const planSegments: SeatPlanSegment[] = [];
  const usedSeats = new Set<string>();

  for (let iter = 0; iter < 4 && covered.size < totalSegs; iter++) {
    let bestSeat: { coachId: string; seatNum: string; berth: BerthType; freeIndices: number[] } | null = null;
    let bestCount = 0;

    for (const coachId of coachIds) {
      const coach = seatData[coachId];
      if (!coach) continue;

      for (const [seatNum, seat] of Object.entries(coach)) {
        if (usedSeats.has(`${coachId}-${seatNum}`)) continue;
        if (preferences.lowerBerthOnly && seat.berth !== "LB" && seat.berth !== "SL") continue;

        const freeIndices: number[] = [];
        for (let i = 0; i < totalSegs; i++) {
          if (!covered.has(i) && seat.segments[segmentIndices[i]] === 1) {
            freeIndices.push(i);
          }
        }

        if (freeIndices.length > bestCount) {
          bestCount = freeIndices.length;
          bestSeat = { coachId, seatNum, berth: seat.berth, freeIndices };
        }
      }
    }

    if (!bestSeat || bestCount === 0) break;

    const ranges = getContiguousRanges(bestSeat.freeIndices);
    for (const range of ranges) {
      const fromStation = stations[segmentIndices[range[0]]];
      const toStation = stations[segmentIndices[range[range.length - 1]] + 1];
      planSegments.push({
        coachId: bestSeat.coachId, seatNumber: bestSeat.seatNum, berth: bestSeat.berth,
        fromStation, toStation,
        fromIndex: segmentIndices[range[0]], toIndex: segmentIndices[range[range.length - 1]] + 1,
      });
    }

    bestSeat.freeIndices.forEach((i) => covered.add(i));
    usedSeats.add(`${bestSeat.coachId}-${bestSeat.seatNum}`);
  }

  if (planSegments.length === 0) return [];

  planSegments.sort((a, b) => a.fromIndex - b.fromIndex);

  const uniqueSeats = new Set(planSegments.map((s) => `${s.coachId}-${s.seatNumber}`));
  const uniqueCoaches = new Set(planSegments.map((s) => s.coachId));
  const uniqueBerths = new Set(planSegments.map((s) => s.berth));

  const seatChanges = uniqueSeats.size - 1;
  const coachChanges = uniqueCoaches.size - 1;
  const berthTypeChanges = uniqueBerths.size - 1;
  const coveredCount = covered.size;

  const legs = planSegments.map((s) => ({
    seat: s.seatNumber, coach: s.coachId,
    from: s.fromStation, to: s.toStation, berth: s.berth,
  }));

  return [{
    segments: planSegments,
    score: 5 * seatChanges + 3 * coachChanges + 2 * berthTypeChanges,
    seatChanges, coachChanges, berthTypeChanges,
    coveredSegments: coveredCount, totalSegments: totalSegs,
    coveragePercent: Math.round((coveredCount / totalSegs) * 100),
    planType: "partial",
    explanation: `Greedy optimal plan covering ${coveredCount}/${totalSegs} segments (${Math.round((coveredCount / totalSegs) * 100)}%). ` +
      (coachChanges > 0 ? `Cross-coach travel across ${uniqueCoaches.size} coaches. ` : "") +
      generateExplanation(seatChanges, coachChanges, berthTypeChanges, legs),
  }];
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function longestFreeRun(segments: number[], indices: number[]): { bestStart: number; bestLen: number } {
  let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
  for (let i = 0; i < indices.length; i++) {
    if (segments[indices[i]] === 1) {
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else {
      curLen = 0;
    }
  }
  return { bestStart, bestLen };
}

function getContiguousRanges(indices: number[]): number[][] {
  if (indices.length === 0) return [];
  const sorted = [...indices].sort((a, b) => a - b);
  const ranges: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      ranges[ranges.length - 1].push(sorted[i]);
    } else {
      ranges.push([sorted[i]]);
    }
  }
  return ranges;
}

type SeatCandidate = { coachId: string; seatNum: string; berth: BerthType };

function findSeatsForParts(
  seatData: TrainSeatData,
  parts: number[][],
  coachIds: string[],
  preferences: Preferences,
  maxPerPart: number = 5,
  sameCoachOnly: boolean = false
): SeatCandidate[][] {
  const allCandidates: SeatCandidate[][] = [];
  for (const part of parts) {
    const partCandidates: SeatCandidate[] = [];
    for (const coachId of coachIds) {
      const coach = seatData[coachId];
      if (!coach) continue;
      for (const [seatNum, seat] of Object.entries(coach)) {
        if (preferences.lowerBerthOnly && seat.berth !== "LB" && seat.berth !== "SL") continue;
        if (classifySeat(seat, part) === "available") {
          partCandidates.push({ coachId, seatNum, berth: seat.berth });
          if (partCandidates.length >= maxPerPart) break;
        }
      }
      if (partCandidates.length >= maxPerPart) break;
    }
    allCandidates.push(partCandidates);
  }

  const results: SeatCandidate[][] = [];

  if (parts.length === 2) {
    for (const c1 of allCandidates[0]) {
      for (const c2 of allCandidates[1]) {
        if (c1.coachId === c2.coachId && c1.seatNum === c2.seatNum) continue;
        if (sameCoachOnly && c1.coachId !== c2.coachId) continue;
        results.push([c1, c2]);
        if (results.length > 20) return results;
      }
    }
  } else if (parts.length === 3) {
    for (const c1 of allCandidates[0]) {
      for (const c2 of allCandidates[1]) {
        if (c1.coachId === c2.coachId && c1.seatNum === c2.seatNum) continue;
        if (sameCoachOnly && c1.coachId !== c2.coachId) continue;
        for (const c3 of allCandidates[2]) {
          if ((c2.coachId === c3.coachId && c2.seatNum === c3.seatNum) ||
              (c1.coachId === c3.coachId && c1.seatNum === c3.seatNum)) continue;
          if (sameCoachOnly && (c1.coachId !== c3.coachId || c2.coachId !== c3.coachId)) continue;
          results.push([c1, c2, c3]);
          if (results.length > 20) return results;
        }
      }
    }
  }

  return results;
}

function buildPlan(
  combo: SeatCandidate[],
  parts: number[][],
  totalSegs: number,
  planType: "full" | "partial",
  stations: string[]
): SeatPlan {
  const planSegs: SeatPlanSegment[] = combo.map((c, i) => ({
    coachId: c.coachId, seatNumber: c.seatNum, berth: c.berth,
    fromStation: stations[parts[i][0]],
    toStation: stations[parts[i][parts[i].length - 1] + 1],
    fromIndex: parts[i][0], toIndex: parts[i][parts[i].length - 1] + 1,
  }));

  const seatChanges = combo.length - 1;
  const uniqueCoaches = new Set(combo.map((c) => c.coachId));
  const coachChanges = uniqueCoaches.size - 1;
  const uniqueBerths = new Set(combo.map((c) => c.berth));
  const berthTypeChanges = uniqueBerths.size - 1;
  const coveredSegs = parts.reduce((sum, p) => sum + p.length, 0);

  const legs = combo.map((c, i) => ({
    seat: c.seatNum, coach: c.coachId,
    from: stations[parts[i][0]],
    to: stations[parts[i][parts[i].length - 1] + 1],
    berth: c.berth,
  }));

  return {
    segments: planSegs,
    score: 5 * seatChanges + 3 * coachChanges + 2 * berthTypeChanges,
    seatChanges, coachChanges, berthTypeChanges,
    coveredSegments: coveredSegs, totalSegments: totalSegs,
    coveragePercent: Math.round((coveredSegs / totalSegs) * 100),
    planType,
    explanation: (coachChanges > 0 ? `Cross-coach travel across ${uniqueCoaches.size} coaches. ` : "") +
      generateExplanation(seatChanges, coachChanges, berthTypeChanges, legs),
  };
}

function generateExplanation(
  seatChanges: number,
  coachChanges: number,
  berthTypeChanges: number,
  legs: { seat: string; coach: string; from: string; to: string; berth: BerthType }[]
): string {
  const parts: string[] = [];

  if (seatChanges === 0) {
    parts.push(`Single seat for this journey.`);
  } else {
    parts.push(`This plan requires ${seatChanges} seat change${seatChanges > 1 ? "s" : ""}.`);
  }

  if (coachChanges > 0) {
    parts.push(`You'll need to switch coach${coachChanges > 1 ? "es" : ""} ${coachChanges} time${coachChanges > 1 ? "s" : ""}.`);
  } else if (seatChanges > 0) {
    parts.push("All seats are in the same coach.");
  }

  if (berthTypeChanges > 0) {
    parts.push(`Berth type changes ${berthTypeChanges} time${berthTypeChanges > 1 ? "s" : ""}.`);
  } else if (seatChanges > 0) {
    parts.push(`Same berth type throughout.`);
  }

  parts.push("Route: " + legs.map((l) => `Seat ${l.seat}/${l.coach} (${l.berth}) ${l.from}→${l.to}`).join(" → "));

  return parts.join(" ");
}

function sortAndRank(plans: SeatPlan[]): SeatPlan[] {
  return plans.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.seatChanges - b.seatChanges;
  });
}

function sortAndRankPartial(plans: SeatPlan[]): SeatPlan[] {
  return plans.sort((a, b) => {
    if (a.coveragePercent !== b.coveragePercent) return b.coveragePercent - a.coveragePercent;
    if (a.seatChanges !== b.seatChanges) return a.seatChanges - b.seatChanges;
    return a.score - b.score;
  });
}
