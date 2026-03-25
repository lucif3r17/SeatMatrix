"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import type { DataSourceMode } from "@/lib/constants";
import RouteTimeline from "@/components/RouteTimeline";
import CoachSelector from "@/components/CoachSelector";
import SeatMap from "@/components/SeatMap";
import Recommendations from "@/components/Recommendations";
import Filters from "@/components/Filters";
import SharePlan from "@/components/SharePlan";
import DarkModeToggle from "@/components/DarkModeToggle";
import { motion } from "framer-motion";

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const {
    setTrainNo, setDate, setFrom, setTo, setDataMode,
    fetchData, fetchRecommendations,
    loading, error, dataSource, fetchedAt, chartPrepTime,
    seatData, coachStats, segmentIndices, recommendations,
    from, to, trainNo, date, dataMode, trainName: storeTrainName,
    preferences, stations,
  } = useStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const tn = searchParams.get("train_no");
    const d = searchParams.get("date");
    const f = searchParams.get("from");
    const t = searchParams.get("to");
    const m = searchParams.get("mode") as DataSourceMode | null;

    if (tn && d && f && t) {
      setTrainNo(tn);
      setDate(d);
      setFrom(f);
      setTo(t);
      if (m) setDataMode(m);
    }
  }, [searchParams, setTrainNo, setDate, setFrom, setTo, setDataMode]);

  useEffect(() => {
    if (from && to && trainNo && date) {
      fetchData();
      fetchRecommendations();
    }
  }, [from, to, trainNo, date, fetchData, fetchRecommendations]);

  useEffect(() => {
    if (from && to && trainNo && date && seatData) {
      fetchRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences]);

  const trainName = storeTrainName || trainNo;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-animate flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-animate flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-5"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-14 h-14 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full"
          />
          <div className="text-center">
            <p className="text-white font-semibold text-lg">
              {dataMode === "live" ? "Fetching live seat data..." : "Generating seat data..."}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {dataMode === "live"
                ? "Scraping vacancy from TrainChart.in"
                : "Loading mock data for demonstration"}
            </p>
          </div>
          {dataMode === "live" && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              This may take a few seconds
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-animate flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center"
        >
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">
            {dataMode === "live" ? "Live Data Unavailable" : "Data Error"}
          </h2>
          <p className="text-gray-400 text-sm mb-1">{error}</p>
          {dataMode === "live" && (
            <p className="text-gray-500 text-xs mb-4">
              Tip: Try switching to Mock mode for demo data, or try a different train/date.
            </p>
          )}

          <div className="flex flex-col gap-3 mt-4">
            <button
              onClick={() => {
                fetchData();
                fetchRecommendations();
              }}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all active:scale-95"
            >
              🔄 Retry
            </button>
            {dataMode === "live" && (
              <button
                onClick={() => {
                  setDataMode("mock");
                  setTimeout(() => {
                    fetchData();
                    fetchRecommendations();
                  }, 100);
                }}
                className="w-full py-3 bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium rounded-xl hover:bg-purple-500/30 transition-all"
              >
                🎭 Switch to Mock Data
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 bg-white/5 text-gray-300 font-medium rounded-xl hover:bg-white/10 transition-all"
            >
              ← Back to Search
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-animate">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center text-xs font-bold text-white">
              SM
            </div>
            <span className="text-sm font-semibold text-white">
              Seat<span className="text-cyan-400">Matrix</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Data source badge */}
          {dataSource === "live" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Live Data</span>
            </motion.div>
          )}
          {dataSource === "mock" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/30 rounded-full px-3 py-1"
            >
              <span className="text-xs font-medium text-purple-400">🎭 Mock Data</span>
            </motion.div>
          )}
          <SharePlan />
          <DarkModeToggle />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Journey Summary */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h1 className="text-xl font-bold text-white">
                {trainName}
                <span className="text-sm font-normal text-gray-400 ml-2">#{trainNo}</span>
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                {from} → {to}
                <span className="mx-2 text-gray-600">•</span>
                {date}
              </p>
              <div className="flex items-center gap-3 mt-1">
                {fetchedAt && (
                  <p className="text-[10px] text-gray-500">
                    Fetched: {fetchedAt.includes(",") ? fetchedAt.split(", ")[1] : fetchedAt}
                  </p>
                )}
                {chartPrepTime && (
                  <p className="text-[10px] text-amber-400/70">
                    📋 Chart prepared: {chartPrepTime}
                  </p>
                )}
              </div>
            </div>
            {coachStats && Object.keys(coachStats).length > 0 && (
              <div className="flex gap-4 flex-wrap">
                {Object.entries(coachStats).map(([id, cs]) => (
                  <div key={id} className="text-center">
                    <div className="text-xs text-gray-500 uppercase">{id}</div>
                    <div className="text-lg font-bold text-emerald-400">{cs.stats.available}</div>
                    <div className="text-[10px] text-gray-500">available</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Route Timeline */}
          {from && to && (
            <RouteTimeline
              from={from}
              to={to}
              segmentIndices={segmentIndices}
            />
          )}
        </motion.section>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Seat Map - 2 cols */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="w-1.5 h-5 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
                Seat Map
              </h2>
              <CoachSelector />
            </div>
            <SeatMap />
          </motion.section>

          {/* Sidebar - 1 col */}
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Filters */}
            <Filters />

            {/* Recommendations */}
            <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <span className="w-1.5 h-5 bg-gradient-to-b from-emerald-400 to-cyan-500 rounded-full" />
                Smart Recommendations
              </h2>
              <Recommendations />
            </div>
          </motion.aside>
        </div>
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-animate flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
