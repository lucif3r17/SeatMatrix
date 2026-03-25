"use client";

import SearchForm from "@/components/SearchForm";
import DarkModeToggle from "@/components/DarkModeToggle";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-animate flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-animate relative">
      {/* Ambient glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-cyan-500/20">
            SM
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">
            Seat<span className="text-cyan-400">Matrix</span>
          </span>
        </div>
        <DarkModeToggle />
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 pt-16 pb-24">
        {/* Train track animation */}
        <div className="w-full max-w-2xl mb-12 relative h-12 overflow-hidden">
          {/* Track */}
          <div className="absolute bottom-2 left-0 right-0 flex items-center">
            <div className="w-full h-0.5 bg-gray-700/50" />
            {/* Track ties */}
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-0.5 h-2 bg-gray-700/30"
                style={{ left: `${(i / 30) * 100}%`, bottom: "-2px" }}
              />
            ))}
          </div>
          {/* Train */}
          <div className="train-animate absolute bottom-1">
            <div className="flex items-end gap-0.5">
              <div className="w-8 h-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-t-lg rounded-r-sm" />
              <div className="w-5 h-3 bg-cyan-600/80 rounded-t-sm" />
              <div className="w-5 h-3 bg-cyan-600/60 rounded-t-sm" />
              <div className="w-5 h-3 bg-cyan-600/40 rounded-t-sm" />
            </div>
          </div>
        </div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-10"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
            Seat
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Matrix
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed">
            Intelligent seat availability visualization &amp; optimization for Indian Railways
          </p>
        </motion.div>

        {/* Feature badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {[
            { icon: "🗺️", text: "Interactive Seat Maps" },
            { icon: "🧠", text: "Smart Seat Finder" },
            { icon: "🔄", text: "Cross-Coach Travel Plans" },
            { icon: "📡", text: "Live TrainChart.in Data" },
          ].map((badge) => (
            <div
              key={badge.text}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-gray-300"
            >
              <span>{badge.icon}</span>
              <span>{badge.text}</span>
            </div>
          ))}
        </motion.div>

        {/* Search Form */}
        <SearchForm />

        {/* Bottom info */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs text-gray-600 mt-8 text-center"
        >
          Toggle between mock demo data &amp; live TrainChart.in vacancy data
        </motion.p>
      </main>
    </div>
  );
}
