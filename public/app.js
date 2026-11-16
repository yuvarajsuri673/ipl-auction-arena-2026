// IPL Auction Arena 2026 - Autonomous Real-time Multiplayer Engine

const state = {
  currentScreen: 'landing', // 'landing', 'lobby', 'auction'
  currentRightTab: 'feed', // 'feed', 'notes', 'stats'
  roomId: null,
  userName: localStorage.getItem('ipl_user_name') || '',
  isHost: false,
  userFranchise: null,
  roomData: null,
  eventSource: null,
  intermissionInterval: null
};

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Check URL query parameters for room code or recover session
  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room');
  const storedRoom = localStorage.getItem('ipl_active_room');
  const activeRoom = urlRoom ? urlRoom.trim().toUpperCase() : storedRoom;

  if (activeRoom) {
    const joinInput = document.getElementById('join-room-id');
    if (joinInput) joinInput.value = activeRoom;
  }

  // Pre-fill user name if stored
  if (state.userName) {
    const nameInput = document.getElementById('join-user-name');
    if (nameInput) nameInput.value = state.userName;
  }

  setupEventListeners();
  loadPrivateStrategyNotes();

  // If room is present in URL or stored, attempt automatic recovery (TEST 14)
  if (activeRoom && state.userName) {
    autoRecoverSession(activeRoom);
  }
});

// Automatic session recovery on browser refresh (TEST 14)
async function autoRecoverSession(roomId) {
  try {
    const res = await fetch(`/api/state?room=${roomId}`);
    if (res.ok) {
      const room = await res.json();
      state.roomId = roomId;
      state.roomData = room;

      // Check if user was host
      const hostFlag = localStorage.getItem(`ipl_is_host_${roomId}`);
      if (hostFlag === 'true' || room.hostName === state.userName) {
        state.isHost = true;
      }

      // Check if user claimed a franchise
      for (const [code, f] of Object.entries(room.franchises)) {
        if (f.user === state.userName) {
          state.userFranchise = code;
          break;
        }
      }

      initRoomSSE(roomId);

      if (room.stage === 'active') {
        switchScreen('auction');
      } else {
        switchScreen('lobby');
      }
      updateUserPill();
      renderCurrentScreen();
    }
  } catch (e) {
    console.warn('Session auto-recovery skipped:', e);
  }
}

// Switch visible screen
function switchScreen(screenName) {
  state.currentScreen = screenName;

  document.getElementById('screen-landing').classList.add('hidden');
  document.getElementById('screen-lobby').classList.add('hidden');
  document.getElementById('screen-auction').classList.add('hidden');

  if (screenName === 'landing') {
    document.getElementById('screen-landing').classList.remove('hidden');
    document.getElementById('header-room-tag').textContent = 'HOME';
    document.getElementById('btn-leave-room').classList.add('hidden');
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }
    localStorage.removeItem('ipl_active_room');
  } else if (screenName === 'lobby') {
    document.getElementById('screen-lobby').classList.remove('hidden');
    document.getElementById('header-room-tag').textContent = `ROOM: ${state.roomId}`;
    document.getElementById('btn-leave-room').classList.remove('hidden');
    localStorage.setItem('ipl_active_room', state.roomId);
  } else if (screenName === 'auction') {
    document.getElementById('screen-auction').classList.remove('hidden');
    document.getElementById('header-room-tag').textContent = `LIVE: ${state.roomId}`;
    document.getElementById('btn-leave-room').classList.remove('hidden');
    localStorage.setItem('ipl_active_room', state.roomId);
  }
}

// Return to home
function goHome() {
  if (state.roomId && !confirm('Leave current room and return to home?')) return;
  state.roomId = null;
  state.isHost = false;
  state.userFranchise = null;
  state.roomData = null;
  history.replaceState(null, '', window.location.pathname);
  updateUserPill();
  switchScreen('landing');
}

// Setup Server-Sent Events stream for room
function initRoomSSE(roomId) {
  if (state.eventSource) {
    state.eventSource.close();
  }

  const sseUrl = `/api/stream?room=${roomId}`;
  state.eventSource = new EventSource(sseUrl);

  state.eventSource.addEventListener('state_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      state.roomData = data;

      // Check if user's franchise assignment changed
      if (state.userName) {
        for (const [code, f] of Object.entries(data.franchises)) {
          if (f.user === state.userName) {
            state.userFranchise = code;
            break;
          }
        }
      }

      // Automatically transition from lobby to auction when host starts auction
      if (data.stage === 'active' && state.currentScreen === 'lobby') {
        if (window.soundEngine) {
          window.soundEngine.playSoldFanfare();
          window.soundEngine.speak('The IPL Auction has officially begun! Automated engine active.');
        }
        switchScreen('auction');
      }

      renderCurrentScreen();
    } catch (err) {
      console.error('State parse error:', err);
    }
  });

  state.eventSource.addEventListener('auction_started', () => {
    if (window.soundEngine) {
      window.soundEngine.playSoldFanfare();
      window.soundEngine.speak('The auction floor is now open! Automation active.');
    }
    switchScreen('auction');
  });

  state.eventSource.addEventListener('bid_placed', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (window.soundEngine) {
        window.soundEngine.playBidChime();
      }
      addTickerMessage(`⚡ ${data.franchiseName} bid ₹${data.amount.toFixed(2)} Cr!`);
    } catch (err) {}
  });

  state.eventSource.addEventListener('timer_tick', (e) => {
    try {
      const data = JSON.parse(e.data);
      updateTimerDisplay(data.timer, data.status);
    } catch (err) {}
  });

  state.eventSource.addEventListener('auction_phase', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (window.soundEngine) {
        if (data.phase === 'going_once') {
          window.soundEngine.speak('Going once...');
        } else if (data.phase === 'going_twice') {
          window.soundEngine.speak('Going twice... final call!');
        }
      }
    } catch (err) {}
  });

  state.eventSource.addEventListener('player_sold', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (window.soundEngine) {
        window.soundEngine.playSoldFanfare();
        window.soundEngine.speak(`Sold to ${data.franchiseName} for ${data.price.toFixed(2)} Crore!`);
      }
      showOutcomeIntermission('sold', data);
    } catch (err) {}
  });

  state.eventSource.addEventListener('player_unsold', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (window.soundEngine) {
        window.soundEngine.playGavel();
        window.soundEngine.speak(`${data.player.name} remains unsold.`);
      }
      showOutcomeIntermission('unsold', data);
    } catch (err) {}
  });

  state.eventSource.addEventListener('auction_completed', (e) => {
    try {
      const data = JSON.parse(e.data);
      showCompletedModal(data);
    } catch (err) {}
  });

  state.eventSource.addEventListener('config_updated', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (state.roomData) state.roomData.config = data.config;
      renderLobbyConfig();
    } catch (err) {}
  });

  state.eventSource.onerror = (err) => {
    console.warn('SSE stream reconnecting...', err);
  };
}

