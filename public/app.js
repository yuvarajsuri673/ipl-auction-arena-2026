// IPL Auction Arena 2026 - Professional Mobile-First Real-time Bidding Platform
// Modular Single Page Application supporting 7 Dedicated Navigation Pages

const state = {
  currentPage: 'dashboard', // 'dashboard', 'bidding', 'teams', 'players', 'history', 'strategy', 'settings'
  roomId: null,
  userName: localStorage.getItem('ipl_user_name') || '',
  isHost: false,
  userFranchise: null,
  roomData: null,
  eventSource: null,
  intermissionInterval: null,
  selectedSquadRole: 'all',
  inspectingFranchise: null,
  theme: localStorage.getItem('ipl_theme') || 'dark',
  voiceAssistant: localStorage.getItem('ipl_voice_assistant') === 'true', // Default OFF
  soundEffects: localStorage.getItem('ipl_sound_effects') !== 'false'     // Default ON
};

// -----------------------------------------------------------------------------
// 1. INITIALIZATION & DOM READY
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAudioPreferences();
  setupEventListeners();

  // Check URL parameters for room code
  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room');
  const storedRoom = localStorage.getItem('ipl_active_room');
  const activeRoom = (urlRoom || storedRoom || 'IPL-2026').trim().toUpperCase();

  const joinRoomInput = document.getElementById('join-room-id');
  if (joinRoomInput) joinRoomInput.value = activeRoom;

  if (state.userName) {
    const joinNameInput = document.getElementById('join-user-name');
    if (joinNameInput) joinNameInput.value = state.userName;
  }

  // Auto-recover session if active room exists (TEST 14)
  if (storedRoom && state.userName) {
    autoRecoverSession(storedRoom);
  }
});

// Auto-recover session on refresh (TEST 14)
async function autoRecoverSession(roomId) {
  try {
    const res = await fetch(`/api/state?room=${roomId}`);
    if (!res.ok) return;

    const room = await res.json();
    state.roomId = roomId;
    state.roomData = room;

    const hostFlag = localStorage.getItem(`ipl_is_host_${roomId}`);
    if (hostFlag === 'true' || room.hostName === state.userName) {
      state.isHost = true;
    }

    // Identify user claimed franchise
    for (const [code, f] of Object.entries(room.franchises || {})) {
      if (f.user === state.userName) {
        state.userFranchise = code;
        break;
      }
    }

    initRoomSSE(roomId);
    switchScreen('app');

    // Default to Live Bidding if auction is active, otherwise Dashboard
    if (room.stage === 'active') {
      navigateTo('bidding');
    } else {
      navigateTo('dashboard');
    }

    updateUserPill();
    renderCurrentPage();
  } catch (err) {
    console.warn('Auto recovery failed:', err);
  }
}

// -----------------------------------------------------------------------------
// 2. NAVIGATION SYSTEM (7 SECTIONS)
// -----------------------------------------------------------------------------
function navigateTo(pageName) {
  state.currentPage = pageName;

  // Toggle Page Views
  document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
  const activePage = document.getElementById(`page-${pageName}`);
  if (activePage) activePage.classList.remove('hidden');

  // Update Desktop Nav Tabs
  document.querySelectorAll('.desktop-nav .nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-page') === pageName);
  });

  // Update Mobile Bottom Bar
  document.querySelectorAll('.mobile-bottom-bar .mob-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-page') === pageName);
  });

  // Update Mobile Drawer Links
  document.querySelectorAll('.drawer-nav .drawer-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('data-page') === pageName);
  });

  // Close Mobile Drawer if open
  toggleMobileDrawer(false);

  // Trigger page-specific data updates
  if (pageName === 'players') {
    loadPlayerPool();
  } else if (pageName === 'history') {
    renderHistoryPage();
  } else if (pageName === 'strategy') {
    loadPrivateStrategyNotes();
    updateBudgetCalculator();
  } else if (pageName === 'teams') {
    renderTeamsPage();
  } else if (pageName === 'dashboard') {
    renderDashboard();
  } else if (pageName === 'bidding') {
    renderLiveBidding();
  }
}

function navigateFromDrawer(pageName) {
  navigateTo(pageName);
}

function toggleMobileDrawer(open) {
  const overlay = document.getElementById('mobile-drawer-overlay');
  if (!overlay) return;
  if (open === undefined) {
    overlay.classList.toggle('hidden');
  } else if (open) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

function switchScreen(screenName) {
  const landing = document.getElementById('screen-landing');
  const app = document.getElementById('screen-app');
  const leaveBtn = document.getElementById('btn-leave-room');
  const roomTag = document.getElementById('header-room-tag');

  if (screenName === 'landing') {
    if (landing) landing.classList.remove('hidden');
    if (app) app.classList.add('hidden');
    if (leaveBtn) leaveBtn.classList.add('hidden');
    if (roomTag) roomTag.textContent = 'HOME';
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }
    localStorage.removeItem('ipl_active_room');
  } else {
    if (landing) landing.classList.add('hidden');
    if (app) app.classList.remove('hidden');
    if (leaveBtn) leaveBtn.classList.remove('hidden');
    if (roomTag) roomTag.textContent = state.roomId || 'ROOM';
    const drawerCode = document.getElementById('drawer-room-code');
    if (drawerCode) drawerCode.textContent = `Room: ${state.roomId || 'IPL-2026'}`;
  }
}

function goHome() {
  if (confirm('Are you sure you want to exit the current auction room?')) {
    switchScreen('landing');
  }
}

