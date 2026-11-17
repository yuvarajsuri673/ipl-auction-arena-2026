const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PLAYERS_FILE = path.join(__dirname, 'data', 'players.json');

// Master List of 10 IPL Franchises (8 Classic + 2 Expansion)
const ALL_FRANCHISES = {
  CSK: { id: 'CSK', name: 'Chennai Super Kings', shortName: 'CSK', color: '#F9CD05', textColor: '#000000', secondaryColor: '#0081E9', logo: '🦁', motto: 'Whistle Podu' },
  MI: { id: 'MI', name: 'Mumbai Indians', shortName: 'MI', color: '#004BA0', textColor: '#FFFFFF', secondaryColor: '#D1AB3E', logo: '🌀', motto: 'Duniya Hila Denge' },
  RCB: { id: 'RCB', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: '#EC1C24', textColor: '#FFFFFF', secondaryColor: '#000000', logo: '👑', motto: 'Ee Sala Cup Namde' },
  KKR: { id: 'KKR', name: 'Kolkata Knight Riders', shortName: 'KKR', color: '#3A225D', textColor: '#FFFFFF', secondaryColor: '#F7D070', logo: '⚔️', motto: 'Korbo Lorbo Jeetbo' },
  RR: { id: 'RR', name: 'Rajasthan Royals', shortName: 'RR', color: '#EA1A85', textColor: '#FFFFFF', secondaryColor: '#254AA5', logo: '👑', motto: 'Halla Bol' },
  SRH: { id: 'SRH', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: '#F26522', textColor: '#FFFFFF', secondaryColor: '#000000', logo: '🦅', motto: 'Orange Army' },
  DC: { id: 'DC', name: 'Delhi Capitals', shortName: 'DC', color: '#00008B', textColor: '#FFFFFF', secondaryColor: '#D71920', logo: '🐯', motto: 'Roar Macha' },
  PBKS: { id: 'PBKS', name: 'Punjab Kings', shortName: 'PBKS', color: '#DD1F2D', textColor: '#FFFFFF', secondaryColor: '#D1AB3E', logo: '🦁', motto: 'Sadda Punjab' },
  GT: { id: 'GT', name: 'Gujarat Titans', shortName: 'GT', color: '#1B2133', textColor: '#FFFFFF', secondaryColor: '#CBA92B', logo: '⚡', motto: 'Aava De' },
  LSG: { id: 'LSG', name: 'Lucknow Super Giants', shortName: 'LSG', color: '#005A9C', textColor: '#FFFFFF', secondaryColor: '#E35205', logo: '🦅', motto: 'Gazab Andaaz' }
};

// 8 Classic franchises
const EIGHT_TEAMS = ['CSK', 'MI', 'RCB', 'KKR', 'RR', 'SRH', 'DC', 'PBKS'];
// 10 Teams
const TEN_TEAMS = ['CSK', 'MI', 'RCB', 'KKR', 'RR', 'SRH', 'DC', 'PBKS', 'GT', 'LSG'];

// Active rooms store
const rooms = {};

// Load 250 players
function loadPlayers() {
  if (fs.existsSync(PLAYERS_FILE)) {
    return JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  }
  return [];
}

// Generate a random room code (e.g. IPL-7892)
function generateRoomCode() {
  return `IPL-${Math.floor(1000 + Math.random() * 9000)}`;
}

