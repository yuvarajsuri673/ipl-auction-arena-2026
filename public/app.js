// IPL Auction Arena 2026 - Professional Mobile-First Real-time Bidding Platform
// Strictly Human Participants Only · 10 IPL Franchises · Zero AI Bots

const FRANCHISES_MASTER = {
  CSK: { code: 'CSK', name: 'Chennai Super Kings', shortName: 'CSK', color: '#F9CD05', textColor: '#000000', logo: 'CSK' },
  MI: { code: 'MI', name: 'Mumbai Indians', shortName: 'MI', color: '#004BA0', textColor: '#FFFFFF', logo: 'MI' },
  RCB: { code: 'RCB', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: '#DC2626', textColor: '#FFFFFF', logo: 'RCB' },
  KKR: { code: 'KKR', name: 'Kolkata Knight Riders', shortName: 'KKR', color: '#581C87', textColor: '#FFFFFF', logo: 'KKR' },
  DC: { code: 'DC', name: 'Delhi Capitals', shortName: 'DC', color: '#0284C7', textColor: '#FFFFFF', logo: 'DC' },
  PBKS: { code: 'PBKS', name: 'Punjab Kings', shortName: 'PBKS', color: '#EF4444', textColor: '#FFFFFF', logo: 'PBKS' },
  RR: { code: 'RR', name: 'Rajasthan Royals', shortName: 'RR', color: '#EC4899', textColor: '#FFFFFF', logo: 'RR' },
  SRH: { code: 'SRH', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: '#F97316', textColor: '#FFFFFF', logo: 'SRH' },
  GT: { code: 'GT', name: 'Gujarat Titans', shortName: 'GT', color: '#1E293B', textColor: '#FFFFFF', logo: 'GT' },
  LSG: { code: 'LSG', name: 'Lucknow Super Giants', shortName: 'LSG', color: '#D946EF', textColor: '#FFFFFF', logo: 'LSG' }
};

const state = {
  currentPage: 'dashboard',
  roomId: null,
  userName: localStorage.getItem('ipl_user_name') || 'Yuvaraj',
  selectedTeamLanding: 'MI',
  userFranchise: null,
  isHost: false,
  roomData: null,
  eventSource: null,
  intermissionInterval: null,
  selectedSquadRole: 'all',
  inspectingFranchise: null,
  mobileBiddingView: 'podium',
  lobbyActiveTab: 'teams', // 'teams', 'chat', 'settings'
  theme: localStorage.getItem('ipl_theme') || 'dark',
  voiceAssistant: localStorage.getItem('ipl_voice_assistant') === 'true',
  soundEffects: localStorage.getItem('ipl_sound_effects') !== 'false'
};

// -----------------------------------------------------------------------------
// 1. INITIALIZATION & DOM READY
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAudioPreferences();
  renderLandingTeamCircles();
  setupEventListeners();

  // Check URL query parameters
  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room');
  const storedRoom = localStorage.getItem('ipl_active_room');
  const activeRoom = (urlRoom || storedRoom || 'IPL-2026').trim().toUpperCase();

  const landingRoomInput = document.getElementById('landing-room-id');
  if (landingRoomInput) landingRoomInput.value = activeRoom;

  const landingNameInput = document.getElementById('landing-user-name');
  if (landingNameInput && state.userName) landingNameInput.value = state.userName;

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

    for (const [code, f] of Object.entries(room.franchises || {})) {
      if (f.user === state.userName) {
        state.userFranchise = code;
        break;
      }
    }

    initRoomSSE(roomId);
    switchScreen('app');

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
// 2. LANDING SCREEN ACTIONS (Reference Image 25adc733)
// -----------------------------------------------------------------------------
function renderLandingTeamCircles() {
  const container = document.getElementById('landing-team-circles');
  if (!container) return;
  container.innerHTML = '';

  Object.entries(FRANCHISES_MASTER).forEach(([code, f]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `team-circle-btn ${state.selectedTeamLanding === code ? 'selected' : ''}`;
    btn.onclick = () => selectLandingTeam(code);

    btn.innerHTML = `
      <div class="team-circle-badge" style="background:${f.color}; color:${f.textColor}">
        ${f.shortName}
      </div>
      <span class="team-circle-label">${f.shortName}</span>
    `;
    container.appendChild(btn);
  });
}

function selectLandingTeam(code) {
  state.selectedTeamLanding = code;
  renderLandingTeamCircles();
}

async function createRoomFromLanding() {
  const userName = (document.getElementById('landing-user-name').value || 'Yuvaraj').trim();
  const roomId = (document.getElementById('landing-room-id').value || 'IPL-2026').trim().toUpperCase();

  state.userName = userName;
  localStorage.setItem('ipl_user_name', userName);

  try {
    const res = await fetch('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        hostName: userName,
        teamCount: 10,
        initialPurse: 120.0,
        minSquad: 18,
        maxSquad: 25,
        maxOverseas: 8,
        timerDuration: 20
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || data.error || 'Failed to create room');
      return;
    }

    state.roomId = roomId;
    state.isHost = true;
    state.roomData = data.room;

    localStorage.setItem('ipl_active_room', roomId);
    localStorage.setItem(`ipl_is_host_${roomId}`, 'true');

    // Auto-claim the selected team from landing
    if (state.selectedTeamLanding) {
      await claimFranchise(state.selectedTeamLanding);
    }

    initRoomSSE(roomId);
    switchScreen('app');
    navigateTo('bidding');
    updateUserPill();
    renderCurrentPage();

    if (window.soundEngine) window.soundEngine.playGavel();
  } catch (err) {
    alert('Connection error while creating room. Please try again.');
  }
}

async function joinRoomFromLanding() {
  const userName = (document.getElementById('landing-user-name').value || 'Guest').trim();
  const roomId = (document.getElementById('landing-room-id').value || 'IPL-2026').trim().toUpperCase();

  state.userName = userName;
  localStorage.setItem('ipl_user_name', userName);

  try {
    const res = await fetch('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userName })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || data.error || 'Failed to join room. Check room code!');
      return;
    }

    state.roomId = roomId;
    state.roomData = data.room;
    state.isHost = data.room.hostName === userName || (localStorage.getItem(`ipl_is_host_${roomId}`) === 'true');

    localStorage.setItem('ipl_active_room', roomId);

    // Identify if user already claimed a franchise
    for (const [code, f] of Object.entries(data.room.franchises || {})) {
      if (f.user === userName) {
        state.userFranchise = code;
        break;
      }
    }

    // If not claimed yet, try to claim the landing selection
    if (!state.userFranchise && state.selectedTeamLanding && !data.room.franchises[state.selectedTeamLanding].user) {
      await claimFranchise(state.selectedTeamLanding);
    }

    initRoomSSE(roomId);
    switchScreen('app');
    navigateTo('bidding');
    updateUserPill();
    renderCurrentPage();

    if (window.soundEngine) window.soundEngine.playBidChime();
  } catch (err) {
    alert('Could not connect to room. Please check the room code.');
  }
}