// -----------------------------------------------------------------------------
// 3. THEME TOGGLE (LIGHT / DARK MODE)
// -----------------------------------------------------------------------------
function initTheme() {
  const theme = state.theme || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeUI(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  state.theme = newTheme;
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('ipl_theme', newTheme);
  updateThemeUI(newTheme);
}

function updateThemeUI(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '🌙' : '☀️';

  const settingBtnText = document.getElementById('setting-theme-btn-text');
  if (settingBtnText) {
    settingBtnText.textContent = theme === 'dark' ? 'Switch to Light Mode ☀️' : 'Switch to Dark Mode 🌙';
  }
}

// -----------------------------------------------------------------------------
// 4. VOICE ASSISTANT & AUDIO (REQUIREMENT 3: VOICE ASSISTANT DEFAULT OFF)
// -----------------------------------------------------------------------------
function initAudioPreferences() {
  // Voice Assistant: Default is OFF
  const voiceAssistant = state.voiceAssistant;
  if (window.soundEngine) {
    window.soundEngine.setVoiceAssistant(voiceAssistant);
  }
  updateVoiceAssistantUI(voiceAssistant);

  // Sound Effects: Default is ON
  const soundEffects = state.soundEffects;
  if (window.soundEngine) {
    window.soundEngine.setMute(!soundEffects);
  }
  updateSoundUI(soundEffects);
}

function toggleVoiceAssistant() {
  const newState = !state.voiceAssistant;
  setVoiceAssistantState(newState);
}

function toggleVoiceAssistantFromSetting(checked) {
  setVoiceAssistantState(checked);
}

function setVoiceAssistantState(enabled) {
  state.voiceAssistant = enabled;
  localStorage.setItem('ipl_voice_assistant', enabled ? 'true' : 'false');
  if (window.soundEngine) {
    window.soundEngine.setVoiceAssistant(enabled);
  }
  updateVoiceAssistantUI(enabled);

  if (enabled && window.soundEngine) {
    window.soundEngine.speak('Voice assistant announcer enabled.');
  }
}

function updateVoiceAssistantUI(enabled) {
  const badge = document.getElementById('voice-badge');
  if (badge) {
    badge.textContent = enabled ? 'ON' : 'OFF';
    badge.className = `voice-badge ${enabled ? 'on' : 'off'}`;
  }

  const settingCheck = document.getElementById('setting-voice-assistant');
  if (settingCheck) settingCheck.checked = enabled;

  const statusText = document.getElementById('setting-voice-status');
  if (statusText) {
    statusText.textContent = enabled ? 'Enabled (ON)' : 'Disabled (OFF)';
    statusText.style.color = enabled ? 'var(--accent-green)' : 'var(--text-muted)';
  }
}

function toggleSound() {
  const newState = !state.soundEffects;
  setSoundState(newState);
}

function toggleSoundFromSetting(checked) {
  setSoundState(checked);
}

function setSoundState(enabled) {
  state.soundEffects = enabled;
  localStorage.setItem('ipl_sound_effects', enabled ? 'true' : 'false');
  if (window.soundEngine) {
    window.soundEngine.setMute(!enabled);
  }
  updateSoundUI(enabled);
}

function updateSoundUI(enabled) {
  const icon = document.getElementById('sound-icon');
  if (icon) icon.textContent = enabled ? '🔊' : '🔇';

  const settingCheck = document.getElementById('setting-sound-effects');
  if (settingCheck) settingCheck.checked = enabled;
}

// -----------------------------------------------------------------------------
// 5. ROOM CREATION, JOINING & FRANCHISE CLAIMING
// -----------------------------------------------------------------------------
async function createRoomAsHost() {
  const hostName = (document.getElementById('host-create-name').value || 'Auctioneer').trim();
  const roomId = (document.getElementById('host-create-room-id').value || 'IPL-2026').trim().toUpperCase();
  const purse = parseFloat(document.getElementById('host-create-purse').value) || 120.0;
  const timer = parseInt(document.getElementById('host-create-timer').value, 10) || 15;
  const squadVal = document.getElementById('host-create-squad').value || '18-25';
  const [minSquad, maxSquad] = squadVal.split('-').map(Number);

  try {
    const res = await fetch('/api/create-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        hostName,
        teamCount: 10,
        initialPurse: purse,
        minSquad: minSquad || 18,
        maxSquad: maxSquad || 25,
        maxOverseas: 8,
        timerDuration: timer
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to create room');
      return;
    }

    state.roomId = roomId;
    state.userName = hostName;
    state.isHost = true;
    state.roomData = data.room;

    localStorage.setItem('ipl_active_room', roomId);
    localStorage.setItem('ipl_user_name', hostName);
    localStorage.setItem(`ipl_is_host_${roomId}`, 'true');

    initRoomSSE(roomId);
    switchScreen('app');
    navigateTo('bidding');
    updateUserPill();
    renderCurrentPage();

    if (window.soundEngine) window.soundEngine.playGavelStrike();
  } catch (err) {
    alert('Error connecting to server. Please try again.');
  }
}

async function joinRoomAsPlayer() {
  const userName = (document.getElementById('join-user-name').value || '').trim();
  const roomId = (document.getElementById('join-room-id').value || 'IPL-2026').trim().toUpperCase();

  if (!userName) {
    alert('Please enter your manager name to join.');
    return;
  }

  try {
    const res = await fetch('/api/join-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userName })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to join room');
      return;
    }

    state.roomId = roomId;
    state.userName = userName;
    state.roomData = data.room;
    state.isHost = (data.room.hostName === userName) || (localStorage.getItem(`ipl_is_host_${roomId}`) === 'true');

    // Check if user has an existing franchise
    for (const [code, f] of Object.entries(data.room.franchises || {})) {
      if (f.user === userName) {
        state.userFranchise = code;
        break;
      }
    }

    localStorage.setItem('ipl_active_room', roomId);
    localStorage.setItem('ipl_user_name', userName);

    initRoomSSE(roomId);
    switchScreen('app');

    if (data.room.stage === 'active') {
      navigateTo('bidding');
    } else {
      navigateTo('dashboard');
    }

    updateUserPill();
    renderCurrentPage();

    if (window.soundEngine) window.soundEngine.playBidChime();
  } catch (err) {
    alert('Error connecting to room. Please check the room code.');
  }
}

async function claimFranchise(code) {
  if (!state.roomId || !state.userName) {
    alert('Please enter the room with a manager name first.');
    return;
  }

  try {
    const res = await fetch('/api/claim-franchise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        userName: state.userName,
        franchiseCode: code
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to claim franchise');
      return;
    }

    state.userFranchise = code;
    state.roomData = data.room;
    updateUserPill();
    renderCurrentPage();

    if (window.soundEngine) window.soundEngine.playBidChime();
  } catch (err) {
    alert('Network error claiming franchise');
  }
}

async function startAuctionFromLobby() {
  if (!state.isHost) return;

  try {
    const res = await fetch('/api/host-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        userName: state.userName,
        action: 'start'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Could not start auction');
      return;
    }

    state.roomData = data.room;
    navigateTo('bidding');
    renderCurrentPage();

    if (window.soundEngine) {
      window.soundEngine.playGavelStrike();
      window.soundEngine.announceAuctionStart();
    }
  } catch (err) {
    alert('Network error starting auction');
  }
}