// Show Sold/Unsold Intermission Banner
function showOutcomeIntermission(type, data) {
  const banner = document.getElementById('outcome-banner');
  const podiumContent = document.getElementById('podium-content');
  const podiumEmpty = document.getElementById('podium-empty');

  podiumContent.classList.add('hidden');
  podiumEmpty.classList.add('hidden');
  banner.classList.remove('hidden');

  if (type === 'sold') {
    document.getElementById('outcome-icon').textContent = '🔨';
    document.getElementById('outcome-title').textContent = 'SOLD!';
    document.getElementById('outcome-title').style.color = '#facc15';
    document.getElementById('outcome-subtitle').textContent = `${data.player.name} bought by ${data.franchiseName} for ₹${data.price.toFixed(2)} Cr`;
    addTickerMessage(`🔨 SOLD! ${data.player.name} bought by ${data.franchiseName} for ₹${data.price.toFixed(2)} Cr!`);
  } else {
    document.getElementById('outcome-icon').textContent = '❌';
    document.getElementById('outcome-title').textContent = 'UNSOLD';
    document.getElementById('outcome-title').style.color = 'var(--accent-red)';
    document.getElementById('outcome-subtitle').textContent = `No bids placed for ${data.player.name}.`;
    addTickerMessage(`❌ UNSOLD! ${data.player.name} received no bids.`);
  }

  let remaining = 3;
  document.getElementById('outcome-countdown').textContent = remaining;

  if (state.intermissionInterval) clearInterval(state.intermissionInterval);
  state.intermissionInterval = setInterval(() => {
    remaining--;
    if (remaining >= 0) {
      document.getElementById('outcome-countdown').textContent = remaining;
    } else {
      clearInterval(state.intermissionInterval);
      state.intermissionInterval = null;
    }
  }, 1000);
}

