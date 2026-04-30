class AudioManager {
  constructor() {
    this.audioContext = null;
    this.tracks = new Map();
    this.currentTrack = null;
    this.volume = 0.3;
  }

  async init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  async loadTrack(name, url) {
    await this.init();
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Track ${name} not found at ${url} - will be skipped`);
        return false;
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.tracks.set(name, {
        buffer: audioBuffer,
        source: null,
        gainNode: null
      });
      
      return true;
    } catch (error) {
      console.warn(`Failed to load track ${name} - will be skipped:`, error.message);
      return false;
    }
  }

  async playTrack(name, options = {}) {
    const track = this.tracks.get(name);
    if (!track || !track.buffer) return false;

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Stop ALL tracks before playing new one (prevent overlap)
    this.stopAllTracks();

    // Create new source
    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = track.buffer;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    // Set volume with proper validation
    const targetVolume = options.volume !== undefined ? options.volume : this.volume;
    gainNode.gain.value = Math.max(0, Math.min(1, targetVolume));
    
    // Handle looping
    source.loop = options.loop || false;
    
    // Start playback
    source.start(0);
    
    // Store references
    track.source = source;
    track.gainNode = gainNode;
    this.currentTrack = name;
    
    // Handle track end
    source.onended = () => {
      if (this.currentTrack === name) {
        this.currentTrack = null;
      }
    };
    
    console.log(`Playing track: ${name} at volume: ${gainNode.gain.value}`);
    return true;
  }

  stopTrack(name) {
    const track = this.tracks.get(name);
    if (track && track.source) {
      try {
        track.source.stop();
        track.source = null;
        track.gainNode = null;
      } catch (error) {
        // Source might have already stopped
      }
    }
  }

  stopAllTracks() {
    // Stop all currently playing tracks
    this.tracks.forEach((track, name) => {
      this.stopTrack(name);
    });
    this.currentTrack = null;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Update current track volume
    if (this.currentTrack) {
      const track = this.tracks.get(this.currentTrack);
      if (track && track.gainNode) {
        track.gainNode.gain.value = this.volume;
        console.log(`Volume set to: ${this.volume} for track: ${this.currentTrack}`);
      }
    } else {
      console.log(`Volume set to: ${this.volume} (no current track)`);
    }
  }

  fadeOut(duration = 1000) {
    if (!this.currentTrack) return;
    
    const track = this.tracks.get(this.currentTrack);
    if (!track || !track.gainNode) return;
    
    const gainNode = track.gainNode;
    const startVolume = gainNode.gain.value;
    const endTime = this.audioContext.currentTime + (duration / 1000);
    
    gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
    gainNode.gain.setValueAtTime(startVolume, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, endTime);
    
    setTimeout(() => {
      this.stopAllTracks(); // Stop ALL tracks, not just current
    }, duration);
  }

  cleanup() {
    // Complete cleanup - stop all tracks and close context
    this.stopAllTracks();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.tracks.clear();
  }

  // Preload common tracks
  async preloadTracks() {
    const tracks = [
      { name: 'run-boy-run', url: '/audio/run-boy-run.mp3' },
      { name: 'seek-chase', url: '/audio/seek-chase-theme.mp3' },
      { name: 'midnight-scary', url: '/audio/seek-chase-theme.mp3' }, // Use existing file as placeholder
      { name: 'sunrise-energetic', url: '/audio/seek-chase-theme.mp3' } // Use existing file as placeholder
    ];

    // Load tracks individually to avoid Promise.all failing completely
    const results = await Promise.allSettled(
      tracks.map(track => this.loadTrack(track.name, track.url))
    );
    
    const loaded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    console.log(`Audio manager: ${loaded}/${tracks.length} tracks loaded successfully`);
  }
}

export const audioManager = new AudioManager();