// -----------------------------------------------------------------------------
// 6. REAL-TIME SERVER-SENT EVENTS (SSE)
// -----------------------------------------------------------------------------
function initRoomSSE(roomId) {
  if (state.eventSource) {
    state.eventSource.close();
  }

  const url = `/api/stream?room=${encodeURIComponent(roomId)}`;
  state.eventSource = new EventSource(url);

  // Full state snapshot broadcast
  state.eventSource.addEventListener('state_update', (e) => {
    try {
      const room = JSON.parse(e.data);
      state.roomData = room;
      syncUserFranchise(room);
      renderCurrentPage();
    } catch (err) {
      console.warn('Error parsing state_update:', err);
    }
  });

  // Bid placed event
  state.eventSource.addEventListener('bid_placed', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (state.roomData && state.roomData.auction) {
        state.roomData.auction.currentBid = data.amount;
        state.roomData.auction.currentBidder = data.franchise;
        state.roomData.auction.currentBidderName = data.franchiseName;
        state.roomData.auction.timer = data.timer;
        if (data.log) {
          if (!state.roomData.auction.bidHistory) state.roomData.auction.bidHistory = [];
          state.roomData.auction.bidHistory.push(data.log);
        }
      }

      addTickerMessage(`⚡ BID: ${data.franchiseName} bids ₹${data.amount.toFixed(2)} Cr!`);

      if (window.soundEngine) {
        window.soundEngine.playBidChime();
        window.soundEngine.announceBid(data.franchiseName, data.amount);
      }

      renderCurrentPage();
    } catch (err) {
      console.warn('Error parsing bid_placed:', err);
    }
  });

  // Timer tick
  state.eventSource.addEventListener('timer_tick', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (state.roomData && state.roomData.auction) {
        state.roomData.auction.timer = data.timer;
        updateTimerDisplay(data.timer);
      }
      if (data.timer <= 3 && data.timer > 0 && window.soundEngine) {
        window.soundEngine.playTick(data.timer === 1 ? 800 : 600);
      }
    } catch (err) {
      console.warn('Error parsing timer_tick:', err);
    }
  });

  // Player sold
  state.eventSource.addEventListener('player_sold', (e) => {
    try {
      const data = JSON.parse(e.data);
      showOutcomeIntermission('sold', data);

      if (window.soundEngine) {
        window.soundEngine.playSoldFanfare();
        window.soundEngine.announceSold(data.player.name, data.franchiseName, data.price);
      }

      addTickerMessage(`🔨 SOLD! ${data.player.name} bought by ${data.franchiseName} for ₹${data.price.toFixed(2)} Cr`);
      renderCurrentPage();
    } catch (err) {
      console.warn('Error parsing player_sold:', err);
    }
  });

  // Player unsold
  state.eventSource.addEventListener('player_unsold', (e) => {
    try {
      const data = JSON.parse(e.data);
      showOutcomeIntermission('unsold', data);

      if (window.soundEngine) {
        window.soundEngine.playGavelStrike();
        window.soundEngine.announceUnsold(data.player.name);
      }

      addTickerMessage(`⚠️ UNSOLD: ${data.player.name} received no bids.`);
      renderCurrentPage();
    } catch (err) {
      console.warn('Error parsing player_unsold:', err);
    }
  });

  // New lot selected
  state.eventSource.addEventListener('player_selected', (e) => {
    try {
      const data = JSON.parse(e.data);
      hideOutcomeIntermission();

      if (window.soundEngine) {
        window.soundEngine.playNewLot();
        window.soundEngine.announceNewPlayer(data.player);
      }

      addTickerMessage(`🏏 ON PODIUM: ${data.player.name} (${data.player.role}, ₹${data.player.basePrice.toFixed(2)} Cr)`);
      renderCurrentPage();
    } catch (err) {
      console.warn('Error parsing player_selected:', err);
    }
  });

  // Auction started
  state.eventSource.addEventListener('auction_started', () => {
    if (state.roomData) state.roomData.stage = 'active';
    navigateTo('bidding');
    if (window.soundEngine) {
      window.soundEngine.playGavelStrike();
      window.soundEngine.announceAuctionStart();
    }
    renderCurrentPage();
  });

  // Pause / Resume
  state.eventSource.addEventListener('auction_paused', () => {
    if (state.roomData && state.roomData.auction) {
      state.roomData.auction.isPaused = true;
      state.roomData.auction.status = 'paused';
    }
    const icon = document.getElementById('bidding-pause-icon');
    if (icon) icon.textContent = '▶️';
    renderLiveBidding();
  });

  state.eventSource.addEventListener('auction_resumed', () => {
    if (state.roomData && state.roomData.auction) {
      state.roomData.auction.isPaused = false;
      state.roomData.auction.status = 'bidding';
    }
    const icon = document.getElementById('bidding-pause-icon');
    if (icon) icon.textContent = '⏸️';
    renderLiveBidding();
  });

  // Completed
  state.eventSource.addEventListener('auction_completed', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (state.roomData) state.roomData.stage = 'completed';
      showCompletedModal(data);
      if (window.soundEngine) window.soundEngine.announceConclusion();
    } catch (err) {
      console.warn('Error parsing auction_completed:', err);
    }
  });

  state.eventSource.onerror = () => {
    console.warn('SSE connection interrupted, retrying in background...');
  };
}

function syncUserFranchise(room) {
  for (const [code, f] of Object.entries(room.franchises || {})) {
    if (f.user === state.userName) {
      state.userFranchise = code;
      break;
    }
  }
  updateUserPill();
}

function showOutcomeIntermission(type, data) {
  const banner = document.getElementById('outcome-banner');
  if (!banner) return;

  const icon = document.getElementById('outcome-icon');
  const title = document.getElementById('outcome-title');
  const sub = document.getElementById('outcome-subtitle');
  const cd = document.getElementById('outcome-countdown');

  if (type === 'sold') {
    if (icon) icon.textContent = '🔨';
    if (title) {
      title.textContent = 'SOLD!';
      title.style.color = 'var(--accent-green)';
    }
    if (sub) sub.textContent = `${data.player.name} acquired by ${data.franchise.name} for ₹${data.price.toFixed(2)} Cr`;
  } else {
    if (icon) icon.textContent = '❌';
    if (title) {
      title.textContent = 'UNSOLD';
      title.style.color = 'var(--accent-red)';
    }
    if (sub) sub.textContent = `${data.player.name} passed with zero bids. Added to re-auction pool.`;
  }

  banner.classList.remove('hidden');

  let remaining = 3;
  if (cd) cd.textContent = remaining;

  if (state.intermissionInterval) clearInterval(state.intermissionInterval);
  state.intermissionInterval = setInterval(() => {
    remaining--;
    if (cd) cd.textContent = Math.max(0, remaining);
    if (remaining <= 0) {
      clearInterval(state.intermissionInterval);
      state.intermissionInterval = null;
    }
  }, 1000);
}

function hideOutcomeIntermission() {
  const banner = document.getElementById('outcome-banner');
  if (banner) banner.classList.add('hidden');
  if (state.intermissionInterval) {
    clearInterval(state.intermissionInterval);
    state.intermissionInterval = null;
  }
}

// -----------------------------------------------------------------------------
// 7. RENDER DISPATCHER
// -----------------------------------------------------------------------------
function renderCurrentPage() {
  updateUserPill();

  // Update Live Bidding Indicator Dot
  const dot = document.getElementById('live-bidding-dot');
  if (dot) {
    const isLive = state.roomData && state.roomData.stage === 'active';
    dot.style.display = isLive ? 'inline-block' : 'none';
  }

  switch (state.currentPage) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'bidding':
      renderLiveBidding();
      break;
    case 'teams':
      renderTeamsPage();
      break;
    case 'players':
      // Players page refreshes on explicit filter or search
      break;
    case 'history':
      renderHistoryPage();
      break;
    case 'strategy':
      updateBudgetCalculator();
      break;
    case 'settings':
      // Settings synced
      break;
  }
}

