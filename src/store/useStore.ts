import { create } from "zustand";
import { getISTTimestamp } from "@/lib/dateUtils";
import type {
  TrainSeatData,
  SeatPlan,
  AvailabilityStats,
  AvailabilityStatus,
  Preferences,
  SeatData,
  DataSourceMode,
} from "@/lib/constants";

interface SeatInfo {
  seatNumber: string;
  seat: SeatData;
  status: AvailabilityStatus;
}

interface CoachStats {
  stats: AvailabilityStats;
  seats: SeatInfo[];
}

interface TrainStationInfo {
  code: string;
  name: string;
}

type ScheduleStatus = 'idle' | 'loading' | 'ready' | 'not_ready' | 'unavailable' | 'error';

interface AppState {
  // Search
  trainNo: string;
  date: string;
  from: string;
  to: string;
  setTrainNo: (v: string) => void;
  setDate: (v: string) => void;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;

  // Data source mode
  dataMode: DataSourceMode;
  setDataMode: (v: DataSourceMode) => void;

  // Train details (from search/details API)
  trainStations: TrainStationInfo[];
  setTrainStations: (v: TrainStationInfo[]) => void;
  selectedTrainName: string;
  setSelectedTrainName: (v: string) => void;

  // Schedule & chart status
  scheduleStatus: ScheduleStatus;
  setScheduleStatus: (v: ScheduleStatus) => void;
  scheduleMessage: string;
  setScheduleMessage: (v: string) => void;

  // Results
  loading: boolean;
  error: string | null;
  dataSource: DataSourceMode | null;
  fetchedAt: string | null;
  chartPrepTime: string | null;
  seatData: TrainSeatData | null;
  coachStats: Record<string, CoachStats>;
  segmentIndices: number[];
  recommendations: SeatPlan[];
  selectedCoach: string;
  selectedSeat: string | null;
  highlightedSeats: Set<string>;
  stations: string[];
  trainName: string | null;

  setSelectedCoach: (v: string) => void;
  setSelectedSeat: (v: string | null) => void;
  setHighlightedSeats: (v: Set<string>) => void;

  // Preferences
  preferences: Preferences;
  setPreferences: (v: Partial<Preferences>) => void;

  // Dark mode
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Actions
  fetchData: () => Promise<void>;
  fetchRecommendations: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  trainNo: "",
  date: "",
  from: "",
  to: "",
  setTrainNo: (v) => set({ trainNo: v }),
  setDate: (v) => set({ date: v }),
  setFrom: (v) => set({ from: v }),
  setTo: (v) => set({ to: v }),

  dataMode: "live",
  setDataMode: (v) => set({ dataMode: v }),

  trainStations: [],
  setTrainStations: (v) => set({ trainStations: v }),
  selectedTrainName: "",
  setSelectedTrainName: (v) => set({ selectedTrainName: v }),

  scheduleStatus: 'idle',
  setScheduleStatus: (v) => set({ scheduleStatus: v }),
  scheduleMessage: '',
  setScheduleMessage: (v) => set({ scheduleMessage: v }),

  loading: false,
  error: null,
  dataSource: null,
  fetchedAt: null,
  chartPrepTime: null,
  seatData: null,
  coachStats: {},
  segmentIndices: [],
  recommendations: [],
  selectedCoach: "",
  selectedSeat: null,
  highlightedSeats: new Set(),
  stations: [],
  trainName: null,

  setSelectedCoach: (v) => set({ selectedCoach: v }),
  setSelectedSeat: (v) => set({ selectedSeat: v }),
  setHighlightedSeats: (v) => set({ highlightedSeats: v }),

  preferences: {
    lowerBerthOnly: false,
    sameCoachOnly: false,
    groupSize: 1,
  },
  setPreferences: (v) =>
    set((s) => ({
      preferences: { ...s.preferences, ...v },
    })),

  darkMode: true,
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  fetchData: async () => {
    const { trainNo, date, from, to, dataMode } = get();
    if (!trainNo || !date || !from || !to) return;

    set({ loading: true, error: null, dataSource: null, fetchedAt: null, chartPrepTime: null });
    try {
      const res = await fetch(
        `/api/mock-seats?train_no=${trainNo}&date=${date}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${dataMode}`
      );
      const data = await res.json();

      if (data.status === "error") {
        set({
          loading: false,
          error: data.message || "Could not fetch seat data. Please try again later.",
          seatData: null,
          coachStats: {},
          segmentIndices: [],
          recommendations: [],
          stations: [],
          trainName: null,
        });
        return;
      }

      // Set selected coach to first available
      const firstCoach = Object.keys(data.seatData || {})[0] || "";

      set({
        seatData: data.seatData,
        coachStats: data.coachStats,
        segmentIndices: data.segmentIndices,
        dataSource: data.source || dataMode,
        fetchedAt: data.fetchedAt || getISTTimestamp(),
        chartPrepTime: data.chartPrepTime || null,
        stations: data.stations || [],
        trainName: data.trainName || trainNo,
        selectedCoach: firstCoach,
        loading: false,
        error: null,
      });
    } catch {
      set({
        loading: false,
        error: "Could not fetch seat data. Please try again later.",
        seatData: null,
        coachStats: {},
        segmentIndices: [],
        recommendations: [],
        stations: [],
        trainName: null,
      });
    }
  },

  fetchRecommendations: async () => {
    const { trainNo, date, from, to, preferences, dataMode } = get();
    if (!trainNo || !date || !from || !to) return;

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainNo, date, from, to, preferences, mode: dataMode }),
      });
      const data = await res.json();

      if (data.status === "error") {
        set({ recommendations: [] });
        return;
      }

      set({ recommendations: data.recommendations || [] });
    } catch {
      set({ recommendations: [] });
    }
  },
}));