// -----------------------------------------------------------------------------
// 3. NAVIGATION (7 SECTIONS) & SCREEN SWITCHING
// -----------------------------------------------------------------------------
function navigateTo(pageName) {
  state.currentPage = pageName;

  document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
  const activePage = document.getElementById(`page-${pageName}`);
  if (activePage) activePage.classList.remove('hidden');

  document.querySelectorAll('.desktop-nav .nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-page') === pageName);
  });

  document.querySelectorAll('.mobile-bottom-bar .mob-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-page') === pageName);
  });

  toggleMobileDrawer(false);

  if (pageName === 'players') loadPlayerPool();
  else if (pageName === 'history') renderHistoryPage();
  else if (pageName === 'strategy') { loadPrivateStrategyNotes(); updateBudgetCalculator(); }
  else if (pageName === 'teams') renderTeamsPage();
  else if (pageName === 'dashboard') renderDashboard();
  else if (pageName === 'bidding') renderLiveBidding();
}

function navigateFromDrawer(pageName) {
  navigateTo(pageName);
}

function toggleMobileDrawer(open) {
  const overlay = document.getElementById('mobile-drawer-overlay');
  if (!overlay) return;
  if (open === undefined) overlay.classList.toggle('hidden');
  else if (open) overlay.classList.remove('hidden');
  else overlay.classList.add('hidden');
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
    const lobbyCodeDisplay = document.getElementById('lobby-room-code-display');
    if (lobbyCodeDisplay) lobbyCodeDisplay.textContent = state.roomId || 'IPL-2026';
    const lobbyInviteUrl = document.getElementById('lobby-invite-url');
    if (lobbyInviteUrl) lobbyInviteUrl.value = `${window.location.origin}/?room=${encodeURIComponent(state.roomId || 'IPL-2026')}`;
  }
}

function goHome() {
  if (confirm('Are you sure you want to leave the current auction room?')) {
    switchScreen('landing');
  }
}

// -----------------------------------------------------------------------------
// 4. THEME & AUDIO PREFERENCES
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

function initAudioPreferences() {
  // Voice Assistant: Default strictly OFF
  if (window.soundEngine) {
    window.soundEngine.setVoiceAssistant(state.voiceAssistant);
    window.soundEngine.setMute(!state.soundEffects);
  }
  updateVoiceUI(state.voiceAssistant);
  updateSoundUI(state.soundEffects);
}

function toggleVoiceAssistant() {
  setVoiceAssistantState(!state.voiceAssistant);
}

function toggleVoiceAssistantFromSetting(checked) {
  setVoiceAssistantState(checked);
}

function setVoiceAssistantState(enabled) {
  state.voiceAssistant = enabled;
  localStorage.setItem('ipl_voice_assistant', enabled ? 'true' : 'false');
  if (window.soundEngine) window.soundEngine.setVoiceAssistant(enabled);
  updateVoiceUI(enabled);
}

function updateVoiceUI(enabled) {
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
  setSoundState(!state.soundEffects);
}

function toggleSoundFromSetting(checked) {
  setSoundState(checked);
}

function setSoundState(enabled) {
  state.soundEffects = enabled;
  localStorage.setItem('ipl_sound_effects', enabled ? 'true' : 'false');
  if (window.soundEngine) window.soundEngine.setMute(!enabled);
  updateSoundUI(enabled);
}

function updateSoundUI(enabled) {
  const icon = document.getElementById('sound-icon');
  if (icon) icon.textContent = enabled ? '🔊' : '🔇';
  const settingCheck = document.getElementById('setting-sound-effects');
  if (settingCheck) settingCheck.checked = enabled;
}