// -----------------------------------------------------------------------------
// 8. PAGE 1: AUCTION DASHBOARD
// -----------------------------------------------------------------------------
function renderDashboard() {
  const room = state.roomData;
  if (!room) return;

  const totalPool = (room.players || []).length || 250;
  const soldCount = (room.players || []).filter(p => p.status === 'Sold').length;
  const unsoldCount = (room.players || []).filter(p => p.status === 'Unsold').length;
  const processed = soldCount + unsoldCount;

  let totalSpent = 0;
  Object.values(room.franchises || {}).forEach(f => { totalSpent += (f.spent || 0); });

  // Update KPIs
  const progressText = document.getElementById('kpi-progress-text');
  if (progressText) progressText.textContent = `${processed} / ${totalPool}`;

  const progressBar = document.getElementById('kpi-progress-bar');
  if (progressBar) {
    const pct = totalPool > 0 ? (processed / totalPool) * 100 : 0;
    progressBar.style.width = `${pct}%`;
  }

  const soldEl = document.getElementById('kpi-sold-count');
  if (soldEl) soldEl.textContent = soldCount;

  const soldSub = document.getElementById('kpi-sold-sub');
  if (soldSub) {
    const pct = totalPool > 0 ? ((soldCount / totalPool) * 100).toFixed(1) : 0;
    soldSub.textContent = `${pct}% of pool`;
  }

  const unsoldEl = document.getElementById('kpi-unsold-count');
  if (unsoldEl) unsoldEl.textContent = unsoldCount;

  const spentEl = document.getElementById('kpi-total-spent');
  if (spentEl) spentEl.textContent = `₹${totalSpent.toFixed(2)} Cr`;

  // Spotlight Lot Card
  const spotName = document.getElementById('spotlight-player-name');
  const spotDetails = document.getElementById('spotlight-player-details');
  const spotPrice = document.getElementById('spotlight-price');
  const spotBadge = document.getElementById('spotlight-status-badge');

  if (room.stage === 'lobby') {
    if (spotBadge) spotBadge.textContent = 'AUCTION LOBBY';
    if (spotName) spotName.textContent = 'Waiting for Host to Start Auction';
    if (spotDetails) spotDetails.textContent = 'Claim your franchise and prepare private strategy notes before bidding opens.';
    if (spotPrice) spotPrice.textContent = '₹120.00 Cr Cap';
  } else if (room.stage === 'completed') {
    if (spotBadge) spotBadge.textContent = 'AUCTION CONCLUDED';
    if (spotName) spotName.textContent = 'Mega Auction Complete';
    if (spotDetails) spotDetails.textContent = `All lots processed. ${soldCount} players signed across 10 franchises.`;
    if (spotPrice) spotPrice.textContent = `₹${totalSpent.toFixed(2)} Cr Total`;
  } else if (room.auction && room.auction.currentPlayer) {
    const p = room.auction.currentPlayer;
    if (spotBadge) spotBadge.textContent = `LOT #${(room.auction.lotIndex || 0) + 1} LIVE`;
    if (spotName) spotName.textContent = p.name;
    if (spotDetails) spotDetails.textContent = `${p.role} · ${p.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian'} · Rating: ${p.overallRating || 85}`;
    if (spotPrice) spotPrice.textContent = `₹${room.auction.currentBid.toFixed(2)} Cr`;
  }

  // Leaderboard Grid (10 Franchises)
  const grid = document.getElementById('dashboard-teams-grid');
  if (!grid) return;

  grid.innerHTML = '';
  Object.entries(room.franchises || {}).forEach(([code, f]) => {
    const osCount = (f.squad || []).filter(p => p.isOverseas).length;
    const card = document.createElement('div');
    card.className = 'team-summary-card';
    card.style.borderTop = `3px solid ${f.color || '#3b82f6'}`;

    card.innerHTML = `
      <div class="team-sum-header">
        <span class="team-sum-badge" style="background:${f.color || '#3b82f6'}; color:${f.textColor || '#fff'}">${f.shortName}</span>
        <div style="flex:1; min-width:0">
          <div class="team-sum-name">${f.name}</div>
          <div class="team-sum-manager">${f.user ? `👤 ${f.user}` : '🤖 AI Bot'}</div>
        </div>
      </div>
      <div class="team-sum-metrics">
        <div>
          <div class="team-sum-label">Purse Remaining</div>
          <div class="team-sum-val team-sum-purse">₹${(f.purse || 0).toFixed(2)} Cr</div>
        </div>
        <div style="text-align:right">
          <div class="team-sum-label">Squad Size</div>
          <div class="team-sum-val">${(f.squad || []).length} / ${room.config.maxSquad || 25}</div>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem; font-size:0.75rem; color:var(--text-muted)">
        <span>Overseas: ${osCount}/${room.config.maxOverseas || 8}</span>
        <button class="btn-link" onclick="openSquadModal('${code}')">View Roster →</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// -----------------------------------------------------------------------------
// 9. PAGE 2: LIVE BIDDING FLOOR
// -----------------------------------------------------------------------------
function renderLiveBidding() {
  const room = state.roomData;
  if (!room) return;

  const lobbyState = document.getElementById('bidding-lobby-state');
  const activeState = document.getElementById('bidding-active-state');
  const headerControls = document.getElementById('bidding-header-controls');

  if (room.stage === 'lobby') {
    if (lobbyState) lobbyState.classList.remove('hidden');
    if (activeState) activeState.classList.add('hidden');
    if (headerControls) headerControls.classList.add('hidden');
    renderLobbyInBidding(room);
    return;
  }

  if (lobbyState) lobbyState.classList.add('hidden');
  if (activeState) activeState.classList.remove('hidden');
  if (headerControls) headerControls.classList.remove('hidden');

  renderActivePodium(room);
  renderActivityFeed(room);
}

function renderLobbyInBidding(room) {
  const roomCodeText = document.getElementById('bidding-lobby-room-code');
  if (roomCodeText) roomCodeText.textContent = state.roomId;

  const hostBar = document.getElementById('bidding-host-bar');
  if (hostBar) {
    hostBar.classList.toggle('hidden', !state.isHost);
  }

  const claimedCount = Object.values(room.franchises || {}).filter(f => f.user !== null).length;
  const countEl = document.getElementById('lobby-claimed-count');
  if (countEl) countEl.textContent = claimedCount;

  const grid = document.getElementById('lobby-teams-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(room.franchises || {}).forEach(([code, f]) => {
    const isClaimedByMe = f.user === state.userName;
    const isTaken = f.user !== null && !isClaimedByMe;

    const card = document.createElement('div');
    card.className = `lobby-franchise-card ${isClaimedByMe ? 'selected' : ''} ${isTaken ? 'taken' : ''}`;
    card.style.borderTop = `3px solid ${f.color || '#3b82f6'}`;

    let actionBtn = '';
    if (isClaimedByMe) {
      actionBtn = `<div style="font-size:0.8rem; font-weight:800; color:var(--accent-green); text-align:center">✓ Your Selected Franchise</div>`;
    } else if (isTaken) {
      actionBtn = `<div style="font-size:0.8rem; color:var(--text-muted); text-align:center">Claimed by ${f.user}</div>`;
    } else {
      actionBtn = `
        <button class="btn-primary-action" onclick="claimFranchise('${code}')" style="width:100%; font-size:0.85rem; padding:0.5rem">
          Select ${f.shortName}
        </button>
      `;
    }

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem">
        <span class="team-sum-badge" style="background:${f.color}; color:${f.textColor}">${f.shortName}</span>
        <div>
          <div style="font-weight:800; font-size:0.95rem">${f.name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">Starting Purse: ₹${(f.purse || 120).toFixed(2)} Cr</div>
        </div>
      </div>
      ${actionBtn}
    `;

    grid.appendChild(card);
  });
}

