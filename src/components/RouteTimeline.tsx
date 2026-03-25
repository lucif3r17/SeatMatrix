"use client";

import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";

interface RouteTimelineProps {
  from: string;
  to: string;
  segmentIndices: number[];
}

export default function RouteTimeline({ from, to, segmentIndices }: RouteTimelineProps) {
  const { stations: dynamicStations } = useStore();

  // Use dynamic stations from the store
  const stations = dynamicStations.length > 0 ? dynamicStations : [from, to];

  const fromIdx = stations.findIndex((s) => s.toUpperCase() === from.toUpperCase());
  const toIdx = stations.findIndex((s) => s.toUpperCase() === to.toUpperCase());

  if (fromIdx === -1 || toIdx === -1) {
    return (
      <div className="text-sm text-gray-500 text-center py-2">
        {from} → {to}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-[400px] px-4">
        {stations.map((station, idx) => {
          const isActive = idx >= fromIdx && idx <= toIdx;
          const isEndpoint = idx === fromIdx || idx === toIdx;
          const isInJourney = idx >= fromIdx && idx < toIdx;

          return (
            <div key={`${station}-${idx}`} className="flex items-center flex-1 last:flex-none">
              {/* Station node */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: idx * 0.08, type: "spring" }}
                className="flex flex-col items-center relative"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    isEndpoint
                      ? "bg-cyan-400 border-cyan-400 shadow-lg shadow-cyan-400/50 scale-125"
                      : isActive
                      ? "bg-emerald-400 border-emerald-400 shadow-md shadow-emerald-400/30"
                      : "bg-gray-600 border-gray-500"
                  }`}
                />
                <span
                  className={`text-[10px] mt-1.5 font-mono whitespace-nowrap ${
                    isActive ? "text-white font-semibold" : "text-gray-500"
                  }`}
                >
                  {station}
                </span>
              </motion.div>

              {/* Connecting line */}
              {idx < stations.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: idx * 0.08 + 0.04, duration: 0.3 }}
                  className={`flex-1 h-0.5 mx-1 origin-left ${
                    isInJourney && segmentIndices.includes(idx)
                      ? "bg-gradient-to-r from-cyan-400 to-emerald-400"
                      : "bg-gray-700"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