// Create a new room
function createRoom(roomId, options = {}) {
  const teamCount = options.teamCount === 8 ? 8 : 10; // Default 10 teams as required
  const teamKeys = teamCount === 8 ? EIGHT_TEAMS : TEN_TEAMS;
  const initialPurse = options.initialPurse !== undefined ? Number(options.initialPurse) : 120.0;
  const hostName = options.hostName || 'Auctioneer';

  const franchises = {};
  for (const code of teamKeys) {
    franchises[code] = {
      ...ALL_FRANCHISES[code],
      user: null, // Connected player name
      userId: null,
      isAi: false, // In lobby, starts as human claimable
      purse: initialPurse,
      spent: 0,
      squad: []
    };
  }

  const players = loadPlayers().map(p => ({
    ...p,
    status: 'Available',
    soldTo: null,
    soldPrice: 0
  }));

  const room = {
    id: roomId,
    name: options.name || `IPL 2026 Mega Auction (${teamCount} Teams)`,
    hostName: hostName,
    hostToken: options.hostToken || `host_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: Date.now(),
    teamCount: teamCount,
    stage: 'lobby', // 'lobby', 'active', 'completed'
    config: {
      teamCount: teamCount,
      initialPurse: initialPurse,
      minSquad: options.minSquad !== undefined ? Number(options.minSquad) : 18,
      maxSquad: options.maxSquad !== undefined ? Number(options.maxSquad) : 25,
      maxOverseas: options.maxOverseas !== undefined ? Number(options.maxOverseas) : 8,
      minReservePrice: options.minReservePrice !== undefined ? Number(options.minReservePrice) : 0.75,
      timerDuration: options.timerDuration !== undefined ? Number(options.timerDuration) : 20,
      bidIncrementRule: options.bidIncrementRule || 'standard',
      unsoldRound: Boolean(options.unsoldRound)
    },
    players: players,
    franchises: franchises,
    auctionHistory: [],
    chatMessages: [],
    auction: {
      status: 'idle', // idle, bidding, going_once, going_twice, sold, unsold, paused, stopped, completed
      currentPlayerIndex: -1,
      currentPlayer: null,
      currentBid: 0,
      currentBidder: null,
      bidHistory: [],
      timer: options.timerDuration !== undefined ? Number(options.timerDuration) : 20,
      timerInterval: null,
      transitionTimeout: null,
      isPaused: false
    },
    activityLog: [
      { id: Date.now(), text: `Room created by ${hostName}. All 10 franchises ready for managers to claim!`, time: new Date().toLocaleTimeString() }
    ],
    clients: new Set()
  };

  rooms[roomId] = room;
  return room;
}

// Standardised Price-Based Increment Structure
// ₹75 Lakhs – ₹1.99 Cr : ₹10 Lakhs (0.10 Cr)
// ₹2 Cr – ₹4.99 Cr     : ₹25 Lakhs (0.25 Cr)
// ₹5 Cr – ₹9.99 Cr     : ₹50 Lakhs (0.50 Cr)
// ₹10 Cr and above     : ₹1 Cr (1.00 Cr)
function getNextBidIncrement(currentBid) {
  if (currentBid < 2.00) return 0.10;
  if (currentBid < 5.00) return 0.25;
  if (currentBid < 10.00) return 0.50;
  return 1.00;
}

// Max bid allowed ensuring mandatory reserve for remaining squad spots up to minSquad
function getMaxAllowedBid(room, franchiseCode) {
  const f = room.franchises[franchiseCode];
  if (!f) return 0;
  const squadCount = f.squad.length;
  if (squadCount >= room.config.maxSquad) return 0;

  const remainingNeeded = Math.max(0, room.config.minSquad - (squadCount + 1));
  const reserveRequired = remainingNeeded * room.config.minReservePrice;
  return Math.max(0, Number((f.purse - reserveRequired).toFixed(2)));
}

// Eligibility check - Strict Human Participants Only
function canFranchiseBid(room, franchiseCode, bidAmount) {
  const f = room.franchises[franchiseCode];
  const p = room.auction.currentPlayer;
  if (!f || !p) return { canBid: false, reason: 'No player on auction podium' };

  // Only real human managers who claimed a participating franchise can bid
  if (!f.user || f.isParticipating === false) {
    return { canBid: false, reason: 'This franchise has no manager or is not participating in the auction.' };
  }

  if (f.squad.length >= room.config.maxSquad) {
    return { canBid: false, reason: `Squad limit reached (${room.config.maxSquad} players max)` };
  }

  if (p.isOverseas) {
    const overseasCount = f.squad.filter(pl => pl.isOverseas).length;
    if (overseasCount >= room.config.maxOverseas) {
      return { canBid: false, reason: `Overseas quota filled (${room.config.maxOverseas} max)` };
    }
  }

  const maxBid = getMaxAllowedBid(room, franchiseCode);
  if (bidAmount > maxBid) {
    return { canBid: false, reason: `Reserve needed for ${room.config.minSquad} players! Max allowed bid: ₹${maxBid.toFixed(2)} Cr` };
  }

  return { canBid: true };
}

// Broadcast SSE event
function broadcast(room, eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of room.clients) {
    try {
      client.write(payload);
    } catch (e) {
      room.clients.delete(client);
    }
  }
}

// Broadcast full room state
function broadcastState(room) {
  const sanitized = getSanitizedRoomState(room);
  broadcast(room, 'state_update', sanitized);
}

// Public state snapshot
function getSanitizedRoomState(room) {
  const claimedCount = Object.values(room.franchises).filter(f => f.user !== null).length;
  const availableCount = room.players.filter(p => p.status === 'Available').length;
  const soldCount = room.players.filter(p => p.status === 'Sold').length;
  const unsoldCount = room.players.filter(p => p.status === 'Unsold').length;

  return {
    id: room.id,
    name: room.name,
    hostName: room.hostName,
    teamCount: room.teamCount,
    stage: room.stage, // 'lobby', 'active', 'completed'
    config: room.config,
    lobby: {
      totalTeams: room.teamCount,
      claimedCount: claimedCount,
      allClaimed: claimedCount === room.teamCount
    },
    stats: {
      total: room.players.length,
      available: availableCount,
      sold: soldCount,
      unsold: unsoldCount,
      totalSpent: Number(Object.values(room.franchises).reduce((acc, f) => acc + f.spent, 0).toFixed(2))
    },
    franchises: room.franchises,
    auction: {
      status: room.auction.status,
      currentPlayerIndex: room.auction.currentPlayerIndex,
      currentPlayer: room.auction.currentPlayer,
      currentBid: room.auction.currentBid,
      currentBidder: room.auction.currentBidder,
      bidHistory: room.auction.bidHistory,
      timer: room.auction.timer,
      isPaused: room.auction.isPaused,
      nextIncrement: getNextBidIncrement(room.auction.currentBid)
    },
    activityLog: room.activityLog.slice(-50),
    chatMessages: (room.chatMessages || []).slice(-50),
    auctionHistory: (room.auctionHistory || []).slice(0, 100)
  };
}

// Clean up room timers
function clearRoomTimers(room) {
  if (room.auction.timerInterval) {
    clearInterval(room.auction.timerInterval);
    room.auction.timerInterval = null;
  }
  if (room.auction.transitionTimeout) {
    clearTimeout(room.auction.transitionTimeout);
    room.auction.transitionTimeout = null;
  }
}

// Start the live auction from lobby
function startAuctionFromLobby(room) {
  clearRoomTimers(room);
  room.stage = 'active';

  // Only claimed teams participate in active bidding; unclaimed teams are dropped
  const claimedFranchises = Object.values(room.franchises).filter(f => f.user !== null);
  for (const [code, f] of Object.entries(room.franchises)) {
    if (claimedFranchises.length > 0) {
      f.isParticipating = (f.user !== null);
    } else {
      f.isParticipating = true;
    }
  }

  const participatingCount = claimedFranchises.length > 0 ? claimedFranchises.length : Object.keys(room.franchises).length;
  const logEntry = {
    id: Date.now(),
    text: `🚀 Auctioneer ${room.hostName} clicked START AUCTION! ${participatingCount} participating franchises active.`,
    time: new Date().toLocaleTimeString()
  };
  room.activityLog.push(logEntry);

  broadcast(room, 'auction_started', {
    message: `The auction has begun with ${participatingCount} participating teams!`,
    participatingCount
  });
  broadcastState(room);

  // Automatically call the first player immediately
  setTimeout(() => {
    if (room.stage === 'active') {
      advanceToNextPlayer(room);
    }
  }, 1000);
}

// Advance to next player automatically
function advanceToNextPlayer(room) {
  clearRoomTimers(room);

  // Check if auction is completed or unsold round can be triggered
  const available = room.players.filter(p => p.status === 'Available');
  if (available.length === 0) {
    if (room.config.unsoldRound && !room.unsoldRoundDone) {
      const unsolds = room.players.filter(p => p.status === 'Unsold');
      if (unsolds.length > 0) {
        room.unsoldRoundDone = true;
        unsolds.forEach(p => { p.status = 'Available'; });
        const logEntry = {
          id: Date.now(),
          text: `🔄 Final Unsold Round Started! ${unsolds.length} unsold players returned to the auction pool.`,
          time: new Date().toLocaleTimeString()
        };
        room.activityLog.push(logEntry);
        broadcast(room, 'unsold_round_started', { count: unsolds.length });
        advanceToNextPlayer(room);
        return;
      }
    }
    completeAuction(room);
    return;
  }

  // Check if all active participating franchises have full squads
  const participatingFranchises = Object.values(room.franchises).filter(f => f.isParticipating !== false && f.user !== null);
  if (participatingFranchises.length > 0 && participatingFranchises.every(f => f.squad.length >= room.config.maxSquad)) {
    completeAuction(room);
    return;
  }

  // Select next player in pool order
  const nextPlayer = available[0];
  const playerIndex = room.players.findIndex(p => p.id === nextPlayer.id);

  room.auction.currentPlayerIndex = playerIndex;
  room.auction.currentPlayer = nextPlayer;
  room.auction.currentBid = nextPlayer.basePrice;
  room.auction.currentBidder = null;
  room.auction.bidHistory = [];
  room.auction.timer = room.config.timerDuration;
  room.auction.status = 'bidding';
  room.auction.isPaused = false;

  const logEntry = {
    id: Date.now(),
    text: `📢 LOT #${playerIndex + 1}: ${nextPlayer.name} (${nextPlayer.role}, ${nextPlayer.nationality}) | Base: ₹${nextPlayer.basePrice.toFixed(2)} Cr`,
    time: new Date().toLocaleTimeString()
  };
  room.activityLog.push(logEntry);

  broadcast(room, 'player_selected', { player: nextPlayer });
  broadcastState(room);

  // Start independent countdown clock on server
  runBiddingTimer(room);
}

