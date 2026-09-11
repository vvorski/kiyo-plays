/**
 * The UI port — what a session needs from whatever is drawn around it.
 *
 * Derived from every call `main.ts` used to make on the HUD and every DOM
 * query it made to learn something about the HUD (`.hud-scrim.open`,
 * `.hud-chip`), and nothing else. The HUD is one implementation of this; a
 * page with a different control surface is another. `NULL_SHELL` is a third,
 * and the important one: a session running against it must render, answer
 * touch and shake, and take the director's decisions without ever throwing.
 * That is what "the session has no opinion about its UI" means in practice,
 * and it is what `scripts/probe-session.ts` runs.
 *
 * `SessionStats` is the per-frame readout bag. It lives here rather than in
 * hud.ts because the session is what fills it; the HUD only draws it.
 */

import type { VisualParams } from '../engine'

export interface SessionStats {
  frameMs: number
  pixelRatio: number
  disturb?: number
  /** Accelerometer readings accepted so far, and the recent peak AC
   *  magnitude in m/s². Diagnostics only — see the readout's comment. */
  samples?: number
  peak?: number
  /** docs/todo.md entry 88 — the reversal path's own current adaptive
   *  threshold, m/s². Reported alongside `peak` so "why didn't that
   *  fire" can be answered from the readout rather than guessed at. */
  bar?: number
  /** Motion events that arrived carrying no usable acceleration. */
  rejected?: number
  /** docs/todo.md entry 126 — whether the space bar's synthetic shake is
   *  currently feeding the same samples this line's own counts include.
   *  CLAUDE.md's own two-identical-symptoms rule: "the space bar does
   *  nothing" would otherwise be indistinguishable from "the samples
   *  arrive but never clear the bar", and `samples`/`peak` alone cannot
   *  tell a synthesised shake from a real one. */
  synthActive?: boolean
  /** What the autopilot is waiting for. See Director.status(). */
  director?: {
    suspended: number
    tillColour: number
    tillView: number
    candidate: string | null
    candidateHeld: number
    /** docs/todo.md entry 89 — which gate is closed, e.g. `"colour: step
     *  0.04 < 0.18"`, when a change is due and not firing. Null while
     *  nothing is due, something just fired, or the autopilot is
     *  suspended or holding for a bar. */
    blocked?: string | null
    /** docs/todo.md entry 100 — "report it": the sun's own rate
     *  multiplier and the moon's own reach multiplier currently
     *  judging the director's decisions. */
    sunRate?: number
    moonReach?: number
  }
  /** Whether the long-scale buffer has enough history to act on. */
  warm?: boolean
  /** Posture, disturbance and agitation reaching the picture's colour —
   *  docs/todo.md entry 58. See motion-bias.ts's own file comment for
   *  what each of the three means. */
  motion?: { posture: number; disturbance: number; agitation: number }
  /** docs/todo.md entry 90 — how the phone is currently being held.
   *  Named `handling` rather than `posture` to stay clear of `motion`'s
   *  own `posture` field above, a tilt magnitude that predates this and
   *  means something else entirely. */
  handling?: {
    posture: 'still' | 'carried' | 'driving' | 'dancing' | 'handled'
    candidate: 'still' | 'carried' | 'driving' | 'dancing' | 'handled'
    candidateHeld: number
    periodicHz: number
    periodicStrength: number
  }
  /** The clock's own current pair — docs/todo.md entry 53. `located` —
   *  entry 97 — is whether that pair is coming from a real granted
   *  coordinate. The outdoor-reading override this once also reported
   *  was retired by entry 127. */
  sky?: { daylight: number; warmth: number; located: boolean }
  /** The moon's own current fields — docs/todo.md entry 96, "report it
   *  in the readout" — so what night the app thinks it is is checkable
   *  without waiting a month. */
  moon?: { illuminated: number; waxing: number; presence: number }
  /** The ambient light sensor's own reading — docs/todo.md entry 98,
   *  "report lux and the derived lift in the readout". `available`
   *  false is itself the answer on iOS: "why doesn't it respond to
   *  the room here." */
  ambient?: { available: boolean; lux: number | null; exposure: number }
  /** Why there was or wasn't a buzz. See hapticStatus(). */
  haptics?: {
    supported: boolean
    attempts: number
    accepted: number
    suppressed: number
  }
  /** Where the fullscreen request got to. See fullscreenStatus(). */
  fullscreen?: {
    state: string
    attempts: number
    error: string
    want: boolean
    armed: boolean
  }
  /** docs/todo.md entry 65 — whether the OS itself is asking for less
   *  motion, since that single fact explains three otherwise-unrelated
   *  symptoms at once: a silent start-disc pulse, a silent byline glow,
   *  and silent shake-flash tiers. */
  reducedMotion?: boolean
  /** docs/todo.md entry 73 — a frozen camera and a working one are
   *  identical when the room itself is still. `open` without `live` is
   *  exactly the failure this entry exists to name. */
  camera?: { open: boolean; live: boolean }
  /** docs/todo.md entry 115 — whether camera mode is armed, and how long
   *  the longest still contact has been held. Two numbers because "the
   *  camera doesn't arm" has two candidate causes (the double tap not
   *  recognised, or the arm expiring) and "the menu won't open" has two
   *  more (the hold not reaching 3.5s, or drifting past its slop). */
  arm?: { armed: boolean; hold: number; blocked: boolean; sinceDisturbed: number }
  /** docs/todo.md entry 133 — which branch the opening name decode took,
   *  how long it has been running and how far it got. "The animation
   *  isn't showing" and "it ran and you left before it finished" are the
   *  same report from outside; these three numbers are what separate
   *  them, and three of this animation's four reports were diagnosed by
   *  guessing instead. */
  decode?: {
    branch: string
    elapsedMs: number
    resolved: number
    total: number
    /** docs/todo.md entry 123 — the gap from mount to the first real
     *  frame, and the worst gap since; null before a second frame. */
    firstGapMs: number | null
    worstGapMs: number | null
  }
  /** docs/todo.md entry 137 — the whole look as one copyable string, so a
   *  shape worth keeping can be written down rather than only described.
   *  The QR code and share sheet deliberately do NOT carry this — see
   *  share.ts's own comment — so the readout is the only surface that
   *  does. */
  dna?: string
}

