"use client";

import { type SeatPlan } from "@/lib/constants";
import { useStore } from "@/store/useStore";
import { motion } from "framer-motion";

export default function Recommendations() {
  const { recommendations, setHighlightedSeats, setSelectedCoach } = useStore();

  if (recommendations.length === 0) {
    return (
      <div className="text-gray-400 text-center py-8 text-sm">
        No recommendations available yet. Try adjusting your preferences.
      </div>
    );
  }

  // Split by type
  const fullPlans = recommendations.filter((r) => r.planType === "full");
  const partialPlans = recommendations.filter((r) => r.planType === "partial");

  const handleHighlight = (plan: SeatPlan) => {
    const seats = new Set(
      plan.segments.map((s) => `${s.coachId}-${s.seatNumber}`)
    );
    setHighlightedSeats(seats);
    if (plan.segments.length > 0) {
      setSelectedCoach(plan.segments[0].coachId);
    }
  };

  const clearHighlight = () => {
    setHighlightedSeats(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Full coverage plans */}
      {fullPlans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Full Journey Coverage
          </h3>
          <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
            {fullPlans.slice(0, 8).map((plan, idx) => (
              <PlanCard
                key={idx}
                plan={plan}
                rank={idx + 1}
                onHover={() => handleHighlight(plan)}
                onLeave={clearHighlight}
              />
            ))}
          </div>
        </div>
      )}

      {/* No full coverage warning */}
      {fullPlans.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <h4 className="text-sm font-semibold text-amber-400 mb-1">
                No Full Journey Seats Available
              </h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                All seats are occupied on at least one segment of your journey.
                Below are the <strong className="text-white">best partial coverage plans</strong> that
                maximize your journey coverage with optimal seat arrangements.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Partial coverage plans */}
      {partialPlans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            {fullPlans.length > 0 ? "Alternative Plans" : "Best Partial Coverage Plans"}
          </h3>
          <div className="grid gap-2 max-h-96 overflow-y-auto pr-1">
            {partialPlans.slice(0, 10).map((plan, idx) => (
              <PlanCard
                key={idx}
                plan={plan}
                rank={fullPlans.length + idx + 1}
                onHover={() => handleHighlight(plan)}
                onLeave={clearHighlight}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan, rank, onHover, onLeave,
}: {
  plan: SeatPlan;
  rank: number;
  onHover: () => void;
  onLeave: () => void;
}) {
  const isFull = plan.planType === "full";
  const coverageColor = plan.coveragePercent >= 80 ? "text-emerald-400" :
    plan.coveragePercent >= 50 ? "text-amber-400" : "text-rose-400";
  const coverageBg = plan.coveragePercent >= 80 ? "bg-emerald-500" :
    plan.coveragePercent >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`
        p-3 rounded-xl border cursor-pointer transition-all
        ${isFull
          ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/40"
          : "bg-white/[0.02] border-white/10 hover:bg-white/5 hover:border-white/20"
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              isFull
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/10 text-gray-400"
            }`}
          >
            {rank}
          </span>
          <div className="space-y-1.5">
            {/* Coverage badge */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold ${coverageColor}`}>
                {plan.coveragePercent}% coverage
              </span>
              <span className="text-[10px] text-gray-500">
                ({plan.coveredSegments}/{plan.totalSegments} segments)
              </span>
              {isFull && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
                  FULL
                </span>
              )}
              {!isFull && (
                <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                  PARTIAL
                </span>
              )}
            </div>

            {/* Coverage bar */}
            <div className="w-32 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${plan.coveragePercent}%` }}
                transition={{ delay: rank * 0.05, duration: 0.4 }}
                className={`h-full rounded-full ${coverageBg}`}
              />
            </div>

            {/* Seat segments */}
            <div className="flex flex-wrap gap-1.5">
              {plan.segments.map((seg, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs bg-white/5 rounded-md px-2 py-0.5"
                >
                  <span className="text-cyan-400 font-semibold">
                    {seg.coachId}/{seg.seatNumber}
                  </span>
                  <span className="text-gray-400">({seg.berth})</span>
                  <span className="text-gray-500">
                    {seg.fromStation}→{seg.toStation}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {plan.score > 0 && (
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-500">Score</div>
            <div className="text-sm font-bold text-amber-400">{plan.score}</div>
          </div>
        )}
      </div>

      {/* Stats */}
      {plan.seatChanges > 0 && (
        <div className="flex gap-4 mt-2 ml-8 text-[10px] text-gray-400">
          <span>🔄 {plan.seatChanges} switch{plan.seatChanges !== 1 ? "es" : ""}</span>
          {plan.coachChanges > 0 && (
            <span>🚃 {plan.coachChanges} coach change{plan.coachChanges !== 1 ? "s" : ""}</span>
          )}
          {plan.berthTypeChanges > 0 && (
            <span>🛏️ {plan.berthTypeChanges} berth change{plan.berthTypeChanges !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}

      {/* Explanation */}
      <details className="ml-8 mt-1">
        <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
          Why this recommendation?
        </summary>
        <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
          {plan.explanation}
        </p>
      </details>
    </motion.div>
  );
}