// 👑 Action 1: Create Room as Host (TEST 1)
async function createRoomAsHost() {
  const hostName = (document.getElementById('host-create-name').value || 'Auctioneer').trim();
  const teamCount = parseInt(document.getElementById('host-create-teams').value) || 10;
  const initialPurse = parseFloat(document.getElementById('host-create-purse').value) || 100.0;
  const timerDuration = parseInt(document.getElementById('host-create-timer').value) || 15;
  const squadVal = document.getElementById('host-create-squad').value || '18-25';
  const [minSquad, maxSquad] = squadVal.split('-').map(Number);
  let roomId = (document.getElementById('host-create-room-id').value || '').trim().toUpperCase();

  if (!roomId) roomId = `IPL-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const res = await fetch('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: roomId,
        hostName: hostName,
        teamCount: teamCount,
        initialPurse: initialPurse,
        minSquad: minSquad || 18,
        maxSquad: maxSquad || 25,
        timerDuration: timerDuration || 15
      })
    });
    const data = await res.json();
    if (data.success) {
      state.roomId = data.roomId;
      state.isHost = true;
      state.userName = hostName;
      localStorage.setItem('ipl_user_name', hostName);
      localStorage.setItem(`ipl_is_host_${state.roomId}`, 'true');

      // Update URL query string
      history.replaceState(null, '', `?room=${state.roomId}`);

      initRoomSSE(state.roomId);
      switchScreen('lobby');
      updateUserPill();
    } else {
      alert(data.message || 'Failed to create room');
    }
  } catch (err) {
    console.error('Create room error:', err);
    alert('Error connecting to server.');
  }
}

// 🎮 Action 2: Join Room as Player (TEST 2)
async function joinRoomAsPlayer() {
  const name = (document.getElementById('join-user-name').value || '').trim();
  const roomId = (document.getElementById('join-room-id').value || '').trim().toUpperCase();

  if (!name) {
    alert('Please enter your manager name!');
    document.getElementById('join-user-name').focus();
    return;
  }
  if (!roomId) {
    alert('Please enter a room code!');
    document.getElementById('join-room-id').focus();
    return;
  }

  state.userName = name;
  localStorage.setItem('ipl_user_name', name);

  try {
    const res = await fetch('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: roomId, userName: name })
    });
    const data = await res.json();
    if (data.success) {
      state.roomId = roomId;
      state.isHost = false;

      // Update URL query string
      history.replaceState(null, '', `?room=${state.roomId}`);

      initRoomSSE(state.roomId);
      if (data.stage === 'active') {
        switchScreen('auction');
      } else {
        switchScreen('lobby');
      }
      updateUserPill();
    } else {
      alert(data.message || 'Room not found.');
    }
  } catch (err) {
    console.error('Join error:', err);
    alert('Could not connect to room.');
  }
}

// 🏏 Action 3: Claim Franchise in Lobby (TEST 3)
async function claimFranchise(code) {
  if (!state.userName) {
    const name = prompt('Enter your manager name:');
    if (!name) return;
    state.userName = name.trim();
    localStorage.setItem('ipl_user_name', state.userName);
  }

  try {
    const res = await fetch('/api/room/claim-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        franchiseCode: code,
        userName: state.userName,
        previousFranchiseCode: state.userFranchise
      })
    });
    const data = await res.json();
    if (data.success) {
      state.userFranchise = code;
      if (window.soundEngine) window.soundEngine.playBidChime();
      updateUserPill();
    } else {
      alert(data.message || 'Could not select franchise');
    }
  } catch (err) {
    console.error('Claim error:', err);
  }
}

// ⚙️ Action 4: Host Updates Config (TEST 4)
async function saveLobbyConfig() {
  if (!state.isHost) return;

  const purse = parseFloat(document.getElementById('cfg-purse-input').value) || 100.0;
  const minSquad = parseInt(document.getElementById('cfg-minsquad-input').value) || 18;
  const maxSquad = parseInt(document.getElementById('cfg-maxsquad-input').value) || 25;
  const maxOverseas = parseInt(document.getElementById('cfg-overseas-input').value) || 8;
  const timerDuration = parseInt(document.getElementById('cfg-timer-input').value) || 15;
  const autoAi = document.getElementById('lobby-auto-ai-toggle').checked;

  try {
    const res = await fetch('/api/room/update-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        initialPurse: purse,
        minSquad: minSquad,
        maxSquad: maxSquad,
        maxOverseas: maxOverseas,
        timerDuration: timerDuration,
        autoAiForUnclaimed: autoAi
      })
    });
    const data = await res.json();
    if (data.success) {
      alert('Auction rules and configuration updated successfully!');
    } else {
      alert(data.message || 'Could not update configuration');
    }
  } catch (err) {
    console.error('Config update error:', err);
  }
}

// 🚀 Action 5: Host Starts Auction (TEST 5)
async function startAuctionFromLobby() {
  if (!state.isHost) return;

  try {
    const res = await fetch('/api/room/start-auction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: state.roomId })
    });
    const data = await res.json();
    if (data.success) {
      switchScreen('auction');
    } else {
      alert(data.message || 'Could not start auction');
    }
  } catch (err) {
    console.error('Start auction error:', err);
  }
}

// Render according to current screen
function renderCurrentScreen() {
  if (!state.roomData) return;

  if (state.currentScreen === 'lobby') {
    renderLobbyScreen();
  } else if (state.currentScreen === 'auction') {
    renderAuctionScreen();
  }
}

// ========================================================
// RENDER LOBBY SCREEN
// ========================================================
function renderLobbyScreen() {
  const room = state.roomData;

  document.getElementById('lobby-room-name').textContent = room.name;
  document.getElementById('lobby-format-tag').textContent = `${room.teamCount} TEAMS`;
  document.getElementById('lobby-host-name').textContent = room.hostName;
  document.getElementById('lobby-room-code-display').textContent = room.id;

  document.getElementById('lobby-claimed-count').textContent = room.lobby.claimedCount;
  document.getElementById('lobby-total-count').textContent = room.lobby.totalTeams;

  // Render Config Panel
  renderLobbyConfig();

  // Show Host Action Bar only to host
  const hostBar = document.getElementById('lobby-host-bar');
  if (state.isHost) {
    hostBar.classList.remove('hidden');
    document.getElementById('lobby-config-editable-badge').textContent = 'Editable by Host';
    document.getElementById('lobby-config-editable-badge').className = 'tag tag-role';
  } else {
    hostBar.classList.add('hidden');
    document.getElementById('lobby-config-editable-badge').textContent = 'View Only (Host Configures)';
    document.getElementById('lobby-config-editable-badge').className = 'tag tag-india';
  }

  // Render Grid of Franchises
  const grid = document.getElementById('lobby-teams-grid');
  grid.innerHTML = '';

  for (const [code, f] of Object.entries(room.franchises)) {
    const isClaimedByMe = f.user === state.userName;
    if (isClaimedByMe) state.userFranchise = code;

    const card = document.createElement('div');
    card.className = `lobby-team-card ${isClaimedByMe ? 'my-claimed-team' : ''}`;

    let statusHtml = '';
    if (isClaimedByMe) {
      statusHtml = `
        <div class="lobby-team-status status-claimed" style="background:rgba(245,158,11,0.15); color:var(--accent-gold); border-color:var(--accent-gold)">
          <span>⭐ YOUR FRANCHISE</span>
          <span style="font-size:0.7rem; cursor:pointer; text-decoration:underline" onclick="claimFranchise('${code}')">Claimed</span>
        </div>
      `;
    } else if (f.user) {
      statusHtml = `
        <div class="lobby-team-status status-claimed">
          <span>👤 ${f.user}</span>
          <span style="font-size:0.7rem; color:var(--text-muted)">Claimed</span>
        </div>
      `;
    } else {
      statusHtml = `
        <button class="btn-claim-lobby" onclick="claimFranchise('${code}')">
          🏏 SELECT THIS FRANCHISE
        </button>
      `;
    }

    card.innerHTML = `
      <div class="lobby-team-top">
        <div class="lobby-team-logo" style="background:${f.color}; color:${f.textColor}">
          ${f.shortName}
        </div>
        <div class="lobby-team-info">
          <h3>${f.name}</h3>
          <div class="lobby-team-motto">${f.motto}</div>
        </div>
      </div>
      <div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem">
          Purse: <strong style="color:#facc15">₹${f.purse.toFixed(2)} Cr</strong> | Max Squad: ${room.config.maxSquad}
        </div>
        ${statusHtml}
      </div>
    `;

    grid.appendChild(card);
  }

  updateUserPill();
}

// Render Lobby Config Fields
function renderLobbyConfig() {
  if (!state.roomData || !state.roomData.config) return;
  const cfg = state.roomData.config;

  const purseInput = document.getElementById('cfg-purse-input');
  const minSquadInput = document.getElementById('cfg-minsquad-input');
  const maxSquadInput = document.getElementById('cfg-maxsquad-input');
  const overseasInput = document.getElementById('cfg-overseas-input');
  const timerInput = document.getElementById('cfg-timer-input');
  const autoAiToggle = document.getElementById('lobby-auto-ai-toggle');

  if (state.isHost) {
    purseInput.disabled = false;
    minSquadInput.disabled = false;
    maxSquadInput.disabled = false;
    overseasInput.disabled = false;
    timerInput.disabled = false;
  } else {
    purseInput.disabled = true;
    minSquadInput.disabled = true;
    maxSquadInput.disabled = true;
    overseasInput.disabled = true;
    timerInput.disabled = true;
  }

  // Update values if not actively focused
  if (document.activeElement !== purseInput) purseInput.value = cfg.initialPurse;
  if (document.activeElement !== minSquadInput) minSquadInput.value = cfg.minSquad;
  if (document.activeElement !== maxSquadInput) maxSquadInput.value = cfg.maxSquad;
  if (document.activeElement !== overseasInput) overseasInput.value = cfg.maxOverseas;
  if (document.activeElement !== timerInput) timerInput.value = cfg.timerDuration;
  if (autoAiToggle) autoAiToggle.checked = cfg.autoAiForUnclaimed !== false;
}

// ========================================================
// RENDER LIVE AUCTION SCREEN
// ========================================================
function renderAuctionScreen() {
  const room = state.roomData;
  const p = room.auction.currentPlayer;
  const f = state.userFranchise ? room.franchises[state.userFranchise] : null;

  document.getElementById('auction-teams-count-title').textContent = `All ${room.teamCount} Franchises`;
  document.getElementById('sidebar-purse-cap').textContent = `Cap: ₹${room.config.initialPurse} Cr`;

  // Activity ticker
  if (room.activityLog.length > 0) {
    const latest = room.activityLog[room.activityLog.length - 1];
    document.getElementById('ticker-text').textContent = latest.text;
  }

  // Summary counts
  document.getElementById('stat-available-count').textContent = room.stats.available;
  document.getElementById('stat-sold-count').textContent = room.stats.sold;
  document.getElementById('stat-unsold-count').textContent = room.stats.unsold;
  document.getElementById('stat-total-spent').textContent = `₹${room.stats.totalSpent.toFixed(2)} Cr`;

  // Podium (TEST 6, 11)
  const banner = document.getElementById('outcome-banner');
  const podiumEmpty = document.getElementById('podium-empty');
  const podiumContent = document.getElementById('podium-content');

  if (p && room.auction.status !== 'sold' && room.auction.status !== 'unsold') {
    banner.classList.add('hidden');
    podiumEmpty.classList.add('hidden');
    podiumContent.classList.remove('hidden');

    document.getElementById('player-name').textContent = p.name;
    document.getElementById('player-role').textContent = p.role;
    document.getElementById('player-id').textContent = p.id;
    document.getElementById('player-rating').textContent = p.overallRating || '--';

    const tagsContainer = document.getElementById('player-tags');
    tagsContainer.innerHTML = `
      <span class="tag tag-role">${p.role}</span>
      <span class="${p.isOverseas ? 'tag tag-overseas' : 'tag tag-india'}">${p.isOverseas ? `Overseas (${p.nationality})` : 'Indian'}</span>
      ${p.isWicketkeeper ? '<span class="tag tag-wk">🧤 Wicketkeeper</span>' : ''}
      ${p.isUncapped ? '<span class="tag tag-india">⭐ Uncapped</span>' : ''}
    `;

    document.getElementById('stat-runs').textContent = p.stats.runs || '--';
    document.getElementById('stat-sr').textContent = p.stats.strikeRate ? p.stats.strikeRate.toFixed(1) : '--';
    document.getElementById('stat-wickets').textContent = p.stats.wickets || '--';
    document.getElementById('stat-econ').textContent = p.stats.economy ? p.stats.economy.toFixed(2) : '--';
    document.getElementById('player-base-price').textContent = `₹${p.basePrice.toFixed(2)} Cr`;

    const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2);
    document.getElementById('player-avatar-text').textContent = initials;
  } else if (!p && room.auction.status !== 'sold' && room.auction.status !== 'unsold') {
    banner.classList.add('hidden');
    podiumEmpty.classList.remove('hidden');
    podiumContent.classList.add('hidden');
  }

  // Bid display (TEST 7)
  document.getElementById('current-bid-amount').textContent = `₹${room.auction.currentBid.toFixed(2)} Cr`;
  const bidderEl = document.getElementById('current-bidder-info');
  if (room.auction.currentBidder && room.franchises[room.auction.currentBidder]) {
    const bf = room.franchises[room.auction.currentBidder];
    bidderEl.innerHTML = `
      <span class="bidder-tag" style="background:${bf.color}; color:${bf.textColor}">
        ${bf.shortName} - ${bf.name}
      </span>
    `;
  } else {
    bidderEl.innerHTML = `<span style="color:var(--text-muted); font-size:0.8rem">Base Price</span>`;
  }

  // Render bidding controls
  renderBiddingControls(room, f);

  // Render host controls
  renderHostControls(room);

  // Render sidebars
  renderFranchisesSidebar(room);
  renderActivityLog(room);
  renderStatsTab(room);
  updateBudgetCalculator(room, f);
  updateUserPill();
}

// Bidding Controls (TEST 7, 12, 13)
function renderBiddingControls(room, f) {
  const bidBtn = document.getElementById('btn-main-bid');
  const quickIncContainer = document.getElementById('quick-increments');

  if (!f) {
    document.getElementById('user-franchise-info').innerHTML = `
      <div style="color:var(--accent-gold); font-weight:700">👀 Spectator Mode</div>
      <div style="font-size:0.8rem; color:var(--text-muted)">You did not select a team in the lobby.</div>
    `;
    bidBtn.disabled = true;
    bidBtn.innerHTML = `<span>Spectator Only</span>`;
    quickIncContainer.innerHTML = '';
    return;
  }

  const overseasCount = f.squad.filter(p => p.isOverseas).length;
  document.getElementById('user-franchise-info').innerHTML = `
    <div style="display:flex; align-items:center; gap:0.5rem">
      <span style="background:${f.color}; color:${f.textColor}; font-weight:800; font-size:0.75rem; padding:0.15rem 0.5rem; border-radius:4px">
        ${f.shortName}
      </span>
      <span class="my-purse-badge">Purse: ₹${f.purse.toFixed(2)} Cr</span>
    </div>
    <div class="my-squad-stats">
      Squad: ${f.squad.length}/${room.config.maxSquad} (Min ${room.config.minSquad}) | Overseas: ${overseasCount}/${room.config.maxOverseas}
    </div>
  `;

  const p = room.auction.currentPlayer;
  const isAuctionOpen = room.auction.status === 'bidding' || room.auction.status === 'going_once' || room.auction.status === 'going_twice';
  const isHighestBidder = room.auction.currentBidder === state.userFranchise;

  const inc = room.auction.nextIncrement || 0.20;
  const nextBidAmount = Number((room.auction.currentBid + inc).toFixed(2));

  let canBid = true;
  let disabledReason = '';

  if (!isAuctionOpen) {
    canBid = false;
    disabledReason = room.auction.isPaused ? 'Auction Paused' : 'Clock Not Running';
  } else if (isHighestBidder) {
    canBid = false;
    disabledReason = 'You hold the highest bid!';
  } else if (f.squad.length >= room.config.maxSquad) {
    canBid = false;
    disabledReason = `Squad limit reached (${room.config.maxSquad} max)`;
  } else if (p && p.isOverseas && overseasCount >= room.config.maxOverseas) {
    canBid = false;
    disabledReason = `Overseas limit reached (${room.config.maxOverseas} max)`;
  } else {
    const needed = Math.max(0, room.config.minSquad - (f.squad.length + 1));
    const reserveNeeded = needed * room.config.minReservePrice;
    const maxAllowed = f.purse - reserveNeeded;
    if (nextBidAmount > maxAllowed) {
      canBid = false;
      disabledReason = `Reserve needed (Max: ₹${Math.max(0, maxAllowed).toFixed(2)} Cr)`;
    }
  }

  bidBtn.disabled = !canBid;
  if (canBid) {
    bidBtn.innerHTML = `
      <span>BID ₹${nextBidAmount.toFixed(2)} Cr</span>
      <span class="btn-sub">+₹${(inc * 100).toFixed(0)} Lakhs</span>
    `;
    bidBtn.onclick = () => sendBid(nextBidAmount);
  } else {
    bidBtn.innerHTML = `<span>${disabledReason || 'Cannot Bid'}</span>`;
  }

  quickIncContainer.innerHTML = '';
  if (canBid && isAuctionOpen) {
    [0.20, 0.50, 1.00].forEach(addAmount => {
      const customTotal = Number((room.auction.currentBid + addAmount).toFixed(2));
      const btn = document.createElement('button');
      btn.className = 'btn-quick-inc';
      btn.textContent = `+₹${(addAmount * 100).toFixed(0)}L (₹${customTotal.toFixed(2)})`;
      btn.onclick = () => sendBid(customTotal);
      quickIncContainer.appendChild(btn);
    });
  }
}

// Host controls in Auction Floor
function renderHostControls(room) {
  const hostButtons = document.getElementById('host-control-buttons');
  const pauseBtn = document.getElementById('btn-host-pause');

  if (pauseBtn) {
    pauseBtn.innerHTML = room.auction.isPaused ? '▶️ Resume Timer' : '⏸️ Pause Timer';
  }

  if (!state.isHost) {
    if (hostButtons) hostButtons.style.display = 'none';
  } else {
    if (hostButtons) hostButtons.style.display = 'flex';
  }
}

// Sidebar: All 10 Franchises List (TEST 3, 9)
function renderFranchisesSidebar(room) {
  const container = document.getElementById('franchises-sidebar-list');
  container.innerHTML = '';

  for (const [code, f] of Object.entries(room.franchises)) {
    const isMe = state.userFranchise === code;
    const isCurrentBidder = room.auction.currentBidder === code;

    const card = document.createElement('div');
    card.className = `franchise-card ${isMe ? 'active-user' : ''}`;
    if (isCurrentBidder) {
      card.style.border = `2px solid ${f.color}`;
      card.style.boxShadow = `0 0 15px ${f.color}40`;
    }

    const overseasCount = f.squad.filter(p => p.isOverseas).length;

    card.innerHTML = `
      <div class="franchise-left">
        <div class="franchise-badge" style="background:${f.color}; color:${f.textColor}">
          ${f.shortName}
        </div>
        <div class="franchise-name-box">
          <div class="franchise-name">${f.name}</div>
          <div class="franchise-owner">
            ${f.user ? `👤 ${f.user}${isMe ? ' (You)' : ''}` : (f.isAi ? '🤖 AI Bot' : 'Unclaimed')}
          </div>
        </div>
      </div>
      <div class="franchise-right">
        <div class="franchise-purse">₹${f.purse.toFixed(2)} Cr</div>
        <div class="franchise-squad-count">Squad: ${f.squad.length}/${room.config.maxSquad} (${overseasCount} OS)</div>
      </div>
    `;

    card.onclick = () => openSquadModal(code);
    container.appendChild(card);
  }
}

// Activity Commentary Feed
function renderActivityLog(room) {
  const container = document.getElementById('activity-feed');
  container.innerHTML = '';

  const logs = room.activityLog.slice(-30).reverse();
  logs.forEach(log => {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `
      <div>${log.text}</div>
      <div class="feed-time">${log.time}</div>
    `;
    container.appendChild(item);
  });
}

// Render Stats Tab
function renderStatsTab(room) {
  const total = room.stats.total || 250;
  const processed = room.stats.sold + room.stats.unsold;
  const pct = Math.round((processed / total) * 100);

  const bar = document.getElementById('auction-progress-bar');
  if (bar) bar.style.width = `${pct}%`;

  const progText = document.getElementById('stat-progress-text');
  if (progText) progText.textContent = `${processed} / ${total} processed`;

  const progPct = document.getElementById('stat-progress-pct');
  if (progPct) progPct.textContent = `${pct}%`;

  // Top buys list
  const topList = document.getElementById('top-buys-list');
  if (topList) {
    const soldPlayers = room.players
      .filter(p => p.status === 'Sold')
      .sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))
      .slice(0, 5);

    if (soldPlayers.length === 0) {
      topList.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem; padding:0.5rem 0">No players sold yet</div>`;
    } else {
      topList.innerHTML = '';
      soldPlayers.forEach(p => {
        const item = document.createElement('div');
        item.className = 'top-buy-item';
        item.innerHTML = `
          <div>
            <div style="font-weight:700">${p.name}</div>
            <div style="font-size:0.7rem; color:var(--text-muted)">${p.role} · ${p.soldTo}</div>
          </div>
          <div style="font-weight:800; color:#facc15">₹${p.soldPrice.toFixed(2)} Cr</div>
        `;
        topList.appendChild(item);
      });
    }
  }
}