// Run the server-side countdown clock
function runBiddingTimer(room) {
  if (room.auction.timerInterval) {
    clearInterval(room.auction.timerInterval);
  }

  room.auction.timerInterval = setInterval(() => {
    if (room.auction.isPaused || room.auction.status === 'paused') {
      return;
    }

    room.auction.timer--;

    if (room.auction.timer === 8 && room.auction.status === 'bidding') {
      room.auction.status = 'going_once';
      broadcast(room, 'auction_phase', { phase: 'going_once', message: 'Going once...' });
    } else if (room.auction.timer === 4 && (room.auction.status === 'bidding' || room.auction.status === 'going_once')) {
      room.auction.status = 'going_twice';
      broadcast(room, 'auction_phase', { phase: 'going_twice', message: 'Going twice... Final call!' });
    } else if (room.auction.timer <= 0) {
      clearInterval(room.auction.timerInterval);
      room.auction.timerInterval = null;
      resolveCurrentLot(room);
      return;
    }

    broadcast(room, 'timer_tick', { timer: room.auction.timer, status: room.auction.status });
  }, 1000);
}

// Finalize the current player (SOLD or UNSOLD) and auto-advance
function resolveCurrentLot(room) {
  clearRoomTimers(room);

  const player = room.auction.currentPlayer;
  if (!player) return;

  if (room.auction.currentBidder) {
    const winnerCode = room.auction.currentBidder;
    const finalPrice = room.auction.currentBid;
    const franchise = room.franchises[winnerCode];

    player.status = 'Sold';
    player.soldTo = winnerCode;
    player.soldPrice = finalPrice;

    franchise.purse = Number((franchise.purse - finalPrice).toFixed(2));
    franchise.spent = Number((franchise.spent + finalPrice).toFixed(2));
    franchise.squad.push({
      ...player,
      boughtPrice: finalPrice
    });

    room.auction.status = 'sold';

    const logEntry = {
      id: Date.now(),
      text: `🔨 SOLD! ${player.name} is SOLD to ${franchise.name} for ₹${finalPrice.toFixed(2)} Cr!`,
      time: new Date().toLocaleTimeString()
    };
    room.activityLog.push(logEntry);

    broadcast(room, 'player_sold', {
      player: player,
      franchise: winnerCode,
      franchiseName: franchise.name,
      price: finalPrice,
      log: logEntry
    });
  } else {
    player.status = 'Unsold';
    room.auction.status = 'unsold';

    const logEntry = {
      id: Date.now(),
      text: `❌ UNSOLD! No bids placed for ${player.name}.`,
      time: new Date().toLocaleTimeString()
    };
    room.activityLog.push(logEntry);

    broadcast(room, 'player_unsold', {
      player: player,
      log: logEntry
    });
  }

  // Record into official auction history log
  if (!room.auctionHistory) room.auctionHistory = [];
  room.auctionHistory.unshift({
    id: Date.now(),
    lotNumber: room.auction.currentPlayerIndex + 1,
    player: {
      id: player.id,
      name: player.name,
      role: player.role,
      nationality: player.nationality,
      isOverseas: player.isOverseas,
      overallRating: player.overallRating,
      basePrice: player.basePrice
    },
    status: player.status,
    soldTo: player.soldTo,
    soldToName: player.soldTo && room.franchises[player.soldTo] ? room.franchises[player.soldTo].name : null,
    soldPrice: player.soldPrice || 0,
    timestamp: Date.now(),
    time: new Date().toLocaleTimeString()
  });

  broadcastState(room);

  // AUTOMATIC PROGRESSION: Pause 3.5 seconds to show results banner, then auto-load next player!
  room.auction.transitionTimeout = setTimeout(() => {
    if (room.stage === 'active' && (room.auction.status === 'sold' || room.auction.status === 'unsold')) {
      advanceToNextPlayer(room);
    }
  }, 3500);
}

