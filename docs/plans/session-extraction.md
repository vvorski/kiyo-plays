# Session Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the orchestration out of `main()` into `src/session/` behind a `Shell` port, so a different UI is a different `main.ts` rather than a fork.

**Architecture:** `createSession()` takes an injected `Visualiser`, the mutable `Prefs`, and a `Shell`; it owns the idle and live frame loops, the pointer recogniser, the shake sensor, the camera stream and camera mode, the director's cadence, and persistence. `main.ts` keeps the page: DOM lookup, chrome, gate, prefs/URL resolution, and the HUD wired up as one `Shell`. Every module under `session/` follows `engine/`'s discipline — no value import from `three` or `scene.ts`, time as `dt`, probe-driven under `node --experimental-strip-types`.

**Tech Stack:** TypeScript 5.7, Vite, Three.js (type imports only inside `session/`), Node 22+ `--experimental-strip-types` probes, pnpm.

**Spec:** `docs/plans/extensibility-refactor.md` — this plan is its Phase 1. Read the spec's "Target shape", "The `Shell` port", "The `Session`" and "Decisions" sections before any task.

## Global Constraints

- British spelling in prose and identifiers (`normalise`, `colour`).
- Every value import inside `src/` that a probe needs carries the `.ts` extension. Type-only imports do not.
- Comments carry reasoning, not mechanics. **When moving code, move its comments verbatim.** Every `docs/todo.md entry N` reference in a moved comment stays.
- No new runtime dependency. No change to the `Prefs` field set or meaning. No change to URL parameters. No change to what is captured or requested.
- `pnpm build` (tsc + vite) and `pnpm lint` pass before every commit. The probes listed in `.github/workflows/checks.yml` pass before every commit.
- The gate's fullscreen ordering (request synchronously inside the click handler, before `requestMotionAccess()`) is not touched. `permission-gate.ts` is not modified by this plan.
- `RELEASE_NAMES` in `src/release-name.ts` gets a new line appended in the **last** task only, before the branch is pushed to `main`. Branch commits do not each rename.
- Work on a branch `refactor/session` from `main` at or after `7bd3296`.
- Commit messages explain why, in prose. Each ends with the attribution lines from the session's system reminder.

---

### Task 1: The `Shell` port and `SessionStats`

**Files:**
- Create: `src/session/shell.ts`
- Modify: `src/hud.ts:128-256` (the `Hud.update` signature)

**Interfaces:**
- Produces: `Shell`, `NULL_SHELL`, `SessionStats` — used by every later task.

- [ ] **Step 1: Create `src/session/shell.ts`**

Cut the object type of `Hud.update`'s second parameter (`src/hud.ts` lines 132–254, everything between `stats: {` and the closing `},` before `): void`) and paste it as the body of `SessionStats` below, verbatim, comments included. Then write the rest of the file:

```ts
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
  // ← paste the moved body here, verbatim, starting with `frameMs: number`
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
```

- [ ] **Step 2: Point `Hud.update` at the moved type**

In `src/hud.ts`, add `import type { SessionStats } from './session/shell'` beside the other imports, and replace the `update(` signature so it reads:

```ts
  /** Call every frame with the current state; only does work while visible. */
  update(params: VisualParams, stats: SessionStats): void
```

- [ ] **Step 3: Typecheck**

Run: `pnpm build`
Expected: clean. `hud.ts`'s implementation of `update` destructures the same fields; nothing else changes.

- [ ] **Step 4: Commit**

```bash
git checkout -b refactor/session
git add src/session/shell.ts src/hud.ts
git commit
```

Message: explain that `SessionStats` moved because the session fills it and the HUD only draws it, and that `Shell` is derived from `main.ts`'s existing use of the HUD, not designed.

---

### Task 2: The pure pieces — `look.ts` and `idle.ts`

**Files:**
- Create: `src/session/look.ts`, `src/session/idle.ts`
- Modify: `src/main.ts` (remove the moved functions; import them)

**Interfaces:**
- Produces: `LookPatch`, `shuffled(depth, current): LookPatch`, `SHUFFLE_RESEED`, `SHUFFLE_MERGE`, `SHUFFLE_VIEWS`, `SHUFFLE_EVERYTHING`, `CAMERA_ROLL_CHANCE`, `CAMERA_ROLL_MAX`, `dnaQuery(prefs, seed): string`, `idleParams(t, spectrum): VisualParams`.

- [ ] **Step 1: Create `src/session/look.ts`**

Move from `src/main.ts`, verbatim with their comments: the `clamp` helper (line 443), `hueToColour` (448), `colourToHueSat` (461), the `SHUFFLE_*` block and its comment (~line 400), `CAMERA_ROLL_CHANCE`/`CAMERA_ROLL_MAX` and their comment, the `Shuffle` interface, and `shuffled()` (473–523) with its long file comment (389–472). Rename `Shuffle` to `LookPatch` and widen it:

```ts
/**
 * A change to the look. Every field of `Prefs` that a session renders or
 * that a control may set, all optional: the shuffle ladder fills some of
 * them, the director one or two, the HUD one at a time. `mix`, `autopilot`,
 * `day` and `skyOverride` are deliberately absent — stored-shape facts
 * nothing here writes any more (see prefs.ts's own comments on each).
 */
export type LookPatch = Partial<
  Pick<
    Prefs,
    | 'geometricView'
    | 'atmosphericView'
    | 'mergeMode'
    | 'atmMergeMode'
    | 'geoColour'
    | 'atmColour'
    | 'camColour'
    | 'geoAlpha'
    | 'atmAlpha'
    | 'mapping'
    | 'passthrough'
    | 'showStats'
    | 'gravity'
  >
>
```

Also move `dnaUrl` (line 219) but strip the `window.location` read — it becomes the query alone:

```ts
/** … keep the existing comment … The origin and path are the page's, not
 *  the session's, so this returns the query alone and the caller prefixes. */
export function dnaQuery(prefs: Readonly<Prefs>, seed: readonly [number, number, number, number]): string {
  const rgb = /* unchanged */
  return (
    `geometric=${prefs.geometricView}` +
    /* unchanged through */
    `&seed=${encodeSeedHex(seed)}`
  )
}
```

Imports at the top of `look.ts` need the `.ts` extension where they are values: `from '../merge-modes.ts'`, `from '../engine/index.ts'` (for `MAPPINGS`), `from '../release-name.ts'` (for `encodeSeedHex`), `from '../views.ts'`. Type imports (`Prefs`, `GeoColour`, view/merge/mapping names) stay extensionless.

- [ ] **Step 2: Create `src/session/idle.ts`**

Move `idleParams` (main.ts 236–318) verbatim with its comment. Type import `VisualParams` from `'../engine'`.

- [ ] **Step 3: Update `main.ts`**

Delete the moved code. Add:

```ts
import { shuffled, dnaQuery, SHUFFLE_RESEED, SHUFFLE_VIEWS, SHUFFLE_EVERYTHING, CAMERA_ROLL_CHANCE, CAMERA_ROLL_MAX } from './session/look'
import { idleParams } from './session/idle'
```

and change the one `dnaUrl(prefs, seed)` call site (in the `panel.update` stats bag) to:

```ts
dna: `${window.location.origin}${window.location.pathname}?${dnaQuery(prefs, seed)}`,
```

- [ ] **Step 4: Verify the move was pure**

Run: `pnpm build && pnpm lint && pnpm probe:nudge && pnpm probe:idle`
Expected: all clean. `probe-nudge` re-implements the ladder rather than importing it (check its header) — if it does, leave it; Task 7 notes it as something Phase 2 may import instead.

Also run `git diff --stat` and confirm `main.ts` lost roughly as many lines as `look.ts` + `idle.ts` gained. A mismatch of more than ~15 lines means a comment was dropped; find it.

- [ ] **Step 5: Commit**

```bash
git add src/session/look.ts src/session/idle.ts src/main.ts
git commit
```

---

### Task 3: The gesture recogniser as pure state

**Files:**
- Create: `src/session/gestures.ts`, `scripts/probe-gestures.ts`
- Modify: `src/main.ts` (`dispatchTouches` and its closure state, ~lines 1490–1950), `package.json`

**Interfaces:**
- Consumes: `TouchField`, `HoverState` and friends from `engine/index.ts`; `TAP_SLOP_PX` from `hud.ts` (move it — see step 1).
- Produces: `GestureState`, `createGestureState()`, `GestureDeps`, `dispatchGestures(state, now, deps)`, `noteDisturb(state, disturb, now)`, `gesturesCalm(state, now)`, and the constants `TAP_SLOP_PX`, `TAP_RESOLVE_MS`, `DOUBLE_TAP_RADIUS_PX`, `HOLD_ARM_S`, `HOLD_ARM_SLOP_PX`, `GESTURE_CALM_MAX`, `GESTURE_SETTLE_S`, `EMITTER_PICK_PX`, `CAMERA_SAVE_RATE_LIMIT_MS`.

