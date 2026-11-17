# 🏏 IPL Auction Arena 2026 — Professional Real-Time Bidding Platform

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yuvarajsuri673/ipl-auction-arena-2026)

IPL Auction Arena 2026 is a professional, mobile-first, real-time multiplayer cricket bidding platform built for 10 IPL franchises with **Strictly Human Participants Only (Zero AI Bots)**.

---

## 🌟 Key Features

### 1. Strictly Human Participants Only (Zero AI Bots)
- **No AI bots or automated computer bidders**: Only real human managers can claim and operate franchises.
- **Unclaimed Team Protection**: Any franchise without a real human manager remains safely marked as **Available**.
- **Protected Ownership**: Disconnections do not transfer franchises to bots; reconnecting managers instantly resume control.

### 2. Reference-Matched Modern Sports UI/UX
- **Design System**: Deep obsidian black surfaces (`#0d0f15`, `#171a24`), vibrant orange CTAs (`#ff6b00`), electric purple timer badges (`#a855f7`), and emerald green currency metrics (`#22c55e`).
- **Team Circle Grid**: 5x2 circular franchise badges with official team colors (MI, CSK, RCB, KKR, DC, PBKS, RR, SRH, GT, LSG) and active glowing orange borders.
- **Both Light & Dark Modes**: Fully designed obsidian dark theme and clean white light theme with instant persistent switching.

### 3. Focused Live Bidding Screen
- **Desktop 3-Column Layout**:
  - **Left**: 10 Franchises list with prominent remaining purse, squad count, and eligibility.
  - **Center (Visual Priority)**: Current player podium, photo/rating, 3 separate prices (*Base Price*, *Current Bid*, *Next Valid Bid*), countdown timer, and large single `[ PLACE BID — ₹X.XX Cr ]` button.
  - **Right**: Real-time gavel activity feed with highlighted latest bids.
- **Mobile-First Layout**: Center bidding podium occupies full view with zero horizontal scrolling; mobile segmented pills enable one-thumb inspection of Teams and Activity.

### 4. Admin Lifecycle Controls
- **Start Auction**: Confirmation summary modal displaying manager count, starting purse, squad limits, and timer before locking config.
- **Pause Auction**: Freezes countdown, halts incoming bids, preserves active lot and timer across all participants.
- **Resume Auction**: Resumes countdown from exact second, restores bidding.
- **Stop Auction**: Safely halts active bidding, preserves completed purchases and state.
- **End Auction**: Permanently concludes auction, compiles final results and leaderboard.
- **Unsold Round**: Optional final round bringing unsold players back for a second chance.

### 5. 7 Dedicated Navigation Sections
1. **Dashboard**: Tournament progress, active lot spotlight, franchise leaderboard.
2. **Live Auction**: Compact room lobby with chat & 3-column live bidding podium.
3. **Teams & Squads**: 10 franchise cards with View Squad modal organized into 4 cricket roles (*Batters, Wicketkeepers, All-rounders, Bowlers*).
4. **Players**: 250 real players from CSV with search, filters (role, nationality, overseas, status), and Admin pre-auction price editor.
5. **Auction Results**: Chronological gavel decisions, hammer prices, winning franchises.
6. **My Strategy Notes**: 100% private to each user, auto-saved in `localStorage`, live budget & reserve calculator.
7. **Settings**: Voice assistant toggle (default OFF), sound effects, theme switcher, and admin control panel.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)

### Installation
```bash
git clone https://github.com/yuvarajsuri673/ipl-auction-arena-2026.git
cd ipl-auction-arena-2026
npm install
```

### Running Locally
```bash
npm start
# Server starts on http://localhost:3000
```

### Running Tests
```bash
npm test
# Runs 17 / 17 Acceptance Tests + HTTP Network Integration Tests
```

---

## 📋 Standardised Pricing & Increments

### Base Price Range
- Minimum: ₹75 Lakhs (₹0.75 Cr)
- Maximum: ₹2.00 Crore
- Derived strictly from real ratings, roles, and stats across the 250-player CSV.

### Bidding Increments
| Current Bid Range | Mandatory Increment |
|---|---|
| ₹75 Lakhs – below ₹2.00 Cr | **+₹10 Lakhs (0.10 Cr)** |
| ₹2.00 Cr – below ₹5.00 Cr | **+₹25 Lakhs (0.25 Cr)** |
| ₹5.00 Cr – below ₹10.00 Cr | **+₹50 Lakhs (0.50 Cr)** |
| ₹10.00 Cr and above | **+₹1.00 Crore (1.00 Cr)** |

---

## 🛡️ Acceptance Test Suite
All 17 acceptance requirements are validated:
```
========================================================
🎉 ALL 17 / 17 ACCEPTANCE TESTS PASSED SUCCESSFULLY!
========================================================
🌐 Testing Real HTTP Network Endpoints...
  ✓ POST /api/room/create works
  ✓ POST /api/room/join works
  ✓ POST /api/room/claim-team works
  ✓ POST /api/room/update-config works
  ✓ POST /api/room/start-auction works
  ✓ GET /api/state returns live auction snapshot
  ✓ POST /api/room/bid processes live bids
🎉 ALL HTTP NETWORK TESTS PASSED!
```