// -----------------------------------------------------------------------------
// 5. FRANCHISE CLAIMING (STRICT HUMAN PARTICIPANTS ONLY)
// -----------------------------------------------------------------------------
async function claimFranchise(code) {
  if (!state.roomId || !state.userName) return;

  try {
    const res = await fetch('/api/room/claim-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        userName: state.userName,
        franchiseCode: code,
        previousFranchiseCode: state.userFranchise
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || data.error || 'Could not claim franchise');
      return;
    }

    state.userFranchise = code;
    if (data.room) state.roomData = data.room;
    updateUserPill();
    renderCurrentPage();

    if (window.soundEngine) window.soundEngine.playBidChime();
  } catch (err) {
    console.warn('Franchise claim error:', err);
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

  state.eventSource.addEventListener('state_update', (e) => {
    try {
      const room = JSON.parse(e.data);
      state.roomData = room;
      syncUserFranchise(room);
      renderCurrentPage();
    } catch (err) {
      console.warn('state_update parse error:', err);
    }
  });

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
      console.warn('bid_placed parse error:', err);
    }
  });

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
      console.warn('timer_tick parse error:', err);
    }
  });

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
      console.warn('player_sold parse error:', err);
    }
  });

  state.eventSource.addEventListener('player_unsold', (e) => {
    try {
      const data = JSON.parse(e.data);
      showOutcomeIntermission('unsold', data);

      if (window.soundEngine) {
        window.soundEngine.playGavel();
        window.soundEngine.announceUnsold(data.player.name);
      }

      addTickerMessage(`⚠️ UNSOLD: ${data.player.name} received no bids.`);
      renderCurrentPage();
    } catch (err) {
      console.warn('player_unsold parse error:', err);
    }
  });

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
      console.warn('player_selected parse error:', err);
    }
  });

  state.eventSource.addEventListener('auction_started', () => {
    if (state.roomData) state.roomData.stage = 'active';
    navigateTo('bidding');
    if (window.soundEngine) {
      window.soundEngine.playGavel();
      window.soundEngine.announceAuctionStart();
    }
    renderCurrentPage();
  });

  state.eventSource.addEventListener('auction_paused', () => {
    if (state.roomData && state.roomData.auction) {
      state.roomData.auction.isPaused = true;
      state.roomData.auction.status = 'paused';
    }
    const icon = document.getElementById('btn-admin-pause');
    if (icon) icon.textContent = '▶️';
    renderLiveBidding();
  });

  state.eventSource.addEventListener('auction_resumed', () => {
    if (state.roomData && state.roomData.auction) {
      state.roomData.auction.isPaused = false;
      state.roomData.auction.status = 'bidding';
    }
    const icon = document.getElementById('btn-admin-pause');
    if (icon) icon.textContent = '⏸️';
    renderLiveBidding();
  });

  state.eventSource.addEventListener('auction_stopped', () => {
    if (state.roomData) {
      state.roomData.stage = 'stopped';
      if (state.roomData.auction) state.roomData.auction.status = 'stopped';
    }
    alert('Auction has been stopped by the Admin. All completed transactions are preserved.');
    renderCurrentPage();
  });

  state.eventSource.addEventListener('auction_completed', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (state.roomData) state.roomData.stage = 'completed';
      if (window.soundEngine) window.soundEngine.announceConclusion();
      alert('🏆 IPL Mega Auction Concluded! View complete franchise rosters in Teams & Squads.');
      navigateTo('teams');
    } catch (err) {
      console.warn('auction_completed parse error:', err);
    }
  });

  state.eventSource.addEventListener('chat_message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      renderNewChatMessage(msg);
    } catch (err) {
      console.warn('chat_message parse error:', err);
    }
  });

  state.eventSource.onerror = () => {
    console.warn('SSE stream re-connecting...');
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
    if (sub) sub.textContent = `${data.player.name} acquired by ${data.franchiseName} for ₹${data.price.toFixed(2)} Cr`;
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

  const dot = document.getElementById('live-bidding-dot');
  if (dot) {
    const isLive = state.roomData && state.roomData.stage === 'active';
    dot.style.display = isLive ? 'inline-block' : 'none';
  }

  switch (state.currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'bidding': renderLiveBidding(); break;
    case 'teams': renderTeamsPage(); break;
    case 'players': break;
    case 'history': renderHistoryPage(); break;
    case 'strategy': updateBudgetCalculator(); break;
    case 'settings': break;
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
    if (spotDetails) spotDetails.textContent = 'Select your franchise below and enter the live bidding floor.';
    if (spotPrice) spotPrice.textContent = '₹120.00 Cr Cap';
  } else if (room.stage === 'completed') {
    if (spotBadge) spotBadge.textContent = 'CONCLUDED';
    if (spotName) spotName.textContent = 'Mega Auction Complete';
    if (spotDetails) spotDetails.textContent = `All lots processed. ${soldCount} players signed.`;
    if (spotPrice) spotPrice.textContent = `₹${totalSpent.toFixed(2)} Cr`;
  } else if (room.auction && room.auction.currentPlayer) {
    const p = room.auction.currentPlayer;
    if (spotBadge) spotBadge.textContent = `LOT #${(room.auction.currentPlayerIndex || 0) + 1} LIVE`;
    if (spotName) spotName.textContent = p.name;
    if (spotDetails) spotDetails.textContent = `${p.role} · ${p.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian'} · Rating: ${p.overallRating || 85}`;
    if (spotPrice) spotPrice.textContent = `₹${room.auction.currentBid.toFixed(2)} Cr`;
  }

  // Leaderboard
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
        <span class="team-sum-badge" style="background:${f.color}; color:${f.textColor}">${f.shortName}</span>
        <div style="flex:1; min-width:0">
          <div class="team-sum-name">${f.name}</div>
          <div class="team-sum-manager">${f.user ? `👤 ${f.user}` : '<span style="color:var(--text-dim)">Available</span>'}</div>
        </div>
      </div>
      <div class="team-sum-metrics">
        <div>
          <div class="team-sum-label">Purse Remaining</div>
          <div class="team-sum-purse">₹${(f.purse || 0).toFixed(2)} Cr</div>
        </div>
        <div style="text-align:right">
          <div class="team-sum-label">Squad Size</div>
          <div style="font-weight:700">${(f.squad || []).length} / ${room.config.maxSquad || 25}</div>
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; font-size:0.72rem; color:var(--text-muted)">
        <span>Overseas: ${osCount}/${room.config.maxOverseas || 8}</span>
        <button class="btn-link" onclick="openSquadModal('${code}')" style="color:var(--accent-orange); font-weight:700">View Roster →</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// -----------------------------------------------------------------------------
// 9. PAGE 2: LIVE AUCTION FLOOR (LOBBY & ACTIVE 3-COLUMN)
// -----------------------------------------------------------------------------
function renderLiveBidding() {
  const room = state.roomData;
  if (!room) return;

  const lobbyState = document.getElementById('bidding-lobby-state');
  const activeState = document.getElementById('bidding-active-state');

  if (room.stage === 'lobby') {
    if (lobbyState) lobbyState.classList.remove('hidden');
    if (activeState) activeState.classList.add('hidden');
    renderLobbyScreen(room);
    return;
  }

  if (lobbyState) lobbyState.classList.add('hidden');
  if (activeState) activeState.classList.remove('hidden');

  renderActivePodium(room);
  renderLeftTeamsPanel(room);
  renderActivityFeed(room);
}

// Lobby Screen (Reference d63d3190, 9579211b)
function renderLobbyScreen(room) {
  const hostStartBtn = document.getElementById('btn-lobby-start-host');
  if (hostStartBtn) hostStartBtn.classList.toggle('hidden', !state.isHost);

  const claimedCount = Object.values(room.franchises || {}).filter(f => f.user !== null).length;
  const countText = document.getElementById('lobby-count-text');
  if (countText) countText.textContent = `${claimedCount}/10`;

  const myPill = document.getElementById('lobby-my-selected-pill');
  if (myPill) {
    if (state.userFranchise && room.franchises[state.userFranchise]) {
      const myF = room.franchises[state.userFranchise];
      myPill.innerHTML = `[${myF.shortName}] ${myF.name}`;
      myPill.style.borderColor = myF.color;
      myPill.style.color = '#fff';
    } else {
      myPill.textContent = 'Not Selected';
      myPill.style.borderColor = 'var(--border-color)';
      myPill.style.color = 'var(--text-muted)';
    }
  }

  // 5x2 Franchise Cards Grid
  const grid = document.getElementById('lobby-franchises-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(room.franchises || {}).forEach(([code, f]) => {
    const isMine = f.user === state.userName;
    const isTaken = f.user !== null && !isMine;

    const box = document.createElement('div');
    box.className = `lobby-franchise-box ${isMine ? 'claimed-by-me' : ''} ${isTaken ? 'claimed-by-other' : ''}`;
    box.onclick = () => {
      if (!isTaken) claimFranchise(code);
    };

    let ownerHtml = isMine
      ? `<span class="franchise-owner-label" style="color:#ff781f">✓ ${state.userName}</span>`
      : (isTaken ? `<span class="franchise-owner-label">${f.user}</span>` : `<span class="franchise-owner-label unclaimed">Available</span>`);

    box.innerHTML = `
      <div class="franchise-circle-badge" style="background:${f.color}; color:${f.textColor}">
        ${f.shortName}
      </div>
      ${ownerHtml}
    `;

    grid.appendChild(box);
  });

  // Timer Pills
  const timerPills = document.querySelectorAll('#lobby-timer-pills .timer-pill-btn');
  timerPills.forEach(btn => {
    const dur = parseInt(btn.getAttribute('data-timer'), 10);
    btn.classList.toggle('active', dur === room.config.timerDuration);
  });
  const timerActiveText = document.getElementById('lobby-timer-active-text');
  if (timerActiveText) timerActiveText.textContent = `${room.config.timerDuration}s`;
}

