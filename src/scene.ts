/**
 * Three.js setup for two composited fullscreen fragment shaders.
 *
 * There is no scene graph worth the name here — one quad, reused for three
 * passes. Three is carrying the WebGL state management, resize handling and
 * context-loss plumbing, not a 3D scene.
 *
 * The two layers — geometric and atmospheric — are picked independently and
 * composited, not switched between. Each renders to its own off-screen
 * target; a third pass samples both and blends them per the chosen merge
 * mode and mix, straight to the canvas. Reusing a single mesh across all
 * three passes (swap the material, swap the render target, render again)
 * avoids maintaining three parallel scenes for what is structurally the same
 * fullscreen-quad draw each time.
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  VideoTexture,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'

import type { CameraSource } from './camera'
import { type GeoColour } from './geo-colour'
import { MERGE_MODES, type MergeModeName } from './merge-modes'
import type { VisualParams } from './engine'
import {
  createEmitterState,
  createMotionBiasState,
  createRgbSlipState,
  createOriginState,
  resetOrigin,
  setAnchor,
  pickEmitter,
  pickNode,
  chorusNodeOffsets,
  createRippleState,
  createTouchStreamState,
  Envelope,
  HOVER_CHARGE_CAP,
  MAX_RIPPLES,
  updateEmitter,
  updateMotionBias,
  updateOrigin,
  updateRgbSlip,
  updateRipples,
  updateTouchStream,
  type EmitterState,
  type MotionBias,
} from './engine'
import { MAX_OFFSET, overscanFor, type TumbleState } from './shake'
import { skyFor, skyForLocation } from './sky'
import { moonFor, moonForLocation, type Moon } from './moon'
import { requestLocation, type GeoLocation } from './geo-location'
import { requestAmbientLight, luminanceFromLux, type AmbientLight } from './ambient-light'
import compositeFrag from './shaders/composite.frag.glsl?raw'
import vertexShader from './shaders/fullscreen.vert.glsl?raw'
import {
  ATMOSPHERIC_VIEWS,
  GEOMETRIC_VIEWS,
  type AtmosphericViewName,
  type GeometricViewName,
} from './views'

/** Texels in the instantaneous spectrum texture. 128 reads smoothly. */
const SPECTRUM_SIZE = 128

/** How often the clock is sampled — docs/todo.md entry 53. "Over a minute
 *  the change is invisible... sampling once a second is ample; per-frame
 *  would be waste." */
const SKY_SAMPLE_S = 1
/** How fast the displayed `skyDaylight` chases a fresh sample, in full
 *  0-1 scale per second — docs/todo.md entry 71. This entry's own finding
 *  overturns what this file used to say here: ordinary clock movement
 *  really does ease smoothly on its own (smoothstep, once a second), but
 *  a DST jump, a timezone change in flight, or a tab resumed hours later
 *  is not ordinary movement — `skyFor()` returns whatever the new instant
 *  says, and assigning that directly landed as a one-frame step nothing
 *  downstream could smooth. `1 / 3`, **Mine**: full-scale in about 3
 *  seconds, fast enough that a real dawn (which moves far slower than
 *  this rate could ever expose) is never limited by it, slow enough that
 *  even the largest possible jump (0 to 1) reads as a fade, not a snap. */
const SKY_CHASE_RATE = 1 / 3

/**
 * docs/todo.md entry 96 — how far a full moon, high in the sky, can push
 * ripple reach and ripple/emitter lifespan away from today's constants.
 * Both swings share one input, `moonAbundanceFor()` below, rather than
 * reading `illuminated` and `presence` independently: "the toy only feels
 * the moon when the moon is actually up" means a brilliantly lit moon
 * still below the horizon must contribute nothing, and a product is what
 * makes either factor at 0 zero the whole thing out, the same
 * algebraic-identity shape entries 47, 75 and 76 all use elsewhere in this
 * file. Decided's own figures ("roughly ±25% on reach and life"); **Mine**
 * as to sharing one swing between the two rather than tuning them apart,
 * since Decided names them together throughout.
 */
const MOON_REACH_SWING = 0.25
const MOON_LIFE_SWING = 0.25

function moonAbundanceFor(moon: Moon): number {
  return moon.illuminated * moon.presence
}

/**
 * docs/todo.md entry 106 — the moon's third quality, this one riding the
 * opacity envelope (`FADE_FROM`) rather than the growth curve entry 96's
 * own refusal already ruled out. `moon.waxing` is signed and, by
 * construction, exactly 0 at both new and full moon (it is literally the
 * illumination fraction's own derivative); multiplying by `presence` keeps
 * the same "not up, contributes nothing" guarantee `moonAbundanceFor` has.
 * The two are in quadrature — abundance peaks at full and is 0 at new;
 * bloom is 0 at both new and full and peaks (in opposite signs) at the two
 * quarters — so they never move together. `BLOOM_SWING = 0.18` takes
 * `FADE_FROM` (0.6) to 0.78 at full waxing and 0.42 at full waning, per
 * Decided's own worked figures; Decided marks the constant itself
 * **Mine**, on the same footing as `MOON_REACH_SWING`/`MOON_LIFE_SWING`.
 */
const BLOOM_SWING = 0.18

function moonBloomFor(moon: Moon): number {
  return moon.waxing * moon.presence
}

/**
 * Rolling spectrogram uploaded to the GPU: one column per time slot, one row
 * per log-spaced frequency band.
 *
 * This is the answer to "can the GPU process the sound". It cannot usefully do
 * the FFT — the browser's AnalyserNode already does that in native code, and
 * moving it to a fragment shader would be slower and far more complex. What the
 * GPU can do that the CPU cannot is hold the *history* and read all of it, for
 * every pixel, every frame. 256x64 texels is 16 KB; sampling it costs one
 * texture fetch. Reconstructing the same thing on the CPU per pixel is not
 * remotely possible.
 *
 * 256 columns at HISTORY_HZ gives ~8.5 seconds — long enough to see a phrase.
 */
const HISTORY_W = 256
const HISTORY_H = 64
const HISTORY_HZ = 30

/**
 * Pixel-ratio ladder for the adaptive resolution scaler.
 *
 * The atmospheric shader is fill-rate bound on its own — three fbm lookups
 * per pixel, four octaves each — and compositing now costs two more full
 * passes on top of it (the geometric layer, then the blend). Resolution is
 * therefore the dominant performance lever by an even wider margin than
 * before, and the right value is still not knowable in advance. Measuring and
 * settling wherever the device can hold frame rate remains cheaper than
 * guessing a lower constant and giving up sharpness that some hardware never
 * needed to.
 */
const RATIO_LADDER = [1.0, 1.25, 1.5, 1.75, 2.0]

/** Step down above this frame time (~53fps), up below that one (~72fps). */
const SLOW_MS = 18.5
const FAST_MS = 13.8
/** Seconds to hold a new rung before considering another change. */
const SETTLE = 1.5

/** Novelty level a structural boundary must cross, rising, to auto-reroll the seed. */
const STRUCTURE_THRESHOLD = 0.5
/** Minimum seconds between automatic reshapes, so a boundary's own decay tail can't retrigger it. */
const STRUCTURE_COOLDOWN = 8

/** docs/todo.md entry 146 — Chorus's own node-count ceiling (3 to 7, from
 *  `chorusNodeOffsets`) plus one, matching `chorus.frag.glsl`'s own uniform
 *  array size. */
const CHORUS_NODE_SLOTS = 8

/**
 * docs/todo.md entry 92 — a colour travels from where it was to where it's
 * going at a fixed rate, rather than an exponential decay (`Envelope`'s own
 * shape, used a few hundred lines below for exposure): "about two seconds"
 * has to be a duration a change actually takes, the same reasoning
 * `SKY_CHASE_RATE`'s own `skyDaylight` chase already uses for a sky reading
 * that jumps — an exponential asymptotically approaches its target
 * without quite reaching it, which would leave a settled frame never
 * *quite* pixel-identical to what it is settling toward. `duration` lives on
 * the ramp itself, set fresh by whichever call started it, since a HUD drag,
 * a shake and the director all want a different duration from the exact
 * same starting state — Lands-in gives main.ts, not this file, the actual
 * per-source numbers.
 */
interface ColourRamp {
  from: GeoColour
  target: GeoColour
  elapsed: number
  duration: number
}

/** (Re)point a ramp at a new target, starting from wherever it currently
 *  sits — never from its old start — so a change that arrives mid-ramp
 *  continues smoothly rather than jumping back. `duration` of 0 or less
 *  means "immediate": the very next `stepColourRamp` call lands exactly on
 *  `target`, which is what a HUD drag needs. */
function startColourRamp(ramp: ColourRamp, current: GeoColour, target: GeoColour, duration: number): void {
  ramp.from = current
  ramp.target = target
  ramp.elapsed = 0
  ramp.duration = duration
}

function stepColourRamp(ramp: ColourRamp, dt: number): GeoColour {
  ramp.elapsed += dt
  const t = ramp.duration <= 0 ? 1 : Math.min(1, ramp.elapsed / ramp.duration)
  return {
    r: ramp.from.r + (ramp.target.r - ramp.from.r) * t,
    g: ramp.from.g + (ramp.target.g - ramp.from.g) * t,
    b: ramp.from.b + (ramp.target.b - ramp.from.b) * t,
  }
}

/** docs/todo.md entry 92 — how long a view swap's dip takes, each way (fade
 *  out, then the same again fading back in once the material underneath has
 *  changed). Victor's own approximate figure from Decided; **Mine** as to
 *  applying it symmetrically. */
const VIEW_DIP_S = 0.35

/**
 * docs/todo.md entry 92 — a view swap fades the layer to nothing, swaps the
 * material while nobody can see it, then fades back in, since two different
 * shader programmes have no shared parameterisation to interpolate between.
 * `multiplier` is what render() multiplies onto that layer's own
 * (user-set) alpha every frame; 1 outside a dip.
 *
 * `queuedSwap` exists for exactly one reason: **the two layers must never
 * dip at the same time**, or the frame actually empties rather than merely
 * thinning (Decided's own words). A shake-triggered reroll can ask for a
 * new geometric *and* atmospheric view in the same instant; if the other
 * layer is already mid-dip when this one is asked to start, the swap is
 * queued rather than started, and begins the moment the other layer
 * returns to idle — see `tickViewDips()`.
 */
interface ViewDip {
  multiplier: number
  phase: 'idle' | 'out' | 'in'
  elapsed: number
  swap: (() => void) | null
  queuedSwap: (() => void) | null
}

function createViewDip(): ViewDip {
  return { multiplier: 1, phase: 'idle', elapsed: 0, swap: null, queuedSwap: null }
}

/** Start a dip on `dip`, unless `other` is currently mid-dip, in which case
 *  this swap is queued instead — see `ViewDip`'s own comment. A dip already
 *  in flight on `dip` itself is simply redirected to the new swap: the same
 *  "last request wins" rule the pre-entry-92 immediate swap always had. */
