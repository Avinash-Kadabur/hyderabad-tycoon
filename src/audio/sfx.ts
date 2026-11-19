// Tiny sound effects made on the fly with the Web Audio API, so there are no audio files to download.

const STORAGE_KEY = 'hyderabad-tycoon:muted';

let context: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be blocked (private browsing); the setting just won't be remembered.
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  if (!context) {
    const Context =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    context = new Context();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone(from: number, to: number, seconds: number, type: OscillatorType, volume: number, delay = 0): void {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + seconds);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.05);
}

export const sfx = {
  /** A bubbly pop. `step` raises the pitch, so dragging out a road plays a little rising tune. */
  pop(step = 0): void {
    const pitch = 2 ** ((step % 13) / 12);
    tone(520 * pitch, 900 * pitch, 0.12, 'sine', 0.14);
  },
  /** A soft dusty whoosh for the bulldozer. */
  poof(): void {
    const ac = audio();
    if (!ac) return;
    const start = ac.currentTime;
    const length = Math.floor(ac.sampleRate * 0.25);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ac.createBufferSource();
    source.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, start);
    filter.frequency.exponentialRampToValueAtTime(250, start + 0.25);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.22, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    source.connect(filter).connect(gain).connect(ac.destination);
    source.start(start);
  },
  /** A gentle "bonk" when something isn't allowed. */
  bonk(): void {
    tone(240, 150, 0.16, 'triangle', 0.13);
    tone(190, 120, 0.2, 'triangle', 0.09, 0.07);
  },
  /** Ka-ching. */
  coin(): void {
    tone(988, 990, 0.08, 'square', 0.035);
    tone(1319, 1320, 0.2, 'square', 0.035, 0.07);
  },
  click(): void {
    tone(700, 560, 0.05, 'sine', 0.07);
  },
};