// Update Budget Calculator in Strategy Tab
function updateBudgetCalculator(room, f) {
  if (!f) return;
  const minSquad = room.config.minSquad;
  const squadCount = f.squad.length;
  const remainingNeeded = Math.max(0, minSquad - (squadCount + 1));
  const reserveRequired = remainingNeeded * room.config.minReservePrice;
  const maxSafeBid = Math.max(0, Number((f.purse - reserveRequired).toFixed(2)));

  document.getElementById('calc-purse').textContent = `₹${f.purse.toFixed(2)} Cr`;
  document.getElementById('calc-needed').textContent = Math.max(0, minSquad - squadCount);
  document.getElementById('calc-reserve').textContent = `₹${reserveRequired.toFixed(2)} Cr`;
  document.getElementById('calc-max-bid').textContent = `₹${maxSafeBid.toFixed(2)} Cr`;
}

// Timer display & radial animation
function updateTimerDisplay(timer) {
  const timerText = document.getElementById('timer-seconds');
  const circle = document.getElementById('timer-progress-circle');

  if (!timerText || !circle) return;

  const maxTimer = (state.roomData && state.roomData.config && state.roomData.config.timerDuration) || 15;
  timerText.textContent = timer;
  const offset = 283 - (timer / maxTimer) * 283;
  circle.style.strokeDashoffset = Math.max(0, offset);

  if (timer <= 4) {
    circle.style.stroke = 'var(--accent-red)';
    timerText.classList.add('timer-critical');
    if (window.soundEngine) window.soundEngine.playTick(800);
  } else if (timer <= 8) {
    circle.style.stroke = 'var(--accent-gold)';
    timerText.classList.remove('timer-critical');
    if (window.soundEngine) window.soundEngine.playTick(500);
  } else {
    circle.style.stroke = 'var(--accent-green)';
    timerText.classList.remove('timer-critical');
  }
}