function setTimerPreference(seconds) {
  if (!state.isHost) {
    alert('Only the host can configure the bidding timer.');
    return;
  }
  fetch('/api/room/update-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: state.roomId,
      timerDuration: seconds
    })
  });
}

function toggleLobbyChatTab() {
  const panel = document.getElementById('lobby-chat-panel');
  if (panel) panel.classList.toggle('hidden');
}

function toggleLobbySettingsTab() {
  navigateTo('settings');
}

async function sendChatMessage() {
  const input = document.getElementById('lobby-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  try {
    await fetch('/api/room/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: state.roomId,
        userName: state.userName,
        franchiseCode: state.userFranchise,
        text
      })
    });
  } catch (e) {}
}

function renderNewChatMessage(msg) {
  const container = document.getElementById('lobby-chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'chat-msg-row';
  div.innerHTML = `
    <span class="chat-msg-user">${msg.team ? `[${msg.team}] ` : ''}${msg.user}:</span>
    <span style="color:var(--text-main)">${msg.text}</span>
    <span style="font-size:0.65rem; color:var(--text-dim); margin-left:0.35rem">${msg.time}</span>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Active Podium (Center Column)
function renderActivePodium(room) {
  const player = room.auction.currentPlayer;
  if (!player) return;

  const lotTag = document.getElementById('player-lot-tag');
  if (lotTag) lotTag.textContent = `LOT #${(room.auction.currentPlayerIndex || 0) + 1}`;

  const ratingPill = document.getElementById('player-rating-pill');
  if (ratingPill) ratingPill.textContent = player.overallRating || 85;

  const initialsEl = document.getElementById('player-avatar-initials');
  if (initialsEl) {
    const parts = (player.name || '').split(' ');
    initialsEl.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : (player.name || 'PL').slice(0, 2).toUpperCase();
  }

  const roleTag = document.getElementById('player-role-tag');
  if (roleTag) roleTag.textContent = player.role || 'Batter';

  const natTag = document.getElementById('player-nationality-tag');
  if (natTag) {
    natTag.textContent = player.isOverseas ? '✈️ Overseas' : '🇮🇳 Indian';
    natTag.className = `tag ${player.isOverseas ? 'tag-overseas' : 'tag-india'}`;
  }

  const wkTag = document.getElementById('player-wk-tag');
  if (wkTag) wkTag.classList.toggle('hidden', !player.isWicketkeeper);

  const nameEl = document.getElementById('player-full-name');
  if (nameEl) nameEl.textContent = player.name;

  const detailsEl = document.getElementById('player-details-line');
  if (detailsEl) {
    const batStyle = player.battingStyle || 'Right-hand Bat';
    const bowlStyle = player.bowlingStyle ? ` · ${player.bowlingStyle}` : '';
    detailsEl.textContent = `${batStyle}${bowlStyle} · ${player.nationality || 'India'}`;
  }

  // 3-VALUE STANDARDISED PRICES (Requirement 5C)
  const basePrice = player.basePrice || 2.0;
  const currentBid = room.auction.currentBid || basePrice;
  const currentBidder = room.auction.currentBidder;
  const currentBidderName = room.auction.currentBidderName;

  const increment = getNextBidIncrement(currentBid);
  const nextBid = currentBidder ? Number((currentBid + increment).toFixed(2)) : currentBid;

  const basePriceEl = document.getElementById('display-base-price');
  if (basePriceEl) basePriceEl.textContent = `₹${basePrice.toFixed(2)} Cr`;

  const currentBidEl = document.getElementById('display-current-bid');
  if (currentBidEl) currentBidEl.textContent = `₹${currentBid.toFixed(2)} Cr`;

  const bidderInfoEl = document.getElementById('display-bidder-info');
  if (bidderInfoEl) {
    if (currentBidder) {
      const f = room.franchises[currentBidder];
      const color = f ? f.color : '#3b82f6';
      bidderInfoEl.innerHTML = `<span style="color:${color}; font-weight:800">● ${currentBidderName || currentBidder}</span>`;
    } else {
      bidderInfoEl.textContent = 'Base Price';
    }
  }

  const nextBidEl = document.getElementById('display-next-bid');
  if (nextBidEl) nextBidEl.textContent = `₹${nextBid.toFixed(2)} Cr`;

  const incrementSubEl = document.getElementById('display-increment-sub');
  if (incrementSubEl) {
    const incLakhs = Math.round(increment * 100);
    const incLabel = incLakhs >= 100 ? `₹${(incLakhs / 100).toFixed(2)} Cr` : `₹${incLakhs} Lakhs`;
    incrementSubEl.textContent = `+${incLabel} tier`;
  }

  // Single Primary Place Bid Button
  const bidBtn = document.getElementById('btn-place-bid');
  const bidTitle = document.getElementById('btn-bid-title');
  const bidSub = document.getElementById('btn-bid-sub');
  const disabledReason = document.getElementById('bid-disabled-reason');

  if (bidBtn && bidTitle && bidSub) {
    const incLakhs = Math.round(increment * 100);
    const incLabel = incLakhs >= 100 ? `₹${(incLakhs / 100).toFixed(2)} Cr` : `₹${incLakhs}L`;

    bidTitle.textContent = `PLACE BID — ₹${nextBid.toFixed(2)} Cr`;
    bidSub.textContent = `Next mandatory increment (+${incLabel})`;

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

  updateTimerDisplay(room.auction.timer);
}

function checkBidEligibility(room, nextBid) {
  if (room.auction.status === 'paused') {
    return { canBid: false, reason: 'Auction is currently paused by host.' };
  }
  if (room.auction.status === 'stopped') {
    return { canBid: false, reason: 'Auction is currently stopped by host.' };
  }
  if (room.auction.status === 'sold' || room.auction.status === 'unsold') {
    return { canBid: false, reason: 'Bidding finalized. Next player appearing...' };
  }
  if (!state.userFranchise || !room.franchises[state.userFranchise]) {
    return { canBid: false, reason: 'Select a franchise to enable bidding.' };
  }
  if (room.auction.currentBidder === state.userFranchise) {
    return { canBid: false, reason: 'You currently hold the highest bid!' };
  }

  const f = room.franchises[state.userFranchise];
  const player = room.auction.currentPlayer;

  if ((f.squad || []).length >= (room.config.maxSquad || 25)) {
    return { canBid: false, reason: 'Maximum squad limit of 25 reached.' };
  }
  if (player && player.isOverseas) {
    const osCount = (f.squad || []).filter(p => p.isOverseas).length;
    if (osCount >= (room.config.maxOverseas || 8)) {
      return { canBid: false, reason: 'Maximum overseas quota of 8 reached.' };
    }
  }

  const currentCount = (f.squad || []).length;
  const minSquad = room.config.minSquad || 18;
  const remainingNeeded = Math.max(0, minSquad - (currentCount + 1));
  const reserveRequired = remainingNeeded * 0.75;

  if (f.purse < nextBid) {
    return { canBid: false, reason: `Purse balance (₹${f.purse.toFixed(2)} Cr) is lower than ₹${nextBid.toFixed(2)} Cr.` };
  }
  if ((f.purse - nextBid) < reserveRequired) {
    return { canBid: false, reason: `Need ₹${reserveRequired.toFixed(2)} Cr reserve to fill mandatory min 18 squad.` };
  }

  return { canBid: true };
}

function getNextBidIncrement(currentBid) {
  if (currentBid < 2.0) return 0.10;
  if (currentBid < 5.0) return 0.25;
  if (currentBid < 10.0) return 0.50;
  return 1.00;
}

async function sendBid(amount) {
  if (!state.roomId || !state.userFranchise) return;
  const btn = document.getElementById('btn-place-bid');
  if (btn) btn.disabled = true;

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
    const data = await res.json();
    if (!res.ok) alert(data.message || data.error || 'Bid rejected');
  } catch (e) {
    console.error('Bid error:', e);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function updateTimerDisplay(timer) {
  const secondsEl = document.getElementById('timer-seconds');
  if (secondsEl) {
    secondsEl.textContent = timer;
    secondsEl.classList.toggle('timer-warning', timer <= 4);
  }

  const circle = document.getElementById('timer-progress-circle');
  if (circle) {
    const maxTimer = (state.roomData && state.roomData.config && state.roomData.config.timerDuration) || 20;
    const circumference = 2 * Math.PI * 42; // r = 42 -> ~264
    const fraction = Math.max(0, Math.min(1, timer / maxTimer));
    circle.style.strokeDashoffset = circumference * (1 - fraction);
    circle.style.stroke = timer <= 4 ? 'var(--accent-red)' : (timer <= 8 ? 'var(--accent-gold)' : 'var(--accent-orange)');
  }
}

// Left Column Teams List
function renderLeftTeamsPanel(room) {
  const container = document.getElementById('bidding-teams-list');
  if (!container) return;
  container.innerHTML = '';

  Object.entries(room.franchises || {}).forEach(([code, f]) => {
    const isMine = f.user === state.userName;
    const isLeader = room.auction && room.auction.currentBidder === code;

    const row = document.createElement('div');
    row.className = `compact-team-row ${isMine ? 'my-team' : ''} ${isLeader ? 'leader' : ''}`;

    row.innerHTML = `
      <div class="compact-team-name-col">
        <div class="compact-circle-tag" style="background:${f.color}; color:${f.textColor}">${f.shortName}</div>
        <div style="min-width:0">
          <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${f.shortName}</div>
          <div style="font-size:0.65rem; color:var(--text-dim)">${f.user ? f.user : 'Available'} · ${(f.squad || []).length}/25</div>
        </div>
      </div>
      <div class="compact-purse-val">₹${(f.purse || 0).toFixed(2)} Cr</div>
    `;

    container.appendChild(row);
  });
}

// Right Column Activity Feed
function renderActivityFeed(room) {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;

  const history = (room.auction && room.auction.bidHistory) || [];
  if (history.length === 0) {
    feed.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.75rem">No bids placed for this lot yet.</div>`;
    return;
  }

  feed.innerHTML = '';
  const reversed = [...history].reverse();
  reversed.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `activity-feed-item ${idx === 0 ? 'latest' : ''}`;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-weight:700">
        <span style="color:var(--accent-orange)">${item.franchiseName || item.franchise}</span>
        <span style="font-size:0.7rem; color:var(--text-dim)">${item.time || ''}</span>
      </div>
      <div style="color:var(--text-muted); font-size:0.78rem">Placed bid: ₹${(item.amount || 0).toFixed(2)} Cr</div>
    `;
    feed.appendChild(div);
  });
}

function switchMobileBiddingView(view) {
  state.mobileBiddingView = view;
  const colTeams = document.getElementById('bidding-col-teams');
  const colPodium = document.getElementById('bidding-col-center');
  const colActivity = document.getElementById('bidding-col-activity');

  document.querySelectorAll('.mobile-auction-tab-bar .mob-auction-tab').forEach(b => b.classList.remove('active'));
  const activeTab = document.getElementById(`mob-tab-${view}`);
  if (activeTab) activeTab.classList.add('active');

  if (view === 'podium') {
    if (colPodium) colPodium.style.display = 'flex';
    if (colTeams) colTeams.classList.remove('mobile-visible');
    if (colActivity) colActivity.classList.remove('mobile-visible');
  } else if (view === 'teams') {
    if (colPodium) colPodium.style.display = 'none';
    if (colTeams) colTeams.classList.add('mobile-visible');
    if (colActivity) colActivity.classList.remove('mobile-visible');
  } else if (view === 'feed') {
    if (colPodium) colPodium.style.display = 'none';
    if (colTeams) colTeams.classList.remove('mobile-visible');
    if (colActivity) colActivity.classList.add('mobile-visible');
  }
}

// -----------------------------------------------------------------------------
// 10. PAGE 3: TEAMS & SQUADS (VIEW SQUAD 4-ROLES MODAL)
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
    card.style.borderTop = `4px solid ${f.color}`;

    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-badge-circle" style="background:${f.color}; color:${f.textColor}">${f.shortName}</div>
        <div>
          <h3 class="team-card-title">${f.name}</h3>
          <div class="team-card-manager">${f.user ? `👤 Manager: ${f.user}` : '<span style="color:var(--text-dim)">Available</span>'}</div>
        </div>
      </div>
      <div class="team-card-body">
        <div class="team-metric-row">
          <span class="metric-label">Remaining Purse</span>
          <span class="metric-val gold">₹${(f.purse || 0).toFixed(2)} Cr</span>
        </div>
        <div class="team-metric-row">
          <span class="metric-label">Total Spent</span>
          <span>₹${(f.spent || 0).toFixed(2)} Cr</span>
        </div>
        <div class="team-metric-row">
          <span class="metric-label">Squad Size</span>
          <span>${(f.squad || []).length} / ${maxSquad}</span>
        </div>
        <div class="team-metric-row">
          <span class="metric-label">Overseas Quota</span>
          <span>${osCount} / ${maxOverseas}</span>
        </div>
        <div class="team-metric-row">
          <span class="metric-label">Open Slots</span>
          <span style="color:var(--accent-green)">${openSlots} slots remaining</span>
        </div>
      </div>
      <button class="btn-cta-secondary" onclick="openSquadModal('${code}')" style="width:100%; font-size:0.82rem; padding:0.5rem">
        View Squad Roster →
      </button>
    `;
    grid.appendChild(card);
  });
}

function openSquadModal(code) {
  if (!state.roomData || !state.roomData.franchises[code]) return;
  state.inspectingFranchise = code;
  state.selectedSquadRole = 'all';

  const f = state.roomData.franchises[code];
  const maxSquad = state.roomData.config.maxSquad || 25;
  const maxOverseas = state.roomData.config.maxOverseas || 8;
  const osCount = (f.squad || []).filter(p => p.isOverseas).length;

  document.getElementById('squad-modal-title').textContent = f.name;
  document.getElementById('squad-modal-motto').textContent = f.motto || `${f.shortName} Official Roster`;
  const logo = document.getElementById('squad-modal-logo');
  if (logo) {
    logo.textContent = f.shortName;
    logo.style.background = f.color;
    logo.style.color = f.textColor;
  }

  document.getElementById('squad-sum-purse').textContent = `₹${(f.purse || 0).toFixed(2)} Cr`;
  document.getElementById('squad-sum-spent').textContent = `₹${(f.spent || 0).toFixed(2)} Cr`;
  document.getElementById('squad-sum-size').textContent = `${(f.squad || []).length} / ${maxSquad}`;
  document.getElementById('squad-sum-os').textContent = `${osCount} / ${maxOverseas}`;
  document.getElementById('squad-sum-slots').textContent = maxSquad - (f.squad || []).length;

  const squad = f.squad || [];
  const batters = squad.filter(p => (p.role || '').toLowerCase().includes('batter') && !p.isWicketkeeper);
  const keepers = squad.filter(p => p.isWicketkeeper || (p.role || '').toLowerCase().includes('wicketkeeper'));
  const allround = squad.filter(p => (p.role || '').toLowerCase().includes('all-rounder'));
  const bowlers = squad.filter(p => (p.role || '').toLowerCase().includes('bowler') || (p.role || '').toLowerCase().includes('spinner'));

  document.getElementById('sq-count-all').textContent = squad.length;
  document.getElementById('sq-count-batters').textContent = batters.length;
  document.getElementById('sq-count-keepers').textContent = keepers.length;
  document.getElementById('sq-count-allround').textContent = allround.length;
  document.getElementById('sq-count-bowlers').textContent = bowlers.length;

  filterSquadRole('all');
  document.getElementById('squad-modal').classList.remove('hidden');
}

function filterSquadRole(role) {
  state.selectedSquadRole = role;
  document.querySelectorAll('.squad-role-tabs .squad-tab-btn').forEach(btn => btn.classList.remove('active'));

  const tabId = role === 'all' ? 'tab-sq-all' : (role === 'Batter' ? 'tab-sq-batters' : (role === 'Wicketkeeper' ? 'tab-sq-keepers' : (role === 'All-rounder' ? 'tab-sq-allround' : 'tab-sq-bowlers')));
  const activeBtn = document.getElementById(tabId);
  if (activeBtn) activeBtn.classList.add('active');

  const container = document.getElementById('squad-players-container');
  if (!container || !state.inspectingFranchise || !state.roomData) return;

  const f = state.roomData.franchises[state.inspectingFranchise];
  let squad = f.squad || [];
  if (role === 'Wicketkeeper') squad = squad.filter(p => p.isWicketkeeper || (p.role || '').toLowerCase().includes('wicketkeeper'));
  else if (role === 'Batter') squad = squad.filter(p => (p.role || '').toLowerCase().includes('batter') && !p.isWicketkeeper);
  else if (role === 'All-rounder') squad = squad.filter(p => (p.role || '').toLowerCase().includes('all-rounder'));
  else if (role === 'Bowler') squad = squad.filter(p => (p.role || '').toLowerCase().includes('bowler') || (p.role || '').toLowerCase().includes('spinner'));

  if (squad.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.85rem">No players in this discipline.</div>`;
    return;
  }

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Player</th>
          <th>Role</th>
          <th>Type</th>
          <th>Rating</th>
          <th style="text-align:right">Price</th>
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
        <td style="text-align:right; font-weight:800; color:var(--accent-gold)">₹${(p.soldPrice || p.boughtPrice || p.basePrice || 0).toFixed(2)} Cr</td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

// -----------------------------------------------------------------------------
// 11. PAGE 4: PLAYERS LIST (250 POOL) & ADMIN BASE PRICE
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
    if (status) players = players.filter(p => p.status === status);

    const badge = document.getElementById('pool-total-badge');
    if (badge) badge.textContent = `${players.length} Players`;

    tbody.innerHTML = '';
    const isLobby = state.roomData && state.roomData.stage === 'lobby';

    players.forEach((p, idx) => {
      const tr = document.createElement('tr');
      let statusHtml = p.status === 'Sold'
        ? `<span class="tag tag-overseas">SOLD (${p.soldTo})</span>`
        : (p.status === 'Unsold' ? `<span class="tag" style="background:#475569">UNSOLD</span>` : `<span class="tag tag-india">AVAILABLE</span>`);

      let actionHtml = '--';
      if (state.isHost && isLobby) {
        actionHtml = `<button class="btn-link" onclick="openBasePriceEditor('${p.id}', '${p.name}', ${p.basePrice})" style="font-size:0.75rem; color:#38bdf8">✏️ Edit</button>`;
      }

      tr.innerHTML = `
        <td style="font-family:monospace; font-size:0.75rem; color:var(--text-dim)">#${idx + 1}</td>
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
  } catch (e) {
    console.error('Error loading pool:', e);
  }
}

function openBasePriceEditor(id, name, currentPrice) {
  document.getElementById('edit-player-id').value = id;
  document.getElementById('edit-player-name-label').textContent = `Set Starting Price for ${name}`;
  document.getElementById('edit-player-price-select').value = currentPrice.toFixed(2);
  document.getElementById('edit-price-modal').classList.remove('hidden');
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
    if (res.ok) {
      closeModal('edit-price-modal');
      loadPlayerPool();
    }
  } catch (e) {}
}

function openPlayerDetailsModal() {
  if (!state.roomData || !state.roomData.auction || !state.roomData.auction.currentPlayer) return;
  const p = state.roomData.auction.currentPlayer;
  document.getElementById('pmodal-name').textContent = `${p.name} - Career Records`;

  const body = document.getElementById('pmodal-body');
  body.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; font-size:0.85rem">
      <div class="kpi-card"><span class="kpi-label">Role</span><div style="font-weight:800">${p.role}</div></div>
      <div class="kpi-card"><span class="kpi-label">Nationality</span><div style="font-weight:800">${p.nationality || 'India'}</div></div>
      <div class="kpi-card"><span class="kpi-label">Batting Style</span><div style="font-weight:800">${p.battingStyle || 'Right-hand Bat'}</div></div>
      <div class="kpi-card"><span class="kpi-label">Bowling Style</span><div style="font-weight:800">${p.bowlingStyle || '--'}</div></div>
      <div class="kpi-card"><span class="kpi-label">Runs</span><div style="font-weight:800">${p.runs !== undefined ? p.runs : '--'}</div></div>
      <div class="kpi-card"><span class="kpi-label">Strike Rate</span><div style="font-weight:800">${p.strikeRate ? p.strikeRate.toFixed(1) : '--'}</div></div>
      <div class="kpi-card"><span class="kpi-label">Wickets</span><div style="font-weight:800">${p.wickets !== undefined ? p.wickets : '--'}</div></div>
      <div class="kpi-card"><span class="kpi-label">Economy</span><div style="font-weight:800">${p.economy ? p.economy.toFixed(2) : '--'}</div></div>
    </div>
  `;
  document.getElementById('player-details-modal').classList.remove('hidden');
}

// -----------------------------------------------------------------------------
// 12. PAGE 5: AUCTION RESULTS
// -----------------------------------------------------------------------------
function renderHistoryPage() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody || !state.roomData) return;

  const history = state.roomData.auctionHistory || [];
  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-dim)">No gavel decisions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  history.forEach((rec, idx) => {
    const tr = document.createElement('tr');
    const isSold = rec.status === 'Sold';
    const decisionBadge = isSold
      ? `<span class="tag tag-overseas" style="background:rgba(34,197,94,0.15); color:var(--accent-green)">SOLD</span>`
      : `<span class="tag" style="background:rgba(239,68,68,0.15); color:var(--accent-red)">UNSOLD</span>`;

    const f = rec.soldTo && state.roomData.franchises[rec.soldTo];
    const teamBadge = f
      ? `<span style="background:${f.color}; color:${f.textColor}; padding:0.15rem 0.4rem; border-radius:4px; font-weight:800; font-size:0.7rem; margin-right:0.35rem">${f.shortName}</span> ${f.name}`
      : '--';

    tr.innerHTML = `
      <td style="font-family:monospace; color:var(--text-dim)">#${idx + 1}</td>
      <td style="font-weight:700">${rec.playerName || (rec.player && rec.player.name) || '--'}</td>
      <td>${rec.role || (rec.player && rec.player.role) || '--'}</td>
      <td>${decisionBadge}</td>
      <td>${teamBadge}</td>
      <td style="text-align:right; font-weight:800; color:${isSold ? 'var(--accent-gold)' : 'var(--text-dim)'}">
        ${isSold ? `₹${(rec.soldPrice || 0).toFixed(2)} Cr` : '--'}
      </td>
      <td style="text-align:right; font-size:0.72rem; color:var(--text-dim)">${rec.time || '--'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -----------------------------------------------------------------------------
// 13. PAGE 6: MY STRATEGY NOTES (100% PRIVATE)
// -----------------------------------------------------------------------------
function loadPrivateStrategyNotes() {
  const key = `ipl_strat_${state.roomId || 'room'}_${state.userName || 'user'}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.targets !== undefined) document.getElementById('strategy-targets').value = parsed.targets;
      if (parsed.avoid !== undefined) document.getElementById('strategy-avoid').value = parsed.avoid;
      if (parsed.notes !== undefined) document.getElementById('strategy-notes').value = parsed.notes;
      ['batters', 'keepers', 'allround', 'pacers', 'spinners', 'overseas'].forEach(r => {
        const el = document.getElementById(`chk-${r}`);
        if (el && parsed.checklist && parsed.checklist[r] !== undefined) el.checked = parsed.checklist[r];
      });
    } catch (e) {}
  }

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
  const key = `ipl_strat_${state.roomId || 'room'}_${state.userName || 'user'}`;
  const checklist = {};
  ['batters', 'keepers', 'allround', 'pacers', 'spinners', 'overseas'].forEach(r => {
    const el = document.getElementById(`chk-${r}`);
    checklist[r] = el ? el.checked : false;
  });

  const payload = {
    targets: document.getElementById('strategy-targets').value,
    avoid: document.getElementById('strategy-avoid').value,
    notes: document.getElementById('strategy-notes').value,
    checklist
  };
  localStorage.setItem(key, JSON.stringify(payload));

  const indicator = document.getElementById('strategy-save-indicator');
  if (indicator) {
    indicator.textContent = 'Saving...';
    setTimeout(() => { indicator.textContent = 'Saved Automatically'; }, 250);
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

  document.getElementById('strat-calc-purse').textContent = `₹${purse.toFixed(2)} Cr`;
  document.getElementById('strat-calc-squad').textContent = `${squadCount} / ${maxSquad}`;
  document.getElementById('strat-calc-needed').textContent = `${remainingNeeded} slots`;
  document.getElementById('strat-calc-reserve').textContent = `₹${reserveRequired.toFixed(2)} Cr`;
  document.getElementById('strat-calc-maxbid').textContent = `₹${maxSafeBid.toFixed(2)} Cr`;
}