function startViewDip(dip: ViewDip, other: ViewDip, swap: () => void): void {
  if (other.phase !== 'idle') {
    dip.queuedSwap = swap
    return
  }
  dip.swap = swap
  dip.phase = 'out'
  dip.elapsed = 0
}

function tickViewDips(geo: ViewDip, atm: ViewDip, dt: number): void {
  for (const dip of [geo, atm]) {
    if (dip.phase === 'idle') continue
    dip.elapsed += dt
    if (dip.phase === 'out') {
      dip.multiplier = Math.max(0, 1 - dip.elapsed / VIEW_DIP_S)
      if (dip.elapsed >= VIEW_DIP_S) {
        dip.swap?.()
        dip.swap = null
        dip.phase = 'in'
        dip.elapsed = 0
        dip.multiplier = 0
      }
    } else {
      dip.multiplier = Math.min(1, dip.elapsed / VIEW_DIP_S)
      if (dip.elapsed >= VIEW_DIP_S) {
        dip.phase = 'idle'
        dip.multiplier = 1
      }
    }
  }
  // A layer that just returned to idle releases whatever the *other* layer
  // had queued against it.
  if (geo.phase === 'idle' && atm.queuedSwap) {
    const swap = atm.queuedSwap
    atm.queuedSwap = null
    atm.swap = swap
    atm.phase = 'out'
    atm.elapsed = 0
  }
  if (atm.phase === 'idle' && geo.queuedSwap) {
    const swap = geo.queuedSwap
    geo.queuedSwap = null
    geo.swap = swap
    geo.phase = 'out'
    geo.elapsed = 0
  }
}

export interface VisualiserOptions {
  geometricView: GeometricViewName
  geoColour: GeoColour
  atmColour: GeoColour
  camColour: GeoColour
  atmosphericView: AtmosphericViewName
  /** The geometric layer's own blend, over the atmosphere. */
  mergeMode: MergeModeName
  /** The atmospheric layer's own blend, over the camera. */
  atmMergeMode: MergeModeName
  /** 0-1. The geometric layer's opacity: 0 is pure atmosphere, 1 the full
   *  blend. This is what `mix` used to be, under a name that says what it
   *  actually does now that the atmosphere has one of its own. */
  geoAlpha: number
  /** 0-1. The atmospheric layer's opacity, applied before the merge mode. */
  atmAlpha: number
  /** docs/todo.md entry 137 — the four numbers `uSeed` opens on. Computed by
   *  the caller (`?seed=`, falling back to `releaseSeed()`) rather than here,
   *  so this file stays agnostic about where a seed comes from, the same way
   *  it already is about which view or colour it is handed. Only read at
   *  construction (below); a later re-roll (`randomise()`, the structural
   *  boundary) still reaches for `Math.random()` and is untouched by this. */
  seed: readonly [number, number, number, number]
}

export interface Visualiser {
  render(params: VisualParams, spectrum: Uint8Array): void
  resize(): void
  dispose(): void
  /** Swap the geometric layer's programme. Recompiles a shader; not a per-frame call. */
  setGeometricView(name: GeometricViewName): void
  /** Swap the atmospheric layer's programme. Recompiles a shader; not a per-frame call. */
  setAtmosphericView(name: AtmosphericViewName): void
  /** Set a layer's own blend, over what's beneath it: geo over atmosphere,
   *  atm over the camera. Mirrors `setLayerColour`'s per-layer shape. */
  setMergeMode(layer: 'geo' | 'atm', mode: MergeModeName): void
  /** Recolour a layer. Cheap: a uniform, not a recompile. `rampS` is how
   *  many seconds the colour takes to travel from where it is now to
   *  `colour` — required rather than defaulted (docs/todo.md entry 92,
   *  the same "no silently-safe default" reasoning entry 90 already
   *  applied to `Director.update()`'s `posture` parameter): 0 or a
   *  default of instant would silently apply everywhere and defeat the
   *  entry for the one caller (the director) that actually wants a ramp. */
  setLayerColour(layer: 'geo' | 'atm' | 'cam', colour: GeoColour, rampS: number): void
  /**
   * The phone's own orientation and handling — docs/todo.md entry 58.
   * `tiltX`/`tiltY` are `shake.ts`'s uncapped `tilt()` pair; `disturb` is
   * `TumbleState.disturb`. Only recorded here; `render()` is what ticks it
   * into a small continuous bias on `geoColour`/`atmColour` once per frame,
   * on top of whatever `setLayerColour()` last stored — never written back
   * into it.
   *
   * The `hasMotion` argument entry 110 added here went with Strata
   * (docs/todo.md entry 131): nothing in this file read it once the view was
   * gone, and leaving a parameter every caller must pass and nobody reads is
   * the dead weight that entry was clearing. `shake.ts` still exposes
   * `hasMotionData()` — entry 120's camera arm is its reader, and reads it
   * directly in `main.ts` rather than through here.
   */
  setMotion(tiltX: number, tiltY: number, disturb: number, busyness?: number): void
  /**
   * docs/todo.md entry 102 — a released touch emitter's own acceleration.
   * `g`, when given, is `shake.gravity()` (the same capped, in-plane pair
   * `setTumble`'s own `gravity` parameter already is); `null` or omitted —
   * the `grav` chip off, or nothing to report — means every released
   * emitter simply never accelerates, which is what leaves every gesture
   * byte-identical to before this entry while the chip is off. Only
   * recorded here; `render()`'s own emitter loop is what actually spends
   * it, once per frame, on whichever emitters are currently falling.
   */
  setGravity(g: { x: number; y: number } | null): void
  /**
   * How far the device has been knocked about. See shake.ts.
   *
   * `gravity`, when given, is a steady offset from how the phone is being
   * held rather than from its motion — docs/todo.md entry 30 — in the same
   * uv units as `t.offsetX`/`t.offsetY`. Summed with the spring's own offset
   * and clamped to the same MAX_OFFSET the spring already respects, here
   * rather than in the caller, so there is exactly one place that cap is
   * enforced against the combined value.
   */
  setTumble(t: TumbleState, gravity?: { x: number; y: number }): void
  /**
   * Every touch main.ts's pointer recogniser currently believes should be
   * emitting — docs/todo.md entries 33, 49, 50 and 57. `x`/`y` are in the
   * same normalised space every geometric shader's own `uv` already lives
   * in: `(gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x,
   * uResolution.y)`, centred on the frame. `speed` is the same drag
   * velocity (uv units/second) `engine/touch.ts` reads for the atmospheric
   * views, 0 for a still contact — entry 50's "a fling throws further".
   *
   * `contactId` is not the touch field's own pointer id: main.ts mints a
   * fresh one on every qualifying `down`, so a finger that taps, lifts and
   * taps again is two contacts rather than one pointer id reused, and gets
   * two independent emitters rather than one restarted (entry 57). Only
   * recorded here; `render()` is what ticks each one into its own emitter
   * slot once per frame, up to eight at once. A contact absent from one
   * call that was present in the last is simply not emitting any more —
   * its slot's emitter keeps its own last position through its afterlife
   * regardless.
   */
  setTouches(touches: ReadonlyArray<{ contactId: number; x: number; y: number; speed: number }>): void
  /**
   * docs/todo.md entry 141 — a contact currently holding the centre-anchored
   * emitter (Circles, Shards, Grid, Rose only — Chorus's several nodes are
   * `hitTestChorusNode`/`setChorusNodeDrag` below, entry 146's own separate
   * pair, since one node among several needs an index and the other four
   * views never have more than one thing to pick up). `pos` while held is
   * the live fingertip in the same
   * shader-uv space `setTouches` takes — `uOrigin` becomes exactly this,
   * every frame, no spring; `null` ends the drag and anchors the spring (or,
   * with `grav` off, the picture itself) at wherever `pos` last was, via
   * `origin.ts`'s `setAnchor`. Main.ts calls this at most once per frame,
   * for whichever single contact (if any) claimed the emitter on its own
   * `down` — the claim, not the drag, is what is exclusive.
   */
  setEmitterDrag(pos: { x: number; y: number } | null): void
  /**
   * docs/todo.md entry 141 — is `(x, y)` (the same shader-uv `setTouches`
   * takes) within `radiusUv` of the centre-anchored emitter right now?
   * `origin.ts`'s own `pickEmitter` against the current `anchorX`/`anchorY`
   * — a query rather than exposing the anchor's own coordinates, since
   * nothing outside this file has ever needed to read scene state before
   * writing to it and this entry is not the place to start.
   */
  hitTestEmitter(x: number, y: number, radiusUv: number): boolean
  /**
   * docs/todo.md entry 146 — same query as `hitTestEmitter`, for Chorus's
   * several nodes instead of the other four views' one. Returns `null`
   * immediately when Chorus is not the mounted geometric view (nothing to
   * pick up) or when nothing is within `radiusUv`; otherwise the index of
   * the *nearest* node, matching `origin.ts`'s own `pickNode`. The index is
   * what `setChorusNodeDrag` below takes, since a shared `Map` needs a key
   * and "the fingertip position" is not stable enough to be one across a
   * multi-touch drag.
   */
  hitTestChorusNode(x: number, y: number, radiusUv: number): number | null
  /**
   * docs/todo.md entry 146 — the several-node equivalent of `setEmitterDrag`.
   * `pos` while held is the live fingertip, no spring, no lag, exactly the
   * same Decided entry 141 already established; `null` ends that one node's
   * drag and folds its live position back into `chorusNodes` as a fresh
   * offset from the current anchor, via the same arithmetic `setEmitterDrag`
   * uses for the single anchor. Keyed by node index so more than one node
   * can be held across a multi-touch gesture without one release clobbering
   * another node still in flight.
   */
  setChorusNodeDrag(index: number, pos: { x: number; y: number } | null): void
  /**
   * A mouse cursor over the picture — docs/todo.md entry 112. `x`/`y` are
   * the same shader-uv pair `setTouches` takes; `speed` is the same smoothed
   * uv/second. `present` is `hover.ts`'s own verdict on whether the cursor
   * is being *played with* — in the window and moved recently — not merely
   * whether it exists, so it goes false both when the pointer leaves and
   * when it has been parked for `HOVER_QUIET`.
   *
   * Deliberately not routed through `setTouches`: a hover has no end, and a
   * cursor resting on the glass entered as a contact would hold
   * `touchAnyDown` true for ever and park main.ts's own tap recogniser
   * mid-gesture. Nothing here draws a touch ring for it either — the OS is
   * already drawing a cursor there, and the emitter's rings are the
   * response.
   *
   * `presence` is docs/todo.md entry 114's eased 0-1 — `present` smoothed
   * over a quarter second, which is what `lattice.frag.glsl` multiplies its
   * lens by so an arriving cursor bends the picture over a moment rather
   * than on one frame. Defaulted to 0, so a caller that does not know about
   * it cannot accidentally warp anything.
   *
   * A device with no mouse never calls this, and the hover emitter then sits
   * inactive at zero life for the whole session, spawning nothing. The
   * lattice is bit-identical there too: presence 0 makes the lens term
   * exactly zero, and every other programme ignores the uniform.
   */
  setHover(x: number, y: number, present: boolean, speed: number, presence?: number): void
  /**
   * What the picture as a whole should feel from every finger on it right
   * now — docs/todo.md entry 48, and independent of `setTouches()` above:
   * this reaches the seven atmospheric views, which have no notion of a
   * location, so unlike the emitter there is no per-touch position here,
   * only the aggregate `main.ts`'s `dispatchTouches()` already computes.
   * `began` is whether a qualifying contact started this exact frame (the
   * capture band and any `.hud-chip` contact already excluded by the
   * caller); `anyDown` and `maxSpeed` are the same exclusion applied to
   * every touch currently down. Only recorded here; `render()` is what
   * ticks it into the decay envelope once per frame.
   */
  setTouchStream(began: boolean, anyDown: boolean, maxSpeed: number): void
  /** 0-1, the geometric layer's opacity. Formerly setMix. */
  setGeoAlpha(a: number): void
  /** 0-1, the atmospheric layer's opacity. */
  setAtmAlpha(a: number): void
  /**
   * Attach or detach the passthrough camera, and set how much of it shows.
   *
   * `source` null detaches and frees the texture. Passing a source with mix 0
   * is legal and means "attached but invisible" — which is what the HUD does
   * while dragging back to zero, so that letting go at 0 and then dragging up
   * again does not re-prompt for the camera.
   */
  setPassthrough(source: CameraSource | null, mix: number): void
  /** Re-roll the seed each view spends on whatever it doesn't get from audio. */
  randomise(): void
  /** Smoothed frame time in ms, and the pixel ratio currently in use. */
  stats(): {
    frameMs: number
    pixelRatio: number
    /** docs/todo.md entry 58 — posture, disturbance and agitation, for the
     *  numeric readout. Without these, "is this doing anything" is
     *  unanswerable for a feature whose whole design brief is slight. */
    motion: { posture: number; disturbance: number; agitation: number }
    /** docs/todo.md entry 53 — the clock's own current pair, and whether
     *  the outdoor-reading override is currently pinning it. Testable
     *  without waiting for dusk: the readout prints what the clock says
     *  right now, over the pair `sky.ts` is a pure function of.
     *  `located` — docs/todo.md entry 97 — is whether that pair came from
     *  a real granted coordinate (`skyForLocation`) or the clock-only
     *  fallback (`skyFor`), so the readout can say which one is live. */
    sky: { daylight: number; warmth: number; located: boolean }
    /** docs/todo.md entry 96 — the moon's own current fields, over the
     *  same "testable without waiting" reasoning as sky above: what night
     *  the app thinks it is, without waiting a month to check the math. */
    moon: { illuminated: number; waxing: number; presence: number }
    /** docs/todo.md entry 98 — the ambient light sensor's own reading and
     *  the exposure it currently produces. `available` is false on every
     *  iOS session and on any Android session that refused or has no
     *  sensor (Decided's own "on iOS the ambient line honestly reads
     *  unavailable"); `lux` is `null` whenever `available` is false, or
     *  briefly while `available` is true but no reading has arrived yet.
     *  `exposure` is `uExposure`'s own current value regardless of source
     *  (camera, sensor, or neither), so the readout always shows what the
     *  picture is actually doing. */
    ambient: { available: boolean; lux: number | null; exposure: number }
  }
  /**
   * Save the next composited frame as a PNG blob, once. `onReady` runs after
   * the frame after this call renders — capture happens inside the render
   * loop, right after the canvas is painted, not synchronously here: this
   * renderer is built without `preserveDrawingBuffer` (a cost paid on every
   * frame forever to serve a tap that happens twice a session), so the
   * buffer is undefined the instant `render()` returns and a `toBlob()` from
   * outside the loop reads back nothing. `onReady(null)` if the blob could
   * not be produced.
   */
  requestCapture(onReady: (blob: Blob | null) => void): void
}

