<div align="center">

# 🚆 SeatMatrix

**Smart Indian Railways Seat Vacancy Visualizer & Multi-Seat Journey Planner**

Find vacant seats, plan multi-seat journeys, and never miss a booking opportunity.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## What is SeatMatrix?

SeatMatrix fetches **live train reservation chart data** from Indian Railways and visualizes seat vacancy across every coach and station segment — so you can spot available seats at a glance.

**The killer feature:** When no single seat is free for your entire journey, SeatMatrix finds **multi-seat switching combinations** — e.g., Seat 21 from Delhi→Kanpur, then Seat 45 from Kanpur→Allahabad — to cover your entire trip by switching seats at intermediate stations.

## ✨ Features

- 🔍 **Live Train Search** — Autocomplete train numbers with real-time search
- 📡 **Live Vacancy Data** — Fetches real chart data from TrainChart.in API
- 🗺️ **Interactive Seat Maps** — Color-coded vacancy grid per coach per station segment
- 🔄 **Multi-Seat Journey Planner** — Finds optimal seat-switching combinations when no single seat covers the full journey
- 🚃 **Cross-Coach Travel Plans** — Recommends plans across different coaches
- 📊 **Coverage Analysis** — Shows percentage of journey covered by each plan
- 🎭 **Mock Mode** — Offline demo mode with generated data for testing
- 🌗 **Dark Mode** — Beautiful dark-first design with glassmorphism

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **State Management** | Zustand |
| **Styling** | Tailwind CSS 4 |
| **Animations** | Framer Motion |
| **Data Source** | TrainChart.in public API |
| **Deployment** | Vercel / Cloudflare Pages / any Node.js host |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/seatmatrix.git
cd seatmatrix
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Usage

1. **Type a train number** (e.g., `12301`) — autocomplete suggestions appear
2. **Select your train** — station list loads automatically
3. **Pick From/To stations** and a **date** with a prepared chart
4. **Hit "Check Smart Availability"** — vacancy data loads for every coach
5. **Browse the Seat Map** — green = free, red = booked, yellow = partially free
6. **Check Recommendations** — multi-seat journey plans with coverage %

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── mock-seats/          # Seat data endpoint (mock + live)
│   │   ├── recommend/           # Journey planner endpoint
│   │   ├── train-search/        # Train autocomplete proxy
│   │   └── train-details/       # Station list proxy
│   ├── results/page.tsx         # Results dashboard
│   └── page.tsx                 # Homepage with search
├── components/
│   ├── SearchForm.tsx           # Autocomplete search form
│   ├── SeatMap.tsx              # Interactive vacancy grid
│   ├── CoachSelector.tsx        # Coach tab selector
│   ├── Recommendations.tsx      # Journey plan cards
│   ├── RouteTimeline.tsx        # Station route visualization
│   ├── Filters.tsx              # Preference filters (berth, group size)
│   └── SharePlan.tsx            # Copy/share journey plans
├── lib/
│   ├── trainchartScraper.ts     # TrainChart.in API client
│   ├── seatDataProvider.ts      # Data source abstraction
│   ├── recommendationEngine.ts  # Multi-seat journey planner
│   ├── seatLogic.ts             # Seat classification utilities
│   ├── mockDataGenerator.ts     # Demo data generator
│   └── constants.ts             # Types & constants
└── store/
    └── useStore.ts              # Zustand global state
```

## 🧠 How the Multi-Seat Journey Planner Works

When no single seat is available for your entire journey (A → F), the engine finds **seat-switching combinations**:

```
Example: Journey from A → F (5 segments)

Seat 21 (Coach S1): FREE  from A → C  ████░░░░░░
Seat 45 (Coach S1): FREE  from C → E  ░░░░████░░
Seat 12 (Coach S2): FREE  from E → F  ░░░░░░░░██

Plan: Sit in Seat 21 (A→C), switch to Seat 45 (C→E), switch to Seat 12 (E→F)
Coverage: 100% ✅ | 2 seat switches | 1 coach change
```

The engine uses a **multi-phase search strategy**:

| Phase | Strategy | Description |
|-------|----------|-------------|
| 1 | Single Seat | Find seats free for the entire journey |
| 2 | 2-Seat Split (Same Coach) | Try every split point within each coach |
| 3 | 2-Seat Split (Cross-Coach) | Split across different coaches |
| 4 | 3-Seat Split | For longer journeys with fragmented availability |
| 5 | Greedy Max-Coverage | Best possible partial coverage when full isn't possible |

Plans are ranked by: coverage % → fewest seat changes → same coach preference → berth consistency.

## 📡 API Endpoints Used

SeatMatrix proxies through its own API routes to the TrainChart.in public API:

| Endpoint | Purpose |
|----------|---------|
| `/api/train-search?q=123` | Train number autocomplete |
| `/api/train-details?train_no=12301` | Station list for a train |
| `/api/mock-seats?train_no=...&date=...&from=...&to=...&mode=live` | Seat vacancy data |
| `/api/recommend` (POST) | Multi-seat journey recommendations |

> **Note:** Chart data is only available after Indian Railways prepares the reservation chart (typically 4-6 hours before departure).

## 🚀 Deployment

The app is fully compatible with **Vercel** (zero-config):

```bash
npm run build   # Verify build passes
vercel deploy   # Deploy to Vercel
```

Also works on Netlify, Cloudflare Pages, Railway, or any Node.js host.

## 📝 License

MIT — This project is for educational purposes. Train data is sourced from publicly available APIs.

---

<div align="center">
  <sub>Built with ❤️ for Indian Railways travelers</sub>
</div>
