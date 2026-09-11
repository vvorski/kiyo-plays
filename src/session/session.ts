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
import type { AudioSource } from '../engine'
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
  /**
   * Whether the page's start gate is still covering the picture, asked once
   * a frame. A predicate rather than a flag because the answer changes
   * *after* `start()`: `waitForStart()` resolves, then permission-gate.ts
   * fades `#gate` out over 600ms before hiding it, and for that whole
   * window a contact is landing on the gate rather than on the picture.
   * The gate is the page's element and this is the page's question; the
   * session only forwards the answer to the recogniser.
   */
  gateShowing: () => boolean
  /** The picture's element, for `getBoundingClientRect()` and the context
   *  menu suppression. The one DOM handle the session holds. */
  canvas: {
    getBoundingClientRect(): DOMRect
    addEventListener: HTMLElement['addEventListener']
    removeEventListener: HTMLElement['removeEventListener']
  }
}

export interface Session {
  readonly look: Readonly<Prefs>
  readonly visualiser: Visualiser
  apply(patch: LookPatch, opts: { rampS: number; source?: LookSource; persist?: boolean }): void
  persist(): void
  setPassthrough(a: number): Promise<number>
  solo(layer: 'geo' | 'atm' | 'cam'): void
  unsolo(): void
  start(source: AudioSource, motionGranted: boolean): void
  setSynthShake(held: boolean): void
  motion(): ShakeFrame
  dispose(): void
}

/** docs/todo.md entry 92 — how long a colour ramp takes, by source: "a
 *  machine's changes ease; a person's changes are instant." The director
 *  gets a slow, visible travel; a shake reads as a single event rather
 *  than a graceful glide, so it gets a short one instead of the
 *  director's — both figures are **Mine**, Decided names neither. */
export const COLOUR_RAMP_DIRECTOR_S = 2.0
export const COLOUR_RAMP_SHAKE_S = 0.25

/** Anything a listener can be hung on. `document`, `window` and the canvas
 *  are the three this file ever binds to, and the only thing it needs of
 *  them is that a listener can be added and taken off again — which is what
 *  `dispose()` is built around. */
interface Listenable {
  addEventListener(type: string, fn: EventListener): void
  removeEventListener(type: string, fn: EventListener): void
}

/** Both maps, because the session binds to `document` (pointer events) and
 *  to `window` (`blur`, `resize`, `orientationchange`, `pagehide`) and no
 *  single built-in map carries all of them. */
type SessionEventMap = DocumentEventMap & WindowEventMap

