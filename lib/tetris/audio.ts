let context: AudioContext | null = null;

export function unlockGameAudio() {
  if (typeof window === "undefined" || !window.AudioContext) return;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
}

export function playLineClear(lines: number) {
  if (lines <= 0 || !context || context.state !== "running") return;
  const now = context.currentTime;
  const notes = lines === 4 ? [523, 659, 784] : [440, 554];
  notes.forEach((frequency, index) => {
    const start = now + index * 0.055;
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency + (lines - 1) * 35, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.085, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
    oscillator.connect(gain).connect(context!.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.18);
  });
}
