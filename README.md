# 🏏 IPL Auction Arena 2026 - Autonomous Real-time Multiplayer Platform

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yuvarajsuri673/ipl-auction-arena-2026)
[![Tests Passing](https://img.shields.io/badge/Acceptance%20Tests-17%2F17%20Passed-10b981.svg)](file:///test/acceptance_test.js)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](file:///package.json)

A full-stack, autonomous real-time multiplayer IPL Auction web application built with **pure Node.js**, **Web Audio synthesis**, and **Server-Sent Events (SSE)**. Pre-loaded with the complete **250-player pool** from the official IPL 2026 dataset.

---

## 🌟 Core Highlights & Non-Negotiable Specifications

1. **Autonomous Server-Driven Auction Engine**:
   - The Admin creates the room, participants join, each selects a franchise, the Admin configures the rules (Purse, Squad size, Overseas limit, Increments, Timer), and clicks **START AUCTION**.
   - **After that, the system does everything**:
     - Presents players automatically on the podium.
     - Opens bidding and manages the countdown timer.
     - Accepts sequential bids in real-time.
     - Declares **SOLD** (with purse deduction & squad addition) or **UNSOLD**.
     - Intermission countdown shows winning franchise and price.
     - Smoothly transitions to the next player automatically.
     - Automatically completes the auction when all lots are processed!
   - **Browser-Independent Server Process**: Even if the Admin closes their laptop or temporarily loses connection, the server continues the countdown and finalizes SOLD/UNSOLD decisions reliably.

2. **Clean, Uncluttered Dashboard Layout ("Do Not Overcrowd")**:
   - **Left Board**: All 10 IPL Franchises (CSK, MI, RCB, KKR, RR, SRH, DC, PBKS, GT, LSG) visible to everyone with real-time purse balances and squad counts.
   - **Center Stage**: The Player Podium focal point with player rating, role, 2026 season stats, base price, animated radial countdown timer, and big high-contrast bid button.
   - **Right Side Tabbed Utilities**:
     - ⚡ **Live Commentary Feed**: Real-time bid log and gavel announcements.
     - 📝 **Private Strategy Notes**: 100% private per user, persists across browser refreshes and reconnects in `localStorage`, complete with live budget & reserve calculator.
     - 📊 **Auction Analytics**: Processed lots progress bar, total tournament spend, and leaderboard of highest player buys.

3. **Strict Official IPL Budget & Roster Regulations**:
   - Default Starting Purse: **₹100.00 Cr** (Host-configurable to ₹120 Cr, ₹90 Cr, etc.)
   - Squad Size Limits: **18 Minimum - 25 Maximum**
   - Overseas Player Limit: Maximum **8 Overseas Players** per franchise
   - **Reserve Purse Protection**: Mathematically locks the minimum required reserve (`remaining slots needed × ₹0.20 Cr`) so no team can bid themselves into an invalid roster!
   - Concurrent Bid Protection: Simultaneous bids are processed strictly sequentially. Old bids are rejected with instantaneous UI feedback.

---

## 🧪 Comprehensive Acceptance Test Suite (17 / 17 Passed)

To run the automated acceptance test suite:
```bash
npm test
```

| Test # | Acceptance Test Case | Status |
|---|---|---|
| **TEST 1** | Admin creates a room and shares invitation link | ✅ **PASSED** |
| **TEST 2** | Multiple real participants join using link | ✅ **PASSED** |
| **TEST 3** | Each participant selects exactly one available franchise | ✅ **PASSED** |
| **TEST 4** | Admin configures purse, squad size, overseas limit, increments, and timer | ✅ **PASSED** |
| **TEST 5** | Admin starts the auction | ✅ **PASSED** |
| **TEST 6** | The first player appears automatically and bidding starts | ✅ **PASSED** |
| **TEST 7** | A participant bids and everyone sees updated highest bid | ✅ **PASSED** |
| **TEST 8** | Timer expires with highest bidder; player automatically SOLD | ✅ **PASSED** |
| **TEST 9** | Winning franchise's purse and squad update for everyone | ✅ **PASSED** |
| **TEST 10** | A player receives no bids; player automatically UNSOLD | ✅ **PASSED** |
| **TEST 11** | Next player appears automatically | ✅ **PASSED** |
| **TEST 12** | Franchise at overseas limit cannot bid for overseas player | ✅ **PASSED** |
| **TEST 13** | Franchise at maximum squad size (25) cannot place additional bids | ✅ **PASSED** |
| **TEST 14** | Participant refreshes browser and recovers correct auction state | ✅ **PASSED** |
| **TEST 15** | Two participants bid simultaneously; only valid sequential bids accepted | ✅ **PASSED** |
| **TEST 16** | Strategy notes remain private and persist after reconnecting | ✅ **PASSED** |
| **TEST 17** | Final player processed and auction completes automatically | ✅ **PASSED** |

---

## 🚀 Instant Deployment to Free Websites

### Option A: 1-Click Deploy to Render (Recommended Free Web Service)
1. Fork or push to your GitHub account:
   [https://github.com/yuvarajsuri673/ipl-auction-arena-2026](https://github.com/yuvarajsuri673/ipl-auction-arena-2026)
2. Click the **Deploy to Render** button above or link your repo at [render.com](https://render.com).
3. Render automatically reads [`render.yaml`](file:///render.yaml), builds, and hosts the persistent Node.js SSE web service with free HTTPS.

### Option B: Run Locally or on Any VPS
```bash
git clone https://github.com/yuvarajsuri673/ipl-auction-arena-2026.git
cd ipl-auction-arena-2026
npm install
npm start
```
Open **`http://localhost:3000`** in any web browser.

---

## 👥 How to Play in Multiplayer
1. Open the app as Host and click **"Create Auction Room"**.
2. Click **"Copy Invite Link"** and send it to your friends.
3. Friends open the link, enter their name, and choose their IPL franchise.
4. Host clicks **"START AUCTION NOW"**.
5. The autonomous engine takes over and orchestrates the entire live mega auction!
