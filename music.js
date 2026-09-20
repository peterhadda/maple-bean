// Provider-agnostic focus music. A provider implements:
//   name, tracks: {id,title}[]
//   play(track), pause(), resume(), stop(), setVolume(0..1)
// and optionally next()/previous() if it manages its own playlist order.
// The player UI (app.js) only ever talks to this interface, so adding a
// real streaming provider later means writing one, not touching the UI.

export const CATEGORIES = [
  { id: 'ambient', name: 'Ambient', kind: 'procedural' },
  { id: 'mine', name: 'My Music', kind: 'local-files' },
  { id: 'lofi', name: 'Lo-Fi', kind: 'unavailable' },
  { id: 'jazz', name: 'Jazz Café', kind: 'unavailable' },
  { id: 'rain', name: 'Rainy Coffee Shop', kind: 'unavailable' },
  { id: 'nature', name: 'Nature', kind: 'unavailable' },
];

// Real, genuinely synthesized audio (not a stand-in for a licensed
// catalogue) - a few gentle tone beds generated in-browser with Web Audio.
const PRESETS = [
  { id: 'soft-pad', title: 'Soft pad', freqs: [130.81, 164.81, 196, 246.94] },
  { id: 'warm-hum', title: 'Warm hum', freqs: [110, 138.59, 164.81, 220] },
  { id: 'glass-bell', title: 'Glass bell', freqs: [261.63, 329.63, 392, 523.25] },
];

export function createProceduralProvider(audioContext, destination) {
  let oscillators = [], gain = null, volume = .55, paused = false;
  return {
    name: 'Ambient (synthesized)',
    tracks: PRESETS,
    play(track) {
      this.stop(); paused = false;
      gain = audioContext.createGain(); gain.gain.value = 0; gain.connect(destination);
      oscillators = track.freqs.map(hz => {
        const o = audioContext.createOscillator(), g = audioContext.createGain();
        o.type = 'sine'; o.frequency.value = hz; g.gain.value = .16;
        o.connect(g).connect(gain); o.start();
        return o;
      });
      gain.gain.linearRampToValueAtTime(volume * .6, audioContext.currentTime + .8);
    },
    pause() { paused = true; gain?.gain.linearRampToValueAtTime(0, audioContext.currentTime + .3); },
    resume() { paused = false; gain?.gain.linearRampToValueAtTime(volume * .6, audioContext.currentTime + .3); },
    stop() { oscillators.forEach(o => { try { o.stop(); } catch {} }); oscillators = []; gain?.disconnect(); gain = null; },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (gain) { gain.gain.cancelScheduledValues(audioContext.currentTime); gain.gain.setValueAtTime(paused ? 0 : volume * .6, audioContext.currentTime); } },
  };
}

// The player's own files, picked from disk - genuinely playable today with
// no account, API key, or upload involved.
export function createLocalFilesProvider(audioElement) {
  let tracks = [];
  return {
    name: 'My Music',
    get tracks() { return tracks; },
    setFiles(fileList) { this.stop(); tracks.forEach(t => URL.revokeObjectURL(t.url)); tracks = [...fileList].map((f, i) => ({ id: String(i), title: f.name.replace(/\.[^.]+$/, ''), artist: 'Your audio file', url: URL.createObjectURL(f) })); },
    play(track) { audioElement.src = track.url; return audioElement.play(); },
    pause() { audioElement.pause(); },
    resume() { return audioElement.play(); },
    stop() { audioElement.pause(); audioElement.removeAttribute('src'); },
    setVolume(v) { audioElement.volume = Math.max(0, Math.min(1, v)); },
  };
}

export function trackAfter(tracks, currentId, direction) {
  if (!tracks.length) return null;
  const i = tracks.findIndex(t => t.id === currentId);
  const next = i < 0 ? 0 : (i + direction + tracks.length) % tracks.length;
  return tracks[next];
}

// What a real streaming integration would need for each unavailable
// category. Nothing below is wired up - no API keys, OAuth client, or
// vendor SDK are configured in this project, so selecting these categories
// shows this note instead of pretending to play something.
export const INTEGRATION_NOTES = {
  lofi: 'Needs a licensed catalogue: either a Spotify Web Playback SDK integration (OAuth app registration, a Premium-account user token, and an approved redirect URI) or rights-cleared audio files hosted by this app.',
  jazz: 'Same requirement as Lo-Fi - a licensed catalogue/API, or self-hosted rights-cleared tracks.',
  rain: 'Same requirement as Lo-Fi/Jazz - though rain is a good candidate for a synthesized procedural preset instead, since it needs no licensing at all.',
  nature: 'Same requirement as Lo-Fi/Jazz - also a good candidate for a synthesized procedural preset rather than licensed recordings.',
};
