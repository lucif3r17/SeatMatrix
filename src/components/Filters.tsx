"use client";

import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";

export default function Filters() {
  const { preferences, setPreferences } = useStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5"
    >
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
        Preference Filters
      </h3>

      <div className="space-y-3">
        {/* Lower Berth Only */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={preferences.lowerBerthOnly}
              onChange={(e) => setPreferences({ lowerBerthOnly: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-gray-700 rounded-full peer-checked:bg-cyan-500 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm" />
          </div>
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
            Lower Berth Only
          </span>
        </label>

        {/* Same Coach Only */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={preferences.sameCoachOnly}
              onChange={(e) => setPreferences({ sameCoachOnly: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-gray-700 rounded-full peer-checked:bg-cyan-500 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm" />
          </div>
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
            Same Coach Only
          </span>
        </label>

        {/* Group Size */}
        <div className="space-y-1">
          <label className="text-sm text-gray-300">
            Group Size: <span className="text-cyan-400 font-semibold">{preferences.groupSize}</span>
          </label>
          <input
            type="range"
            min={1}
            max={6}
            value={preferences.groupSize}
            onChange={(e) => setPreferences({ groupSize: Number(e.target.value) })}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1</span>
            <span>6</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