// Place bid (TEST 7, 15)
async function sendBid(amount) {
  if (!state.userFranchise) return;
  try {
    const res = await fetch('/api/room/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        franchiseCode: state.userFranchise,
        customAmount: amount
      })
    });
    const result = await res.json();
    if (!result.success) {
      alert(result.message || 'Bid rejected');
    }
  } catch (err) {
    console.error('Bid error:', err);
  }
}

// Host controls
async function togglePause() {
  if (!state.isHost) return;
  const isPaused = state.roomData && state.roomData.auction && state.roomData.auction.isPaused;
  const action = isPaused ? 'resume' : 'pause';
  await hostAction(action);
}

async function skipPlayer() {
  if (!state.isHost) return;
  if (confirm('Skip current player lot?')) {
    await hostAction('skip');
  }
}

async function resetAuction() {
  if (!state.isHost) return;
  if (confirm('Reset entire auction floor? All squads will be cleared.')) {
    await hostAction('reset_all');
  }
}

async function hostAction(action, payload = {}) {
  try {
    await fetch('/api/room/auctioneer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        action: action,
        ...payload
      })
    });
  } catch (err) {
    console.error('Host action error:', err);
  }
}

// Copy Invite Link (TEST 1)
function copyInviteLink() {
  const url = `${window.location.origin}${window.location.pathname}?room=${state.roomId || 'IPL-2026'}`;
  navigator.clipboard.writeText(url).then(() => {
    alert(`Invite Link Copied to Clipboard!\n\n${url}\n\nShare this link with your friends to join this room.`);
  }).catch(() => {
    prompt('Copy this room link:', url);
  });
}

