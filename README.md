# 🏏 IPL Auction Arena 2026 - Real-time Multiplayer Platform

A full-stack, real-time multiplayer IPL Auction web platform built with pure Node.js, Web Audio synthesis, and Server-Sent Events (SSE). Pre-loaded with the full **250-player pool** from `IPL_Auction_Arena_2026_Player_Pool_250_Antigravity.csv`.

---

## 🌟 Key Features

1. **All 10 Real IPL 2026 Franchises**:
   - 🟡 **CSK** (Chennai Super Kings)
   - 🔵 **MI** (Mumbai Indians)
   - 🔴 **RCB** (Royal Challengers Bengaluru)
   - 🟣 **KKR** (Kolkata Knight Riders)
   - 💗 **RR** (Rajasthan Royals)
   - 🟠 **SRH** (Sunrisers Hyderabad)
   - 🔴 **DC** (Delhi Capitals)
   - 🔵 **LSG** (Lucknow Super Giants)
   - 🔵 **GT** (Gujarat Titans)
   - 🔴 **PBKS** (Punjab Kings)

2. **Real IPL Auction Rules & Budget Constraints**:
   - Starting Purse: **₹100.00 Cr** per franchise (customizable)
   - Squad Size Limits: Minimum **18 players**, Maximum **25 players**
   - Overseas Limit: Maximum **8 overseas players** per team
   - **Automated Reserve Purse Protection**: Prevents a team from overspending so they always retain sufficient purse to satisfy the mandatory 18-player IPL minimum roster rule!
   - Real-time Bid Increments: Dynamic increments (+₹10L, +₹20L, +₹25L, +₹50L, +₹1.0Cr) based on bid tier.

3. **Intelligent AI Bidding Bots**:
   - Any unclaimed franchise can run with autonomous AI bots.
   - The AI evaluates player ratings, team role needs (Batters, Bowlers, Wicketkeepers, All-rounders), overseas limits, and available purse.
   - Features natural, human-like reaction delays to simulate real bidders in the auction room!

4. **Auctioneer Podium & Countdown Clock**:
   - 15-second radial countdown timer.
   - Stage announcements: *Bidding Open* ➔ *Going Once...* ➔ *Going Twice...* ➔ *SOLD!* (or *UNSOLD!*).
   - Anti-sniping grace period: bids in final seconds reset the clock to ensure fair competition.

5. **Pure Web Audio API Sound Effects (Zero External MP3s)**:
   - Realistic wooden gavel strike on sold/unsold.
   - Crisp harmonic chime on new bids.
   - Ticking tension heartbeat on final countdown.
   - Stadium fanfare upon player purchase.
   - Browser text-to-speech voice announcer.

6. **250-Player Explorer & Squad Analyzer**:
   - Instant search and role filters across the full 250 player pool.
   - Displays 2026 leaderboard stats (Runs, Strike Rate, Wickets, Economy) and overall ratings.
   - Detailed franchise squad modal with player costs, overseas count, and playing XI rating.

---

## 🚀 How to Run

### Method 1: Double-Click (Windows)
Double-click [`start.bat`](file:///c:/Users/kvk47/Desktop/ipl/start.bat) in this folder. It opens your browser to `http://localhost:3000` automatically!

### Method 2: Command Line
Open your terminal in `c:\Users\kvk47\Desktop\ipl` and run:
```bash
npm start
```
or
```bash
node server.js
```

Then open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 👥 How to Play with Friends (Multiplayer)

1. **On the Same Computer**: Open multiple browser tabs (or an incognito tab). Each tab can claim a different franchise (e.g. Tab 1 = CSK, Tab 2 = MI, Tab 3 = RCB).
2. **On the Same Wi-Fi Network**: Find your computer's local IP address (run `ipconfig` in cmd), and your friends can open `http://<YOUR_IP>:3000` on their laptops or smartphones!
3. **Auctioneer Controls**: Click **"Host Mode"** in the top navigation bar to access Auctioneer controls (Call Next Player, Start Bidding Clock, Drop Hammer, Reset Room).
