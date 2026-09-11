/**
 * The orchestration — "the app", with no opinion about its UI.
 *
 *   shell.ts     the UI port and the null shell
 *   session.ts   createSession(): the loops, the inputs, the look, the camera
 *   gestures.ts  the pointer recogniser as pure state, probe-driven
 *   look.ts      the shuffle ladder and LookPatch — pure
 *   idle.ts      the synthetic look shown behind the gate — pure
 *
 * This became a directory when main() was found to be the app: 1500 lines
 * of closure holding the frame loop, every input, the camera's lifecycle and
 * the director's cadence, none of it reachable without the page that built
 * it. A different page — a different control surface on the same picture —
 * needs all of it and none of the page. See
 * docs/plans/extensibility-refactor.md.
 *
 * Same discipline as engine/: no value import from three or scene.ts, time
 * as dt, everything drivable from Node. The one difference is that a session
 * does bind DOM listeners, because pointer events are its inputs; the probe
 * stubs `document` and `window` for that, and counts that dispose() removes
 * every listener it added.
 */

export { createSession, COLOUR_RAMP_SHAKE_S, COLOUR_RAMP_DIRECTOR_S } from './session.ts'
export type { Session, SessionOptions, LookSource } from './session.ts'
export { NULL_SHELL } from './shell.ts'
export type { Shell, SessionStats } from './shell.ts'
export type { LookPatch } from './look.ts'
export { TAP_SLOP_PX } from './gestures.ts'
