// Modern Web Audio API sound synthesizer for IPL Auction Arena
// Zero external MP3 dependencies - 100% offline & instant loading

class AuctionSoundEngine {
  constructor() {
    this.ctx = null;
    // Default sound effects: ON, Default Voice Assistant: OFF (strictly as required)
    this.muted = localStorage.getItem('ipl_sound_effects') === 'false';
    this.speechEnabled = localStorage.getItem('ipl_voice_assistant') === 'true'; // Default is OFF
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('ipl_sound_effects', (!this.muted).toString());
    return this.muted;
  }

  setMute(isMuted) {
    this.muted = Boolean(isMuted);
    localStorage.setItem('ipl_sound_effects', (!this.muted).toString());
    return this.muted;
  }

  toggleVoiceAssistant() {
    this.speechEnabled = !this.speechEnabled;
    localStorage.setItem('ipl_voice_assistant', this.speechEnabled.toString());
    return this.speechEnabled;
  }

  setVoiceAssistant(enabled) {
    this.speechEnabled = Boolean(enabled);
    localStorage.setItem('ipl_voice_assistant', this.speechEnabled.toString());
    return this.speechEnabled;
  }

  // Authentic wooden gavel hammer strike
  playGavel() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Transient crack (noise burst)
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.05);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.008));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1200, t);
    noiseFilter.Q.setValueAtTime(3, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);

    // Deep wood block resonance (dual oscillator body)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(160, t);
    osc1.frequency.exponentialRampToValueAtTime(45, t + 0.15);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(320, t);
    osc2.frequency.exponentialRampToValueAtTime(80, t + 0.12);

    bodyGain.gain.setValueAtTime(0.8, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc1.connect(bodyGain);
    osc2.connect(bodyGain);
    bodyGain.connect(this.ctx.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.25);
    osc2.stop(t + 0.25);
  }

  playGavelStrike() {
    this.playGavel();
  }

  // Crisp metallic bid chime
  playBidChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscHarmonic = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t); // A5
    osc.frequency.setValueAtTime(1046.5, t + 0.05); // C6

    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(1760, t);
    oscHarmonic.frequency.setValueAtTime(2093, t + 0.05);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    oscHarmonic.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    oscHarmonic.start(t);
    osc.stop(t + 0.35);
    oscHarmonic.stop(t + 0.35);
  }

  playNewLot() {
    this.playBidChime();
  }

  // Timer tick for final countdown
  playTick(pitch = 600) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(pitch, t);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
  }

  // Stadium Sold Fanfare
  playSoldFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // First: gavel strike
    this.playGavel();

    // Second: fanfare chords after 150ms
    setTimeout(() => {
      if (this.muted || !this.ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = this.ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.3, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.6);
      });
    }, 150);
  }

  // Voice announcement via browser SpeechSynthesis
  speak(text) {
    if (this.muted || !this.speechEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  }

  announceAuctionStart() {
    this.speak('IPL Mega Auction 2026 has begun. Autonomous bidding is live.');
  }

  announceNewPlayer(player) {
    if (!player) return;
    this.speak(`Next player on the podium: ${player.name}, ${player.role}, starting base price ${player.basePrice} crore.`);
  }

  announceBid(franchiseName, amount) {
    this.speak(`Bid: ${franchiseName}, ${amount.toFixed(2)} crore.`);
  }

  announceSold(playerName, franchiseName, price) {
    this.speak(`Sold! ${playerName} acquired by ${franchiseName} for ${price.toFixed(2)} crore.`);
  }

  announceUnsold(playerName) {
    this.speak(`Unsold. No bids placed for ${playerName}.`);
  }

  announceConclusion() {
    this.speak('The IPL Mega Auction has concluded. All 10 squads finalized.');
  }
}

window.soundEngine = new AuctionSoundEngine();