// Switch Right Sidebar Tabs
function switchRightTab(tabName) {
  state.currentRightTab = tabName;

  document.getElementById('tab-btn-feed').classList.remove('active');
  document.getElementById('tab-btn-notes').classList.remove('active');
  document.getElementById('tab-btn-stats').classList.remove('active');

  document.getElementById('tab-content-feed').classList.add('hidden');
  document.getElementById('tab-content-notes').classList.add('hidden');
  document.getElementById('tab-content-stats').classList.add('hidden');

  if (tabName === 'feed') {
    document.getElementById('tab-btn-feed').classList.add('active');
    document.getElementById('tab-content-feed').classList.remove('hidden');
  } else if (tabName === 'notes') {
    document.getElementById('tab-btn-notes').classList.add('active');
    document.getElementById('tab-content-notes').classList.remove('hidden');
  } else if (tabName === 'stats') {
    document.getElementById('tab-btn-stats').classList.add('active');
    document.getElementById('tab-content-stats').classList.remove('hidden');
  }
}

// Private Strategy Notes (TEST 16)
function loadPrivateStrategyNotes() {
  const notepad = document.getElementById('strategy-notepad');
  if (!notepad) return;

  const key = `ipl_strategy_notes_${state.roomId || 'default'}_${state.userName || 'user'}`;
  const saved = localStorage.getItem(key);
  if (saved) notepad.value = saved;

  notepad.oninput = () => {
    const k = `ipl_strategy_notes_${state.roomId || 'default'}_${state.userName || 'user'}`;
    localStorage.setItem(k, notepad.value);
    const badge = document.getElementById('notes-save-status');
    if (badge) {
      badge.textContent = 'Saving...';
      badge.style.color = 'var(--accent-gold)';
      setTimeout(() => {
        badge.textContent = 'Saved';
        badge.style.color = 'var(--accent-green)';
      }, 400);
    }
  };
}

