"use client";

import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";

interface TrainSuggestion {
  number: string;
  name: string;
}

export default function SearchForm() {
  const {
    trainNo, date, from, to,
    setTrainNo, setDate, setFrom, setTo,
    dataMode, setDataMode,
    trainStations, setTrainStations,
    selectedTrainName, setSelectedTrainName,
  } = useStore();
  const router = useRouter();

  // Autocomplete state
  const [trainQuery, setTrainQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TrainSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingStations, setLoadingStations] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Set today's date on mount (client-only to avoid hydration mismatch)
  useEffect(() => {
    if (!date) {
      setDate(new Date().toISOString().split("T")[0]);
    }
  }, [date, setDate]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced train search
  const searchTrains = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/train-search?q=${encodeURIComponent(query)}`);
      const data: TrainSuggestion[] = await res.json();
      setSuggestions(data.slice(0, 15));
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleTrainInput = (value: string) => {
    setTrainQuery(value);
    // Clear previous selection if user is typing again
    if (trainNo && value !== `${trainNo} - ${selectedTrainName}`) {
      setTrainNo("");
      setSelectedTrainName("");
      setTrainStations([]);
      setFrom("");
      setTo("");
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTrains(value), 300);
  };

  // Select a train from suggestions
  const handleSelectTrain = async (train: TrainSuggestion) => {
    setTrainNo(train.number);
    setSelectedTrainName(train.name);
    setTrainQuery(`${train.number} - ${train.name}`);
    setShowSuggestions(false);
    setSuggestions([]);
    setFrom("");
    setTo("");

    // Fetch train details to get station list
    setLoadingStations(true);
    try {
      const res = await fetch(`/api/train-details?train_no=${train.number}`);
      const data = await res.json();
      if (data.stations) {
        setTrainStations(data.stations);
      }
    } catch {
      setTrainStations([]);
    } finally {
      setLoadingStations(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainNo || !date || !from || !to) return;
    router.push(
      `/results?train_no=${trainNo}&date=${date}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${dataMode}`
    );
  };

  const fromIdx = from ? trainStations.findIndex((s) => s.code === from) : -1;
  const filteredTo = fromIdx >= 0 ? trainStations.filter((_, i) => i > fromIdx) : trainStations.slice(1);

  return (
    <motion.form
      onSubmit={handleSearch}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl">
        {/* Data Source Toggle */}
        <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-3">
          <span className="text-sm text-gray-400">Data Source</span>
          <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
            <button
              type="button"
              onClick={() => setDataMode("mock")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                dataMode === "mock"
                  ? "bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/25"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🎭 Mock
            </button>
            <button
              type="button"
              onClick={() => setDataMode("live")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                dataMode === "live"
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/25"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📡 Live
            </button>
          </div>
        </div>

        {/* Mode description */}
        <div className="text-xs text-gray-500 -mt-3 px-1">
          {dataMode === "mock"
            ? "🎭 Uses generated demo data — works offline, instant results"
            : "📡 Fetches live vacancy from TrainChart.in — requires chart to be prepared"}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Train Number — autocomplete */}
          <div className="space-y-2 md:col-span-2 relative">
            <label className="text-sm font-medium text-gray-300 uppercase tracking-wider">
              Train Number
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={trainQuery}
                onChange={(e) => handleTrainInput(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Type train number or name (e.g., 12301 or Rajdhani)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
              />
              {loadingSuggestions && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {trainNo && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm">
                  ✓
                </div>
              )}
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  ref={suggestionsRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-50 w-full mt-1 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
                >
                  {suggestions.map((train) => (
                    <button
                      key={train.number}
                      type="button"
                      onClick={() => handleSelectTrain(train)}
                      className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3 border-b border-white/5 last:border-b-0"
                    >
                      <span className="text-cyan-400 font-mono font-semibold text-sm w-14">{train.number}</span>
                      <span className="text-gray-300 text-sm truncate">{train.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading stations indicator */}
            {loadingStations && (
              <div className="flex items-center gap-2 text-xs text-cyan-400/70 mt-1">
                <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                Loading stations...
              </div>
            )}

            {/* Selected train info */}
            {trainNo && selectedTrainName && !loadingStations && trainStations.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-400/80 mt-1">
                <span>🚂 {selectedTrainName}</span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-500">{trainStations.length} stations</span>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 uppercase tracking-wider">
              Journey Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all [color-scheme:dark]"
            />
          </div>

          {/* Spacer for grid alignment */}
          <div className="hidden md:block" />

          {/* From Station */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 uppercase tracking-wider">
              From Station
            </label>
            <select
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setTo("");
              }}
              disabled={trainStations.length === 0}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all disabled:opacity-40 appearance-none cursor-pointer"
            >
              <option value="" className="bg-gray-900">
                {trainStations.length === 0 ? "Select a train first" : "Select station"}
              </option>
              {trainStations.slice(0, -1).map((s) => (
                <option key={s.code} value={s.code} className="bg-gray-900">
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* To Station */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 uppercase tracking-wider">
              To Station
            </label>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={!from || filteredTo.length === 0}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all disabled:opacity-40 appearance-none cursor-pointer"
            >
              <option value="" className="bg-gray-900">Select station</option>
              {filteredTo.map((s) => (
                <option key={s.code} value={s.code} className="bg-gray-900">
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={!trainNo || !date || !from || !to}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-lg tracking-wide"
        >
          🚄 Check Smart Availability
        </motion.button>
      </div>
    </motion.form>
  );
}
