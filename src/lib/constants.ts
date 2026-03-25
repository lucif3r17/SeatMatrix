// Station definitions
export const STATIONS = ["NDLS", "KANPUR", "PRAYAGRAJ", "MUGHALSARAI", "GAYA", "DHANBAD"] as const;
export type StationCode = (typeof STATIONS)[number];

export const STATION_NAMES: Record<StationCode, string> = {
  NDLS: "New Delhi",
  KANPUR: "Kanpur Central",
  PRAYAGRAJ: "Prayagraj Junction",
  MUGHALSARAI: "Pt. Deen Dayal Upadhyaya Jn.",
  GAYA: "Gaya Junction",
  DHANBAD: "Dhanbad Junction",
};

export const STATION_DISTANCES: Record<StationCode, number> = {
  NDLS: 0,
  KANPUR: 440,
  PRAYAGRAJ: 634,
  MUGHALSARAI: 782,
  GAYA: 997,
  DHANBAD: 1158,
};

export const NUM_SEGMENTS = STATIONS.length - 1; // 5

// Berth types
export type BerthType = "LB" | "MB" | "UB" | "SL" | "SU";

export const BERTH_LABELS: Record<BerthType, string> = {
  LB: "Lower Berth",
  MB: "Middle Berth",
  UB: "Upper Berth",
  SL: "Side Lower",
  SU: "Side Upper",
};

// Sleeper berth pattern per bay (8 seats per bay): LB, MB, UB, LB, MB, UB, SL, SU
export const SLEEPER_BERTH_PATTERN: BerthType[] = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"];

// Data source mode
export type DataSourceMode = "mock" | "live";

// Coach definitions
export interface CoachDef {
  id: string;
  name: string;
  type: "SL" | "3A" | "2A" | "1A" | "3E" | "2S" | "CC" | "EC";
  totalSeats: number;
  berthPattern: BerthType[];
}

// Default coaches (used as fallback)
export const DEFAULT_COACHES: CoachDef[] = [
  {
    id: "S1",
    name: "Sleeper - S1",
    type: "SL",
    totalSeats: 72,
    berthPattern: SLEEPER_BERTH_PATTERN,
  },
  {
    id: "B1",
    name: "3AC - B1",
    type: "3A",
    totalSeats: 72,
    berthPattern: SLEEPER_BERTH_PATTERN,
  },
];

// For backward compat
export const COACHES = DEFAULT_COACHES;

// Coach class display names
export const CLASS_NAMES: Record<string, string> = {
  "1A": "First AC",
  "2A": "Second AC",
  "3A": "Third AC",
  "3E": "3AC Economy",
  SL: "Sleeper",
  "2S": "Second Sitting",
  CC: "Chair Car",
  EC: "Executive Chair Car",
};

// Sample trains (for quick selection, not limiting)
export const SAMPLE_TRAINS = [
  { number: "12301", name: "Rajdhani Express" },
  { number: "12259", name: "Duronto Express" },
  { number: "12381", name: "Poorva Express" },
  { number: "12951", name: "Mumbai Rajdhani" },
  { number: "12002", name: "Shatabdi Express" },
];

// Availability status
export type AvailabilityStatus = "available" | "partial" | "unavailable";

// Seat data types
export interface SeatData {
  berth: BerthType;
  segments: number[]; // 1 = free, 0 = occupied
}

export interface CoachData {
  [seatNumber: string]: SeatData;
}

export interface TrainSeatData {
  [coachId: string]: CoachData;
}

// Recommendation types
export interface SeatPlan {
  segments: SeatPlanSegment[];
  score: number;
  seatChanges: number;
  coachChanges: number;
  berthTypeChanges: number;
  explanation: string;
  /** Number of segments covered out of total requested */
  coveredSegments: number;
  totalSegments: number;
  /** 0-100 */
  coveragePercent: number;
  /** 'full' = covers entire journey, 'partial' = covers subset of journey */
  planType: "full" | "partial";
}

export interface SeatPlanSegment {
  coachId: string;
  seatNumber: string;
  berth: BerthType;
  fromStation: string;
  toStation: string;
  fromIndex: number;
  toIndex: number;
}

export interface SearchParams {
  trainNo: string;
  date: string;
  from: string;
  to: string;
}

export interface AvailabilityStats {
  available: number;
  partial: number;
  unavailable: number;
  total: number;
}

export interface Preferences {
  lowerBerthOnly: boolean;
  sameCoachOnly: boolean;
  groupSize: number;
}