export function createSession(options: SessionOptions): Session {
  const { visualiser, prefs, seed, shell, canvas } = options
  const now = (): number => performance.now() / 1000

  // ─── the look ────────────────────────────────────────────────────────

  /** Save, keeping the legacy `mix` in step with the geometric alpha. Nothing
   *  reads `mix` any more, but it is the field older builds and older shared
   *  links use, so writing it means landing back on an earlier build shows the
   *  picture you left rather than a default. */
  const persist = (): void => {
    prefs.mix = prefs.geoAlpha
    savePrefs(prefs)
  }

  let mapping: Mapping = MAPPINGS[prefs.mapping]()

  // The minutes tier and the thing that acts on it. Kept out of `mapping` on
  // purpose: a mapping swap throws away several seconds of envelope state,
  // which is the right call for a fast tier and exactly the wrong one for a
  // five-minute buffer.
  const slow = new SlowAnalysis()
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
   *
   * `source` defaults to `'manual'`: the HUD is the caller that never names
   * one (it satisfies `LookControls`, which has no reason to know the
   * director/shake/camera vocabulary), and a manual default is also the
   * safe one — an unlabelled caller suspending the autopilot is a much
   * smaller surprise than one silently reporting itself to the shell as
   * something the person didn't do.
   */
  const apply: Session['apply'] = (patch, { rampS, source: from = 'manual', persist: doPersist = true }) => {
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
      // Mappings carry several seconds of internal state (running means, feature
      // history), none of which is transferable, so switching starts a fresh one
      // rather than trying to hand the old state over.
      mapping = MAPPINGS[patch.mapping]()
    }
    if (patch.passthrough !== undefined) {
      // No visualiser call here, unlike every other field above: the caller
      // already resolved the actual level (including any permission check
      // and the visualiser call that follows from it) before calling
      // apply() at all — see docs/todo.md entry 22. This only records the
      // result, so whatever the shell draws can agree with what is already
      // on screen.
      prefs.passthrough = patch.passthrough
    }
    if (patch.showStats !== undefined) prefs.showStats = patch.showStats
    if (patch.gravity !== undefined) prefs.gravity = patch.gravity
    if (doPersist) persist()
    // `showStats` and `gravity` are whole-app toggles, not the look: the
    // director neither reads nor writes either, so changing one is not the
    // "don't fight the person" signal a colour or a view band is. Neither
    // chip suspended the autopilot before this file owned persistence —
    // old hud.ts's `onManualChange()` was reached by exactly seven controls
    // and neither of these was among them — and `showStats` must not start
    // now for a reason beyond taste: the readout it turns on prints
    // `director.status()` live, so suspending on it would make turning the
    // readout on the cause of the very stillness it exists to diagnose.
    //
    // An *empty* patch still suspends. The camera opacity band's drag is
    // the only caller that sends one, and it sends one precisely to ask for
    // the suspend without writing a field (see its own comment in hud.ts) —
    // "touches no field" and "touches only whole-app toggles" are different
    // claims and only the second one is exempt.
    const keys = Object.keys(patch)
    const touchesLook = keys.length === 0 || keys.some((k) => k !== 'showStats' && k !== 'gravity')
    if (from === 'manual') {
      if (touchesLook) director.suspend()
    } else shell.lookChanged()
  }

  // ─── camera ──────────────────────────────────────────────────────────

  /** Held open only while passthrough is actually showing. See setPassthrough. */
  let cameraSource: CameraSource | null = null

  /**
   * Turning it down to nothing releases the camera outright rather than
   * leaving it running behind a zero. Holding an open stream that nothing
   * draws keeps the sensor powered and the OS camera indicator lit, which is
   * the most visible possible way to break the start gate's promise.
   *
   * Factored out of the HUD's own `onPassthrough` handler so the shake path
   * (entry 22) can call the exact same logic rather than a second copy of
   * it — the two differ only in what is allowed to call this with a
   * non-zero `mix` in the first place, which is `maybeRollCamera()`'s job
   * (`cameraSource?.isLive()`, docs/todo.md entry 73), not this function's.
   *
   * Removed by entry 73: `hasCameraPermission()`/`cameraEverGranted`, the
   * gate this function's own first non-zero call used to rely on the shake
   * path having already checked. A granted permission was never actually
   * the thing that mattered — a *live* stream is, since permission without
   * a working `play()` is exactly the frozen-camera report's own cause,
   * and "permission granted" and "frames arriving" turned out not to be
   * the same fact.
   */
  async function setPassthrough(mix: number): Promise<number> {
    if (mix <= 0) {
      visualiser.setPassthrough(null, 0)
      cameraSource?.close()
      cameraSource = null
      return 0
    }

    // A frozen stream is closed, not kept — docs/todo.md entry 73. Reusing
    // one here (the HUD band touched again, camera mode re-entered, a
    // shake raising a level that is already live) would otherwise hold a
    // powered sensor and a lit OS indicator open behind a still photograph
    // indefinitely, exactly what closing on mix <= 0 above already exists
    // to prevent for the ordinary case.
    if (cameraSource && !cameraSource.isLive()) {
      cameraSource.close()
      cameraSource = null
    }

    // First non-zero value with no live stream already open is what asks,
    // when called from the control's own pointer handler — the gesture
    // getUserMedia requires is still live there. maybeRollCamera() never
    // reaches this branch, by construction: it refuses to raise anything
    // that is not already live, so it never spends a gesture it does not
    // have.
    if (!cameraSource) {
      try {
        cameraSource = await startCamera()
      } catch {
        // Declined, or no camera. Report the truth — 0 — and let the HUD put
        // its control back rather than leaving it somewhere it is not.
        return 0
      }
    }
    visualiser.setPassthrough(cameraSource, mix)
    return mix
  }

  // docs/todo.md entry 87 corrects entry 72's own misreading: "camera mode"
  // was taken to mean the passthrough camera, so entering used to call
  // applyPassthrough(0.75) — directly against the original request's own
  // "animation not affected". Entering now touches passthrough not at all;
  // what makes this a mode is the glyph, the instant shutter and the
  // locked-out menu, nothing visual. `cameraMode` stays a render-time flag
  // only, never a stored write, matching the seam entries 48, 58 and 60 use
  // for their own render-time overrides.
  let cameraMode = false
  // docs/todo.md entry 109 — replaces entry 87's wall-clock timeout
  // (10s, then 60s at build 369) with a state machine over posture and
  // tilt, ticked once per frame below rather than a single `setTimeout`.
  // See camera-arm.ts's own comment for why a clock was the wrong measure.
  const cameraArmState = createCameraArmState()

  function enterCameraMode(): void {
    if (cameraMode) return
    cameraMode = true
    shell.cameraGlyph('armed')
    armCamera(cameraArmState, now())
  }

  // The post-shot return — docs/todo.md entries 87 and 115.
  //
  // The comment that stood here described "a manual exit (a second tap on
  // the chip while armed)", which entry 87 had already removed one entry
  // earlier: `onCameraMode` is `enterCameraMode`, whose own early return
  // makes a second tap a no-op. Entry 115 then deleted the chip outright,
  // so the ways out are now exactly two — the next tap on the picture takes
  // the shot and calls this, or entry 109's expiry ends the mode from
  // inside the frame loop without reopening anything.
  function exitCameraMode(): void {
    if (!cameraMode) return
    cameraMode = false
    disarmCamera(cameraArmState)
    shell.cameraGlyph('off')
    // docs/todo.md entry 115 removes the `panel.open()` that stood here.
    // Entry 78 had added it, reading "camera mode is not connected to the
    // menu!!" as a complaint about a missing connection when it was a
    // demand for separation; entry 87 then repeated the inversion. This one
    // line was the whole substance of the complaint, three times over. The
    // shot lands you back on the plain picture.
  }

  // docs/todo.md entry 83. The render-time-override seam entries 48, 58 and
  // 60 already use, applied to a layer's alpha: forcing the other two
  // layers to 0 never touches prefs, so there is nothing to restore and
  // nothing an interrupted gesture can leave behind — `unsolo` just
  // re-reads whatever the true current values are at the moment it is
  // called, which is correct even if something else (a shuffle, the
  // director) moved them while the chip was held.
  //
  // The camera layer's own opacity, `prefs.passthrough`, is forced through
  // `visualiser.setPassthrough` directly rather than through
  // `setPassthrough` — that function closes the live stream outright on
  // any mix <= 0 (see its own comment: holding a powered, undrawn camera
  // open is exactly the OS-indicator problem it exists to prevent), which
  // would turn a momentary solo into tearing down and re-acquiring the
  // actual camera on every press and release. Forcing the render value
  // alone leaves `cameraSource` untouched throughout.
  function solo(layer: 'geo' | 'atm' | 'cam'): void {
    if (layer !== 'geo') visualiser.setGeoAlpha(0)
    if (layer !== 'atm') visualiser.setAtmAlpha(0)
    if (layer !== 'cam') visualiser.setPassthrough(cameraSource, 0)
  }

  function unsolo(): void {
    visualiser.setGeoAlpha(prefs.geoAlpha)
    visualiser.setAtmAlpha(prefs.atmAlpha)
    visualiser.setPassthrough(cameraSource, cameraSource ? prefs.passthrough : 0)
  }

  // ─── analysis and inputs ─────────────────────────────────────────────

  // docs/todo.md entry 90 — how the phone is currently being held, so the
  // director can pace itself by posture rather than one fixed cadence.
  const postureState = createPostureState()
  // docs/todo.md entry 100 — the same coordinate `scene.ts` already
  // requested (or refused, or never resolved), read again here rather than
  // threaded through the `Visualiser` interface: `geo-location.ts` is a
  // module-level singleton that caches its own result, so this second call
  // never asks the user a second time — it resolves instantly to whatever
  // the first caller already got.
  let geoLocationForDirector: GeoLocation | null = null
  void requestLocation().then((location) => {
    geoLocationForDirector = location
  })
  // docs/todo.md entry 100 — sampled once a second, not every frame, the
  // same discipline `scene.ts`'s own sky/moon sampling already uses and
  // for the identical reason stated there: "over a minute the change is
  // invisible... per-frame would be waste." `Infinity` forces the first
  // real frame to sample immediately rather than waiting a full second on
  // `CELESTIAL_IDENTITY`.
  const CELESTIAL_SAMPLE_S = 1
  let celestialSample: CelestialInfluence = CELESTIAL_IDENTITY
  let sinceCelestialSample = Infinity

  // Flipped by the real loop taking over, which is what stops the idle frames.
  let live = false
  const idleSpectrum = new Uint8Array(256)
  const idleStart = performance.now()

  // Started here rather than waiting for Start, wherever nothing gates the
  // accelerometer at all — docs/todo.md entry 20. On iOS/iPadOS the same call
  // needs a live user gesture this point in the page does not have, so it is
  // skipped there (`startShake(false)` is the same harmless stub the
  // permission-refused path already uses) and replaced once the gate gesture
  // supplies its own `motion` result below. Never a fourth claimant on that
  // gesture — see permission-gate.ts's own comment on why not.
  let shake: ShakeSensor = hasMotionPermissionGate() ? startShake(false) : startShake(true)
  // Only used to turn devicemotion's own irregular cadence into a proper dt
  // for shake.frame() during the idle preview — the live loop already has
  // audio.dt for this once the real render loop takes over below.
  let lastGateShakeAt = idleStart

  // docs/todo.md entry 126 — the space bar's own synthetic shake. `held` is
  // set by keydown/keyup/blur (bindKeyboard, on the page); `synthShake` is
  // the pure state `updateSynthShake` advances once a frame, in the same
  // render loop that calls `shake.frame()`, so a synthesised sample reaches
  // this frame's `Tumble.advance()` the same way a real `devicemotion`
  // sample would.
  let spaceHeld = false
  const synthShake = createSynthShake()

  // docs/todo.md entry 86 — `latestShake` is the one place either loop below
  // (idle, then real) publishes the snapshot its own once-per-frame
  // `shake.frame()` call produced; the powder reads it through
  // `Session.motion()` rather than calling into `shake` a second time, but
  // reading it is no longer consuming, unlike the pending-flag variables
  // this replaces. Two watchers of the same frame — that reader and
  // whichever loop just produced it — now see the same shake rather than
  // racing over which one drains it first.
  let latestShake: ShakeFrame = STILL_FRAME

  const touchField = createTouchField()
  // docs/todo.md entry 112 — the mouse cursor's own state, owned here beside
  // the touch field because this is where the pointer events are. The
  // hover never enters `touchField`: a cursor resting on the glass would be
  // a finger permanently down, holding `touchAnyDown` true for ever and
  // parking the tap recogniser below mid-gesture.
  const hover = createHoverState()
  // The gesture recogniser's own memory between frames — docs/todo.md
  // entries 41, 50, 67, 103, 115, 117, 125, 141 and 146 — lives in
  // session/gestures.ts so it is drivable from Node; see that file's own
  // field comments (mousePointers, contactIdFor and the rest) for what each
  // part of this remembers and why.
  const gestures = createGestureState()

  // ─── shuffle ─────────────────────────────────────────────────────────

  /** Roll a new picture at the given depth and apply it, so a shell opened
   *  afterwards shows what is actually on screen rather than what was.
   *  Below SHUFFLE_RESEED the four continuous quantities nudge from
   *  whatever `prefs` currently holds rather than being replaced — entry
   *  35 — which is why `shuffled()` needs to read them fresh on every call
   *  rather than being handed a value that could go stale between shakes.
   *  The seed only re-rolls once SHUFFLE_RESEED is reached — see
   *  shuffled()'s own file comment for why the two used to be backwards
   *  from each other. */
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

  /**
   * At the top shuffle rung only, sometimes rolls the passthrough level,
   * including up from zero — docs/todo.md entry 22, licensed by Victor
   * 2026-08-29, narrowed by entry 73. This overturns what entries 6, 15
   * and 20 all said and `shuffled()`'s own file comment used to say: the
   * camera is *not* unconditionally excluded from every rung any more,
   * only from every rung below the top one, and only ever raised on top of
   * a stream that is already open and demonstrably live — never opened
   * fresh by this path, and never raised over one that has frozen.
   *
   * Deliberately not part of `shuffled()`, which is synchronous and pure:
   * raising the camera needs `setPassthrough()`'s async work, a kind of
   * gate no other field in the shuffle has. Runs after `shuffle()` rather
   * than inside it, and applies the level itself once resolved rather than
   * folding into the same `apply()` call — the level is not known yet when
   * `shuffle()` returns.
   */
  function maybeRollCamera(depth: number): void {
    if (depth < SHUFFLE_EVERYTHING) return
    // docs/todo.md entry 72: the director must not fight camera mode — it
    // may keep rolling views and colours while the mode is on, but the
    // passthrough level is borrowed for the duration and is not its own to
    // touch.
    if (cameraMode) return
    if (Math.random() >= CAMERA_ROLL_CHANCE) return
    void (async () => {
      const level = Math.random() * CAMERA_ROLL_MAX
      // docs/todo.md entry 73: turning it off never needs a live stream —
      // only raising it does, and raising it needs one *already open and
      // playing*, not merely permitted. A `devicemotion` event carries no
      // user activation, so this path can never be the one that calls
      // `startCamera()` for the first time — the confirmed cause of the
      // frozen-camera report, since `play()` was refused essentially every
      // time it was reached this way. Still true here, and deliberately:
      // docs/todo.md entry 121's press-and-shake is the path that *can* open
      // it, because a finger on the glass is a live user gesture and a
      // `devicemotion` event is not. This one is unchanged.
      if (level > 0 && !(cameraSource?.isLive() ?? false)) return
      const actual = await setPassthrough(level)
      apply({ passthrough: actual }, { rampS: 0, source: 'camera' })
    })()
  }

  /**
   * docs/todo.md entry 121 — a shake with a finger on the glass brings the
   * room in, on top of everything the shake already does.
   *
   * Called from both shake branches after `maybeRollCamera`, which still owns
   * raising a camera that is *already* live (entries 22 and 73). This exists
   * for the case that one cannot serve: the camera that is not open yet, and
   * which only a live user gesture may open. The finger is that gesture.
   *
   * The raise goes through the same two calls `maybeRollCamera` makes —
   * `setPassthrough` then `apply` — so `prefs.passthrough`, `localStorage`
   * and whatever the shell draws all agree without a second path through
   * any of them. That last clause is the one that needed work when the HUD
   * stopped being told *what* changed: `Shell.lookChanged()` carries no
   * patch, so hud.ts's camera band now re-reads `prefs.passthrough` on
   * every adopt rather than only on one that names the field. A refused or
   * absent camera needs nothing extra: `setPassthrough` already returns 0
   * and the band follows it there.
   */
  function maybeRaiseCameraOnPress(): void {
    if (
      !shouldRaiseCamera({
        shake: true,
        fingersDown: gestures.fingersOnPicture > 0,
        panelOpen: shell.isOpen(),
        cameraMode,
        live: cameraSource?.isLive() ?? false,
      })
    ) {
      return
    }
    void (async () => {
      const actual = await setPassthrough(PRESS_SHAKE_PASSTHROUGH)
      apply({ passthrough: actual }, { rampS: 0, source: 'camera' })
    })()
  }

  // ─── listeners ───────────────────────────────────────────────────────
  // Kept in one list so dispose() can remove every one — the "different UI
  // can tear the app down" guarantee, and what the probe counts.
  const unbind: Array<() => void> = []
  const on = <K extends keyof SessionEventMap>(
    target: Listenable,
    type: K,
    fn: (e: SessionEventMap[K]) => void,
  ): (() => void) => {
    target.addEventListener(type, fn as EventListener)
    const off = (): void => target.removeEventListener(type, fn as EventListener)
    unbind.push(off)
    return off
  }
  const isChip = (t: EventTarget | null): boolean => shell.ownsTarget(t)

  // One recogniser for every gesture on the picture — docs/todo.md entries
  // 41, 33, 48, 49, 50 and 57. Two separate listeners in two files used to agree only
  // because the screenshot band listened in the capture phase and called
  // stopPropagation() before hud.ts's own bubble-phase tap-to-open listener
  // ran. hud.ts no longer listens for that tap at all; this decides
  // tap-versus-hold-versus-drag once and dispatches by zone, so where a
  // gesture goes is a value read in one place rather than a race reasoned
  // about after the fact — and no path needs stopPropagation() any more.
  //
  // Entry 49 put every pointer behind engine/touches.ts's field rather than
  // this file's own scalars — `downX`/`downY`/`downZone`/`emitting` are gone,
  // replaced by whatever the field reports for each id. What follows is a
  // capacity change, not a behaviour one: a single finger reads the same
  // per-touch facts a scalar recorded before, and gets the same answer.
  //
  // The emitter used to be scoped to the top third only, and only past a
  // hold/drag threshold that separated it from a tap — entry 33's original
  // shape, reconciled against entry 41's three zones. Entry 50 overturns
  // both: with the panel now owning only the middle third, a threshold in
  // the other two zones was protecting nothing, and every zone answers a
  // contact immediately now — see dispatchGestures() in session/gestures.ts.
  //
  // Bound in start(), not at construction: they were bound after the gate
  // before, and the idle phase has its own two.
  const bindPointerListeners = (): void => {
    on(document, 'pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect()
      const [x, y] = toShaderUv(e.clientX, e.clientY, rect)
      // docs/todo.md entry 117 — a mouse gets its own map. Routed before the
      // contact reaches the field at all, because the two wrong outcomes are
      // both things the field would already have done by the time anything
      // downstream could veto them: a right click spawned an emitter and
      // counted toward the two-contact menu gesture, so right-then-left opened
      // the menu by accident, and middle click did the same.
      const action = pointerAction(e)
      if (action === 'ignore') return
      if (e.pointerType === 'mouse') gestures.mousePointers.add(e.pointerId)
      if (action === 'menu') {
        // A chip or the gate keeps the browser's own context menu — the
        // picture is the only surface this entry claims. `isChip` is the same
        // test the rest of this listener uses.
        // `canvas` is typed as the handful of methods this file calls rather
        // than as an `HTMLCanvasElement`, so the identity test needs the
        // cast — it is still the same reference comparison it always was.
        if (isChip(e.target) || (e.target as unknown) !== canvas) return
        // Right click while armed leaves the mode without taking a picture —
        // entry 72's "two fingers always means get me out of what I am in",
        // applied to the device that has a second button. Entry 87 locked the
        // menu out during the mode, which was right when the only exit was the
        // shot; a mode whose exits are a photo or a fifteen-second timeout is
        // one a right click should be able to leave.
        // `exitCameraMode` leaves without opening anything since entry 115
        // took its `panel.open()` out, so this is a plain disarm and the
        // `shell.open()` below is the right click's own doing.
        if (cameraMode) exitCameraMode()
        gestures.lastTap = null
        shell.open()
        return
      }
      // A chip button's own listener already stopPropagation()s its own
      // pointerup, which is enough in the ordinary case — but a release that
      // lands a pixel outside the button (a real touchscreen possibility) has
      // a different target, so that stopPropagation() never fires and this
      // recogniser would see the release regardless. Excluding by target on
      // the way in — docs/todo.md entry 42, written for the fullscreen chip
      // specifically once it moved into the panel-opening middle third — is
      // what closes that gap for every chip, not only that one.
      //
      // The zone argument is a fixed '' now that entry 52 has retired the
      // three screen thirds it used to carry — touches.ts's own field API is
      // untouched by that entry, so the parameter stays, carrying nothing.
      touchField.down(now(), e.pointerId, x, y, e.clientX, e.clientY, isChip(e.target), '')
    })
    on(document, 'pointermove', (e) => {
      const rect = canvas.getBoundingClientRect()
      const [x, y] = toShaderUv(e.clientX, e.clientY, rect)
      touchField.move(now(), e.pointerId, x, y, e.clientX, e.clientY)
      // docs/todo.md entry 112. A mouse only, over a `(hover: hover)` media
      // query: it is a per-event fact needing no query, a pen hovering is
      // deliberately excluded because it has its own press, and a tablet with
      // a mouse attached is a mouse and should work. The chip test is the same
      // one `pointerdown` uses — running the pointer over the HUD must not
      // spray rings underneath it — and it is applied per move rather than
      // stored, because a hover has no `down` to store it at.
      if (e.pointerType !== 'mouse') return
      if (isChip(e.target)) {
        hoverLeft(hover)
        return
      }
      moveHover(hover, now(), x, y)
    })
    // docs/todo.md entry 112 — the cursor leaving. `relatedTarget === null` is
    // what distinguishes leaving the *window* from merely crossing between two
    // elements inside it, which fires `pointerout` constantly and must not stop
    // anything. `blur` covers the case `pointerout` cannot see at all: a
    // window switched away from with the cursor still over it.
    on(document, 'pointerout', (e) => {
      if (e.pointerType === 'mouse' && e.relatedTarget === null) hoverLeft(hover)
    })
    on(window, 'blur', () => hoverLeft(hover))
    on(document, 'pointerup', (e) => {
      touchField.up(e.pointerId)
      gestures.mousePointers.delete(e.pointerId)
    })
    on(document, 'pointercancel', (e) => {
      touchField.cancel(e.pointerId)
      gestures.mousePointers.delete(e.pointerId)
    })
    // A lost capture (another element or the browser chrome stealing it
    // mid-drag) is not followed by pointerup or pointercancel on this target
    // — the same "handed between people" scenario entry 49's field is built
    // to survive.
    on(document, 'lostpointercapture', (e) => touchField.cancel(e.pointerId))
    // docs/todo.md entry 117 — the browser's own context menu must not open
    // over the picture, since a right click there is now the way into this
    // app's menu. Bound on the canvas rather than the document on purpose: a
    // right click on a `.hud-chip`, on the gate, or anywhere else keeps the
    // browser's menu, which is the escape hatch for anyone who needs it.
    on(canvas, 'contextmenu', (e) => e.preventDefault())

    on(window, 'resize', visualiser.resize)
    // iOS fires resize before the viewport has settled after a rotation, so the
    // first measurement is the old orientation's. Re-measure a beat later.
    on(window, 'orientationchange', () => {
      window.setTimeout(visualiser.resize, 250)
    })
  }

  // ─── idle ────────────────────────────────────────────────────────────

  /** False from `dispose()` onwards, and read by *both* loops. It lives up
   *  here rather than beside `frame()` because `pagehide` is bound at
   *  construction now, so a page put away while the gate is still showing
   *  disposes a session whose idle loop is the only one that has ever run.
   *  Without this the idle loop kept rescheduling itself — on a bfcache
   *  restore it resumes, indefinitely, rendering into a disposed
   *  visualiser. `idle.isStopped` does not cover it: that is the
   *  nobody-is-watching timer, not "this session is over". */
  let running = true

  // Capped well below the display's own rate, and stopped outright once nobody
  // is there to see it. The idle preview (build 63) put the visualiser behind
  // the gate so the screen would not be a poster for an absent piece — but it
  // also meant a gate left open now costs what running the app costs, on a
  // phone, indefinitely, which was a real change in idle power draw introduced
  // as a side effect and never paid for. The decision logic itself lives in
  // idle-preview.ts, and is probed there — see scripts/probe-idle.ts.
  const idle = new IdlePreview(idleStart, 1000 / 30, 60_000)

  // Any touch or pointer move brings the picture back. Stopping outright and
  // never resuming would leave a phone picked back up after a minute showing
  // one frozen frame — indistinguishable from a crash on a screen whose entire
  // point is that it is already alive.
  const resumeIdle = (): void => {
    if (live || !running) return
    const wasStopped = idle.isStopped
    idle.touch(performance.now())
    if (wasStopped) requestAnimationFrame(idleFrame)
  }
  const idleUnbind = [on(document, 'pointerdown', resumeIdle), on(document, 'pointermove', resumeIdle)]

  const idleFrame = (frameNow: number): void => {
    if (live || !running) return
    if (idle.tick(frameNow)) {
      const t = (frameNow - idleStart) / 1000
      // The tumble, and nothing else: no re-seed, no shuffle, at any
      // intensity. There is no audio yet and the idle programme is fixed, so
      // rerolling anything here would change what the person is about to
      // walk into for reasons they cannot connect to anything they did. A
      // double firing here used to need an explicit discard so it would not
      // also fire the instant the real loop started reading afterwards —
      // docs/todo.md entry 86 removes the need outright: `latestShake` is
      // just replaced wholesale next frame, by whichever loop calls
      // `shake.frame()` next, so there is nothing left over to discard.
      const dt = (frameNow - lastGateShakeAt) / 1000
      lastGateShakeAt = frameNow
      latestShake = shake.frame(dt)
      visualiser.setTumble(latestShake.tumble, prefs.gravity ? shake.gravity() : undefined)
      // docs/todo.md entry 102 — the same chip, the same gate, a second
      // consumer: a released touch emitter falls exactly when the picture
      // itself already leans toward down.
      visualiser.setGravity(prefs.gravity ? shake.gravity() : null)
      visualiser.render(idleParams(t, idleSpectrum), idleSpectrum)
    }
    // isStopped is read after tick(), which is what may have just set it —
    // this is the line that actually saves the battery: no further frame is
    // scheduled at all, not merely one that renders nothing.
    if (!idle.isStopped) requestAnimationFrame(idleFrame)
  }

  // ─── live ────────────────────────────────────────────────────────────

  let source: AudioSource | null = null

  /** Take the shot and leave the mode. The capture itself goes to the shell,
   *  which is what knows whether a PNG is something this page can hand
   *  anybody. */
  const shoot = (write: boolean): void => {
    if (write) {
      visualiser.requestCapture((blob) => {
        if (blob) shell.deliverCapture(blob)
      })
      shell.shutter()
    }
    exitCameraMode()
  }

  const frame = (): void => {
    if (!running || !source) return
    // Skip the audio read and the draw while hidden, but keep the loop alive:
    // rAF is throttled to a stop anyway, and this avoids integrating a huge dt
    // on the first frame back.
    if (document.visibilityState === 'visible') {
      const audio = source.frame()
      const params = mapping.update(audio)

      // Any disturbance tumbles the picture; a hard shake re-rolls the seed —
      // the same action the space bar already performs, so
      // shaking the phone is a third way in rather than a new behaviour.
      // Structure and flavour over minutes. Fed the fast tier's output as
      // well as the frame: transient, roughness and level are already computed
      // and tuned, and a second copy would be a second set of constants to
      // keep in step.
      const character = slow.update(audio, params)
      // docs/todo.md entry 90 — fed from the *previous* frame's sensor
      // snapshot (`latestShake` is not reassigned until below): one frame
      // of lag against a classifier whose own dwell is ten seconds and
      // whose level reading is an 8s mean is not worth reordering the
      // shake/tumble sequencing below to avoid.
      const posture = updatePosture(
        postureState,
        audio.dt,
        latestShake.disturb,
        latestShake.events.length > 0,
        params.bpm,
        params.beatConfidence,
      )
      // docs/todo.md entry 109 — ticked once per rendered frame while
      // armed, same lag against `latestShake` as posture above accepts for
      // the same reason. Only visible while `document.visibilityState` is
      // `'visible'` (this whole branch is skipped otherwise), which freezes
      // the countdown rather than expiring it while backgrounded — entry
      // 109 leaves that question open, so freezing is the conservative
      // reading rather than a considered answer to it.
      if (cameraMode) {
        const arm = updateCameraArm(
          cameraArmState,
          now(),
          posture.posture,
          latestShake.tilt.x,
          latestShake.tilt.y,
          // docs/todo.md entry 120 — read every frame, not captured at
          // arming: the first sample can land after the gate, and this hands
          // over to the posture path the moment data starts.
          shake.hasMotionData(),
        )
        if (!arm.armed) {
          cameraMode = false
          shell.cameraGlyph('fading')
        }
      }
      sinceCelestialSample += audio.dt
      if (sinceCelestialSample >= CELESTIAL_SAMPLE_S) {
        sinceCelestialSample = 0
        celestialSample = celestialFor(new Date(), geoLocationForDirector)
      }

      if (options.autopilot) {
        // docs/todo.md entry 81 — beatPhase/beatConfidence, both already on
        // params (entry 75), are what let the director hold a decision for
        // the next bar rather than firing the instant it becomes due.
        const next = director.update(
          character,
          audio.dt,
          {
            geoColour: prefs.geoColour,
            atmosphericView: prefs.atmosphericView,
          },
          params.beatPhase,
          params.beatConfidence,
          posture.posture,
          celestialSample,
        )
        if (next) apply(next, { rampS: COLOUR_RAMP_DIRECTOR_S, source: 'director' })
      }

      // docs/todo.md entry 126 — pushed before shake.frame() reads the
      // Tumble it feeds, same as a real devicemotion sample already would
      // have arrived by the time this frame calls frame(). `null` (space
      // not held, and any release tail fully decayed) pushes nothing, which
      // is the identity case: a `Tumble` that receives nothing behaves
      // exactly as it did before this entry.
      const synthSample = updateSynthShake(synthShake, audio.dt, spaceHeld)
      if (synthSample) shake.pushSample(synthSample, audio.dt)

      latestShake = shake.frame(audio.dt)
      visualiser.setTumble(latestShake.tumble, prefs.gravity ? shake.gravity() : undefined)
      // docs/todo.md entry 102 — the same chip, the same gate, a second
      // consumer: a released touch emitter falls exactly when the picture
      // itself already leans toward down.
      visualiser.setGravity(prefs.gravity ? shake.gravity() : null)
      // docs/todo.md entry 58 — posture and disturbance reaching the
      // picture's colour. Only the running loop, not the idle preview
      // above: that draws synthetic params and a preview colour rather
      // than anything the shuffle/director/HUD have actually stored, and
      // every Done-when here describes the running app.
      visualiser.setMotion(
        latestShake.tilt.x,
        latestShake.tilt.y,
        latestShake.disturb,
        latestShake.busyness,
      )
      // docs/todo.md entry 125 — the calm gate's own clock, ticked from the
      // `disturb` this file already samples every frame for the colour bias
      // and the RGB slip. No new sensor path and no second opinion about how
      // much the phone is moving, which is the drift entry 111 argued
      // against.
      noteDisturb(gestures, latestShake.disturb, now())
      dispatchGestures(gestures, now(), {
        field: touchField,
        hover,
        visualiser,
        shellOpen: shell.isOpen(),
        // The gate is the page's, and it is still up for a moment after
        // `start()`: permission-gate.ts fades `#gate` out over 600ms and
        // only then sets `hidden`. So this stays a live read of the page's
        // own answer — exactly what `!gate.hidden` was before this file
        // existed — rather than the constant `false` that "frame() never
        // runs before start()" would seem to license. Every session passes
        // through that window, and a contact landing in it belongs to the
        // gate, not to the picture.
        gateShowing: options.gateShowing(),
        fullscreenBlocking: fullscreenStatus().want && !document.fullscreenElement,
        canvas,
        camera: {
          get armed() {
            return cameraMode
          },
          arm: enterCameraMode,
          shoot,
        },
        openShell: shell.open,
      })
      // The discrete gesture stands down while the panel is open — a
      // shuffle rewrites the values someone currently has a finger on, the
      // same fault as a control lying about its state — but the tumble
      // above keeps running regardless, and the frame's own event is still
      // read below whether or not it ends up acting on anything: reading it
      // is not consuming it (docs/todo.md entry 86), but it is still only
      // ever this one frame's event, so there is nothing to leave set for
      // later either way. See docs/todo.md entry 20; reuses the same
      // `.hud-scrim` check the capture band above uses, rather than adding a
      // second notion of "the panel is up".
      const panelOpen = shell.isOpen()
      // `frame()` has already resolved double-vs-strong precedence — see its
      // own comment in shake.ts — so at most one of these ever applies.
      const event = latestShake.events[0]
      if (event?.kind === 'double') {
        const doublePeak = event.peak
        if (!panelOpen) {
          shell.shakeFeedback('double', doublePeak)
          // A double is always a full scramble, regardless of peak — see
          // shuffled()'s file comment: the deterministic route matters because
          // an accelerometer that clips low can never report a peak near
          // PEAK_CEILING, and would otherwise have no way to ask for everything.
          shuffle(1)
          maybeRollCamera(1)
          maybeRaiseCameraOnPress()
          // A shake is a manual gesture. The autopilot standing down is the same
          // courtesy every HUD control gets, and without it the director could
          // start walking the views back a moment later.
          director.suspend()
          doubleBuzz(doublePeak)
        }
      } else if (event?.kind === 'strong') {
        const strongPeak = event.peak
        if (!panelOpen) {
          shell.shakeFeedback('strong', strongPeak)
          // Graded: a colour shift at the gentlest qualifying shake, up to
          // everything at the hardest. shuffle() always rolls colours
          // regardless of depth, and re-seeds once SHUFFLE_RESEED is
          // reached — see its own comment.
          const depth = intensity(strongPeak)
          shuffle(depth)
          maybeRollCamera(depth)
          maybeRaiseCameraOnPress()
          // The buzz is what distinguishes "the phone heard me" from "the
          // image happened to wander". Android only — see haptics.ts.
          confirmBuzz(strongPeak)
        }
      }

      visualiser.render(params, audio.freq)
      shell.update(params, {
        ...visualiser.stats(),
        disturb: latestShake.disturb,
        ...shake.diagnostics(),
        // docs/todo.md entry 126 — this frame's own push, not `spaceHeld`:
        // the release tail keeps feeding samples for a moment after the key
        // comes up, and the readout should say so for exactly as long as it
        // is actually true.
        synthActive: synthSample !== null,
        // Reported whether or not autopilot is on, so the readout answers
        // "why has nothing changed" in both cases: off, or on and waiting.
        director: director.status(),
        // docs/todo.md entry 90 — five states that silently change the
        // director's cadence, with no way to see which is active, being
        // exactly the shape of every diagnosis problem this project has had.
        handling: posture,
        warm: character.warm,
        haptics: hapticStatus(),
        fullscreen: fullscreenStatus(),
        // docs/todo.md entry 65: the readout is the load-bearing half here,
        // not the CSS swap — this is the one word that turns "did the pulse
        // just not show up" from a guess into a fact.
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        // docs/todo.md entry 73 — same argument as fullscreen's want/armed
        // and shake.ts's own diagnostics(): a frozen camera and a working
        // one are identical when the room itself is still, so this has to
        // be told apart on purpose rather than left for a screenshot to
        // explain. Read fresh from cameraSource every tick, not cached,
        // since isLive() is itself continuously updated.
        camera: cameraSource ? { open: true, live: cameraSource.isLive() } : { open: false, live: false },
        // docs/todo.md entry 133 — the opening decode's own three numbers.
        decode: nameDecodeStatus(),
        // docs/todo.md entry 115 — CLAUDE.md's "two identical symptoms need
        // two different numbers", applied before the symptom appears. "The
        // camera doesn't arm" will otherwise be indistinguishable from "the
        // double tap isn't being recognised", and this feature has been
        // misdiagnosed from the outside twice already. `hold` is the longest
        // still contact currently on the glass, so a hold that is not
        // opening the menu can be told from one that is not being seen.
        arm: {
          armed: cameraMode,
          hold: gestures.longestStillHold,
          // docs/todo.md entry 125 — "the menu won't open" and "the double
          // tap wasn't recognised" are the same report from outside, and this
          // map has changed twice in two days.
          blocked: !gesturesCalm(gestures, now()),
          sinceDisturbed: Math.min(99, now() - gestures.lastDisturbedAt),
        },
        // docs/todo.md entry 137 — the whole look, live, as one copyable
        // string. Recomputed every visible frame like everything else on
        // this readout; a URLSearchParams-worth of string building is not
        // something a numeric debug overlay needs to worry about the cost of.
        dna: `${options.dnaBase}?${dnaQuery(prefs, seed)}`,
      })
    }
    requestAnimationFrame(frame)
  }

  const start: Session['start'] = (audio, motionGranted) => {
    // A `pagehide` can land while the gate is still up — it is bound at
    // construction, not after Start — so the session may already be over by
    // the time the start gesture's microphone promise resolves. Going live
    // then would reopen the sensor and start a loop against a disposed
    // visualiser, so this declines instead.
    if (!running) return
    source = audio
    live = true
    // docs/todo.md entry 60: undo whatever the gate rolled. `visualiser` is the
    // same instance the gate was just showing, and if it rolled a look, this is
    // the one place that look is thrown away — restoring exactly what `prefs`
    // (the stored values, `?rgb` included) says, before anything else can read
    // the visualiser's current state. Unconditional rather than gated on
    // `gateLook`, so this stays correct even if a future change adds another
    // path that mutates the gate's visualiser before Start.
    visualiser.setGeometricView(prefs.geometricView)
    visualiser.setAtmosphericView(prefs.atmosphericView)
    visualiser.setLayerColour('geo', prefs.geoColour, 0)
    visualiser.setLayerColour('atm', prefs.atmColour, 0)
    visualiser.setMergeMode('geo', prefs.mergeMode)
    visualiser.setMergeMode('atm', prefs.atmMergeMode)
    // The idle loop is done for the session; its own listeners are now dead
    // weight on every pointer event for as long as the tab stays open.
    for (const off of idleUnbind.splice(0)) {
      off()
      const at = unbind.indexOf(off)
      if (at >= 0) unbind.splice(at, 1)
    }

    // Replaces the gate's stub on iOS/iPadOS with a real sensor once the start
    // gesture's own motion result is in; everywhere else `shake` already is
    // the real thing and has been running since load, so this is a no-op.
    if (hasMotionPermissionGate()) shake = startShake(motionGranted)

    bindPointerListeners()
    requestAnimationFrame(frame)
  }

  const dispose = (): void => {
    running = false
    for (const u of unbind.splice(0)) u()
    visualiser.dispose()
    shake.close()
    source?.close()
    // Release the camera on the way out like every other capture here. A
    // backgrounded tab holding an open video track keeps the sensor awake and
    // the indicator lit with nothing on screen to explain it.
    cameraSource?.close()
  }

  on(window, 'pagehide', dispose)

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
      // docs/todo.md entry 126 — `visualiser.randomise()` used to be called
      // directly from the key binding; it is now reached *through* the
      // shake, same as a real one, because a held space bar re-seeds by
      // shaking hard enough for long enough, exactly like a hand would.
      // Starting the gesture rolls a fresh bearing (see synth-shake.ts) so a
      // second tap does not inherit the first's fading direction.
      if (held && !spaceHeld) startSynthShake(synthShake)
      spaceHeld = held
    },
    motion: () => latestShake,
    dispose,
  }
}