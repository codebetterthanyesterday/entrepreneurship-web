/**
 * The inbox's chime: two short notes drawn by the browser (no sound file to
 * load), and a buzz where the phone has one. Off unless the person turned it
 * on, on their own phone.
 *
 * A browser only plays sound after a tap on the page, so the audio is
 * unlocked by one: turning the chime on, or any tap once the page has loaded.
 */

let context: AudioContext | null = null;

/** Call from a tap. Creates or wakes the audio the chime plays through. */
export function unlockChime(): void {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
  } catch {
    context = null;
  }
}

/** Two rising notes, a quarter of a second. Silent until `unlockChime` has run. */
export function playChime(): void {
  if (!context) return;
  try {
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime;
    for (const [offset, frequency] of [
      [0, 880],
      [0.13, 1320],
    ] as const) {
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.type = "sine";
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start + offset);
      volume.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.12);
      tone.connect(volume).connect(context.destination);
      tone.start(start + offset);
      tone.stop(start + offset + 0.13);
    }
  } catch {
    // A phone that refuses sound just stays quiet.
  }
}

/** A short double buzz, where the phone can. */
export function buzz(): void {
  try {
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    // Not every browser allows it; nothing else depends on it.
  }
}
