import type { VisualParams } from '../engine'

/**
 * Plausible audio, for the start screen.
 *
 * Not silence and not noise: a few slow sinusoids at incommensurable periods,
 * so the picture drifts and never visibly repeats. Everything is kept low and
 * smooth on purpose — this is playing behind text somebody is reading, and it
 * has to be alive without asking to be watched. The moment the microphone
 * starts, real numbers replace these and nothing about the renderer changes.
 *
 * Writes the spectrum in place rather than allocating; it runs every frame.
 */
export function idleParams(t: number, spectrum: Uint8Array): VisualParams {
  const wave = (period: number, phase = 0): number =>
    0.5 + 0.5 * Math.sin((t / period + phase) * Math.PI * 2)

  // Held around a third to a half rather than near silence. Lower reads as a
  // dim smear behind the gradient, which looks like a screen that has not
  // finished loading rather than a piece that is already playing.
  const level = 0.34 + 0.18 * wave(11)
  const low = 0.32 + 0.22 * wave(7.3, 0.2)
  const mid = 0.28 + 0.2 * wave(5.1, 0.55)
  const high = 0.18 + 0.16 * wave(3.7, 0.8)

  for (let i = 0; i < spectrum.length; i++) {
    const fall = Math.exp(-i / 46)
    const ripple = 0.75 + 0.25 * Math.sin(i / 9 + t * 0.7)
    spectrum[i] = Math.min(255, 210 * fall * ripple * (0.55 + level))
  }

  return {
    level,
    low,
    mid,
    high,
    // No transients at all: a flash on a screen nobody has interacted with
    // yet reads as a glitch rather than as a beat.
    transient: 0,
    tilt: 0.35 + 0.25 * wave(13.9, 0.4),
    breakdown: 0,
    surge: 0,
    novelty: 0.12 * wave(17.3),
    roughness: 0.3 + 0.2 * wave(9.1, 0.65),
    // No audio, no tempo — an idle preview must not fake a beat lock.
    beatPhase: 0,
    bpm: 0,
    beatConfidence: 0,
  }
}
