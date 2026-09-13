export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.tracks = new Map();
    this.currentTrack = null;
    this.volume = 0.3;
    this.muted = false;
    this._playRequestId = 0;
    this._fadeTimer = null;
  }

  async init() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  async loadTrack(name, url) {
    if (this.tracks.has(name)) return true;

    const audio = new Audio(url);
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
    
    // We don't call audio.load() here to strictly honor preload='none' until play
    this.tracks.set(name, { audio, source: null, gainNode: null });
    return true;
  }

  _stopTracks() {
    this.currentTrack = null;
    this.tracks.forEach((track) => {
      if (track.audio) {
        track.audio.pause();
        track.audio.currentTime = 0;
        track.audio.onended = null;
      }
    });
  }

  stopImmediate() {
    this._playRequestId += 1;
    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
    }
    this._stopTracks();
  }

  async playTrack(name, options = {}) {
    const track = this.tracks.get(name);
    if (!track || !track.audio) return false;
    const requestId = ++this._playRequestId;

    try {
      const context = await this.init();
      if (requestId !== this._playRequestId || context.state === 'closed') return false;
      if (context.state === 'suspended') await context.resume();
      if (requestId !== this._playRequestId || context.state === 'closed') return false;

      // Stop existing media without invalidating this request.
      this._stopTracks();

      // Create source node if not already created.
      if (!track.source) {
        track.source = context.createMediaElementSource(track.audio);
        track.gainNode = context.createGain();
        track.source.connect(track.gainNode);
        track.gainNode.connect(context.destination);
      }

      const targetVolume = options.volume !== undefined ? options.volume : this.volume;
      track.gainNode.gain.value = this.muted ? 0 : Math.max(0, Math.min(1, targetVolume));
      track.audio.loop = options.loop || false;

      await track.audio.play();
      if (requestId !== this._playRequestId) {
        track.audio.pause();
        track.audio.currentTime = 0;
        track.audio.onended = null;
        return false;
      }
      this.currentTrack = name;

      track.audio.onended = () => {
        if (requestId === this._playRequestId && this.currentTrack === name && !track.audio.loop) {
          this.currentTrack = null;
          if (typeof options.onEnded === 'function') options.onEnded();
        }
      };
      return true;
    } catch (error) {
      if (requestId === this._playRequestId) {
        console.warn(`Failed to play track ${name}:`, error.message);
      }
      return false;
    }
  }

  stopTrack(name) {
    const track = this.tracks.get(name);
    if (track && track.audio) {
      track.audio.pause();
      track.audio.currentTime = 0;
    }
  }

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

    this._fadeTimer = setTimeout(() => {
      this._fadeTimer = null;
      this.stopImmediate();
    }, duration + 50);
  }

  softCleanup() {
    this.stopImmediate();
  }

  async cleanup() {
    this.stopImmediate();
    const context = this.audioContext;
    this.audioContext = null;
    this.tracks.forEach((track) => {
      try { track.source?.disconnect(); } catch { /* already disconnected */ }
      try { track.gainNode?.disconnect(); } catch { /* already disconnected */ }
      if (track.audio) {
        track.audio.onended = null;
        track.audio.removeAttribute('src');
        track.audio.load();
      }
    });
    this.tracks.clear();
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* closing is best-effort */ }
    }
  }

  async preloadTracks() {
    const tracks = [
      { name: 'run-boy-run',           url: '/audio/run-boy-run.mp3' },
      { name: 'seek-chase',            url: '/audio/seek-chase-theme.mp3' },
      { name: 'midnight-scary',        url: '/audio/seek-chase-theme.mp3' },
      { name: 'shush-all-star',        url: '/audio/shush-all-star.mp3' },
      { name: 'more-makreel-thrifty',  url: '/audio/more-makreel-thrifty.mp3' },
      { name: 'noon-chill',            url: '/audio/dirty-paws-monsters-nmen.mp3' },
      { name: 'noon-track2',           url: '/audio/badtuch-bloodhoundg.mp3' },
      { name: 'thrilla-michael-jackson', url: '/audio/thrilla-michael-jackson.mp3' },
      { name: 'monster-fren-mikeybotz', url: '/audio/monster-fren-mikeybotz.mp3' },
      { name: 'dirty-paws-monsters-nmen', url: '/audio/dirty-paws-monsters-nmen.mp3' },
      { name: 'smuth-criminal-zandaru', url: '/audio/smuth-criminal-zandaru.mp3' },
      { name: 'badtuch-bloodhoundg',   url: '/audio/badtuch-bloodhoundg.mp3' },
    ];

    // loadTrack now just registers the url, no immediate download
    for (const t of tracks) {
      this.loadTrack(t.name, t.url);
    }
    console.log(`AudioManager: ${tracks.length} tracks registered (preload='none')`);
  }
}

export const audioManager = new AudioManager();
