"use client";

import { useStore } from "@/store/useStore";
import { CLASS_NAMES } from "@/lib/constants";
import { motion } from "framer-motion";

function getCoachClass(coachId: string): string {
  const letter = coachId.charAt(0).toUpperCase();
  switch (letter) {
    case "H": return "1A";
    case "A": return "2A";
    case "B": return "3A";
    case "S": return "SL";
    case "D": return "3E";
    default: return "SL";
  }
}

export default function CoachSelector() {
  const { selectedCoach, setSelectedCoach, coachStats, seatData } = useStore();

  // Derive coach list from actual seat data
  const coachIds = seatData ? Object.keys(seatData) : [];

  if (coachIds.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {coachIds.map((coachId) => {
        const isActive = selectedCoach === coachId;
        const stats = coachStats[coachId]?.stats;
        const classCode = getCoachClass(coachId);
        const className = CLASS_NAMES[classCode] || classCode;

        return (
          <motion.button
            key={coachId}
            onClick={() => setSelectedCoach(coachId)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative px-4 py-2 rounded-xl font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25"
                : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
            }`}
          >
            <div className="text-sm font-semibold">{coachId}</div>
            <div className="text-[10px] opacity-70">{className}</div>
            {stats && (
              <div className="flex gap-1.5 mt-0.5 text-[9px]">
                <span className="text-emerald-400">●{stats.available}</span>
                <span className="text-amber-400">●{stats.partial}</span>
                <span className="text-rose-400">●{stats.unavailable}</span>
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
