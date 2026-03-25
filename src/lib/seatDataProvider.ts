import { scrapeTrainchart } from "./trainchartScraper";
import { generateMockData, getDefaultStations } from "./mockDataGenerator";
import type { TrainSeatData, DataSourceMode } from "./constants";
import { getISTTimestamp } from "./dateUtils";

export interface SeatDataResult {
  seatData: TrainSeatData;
  stations: string[];
  trainName: string;
  source: DataSourceMode;
  fetchedAt: string;
  chartPrepTime?: string;
  coaches?: { id: string; classCode?: string; type?: string }[];
}

export interface SeatDataError {
  status: "error";
  message: string;
}

/**
 * Abstract seat data provider interface.
 */
export interface SeatDataProvider {
  getSeats(trainNo: string, date: string): Promise<SeatDataResult>;
}

/**
 * Mock data provider — generates deterministic realistic seat data.
 * Instant, works offline, no external API calls.
 */
export class MockSeatDataProvider implements SeatDataProvider {
  async getSeats(trainNo: string, date: string): Promise<SeatDataResult> {
    const stations = getDefaultStations(trainNo);
    const { seatData, coaches, trainName } = generateMockData(trainNo, date, stations);

    return {
      seatData,
      stations,
      trainName,
      source: "mock",
      fetchedAt: getISTTimestamp(),
      coaches: coaches.map((c) => ({ id: c.id, classCode: c.type, type: c.type })),
    };
  }
}

/**
 * TrainChart.in API-based data provider.
 * Fetches live vacancy data from api2.trainapp.in.
 */
export class TrainchartSeatDataProvider implements SeatDataProvider {
  async getSeats(trainNo: string, date: string): Promise<SeatDataResult> {
    const result = await scrapeTrainchart(trainNo, date);

    if (!result.success) {
      throw new Error(result.error || "Could not fetch train chart data. Please try again later.");
    }

    return {
      seatData: result.seatData,
      stations: result.stations,
      trainName: result.trainName,
      source: "live",
      fetchedAt: getISTTimestamp(),
      chartPrepTime: result.chartPrepTime,
      coaches: result.coaches.map((c) => ({
        id: c.id,
        classCode: c.classCode,
      })),
    };
  }
}

/**
 * Get the appropriate data provider based on mode.
 */
export function getProvider(mode: DataSourceMode): SeatDataProvider {
  switch (mode) {
    case "live":
      return new TrainchartSeatDataProvider();
    case "mock":
    default:
      return new MockSeatDataProvider();
  }
}

// Default singleton (mock for safety)
export const seatDataProvider = new MockSeatDataProvider();