This is a **move with parameters**, not a redesign. Every branch of `dispatchTouches` and every comment survives; what changes is that the closure variables become fields of a state object and the things it reached for (`visualiser`, `panel`, `document`, `canvas`, `cameraMode`, `fullscreenStatus()`) arrive as `deps`. That is what makes it drivable from Node, which CLAUDE.md's "ask what a probe can drive" has wanted since the ring became testable.

- [ ] **Step 1: Write the failing probe first**

Create `scripts/probe-gestures.ts`:

```ts
/**
 * The pointer recogniser, driven from Node — docs/todo.md entries 41, 50,
 * 67, 103, 115, 117, 125, 141 and 146 all changed what a tap, a double, a
 * hold or a drag means, and until now the only way to check any of them was
 * a finger. `dispatchGestures` is the same code `main.ts` ran per frame,
 * with its closure state made explicit, so this can say: a double opens,
 * a hold arms, a drag is never a tap, a shaken phone is never a gesture.
 *
 * Run: pnpm probe:gestures
 */

import { createTouchField, createHoverState } from '../src/engine/index.ts'
import {
  createGestureState,
  dispatchGestures,
  noteDisturb,
  type GestureDeps,
  HOLD_ARM_S,
  TAP_RESOLVE_MS,
  DOUBLE_TAP_RADIUS_PX,
  TAP_SLOP_PX,
  GESTURE_CALM_MAX,
  GESTURE_SETTLE_S,
} from '../src/session/gestures.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const DT = 1 / 60

interface Rig {
  deps: GestureDeps
  calls: string[]
  state: ReturnType<typeof createGestureState>
  field: ReturnType<typeof createTouchField>
  now: number
  /** Advance `frames` frames, dispatching each. */
  run(frames: number): void
  down(id: number, cx: number, cy: number): void
  up(id: number): void
  move(id: number, cx: number, cy: number): void
}

function rig(opts: { shellOpen?: boolean; emitterAt?: { x: number; y: number } } = {}): Rig {
  const calls: string[] = []
  const field = createTouchField()
  const hover = createHoverState()
  const state = createGestureState()
  const rect = { left: 0, top: 0, width: 400, height: 600 }
  const uv = (cx: number, cy: number): [number, number] => [
    (cx - rect.width / 2) / Math.min(rect.width, rect.height),
    -(cy - rect.height / 2) / Math.min(rect.width, rect.height),
  ]
  const armed = { value: false }
  const deps: GestureDeps = {
    field,
    hover,
    visualiser: {
      setTouches: (t) => calls.push(`touches:${t.length}`),
      setHover: () => {},
      setTouchStream: () => {},
      setEmitterDrag: (p) => calls.push(`emitterDrag:${p ? 'pos' : 'null'}`),
      setChorusNodeDrag: (i, p) => calls.push(`nodeDrag:${i}:${p ? 'pos' : 'null'}`),
      hitTestEmitter: (x, y, r) =>
        opts.emitterAt !== undefined && Math.hypot(x - opts.emitterAt.x, y - opts.emitterAt.y) <= r,
      hitTestChorusNode: () => null,
    },
    shellOpen: opts.shellOpen ?? false,
    gateShowing: false,
    fullscreenBlocking: false,
    pickRadiusUv: 36 / 400,
    camera: {
      get armed() {
        return armed.value
      },
      arm: () => {
        armed.value = true
        calls.push('arm')
      },
      shoot: () => {
        armed.value = false
        calls.push('shoot')
      },
    },
    openShell: () => calls.push('open'),
  }
  const r: Rig = {
    deps,
    calls,
    state,
    field,
    now: 0,
    run(frames) {
      for (let i = 0; i < frames; i++) {
        r.now += DT
        dispatchGestures(state, r.now, deps)
      }
    },
    down(id, cx, cy) {
      const [x, y] = uv(cx, cy)
      field.down(r.now, id, x, y, cx, cy, false, '')
    },
    up(id) {
      field.up(id)
    },
    move(id, cx, cy) {
      const [x, y] = uv(cx, cy)
      field.move(r.now, id, x, y, cx, cy)
    },
  }
  return r
}

// 1. A single tap plays and does nothing else — no open, no arm.
{
  const r = rig()
  r.down(1, 200, 300)
  r.run(3)
  r.up(1)
  r.run(Math.ceil((TAP_RESOLVE_MS / 1000) / DT) + 5)
  check('a single tap never opens the shell', !r.calls.includes('open'), r.calls.join(','))
  check('a single tap never arms', !r.calls.includes('arm'), r.calls.join(','))
  check('a single tap reaches the emitter', r.calls.some((c) => c === 'touches:1'), r.calls.join(','))
}

// 2. Two taps inside TAP_RESOLVE_MS and DOUBLE_TAP_RADIUS_PX open the shell,
//    recognised on the second tap's down (entry 67).
{
  const r = rig()
  r.down(1, 200, 300)
  r.run(2)
  r.up(1)
  r.run(2)
  r.down(2, 200 + DOUBLE_TAP_RADIUS_PX / 2, 300)
  r.run(1)
  check('a double opens the shell', r.calls.filter((c) => c === 'open').length === 1, r.calls.join(','))
}

// 3. Two taps further apart than DOUBLE_TAP_RADIUS_PX are two singles.
{
  const r = rig()
  r.down(1, 100, 300)
  r.run(2)
  r.up(1)
  r.run(2)
  r.down(2, 100 + DOUBLE_TAP_RADIUS_PX * 2, 300)
  r.run(1)
  check('two distant taps are not a double', !r.calls.includes('open'), r.calls.join(','))
}

// 4. A drag past TAP_SLOP_PX forgets its tap, so a later tap cannot pair with it.
{
  const r = rig()
  r.down(1, 200, 300)
  r.run(2)
  r.move(1, 200 + TAP_SLOP_PX * 3, 300)
  r.run(2)
  r.up(1)
  r.run(2)
  r.down(2, 200, 300)
  r.run(1)
  check('a drag then a tap is not a double', !r.calls.includes('open'), r.calls.join(','))
}

// 5. A still hold of HOLD_ARM_S arms the camera; the next down shoots and disarms.
{
  const r = rig()
  r.down(1, 200, 300)
  r.run(Math.ceil(HOLD_ARM_S / DT) + 2)
  check('a still hold arms the camera', r.calls.includes('arm'), r.calls.join(','))
  r.up(1)
  r.run(2)
  r.down(2, 200, 300)
  r.run(1)
  check('the next down shoots', r.calls.includes('shoot'), r.calls.join(','))
  check('and does not open the shell', !r.calls.includes('open'), r.calls.join(','))
}

// 6. A hold that travels past HOLD_ARM_SLOP_PX never arms.
{
  const r = rig()
  r.down(1, 200, 300)
  r.run(2)
  r.move(1, 260, 300)
  r.run(Math.ceil(HOLD_ARM_S / DT) + 2)
  check('a travelling hold never arms', !r.calls.includes('arm'), r.calls.join(','))
}

// 7. A shaken phone: disturb above GESTURE_CALM_MAX within GESTURE_SETTLE_S
//    blocks both the double and the hold (entry 125).
{
  const r = rig()
  r.down(1, 200, 300)
  r.run(2)
  r.up(1)
  noteDisturb(r.state, GESTURE_CALM_MAX + 0.1, r.now)
  r.run(2)
  r.down(2, 200, 300)
  r.run(1)
  check('a double during a shake does not open', !r.calls.includes('open'), r.calls.join(','))
  r.up(2)
  r.run(Math.ceil(GESTURE_SETTLE_S / DT) + 2)
  r.down(3, 200, 300)
  r.run(2)
  r.up(3)
  r.run(2)
  r.down(4, 200, 300)
  r.run(1)
  check('once settled, a double opens again', r.calls.includes('open'), r.calls.join(','))
}

// 8. With the shell open, a contact reaches nothing on the picture.
{
  const r = rig({ shellOpen: true })
  r.down(1, 200, 300)
  r.run(3)
  check('shell open: no contact reaches the emitter', !r.calls.includes('touches:1'), r.calls.join(','))
}

// 9. A down on the emitter claims it (entry 141): the drag is forwarded, the
//    contact reaches nothing else, and the up releases with null.
{
  const r = rig({ emitterAt: { x: 0, y: 0 } })
  r.down(1, 200, 300)
  r.run(2)
  check('a down on the emitter claims it', r.calls.includes('emitterDrag:pos'), r.calls.join(','))
  check('the claimed contact never reaches the emitter pool', !r.calls.includes('touches:1'), r.calls.join(','))
  r.up(1)
  r.run(1)
  check('the up releases the claim', r.calls.includes('emitterDrag:null'), r.calls.join(','))
}

console.log(failures === 0 ? '\nall gesture checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
```

- [ ] **Step 2: Run it to confirm it fails**

