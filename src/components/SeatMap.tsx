"use client";

import { useStore } from "@/store/useStore";
import { BERTH_LABELS, type AvailabilityStatus } from "@/lib/constants";
import { getSeatSegmentBreakdown } from "@/lib/seatLogic";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const STATUS_COLORS: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-500/80 border-emerald-400 shadow-emerald-500/20",
  partial: "bg-amber-500/80 border-amber-400 shadow-amber-500/20",
  unavailable: "bg-rose-500/60 border-rose-500/40 shadow-rose-500/10",
};

const STATUS_HOVER_COLORS: Record<AvailabilityStatus, string> = {
  available: "hover:bg-emerald-400 hover:shadow-emerald-400/40",
  partial: "hover:bg-amber-400 hover:shadow-amber-400/40",
  unavailable: "hover:bg-rose-400/70 hover:shadow-rose-400/20",
};

export default function SeatMap() {
  const {
    selectedCoach, coachStats, seatData, segmentIndices,
    selectedSeat, setSelectedSeat, highlightedSeats,
    from, to, stations,
  } = useStore();
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const stats = coachStats[selectedCoach];
  if (!stats || !seatData) {
    return (
      <div className="text-gray-400 text-center py-12">
        No seat data available. Please search first.
      </div>
    );
  }

  const seats = stats.seats;
  const coachData = seatData[selectedCoach];

  // Group seats into bays of 8
  const bays: typeof seats[] = [];
  for (let i = 0; i < seats.length; i += 8) {
    bays.push(seats.slice(i, i + 8));
  }

  const handleHover = (seatNumber: string, e: React.MouseEvent) => {
    setHoveredSeat(seatNumber);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
  };

  const isHighlighted = (seatNumber: string) =>
    highlightedSeats.has(`${selectedCoach}-${seatNumber}`);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500/80 border border-emerald-400" />
          <span className="text-gray-300">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500/80 border border-amber-400" />
          <span className="text-gray-300">Partial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-rose-500/60 border border-rose-500/40" />
          <span className="text-gray-300">Occupied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500/80 border border-blue-400 ring-2 ring-blue-400/50" />
          <span className="text-gray-300">Recommended</span>
        </div>
      </div>

      {/* Coach Layout */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Coach header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
            <div className="w-3 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
            <span className="text-sm font-semibold text-white">{selectedCoach}</span>
            <span className="text-xs text-gray-400">
              {stats.stats.available} available / {stats.stats.total} total
            </span>
          </div>

          {/* Bays */}
          <div className="space-y-3">
            {bays.map((bay, bayIdx) => {
              // Layout: 3 main berths (left) | aisle | 3 main berths (right) | side berths
              const mainLeft = bay.slice(0, 3); // LB, MB, UB
              const mainRight = bay.slice(3, 6); // LB, MB, UB
              const side = bay.slice(6, 8); // SL, SU

              return (
                <motion.div
                  key={bayIdx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: bayIdx * 0.03 }}
                  className="flex items-center gap-2"
                >
                  {/* Bay number */}
                  <div className="w-8 text-xs text-gray-500 text-right shrink-0">
                    {bayIdx + 1}
                  </div>

                  {/* Main berths - left column */}
                  <div className="flex flex-col gap-1">
                    {mainLeft.map((seat) => (
                      <SeatCell
                        key={seat.seatNumber}
                        seatNumber={seat.seatNumber}
                        berth={seat.seat.berth}
                        status={seat.status}
                        isHighlighted={isHighlighted(seat.seatNumber)}
                        isSelected={selectedSeat === seat.seatNumber}
                        isHovered={hoveredSeat === seat.seatNumber}
                        onHover={(e) => handleHover(seat.seatNumber, e)}
                        onLeave={() => setHoveredSeat(null)}
                        onClick={() =>
                          setSelectedSeat(
                            selectedSeat === seat.seatNumber ? null : seat.seatNumber
                          )
                        }
                      />
                    ))}
                  </div>

                  {/* Aisle */}
                  <div className="w-8 flex items-center justify-center">
                    <div className="w-0.5 h-16 bg-gray-700/50 rounded-full" />
                  </div>

                  {/* Main berths - right column */}
                  <div className="flex flex-col gap-1">
                    {mainRight.map((seat) => (
                      <SeatCell
                        key={seat.seatNumber}
                        seatNumber={seat.seatNumber}
                        berth={seat.seat.berth}
                        status={seat.status}
                        isHighlighted={isHighlighted(seat.seatNumber)}
                        isSelected={selectedSeat === seat.seatNumber}
                        isHovered={hoveredSeat === seat.seatNumber}
                        onHover={(e) => handleHover(seat.seatNumber, e)}
                        onLeave={() => setHoveredSeat(null)}
                        onClick={() =>
                          setSelectedSeat(
                            selectedSeat === seat.seatNumber ? null : seat.seatNumber
                          )
                        }
                      />
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-16 bg-gray-700/30 mx-2" />

                  {/* Side berths */}
                  <div className="flex flex-col gap-1">
                    {side.map((seat) => (
                      <SeatCell
                        key={seat.seatNumber}
                        seatNumber={seat.seatNumber}
                        berth={seat.seat.berth}
                        status={seat.status}
                        isHighlighted={isHighlighted(seat.seatNumber)}
                        isSelected={selectedSeat === seat.seatNumber}
                        isHovered={hoveredSeat === seat.seatNumber}
                        onHover={(e) => handleHover(seat.seatNumber, e)}
                        onLeave={() => setHoveredSeat(null)}
                        onClick={() =>
                          setSelectedSeat(
                            selectedSeat === seat.seatNumber ? null : seat.seatNumber
                          )
                        }
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {hoveredSeat && coachData && coachData[hoveredSeat] && (
          <HoverTooltip
            seatNumber={hoveredSeat}
            seat={coachData[hoveredSeat]}
            segmentIndices={segmentIndices}
            position={tooltipPos}
            stations={stations}
          />
        )}
      </AnimatePresence>

      {/* Selected seat detail */}
      <AnimatePresence>
        {selectedSeat && coachData && coachData[selectedSeat] && (
          <SeatDetailPanel
            seatNumber={selectedSeat}
            coachId={selectedCoach}
            seat={coachData[selectedSeat]}
            segmentIndices={segmentIndices}
            stations={stations}
            onClose={() => setSelectedSeat(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SeatCell({
  seatNumber, berth, status, isHighlighted, isSelected, isHovered,
  onHover, onLeave, onClick,
}: {
  seatNumber: string;
  berth: string;
  status: AvailabilityStatus;
  isHighlighted: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (e: React.MouseEvent) => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  return (
    <motion.button
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`
        w-16 h-5 rounded-md border text-[10px] font-mono flex items-center justify-between px-1.5
        cursor-pointer transition-all shadow-sm
        ${isHighlighted
          ? "bg-blue-500/80 border-blue-400 ring-2 ring-blue-400/50 shadow-blue-500/30"
          : STATUS_COLORS[status]
        }
        ${isSelected ? "ring-2 ring-white/60" : ""}
        ${isHovered ? "z-10" : ""}
        ${!isHighlighted ? STATUS_HOVER_COLORS[status] : "hover:bg-blue-400"}
      `}
    >
      <span className="text-white/90 font-semibold">{seatNumber}</span>
      <span className="text-white/60">{berth}</span>
    </motion.button>
  );
}

function HoverTooltip({
  seatNumber, seat, segmentIndices, position, stations,
}: {
  seatNumber: string;
  seat: { berth: string; segments: number[] };
  segmentIndices: number[];
  position: { x: number; y: number };
  stations: string[];
}) {
  const breakdown = getSeatSegmentBreakdown(
    seat as import("@/lib/constants").SeatData,
    segmentIndices,
    stations
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="fixed z-50 pointer-events-none"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -100%)" }}
    >
      <div className="bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-lg px-3 py-2 shadow-xl">
        <div className="text-xs font-semibold text-white mb-1">
          Seat {seatNumber} ({BERTH_LABELS[seat.berth as keyof typeof BERTH_LABELS]})
        </div>
        <div className="space-y-0.5">
          {breakdown.map((seg, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${seg.free ? "bg-emerald-400" : "bg-rose-400"}`} />
              <span className="text-gray-300">
                {seg.from} → {seg.to}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function SeatDetailPanel({
  seatNumber, coachId, seat, segmentIndices, stations, onClose,
}: {
  seatNumber: string;
  coachId: string;
  seat: { berth: string; segments: number[] };
  segmentIndices: number[];
  stations: string[];
  onClose: () => void;
}) {
  const breakdown = getSeatSegmentBreakdown(
    seat as import("@/lib/constants").SeatData,
    segmentIndices,
    stations
  );
  const freeSegments = breakdown.filter((s) => s.free).length;
  const totalSegments = breakdown.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">
            Seat {seatNumber} - {coachId}
          </h3>
          <p className="text-sm text-gray-400">
            {BERTH_LABELS[seat.berth as keyof typeof BERTH_LABELS]} •{" "}
            {freeSegments}/{totalSegments} segments available
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Segment bars */}
      <div className="space-y-2">
        {breakdown.map((seg, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-300 font-mono">
                  {seg.from} → {seg.to}
                </span>
                <span className={seg.free ? "text-emerald-400" : "text-rose-400"}>
                  {seg.free ? "Available" : "Occupied"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ delay: i * 0.1 }}
                  className={`h-full rounded-full ${seg.free ? "bg-emerald-500" : "bg-rose-500"}`}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coverage bar */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-xs text-gray-400 mb-2">Journey Coverage</div>
        <div className="h-3 rounded-full bg-gray-700 overflow-hidden flex">
          {breakdown.map((seg, i) => (
            <motion.div
              key={i}
              initial={{ width: 0 }}
              animate={{ width: `${100 / breakdown.length}%` }}
              transition={{ delay: i * 0.1 }}
              className={`h-full ${seg.free ? "bg-emerald-500" : "bg-rose-500"} ${
                i > 0 ? "border-l border-gray-800" : ""
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