// Update User Pill
function updateUserPill() {
  const pill = document.getElementById('user-pill-text');
  if (state.userFranchise && state.roomData && state.roomData.franchises[state.userFranchise]) {
    const f = state.roomData.franchises[state.userFranchise];
    pill.innerHTML = `<span style="color:${f.color}; font-weight:800">${f.shortName}</span> - ${state.userName}`;
  } else if (state.isHost) {
    pill.innerHTML = `👑 Host (${state.userName})`;
  } else if (state.userName) {
    pill.textContent = state.userName;
  } else {
    pill.textContent = 'Not in Room';
  }
}

function addTickerMessage(msg) {
  const textEl = document.getElementById('ticker-text');
  if (textEl) textEl.textContent = msg;
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Squad Details Modal (Inspect Any Franchise Squad)
function openSquadModal(franchiseCode) {
  if (!state.roomData) return;
  const f = state.roomData.franchises[franchiseCode];
  if (!f) return;

  const modal = document.getElementById('squad-modal');
  document.getElementById('squad-modal-title').textContent = `${f.name} - Squad Roster`;

  const overseasCount = f.squad.filter(p => p.isOverseas).length;
  document.getElementById('squad-modal-summary').innerHTML = `
    <div style="display:flex; gap:1.5rem; flex-wrap:wrap; margin-bottom:1rem; font-size:0.9rem">
      <div><strong>Purse Left:</strong> <span style="color:#facc15">₹${f.purse.toFixed(2)} Cr</span></div>
      <div><strong>Total Spent:</strong> ₹${f.spent.toFixed(2)} Cr</div>
      <div><strong>Squad Size:</strong> ${f.squad.length}/${state.roomData.config.maxSquad} (Min ${state.roomData.config.minSquad})</div>
      <div><strong>Overseas Players:</strong> ${overseasCount}/${state.roomData.config.maxOverseas}</div>
    </div>
  `;

  const squadList = document.getElementById('squad-players-table');
  if (f.squad.length === 0) {
    squadList.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted)">No players purchased yet.</div>`;
  } else {
    let rows = `
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid var(--border-color); color:var(--text-muted)">
            <th style="padding:0.5rem">Player</th>
            <th style="padding:0.5rem">Role</th>
            <th style="padding:0.5rem">Type</th>
            <th style="padding:0.5rem">Rating</th>
            <th style="padding:0.5rem; text-align:right">Price</th>
          </tr>
        </thead>
        <tbody>
    `;

    f.squad.forEach(p => {
      rows += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
          <td style="padding:0.6rem 0.5rem; font-weight:700">${p.name}</td>
          <td style="padding:0.6rem 0.5rem">${p.role}</td>
          <td style="padding:0.6rem 0.5rem">${p.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian'}</td>
          <td style="padding:0.6rem 0.5rem"><span class="tag tag-role">${p.overallRating}</span></td>
          <td style="padding:0.6rem 0.5rem; text-align:right; font-weight:800; color:#facc15">₹${(p.boughtPrice || 0).toFixed(2)} Cr</td>
        </tr>
      `;
    });

    rows += `</tbody></table>`;
    squadList.innerHTML = rows;
  }

  modal.classList.remove('hidden');
}

// 250 Player Pool Modal
async function openPlayerPoolModal() {
  const modal = document.getElementById('pool-modal');
  modal.classList.remove('hidden');
  loadPlayerPool();
}

async function loadPlayerPool() {
  const roleFilter = document.getElementById('pool-role-filter') ? document.getElementById('pool-role-filter').value : '';
  const search = document.getElementById('pool-search-input') ? document.getElementById('pool-search-input').value : '';

  try {
    let url = `/api/players?room=${state.roomId || ''}`;
    if (roleFilter) url += `&role=${encodeURIComponent(roleFilter)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    const data = await res.json();

    const tbody = document.getElementById('pool-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    data.players.forEach(p => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

      const statusBadge = p.status === 'Sold'
        ? `<span class="tag tag-overseas">SOLD (${p.soldTo})</span>`
        : (p.status === 'Unsold' ? `<span class="tag" style="background:#475569">UNSOLD</span>` : `<span class="tag tag-india">AVAILABLE</span>`);

      tr.innerHTML = `
        <td style="padding:0.6rem 0.5rem; font-weight:700">${p.name}</td>
        <td style="padding:0.6rem 0.5rem">${p.role}</td>
        <td style="padding:0.6rem 0.5rem">${p.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian'}</td>
        <td style="padding:0.6rem 0.5rem"><span class="tag tag-role">${p.overallRating}</span></td>
        <td style="padding:0.6rem 0.5rem">₹${p.basePrice.toFixed(2)} Cr</td>
        <td style="padding:0.6rem 0.5rem">${statusBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Load pool error:', err);
  }
}

// Grand Finale / Auction Completed Modal (TEST 17)
function showCompletedModal(data) {
  const modal = document.getElementById('completed-modal');
  const body = document.getElementById('completed-modal-body');
  if (!modal || !body) return;

  const summary = data.summary || {};
  const franchises = data.franchises || (state.roomData && state.roomData.franchises) || {};

  let html = `
    <div style="text-align:center; margin-bottom:1.5rem">
      <div style="font-size:3rem">🏆</div>
      <h2 style="font-size:1.8rem; font-weight:900; color:#facc15">IPL 2026 MEGA AUCTION CONCLUDED</h2>
      <p style="color:var(--text-muted); font-size:0.95rem">All 10 franchises have built their squads under official BCCI budget regulations.</p>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.5rem">
      <div class="stat-box" style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; border:1px solid var(--border-color)">
        <span class="stat-label">Total Sold</span>
        <span class="stat-value" style="color:var(--accent-green)">${summary.totalSold || 0} Players</span>
      </div>
      <div class="stat-box" style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; border:1px solid var(--border-color)">
        <span class="stat-label">Total Unsold</span>
        <span class="stat-value" style="color:var(--accent-red)">${summary.totalUnsold || 0} Players</span>
      </div>
      <div class="stat-box" style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; border:1px solid var(--border-color)">
        <span class="stat-label">Total Spent</span>
        <span class="stat-value" style="color:#38bdf8">₹${summary.totalSpent || 0} Cr</span>
      </div>
    </div>

    <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:0.75rem">Franchise Leaderboard & Final Purse</h3>
    <div style="overflow-x:auto">
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid var(--border-color); color:var(--text-muted)">
            <th style="padding:0.5rem">Franchise</th>
            <th style="padding:0.5rem">Manager</th>
            <th style="padding:0.5rem">Squad</th>
            <th style="padding:0.5rem">Overseas</th>
            <th style="padding:0.5rem">Spent</th>
            <th style="padding:0.5rem; text-align:right">Remaining Purse</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const [code, f] of Object.entries(franchises)) {
    const osCount = f.squad.filter(p => p.isOverseas).length;
    html += `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer" onclick="openSquadModal('${code}')">
        <td style="padding:0.6rem 0.5rem; font-weight:700">
          <span style="background:${f.color}; color:${f.textColor}; padding:0.15rem 0.4rem; border-radius:4px; font-size:0.75rem; margin-right:0.4rem">${f.shortName}</span>
          ${f.name}
        </td>
        <td style="padding:0.6rem 0.5rem">${f.user ? `👤 ${f.user}` : '🤖 AI Bot'}</td>
        <td style="padding:0.6rem 0.5rem">${f.squad.length}</td>
        <td style="padding:0.6rem 0.5rem">${osCount}</td>
        <td style="padding:0.6rem 0.5rem">₹${f.spent.toFixed(2)} Cr</td>
        <td style="padding:0.6rem 0.5rem; text-align:right; font-weight:800; color:#facc15">₹${f.purse.toFixed(2)} Cr</td>
      </tr>
    `;
  }

  html += `</tbody></table></div>`;
  body.innerHTML = html;
  modal.classList.remove('hidden');
}

// Event Listeners
function setupEventListeners() {
  document.getElementById('btn-view-pool').onclick = openPlayerPoolModal;
  document.getElementById('btn-toggle-sound').onclick = () => {
    if (window.soundEngine) {
      const isMuted = window.soundEngine.toggleMute();
      document.getElementById('sound-icon').textContent = isMuted ? '🔇' : '🔊';
    }
  };

  const searchInput = document.getElementById('pool-search-input');
  if (searchInput) searchInput.oninput = loadPlayerPool;
  const roleSelect = document.getElementById('pool-role-filter');
  if (roleSelect) roleSelect.onchange = loadPlayerPool;
}