// Complete Auction
function completeAuction(room) {
  clearRoomTimers(room);

  room.stage = 'completed';
  room.auction.status = 'completed';
  room.auction.currentPlayer = null;

  const totalSold = room.players.filter(p => p.status === 'Sold').length;
  const totalUnsold = room.players.filter(p => p.status === 'Unsold').length;
  const totalSpent = Number(Object.values(room.franchises).reduce((acc, f) => acc + f.spent, 0).toFixed(2));
  const topBuys = room.players
    .filter(p => p.status === 'Sold')
    .sort((a, b) => b.soldPrice - a.soldPrice)
    .slice(0, 5);

  const logEntry = {
    id: Date.now(),
    text: `🏆 IPL 2026 MEGA AUCTION COMPLETED! All players processed. Total Sold: ${totalSold}, Unsold: ${totalUnsold}, Total Spent: ₹${totalSpent} Cr.`,
    time: new Date().toLocaleTimeString()
  };
  room.activityLog.push(logEntry);

  broadcast(room, 'auction_completed', {
    summary: {
      totalSold,
      totalUnsold,
      totalSpent,
      topBuys
    },
    franchises: room.franchises
  });

  broadcastState(room);
}

// Place a bid (with strict concurrency validation)
function placeBid(room, franchiseCode, customAmount = null) {
  if (room.stage !== 'active') {
    return { success: false, message: 'Auction is not currently active.' };
  }

  if (room.auction.status !== 'bidding' && room.auction.status !== 'going_once' && room.auction.status !== 'going_twice') {
    return { success: false, message: 'Auction floor is not accepting bids right now.' };
  }

  if (room.auction.currentBidder === franchiseCode) {
    return { success: false, message: 'You already hold the highest bid!' };
  }

  const inc = getNextBidIncrement(room.auction.currentBid);
  const minNextBid = Number((room.auction.currentBid + inc).toFixed(2));

  let nextAmount;
  if (customAmount !== null && customAmount !== undefined) {
    const customRound = Number(Number(customAmount).toFixed(2));
    if (customRound < minNextBid) {
      return { success: false, message: `Bid too low! Minimum valid bid is ₹${minNextBid.toFixed(2)} Cr` };
    }
    nextAmount = customRound;
  } else {
    nextAmount = minNextBid;
  }

  // Strict sequential check: bid must be strictly greater than current bid
  if (nextAmount <= room.auction.currentBid) {
    return {
      success: false,
      message: `Another bid was placed first! Current bid is now ₹${room.auction.currentBid.toFixed(2)} Cr`
    };
  }

  const check = canFranchiseBid(room, franchiseCode, nextAmount);
  if (!check.canBid) {
    return { success: false, message: check.reason };
  }

  // Apply bid atomically
  room.auction.currentBid = nextAmount;
  room.auction.currentBidder = franchiseCode;
  room.auction.bidHistory.unshift({
    franchise: franchiseCode,
    franchiseName: room.franchises[franchiseCode].name,
    amount: nextAmount,
    timestamp: Date.now()
  });

  // Reset timer to give others time to respond (min 8s)
  if (room.auction.timer < 8) {
    room.auction.timer = 8;
  }
  room.auction.status = 'bidding';

  const logEntry = {
    id: Date.now(),
    text: `⚡ ${room.franchises[franchiseCode].name} placed a bid of ₹${nextAmount.toFixed(2)} Cr!`,
    time: new Date().toLocaleTimeString()
  };
  room.activityLog.push(logEntry);

  broadcast(room, 'bid_placed', {
    franchise: franchiseCode,
    franchiseName: room.franchises[franchiseCode].name,
    amount: nextAmount,
    timer: room.auction.timer,
    log: logEntry
  });

  broadcastState(room);
  return { success: true, amount: nextAmount };
}