function renderActivePodium(room) {
  const player = room.auction.currentPlayer;
  if (!player) return;

  // Player avatar & lot tag
  const lotTag = document.getElementById('player-lot-tag');
  if (lotTag) lotTag.textContent = `LOT #${(room.auction.lotIndex || 0) + 1}`;

  const ratingPill = document.getElementById('player-rating-pill');
  if (ratingPill) ratingPill.textContent = player.overallRating || 85;

  const initialsEl = document.getElementById('player-avatar-initials');
  if (initialsEl) {
    const parts = (player.name || '').split(' ');
    initialsEl.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : (player.name || 'PL').slice(0, 2).toUpperCase();
  }

  // Tags
  const roleTag = document.getElementById('player-role-tag');
  if (roleTag) roleTag.textContent = player.role || 'Batter';

  const natTag = document.getElementById('player-nationality-tag');
  if (natTag) {
    natTag.textContent = player.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian';
    natTag.className = `tag ${player.isOverseas ? 'tag-overseas' : 'tag-india'}`;
  }

  const wkTag = document.getElementById('player-wk-tag');
  if (wkTag) {
    wkTag.classList.toggle('hidden', !player.isWicketkeeper);
  }

  // Name & bio
  const nameEl = document.getElementById('player-full-name');
  if (nameEl) nameEl.textContent = player.name;

  const metaEl = document.getElementById('player-meta-row');
  if (metaEl) {
    const batStyle = player.battingStyle || 'Right-hand Bat';
    const bowlStyle = player.bowlingStyle ? ` · ${player.bowlingStyle}` : '';
    const nat = player.nationality ? ` · ${player.nationality}` : '';
    metaEl.textContent = `${batStyle}${bowlStyle}${nat}`;
  }

  // Performance stats
  const runsEl = document.getElementById('stat-runs');
  if (runsEl) runsEl.textContent = player.runs !== undefined && player.runs !== null ? player.runs : '--';

  const srEl = document.getElementById('stat-sr');
  if (srEl) srEl.textContent = player.strikeRate ? player.strikeRate.toFixed(1) : '--';

  const wktEl = document.getElementById('stat-wickets');
  if (wktEl) wktEl.textContent = player.wickets !== undefined && player.wickets !== null ? player.wickets : '--';

  const econEl = document.getElementById('stat-econ');
  if (econEl) econEl.textContent = player.economy ? player.economy.toFixed(2) : '--';

  // ---------------------------------------------------------------------------
  // REQUIREMENT 4 & 6: STANDARDISED 3-VALUE PRICE SYSTEM
  // ---------------------------------------------------------------------------
  const basePrice = player.basePrice || 2.0;
  const currentBid = room.auction.currentBid || basePrice;
  const currentBidder = room.auction.currentBidder;
  const currentBidderName = room.auction.currentBidderName;

  // Calculate increment according to standard tiers
  const increment = getNextBidIncrement(currentBid);
  const nextBid = currentBidder ? Number((currentBid + increment).toFixed(2)) : currentBid;

  // Value 1: Base Price
  const basePriceEl = document.getElementById('display-base-price');
  if (basePriceEl) basePriceEl.textContent = `₹${basePrice.toFixed(2)} Cr`;

  // Value 2: Current Bid
  const currentBidEl = document.getElementById('display-current-bid');
  if (currentBidEl) currentBidEl.textContent = `₹${currentBid.toFixed(2)} Cr`;

  const bidderInfoEl = document.getElementById('display-bidder-info');
  if (bidderInfoEl) {
    if (currentBidder) {
      const f = room.franchises[currentBidder];
      const color = f ? f.color : '#3b82f6';
      bidderInfoEl.innerHTML = `<span class="bidder-pill" style="border-color:${color}; color:${color}">● ${currentBidderName || currentBidder}</span>`;
    } else {
      bidderInfoEl.innerHTML = `<span class="bidder-pill">Starting Base Price</span>`;
    }
  }

  // Value 3: Next Valid Bid
  const nextBidEl = document.getElementById('display-next-bid');
  if (nextBidEl) nextBidEl.textContent = `₹${nextBid.toFixed(2)} Cr`;

  const incrementSubEl = document.getElementById('display-increment-sub');
  if (incrementSubEl) {
    const incLakhs = Math.round(increment * 100);
    const incLabel = incLakhs >= 100 ? `₹${(incLakhs / 100).toFixed(2)} Cr` : `₹${incLakhs} Lakhs`;
    incrementSubEl.textContent = `+${incLabel} tier`;
  }

  // Manager Franchise Status Box
  const userFranchiseBox = document.getElementById('user-franchise-info');
  if (userFranchiseBox) {
    if (state.userFranchise && room.franchises[state.userFranchise]) {
      const myF = room.franchises[state.userFranchise];
      const osCount = (myF.squad || []).filter(p => p.isOverseas).length;
      userFranchiseBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem">
          <div>
            <strong style="color:${myF.color}">Your Team: ${myF.name} (${myF.shortName})</strong>
            <div style="font-size:0.75rem; color:var(--text-muted)">Squad: ${myF.squad.length}/25 · Overseas: ${osCount}/8</div>
          </div>
          <div style="text-align:right">
            <span style="font-size:0.75rem; color:var(--text-muted)">Purse Balance</span>
            <div style="font-size:1.05rem; font-weight:800; color:var(--accent-gold)">₹${myF.purse.toFixed(2)} Cr</div>
          </div>
        </div>
      `;
    } else {
      userFranchiseBox.innerHTML = `
        <div style="font-size:0.85rem; color:var(--text-muted)">
          ⚠️ You have not selected a franchise. Go to <a href="#" onclick="navigateTo('bidding'); return false;" style="color:var(--accent-gold); font-weight:700">Lobby</a> to claim one.
        </div>
      `;
    }
  }

  // ---------------------------------------------------------------------------
  // REQUIREMENT 6C: PRIMARY LARGE BID BUTTON
  // ---------------------------------------------------------------------------
  const bidBtn = document.getElementById('btn-place-bid');
  const bidTitle = document.getElementById('btn-bid-title');
  const bidSub = document.getElementById('btn-bid-sub');
  const disabledReason = document.getElementById('bid-disabled-reason');

  if (bidBtn && bidTitle && bidSub) {
    const incLakhs = Math.round(increment * 100);
    const incLabel = incLakhs >= 100 ? `₹${(incLakhs / 100).toFixed(2)} Cr` : `₹${incLakhs}L`;

    bidTitle.textContent = `PLACE BID — ₹${nextBid.toFixed(2)} Cr`;
    bidSub.textContent = `Next mandatory increment (+${incLabel})`;

    // Check Eligibility
    const check = checkBidEligibility(room, nextBid);
    if (!check.canBid) {
      bidBtn.disabled = true;
      if (disabledReason) {
        disabledReason.textContent = check.reason;
        disabledReason.classList.remove('hidden');
      }
    } else {
      bidBtn.disabled = false;
      if (disabledReason) disabledReason.classList.add('hidden');
      bidBtn.onclick = () => sendBid(nextBid);
    }
  }

  // Update Timer dial
  updateTimerDisplay(room.auction.timer);
}

function checkBidEligibility(room, nextBid) {
  if (room.auction.status === 'paused') {
    return { canBid: false, reason: 'Auction is currently paused by host.' };
  }

  if (room.auction.status === 'sold' || room.auction.status === 'unsold') {
    return { canBid: false, reason: 'Lot bidding finalized. Next player loading...' };
  }

  if (!state.userFranchise || !room.franchises[state.userFranchise]) {
    return { canBid: false, reason: 'Select a franchise in the lobby to enable bidding.' };
  }

  if (room.auction.currentBidder === state.userFranchise) {
    return { canBid: false, reason: 'You currently hold the highest bid!' };
  }

  const f = room.franchises[state.userFranchise];
  const player = room.auction.currentPlayer;

  // Squad size cap check
  if ((f.squad || []).length >= (room.config.maxSquad || 25)) {
    return { canBid: false, reason: 'Maximum squad limit of 25 reached.' };
  }

  // Overseas quota check
  if (player && player.isOverseas) {
    const osCount = (f.squad || []).filter(p => p.isOverseas).length;
    if (osCount >= (room.config.maxOverseas || 8)) {
      return { canBid: false, reason: 'Maximum overseas quota of 8 reached.' };
    }
  }

  // Purse reserve requirement for minimum 18 squad
  const currentCount = (f.squad || []).length;
  const minSquad = room.config.minSquad || 18;
  const minReservePerPlayer = 0.75; // Standard minimum base price
  const remainingNeeded = Math.max(0, minSquad - (currentCount + 1));
  const reserveRequired = remainingNeeded * minReservePerPlayer;

  if (f.purse < nextBid) {
    return { canBid: false, reason: `Purse balance (₹${f.purse.toFixed(2)} Cr) is lower than ₹${nextBid.toFixed(2)} Cr.` };
  }

  if ((f.purse - nextBid) < reserveRequired) {
    return {
      canBid: false,
      reason: `Need ₹${reserveRequired.toFixed(2)} Cr reserve to fill mandatory min 18 squad.`
    };
  }

  return { canBid: true };
}

function getNextBidIncrement(currentBid) {
  if (currentBid < 2.0) return 0.10;       // ₹75L - ₹1.99 Cr: +₹10 Lakhs
  if (currentBid < 5.0) return 0.25;       // ₹2.00 Cr - ₹4.99 Cr: +₹25 Lakhs
  if (currentBid < 10.0) return 0.50;      // ₹5.00 Cr - ₹9.99 Cr: +₹50 Lakhs
  return 1.00;                             // ₹10.00 Cr and above: +₹1.00 Crore
}

async function sendBid(amount) {
  if (!state.roomId || !state.userFranchise) return;

  const btn = document.getElementById('btn-place-bid');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        franchiseCode: state.userFranchise,
        amount
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Bid rejected');
    }
  } catch (err) {
    console.error('Bid error:', err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function updateTimerDisplay(timer) {
  const secondsEl = document.getElementById('timer-seconds');
  if (secondsEl) secondsEl.textContent = timer;

  const circle = document.getElementById('timer-progress-circle');
  if (circle) {
    const maxTimer = (state.roomData && state.roomData.config && state.roomData.config.timerDuration) || 15;
    const circumference = 2 * Math.PI * 45; // r = 45
    const fraction = Math.max(0, Math.min(1, timer / maxTimer));
    const offset = circumference * (1 - fraction);
    circle.style.strokeDashoffset = offset;

    // Change color as timer runs down
    if (timer <= 3) {
      circle.style.stroke = 'var(--accent-red)';
    } else if (timer <= 6) {
      circle.style.stroke = 'var(--accent-gold)';
    } else {
      circle.style.stroke = 'var(--accent-blue)';
    }
  }
}

function renderActivityFeed(room) {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;

  const history = (room.auction && room.auction.bidHistory) || [];
  if (history.length === 0) {
    feed.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem">No bids placed for this lot yet.</div>`;
    return;
  }

  feed.innerHTML = '';
  // Show most recent bids at top
  const reversed = [...history].reverse();
  reversed.forEach(item => {
    const div = document.createElement('div');
    div.className = 'activity-item';

    const time = item.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isGavel = item.type === 'sold' || item.type === 'unsold';

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem">
        <span style="font-weight:700; color:${isGavel ? 'var(--accent-gold)' : 'var(--text-main)'}">${item.franchiseName || item.franchiseCode || 'BCCI'}</span>
        <span style="font-size:0.7rem; color:var(--text-muted)">${time}</span>
      </div>
      <div style="font-size:0.85rem; color:var(--text-muted)">${item.message || `Placed bid of ₹${(item.amount || 0).toFixed(2)} Cr`}</div>
    `;
    feed.appendChild(div);
  });
}

// -----------------------------------------------------------------------------
// 10. PAGE 3: TEAMS & SQUADS (REQUIREMENT 7 & 8)
// -----------------------------------------------------------------------------
function renderTeamsPage() {
  const room = state.roomData;
  if (!room) return;

  const grid = document.getElementById('teams-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(room.franchises || {}).forEach(([code, f]) => {
    const osCount = (f.squad || []).filter(p => p.isOverseas).length;
    const maxSquad = room.config.maxSquad || 25;
    const maxOverseas = room.config.maxOverseas || 8;
    const openSlots = maxSquad - (f.squad || []).length;

    const card = document.createElement('div');
    card.className = 'team-card-detailed';
    card.style.borderTop = `4px solid ${f.color || '#3b82f6'}`;

    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-badge-circle" style="background:${f.color}; color:${f.textColor}">${f.shortName}</div>
        <div>
          <h3 class="team-card-title">${f.name}</h3>
          <div class="team-card-manager">${f.user ? `👤 Manager: ${f.user}` : '🤖 Autonomous AI'}</div>
        </div>
      </div>

      <div class="team-card-body">
        <div class="team-metric-row">
          <span class="metric-label">Remaining Purse</span>
          <span class="metric-val gold">₹${(f.purse || 0).toFixed(2)} Cr</span>
        </div>
        <div class="team-metric-row">
          <span class="metric-label">Total Capital Spent</span>
          <span class="metric-val">₹${(f.spent || 0).toFixed(2)} Cr</span>
        </div>
        <div class="team-metric-row">
          <span class="metric-label">Squad Size</span>
          <span class="metric-val">${(f.squad || []).length} / ${maxSquad}</span>
        </div>
        <div class="team-metric-row">
          <span class="metric-label">Overseas Quota</span>
          <span class="metric-val">${osCount} / ${maxOverseas}</span>
        </div>
        <div class="team-metric-row">
          <span class="metric-label">Open Slots</span>
          <span class="metric-val" style="color:var(--accent-green)">${openSlots} slots remaining</span>
        </div>
      </div>

      <div class="team-card-footer">
        <button class="btn-primary-action" onclick="openSquadModal('${code}')" style="width:100%; font-size:0.85rem; padding:0.55rem">
          View Full Squad Roster →
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Squad Details Modal with 4 Role Tabs (Requirement 8)
function openSquadModal(code) {
  if (!state.roomData || !state.roomData.franchises[code]) return;
  state.inspectingFranchise = code;
  state.selectedSquadRole = 'all';

  const f = state.roomData.franchises[code];
  const maxSquad = state.roomData.config.maxSquad || 25;
  const maxOverseas = state.roomData.config.maxOverseas || 8;
  const osCount = (f.squad || []).filter(p => p.isOverseas).length;

  // Header info
  const title = document.getElementById('squad-modal-title');
  if (title) title.textContent = f.name;

  const motto = document.getElementById('squad-modal-motto');
  if (motto) motto.textContent = f.motto || `${f.shortName} Official Roster`;

  const logo = document.getElementById('squad-modal-logo');
  if (logo) {
    logo.textContent = f.shortName;
    logo.style.background = f.color;
    logo.style.color = f.textColor;
  }

  // Summary Metrics
  const purseEl = document.getElementById('squad-sum-purse');
  if (purseEl) purseEl.textContent = `₹${(f.purse || 0).toFixed(2)} Cr`;

  const spentEl = document.getElementById('squad-sum-spent');
  if (spentEl) spentEl.textContent = `₹${(f.spent || 0).toFixed(2)} Cr`;

  const sizeEl = document.getElementById('squad-sum-size');
  if (sizeEl) sizeEl.textContent = `${(f.squad || []).length} / ${maxSquad}`;

  const osEl = document.getElementById('squad-sum-os');
  if (osEl) osEl.textContent = `${osCount} / ${maxOverseas}`;

  const slotsEl = document.getElementById('squad-sum-slots');
  if (slotsEl) slotsEl.textContent = maxSquad - (f.squad || []).length;

  // Update counts on role tabs
  const batters = (f.squad || []).filter(p => (p.role || '').toLowerCase().includes('batter') && !p.isWicketkeeper);
  const keepers = (f.squad || []).filter(p => p.isWicketkeeper || (p.role || '').toLowerCase().includes('wicketkeeper'));
  const allround = (f.squad || []).filter(p => (p.role || '').toLowerCase().includes('all-rounder'));
  const bowlers = (f.squad || []).filter(p => (p.role || '').toLowerCase().includes('bowler') || (p.role || '').toLowerCase().includes('spinner'));

  const countAll = document.getElementById('sq-count-all');
  if (countAll) countAll.textContent = (f.squad || []).length;

  const countBat = document.getElementById('sq-count-batters');
  if (countBat) countBat.textContent = batters.length;

  const countKeep = document.getElementById('sq-count-keepers');
  if (countKeep) countKeep.textContent = keepers.length;

  const countAllr = document.getElementById('sq-count-allround');
  if (countAllr) countAllr.textContent = allround.length;

  const countBowl = document.getElementById('sq-count-bowlers');
  if (countBowl) countBowl.textContent = bowlers.length;

  filterSquadRole('all');

  const modal = document.getElementById('squad-modal');
  if (modal) modal.classList.remove('hidden');
}

function filterSquadRole(role) {
  state.selectedSquadRole = role;

  // Toggle active tab classes
  document.querySelectorAll('.squad-role-tabs .squad-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const tabId = role === 'all' ? 'tab-sq-all' : (role === 'Batter' ? 'tab-sq-batters' : (role === 'Wicketkeeper' ? 'tab-sq-keepers' : (role === 'All-rounder' ? 'tab-sq-allround' : 'tab-sq-bowlers')));
  const activeBtn = document.getElementById(tabId);
  if (activeBtn) activeBtn.classList.add('active');

  renderSquadPlayersTable();
}

function renderSquadPlayersTable() {
  const container = document.getElementById('squad-players-container');
  if (!container || !state.inspectingFranchise || !state.roomData) return;

  const f = state.roomData.franchises[state.inspectingFranchise];
  if (!f) return;

  let squad = f.squad || [];
  if (state.selectedSquadRole !== 'all') {
    if (state.selectedSquadRole === 'Wicketkeeper') {
      squad = squad.filter(p => p.isWicketkeeper || (p.role || '').toLowerCase().includes('wicketkeeper'));
    } else if (state.selectedSquadRole === 'Batter') {
      squad = squad.filter(p => (p.role || '').toLowerCase().includes('batter') && !p.isWicketkeeper);
    } else if (state.selectedSquadRole === 'All-rounder') {
      squad = squad.filter(p => (p.role || '').toLowerCase().includes('all-rounder'));
    } else if (state.selectedSquadRole === 'Bowler') {
      squad = squad.filter(p => (p.role || '').toLowerCase().includes('bowler') || (p.role || '').toLowerCase().includes('spinner'));
    }
  }

  if (squad.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.9rem">No players in this category yet.</div>`;
    return;
  }

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Player Name</th>
          <th>Role</th>
          <th>Type</th>
          <th>Rating</th>
          <th style="text-align:right">Price Paid</th>
        </tr>
      </thead>
      <tbody>
  `;

  squad.forEach(p => {
    html += `
      <tr>
        <td style="font-weight:700">${p.name}</td>
        <td>${p.role}</td>
        <td>${p.isOverseas ? '<span class="tag tag-overseas">✈️ Overseas</span>' : '<span class="tag tag-india">🇮🇳 Indian</span>'}</td>
        <td><span class="tag tag-role">${p.overallRating || 85}</span></td>
        <td style="text-align:right; font-weight:800; color:var(--accent-gold)">₹${(p.boughtPrice || p.soldPrice || p.basePrice || 0).toFixed(2)} Cr</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// -----------------------------------------------------------------------------
// 11. PAGE 4: 250 PLAYER POOL & ADMIN BASE PRICE REVIEW (REQUIREMENT 4)
// -----------------------------------------------------------------------------
async function loadPlayerPool() {
  const tbody = document.getElementById('pool-table-body');
  if (!tbody) return;

  const searchInput = document.getElementById('pool-search-input');
  const roleSelect = document.getElementById('pool-role-filter');
  const statusSelect = document.getElementById('pool-status-filter');

  const search = searchInput ? searchInput.value.trim() : '';
  const role = roleSelect ? roleSelect.value : '';
  const status = statusSelect ? statusSelect.value : '';

  try {
    let url = `/api/players?room=${encodeURIComponent(state.roomId || '')}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (role) url += `&role=${encodeURIComponent(role)}`;

    const res = await fetch(url);
    const data = await res.json();
    let players = data.players || [];

    if (status) {
      players = players.filter(p => p.status === status);
    }

    const badge = document.getElementById('pool-total-badge');
    if (badge) badge.textContent = `${players.length} Players Listed`;

    tbody.innerHTML = '';
    const isLobby = state.roomData && state.roomData.stage === 'lobby';

    players.forEach((p, idx) => {
      const tr = document.createElement('tr');

      let statusHtml = '';
      if (p.status === 'Sold') {
        statusHtml = `<span class="tag tag-overseas">SOLD (${p.soldTo})</span>`;
      } else if (p.status === 'Unsold') {
        statusHtml = `<span class="tag" style="background:#475569">UNSOLD</span>`;
      } else {
        statusHtml = `<span class="tag tag-india">AVAILABLE</span>`;
      }

      let actionHtml = '--';
      if (state.isHost && isLobby) {
        actionHtml = `
          <button class="btn-link" onclick="openBasePriceEditor('${p.id}', '${p.name}', ${p.basePrice})" style="font-size:0.8rem">
            ✏️ Edit Price
          </button>
        `;
      }

      tr.innerHTML = `
        <td style="font-family:monospace; font-size:0.8rem; color:var(--text-muted)">#${idx + 1}</td>
        <td style="font-weight:700">${p.name}</td>
        <td>${p.role}</td>
        <td>${p.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian'}</td>
        <td><span class="tag tag-role">${p.overallRating || 85}</span></td>
        <td style="font-weight:800; color:var(--accent-gold)">₹${(p.basePrice || 2.0).toFixed(2)} Cr</td>
        <td>${statusHtml}</td>
        <td>${actionHtml}</td>
      `;

      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading pool:', err);
  }
}

function openBasePriceEditor(id, name, currentPrice) {
  const modal = document.getElementById('edit-price-modal');
  if (!modal) return;

  const idInput = document.getElementById('edit-player-id');
  if (idInput) idInput.value = id;

  const label = document.getElementById('edit-player-name-label');
  if (label) label.textContent = `Set Starting Price for ${name}`;

  const select = document.getElementById('edit-player-price-select');
  if (select) {
    select.value = currentPrice.toFixed(2);
  }

  modal.classList.remove('hidden');
}

async function submitPlayerPriceChange() {
  const id = document.getElementById('edit-player-id').value;
  const newPrice = parseFloat(document.getElementById('edit-player-price-select').value);

  try {
    const res = await fetch('/api/room/update-player-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        userName: state.userName,
        playerId: id,
        basePrice: newPrice
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to update player base price');
      return;
    }

    closeModal('edit-price-modal');
    loadPlayerPool();
    alert('Player starting base price updated successfully.');
  } catch (err) {
    alert('Error updating base price');
  }
}

// -----------------------------------------------------------------------------
// 12. PAGE 5: AUCTION HISTORY & RECORDS
// -----------------------------------------------------------------------------
function renderHistoryPage() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody || !state.roomData) return;

  const history = state.roomData.auctionHistory || [];
  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted)">No gavel decisions recorded yet. Decisions appear as lots are finalized.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  history.forEach((rec, idx) => {
    const tr = document.createElement('tr');
    const isSold = rec.status === 'Sold';
    const decisionBadge = isSold
      ? `<span class="tag tag-overseas" style="background:rgba(34,197,94,0.15); color:var(--accent-green); border-color:var(--accent-green)">SOLD</span>`
      : `<span class="tag" style="background:rgba(239,68,68,0.15); color:var(--accent-red); border-color:var(--accent-red)">UNSOLD</span>`;

    const f = rec.soldTo && state.roomData.franchises[rec.soldTo];
    const teamBadge = f
      ? `<span style="background:${f.color}; color:${f.textColor}; padding:0.15rem 0.45rem; border-radius:4px; font-weight:800; font-size:0.75rem; margin-right:0.4rem">${f.shortName}</span> ${f.name}`
      : '--';

    tr.innerHTML = `
      <td style="font-family:monospace; color:var(--text-muted)">#${idx + 1}</td>
      <td style="font-weight:700">${rec.playerName || '--'}</td>
      <td>${rec.role || '--'}</td>
      <td>${decisionBadge}</td>
      <td>${teamBadge}</td>
      <td style="text-align:right; font-weight:800; color:${isSold ? 'var(--accent-gold)' : 'var(--text-muted)'}">
        ${isSold ? `₹${(rec.soldPrice || 0).toFixed(2)} Cr` : '--'}
      </td>
      <td style="text-align:right; font-size:0.75rem; color:var(--text-muted)">${rec.timestamp || '--'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -----------------------------------------------------------------------------
// 13. PAGE 6: MY STRATEGY NOTES (REQUIREMENT 9 - 100% PRIVATE & PERSISTENT)
// -----------------------------------------------------------------------------
function loadPrivateStrategyNotes() {
  const storageKey = `ipl_strat_${state.roomId || 'room'}_${state.userName || 'user'}`;
  const saved = localStorage.getItem(storageKey);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const targets = document.getElementById('strategy-targets');
      if (targets && parsed.targets !== undefined) targets.value = parsed.targets;

      const avoid = document.getElementById('strategy-avoid');
      if (avoid && parsed.avoid !== undefined) avoid.value = parsed.avoid;

      const notes = document.getElementById('strategy-notes');
      if (notes && parsed.notes !== undefined) notes.value = parsed.notes;

      // Roles checklist
      ['batters', 'keepers', 'allround', 'pacers', 'spinners', 'overseas'].forEach(role => {
        const chk = document.getElementById(`chk-${role}`);
        if (chk && parsed.checklist && parsed.checklist[role] !== undefined) {
          chk.checked = parsed.checklist[role];
        }
      });
    } catch (e) {
      console.warn('Failed parsing strategy notes:', e);
    }
  }

  // Bind input auto-save
  ['strategy-targets', 'strategy-avoid', 'strategy-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = savePrivateStrategyNotes;
  });

  ['chk-batters', 'chk-keepers', 'chk-allround', 'chk-pacers', 'chk-spinners', 'chk-overseas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onchange = savePrivateStrategyNotes;
  });
}

function savePrivateStrategyNotes() {
  const storageKey = `ipl_strat_${state.roomId || 'room'}_${state.userName || 'user'}`;
  const targets = document.getElementById('strategy-targets');
  const avoid = document.getElementById('strategy-avoid');
  const notes = document.getElementById('strategy-notes');

  const checklist = {};
  ['batters', 'keepers', 'allround', 'pacers', 'spinners', 'overseas'].forEach(role => {
    const chk = document.getElementById(`chk-${role}`);
    checklist[role] = chk ? chk.checked : false;
  });

  const payload = {
    targets: targets ? targets.value : '',
    avoid: avoid ? avoid.value : '',
    notes: notes ? notes.value : '',
    checklist
  };

  localStorage.setItem(storageKey, JSON.stringify(payload));

  const indicator = document.getElementById('strategy-save-indicator');
  if (indicator) {
    indicator.textContent = 'Saving...';
    indicator.style.color = 'var(--accent-gold)';
    setTimeout(() => {
      indicator.textContent = 'Saved Automatically';
      indicator.style.color = 'var(--accent-green)';
    }, 300);
  }
}

function updateBudgetCalculator() {
  if (!state.roomData) return;

  let purse = 120.0;
  let squadCount = 0;
  const maxSquad = state.roomData.config.maxSquad || 25;
  const minSquad = state.roomData.config.minSquad || 18;

  if (state.userFranchise && state.roomData.franchises[state.userFranchise]) {
    const f = state.roomData.franchises[state.userFranchise];
    purse = f.purse || 0;
    squadCount = (f.squad || []).length;
  }

  const remainingNeeded = Math.max(0, minSquad - squadCount);
  const reserveRequired = remainingNeeded * 0.75;
  const maxSafeBid = Math.max(0, purse - reserveRequired);

  const purseEl = document.getElementById('strat-calc-purse');
  if (purseEl) purseEl.textContent = `₹${purse.toFixed(2)} Cr`;

  const squadEl = document.getElementById('strat-calc-squad');
  if (squadEl) squadEl.textContent = `${squadCount} / ${maxSquad}`;

  const neededEl = document.getElementById('strat-calc-needed');
  if (neededEl) neededEl.textContent = `${remainingNeeded} players needed`;

  const reserveEl = document.getElementById('strat-calc-reserve');
  if (reserveEl) reserveEl.textContent = `₹${reserveRequired.toFixed(2)} Cr`;

  const maxBidEl = document.getElementById('strat-calc-maxbid');
  if (maxBidEl) maxBidEl.textContent = `₹${maxSafeBid.toFixed(2)} Cr`;
}

// -----------------------------------------------------------------------------
// 14. ADMIN HOST CONTROLS
// -----------------------------------------------------------------------------
async function togglePause() {
  if (!state.isHost) return;
  const isCurrentlyPaused = state.roomData && state.roomData.auction && state.roomData.auction.status === 'paused';
  await hostAction(isCurrentlyPaused ? 'resume' : 'pause');
}

async function skipPlayer() {
  if (!state.isHost) return;
  if (confirm('Skip current player and move directly to next lot?')) {
    await hostAction('skip');
  }
}

async function hostAction(action, payload = {}) {
  try {
    const res = await fetch('/api/host-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        userName: state.userName,
        action,
        ...payload
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || `Host action failed: ${action}`);
    }
  } catch (err) {
    alert('Host action network error');
  }
}

// -----------------------------------------------------------------------------
// 15. MODAL HELPERS & UTILITIES
// -----------------------------------------------------------------------------
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

function copyInviteLink() {
  const url = `${window.location.origin}/?room=${encodeURIComponent(state.roomId || 'IPL-2026')}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      alert(`Invitation link copied to clipboard:\n${url}`);
    }).catch(() => {
      prompt('Copy invitation link:', url);
    });
  } else {
    prompt('Copy invitation link:', url);
  }
}

function updateUserPill() {
  const pill = document.getElementById('user-pill-text');
  if (!pill) return;

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

function showCompletedModal(data) {
  alert('IPL Mega Auction 2026 Concluded! Check Dashboard & Squads for complete tournament rosters.');
}

// -----------------------------------------------------------------------------
// 16. EVENT LISTENERS
// -----------------------------------------------------------------------------
function setupEventListeners() {
  // Pool search & filter listeners
  const searchInput = document.getElementById('pool-search-input');
  if (searchInput) searchInput.oninput = loadPlayerPool;

  const roleSelect = document.getElementById('pool-role-filter');
  if (roleSelect) roleSelect.onchange = loadPlayerPool;

  const statusSelect = document.getElementById('pool-status-filter');
  if (statusSelect) statusSelect.onchange = loadPlayerPool;
}