export interface Shell {
  /** The session changed the look on its own — the director, a shuffle, a
   *  camera raise. Redraw if visible. Never called for a change the shell
   *  itself asked for through `Session.apply()`. */
  lookChanged(): void
  /** Whether the shell is covering the picture. While true, contacts on the
   *  picture reach neither the emitter nor the atmospheric stream, and a
   *  shake tumbles but does not shuffle — the same two facts `main.ts` used
   *  to read from `.hud-scrim.open`. */
  isOpen(): boolean
  /** Open the shell's controls: the double tap and the right click. */
  open(): void
  /** Whether a pointer event's target is one of the shell's own controls,
   *  so the contact is never treated as a touch on the picture. The one
   *  fact about the UI the session cannot know for itself. */
  ownsTarget(target: EventTarget | null): boolean
  /** Per-frame readout. Called every visible frame; must cost nothing when
   *  nothing is showing. */
  update(params: VisualParams, stats: SessionStats): void
  /** A shake was accepted. What the shell does with it — the edge pulse,
   *  the readout-gated white flash — is the shell's business. */
  shakeFeedback(kind: 'strong' | 'double', peak: number): void
  /** Camera mode's glyph. `fading` is the automatic-expiry path (docs/todo.md
   *  entry 109); `off` is the instant hide a manual exit uses. */
  cameraGlyph(state: 'armed' | 'fading' | 'off'): void
  /** The shutter fired. */
  shutter(): void
  /** A captured frame. The HUD shell downloads it under a build-stamped name;
   *  another shell may show it, or discard it. */
  deliverCapture(blob: Blob): void
}

/** Every method a no-op. What "no UI" means; what the probe runs against. */
export const NULL_SHELL: Shell = Object.freeze({
  lookChanged: () => {},
  isOpen: () => false,
  open: () => {},
  ownsTarget: () => false,
  update: () => {},
  shakeFeedback: () => {},
  cameraGlyph: () => {},
  shutter: () => {},
  deliverCapture: () => {},
})