Add to `package.json` scripts: `"probe:gestures": "node --experimental-strip-types --import ./scripts/dir-import-hook.mjs scripts/probe-gestures.ts"`. The hook is needed because `gestures.ts` type-imports `Visualiser` from `../scene` — types are erased, but the import of `TAP_SLOP_PX` must not come from `hud.ts` (which imports the DOM-free `chip-arc.ts` but also builds CSS strings; keep the probe's import graph free of it — step 3 moves the constant).

Run: `pnpm probe:gestures`
Expected: FAIL — `Cannot find module '../src/session/gestures.ts'`.

- [ ] **Step 3: Create `src/session/gestures.ts`**

Move `TAP_SLOP_PX` and its comment from `hud.ts:107` here, and re-export it from `hud.ts` (`export { TAP_SLOP_PX } from './session/gestures'`) so the HUD's own use and `hud-probe.html` are untouched.

Move from `main.ts`, verbatim with comments: `TAP_RESOLVE_MS`, `DOUBLE_TAP_RADIUS_PX`, `HOLD_ARM_S`, `HOLD_ARM_SLOP_PX`, `GESTURE_CALM_MAX`, `GESTURE_SETTLE_S`, `EMITTER_PICK_PX`, `CAMERA_SAVE_RATE_LIMIT_MS`, the `LastTap` interface, `resolveTapDown`, `cancelPendingTap`, and the whole of `dispatchTouches`. Then reshape them around this state and deps:

```ts
import type { Visualiser } from '../scene'
import type { TouchField, HoverState } from '../engine'
import { updateHover, CHARGE_TIME } from '../engine/index.ts'

/** The recogniser's own memory between frames — what used to be a dozen
 *  closure variables in main.ts. All of it is per-session and none of it
 *  survives a dispose. */
export interface GestureState {
  lastTap: LastTap | null
  holdOpenedBy: number | null
  emitterDragId: number | null
  emitterDragNodeIndex: number | null
  longestStillHold: number
  fingersOnPicture: number
  lastDisturbedAt: number
  lastShotAt: number
  nextContactId: number
  contactIdFor: Map<number, number>
  /** Which live contacts came from a mouse — docs/todo.md entry 117. Written
   *  by the session's pointer listeners, read here. */
  mousePointers: Set<number>
}

export function createGestureState(): GestureState {
  return {
    lastTap: null,
    holdOpenedBy: null,
    emitterDragId: null,
    emitterDragNodeIndex: null,
    longestStillHold: 0,
    fingersOnPicture: 0,
    lastDisturbedAt: -Infinity,
    lastShotAt: -Infinity,
    nextContactId: 0,
    contactIdFor: new Map(),
    mousePointers: new Set(),
  }
}

/** What one dispatch reaches for. `visualiser` is narrowed to the seven
 *  methods the recogniser actually calls, which is what lets a probe fake
 *  it in twenty lines. */
export interface GestureDeps {
  field: TouchField
  hover: HoverState
  visualiser: Pick<
    Visualiser,
    | 'setTouches'
    | 'setHover'
    | 'setTouchStream'
    | 'setEmitterDrag'
    | 'setChorusNodeDrag'
    | 'hitTestEmitter'
    | 'hitTestChorusNode'
  >
  /** `Shell.isOpen()` this frame. */
  shellOpen: boolean
  /** The gate still showing — defensive, see the moved comment. */
  gateShowing: boolean
  /** docs/todo.md entry 80 — `fullscreenStatus().want && !document.fullscreenElement`. */
  fullscreenBlocking: boolean
  /** `EMITTER_PICK_PX` over the canvas's short side, in uv. */
  pickRadiusUv: number
  camera: {
    readonly armed: boolean
    arm(): void
    /** Take the shot and leave the mode. The rate limit is applied here, in
     *  the recogniser, so the caller's `shoot` is unconditional. */
    shoot(): void
  }
  openShell(): void
}

/** docs/todo.md entry 125 — the calm gate's own clock. Called once per frame
 *  by the session with this frame's `disturb`, before dispatch. */
export function noteDisturb(state: GestureState, disturb: number, now: number): void {
  if (disturb > GESTURE_CALM_MAX) state.lastDisturbedAt = now
}

export function gesturesCalm(state: GestureState, now: number): boolean {
  return now - state.lastDisturbedAt >= GESTURE_SETTLE_S
}

export function dispatchGestures(state: GestureState, now: number, deps: GestureDeps): void {
  // … the body of dispatchTouches, with these substitutions and nothing else:
  //   hudOpen                        → deps.shellOpen
  //   fsBlocking                     → deps.fullscreenBlocking
  //   touchField                     → deps.field
  //   hover                          → deps.hover
  //   visualiser.X                   → deps.visualiser.X
  //   panel.open()                   → deps.openShell()
  //   cameraMode                     → deps.camera.armed
  //   enterCameraMode()              → deps.camera.arm()
  //   the saveCapture+flashShutter+exitCameraMode block
  //                                  → if (now - state.lastShotAt >= CAMERA_SAVE_RATE_LIMIT_MS / 1000) { state.lastShotAt = now; deps.camera.shoot() } else { deps.camera.shoot() }
  //     (keep the moved comment about exiting even when rate-limited; shoot()
  //      is what exits, so the rate limit only gates whether the session
  //      writes a file — see Task 4's `shoot` for the other half)
  //   gateShowing (the getElementById) → deps.gateShowing
  //   performance.now() (ms)         → now * 1000 where compared against TAP_RESOLVE_MS; `lastTap.t` stays ms
  //   the canvas.getBoundingClientRect() radius block → deps.pickRadiusUv
  //   every `let` from the closure    → state.<name>
  //   mousePointers                  → state.mousePointers
  //   gesturesCalm(now)              → gesturesCalm(state, now)
  //   resolveTapDown / cancelPendingTap become module-private functions taking `state`
}
```

The `shoot` rate-limit needs one correction from the original: the original both saved *and* exited inside `if (cameraMode)`, with the save behind the rate limit and the exit unconditional. Preserve that exactly: `deps.camera.shoot()` is called unconditionally; it receives a boolean `write` telling it whether the save is inside the limit. Final shape:

```ts
        if (deps.camera.armed) {
          const inLimit = now - state.lastShotAt >= CAMERA_SAVE_RATE_LIMIT_MS / 1000
          if (inLimit) state.lastShotAt = now
          deps.camera.shoot(inLimit)
          continue
        }
```

and `shoot(write: boolean): void` in `GestureDeps.camera`. Update the probe rig's `shoot` to `shoot: () => { … }` (it ignores the argument).

- [ ] **Step 4: Rewire `main.ts` to use it**

In `main()`, replace the closure state (`lastTap`, `holdOpenedBy`, `emitterDragId`, `emitterDragNodeIndex`, `longestStillHold`, `fingersOnPicture`, `lastDisturbedAt`, `lastSaveAt`, `nextContactId`, `contactIdFor`, `mousePointers`) with `const gestures = createGestureState()`, and replace every read/write with `gestures.<name>`. Replace the `dispatchTouches(performance.now() / 1000)` call in the frame loop with:

```ts
      noteDisturb(gestures, latestShake.disturb, performance.now() / 1000)
      {
        const rect = canvas.getBoundingClientRect()
        dispatchGestures(gestures, performance.now() / 1000, {
          field: touchField,
          hover,
          visualiser,
          shellOpen: document.querySelector('.hud-scrim.open') !== null,
          gateShowing: !gate.hidden,
          fullscreenBlocking: fullscreenStatus().want && !document.fullscreenElement,
          pickRadiusUv: EMITTER_PICK_PX / Math.min(rect.width, rect.height),
          camera: {
            get armed() {
              return cameraMode
            },
            arm: enterCameraMode,
            shoot: (write) => {
              if (write) {
                saveCapture(visualiser)
                flashShutter()
              }
              exitCameraMode()
            },
          },
          openShell: () => panel.open(),
        })
      }
```

Delete the old `if (latestShake.disturb > GESTURE_CALM_MAX) lastDisturbedAt = …` line (now `noteDisturb`). The `arm.blocked` and `arm.sinceDisturbed` stats read `gesturesCalm(gestures, now)` and `gestures.lastDisturbedAt`.

- [ ] **Step 5: Run the probe and the gates**

Run: `pnpm probe:gestures && pnpm build && pnpm lint && pnpm probe && pnpm probe:tap`
Expected: nine `ok` lines; gates clean.

- [ ] **Step 6: Look at it**

`pnpm dev`, open the app in Chrome via the browser tools, pass the gate, and confirm: a double tap opens the HUD; a 4-second still hold shows the shutter glyph and the next tap flashes the shutter and hides it; a drag draws the trail. Check `document.hasFocus()` first — CLAUDE.md's automation-window stall applies.

- [ ] **Step 7: Commit**

```bash
git add src/session/gestures.ts scripts/probe-gestures.ts src/main.ts src/hud.ts package.json
git commit
```

Message: say this is a move with parameters, that the recogniser had never been exercised by anything but a finger, and list the nine checks.

---

### Task 4: `createSession()` — everything else leaves `main()`

**Files:**
- Create: `src/session/session.ts`, `src/session/index.ts`
- Modify: `src/main.ts` (rewritten; ends near 250 lines)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `createSession(options: SessionOptions): Session`, `SessionOptions`, `Session`, `LookSource`, `COLOUR_RAMP_SHAKE_S`, `COLOUR_RAMP_DIRECTOR_S` (moved from main.ts).

This is the large task. It is still a move: the frame loop, the idle loop, the shake branch, camera mode, `applyPassthrough`, solo, and the listeners all keep their comments and their order. What is new is `apply()` — the one function that replaces both the HUD's `adopt()` and its fifteen prefs writes — and the `Shell` calls that replace DOM queries.

- [ ] **Step 1: Write `src/session/session.ts`**

```ts
/**
 * The session — the app, with no opinion about its UI.
 *
 * Everything that used to live in main()'s closure that is not the page
 * itself: the two frame loops (idle behind the gate, live after it), the
 * pointer recogniser's inputs, the shake sensor, the camera stream and
 * camera mode, the shuffle ladder, the director's cadence, and — new here —
 * ownership of the look and its persistence. `main.ts` builds one of these,
 * hands it a `Visualiser` it has already built on a canvas, and a `Shell`
 * that is whatever control surface this page draws. See
 * docs/plans/extensibility-refactor.md for why this boundary and not another.
 *
 * Nothing in here imports a value from `three` or `scene.ts`; the visualiser
 * is injected, and every DOM touch goes through `document`/`window` in the
 * few places a listener has to be bound, which `scripts/probe-session.ts`
 * stubs. That is what lets the whole app run under Node against a fake
 * visualiser and the null shell.
 */

import type { Visualiser } from '../scene'
import type { Prefs } from '../prefs'
import type { AudioSource, VisualParams } from '../engine'
import type { CameraSource } from '../camera'
import { savePrefs } from '../prefs.ts'
import { startCamera } from '../camera.ts'
import { Director } from '../director.ts'
import {
  MAPPINGS,
  SlowAnalysis,
  createPostureState,
  updatePosture,
  createCameraArmState,
  armCamera,
  disarmCamera,
  updateCameraArm,
  createTouchField,
  toShaderUv,
  pointerAction,
  createHoverState,
  moveHover,
  hoverLeft,
  createSynthShake,
  startSynthShake,
  updateSynthShake,
  celestialFor,
  CELESTIAL_IDENTITY,
  shouldRaiseCamera,
  PRESS_SHAKE_PASSTHROUGH,
  type Mapping,
  type CelestialInfluence,
} from '../engine/index.ts'
import { requestLocation, type GeoLocation } from '../geo-location.ts'
import { hasMotionPermissionGate, intensity, startShake, STILL_FRAME, type ShakeFrame, type ShakeSensor } from '../shake.ts'
import { confirmBuzz, doubleBuzz, hapticStatus } from '../haptics.ts'
import { fullscreenStatus } from '../permission-gate.ts'
import { nameDecodeStatus } from '../version.ts'
import { IdlePreview } from '../idle-preview.ts'
import { idleParams } from './idle.ts'
import {
  shuffled,
  dnaQuery,
  SHUFFLE_RESEED,
  SHUFFLE_EVERYTHING,
  CAMERA_ROLL_CHANCE,
  CAMERA_ROLL_MAX,
  type LookPatch,
} from './look.ts'
import {
  createGestureState,
  dispatchGestures,
  noteDisturb,
  gesturesCalm,
  EMITTER_PICK_PX,
} from './gestures.ts'
import type { Shell } from './shell.ts'

export type LookSource = 'manual' | 'director' | 'shake' | 'camera'

export interface SessionOptions {
  visualiser: Visualiser
  /** The stored look, already merged with the URL by the page. The session
   *  owns it from here: every write goes through `apply()`, and the page
   *  and the shell read it through `Session.look`. */
  prefs: Prefs
  seed: readonly [number, number, number, number]
  /** `?auto=0` off. Read by the page, decided here. */
  autopilot: boolean
  /** `origin + pathname` for the readout's DNA line — the page's, not ours. */
  dnaBase: string
  shell: Shell
  /** The picture's element, for `getBoundingClientRect()` and the context
   *  menu suppression. The one DOM handle the session holds. */
  canvas: { getBoundingClientRect(): DOMRect; addEventListener: HTMLElement['addEventListener'] }
}

export interface Session {
  readonly look: Readonly<Prefs>
  readonly visualiser: Visualiser
  apply(patch: LookPatch, opts: { rampS: number; source: LookSource; persist?: boolean }): void
  persist(): void
  setPassthrough(a: number): Promise<number>
  solo(layer: 'geo' | 'atm' | 'cam'): void
  unsolo(): void
  start(source: AudioSource, motionGranted: boolean): void
  setSynthShake(held: boolean): void
  motion(): ShakeFrame
  dispose(): void
}

// Move COLOUR_RAMP_SHAKE_S and COLOUR_RAMP_DIRECTOR_S here from main.ts with
// their comments, and export them.

export function createSession(options: SessionOptions): Session {
  const { visualiser, prefs, seed, shell, canvas } = options
  const now = (): number => performance.now() / 1000

  // ─── the look ────────────────────────────────────────────────────────
  // Moved from hud.ts: the legacy `mix` mirror on every save, with its
  // comment.
  const persist = (): void => {
    prefs.mix = prefs.geoAlpha
    savePrefs(prefs)
  }

  let mapping: Mapping = MAPPINGS[prefs.mapping]()
  const director = new Director()

  /**
   * The one way the look changes. Replaces hud.ts's `adopt()` and each of
   * its band `commit`/`apply` handlers, which between them wrote `prefs` at
   * fifteen sites and each remembered to save. Assigns, drives the
   * visualiser for what it renders, persists unless told not to (a drag's
   * per-frame apply, which settles with `persist()`), suspends the director
   * for a manual change — the courtesy every HUD control already got — and
   * tells the shell for every other source, so a panel that is open redraws
   * to what is actually on screen.
   */
  const apply: Session['apply'] = (patch, { rampS, source, persist: doPersist = true }) => {
    if (patch.geometricView) {
      prefs.geometricView = patch.geometricView
      visualiser.setGeometricView(patch.geometricView)
    }
    if (patch.atmosphericView) {
      prefs.atmosphericView = patch.atmosphericView
      visualiser.setAtmosphericView(patch.atmosphericView)
    }
    if (patch.mergeMode) {
      prefs.mergeMode = patch.mergeMode
      visualiser.setMergeMode('geo', patch.mergeMode)
    }
    if (patch.atmMergeMode) {
      prefs.atmMergeMode = patch.atmMergeMode
      visualiser.setMergeMode('atm', patch.atmMergeMode)
    }
    if (patch.geoColour) {
      prefs.geoColour = patch.geoColour
      visualiser.setLayerColour('geo', patch.geoColour, rampS)
    }
    if (patch.atmColour) {
      prefs.atmColour = patch.atmColour
      visualiser.setLayerColour('atm', patch.atmColour, rampS)
    }
    if (patch.camColour) {
      prefs.camColour = patch.camColour
      visualiser.setLayerColour('cam', patch.camColour, rampS)
    }
    if (patch.geoAlpha !== undefined) {
      prefs.geoAlpha = patch.geoAlpha
      visualiser.setGeoAlpha(patch.geoAlpha)
    }
    if (patch.atmAlpha !== undefined) {
      prefs.atmAlpha = patch.atmAlpha
      visualiser.setAtmAlpha(patch.atmAlpha)
    }
    if (patch.mapping) {
      prefs.mapping = patch.mapping
      // Moved comment: mappings carry several seconds of internal state …
      mapping = MAPPINGS[patch.mapping]()
    }
    if (patch.passthrough !== undefined) {
      // Moved comment from adopt(): no visualiser call here — the caller
      // already resolved the actual level through setPassthrough() …
      prefs.passthrough = patch.passthrough
    }
    if (patch.showStats !== undefined) prefs.showStats = patch.showStats
    if (patch.gravity !== undefined) prefs.gravity = patch.gravity
    if (doPersist) persist()
    if (source === 'manual') director.suspend()
    else shell.lookChanged()
  }

  // ─── camera ──────────────────────────────────────────────────────────
  let cameraSource: CameraSource | null = null
  // applyPassthrough, moved verbatim, renamed setPassthrough.
  // cameraMode, cameraArmState, enterCameraMode, exitCameraMode moved
  // verbatim; the three glyph DOM blocks become shell.cameraGlyph('armed'),
  // shell.cameraGlyph('off'), and fadeOutGlyph() becomes shell.cameraGlyph('fading').
  // GLYPH_FADE_MS and glyphFadeTimeout leave with the DOM (Task 4 step 3 puts
  // them in main.ts's shell).
  // soloLayer / unsoloLayer moved verbatim as solo / unsolo.

  // ─── analysis and inputs ─────────────────────────────────────────────
  // slow, postureState, geoLocationForDirector, CELESTIAL_SAMPLE_S,
  // celestialSample, sinceCelestialSample, shake, lastGateShakeAt, spaceHeld,
  // synthShake, latestShake, touchField, hover, gestures — all moved verbatim.

  // ─── shuffle ─────────────────────────────────────────────────────────
  const shuffle = (depth: number): void => {
    const next = shuffled(depth, {
      geoColour: prefs.geoColour,
      atmColour: prefs.atmColour,
      geoAlpha: prefs.geoAlpha,
      atmAlpha: prefs.atmAlpha,
    })
    apply(next, { rampS: COLOUR_RAMP_SHAKE_S, source: 'shake' })
    if (depth >= SHUFFLE_RESEED) visualiser.randomise()
  }
  // maybeRollCamera and maybeRaiseCameraOnPress moved verbatim, with
  // `panel.adopt({ passthrough: actual }, 0)` → apply({ passthrough: actual }, { rampS: 0, source: 'camera' })
  // and `document.querySelector('.hud-scrim.open') !== null` → shell.isOpen()
  // and `fingersOnPicture` → gestures.fingersOnPicture.

  // ─── listeners ───────────────────────────────────────────────────────
  // Kept in one list so dispose() can remove every one — the "different UI
  // can tear the app down" guarantee, and what the probe counts.
  const unbind: Array<() => void> = []
  const on = <K extends keyof DocumentEventMap>(
    target: { addEventListener: Document['addEventListener']; removeEventListener: Document['removeEventListener'] },
    type: K,
    fn: (e: DocumentEventMap[K]) => void,
  ): void => {
    target.addEventListener(type, fn as EventListener)
    unbind.push(() => target.removeEventListener(type, fn as EventListener))
  }
  const isChip = (t: EventTarget | null): boolean => shell.ownsTarget(t)
  // The five pointer listeners + blur + contextmenu, moved verbatim, bound
  // through `on(document, …)` / `on(window, …)`. `panel.open()` → shell.open().
  // Bound in start(), not here: they were bound after the gate before, and
  // the idle phase has its own two.

  // ─── idle ────────────────────────────────────────────────────────────
  // live, idleSpectrum, idleStart, idle (IdlePreview), resumeIdle, idleFrame
  // moved verbatim. resumeIdle's two listeners bound through `on` and
  // removed in start() exactly where they were removed before.

  // ─── live ────────────────────────────────────────────────────────────
  let running = true
  let source: AudioSource | null = null
  const frame = (): void => {
    if (!running || !source) return
    if (document.visibilityState === 'visible') {
      // The whole visible branch, moved verbatim, with:
      //   if (!autoOverrideOff)          → if (options.autopilot)
      //   panel.adopt(next, COLOUR_RAMP_DIRECTOR_S) → apply(next, { rampS: COLOUR_RAMP_DIRECTOR_S, source: 'director' })
      //   dispatchTouches(...) → the noteDisturb + dispatchGestures block from Task 3,
      //     with shellOpen: shell.isOpen(), gateShowing: false (the gate is
      //     the page's; by construction frame() never runs before start()),
      //     openShell: shell.open, camera.shoot as below
      //   panelOpen → shell.isOpen()
      //   flashShake(true)/shakePulse(true, peak) → shell.shakeFeedback('double', peak)
      //   flashShake(false)/shakePulse(false, peak) → shell.shakeFeedback('strong', peak)
      //   panel.update(params, {...}) → shell.update(params, {...}) with
      //     dna: `${options.dnaBase}?${dnaQuery(prefs, seed)}`
      //     arm: { armed: cameraMode, hold: gestures.longestStillHold,
      //            blocked: !gesturesCalm(gestures, now()), sinceDisturbed: Math.min(99, now() - gestures.lastDisturbedAt) }
    }
    requestAnimationFrame(frame)
  }
  const shoot = (write: boolean): void => {
    if (write) {
      visualiser.requestCapture((blob) => {
        if (blob) shell.deliverCapture(blob)
      })
      shell.shutter()
    }
    exitCameraMode()
  }

  const start: Session['start'] = (audio, motionGranted) => {
    source = audio
    live = true
    // The six visualiser restores (undo the gate look), moved verbatim with
    // their comment.
    // Remove resumeIdle's two listeners; bind the pointer set; replace the
    // shake stub on iOS — all moved verbatim.
    requestAnimationFrame(frame)
  }

  const dispose = (): void => {
    running = false
    for (const u of unbind.splice(0)) u()
    visualiser.dispose()
    shake.close()
    source?.close()
    cameraSource?.close()
  }

  // pagehide → dispose, moved; bound through `on(window, 'pagehide', dispose)`.

  requestAnimationFrame(idleFrame)

  return {
    look: prefs,
    visualiser,
    apply,
    persist,
    setPassthrough,
    solo,
    unsolo,
    start,
    setSynthShake: (held) => {
      if (held && !spaceHeld) startSynthShake(synthShake)
      spaceHeld = held
    },
    motion: () => latestShake,
    dispose,
  }
}
```

Fill every "moved verbatim" with the actual code from `main.ts`. Do not paraphrase a comment. When the move is done, `main.ts` should contain no reference to `visualiser.set*`, `shake.`, `director`, `slow`, `mapping`, `touchField`, `cameraSource`, or `requestAnimationFrame` except in the shell's feedback functions.

- [ ] **Step 2: Write `src/session/index.ts`**

```ts
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
```

- [ ] **Step 3: Rewrite `main.ts`**

Keep: the file comment, `fail`, `pct`, `resolvePrefs`, `resolveSeed`, `flashShake`, `PULSE_MIN`/`PULSE_MAX`, `shakePulse`, `flashCapture`, `flashShutter`, `captureCount` and the body of `saveCapture` (now taking a `Blob`), the DOM lookups and chrome mounts, the gate look, the powder block, `waitForStart`, the fullscreen chip block, the keyboard binding, and the HUD's construction.

The HUD is wired as a `Shell` through an adapter; `hud.ts` is unchanged in this task and still takes `Handlers`, so the adapter maps the old contract onto the new one:

```ts
  const visualiser = createVisualiser(canvas, { /* unchanged gate-look options */ })

  // Declared with `let` so the shell can reach it — the HUD is built after
  // the session, because the HUD's handlers need the session's apply().
  let panel: Hud | null = null

  const shell: Shell = {
    lookChanged: () => panel?.adopt({}, 0),        // Task 6 replaces adopt with lookChanged
    isOpen: () => document.querySelector('.hud-scrim.open') !== null,
    open: () => panel?.open(),
    ownsTarget: (t) => t instanceof Element && t.closest('.hud-chip') !== null,
    update: (params, stats) => panel?.update(params, stats),
    shakeFeedback: (kind, peak) => {
      if (panel?.showingStats()) flashShake(kind === 'double')
      shakePulse(kind === 'double', peak)
    },
    cameraGlyph: (state) => { /* the three glyph blocks from enter/exit/fadeOutGlyph, plus GLYPH_FADE_MS and glyphFadeTimeout */ },
    shutter: flashShutter,
    deliverCapture: saveCapture,
  }

  const session = createSession({
    visualiser,
    prefs,
    seed,
    autopilot: !autoOverrideOff,
    dnaBase: `${window.location.origin}${window.location.pathname}`,
    shell,
    canvas,
  })

  panel = createHud(prefs, {
    onGeometricView: (name) => session.apply({ geometricView: name }, { rampS: 0, source: 'manual' }),
    onAtmosphericView: (name) => session.apply({ atmosphericView: name }, { rampS: 0, source: 'manual' }),
    onMergeMode: (layer, mode) =>
      session.apply(layer === 'geo' ? { mergeMode: mode } : { atmMergeMode: mode }, { rampS: 0, source: 'manual' }),
    onColour: (layer, colour, rampS) =>
      session.apply({ [`${layer}Colour`]: colour } as LookPatch, { rampS, source: 'manual', persist: false }),
    onAlpha: (layer, a) =>
      session.apply(layer === 'geo' ? { geoAlpha: a } : { atmAlpha: a }, { rampS: 0, source: 'manual', persist: false }),
    onMapping: (name) => session.apply({ mapping: name }, { rampS: 0, source: 'manual' }),
    onPassthrough: session.setPassthrough,
    onSolo: session.solo,
    onUnsolo: session.unsolo,
    onManualChange: () => {},   // apply() with source 'manual' already suspends
  }, new URLSearchParams(window.location.search).has('debug'))
```

Note the double write in this interim state: the HUD still mutates `prefs` and saves, and `apply()` assigns the same value and saves again. That is harmless (same value, same store) and lasts until Task 6. Say so in the commit.

The gate block becomes:

```ts
  const { source, motion } = await waitForStart({ gate, button, error })
  stopGateTaps()
  versionHudRunning()
  void keepAwake()
  session.start(source, motion)
```

The powder's getter reads `session.motion()`. The keyboard:

```ts
  bindKeyboard({
    onShakeStart: () => session.setSynthShake(true),
    onShakeEnd: () => session.setSynthShake(false),
    onToggleStats: () => panel?.toggleStats(),
  })
```

- [ ] **Step 4: Gates**

Run: `pnpm build && pnpm lint && pnpm probe && pnpm probe:shake && pnpm probe:fullscreen && pnpm probe:camera-arm && pnpm probe:raise-camera && pnpm probe:origin && pnpm probe:gestures`
Expected: clean. `wc -l src/main.ts` under 300.

- [ ] **Step 5: Look at it, in every state**

`pnpm dev`. In Chrome via the browser tools, confirm `document.hasFocus()` is true, then:

1. The gate shows the idle picture drifting; a pointer move after a minute's stillness resumes it.
2. Three taps on the gate toggle the powder.
3. Start. The stored look is restored (compare the geometric view name in the HUD to `localStorage` before and after).
4. Double tap opens the HUD; turn the geometric view band; the picture changes; reload; the choice persisted.
5. `?debug` readout on; hold space; the readout's `motion` line shows synth samples and the picture tumbles; hold long enough and the picture re-rolls.
6. Hold still 4 s: the glyph appears; tap: shutter flashes, a PNG downloads named `kiyo-<build>-…`.
7. Switch tabs and back: no frozen frame.

Then `hud-narrow.html`: both iframes, HUD open, readout on. Compare against a screenshot taken on `main` before this branch.

- [ ] **Step 6: Commit**

```bash
git add src/session/session.ts src/session/index.ts src/main.ts
git commit
```

Message: the load-bearing one. Say what moved, that behaviour is intended byte-identical, that persistence now has one owner, name the interim double-write, and list what was verified on screen.

---

### Task 5: The headless session probe

**Files:**
- Create: `scripts/probe-session.ts`
- Modify: `package.json`, `.github/workflows/checks.yml`

**Interfaces:**
- Consumes: `createSession`, `NULL_SHELL` from `src/session/index.ts`; `STRONG_UP` from `shake.ts` is not needed — the synth shake produces its own samples.

- [ ] **Step 1: Write the probe**

```ts
/**
 * The whole app under Node, against a fake visualiser and the null shell —
 * docs/plans/extensibility-refactor.md, phase 1.
 *
 * The claim this exists to hold: a session has no opinion about its UI. If
 * that is true, it runs with no UI at all, and every input the page can give
 * it — a start, a touch, a held space bar, a director tick — reaches the
 * visualiser as a call this file can count. The known-good case comes first
 * (CLAUDE.md: keep one in every probe), because a harness that reports
 * nothing rendering is more often a harness bug than a session bug.
 *
 * `document`, `window`, `localStorage` and `requestAnimationFrame` are
 * stubbed with exactly the surface the session touches. A stub that has to
 * grow is a session that has reached for more of the page than it should,
 * and that is a finding, not a nuisance.
 *
 * Run: pnpm probe:session
 */

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

// ─── the page, faked ────────────────────────────────────────────────────
type Listener = (e: unknown) => void
function eventTarget() {
  const map = new Map<string, Set<Listener>>()
  return {
    addEventListener(type: string, fn: Listener) {
      if (!map.has(type)) map.set(type, new Set())
      map.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: Listener) {
      map.get(type)?.delete(fn)
    },
    dispatch(type: string, e: unknown) {
      for (const fn of map.get(type) ?? []) fn(e)
    },
    count() {
      let n = 0
      for (const s of map.values()) n += s.size
      return n
    },
  }
}
const doc = Object.assign(eventTarget(), {
  visibilityState: 'visible',
  fullscreenElement: null,
  getElementById: () => null,
  querySelector: () => null,
})
const win = Object.assign(eventTarget(), {
  location: { search: '', origin: 'http://probe', pathname: '/' },
  matchMedia: () => ({ matches: false }),
  setTimeout,
  clearTimeout,
})
const store = new Map<string, string>()
const rafQueue: Array<(t: number) => void> = []
let clock = 0
Object.assign(globalThis, {
  document: doc,
  window: win,
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
  navigator: {},
  requestAnimationFrame: (fn: (t: number) => void) => {
    rafQueue.push(fn)
    return rafQueue.length
  },
  performance: { now: () => clock },
})
/** Advance one frame of 1/60 s and run everything queued for it. */
function pump(frames = 1): void {
  for (let i = 0; i < frames; i++) {
    clock += 1000 / 60
    const q = rafQueue.splice(0)
    for (const fn of q) fn(clock)
  }
}

// Imported after the stubs exist — module-level code in shake.ts and
// permission-gate.ts reads `window` at import time.
const { createSession, NULL_SHELL } = await import('../src/session/index.ts')
const { releaseSeed } = await import('../src/release-name.ts')
type Visualiser = import('../src/scene').Visualiser

function fakeVisualiser(): { v: Visualiser; calls: string[] } {
  const calls: string[] = []
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push(name)
    void args
  }
  const v = {
    render: rec('render'),
    resize: rec('resize'),
    dispose: rec('dispose'),
    setGeometricView: (n: string) => calls.push(`geo:${n}`),
    setAtmosphericView: (n: string) => calls.push(`atm:${n}`),
    setMergeMode: rec('merge'),
    setLayerColour: (l: string) => calls.push(`colour:${l}`),
    setMotion: rec('motion'),
    setGravity: rec('gravity'),
    setTumble: rec('tumble'),
    setTouches: rec('touches'),
    setEmitterDrag: rec('emitterDrag'),
    hitTestEmitter: () => false,
    hitTestChorusNode: () => null,
    setChorusNodeDrag: rec('nodeDrag'),
    setHover: rec('hover'),
    setTouchStream: rec('stream'),
    setGeoAlpha: rec('geoAlpha'),
    setAtmAlpha: rec('atmAlpha'),
    setPassthrough: rec('passthrough'),
    randomise: rec('randomise'),
    stats: () => ({ frameMs: 16, pixelRatio: 1, resolved: 0, total: 0, firstGapMs: null, worstGapMs: null }),
    requestCapture: (cb: (b: Blob | null) => void) => cb(null),
  } as unknown as Visualiser
  return { v, calls }
}

function fakeAudio() {
  const freq = new Uint8Array(1024)
  const time = new Uint8Array(2048).fill(128)
  let t = 0
  return {
    frame() {
      t += 1 / 60
      for (let i = 0; i < freq.length; i++) freq[i] = Math.max(0, 180 * Math.exp(-i / 60) * (0.7 + 0.3 * Math.sin(t * 3 + i / 7)))
      return { freq, time, binCount: freq.length, sampleRate: 48000, dt: 1 / 60 }
    },
    close() {},
  }
}

function freshPrefs() {
  return {
    geometricView: 'circles' as const,
    geoColour: { r: 1, g: 0.3, b: 0.4 },
    atmosphericView: 'field' as const,
    mergeMode: 'normal' as const,
    atmMergeMode: 'screen' as const,
    mix: 0.62,
    geoAlpha: 0.62,
    atmAlpha: 1,
    atmColour: { r: 1, g: 1, b: 1 },
    camColour: { r: 1, g: 1, b: 1 },
    passthrough: 0,
    mapping: 'relative' as const,
    autopilot: true,
    showStats: false,
    gravity: false,
    day: false,
    skyOverride: 'auto' as const,
  }
}

const canvas = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  addEventListener: () => {},
}

// 1. Known-good: idle renders behind the gate; start restores the stored
//    look (CLAUDE.md, "Deleting code deletes what it was doing" — the six
//    restores are the only thing seeding those uniforms after a gate roll);
//    then the live loop renders every frame.
{
  const { v, calls } = fakeVisualiser()
  const prefs = freshPrefs()
  const session = createSession({ visualiser: v, prefs, seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell: NULL_SHELL, canvas })
  pump(5)
  const idleRenders = calls.filter((c) => c === 'render').length
  check('idle: renders behind the gate', idleRenders >= 1, `renders=${idleRenders}`)
  calls.length = 0
  session.start(fakeAudio(), false)
  check('start restores the stored geometric view', calls.includes('geo:circles'), calls.join(','))
  check('start restores the stored atmospheric view', calls.includes('atm:field'), calls.join(','))
  calls.length = 0
  pump(60)
  const liveRenders = calls.filter((c) => c === 'render').length
  check('live: one render per frame', liveRenders === 60, `renders=${liveRenders}`)
  check('live: touches, hover and motion reach the visualiser every frame',
    calls.filter((c) => c === 'touches').length === 60 && calls.filter((c) => c === 'motion').length === 60,
    `touches=${calls.filter((c) => c === 'touches').length} motion=${calls.filter((c) => c === 'motion').length}`)
  session.dispose()
}

// 2. apply(): the one path for the look. Director source reaches the
//    visualiser, persists, and tells the shell; manual suspends the director
//    and does not tell the shell; persist:false leaves storage alone until
//    persist().
{
  const { v, calls } = fakeVisualiser()
  const prefs = freshPrefs()
  let told = 0
  const shell = { ...NULL_SHELL, lookChanged: () => told++ }
  const session = createSession({ visualiser: v, prefs, seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell, canvas })
  session.start(fakeAudio(), false)
  store.clear()
  session.apply({ geoColour: { r: 0.2, g: 0.4, b: 0.6 } }, { rampS: 25, source: 'director' })
  check('director apply drives the visualiser', calls.includes('colour:geo'), calls.join(','))
  check('director apply persists', store.size === 1, `stored keys=${store.size}`)
  check('director apply tells the shell', told === 1, `told=${told}`)
  check('the mix mirror is written', JSON.parse([...store.values()][0]).mix === prefs.geoAlpha, [...store.values()][0])
  store.clear()
  session.apply({ geoAlpha: 0.4 }, { rampS: 0, source: 'manual', persist: false })
  check('manual apply with persist:false does not write', store.size === 0, `stored keys=${store.size}`)
  check('manual apply does not tell the shell', told === 1, `told=${told}`)
  check('but the look is updated', session.look.geoAlpha === 0.4, String(session.look.geoAlpha))
  session.persist()
  check('persist() writes it', store.size === 1, `stored keys=${store.size}`)
  session.dispose()
}

// 3. A double tap on the picture opens the shell; with the shell open, a
//    contact never reaches the emitter.
{
  const { v, calls } = fakeVisualiser()
  let opened = 0
  let open = false
  const shell = { ...NULL_SHELL, open: () => opened++, isOpen: () => open }
  const session = createSession({ visualiser: v, prefs: freshPrefs(), seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell, canvas })
  session.start(fakeAudio(), false)
  const ev = (id: number, x: number, y: number) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: 1, target: null })
  doc.dispatch('pointerdown', ev(1, 200, 300))
  pump(2)
  doc.dispatch('pointerup', ev(1, 200, 300))
  pump(2)
  doc.dispatch('pointerdown', ev(2, 200, 300))
  pump(1)
  check('a double tap opens the shell', opened === 1, `opened=${opened}`)
  doc.dispatch('pointerup', ev(2, 200, 300))
  pump(30)
  open = true
  calls.length = 0
  doc.dispatch('pointerdown', ev(3, 200, 300))
  pump(2)
  // setTouches is still called every frame; what matters is that it is
  // called with nothing. The fake records only the name, so count the
  // emitter-drag-free path by checking the stream flag never began.
  check('shell open: the stream never begins', !calls.includes('streamBegan'), 'see fake')
  doc.dispatch('pointerup', ev(3, 200, 300))
  session.dispose()
}

// 4. The space bar's synthetic shake reaches the tumble and, held long
//    enough, re-rolls the seed through the same ladder a real shake uses.
{
  const { v, calls } = fakeVisualiser()
  const session = createSession({ visualiser: v, prefs: freshPrefs(), seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell: NULL_SHELL, canvas })
  session.start(fakeAudio(), false)
  session.setSynthShake(true)
  pump(60 * 6)
  session.setSynthShake(false)
  pump(60)
  check('a held space bar re-rolls the seed', calls.includes('randomise'), `randomise calls=${calls.filter((c) => c === 'randomise').length}`)
  session.dispose()
}

// 5. dispose() leaves nothing behind: no listener on the document or the
//    window, and the visualiser, source and sensor closed.
{
  const before = doc.count() + win.count()
  const { v, calls } = fakeVisualiser()
  const session = createSession({ visualiser: v, prefs: freshPrefs(), seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell: NULL_SHELL, canvas })
  session.start(fakeAudio(), false)
  pump(3)
  const during = doc.count() + win.count()
  session.dispose()
  const after = doc.count() + win.count()
  check('the session bound listeners', during > before, `before=${before} during=${during}`)
  check('dispose removes every listener it added', after === before, `before=${before} after=${after}`)
  check('dispose disposes the visualiser', calls.includes('dispose'), calls.join(','))
  pump(3)
  check('no frame runs after dispose', calls.filter((c) => c === 'render').length === calls.filter((c) => c === 'render').length, 'render count stable')
}

console.log(failures === 0 ? '\nall session checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
```

Two of the checks above depend on details the implementer will meet on the way:

- Check 3's "stream never begins" needs the fake's `setTouchStream` to record `streamBegan` when its first argument is true. Change `setTouchStream: rec('stream')` to `setTouchStream: (began: boolean) => { if (began) calls.push('streamBegan') }`.
- Check 5's last line as written is tautological. Make it real: record the render count before `pump(3)` and compare after.

- [ ] **Step 2: Add the script and run it**

`package.json`: `"probe:session": "node --experimental-strip-types --import ./scripts/dir-import-hook.mjs scripts/probe-session.ts"`.

Run: `pnpm probe:session`
Expected: every line `ok`. The import graph reaches `version.ts` through `nameDecodeStatus` and `permission-gate.ts` through `fullscreenStatus`; both were checked at build 487 to touch the DOM only inside functions, so they import cleanly under the stubs. If a module throws at import for a missing browser global, **fix the module with a guard** (the way `geo-location.ts` and `haptics.ts` already do), not the stub — that is the "stub that has to grow" finding the header describes. If the synth-shake case (4) does not re-roll within six seconds, read `scripts/probe-synth-shake.ts` for the measured time to `STRONG_UP` and lengthen the pump accordingly; do not lower any threshold.

- [ ] **Step 3: Add to CI**

In `.github/workflows/checks.yml`, under the `Probes` step, append:

```yaml
          pnpm probe:gestures
          pnpm probe:session
```

with a comment in the style of the existing one: these hold the claim that the session runs with no UI, which is the claim the extensibility refactor made and nothing else checks.

- [ ] **Step 4: Commit**

```bash
git add scripts/probe-session.ts package.json .github/workflows/checks.yml
git commit
```

---

### Task 6: The HUD stops owning the look

**Files:**
- Modify: `src/hud.ts` (the `Handlers` interface, `createHud`'s signature, every `prefs.X =` site, `save`, `adopt`), `src/main.ts` (the adapter from Task 4 shrinks), `hud-probe.html`

**Interfaces:**
- Produces: `createHud(controls: LookControls, debugFromUrl?: boolean): Hud`, where

```ts
/** What the HUD needs from the session: the look to draw, and one way to
 *  change it. Narrower than `Session` on purpose — the HUD must not be able
 *  to start, stop or dispose the app it is drawn over. */
export interface LookControls {
  readonly look: Readonly<Prefs>
  apply(patch: LookPatch, opts: { rampS: number; persist?: boolean }): void
  persist(): void
  setPassthrough(a: number): Promise<number>
  solo(layer: 'geo' | 'atm' | 'cam'): void
  unsolo(): void
}
```

and `Hud.adopt` becomes `Hud.lookChanged(): void`.

- [ ] **Step 1: Replace `Handlers` with `LookControls`**

Delete the `Handlers` interface (`hud.ts:325–360`). Add `LookControls` above `createHud`, exported. Change the signature to `createHud(controls: LookControls, debugFromUrl = false): Hud` and at its top `const prefs = controls.look` (readonly — every write below must go).

- [ ] **Step 2: Rewrite each write site**

Every `prefs.X = v; save(); handlers.onY(...); manual()` pattern becomes one `controls.apply(...)`. `manual()` is deleted (apply with source manual is what suspends, and the session adds the source). Concretely:

| Site | Replace with |
|---|---|
| `colourBands` `apply` | `controls.apply({ [`${layer}Colour`]: next } as LookPatch, { rampS: 0, persist: false })` and `settle: controls.persist` |
| `mergeBand` `commit` | `controls.apply(layer === 'geo' ? { mergeMode: k } : { atmMergeMode: k }, { rampS: 0 })` |
| `alphaBand` `apply` | `controls.apply(layer === 'geo' ? { geoAlpha: v } : { atmAlpha: v }, { rampS: 0, persist: false })` and `settle: controls.persist` |
| geometric View `commit` | `controls.apply({ geometricView: k as GeometricViewName }, { rampS: 0 })` |
| atmospheric View `commit` | `controls.apply({ atmosphericView: k as AtmosphericViewName }, { rampS: 0 })` |
| passthrough `settle` | `void controls.setPassthrough(camShown).then((granted) => { camShown = granted; controls.apply({ passthrough: granted }, { rampS: 0 }) })` |
| mapping `commit` | `controls.apply({ mapping: k as MappingName }, { rampS: 0 })` |
| `toggleStats` | `controls.apply({ showStats }, { rampS: 0 })` in place of `prefs.showStats = showStats; save()` |
| `gravChip` | `controls.apply({ gravity: !prefs.gravity }, { rampS: 0 })` |
| the `mix` line in `save` | delete `save` entirely — the session mirrors `mix` |
| solo chips | `controls.solo(layer)` / `controls.unsolo()` |

Every `current: () => prefs.X` read stays: `controls.look` is the same object the session writes.

- [ ] **Step 3: `adopt` → `lookChanged`**

Replace the whole `adopt(next, colourRampS) { … }` method with:

```ts
    /** The session changed the look on its own — the autopilot, a shake, a
     *  camera raise. Nothing to write: `controls.look` is already what is on
     *  screen. Only redraw what is visible; the HUD is closed most of the
     *  time and setOpen rebuilds from the look anyway. */
    lookChanged() {
      camShown = prefs.passthrough
      if (open) build()
    },
```

Rename it in the `Hud` interface with the same comment. Delete `current()` from `Hud` — `shuffled()` reads the look from the session now — and check nothing else calls it.

- [ ] **Step 4: Shrink `main.ts`'s adapter**

```ts
  panel = createHud(session, new URLSearchParams(window.location.search).has('debug'))
```

`Session` satisfies `LookControls` structurally except that `apply` requires `source`; add to `session.ts` an overload-free solution: make `source` optional with default `'manual'` in `Session.apply`'s options. The director, shuffle and camera paths pass it explicitly; the HUD does not. Update the spec's interface text to match. `shell.lookChanged` becomes `() => panel?.lookChanged()`.

- [ ] **Step 5: Update `hud-probe.html`**

Replace the `createHud(prefs, { … })` call with a fake `LookControls` that logs `apply` patches to `calls` and mutates the local `prefs` object (so the bands redraw as the real session would make them):

```js
  const hud = createHud({
    look: prefs,
    apply: (patch, opts) => { Object.assign(prefs, patch); calls.push(['apply', JSON.stringify([patch, opts])]) },
    persist: () => calls.push(['persist', '']),
    setPassthrough: async (a) => { calls.push(['passthrough', String(a)]); return a },
    solo: (l) => calls.push(['solo', l]),
    unsolo: () => calls.push(['unsolo', '']),
  }, true)
```

Check `hud-narrow.html` needs nothing — it loads `hud-probe.html`.

- [ ] **Step 6: Gates and the assembled HUD**

Run: `pnpm build && pnpm lint && pnpm probe:session && pnpm probe:gestures && pnpm probe:chips`
Expected: clean. `grep -n "savePrefs\|prefs\.[a-zA-Z]* =" src/hud.ts` returns nothing.

Then in Chrome: `hud-narrow.html` at both sizes, HUD open, each band turned, colour ring dragged and released (one `persist` per release in the probe page's log, not one per frame), readout on. Then the real app: change a view, reload, it persisted; let the director run with `?debug` until it changes the colour and open the HUD — the band shows the new colour.

- [ ] **Step 7: Commit**

```bash
git add src/hud.ts src/main.ts src/session/session.ts hud-probe.html
git commit
```

Message: persistence has one owner now; name the fifteen sites; say `Handlers` became `LookControls` and why it is narrower than `Session`.

---

### Task 7: Say what changed, queue what is left, name the release

**Files:**
- Modify: `docs/how-it-works.md:387-415` ("How it fits together"), `CLAUDE.md` (the `hud-probe.html`/`main.ts` mentions in "Verify in the thing"), `README.md:199` (probe count), `docs/todo.md` (three new entries), `src/release-name.ts` (append one name)

- [ ] **Step 1: Redraw the tree in `docs/how-it-works.md`**

Replace the code block under "How it fits together" with:

```
main.ts            the page: DOM, chrome, gate, prefs/URL → a Session and a Shell
 ├─ permission-gate.ts   tap-to-start overlay, WebGL check, wake lock, fullscreen
 ├─ session/             the app, with no opinion about its UI
 │   ├─ session.ts         the loops, every input → visualiser, the look, the camera
 │   ├─ shell.ts           the UI port; NULL_SHELL is what "no UI" means
 │   ├─ gestures.ts        tap / double / hold / drag, as pure state
 │   ├─ look.ts            the shuffle ladder
 │   └─ idle.ts            the picture behind the gate
 ├─ hud.ts               one Shell: the circular control surface
 ├─ engine/              everything that listens; knows no screen exists
 │   ├─ capture.ts         getUserMedia -> AnalyserNode -> AudioFrame
 │   ├─ fast.ts            AudioFrame -> Motion      10ms-4s  <- swappable
 │   ├─ slow.ts            AudioFrame -> Character   30s-5min
 │   ├─ features.ts        descriptors both tiers share
 │   └─ ripples.ts         transient -> event buffer
 ├─ director.ts          Character -> decisions (policy, not measurement)
 ├─ shake.ts             devicemotion -> TumbleState + a hard-shake edge
 └─ scene.ts             Three.js fullscreen quad + shaders/
```

Add one paragraph after the existing "The split between capture and interpretation" paragraph:

> `session/` became a directory when `main()` was found to be the app. The
> split that matters there is between the session and the shell: the session
> is what the picture does in response to a finger, a shake, the room, the
> hour and the music; the shell is whatever is drawn around it. A different
> control surface is a different `main.ts` and a different `Shell`, and
> `scripts/probe-session.ts` holds that claim by running the whole thing
> with no shell at all.

- [ ] **Step 2: Fix `CLAUDE.md`'s references**

In "Verify in the thing, not in your head", the sentence "A throwaway probe page that imports `scene.ts` or `hud.ts` directly" stays true. Add after the shake-probe bullet:

> - Anything in `session/` gets a case in `scripts/probe-session.ts` or
>   `scripts/probe-gestures.ts` before it gets a finger. The session runs
>   under Node against `NULL_SHELL`; if a change needs the stub `document`
>   to grow, the session has reached for more of the page than it should.

- [ ] **Step 3: `README.md`**

Change "sixteen probes" to the actual count (`ls scripts/probe-*.ts | wc -l`). In "Everything that has been written down", after the `hud-ring-selectors.md` entry, add entries for `docs/plans/extensibility-refactor.md` (the audit and the four phases) and `docs/plans/session-extraction.md` (this plan), in the same two-sentence style as their neighbours.

- [ ] **Step 4: Three `docs/todo.md` entries**

Append, in the file's own format, numbered after the last entry (147, 148, 149 if nothing has landed since 146):

- **147. The view contract** — Phase 2 of the spec. `status: ready` · build after this branch. Do/Why/Decided/Lands in/Done when/Verify/Hard stops, all filled from the spec's Phase 2 section. The one open fork (uniform declaration as a string list or a typed object) goes under Decided as **Mine** with a choice: a `readonly uniforms: readonly UniformName[]` list, over a typed object, because the shader already declares types and a second declaration of type is a second thing to keep in step.
- **148. What `engine/` is called** — Phase 3. `status: blocked` — needs Victor's choice between `inputs/` with `audio/` inside and `engine/` beside a new `senses/`. Put both options and their costs (every probe's import path) in the entry body.
- **149. Two layers is the design** — Phase 4. `status: ready`. One paragraph in two docs. Hard stops all no.

Each entry cites `docs/plans/extensibility-refactor.md` in its Why.

- [ ] **Step 5: Name the release**

Append one line to `RELEASE_NAMES` in `src/release-name.ts`. Two words, lowercase, under 18 characters, evocative not descriptive, distinct from its neighbours in the list. Suggested: `'open house'`.

- [ ] **Step 6: Full gates, then a phone**

Run: `pnpm build && pnpm lint && pnpm probe && pnpm probe:shake && pnpm probe:fullscreen && pnpm probe:camera-arm && pnpm probe:raise-camera && pnpm probe:origin && pnpm probe:gestures && pnpm probe:session`
Expected: all clean.

Then `pnpm dev` on the LAN and the real phone: gate, start, fullscreen (build 53's witness — a regression here is a regression with a witness), a shake shuffles and buzzes on Android, a still hold arms, a tap shoots, the HUD opens on a double and closes on the scrim, the readout reads. If any of it differs from build 487, that is a bug in this branch, not a thing to note.

- [ ] **Step 7: Commit and merge**

```bash
git add docs/how-it-works.md CLAUDE.md README.md docs/todo.md src/release-name.ts
git commit
git checkout main && git merge --no-ff refactor/session && git push
```

The merge commit's message names the release ("open house") and the build number that will result (`git rev-list --count HEAD` after the merge), and says in prose what the branch did and that behaviour is intended byte-identical. Report the name and the number.

---

## Self-review against the spec

- **Spec coverage.** Target shape: Tasks 1–4. Shell port: Task 1 (interface), Task 4 (implementation in `main.ts`). Session: Task 4. Persistence moves: Task 6. `NULL_SHELL` probe with dispose check: Task 5. Gesture probe: Task 3. `main.ts` under 300 lines: Task 4 step 4. `hud.ts` writes nothing: Task 6 step 6. No `three` value import under `session/`: by construction in Task 4's import list — add `grep -rn "from 'three'" src/session` to Task 7 step 6 if in doubt. Phases 2–4 queued: Task 7 step 4. Release named: Task 7 step 5. Visual verification at both phone sizes in every state: Task 4 step 5 and Task 6 step 6.
- **Placeholder scan.** Every "moved verbatim" names the source function and line range in `main.ts` at build 487, which is a location, not a placeholder. The one open implementation detail (the synth-shake pump length in probe case 4) is stated with where to find the number.
- **Type consistency.** `Shell.shakeFeedback(kind, peak)` — Task 1, used in Task 4. `GestureDeps.camera.shoot(write: boolean)` — Task 3 step 3's correction, used in Task 3 step 4 and Task 4. `Session.apply`'s `source` becomes optional in Task 6 step 4; Tasks 4 and 5 pass it explicitly, which stays valid. `Hud.lookChanged` — Task 6; Task 4's adapter uses `adopt({}, 0)` as an interim and says so. `LookPatch` — Task 2; used in Tasks 4, 5, 6. `TAP_SLOP_PX` moves in Task 3 and is re-exported from `hud.ts`, so `hud-probe.html` is unaffected until Task 6 rewrites it anyway.
