const BEEP_SECONDS = 0.12;
const BEEP_VOLUME = 0.2;

let audio: AudioContext | null = null;

/**
 * Short sine beep for countdowns, so an actor standing back from the laptop hears when recording starts.
 * The first call must come from a user gesture (a click) so the browser lets the AudioContext start.
 */
export function beep(frequency = 660): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(BEEP_VOLUME, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + BEEP_SECONDS);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + BEEP_SECONDS + 0.02);
  } catch (error) {
    // Sound is a nice-to-have; the visual countdown still works.
    console.warn('Countdown beep unavailable:', error);
  }
}