// -----------------------------------------------------------------------------
// 14. ADMIN ACTIONS & CONFIRMATION MODALS (Requirement 8)
// -----------------------------------------------------------------------------
function promptStartAuction() {
  if (!state.isHost) return;
  const claimed = Object.values(state.roomData.franchises || {}).filter(f => f.user !== null).length;
  showAdminConfirmModal(
    'Start Auction Confirmation',
    `You are about to start the live autonomous auction.<br><br>
     • <strong>Claimed Managers:</strong> ${claimed} / 10<br>
     • <strong>Starting Purse:</strong> ₹${(state.roomData.config.initialPurse || 120).toFixed(2)} Cr<br>
     • <strong>Squad Size:</strong> ${state.roomData.config.minSquad} Min — ${state.roomData.config.maxSquad} Max<br>
     • <strong>Timer:</strong> ${state.roomData.config.timerDuration}s per lot<br><br>
     All unclaimed teams remain Available. Only human managers can bid.`,
    () => hostAction('start')
  );
}

function togglePause() {
  if (!state.isHost) return;
  const isPaused = state.roomData && state.roomData.auction && state.roomData.auction.isPaused;
  hostAction(isPaused ? 'resume' : 'pause');
}

function promptStopAuction() {
  if (!state.isHost) return;
  showAdminConfirmModal(
    'Stop Auction Confirmation',
    `Stopping the auction will immediately freeze the countdown and prevent further bids.<br><br>
     All completed purchases and squad balances are strictly preserved. You can resume at any time.`,
    () => hostAction('stop')
  );
}