// Parse POST body
function parseBody(req) {
  if (req._parsedBody) return Promise.resolve(req._parsedBody);
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        req._parsedBody = body ? JSON.parse(body) : {};
        resolve(req._parsedBody);
      } catch (e) {
        req._parsedBody = {};
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // SSE Stream endpoint
  if (pathname === '/api/stream' || pathname === '/api/events') {
    const roomId = (query.room || '').trim().toUpperCase();
    let room = rooms[roomId];

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Room does not exist' }));
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', roomId: roomId })}\n\n`);
    room.clients.add(res);
    res.write(`event: state_update\ndata: ${JSON.stringify(getSanitizedRoomState(room))}\n\n`);

    req.on('close', () => {
      room.clients.delete(res);
    });
    return;
  }

  // REST API: Get state
  if (pathname === '/api/state' && req.method === 'GET') {
    const roomId = (query.room || '').trim().toUpperCase();
    const room = rooms[roomId];
    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Room not found' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(getSanitizedRoomState(room)));
  }

  // REST API: Create room (Host mode)
  if ((pathname === '/api/room/create' || pathname === '/api/create-room') && req.method === 'POST') {
    const body = await parseBody(req);
    const roomId = (body.roomId || generateRoomCode()).trim().toUpperCase();
    const room = createRoom(roomId, body);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      roomId: roomId,
      hostToken: room.hostToken,
      teamCount: room.teamCount,
      hostName: room.hostName,
      config: room.config,
      room: getSanitizedRoomState(room)
    }));
  }

  // REST API: Join room check
  if ((pathname === '/api/room/join' || pathname === '/api/join-room') && req.method === 'POST') {
    const body = await parseBody(req);
    const roomId = (body.roomId || '').trim().toUpperCase();
    const room = rooms[roomId];

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: `Room "${roomId}" not found. Please check room code!` }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      roomId: roomId,
      roomName: room.name,
      stage: room.stage,
      teamCount: room.teamCount,
      config: room.config,
      room: getSanitizedRoomState(room)
    }));
  }

  // REST API: Update Room Configuration (Admin in Lobby)
  if (pathname === '/api/room/update-config' && req.method === 'POST') {
    const body = await parseBody(req);
    const roomId = (body.roomId || '').trim().toUpperCase();
    const room = rooms[roomId];

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Room not found' }));
    }

    if (room.stage !== 'lobby') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Configuration can only be updated in lobby before auction starts.' }));
    }

    if (body.initialPurse !== undefined) {
      room.config.initialPurse = Number(body.initialPurse);
      for (const f of Object.values(room.franchises)) {
        f.purse = room.config.initialPurse;
      }
    }
    if (body.minSquad !== undefined) room.config.minSquad = Number(body.minSquad);
    if (body.maxSquad !== undefined) room.config.maxSquad = Number(body.maxSquad);
    if (body.maxOverseas !== undefined) room.config.maxOverseas = Number(body.maxOverseas);
    if (body.timerDuration !== undefined) room.config.timerDuration = Number(body.timerDuration);
    if (body.bidIncrementRule !== undefined) room.config.bidIncrementRule = body.bidIncrementRule;
    if (body.autoAiForUnclaimed !== undefined) room.config.autoAiForUnclaimed = Boolean(body.autoAiForUnclaimed);

    const logEntry = {
      id: Date.now(),
      text: `⚙️ Auction configuration updated by ${room.hostName}: Purse ₹${room.config.initialPurse} Cr, Squad ${room.config.minSquad}-${room.config.maxSquad}, Overseas max ${room.config.maxOverseas}, Timer ${room.config.timerDuration}s.`,
      time: new Date().toLocaleTimeString()
    };
    room.activityLog.push(logEntry);

    broadcast(room, 'config_updated', { config: room.config });
    broadcastState(room);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, config: room.config }));
  }

  // REST API: Admin reviews/updates player starting base price
  if (pathname === '/api/room/update-player-price' && req.method === 'POST') {
    const body = await parseBody(req);
    const roomId = (body.roomId || '').trim().toUpperCase();
    const room = rooms[roomId];

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Room not found' }));
    }

    const playerId = body.playerId;
    const newPrice = Number(parseFloat(body.basePrice).toFixed(2));

    if (isNaN(newPrice) || newPrice < 0.75 || newPrice > 2.00) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Base price must be between ₹0.75 Cr and ₹2.00 Cr' }));
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Player not found' }));
    }

    const oldPrice = player.basePrice;
    player.basePrice = newPrice;

    if (room.auction.currentPlayer && room.auction.currentPlayer.id === playerId && !room.auction.currentBidder) {
      room.auction.currentPlayer.basePrice = newPrice;
      room.auction.currentBid = newPrice;
    }

    const logEntry = {
      id: Date.now(),
      text: `✏️ Base price for ${player.name} updated from ₹${oldPrice.toFixed(2)} Cr to ₹${newPrice.toFixed(2)} Cr by ${room.hostName}.`,
      time: new Date().toLocaleTimeString()
    };
    room.activityLog.push(logEntry);
    if (!room.auctionHistory) room.auctionHistory = [];
    room.auctionHistory.unshift({
      id: Date.now(),
      type: 'price_adjustment',
      player: { id: player.id, name: player.name },
      oldPrice: oldPrice,
      newPrice: newPrice,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString()
    });

    broadcastState(room);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, player: player }));
  }

  // REST API: Claim franchise in lobby
  if ((pathname === '/api/room/claim-team' || pathname === '/api/claim-franchise') && req.method === 'POST') {
    const body = await parseBody(req);
    const roomId = (body.roomId || '').trim().toUpperCase();
    const room = rooms[roomId];

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Room not found' }));
    }

    const code = body.franchiseCode;
    const userName = (body.userName || 'Franchise Owner').trim();
    const previousCode = body.previousFranchiseCode;

    // Release previous team if switching
    if (previousCode && room.franchises[previousCode] && room.franchises[previousCode].user === userName) {
      room.franchises[previousCode].user = null;
      room.franchises[previousCode].isAi = false;
    }

    if (code && room.franchises[code]) {
      // Check if already claimed by someone else
      if (room.franchises[code].user && room.franchises[code].user !== userName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          message: `${room.franchises[code].name} is already claimed by ${room.franchises[code].user}!`
        }));
      }

      room.franchises[code].user = userName;
      room.franchises[code].isAi = false;

      const logEntry = {
        id: Date.now(),
        text: `🏏 ${userName} selected ${room.franchises[code].name}!`,
        time: new Date().toLocaleTimeString()
      };
      room.activityLog.push(logEntry);
      broadcastState(room);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, franchise: room.franchises[code], room: getSanitizedRoomState(room) }));
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, message: 'Invalid franchise code' }));
  }

  // REST API: Start auction
  if ((pathname === '/api/room/start-auction' || pathname === '/api/start-auction' || pathname === '/api/host-action' && (await parseBody(req)).action === 'start') && req.method === 'POST') {
    const body = req._parsedBody || (await parseBody(req));
    const roomId = (body.roomId || '').trim().toUpperCase();
    const room = rooms[roomId];

    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Room not found' }));
    }

    startAuctionFromLobby(room);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, stage: room.stage, room: getSanitizedRoomState(room) }));
  }

  // REST API: Place bid
  if ((pathname === '/api/room/bid' || pathname === '/api/bid') && req.method === 'POST') {
    const body = await parseBody(req);
    const roomId = (body.roomId || '').trim().toUpperCase();
    const room = rooms[roomId];
    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Room not found' }));
    }

    const amount = body.customAmount !== undefined ? body.customAmount : body.amount;
    const result = placeBid(room, body.franchiseCode, amount);
    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  }

  // REST API: Admin / Auctioneer commands
  if ((pathname === '/api/room/auctioneer' || pathname === '/api/host-action') && req.method === 'POST') {
    const body = await parseBody(req);
    const roomId = (body.roomId || '').trim().toUpperCase();
    const room = rooms[roomId];
    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Room not found' }));
    }

    const action = body.action;

    if (action === 'pause') {
      room.auction.isPaused = true;
      room.auction.status = 'paused';
      const logEntry = {
        id: Date.now(),
        text: `⏸️ Auction paused by Admin ${room.hostName}. Bidding frozen.`,
        time: new Date().toLocaleTimeString()
      };
      room.activityLog.push(logEntry);
      broadcast(room, 'auction_paused', {});
      broadcastState(room);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, isPaused: true }));
    }

    if (action === 'resume') {
      room.auction.isPaused = false;
      room.auction.status = 'bidding';
      if (room.stage === 'stopped') room.stage = 'active';
      const logEntry = {
        id: Date.now(),
        text: `▶️ Auction resumed by Admin ${room.hostName}. Countdown continuing.`,
        time: new Date().toLocaleTimeString()
      };
      room.activityLog.push(logEntry);
      runBiddingTimer(room);
      broadcast(room, 'auction_resumed', {});
      broadcastState(room);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, isPaused: false }));
    }

    if (action === 'stop') {
      clearRoomTimers(room);
      room.stage = 'stopped';
      room.auction.status = 'stopped';
      room.auction.isPaused = true;
      const logEntry = {
        id: Date.now(),
        text: `🛑 Auction stopped by Admin ${room.hostName}. All current transactions preserved.`,
        time: new Date().toLocaleTimeString()
      };
      room.activityLog.push(logEntry);
      broadcast(room, 'auction_stopped', { message: 'Auction stopped by Admin.' });
      broadcastState(room);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, stage: 'stopped' }));
    }

    if (action === 'end') {
      clearRoomTimers(room);
      completeAuction(room);
      const logEntry = {
        id: Date.now(),
        text: `🏁 Auction ended permanently by Admin ${room.hostName}. Final results compiled.`,
        time: new Date().toLocaleTimeString()
      };
      room.activityLog.push(logEntry);
      broadcastState(room);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, stage: 'completed' }));
    }

    if (action === 'skip') {
      resolveCurrentLot(room);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }

    if (action === 'hammer') {
      resolveCurrentLot(room);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }

    if (action === 'reset_all') {
      clearRoomTimers(room);
      createRoom(roomId, {
        teamCount: room.teamCount,
        initialPurse: room.config.initialPurse,
        minSquad: room.config.minSquad,
        maxSquad: room.config.maxSquad,
        maxOverseas: room.config.maxOverseas,
        timerDuration: room.config.timerDuration,
        hostName: room.hostName
      });
      broadcast(room, 'auction_reset', {});
      broadcastState(rooms[roomId]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, message: 'Unknown action' }));
  }

  // REST API: In-room chat & activity messaging
  if ((pathname === '/api/room/chat' || pathname === '/api/chat') && req.method === 'POST') {
    const body = await parseBody(req);
    const roomId = (body.roomId || '').trim().toUpperCase();
    const room = rooms[roomId];
    if (!room) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, message: 'Room not found' }));
    }
    const msg = {
      id: Date.now(),
      user: body.userName || 'Participant',
      team: body.franchiseCode || null,
      text: (body.text || '').trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    if (!room.chatMessages) room.chatMessages = [];
    room.chatMessages.push(msg);
    if (room.chatMessages.length > 80) room.chatMessages.shift();
    broadcast(room, 'chat_message', msg);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, message: msg }));
  }

  // REST API: Get players
  if (pathname === '/api/players' && req.method === 'GET') {
    const roomId = (query.room || '').trim().toUpperCase();
    const room = rooms[roomId] || Object.values(rooms)[0];

    let list = room ? room.players : loadPlayers();
    if (query.role) list = list.filter(p => p.role.toLowerCase().includes(query.role.toLowerCase()));
    if (query.status) list = list.filter(p => p.status.toLowerCase() === query.status.toLowerCase());
    if (query.search) {
      const s = query.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s) || p.nationality.toLowerCase().includes(s));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ total: list.length, players: list }));
  }

  // Static file serving from public/
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'public', 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Default pre-created room for instant access
createRoom('IPL-2026', { teamCount: 10, hostName: 'BCCI Auctioneer' });

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🏏 IPL Auction Arena Server running at http://localhost:${PORT}`);
    console.log(`📡 Autonomous Real-time Engine active.`);
  });
}

module.exports = { server, rooms, createRoom, startAuctionFromLobby, advanceToNextPlayer, placeBid, resolveCurrentLot, canFranchiseBid, getMaxAllowedBid, getNextBidIncrement };
