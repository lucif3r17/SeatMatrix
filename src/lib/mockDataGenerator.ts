import type { TrainSeatData, CoachData, SeatData, BerthType } from "./constants";

/**
 * Simple seeded PRNG (mulberry32) for deterministic mock data.
 * Given the same seed, always produces the same random sequence.
 */
function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a numeric seed */
function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

const BERTH_PATTERN: BerthType[] = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"];

interface MockCoachDef {
  id: string;
  type: "SL" | "3A" | "2A" | "1A";
  totalSeats: number;
}

/**
 * Generate realistic mock seat data for demonstration & testing.
 *
 * The data is deterministic — same train number + date always produces identical results.
 */
export function generateMockData(
  trainNo: string,
  date: string,
  stations: string[]
): { seatData: TrainSeatData; coaches: MockCoachDef[]; trainName: string } {
  const rng = createRng(hashSeed(`${trainNo}-${date}`));
  const numSegments = stations.length - 1;

  // Generate deterministic coach composition
  const coaches = generateCoachList(trainNo, rng);

  const seatData: TrainSeatData = {};

  for (const coach of coaches) {
    const coachData: CoachData = {};
    // Occupancy rate varies by coach type
    const baseOccupancy = coach.type === "1A" ? 0.55
      : coach.type === "2A" ? 0.65
      : coach.type === "3A" ? 0.75
      : 0.80; // SL

    for (let seatNum = 1; seatNum <= coach.totalSeats; seatNum++) {
      const berth = BERTH_PATTERN[(seatNum - 1) % 8];
      const segments: number[] = [];

      for (let seg = 0; seg < numSegments; seg++) {
        // Segments near origin are more occupied
        const segFactor = 1 - (seg / numSegments) * 0.3;
        const occupied = rng() < baseOccupancy * segFactor;
        segments.push(occupied ? 0 : 1);
      }

      coachData[String(seatNum)] = { berth, segments };
    }

    seatData[coach.id] = coachData;
  }

  // Generate a train name
  const trainName = generateTrainName(trainNo, rng);

  return { seatData, coaches, trainName };
}

function generateCoachList(trainNo: string, rng: () => number): MockCoachDef[] {
  const coaches: MockCoachDef[] = [];
  const trainSeed = parseInt(trainNo) || 12301;

  // Sleeper coaches: 2-6
  const slCount = 2 + Math.floor(rng() * 5);
  for (let i = 1; i <= slCount; i++) {
    coaches.push({ id: `S${i}`, type: "SL", totalSeats: 72 });
  }

  // 3AC coaches: 2-6
  const bCount = 2 + Math.floor(rng() * 5);
  for (let i = 1; i <= bCount; i++) {
    coaches.push({ id: `B${i}`, type: "3A", totalSeats: 72 });
  }

  // 2AC coaches: 1-3
  const aCount = 1 + Math.floor(rng() * 3);
  for (let i = 1; i <= aCount; i++) {
    coaches.push({ id: `A${i}`, type: "2A", totalSeats: 48 });
  }

  // 1AC coach: 0-1
  if (trainSeed % 3 !== 2) {
    coaches.push({ id: "H1", type: "1A", totalSeats: 24 });
  }

  return coaches;
}

const TRAIN_NAME_PREFIXES = [
  "Rajdhani", "Duronto", "Shatabdi", "Superfast", "Jan Shatabdi",
  "Garib Rath", "Sampark Kranti", "Poorva", "Vivek", "Humsafar",
];

function generateTrainName(trainNo: string, rng: () => number): string {
  const known: Record<string, string> = {
    "12301": "Rajdhani Express",
    "12302": "Rajdhani Express",
    "12259": "Duronto Express",
    "12260": "Duronto Express",
    "12381": "Poorva Express",
    "12382": "Poorva Express",
    "12951": "Mumbai Rajdhani Express",
    "12952": "Mumbai Rajdhani Express",
    "12002": "Shatabdi Express",
    "12001": "Shatabdi Express",
  };
  if (known[trainNo]) return known[trainNo];
  const prefix = TRAIN_NAME_PREFIXES[Math.floor(rng() * TRAIN_NAME_PREFIXES.length)];
  return `${prefix} Express`;
}

/**
 * Generate a default station list for mock mode based on common routes.
 */
export function getDefaultStations(trainNo: string): string[] {
  const trainNum = parseInt(trainNo) || 0;

  // Simulate different routes based on train number ranges
  if (trainNum >= 12300 && trainNum <= 12310) {
    return ["NDLS", "CNB", "ALD", "DDU", "GAYA", "DHN", "HWH"];
  }
  if (trainNum >= 12950 && trainNum <= 12960) {
    return ["MMCT", "BRC", "RTM", "BPL", "JHS", "AGC", "NDLS"];
  }
  if (trainNum >= 12000 && trainNum <= 12010) {
    return ["NDLS", "AGC", "GWL", "JHS", "BPL"];
  }

  // Default generic route
  return ["NDLS", "CNB", "ALD", "DDU", "GAYA", "DHN"];
}