function promptEndAuction() {
  if (!state.isHost) return;
  showAdminConfirmModal(
    'End Auction Permanently',
    `This is a final action! No more bids will be accepted and final tournament standings will be generated.<br><br>
     Are you sure you want to finalize the IPL Mega Auction?`,
    () => hostAction('end')
  );
}

function skipPlayer() {
  if (!state.isHost) return;
  if (confirm('Skip current player and move directly to the next lot?')) {
    hostAction('skip');
  }
}

async function hostAction(action, payload = {}) {
  try {
    const res = await fetch('/api/room/auctioneer', {
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
    if (!res.ok) alert(data.message || data.error || 'Host action failed');
    closeModal('admin-confirm-modal');
  } catch (e) {
    alert('Host action network error');
  }
}

function showAdminConfirmModal(title, contentHtml, onConfirm) {
  document.getElementById('admin-modal-title').textContent = title;
  document.getElementById('admin-modal-content').innerHTML = contentHtml;
  const btn = document.getElementById('admin-modal-confirm-btn');
  btn.onclick = onConfirm;
  document.getElementById('admin-confirm-modal').classList.remove('hidden');
}

// -----------------------------------------------------------------------------
// 15. UTILITIES & MODAL HELPERS
// -----------------------------------------------------------------------------
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function copyInviteLink() {
  const url = `${window.location.origin}/?room=${encodeURIComponent(state.roomId || 'IPL-2026')}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      alert(`Invitation link copied to clipboard:\n${url}`);
    }).catch(() => prompt('Copy invitation link:', url));
  } else {
    prompt('Copy invitation link:', url);
  }
}

function shareWhatsApp() {
  const url = `${window.location.origin}/?room=${encodeURIComponent(state.roomId || 'IPL-2026')}`;
  const text = `Join my IPL Auction Arena room: ${state.roomId}! Choose your franchise and bid live: ${url}`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function shareNative() {
  const url = `${window.location.origin}/?room=${encodeURIComponent(state.roomId || 'IPL-2026')}`;
  if (navigator.share) {
    navigator.share({
      title: 'IPL Auction Arena 2026',
      text: `Join IPL Auction room ${state.roomId}!`,
      url: url
    }).catch(() => copyInviteLink());
  } else {
    copyInviteLink();
  }
}

function updateUserPill() {
  const pill = document.getElementById('user-pill-text');
  if (!pill) return;

  if (state.userFranchise && state.roomData && state.roomData.franchises[state.userFranchise]) {
    const f = state.roomData.franchises[state.userFranchise];
    pill.innerHTML = `<span style="color:${f.color}; font-weight:800">${f.shortName}</span> · ${state.userName}`;
  } else if (state.isHost) {
    pill.innerHTML = `👑 Host · ${state.userName}`;
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

// -----------------------------------------------------------------------------
// 16. EVENT LISTENERS
// -----------------------------------------------------------------------------
function setupEventListeners() {
  const searchInput = document.getElementById('pool-search-input');
  if (searchInput) searchInput.oninput = loadPlayerPool;

  const roleSelect = document.getElementById('pool-role-filter');
  if (roleSelect) roleSelect.onchange = loadPlayerPool;

  const statusSelect = document.getElementById('pool-status-filter');
  if (statusSelect) statusSelect.onchange = loadPlayerPool;
}