export function createVisualiser(
  canvas: HTMLCanvasElement,
  options: VisualiserOptions,
): Visualiser {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false, // pointless for a full-screen noise field, and not cheap
    alpha: false,
    powerPreference: 'high-performance',
  })

  // Start at the top of the ladder the device actually supports and let the
  // scaler walk down if it cannot hold the frame rate.
  let rung = RATIO_LADDER.length - 1
  while (rung > 0 && RATIO_LADDER[rung] > window.devicePixelRatio) rung--

  const scene = new Scene()
  // Geometry is authored directly in clip space; the camera exists only because
  // WebGLRenderer.render() demands one.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const spectrumData = new Uint8Array(SPECTRUM_SIZE)
  const spectrumTexture = new DataTexture(
    spectrumData,
    SPECTRUM_SIZE,
    1,
    RedFormat,
    UnsignedByteType,
  )
  spectrumTexture.minFilter = LinearFilter
  spectrumTexture.magFilter = LinearFilter
  spectrumTexture.wrapS = ClampToEdgeWrapping
  spectrumTexture.wrapT = ClampToEdgeWrapping
  spectrumTexture.needsUpdate = true

  // Log-spaced bin ranges for the history rows, precomputed once. Linear rows
  // would spend most of the texture on the top two octaves, where music has
  // least going on.
  const historyBins: Array<[number, number]> = []
  {
    const maxBin = SPECTRUM_SIZE
    for (let r = 0; r < HISTORY_H; r++) {
      const f0 = Math.pow(maxBin, r / HISTORY_H)
      const f1 = Math.pow(maxBin, (r + 1) / HISTORY_H)
      historyBins.push([Math.floor(f0), Math.max(Math.floor(f0) + 1, Math.ceil(f1))])
    }
  }

  const historyData = new Uint8Array(HISTORY_W * HISTORY_H)
  const historyTexture = new DataTexture(
    historyData,
    HISTORY_W,
    HISTORY_H,
    RedFormat,
    UnsignedByteType,
  )
  historyTexture.minFilter = LinearFilter
  historyTexture.magFilter = LinearFilter
  historyTexture.wrapS = RepeatWrapping // time wraps: it is a ring buffer
  historyTexture.wrapT = ClampToEdgeWrapping
  historyTexture.needsUpdate = true


  // docs/todo.md entry 96 — read once, at construction, for the same
  // reason skyForNow below is: the first frame should match the moon it
  // is actually loaded under, not default to new-moon-equivalent for a
  // second before the first sample corrects it.
  const moonForNow = moonFor(new Date())

  // Shared by both layers: audio state neither cares where it came from, and
  // sharing the object (rather than duplicating it per layer) is what lets a
  // layer swap pick up the current frame's state immediately instead of a
  // frame of zeros.
  const uniforms = {
    uResolution: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uFlow: { value: 0 },
    uLevel: { value: 0 },
    uLow: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uTransient: { value: 0 },
    uTilt: { value: 0.5 },
    uBreak: { value: 0 },
    uSurge: { value: 0 },
    uNovelty: { value: 0 },
    uRoughness: { value: 0.5 },
    // docs/todo.md entry 75. At uBeatConfidence == 0 every view must render
    // exactly as it does today — the same algebraic-identity discipline
    // entry 47 used for uDay — so uBeat defaults to 0 (silent) rather than
    // to a phase that would draw something the moment a shader reads it.
    uBeat: { value: 0 },
    uBpm: { value: 0 },
    uBeatConfidence: { value: 0 },
    uSpectrum: { value: spectrumTexture },
    uHistory: { value: historyTexture },
    // docs/todo.md entry 110. rgb is a grain's colour and alpha is whether
    // there is a grain there at all; the grid dimensions come along so the
    // shader can work in cell space, which GLSL1 gives it no way to ask a
    // sampler for.
    // docs/todo.md entry 114 — the mouse cursor, xy in the shaders' own uv
    // space and z the eased presence. Only `lattice.frag.glsl` reads it. It
    // sits in this shared object because that is where every uniform both
    // layers can see lives, and because this is the first pointer that has
    // ever reached the atmospheric layer at all — deliberately not offered
    // to the other twelve programmes, which is a second tenant's decision to
    // make and not this one's.
    uPointer: { value: new Vector3(0, 0, 0) },
    // docs/todo.md entry 132 — where the geometric layer's audio-born
    // geometry is measured from. Shared by both layers like every other
    // uniform here; only the seven geometric programmes read it, and only
    // for their audio-born origins — touch-born ones carry their own in
    // uRipples[i].zw and are deliberately unaffected.
    uOrigin: { value: new Vector2(0, 0) },
    // Where "now" sits in the ring buffer, 0-1. The shader walks backwards from
    // here to read into the past.
    uHistoryHead: { value: 0 },
    // Four free numbers, re-rolled on demand — the space bar on a machine
    // with a keyboard, a shake on a device with an accelerometer. (This said
    // "space bar, double-tap, double click" until docs/todo.md entry 117
    // checked: the double tap has opened the menu since entry 103 and now
    // arms the camera, and no double-click handler has ever existed.) Audio
    // drives everything else here; this is the one thing a
    // person gets to reach in and change directly. Each view is free to spend
    // its four components however suits its own look — scene.ts hands them
    // out and stays agnostic, same as with the fragment shader itself.
    // docs/todo.md entry 137 — the caller's own seed (from `?seed=` or
    // `releaseSeed()`), not Math.random(): this is the one call site of the
    // three that fires exactly once, at construction, which is what makes it
    // "where a session opens" rather than "a rail it runs on" — the other
    // two (the structural boundary below, and randomise()) are re-rolls and
    // keep Math.random() deliberately.
    uSeed: { value: new Vector4(...options.seed) },
    // (birthTime, birthLevel, x, y) per active ring — widened from vec2 for
    // docs/todo.md entry 33's touch emitter, which needs somewhere to carry
    // *where* it was born. Only the geometric layer's event-driven views
    // read this; see ripples.ts. x/y are unused (and unwritten) for the
    // audio-born slots; every view's own origin logic reaches for them only
    // in the reserved touch range.
    uRipples: {
      value: Array.from({ length: MAX_RIPPLES }, () => new Vector4(-1000, 0, 0, 0)),
    },
    // docs/todo.md entry 146 — Chorus's own several emitters, as offsets from
    // uOrigin, uploaded from here instead of computed from uSeed inside
    // chorus.frag.glsl: one source for the arrangement is what lets a drag's
    // own hit-test and the picture it moves agree on where a node actually
    // is. Eight slots — the shader's own `nodes <= 7` ceiling plus one —
    // `uNodeCount` says how many are real; the rest are never read.
    uNodes: {
      value: Array.from({ length: CHORUS_NODE_SLOTS }, () => new Vector2(0, 0)),
    },
    uNodeCount: { value: 0 },
    // docs/todo.md entry 96 — the moon's own abundance, as a reach and a
    // lifespan multiplier on every ripple-drawing geometric view. Both
    // default to 1.0 (today's constants, unmoved) and only ever move
    // together with `moonAbundanceFor()` below, never independently — see
    // that function's own comment for why the two swings share one input.
    uMoonReach: { value: 1 + MOON_REACH_SWING * moonAbundanceFor(moonForNow) },
    uMoonLife: { value: 1 + MOON_LIFE_SWING * moonAbundanceFor(moonForNow) },
    // docs/todo.md entry 106 — the third quality, added directly to
    // FADE_FROM (not multiplied, since it's a signed bias not a scale).
    // Defaults to 0 at today's moonForNow if that moment is neutral, exactly
    // matching every shader's own unmodified FADE_FROM when so.
    uMoonBloom: { value: BLOOM_SWING * moonBloomFor(moonForNow) },
  }

  let geometryMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: GEOMETRIC_VIEWS[options.geometricView].fragmentShader,
    uniforms,
  })
  let atmosphereMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: ATMOSPHERIC_VIEWS[options.atmosphericView].fragmentShader,
    uniforms,
  })

  const geometryTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false })
  const atmosphereTarget = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
  })

  // Read once, at construction, so the first frame matches the hour it is
  // actually loaded at rather than defaulting to night — docs/todo.md
  // entry 53.
  const skyForNow = skyFor(new Date())

  // docs/todo.md entry 97 — asked once, lazily, right here rather than
  // gated behind a HUD control: `getCurrentPosition` needs no live user
  // gesture (unlike `getUserMedia` above), so there is no tap this can ride
  // instead of just asking. Every sample before this resolves, and every
  // sample forever after if it resolves to `null`, uses `skyFor`'s clock-only
  // fallback — that path was already the whole feature before this entry
  // existed, so refusal costs the visitor nothing they didn't already have.
  let geoLocation: GeoLocation | null = null
  void requestLocation().then((location) => {
    geoLocation = location
  })

  // docs/todo.md entry 98 — same lazy, no-gesture-needed posture as the
  // location request just above: `AmbientLightSensor`'s own refusal is a
  // synchronous constructor throw (see ambient-light.ts's own header), not
  // a dialog waiting on the user, so there is nothing to gate behind a tap
  // here either. `null` on every iOS session and on any Android session
  // that refuses or has no sensor — `sampleAmbientLight` below already
  // treats that exactly like "camera off, no reading yet" does today.
  let ambientLight: AmbientLight | null = null
  void requestAmbientLight().then((light) => {
    ambientLight = light
  })

  const compositeUniforms = {
    uAtmosphere: { value: atmosphereTarget.texture },
    uGeometry: { value: geometryTarget.texture },
    uGeoAlpha: { value: options.geoAlpha },
    uAtmAlpha: { value: options.atmAlpha },
    uMode: { value: MERGE_MODES[options.mergeMode].index },
    uAtmMode: { value: MERGE_MODES[options.atmMergeMode].index },
    // Seeded from options, not left at white for setLayerColour to correct
    // later: nothing calls that until the HUD is touched, so a stored or
    // URL-supplied colour would be ignored for the whole session.
    uGeoColour: {
      value: new Vector3(options.geoColour.r, options.geoColour.g, options.geoColour.b),
    },
    uAtmColour: {
      value: new Vector3(options.atmColour.r, options.atmColour.g, options.atmColour.b),
    },
    uCamColour: {
      value: new Vector3(options.camColour.r, options.camColour.g, options.camColour.b),
    },
    // (angle, offsetX, offsetY, overscan) — at rest this is the identity, so
    // a device with no accelerometer costs one unused uniform and nothing else.
    uTumble: { value: new Vector4(0, 0, 0, 0) },
    // docs/todo.md entry 82 — the atmosphere's own multiplier on uTumble's
    // rotation and drift, so the two layers separate into a near plane and a
    // far one instead of moving as one rigid sheet. Geometry keeps the full
    // 1.0 (no uniform of its own — that is what "unscaled" means), so this
    // is the only new knob. 0.55 is Victor's call, not derived: the
    // atmosphere is a field and reads as behind the geometry's line work.
    uAtmTumbleScale: { value: 0.55 },
    // docs/todo.md entry 76, given its own held direction by entry 104 — the
    // RGB channels' own uv-space separation, already scaled to its cap and
    // pointed in its own held direction, rather than borrowing uTumble.yz's
    // own (oscillating) offset — see composite.frag.glsl and rgb-slip.ts.
    // vec2(0,0) at rest, and read as a plain uniform branch there, so a
    // still phone pays for nothing beyond this one vec2.
    uSlip: { value: new Vector2(0, 0) },
    // docs/todo.md entry 132 — the phone's own in-plane gravity, for the
    // atmosphere's weight. The same capped vector entry 30 already uses for
    // the picture's slide, so there is no second opinion about which way is
    // down. vec2(0,0) with the `grav` chip off, which makes the weight term
    // in composite.frag.glsl exactly 1.0.
    uGravity: { value: new Vector2(0, 0) },
    // Passthrough AR. Null until a camera is actually attached: Three binds a
    // default 1x1 white texture for a null sampler, which is never sampled
    // because the shader guards on uCameraMix > 0.
    uCamera: { value: null as VideoTexture | null },
    uCameraMix: { value: 0 },
    uCameraFit: { value: new Vector2(1, 1) },
    // The picture answers the light in the room — docs/todo.md entry 23.
    // 1 is identity and is also everything this ever is while the camera is
    // down, so a session that never raises it pays nothing for this uniform
    // existing.
    uExposure: { value: 1 },
    // Day mode — docs/todo.md entries 47, 53 and 71, with the chip and its
    // override retired by entry 127 (Victor: the chip corrected a guess
    // rather than doing something asked for, and the guess is right nearly
    // all the time). Entry 47 built this as a chip's own on/off value;
    // entry 53 made it continuous, driven by the local clock (see skyFor())
    // every second — the part that survives. Seeded from the clock's own
    // value right now rather than 0, so the first frame matches what the
    // hour actually is rather than defaulting to night. 0 is still identity
    // and everything this ever is at 2am.
    uDay: { value: skyForNow.daylight },
    // The clock's own two numbers, for the ground's warmth tint —
    // docs/todo.md entry 53. One uniform rather than two: they are always
    // computed together from one clock and always meant to be read
    // together, and splitting them is how one gets updated without the
    // other.
    uSky: { value: new Vector2(skyForNow.daylight, skyForNow.warmth) },
  }
  const compositeMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: compositeFrag,
    uniforms: compositeUniforms,
  })

  const geometry = new PlaneGeometry(2, 2)
  // One mesh, reused across all passes below — each pass swaps its material
  // in just before rendering.
  const mesh = new Mesh(geometry, geometryMaterial)
  scene.add(mesh)

  // Ambient light sampling — docs/todo.md entry 23, licensed by Victor
  // 2026-08-29, narrowly: camera pixels may be measured as well as
  // displayed, but only while the camera is already up (never what turns it
  // on — entry 22 is the only thing licensed to do that). A tiny render
  // target rather than reading the full camera frame back: GL's own linear
  // filtering does the downsampling for free as it rasterises to 8x8, and
  // reading 64 pixels back costs far less than reading the whole frame.
  const LIGHT_SAMPLE_SIZE = 8
  const lightTarget = new WebGLRenderTarget(LIGHT_SAMPLE_SIZE, LIGHT_SAMPLE_SIZE, {
    depthBuffer: false,
    stencilBuffer: false,
  })
  const lightMaterial = new ShaderMaterial({
    vertexShader,
    // Deliberately not composite.frag.glsl: this measures the room the
    // camera sees, not the picture the app is drawing over it — sampling
    // the composite's own output would make the exposure gain chase itself.
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uCamera;
      void main() { gl_FragColor = texture2D(uCamera, vUv); }
    `,
    uniforms: { uCamera: compositeUniforms.uCamera },
  })
  const lightPixels = new Uint8Array(LIGHT_SAMPLE_SIZE * LIGHT_SAMPLE_SIZE * 4)
  // Slow attack, slower release, seconds not frames: without this, someone
  // walking past a lamp strobes the whole picture, and the failure would
  // look like a rendering bug rather than a feature.
  const exposureEnvelope = new Envelope(2.0, 5.0, 0.5)
  let lightSampleFrames = 0

  // Motion clock. Integrated from the audio level rather than read from the
  // wall clock, so the field accumulates movement while there is sound and
  // coasts to a near-stop in silence. A break nearly freezes it, which is a
  // large part of why a break is legible at all.
  let flow = 0
  // Which RGB filter the geometric layer is wearing. Held here rather than as
  // a plain uniform because `spectrum` recomputes its gains every frame.
  let elapsed = 0
  let frameMs = 16.7
  let sinceChange = 0
  let historyHead = 0
  let historyAccum = 0
  let contextLost = false
  const ripples = createRippleState()
  // docs/todo.md entries 33 and 49. What main.ts's pointer recogniser last
  // reported — ticked into each slot's emitter once per rendered frame, in
  // render() below, rather than acted on directly in setTouches(), so spawn
  // cadence and charge stay tied to wall-clock time rather than to how often
  // pointer events arrive.
  //
  // Eight fixed slots — docs/todo.md entry 57, up from the four this
  // replaces. A slot's `contactId` is `null` while free. Keyed by *contact*
  // rather than by pointer id on purpose: entry 49's field can report the
  // same pointer id across two separate taps of the same finger (lift,
  // then tap again), and reusing a slot for "the same id" would restart an
  // emitter that should instead have started a second, independent one
  // alongside the first, which is still dying — main.ts's `dispatchTouches`
  // mints a fresh, monotonically increasing contact id on every qualifying
  // `down`, specifically so this pool sees two contacts rather than one
  // pointer touching down twice. A contact that drops out of the incoming
  // set keeps ticking through its own afterlife (see emitter.ts) rather
  // than being freed immediately. When a new contact arrives and every slot
  // already holds one, the slot with the least life remaining — the one
  // closest to disappearing on its own regardless — is recycled rather than
  // the new contact being dropped, matching "a pool of eight, oldest
  // recycled first."
  const emitterSlots: { contactId: number | null; state: EmitterState }[] = Array.from({ length: 8 }, () => ({
    contactId: null,
    state: createEmitterState(),
  }))
  let touches: ReadonlyArray<{ contactId: number; x: number; y: number; speed: number }> = []
  // docs/todo.md entry 112 — the mouse cursor's own emitter, outside the
  // eight-slot pool on purpose. The pool is keyed by contact id and recycles
  // its oldest member when a ninth finger arrives; a hover has no contact id
  // and no end, so putting it in there would let four fingers evict it
  // mid-sweep and would spend a slot a real touch might want. It is one
  // emitter, it is always the same one, and it costs a slot nobody else can
  // use only on a device that has a mouse.
  const hoverEmitter: EmitterState = createEmitterState()
  // The last reading `setHover` was given. Plain values rather than a
  // `HoverState`: `hover.ts` owns the cursor's own position, smoothing and
  // quiet window, and it lives in main.ts where the pointer events are —
  // this file is handed the answer, exactly as it is handed `motionTiltX`
  // and the rest, and never asks the question itself.
  let hoverX = 0
  let hoverY = 0
  let hoverSpeed = 0
  let hoverActive = false
  // docs/todo.md entry 48. What main.ts's dispatchTouches() last reported
  // about the picture as a whole (contact, hold, drag speed), independent of
  // the positioned per-touch emitters above — the atmospheric views have no
  // notion of a location, so this is an event rather than a point. Ticked
  // into `touchStream` once per rendered frame for the same reason the
  // emitter slots are: wall-clock cadence, not pointer-event rate.
  const touchStream = createTouchStreamState()
  let touchBegan = false
  let touchAnyDown = false
  let touchMaxSpeed = 0
  // docs/todo.md entry 58. What main.ts's frame loop last reported about the
  // phone's own orientation and handling — tilt (posture) and disturb
  // (disturbance) — ticked into `motionBias` once per rendered frame for the
  // same wall-clock-cadence reason the emitter slots and touch stream are.
  // `baseGeoColour`/`baseAtmColour` are the *stored* colours setLayerColour()
  // last set; the bias is added on top of them fresh every frame rather than
  // written back into either, so it never becomes part of what gets saved,
  // shuffled from, or shared in a URL.
  const motionBias = createMotionBiasState()
  let motionTiltX = 0
  let motionTiltY = 0
  let motionDisturb = 0
  // docs/todo.md entry 111 — how much the phone has been moving over the
  // last half-minute, 0-1. Recorded rather than acted on here: the only
  // reader is `updateRgbSlip`, which stretches its own cap by it. Kept
  // beside the other motion values for the same reason they are — this file
  // reads sensors and never writes them back.
  let motionBusyness = 0
  // docs/todo.md entry 102 — recorded here by setGravity, read by the
  // emitter loop below. `{0,0}` (its own default) means every released
  // emitter simply never accelerates, the same "reads a sensor, never
  // written back" shape motionTiltX/Y above already use.
  let emitterGravityX = 0
  let emitterGravityY = 0
  // docs/todo.md entry 132 — the geometric layer's own centre, hanging on a
  // spring under that same gravity. `uOrigin` is now written every frame
  // (docs/todo.md entry 141 changed this — see the render loop below): while
  // the `grav` chip is off it is simply held at the anchor rather than left
  // unwritten at a stale value, which is what lets a drag move the anchor
  // regardless of whether gravity is on.
  const originState = createOriginState()
  let gravityOn = false
  // docs/todo.md entry 141 — the emitter currently being dragged, if any.
  // `null` means nothing is held: the anchor and the spring behave exactly
  // as entry 132 left them. While non-null, `uOrigin` is the fingertip
  // itself every frame — no spring, no lag, per Decided — and the anchor is
  // only written back (via `setAnchor`) on release, which is what makes the
  // drop point the new hanging point rather than a place passed through.
  let emitterDrag: { x: number; y: number } | null = null
  // docs/todo.md entry 146 — which geometric view is currently mounted, kept
  // here because `setGeometricView` (entry 92) never stored it anywhere: it
  // only ever swapped the material. `hitTestChorusNode` needs to know
  // whether Chorus is the one on screen before it makes sense to test
  // against Chorus's own node ring, and nothing else in scene.ts needed that
  // answer before this entry. Updated where the material swap actually
  // happens (inside the view-dip callback), not at the call site, so it
  // never leads what is actually drawn.
  let currentGeometricView: GeometricViewName = options.geometricView
  // docs/todo.md entry 146 — Chorus's own several nodes, as offsets from the
  // anchor, one array shared by the render loop (which uploads it every
  // frame to `uNodes`) and the hit-test (which reads it to answer "which
  // node did that touch land on"). Recomputed at each of `uSeed`'s own three
  // re-roll sites below, so a re-roll restructures the ring exactly the way
  // it used to restructure chorus.frag.glsl's own closed-form arrangement.
  let chorusNodes: { x: number; y: number }[] = chorusNodeOffsets(options.seed)
  // docs/todo.md entry 146 — nodes currently held by a finger, keyed by
  // index, absolute position (not an offset) exactly like `emitterDrag`: no
  // spring, no lag while held, per the same Decided entry 141 already
  // established for the single-emitter views. A `Map` rather than a fixed
  // array because more than one node can be dragged at once (multi-touch),
  // which the single-anchor `emitterDrag` never had to consider.
  const nodeDrags = new Map<number, { x: number; y: number }>()
  // docs/todo.md entry 76 — ticked from the same `motionDisturb` above,
  // already recorded here every frame by `setMotion` for the colour bias.
  // No new setter: this is the "no new plumbing at all" the entry asks for.
  const rgbSlip = createRgbSlipState()
  // docs/todo.md entry 104 — the raw in-plane acceleration behind the slip's
  // own held direction. Recorded here by setTumble, which already receives
  // the whole TumbleState `t` these come from — no new setter or plumbing
  // from main.ts needed, the same "no new plumbing at all" shape entry 76
  // itself already established for this file.
  let slipAccelX = 0
  let slipAccelY = 0
  // docs/todo.md entry 92 — "the stored value" above is now a ramp target,
  // not the value itself: `baseGeoColour`/`baseAtmColour`/`baseCamColour`
  // are what render() actually paints with each frame, and they chase
  // whatever `setLayerColour()` last aimed the corresponding ramp at,
  // rather than jumping to it outright.
  const geoColourRamp: ColourRamp = { from: options.geoColour, target: options.geoColour, elapsed: 0, duration: 0 }
  const atmColourRamp: ColourRamp = { from: options.atmColour, target: options.atmColour, elapsed: 0, duration: 0 }
  const camColourRamp: ColourRamp = { from: options.camColour, target: options.camColour, elapsed: 0, duration: 0 }
  let baseGeoColour: GeoColour = options.geoColour
  let baseAtmColour: GeoColour = options.atmColour
  let baseCamColour: GeoColour = options.camColour
  // Alpha is no longer a direct uniform write either: render() multiplies
  // the user-set value below by whichever view dip (see `ViewDip`) is
  // currently in flight for that layer, so the stored preference and the
  // dip's own animation stay separate concerns.
  let baseGeoAlpha = options.geoAlpha
  let baseAtmAlpha = options.atmAlpha
  const geoViewDip = createViewDip()
  const atmViewDip = createViewDip()
  // docs/todo.md entry 71: `skyDaylightSample` is what the clock said as of
  // the last once-a-second read, below; `skyDaylight` — what uDay actually
  // reads — chases it at a bounded rate instead of snapping to it, so a
  // DST jump, a timezone change in flight, or a tab resumed hours later
  // takes ~3s on screen rather than landing as a one-frame step. Warmth is
  // not chased: it is a secondary tint, not the picture's own visibility,
  // and the entry's own finding was specifically about `uDay`.
  let skyDaylightSample = skyForNow.daylight
  let skyDaylight = skyForNow.daylight
  let skyWarmth = skyForNow.warmth
  let sinceSkySample = 0
  // docs/todo.md entry 96 — sampled on the same once-a-second cadence as
  // the sky above (same `new Date()` call, even — see render()), not
  // chased the way skyDaylight is: nothing here needs the DST-jump
  // smoothing that entry 71 added for the sun, since the moon's own swings
  // are already gentle by construction (Decided's own "roughly ±25%").
  // Kept as the raw Moon fields, not just the derived abundance, so
  // stats() can report phase/illuminated/presence individually for the
  // readout, per Decided's own "report it in the readout".
  let moonState: Moon = moonForNow
  // For stats() below, which is called independently of render() — the
  // numeric readout's own posture/disturbance/agitation line reads this.
  let lastMotion: MotionBias = { r: 0, g: 0, b: 0, posture: 0, disturbance: 0, agitation: 0 }
  let lastNovelty = 0
  let lastAutoReroll = -1000
  // The canvas's own client box, as of the last applySize() — see
  // sizeCheckFrames below. Compared in CSS pixels, not the drawing buffer's,
  // because that is the number CSS is actually stretching the buffer to.
  let lastClientWidth = 0
  let lastClientHeight = 0
  /** Frames since the client box was last checked against what the buffer
   *  was sized for. Not a per-frame check: reading clientWidth/clientHeight
   *  can force layout, and this changes at most twice a session (fullscreen,
   *  rotation) — paying that cost 60 times a second to catch something that
   *  rare is the wrong trade. 30 frames is twice a second, which bounds any
   *  visible distortion to about half that without adding a real cost. */
  let sizeCheckFrames = 0
  /** Set by requestCapture(), read and cleared inside the render loop once
   *  the composited frame is actually on the canvas. See requestCapture's
   *  own comment for why this cannot just call toBlob() synchronously. */
  let pendingCapture: ((blob: Blob | null) => void) | null = null

  const onContextLost = (event: Event) => {
    // Without preventDefault, Three never gets the restore event. Mobile
    // browsers drop the context whenever the tab is backgrounded for a while,
    // so this is a normal occurrence, not an error path.
    event.preventDefault()
    contextLost = true
  }
  const onContextRestored = () => {
    contextLost = false
    spectrumTexture.needsUpdate = true
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  const drawSize = new Vector2()

  function applySize() {
    renderer.setPixelRatio(RATIO_LADDER[rung])
    // The canvas's own client box, not window.innerWidth/innerHeight: CSS
    // (`#canvas { inset: 0; width: 100%; height: 100% }`) paints the canvas
    // across whatever that box is, and window.inner* was always only a proxy
    // for it — one that fullscreen can silently stop agreeing with, which is
    // exactly what stretched every circle in the app into an ellipse. Sizing
    // from the same box CSS is stretching the buffer across makes the two
    // numbers one number, so they cannot disagree by construction.
    lastClientWidth = canvas.clientWidth
    lastClientHeight = canvas.clientHeight
    renderer.setSize(lastClientWidth, lastClientHeight, false)
    // Uniform wants the drawing-buffer size, not the CSS size — they differ by
    // the pixel ratio, and using CSS pixels here makes the shader's aspect
    // correction subtly wrong on every retina device.
    renderer.getDrawingBufferSize(drawSize)
    uniforms.uResolution.value.copy(drawSize)
    geometryTarget.setSize(drawSize.x, drawSize.y)
    atmosphereTarget.setSize(drawSize.x, drawSize.y)
    applyCameraFit()
  }

  /**
   * Cover-fit the camera frame to the canvas.
   *
   * The sensor is landscape (1280x720) and a phone held upright is portrait,
   * so the two aspects are not merely different, they are inverted. Stretching
   * one to the other is instantly legible as wrong — faces get wide, the room
   * leans.
   *
   * The shader samples `(vUv - 0.5) * uCameraFit + 0.5`, so this is the factor
   * the *texture coordinates* are scaled by, which is the reciprocal of the
   * scale applied to the image: to show less of the source along an axis
   * (cropping it) the uv range must shrink, hence the < 1 values here. Getting
   * that backwards produces a frame that is letterboxed rather than cropped,
   * with the clamp smearing the edge pixels outward.
   */
  function applyCameraFit(): void {
    const tex = compositeUniforms.uCamera.value
    const video = tex?.image as HTMLVideoElement | undefined
    if (!video || !video.videoWidth || !video.videoHeight || !drawSize.y) {
      compositeUniforms.uCameraFit.value.set(1, 1)
      return
    }
    const canvasAspect = drawSize.x / drawSize.y
    const videoAspect = video.videoWidth / video.videoHeight
    if (videoAspect > canvasAspect) {
      // Source is wider than the frame: keep full height, crop the sides.
      compositeUniforms.uCameraFit.value.set(canvasAspect / videoAspect, 1)
    } else {
      compositeUniforms.uCameraFit.value.set(1, videoAspect / canvasAspect)
    }
  }
  applySize()

  /** Walk the ladder towards whatever rung holds the frame rate. */
  function adapt(dt: number) {
    sinceChange += dt
    if (sinceChange < SETTLE) return

    if (frameMs > SLOW_MS && rung > 0) {
      rung--
      sinceChange = 0
      applySize()
    } else if (
      frameMs < FAST_MS &&
      rung < RATIO_LADDER.length - 1 &&
      RATIO_LADDER[rung + 1] <= window.devicePixelRatio
    ) {
      rung++
      sinceChange = 0
      applySize()
    }
  }

  /**
   * Catch a viewport that changed shape without firing the `resize` this
   * app listens for — fullscreen is the one already known to do that; there
   * may be others nobody has thought of yet, which is the actual reason this
   * exists rather than one more listener for one more event name. The
   * existing `resize` handler stays as the immediate path, so an ordinary
   * rotation does not wait up to 30 frames for this to notice.
   */
  function checkSize(): void {
    sizeCheckFrames++
    if (sizeCheckFrames < 30) return
    sizeCheckFrames = 0
    if (canvas.clientWidth !== lastClientWidth || canvas.clientHeight !== lastClientHeight) {
      applySize()
    }
  }

  /**
   * Measure the room's mean brightness from the camera texture and ease the
   * composite's output gain toward it — see this file's own comment on
   * `lightTarget` for the licence and the reasoning.
   *
   * A no-op the instant the camera is down: `dt`'s costs before the guard
   * are one comparison, and the whole point of the licence's shape is that
   * this never runs for most people. Ticks on the same 30-frame cadence
   * `checkSize` uses, for the same reason — a per-frame readback stalls the
   * pipeline waiting for the GPU, and light in a room does not change
   * faster than twice a second.
   */
  function sampleAmbientLight(dt: number): void {
    if (!compositeUniforms.uCamera.value) {
      // docs/todo.md entry 98 — the sensor's own branch, generalising this
      // function's camera-only reading to the far more common case of no
      // camera at all. `lux()` is `null` on every platform without the
      // sensor (all of iOS, an Android session that never resolved one or
      // was refused) — identity path, `uExposure` exactly 1, today's
      // behaviour unchanged. No 30-frame throttle here: reading a stored
      // float costs nothing like the GPU readback the camera branch below
      // exists to amortise.
      const lux = ambientLight?.lux() ?? null
      if (lux === null) {
        compositeUniforms.uExposure.value = 1
        return
      }
      exposureEnvelope.push(luminanceFromLux(lux), dt)
      compositeUniforms.uExposure.value = 0.85 + exposureEnvelope.current * 0.3
      return
    }

    lightSampleFrames++
    if (lightSampleFrames >= 30) {
      lightSampleFrames = 0
      mesh.material = lightMaterial
      renderer.setRenderTarget(lightTarget)
      renderer.render(scene, camera)
      renderer.readRenderTargetPixels(
        lightTarget,
        0,
        0,
        LIGHT_SAMPLE_SIZE,
        LIGHT_SAMPLE_SIZE,
        lightPixels,
      )

      let sum = 0
      const n = LIGHT_SAMPLE_SIZE * LIGHT_SAMPLE_SIZE
      for (let i = 0; i < n; i++) {
        const r = lightPixels[i * 4] / 255
        const g = lightPixels[i * 4 + 1] / 255
        const b = lightPixels[i * 4 + 2] / 255
        // Standard luminance weights — green dominates perceived brightness,
        // blue barely registers.
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      exposureEnvelope.push(sum / n, dt * 30)
    } else {
      // The envelope still needs to advance every frame, or its own
      // attack/release times would mean nothing — only the *sample* it is
      // chasing updates once every 30.
      exposureEnvelope.push(exposureEnvelope.current, dt)
    }

    // 0.85 at luminance 0 (a covered lens, or a dark room) to 1.15 at
    // luminance 1 (bright daylight); 0.5 — an ordinary lit room — lands
    // exactly on 1, unchanged. Narrower than it looks: the picture's
    // brightness is already the music's job, and a wider range would fight
    // it rather than merely answer the room.
    compositeUniforms.uExposure.value = 0.85 + exposureEnvelope.current * 0.3
  }

  return {
    render(params, spectrum) {
      if (contextLost) return

      // Downsample the analyser's bins into the texture by taking the max of
      // each group. Averaging washes out narrow peaks, which are exactly the
      // detail the rings are there to show.
      const stride = spectrum.length / SPECTRUM_SIZE
      for (let i = 0; i < SPECTRUM_SIZE; i++) {
        const start = Math.floor(i * stride)
        const end = Math.min(spectrum.length, Math.floor((i + 1) * stride))
        let peak = 0
        for (let j = start; j < end; j++) if (spectrum[j] > peak) peak = spectrum[j]
        spectrumData[i] = peak
      }
      spectrumTexture.needsUpdate = true

      // dt is recomputed here from the renderer's own clock rather than passed
      // in, so flow stays correct even if a mapping is swapped mid-run.
      const now = performance.now() / 1000
      const dt = elapsed === 0 ? 1 / 60 : Math.min(now - elapsed, 1 / 15)
      elapsed = now
      frameMs += (dt * 1000 - frameMs) * 0.05
      adapt(dt)
      checkSize()
      sampleAmbientLight(dt)

      // Advance the rolling spectrogram at a fixed rate rather than once per
      // rendered frame, so the time axis means the same thing regardless of
      // frame rate — and so the visible history length does not change when the
      // resolution scaler moves.
      historyAccum += dt
      if (historyAccum >= 1 / HISTORY_HZ) {
        historyAccum %= 1 / HISTORY_HZ
        for (let r = 0; r < HISTORY_H; r++) {
          const [b0, b1] = historyBins[r]
          let peak = 0
          for (let b = b0; b < b1 && b < SPECTRUM_SIZE; b++) {
            if (spectrumData[b] > peak) peak = spectrumData[b]
          }
          historyData[r * HISTORY_W + historyHead] = peak
        }
        historyHead = (historyHead + 1) % HISTORY_W
        historyTexture.needsUpdate = true
      }


      // A break stalls the motion rather than merely dimming it.
      const churn =
        0.06 + params.level * 0.95 + params.transient * 0.6 + params.surge * 1.5
      flow += churn * (1 - 0.85 * params.breakdown) * dt

      updateRipples(ripples, now, params.transient, params.breakdown)
      // docs/todo.md entries 33, 49 and 57 — ticked here, not in
      // setTouches(), for the same reason updateRipples runs here rather
      // than on each audio frame: one wall-clock tick per rendered frame is
      // what makes charge and spawn cadence mean seconds rather than
      // pointer-event rate. Slots whose contact is no longer in `touches`
      // still get ticked, inactive, so their afterlife keeps running down;
      // a slot only frees once its own life reaches 0.
      // docs/todo.md entry 96 — the same abundance the ripple/emitter
      // shape uniforms above use, read once per frame rather than
      // recomputed per slot; it only actually changes once a second
      // anyway (see moonState's own comment).
      const moonAbundance = moonAbundanceFor(moonState)
      // docs/todo.md entry 102 — the frame's own bounds in the emitter's uv
      // space, from the canvas's own client size applySize() already
      // tracks, so a fall bounces off the edge actually on screen (a
      // landscape phone's true bottom) rather than an assumed square one.
      // docs/todo.md entry 132 — the bob, ticked on the same clock as the
      // emitter pool below and fed the same gravity. `compositeUniforms.
      // uGravity` is still gated on `gravityOn` alone, unchanged by entry
      // 141 below: it is the atmosphere's own brightness weighting, has
      // nothing to do with the anchor, and stays exactly the effect entry
      // 132 shipped.
      //
      // The tilt is the uncapped pair (`motionTiltX/Y`), not the capped
      // `emitterGravity` — the cap exists so a *slide* cannot expose the
      // frame's edge, and moving the origin exposes nothing, so the bob is
      // entitled to the full reading.
      if (gravityOn) {
        // The uncapped tilt, not the capped `shake.gravity()` the entry's
        // Lands-in names — and that is a correction rather than a liberty.
        // The entry specifies "upright, the field reads 25% denser along the
        // bottom", which needs |g| ≈ 1; `shake.gravity()` is capped to
        // ±0.033 for the tumble's own offset, so feeding it here gives 1.6%
        // and the weight would be invisible. Measured before changing it.
        //
        // The cap exists so a *slide* cannot expose the frame's edge. A
        // brightness gradient exposes nothing, so it is entitled to the full
        // reading — the same reason the bob above takes the uncapped pair.
        compositeUniforms.uGravity.value.set(motionTiltX, motionTiltY)
      }
      // docs/todo.md entry 141 — `uOrigin` is now written every frame,
      // unconditionally, in one of three ways: a live drag overrides
      // everything else (no spring, no lag, whatever gravity is doing);
      // otherwise the spring runs exactly as entry 132 left it while
      // `grav` is on; otherwise the anchor is held directly, static, which
      // is what makes a drag with `grav` off simply place the centre with
      // nothing pulling it anywhere afterwards. `originState.anchorX/Y`
      // default to `(0, 0)`, so with no drag ever made this is bit-for-bit
      // what entry 132 already did.
      if (emitterDrag) {
        uniforms.uOrigin.value.set(emitterDrag.x, emitterDrag.y)
      } else if (gravityOn) {
        updateOrigin(originState, dt, motionTiltX, motionTiltY, slipAccelX, slipAccelY)
        uniforms.uOrigin.value.set(originState.x, originState.y)
      } else {
        uniforms.uOrigin.value.set(originState.anchorX, originState.anchorY)
      }
      // docs/todo.md entry 146 — Chorus's own several nodes, uploaded every
      // frame after `uOrigin` above so a node being dragged can be expressed
      // as an offset from wherever the picture's centre actually is *this*
      // frame, matching `uOrigin`'s own live-versus-settled distinction: a
      // node not currently held is `chorusNodes[i]` (an offset from the
      // anchor, restructured only by a re-roll); a node currently held is
      // its live fingertip position minus `uOrigin`'s current value, which
      // is what makes it track the finger with no spring while still
      // composing correctly with a bob that is mid-swing under it.
      for (let i = 0; i < chorusNodes.length; i++) {
        const live = nodeDrags.get(i)
        if (live) {
          uniforms.uNodes.value[i].set(live.x - uniforms.uOrigin.value.x, live.y - uniforms.uOrigin.value.y)
        } else {
          uniforms.uNodes.value[i].set(chorusNodes[i].x, chorusNodes[i].y)
        }
      }
      uniforms.uNodeCount.value = chorusNodes.length
      const emitterGravity = { x: emitterGravityX, y: emitterGravityY }
      const emitterHalfExtent = {
        x: lastClientWidth / (2 * Math.min(lastClientWidth, lastClientHeight)),
        y: lastClientHeight / (2 * Math.min(lastClientWidth, lastClientHeight)),
      }
      for (const slot of emitterSlots) {
        const live = slot.contactId === null ? undefined : touches.find((t) => t.contactId === slot.contactId)
        if (live) {
          updateEmitter(
            slot.state,
            ripples,
            now,
            true,
            live.x,
            live.y,
            live.speed,
            moonAbundance,
            emitterGravity,
            emitterHalfExtent,
          )
        } else if (slot.contactId !== null) {
          updateEmitter(slot.state, ripples, now, false, 0, 0, 0, moonAbundance, emitterGravity, emitterHalfExtent)
          if (slot.state.life <= 0) slot.contactId = null
        }
      }
      for (const t of touches) {
        if (emitterSlots.some((s) => s.contactId === t.contactId)) continue
        // A free slot first; if the pool is genuinely full, recycle the one
        // with the least life left rather than dropping the new contact —
        // "a pool of eight, oldest recycled first" (entry 57).
        const free =
          emitterSlots.find((s) => s.contactId === null) ??
          emitterSlots.reduce((a, b) => (a.state.life <= b.state.life ? a : b))
        free.contactId = t.contactId
        updateEmitter(free.state, ripples, now, true, t.x, t.y, t.speed, moonAbundance, emitterGravity, emitterHalfExtent)
      }

      // docs/todo.md entry 112 — the mouse cursor, ticked here in the same
      // loop and on the same clock as the pool above, so a hover spawns on
      // the same cadence a held finger does. Ticked unconditionally rather
      // than only while active: that is what runs the afterlife down when
      // the cursor parks or leaves, so the rings already alive thin out over
      // the emitter's own remaining life instead of stopping dead. On a
      // device with no mouse this is one call a frame on a state that is
      // inactive with zero life, which `updateEmitter` leaves after two
      // comparisons.
      updateEmitter(
        hoverEmitter,
        ripples,
        now,
        hoverActive,
        hoverX,
        hoverY,
        hoverSpeed,
        moonAbundance,
        emitterGravity,
        emitterHalfExtent,
        HOVER_CHARGE_CAP,
      )
      for (let i = 0; i < MAX_RIPPLES; i++) {
        const o = i * 4 // stride must match ripples.ts's own STRIDE
        uniforms.uRipples.value[i].set(
          ripples.slots[o],
          ripples.slots[o + 1],
          ripples.slots[o + 2],
          ripples.slots[o + 3],
        )
      }

      // A real structural boundary re-rolls the seed on its own — same
      // rising-edge-plus-cooldown shape as ripples.ts's transient trigger, just
      // on `novelty` instead. Lattice spends the seed on its symmetry order,
      // node density, tunnel depth and spiral twist, so this is what makes a
      // section change a genuinely different shape rather than only a
      // different colour; every other view gets a smaller version of the same
      // "something changed" for free, since they all read the same seed.
      if (
        params.novelty > STRUCTURE_THRESHOLD &&
        lastNovelty <= STRUCTURE_THRESHOLD &&
        now - lastAutoReroll > STRUCTURE_COOLDOWN
      ) {
        const nextSeed: [number, number, number, number] = [Math.random(), Math.random(), Math.random(), Math.random()]
        uniforms.uSeed.value.set(...nextSeed)
        // docs/todo.md entry 146 — a structural boundary restructures Chorus's
        // node ring exactly as it restructures every other view's reading of
        // `uSeed`, and drops any drag in progress: a node held through a
        // re-roll would otherwise keep answering to a seed that no longer
        // exists anywhere else in the picture.
        chorusNodes = chorusNodeOffsets(nextSeed)
        nodeDrags.clear()
        lastAutoReroll = now
      }
      lastNovelty = params.novelty

      // docs/todo.md entry 48. `params` itself is left untouched — the
      // numeric readout in main.ts reads the very same object right after
      // this call, and it has to keep reporting the mapping's own output,
      // not what a finger added to it, or every audio entry in the queue
      // that is debugged against that readout would be reading a lie.
      // `Math.max`, never addition: a touch can only ever add liveliness on
      // top of what the music already earned, never push a real transient
      // past whatever a shader does at saturation.
      const stream = updateTouchStream(touchStream, dt, touchBegan, touchAnyDown, touchMaxSpeed)
      touchBegan = false

      uniforms.uTime.value = now
      uniforms.uFlow.value = flow
      uniforms.uLevel.value = Math.max(params.level, stream.level)
      uniforms.uLow.value = params.low
      uniforms.uMid.value = params.mid
      uniforms.uHigh.value = params.high
      uniforms.uTransient.value = Math.max(params.transient, stream.transient)
      uniforms.uTilt.value = params.tilt
      uniforms.uBreak.value = params.breakdown
      uniforms.uSurge.value = params.surge
      uniforms.uNovelty.value = params.novelty
      uniforms.uRoughness.value = Math.max(params.roughness, stream.roughness)
      // No touch-stream contribution here, unlike the audio params above it
      // — a beat phase is a prediction about *when*, and a finger has no
      // opinion on that; it only ever adds liveliness to an amplitude.
      uniforms.uBeat.value = params.beatPhase
      uniforms.uBpm.value = params.bpm
      uniforms.uBeatConfidence.value = params.beatConfidence
      uniforms.uHistoryHead.value = historyHead / HISTORY_W

      // docs/todo.md entry 58. Added to the *stored* colour fresh every
      // frame, never written back into it — geoColour/atmColour are
      // preferences the shuffle, the director and the HUD all write, and a
      // motion bias that persisted into them would fight all three and turn
      // up in a shared URL. Brightness-neutral by construction (see
      // motion-bias.ts's own file comment), so this can never be the thing
      // that darkens the picture the way entry 21's floors once did.
      const motion = updateMotionBias(motionBias, dt, motionTiltX, motionTiltY, motionDisturb)
      lastMotion = motion

      // docs/todo.md entry 76, given its own held direction by entry 104.
      // `slipAccelX`/`slipAccelY` are the raw sample setTumble recorded,
      // whichever frame called it last — this module owns the direction's
      // own held state entirely; nothing here is read back from uTumble.
      const slip = updateRgbSlip(rgbSlip, dt, motionDisturb, slipAccelX, slipAccelY, motionBusyness)
      compositeUniforms.uSlip.value.set(slip.x, slip.y)

      // docs/todo.md entries 47, 53 and 71. The clock is sampled once a
      // second (SKY_SAMPLE_S) rather than every frame — "over a minute the
      // change is invisible... per-frame would be waste" — while the
      // override fade still ticks every frame, since that transition is
      // the one place in this feature something actually needs to look
      // smooth on a short timescale.
      sinceSkySample += dt
      if (sinceSkySample >= SKY_SAMPLE_S) {
        sinceSkySample = 0
        const sampledAt = new Date()
        // docs/todo.md entry 97 — real position once granted, the same
        // clock-only curve as always otherwise. `geoLocation` only ever
        // moves from null to a coordinate, once, so this check is the
        // entire integration: no separate "did it just arrive" branch.
        const sky = geoLocation ? skyForLocation(sampledAt, geoLocation) : skyFor(sampledAt)
        skyDaylightSample = sky.daylight
        skyWarmth = sky.warmth
        // docs/todo.md entry 96 — same instant, same cadence as the sky
        // above; see moonState's own comment for why this isn't chased.
        // Entry 97: same geoLocation check as the sky sample just above —
        // one coordinate feeds both real-position paths.
        moonState = geoLocation ? moonForLocation(sampledAt, geoLocation) : moonFor(sampledAt)
        const moonAbundance = moonAbundanceFor(moonState)
        uniforms.uMoonReach.value = 1 + MOON_REACH_SWING * moonAbundance
        uniforms.uMoonLife.value = 1 + MOON_LIFE_SWING * moonAbundance
        // docs/todo.md entry 106 — the third quality, same cadence as reach
        // and life above, sampled from the same moonState.
        uniforms.uMoonBloom.value = BLOOM_SWING * moonBloomFor(moonState)
      }
      // Chased at a bounded rate rather than assigned — entry 71's own
      // finding: a DST jump, a timezone change in flight, or a tab resumed
      // hours later would otherwise land as a one-frame step in `uDay`.
      // Full-scale over ~3s, every frame, not gated behind the once-a-second
      // sample above.
      const daylightStep = dt * SKY_CHASE_RATE
      skyDaylight =
        skyDaylightSample > skyDaylight
          ? Math.min(skyDaylightSample, skyDaylight + daylightStep)
          : Math.max(skyDaylightSample, skyDaylight - daylightStep)
      // docs/todo.md entry 127 removed the sun chip and the override it
      // pinned uDay to — uDay now simply is the clock's own chased reading,
      // with nothing left to mix it toward.
      compositeUniforms.uDay.value = skyDaylight
      compositeUniforms.uSky.value.set(skyDaylight, skyWarmth)

      // docs/todo.md entry 92 — colour ramps step every frame regardless of
      // whether one is actually in flight (a finished ramp just keeps
      // landing on its own target, at zero cost worth guarding against).
      // View dips likewise: both layers tick every frame so a queued swap
      // notices the instant the other layer returns to idle.
      baseGeoColour = stepColourRamp(geoColourRamp, dt)
      baseAtmColour = stepColourRamp(atmColourRamp, dt)
      baseCamColour = stepColourRamp(camColourRamp, dt)
      tickViewDips(geoViewDip, atmViewDip, dt)
      compositeUniforms.uGeoAlpha.value = baseGeoAlpha * geoViewDip.multiplier
      compositeUniforms.uAtmAlpha.value = baseAtmAlpha * atmViewDip.multiplier

      compositeUniforms.uGeoColour.value.set(
        baseGeoColour.r + motion.r,
        baseGeoColour.g + motion.g,
        baseGeoColour.b + motion.b,
      )
      compositeUniforms.uAtmColour.value.set(
        baseAtmColour.r + motion.r,
        baseAtmColour.g + motion.g,
        baseAtmColour.b + motion.b,
      )
      compositeUniforms.uCamColour.value.set(baseCamColour.r, baseCamColour.g, baseCamColour.b)

      // Three passes over the same quad: geometric layer to its target,
      // atmospheric layer to its target, then the composite reads both and
      // paints the canvas. autoClear defaults to true, so each pass starts
      // from a blank target — correct here since every view is a from-scratch
      // procedural render each frame, nothing accumulates across frames.
      mesh.material = geometryMaterial
      renderer.setRenderTarget(geometryTarget)
      renderer.render(scene, camera)

      mesh.material = atmosphereMaterial
      renderer.setRenderTarget(atmosphereTarget)
      renderer.render(scene, camera)

      mesh.material = compositeMaterial
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)

      // Right after the canvas is painted and before anything else can clear
      // it — see requestCapture's own comment on why this cannot happen
      // synchronously at the call site instead.
      if (pendingCapture) {
        const onReady = pendingCapture
        pendingCapture = null
        canvas.toBlob((blob) => onReady(blob), 'image/png')
      }
    },

    resize: applySize,

    requestCapture(onReady) {
      pendingCapture = onReady
    },

    setGeometricView(name) {
      // docs/todo.md entry 92 — a view swap is a hard cut (two different
      // shader programmes, nothing to interpolate between), so it dips the
      // layer to nothing, swaps the material while nobody can see it, then
      // fades back in. `atmViewDip` is passed as `other` purely so a swap
      // requested while the atmosphere is mid-dip gets queued rather than
      // overlapping it — the two layers must never dip together.
      startViewDip(geoViewDip, atmViewDip, () => {
        const next = new ShaderMaterial({
          vertexShader,
          fragmentShader: GEOMETRIC_VIEWS[name].fragmentShader,
          uniforms,
        })
        geometryMaterial.dispose()
        geometryMaterial = next
        currentGeometricView = name
      })
    },

    setAtmosphericView(name) {
      startViewDip(atmViewDip, geoViewDip, () => {
        const next = new ShaderMaterial({
          vertexShader,
          fragmentShader: ATMOSPHERIC_VIEWS[name].fragmentShader,
          uniforms,
        })
        atmosphereMaterial.dispose()
        atmosphereMaterial = next
      })
    },

    setMergeMode(layer, mode) {
      const u = layer === 'geo' ? compositeUniforms.uMode : compositeUniforms.uAtmMode
      u.value = MERGE_MODES[mode].index
    },

    setTumble(t, gravity) {
      const gx = gravity?.x ?? 0
      const gy = gravity?.y ?? 0
      const offsetX = Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, t.offsetX + gx))
      const offsetY = Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, t.offsetY + gy))
      // Recomputed from the combined offset, not just t.zoom: a held tilt can
      // push the applied offset further than the spring's own displacement
      // did, and the overscan has to cover whatever is actually on screen.
      const zoom = Math.max(t.zoom, overscanFor(t.angle, offsetX, offsetY))
      compositeUniforms.uTumble.value.set(t.angle, offsetX, offsetY, zoom)
      // docs/todo.md entry 104 — recorded here, read by the rgb-slip call in
      // render() below. `t` is the whole TumbleState already; these two
      // fields are the raw sample the slip's own held direction eases
      // toward, kept separate from uTumble's own (oscillating) offset above.
      slipAccelX = t.accelX
      slipAccelY = t.accelY
    },

    setHover(x, y, present, speed, presence = 0) {
      // Recorded, not acted on: render() is what ticks the emitter, for the
      // same reason the pool is ticked there rather than in setTouches —
      // one wall-clock tick per rendered frame is what makes the spawn
      // cadence mean seconds rather than mouse-event rate. A mouse can fire
      // far more than 60 pointermoves a second.
      hoverX = x
      hoverY = y
      hoverSpeed = speed
      hoverActive = present
      // docs/todo.md entry 114. Written straight to the uniform rather than
      // stored and copied in render(): it is already the eased value — the
      // easing is hover.ts's, on hover.ts's own clock — so there is nothing
      // for a frame boundary to add.
      uniforms.uPointer.value.set(x, y, presence)
    },

    setTouches(next) {
      touches = next
    },

    hitTestEmitter(x, y, radiusUv) {
      return pickEmitter(originState, x, y, radiusUv)
    },

    setEmitterDrag(pos) {
      if (pos) {
        emitterDrag = pos
      } else if (emitterDrag) {
        // Anchor at the drop point before clearing the live drag — the
        // render loop's own branch order means a frame that both ends a
        // drag and renders would otherwise read the now-null `emitterDrag`
        // and fall through to the *old* anchor for one frame, a visible
        // pop back before the new anchor takes hold. The spring's own
        // position is snapped there too, not only its target: while held
        // there was no spring at all (Decided's "no lag"), so
        // `originState.x/y` is whatever it last was before the drag began
        // — possibly nowhere near the drop point — and leaving it would
        // show one frame of the bob leaping from the old spot to the new
        // one before the swing could even start.
        setAnchor(originState, emitterDrag.x, emitterDrag.y)
        originState.x = emitterDrag.x
        originState.y = emitterDrag.y
        originState.vx = 0
        originState.vy = 0
        emitterDrag = null
      }
    },

    hitTestChorusNode(x, y, radiusUv) {
      if (currentGeometricView !== 'chorus') return null
      // Against `uOrigin`'s current value, not the anchor: while gravity is
      // on the bob can be well away from the anchor mid-swing, and a hit
      // test against the anchor would miss nodes exactly where they are
      // drawn (`uOrigin + uNodes[i]` — see the render loop's own upload
      // below). `chorusNodes` is an offset either way, so nothing else here
      // needs to change to make "anchor" mean "wherever the centre actually
      // is right now".
      return pickNode(chorusNodes, { x: uniforms.uOrigin.value.x, y: uniforms.uOrigin.value.y }, x, y, radiusUv)
    },

    setChorusNodeDrag(index, pos) {
      if (pos) {
        nodeDrags.set(index, pos)
      } else {
        // Same fold-back-to-an-offset arithmetic setEmitterDrag uses for the
        // single anchor, done relative to `uOrigin`'s *current* value rather
        // than the anchor directly: while gravity is on, `uOrigin` is
        // wherever the bob is right now, not the anchor it is swinging
        // toward, and a node dropped mid-swing should sit where the finger
        // actually left it relative to the picture on screen, not snap to
        // where the anchor will eventually settle.
        const live = nodeDrags.get(index)
        if (live) {
          chorusNodes[index] = {
            x: live.x - uniforms.uOrigin.value.x,
            y: live.y - uniforms.uOrigin.value.y,
          }
        }
        nodeDrags.delete(index)
      }
    },

    setTouchStream(began, anyDown, maxSpeed) {
      // OR'd onto whatever this frame already recorded rather than
      // overwritten, so a `began` reported by one dispatch pass within the
      // frame is never silently replaced by a later, quieter one — see
      // render()'s own comment on why this resets to false only once
      // consumed.
      touchBegan = touchBegan || began
      touchAnyDown = anyDown
      touchMaxSpeed = maxSpeed
    },

    setLayerColour(layer, colour, rampS) {
      // geo/atm are no longer a direct uniform write — docs/todo.md entry
      // 58 adds a render-time motion bias on top of whatever is stored, so
      // the *stored* value has to live somewhere JS can re-read it every
      // frame rather than only inside the uniform, which render() is about
      // to start overwriting with base-plus-bias. cam gets the same ramp
      // treatment (entry 92) purely for consistency of the mechanism —
      // nothing currently calls setLayerColour('cam', ...) with a nonzero
      // rampS, since a passthrough tint answering the phone's own tilt
      // would be a stranger kind of feature than this one.
      if (layer === 'geo') {
        startColourRamp(geoColourRamp, baseGeoColour, colour, rampS)
      } else if (layer === 'atm') {
        startColourRamp(atmColourRamp, baseAtmColour, colour, rampS)
      } else {
        startColourRamp(camColourRamp, baseCamColour, colour, rampS)
      }
    },

    setMotion(tiltX, tiltY, disturb, busyness = 0) {
      motionTiltX = tiltX
      motionTiltY = tiltY
      motionDisturb = disturb
      motionBusyness = busyness
    },

    setGravity(g) {
      emitterGravityX = g?.x ?? 0
      emitterGravityY = g?.y ?? 0
      // docs/todo.md entry 132. Turning the chip off puts the bob back at
      // rest on the anchor at once rather than leaving the picture hanging
      // off-anchor with the feature disabled — and makes the next
      // switch-on start from rest instead of from wherever the swing was
      // left. `uOrigin` itself is no longer set here (docs/todo.md entry
      // 141 made it a per-frame write in the render loop above, which picks
      // up the anchor on the very next frame) — only `compositeUniforms.
      // uGravity`, which nothing else resets.
      const on = g !== null
      if (gravityOn && !on) {
        resetOrigin(originState)
        compositeUniforms.uGravity.value.set(0, 0)
      }
      gravityOn = on
    },

    setGeoAlpha(a) {
      // Stored, not written straight to the uniform: render() multiplies
      // this by the view dip's own multiplier every frame (entry 92).
      baseGeoAlpha = Math.min(1, Math.max(0, a))
    },

    setAtmAlpha(a) {
      baseAtmAlpha = Math.min(1, Math.max(0, a))
    },

    setPassthrough(source, mix) {
      const current = compositeUniforms.uCamera.value
      const wantVideo = source?.video ?? null

      if ((current?.image ?? null) !== wantVideo) {
        // Dispose the old one before replacing it. A VideoTexture holds a GPU
        // texture that is re-uploaded every frame; leaking one per attach
        // would leak the upload too, not just the memory.
        current?.dispose()
        if (wantVideo) {
          const tex = new VideoTexture(wantVideo)
          tex.minFilter = LinearFilter
          tex.magFilter = LinearFilter
          tex.wrapS = ClampToEdgeWrapping
          tex.wrapT = ClampToEdgeWrapping
          compositeUniforms.uCamera.value = tex
        } else {
          compositeUniforms.uCamera.value = null
        }
        // The fit depends on the source's own dimensions, so it can only be
        // computed once there is a source.
        applyCameraFit()
      }

      compositeUniforms.uCameraMix.value = wantVideo
        ? Math.min(1, Math.max(0, mix))
        : 0
    },

    randomise() {
      const nextSeed: [number, number, number, number] = [Math.random(), Math.random(), Math.random(), Math.random()]
      uniforms.uSeed.value.set(...nextSeed)
      // docs/todo.md entry 146 — same reasoning as the structural boundary's
      // own re-roll above: a manual re-roll restructures the node ring too.
      chorusNodes = chorusNodeOffsets(nextSeed)
      nodeDrags.clear()
    },

    stats: () => ({
      frameMs,
      pixelRatio: RATIO_LADDER[rung],
      motion: { posture: lastMotion.posture, disturbance: lastMotion.disturbance, agitation: lastMotion.agitation },
      sky: { daylight: skyDaylight, warmth: skyWarmth, located: geoLocation !== null },
      moon: { illuminated: moonState.illuminated, waxing: moonState.waxing, presence: moonState.presence },
      ambient: {
        available: ambientLight !== null,
        lux: ambientLight?.lux() ?? null,
        exposure: compositeUniforms.uExposure.value,
      },
    }),

    dispose() {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      geometry.dispose()
      geometryMaterial.dispose()
      atmosphereMaterial.dispose()
      compositeMaterial.dispose()
      geometryTarget.dispose()
      atmosphereTarget.dispose()
      spectrumTexture.dispose()
      historyTexture.dispose()
      compositeUniforms.uCamera.value?.dispose()
      renderer.dispose()
    },
  }
}
