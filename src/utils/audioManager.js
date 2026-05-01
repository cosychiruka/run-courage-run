class AudioManager {
  constructor() {
    this.audioContext = null;
    this.tracks = new Map();
    this.currentTrack = null;
    this.volume = 0.3;
    this.muted = false;
    this._stopping = false; // guard flag during fade/stop
  }

  async init() {
    // If context was closed/destroyed by a previous cleanup(), recreate it
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  async loadTrack(name, url) {
    await this.init();
    if (this.tracks.has(name) && this.tracks.get(name).buffer) return true; // already loaded

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Track ${name} not found at ${url} - will be skipped`);
        return false;
      }
      const arrayBuffer = await response.arrayBuffer();
      // Re-init in case context was recreated after a load started
      await this.init();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.tracks.set(name, { buffer: audioBuffer, source: null, gainNode: null });
      return true;
    } catch (error) {
      console.warn(`Failed to load track ${name}:`, error.message);
      return false;
    }
  }

  /** Synchronously kill every playing source — no fade, instant. Safe to call before starting a new track. */
  stopImmediate() {
    this._stopping = true;
    this.tracks.forEach((track) => {
      if (track.source) {
        try { track.source.stop(); } catch (_) {}
        track.source = null;
        track.gainNode = null;
      }
    });
    this.currentTrack = null;
    this._stopping = false;
  }

  async playTrack(name, options = {}) {
    const track = this.tracks.get(name);
    if (!track || !track.buffer) return false;

    await this.init();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Synchronous hard stop — prevents any overlap
    this.stopImmediate();

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    source.buffer = track.buffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const targetVolume = options.volume !== undefined ? options.volume : this.volume;
    gainNode.gain.value = this.muted ? 0 : Math.max(0, Math.min(1, targetVolume));
    source.loop = options.loop || false;
    source.start(0);

    track.source = source;
    track.gainNode = gainNode;
    this.currentTrack = name;

    source.onended = () => {
      if (this.currentTrack === name && !source.loop) {
        this.currentTrack = null;
      }
    };

    return true;
  }

  stopTrack(name) {
    const track = this.tracks.get(name);
    if (track && track.source) {
      try { track.source.stop(); } catch (_) {}
      track.source = null;
      track.gainNode = null;
    }
  }

  // Legacy alias — use stopImmediate() for new code
  stopAllTracks() { this.stopImmediate(); }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = (this.volume === 0);
    if (this.currentTrack) {
      const track = this.tracks.get(this.currentTrack);
      if (track && track.gainNode) {
        track.gainNode.gain.value = this.muted ? 0 : this.volume;
      }
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.currentTrack) {
      const track = this.tracks.get(this.currentTrack);
      if (track && track.gainNode) {
        track.gainNode.gain.value = this.muted ? 0 : this.volume;
      }
    }
    return this.muted;
  }

  isMuted() { return this.muted; }

  fadeOut(duration = 500) {
    if (!this.currentTrack) return;
    const track = this.tracks.get(this.currentTrack);
    if (!track || !track.gainNode || !this.audioContext) return;

    const gainNode = track.gainNode;
    const now = this.audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000);

    // Stop cleanly after fade — don't destroy context
    setTimeout(() => { this.stopImmediate(); }, duration + 50);
  }

  /** Soft cleanup: stop all tracks but keep context alive for next world */
  softCleanup() {
    this.stopImmediate();
  }

  /** Hard cleanup: destroys AudioContext — only call on full app teardown */
  cleanup() {
    this.stopImmediate();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.tracks.clear();
  }

  async preloadTracks() {
    const tracks = [
      // Evening tracks
      { name: 'run-boy-run',           url: '/audio/run-boy-run.mp3' },
      { name: 'seek-chase',            url: '/audio/seek-chase-theme.mp3' },
      // Shared alias for midnight
      { name: 'midnight-scary',        url: '/audio/seek-chase-theme.mp3' },
      // Sunrise tracks
      { name: 'shush-all-star',        url: '/audio/shush-all-star.mp3' },
      { name: 'more-makreel-thrifty',  url: '/audio/more-makreel-thrifty.mp3' },
      // Noon tracks
      { name: 'noon-chill',            url: '/audio/dirty-paws-monsters-nmen.mp3' },
      { name: 'noon-track2',           url: '/audio/badtuch-bloodhoundg.mp3' },
      // Disco playlist
      { name: 'thrilla-michael-jackson', url: '/audio/thrilla-michael-jackson.mp3' },
      { name: 'monster-fren-mikeybotz', url: '/audio/monster-fren-mikeybotz.mp3' },
      { name: 'dirty-paws-monsters-nmen', url: '/audio/dirty-paws-monsters-nmen.mp3' },
      { name: 'smuth-criminal-zandaru', url: '/audio/smuth-criminal-zandaru.mp3' },
      { name: 'badtuch-bloodhoundg',   url: '/audio/badtuch-bloodhoundg.mp3' },
    ];

    const results = await Promise.allSettled(
      tracks.map(t => this.loadTrack(t.name, t.url))
    );
    const loaded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log(`AudioManager: ${loaded}/${tracks.length} tracks ready`);
  }
}

export const audioManager = new AudioManager();
