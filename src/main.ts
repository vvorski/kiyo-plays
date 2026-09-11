/**
 * Bootstrap and render loop.
 *
 * The two layers, the merge mode, the mix, and the audio mapping are all
 * swappable at runtime, from the control panel or from the URL. URL
 * parameters win over stored preferences, so a link can pin a specific
 * combination without permanently changing what the device remembers.
 */

import { bindKeyboard } from './keyboard'
import { DEFAULT_GEO_COLOUR, parseGeoColour } from './geo-colour'
import { startCamera, type CameraSource } from './camera'
import { createHud } from './hud'
import {
  createHoverState,
  createSynthShake,
  createTouchField,
  hoverLeft,
  MAPPINGS,
  moveHover,
  pointerAction,
  PRESS_SHAKE_PASSTHROUGH,
  shouldRaiseCamera,
  startSynthShake,
  toShaderUv,
  updateSynthShake,
  type Mapping,
  type MappingName,
} from './engine'
import {
  DEFAULT_ATM_MERGE_MODE,
  DEFAULT_MERGE_MODE,
  DEFAULT_MIX,
  isMergeModeName,
  type MergeModeName,
} from './merge-modes'
import {
  checkWebGL,
  fullscreenStatus,
  goFullscreen,
  keepAwake,
  onFullscreenChange,
  setFullscreenRetryTarget,
  waitForStart,
} from './permission-gate'
import { loadPrefs, type Prefs } from './prefs'
import { applyReleaseTone } from './release-tone'
import { mountShare } from './share'
import { Director } from './director'
import { createVisualiser, type Visualiser } from './scene'
import { RELEASE_NAME, releaseSeed, decodeSeedHex } from './release-name'
import {
  SlowAnalysis,
  createPostureState,
  updatePosture,
  celestialFor,
  CELESTIAL_IDENTITY,
  type CelestialInfluence,
  createCameraArmState,
  armCamera,
  disarmCamera,
  updateCameraArm,
} from './engine'
import { requestLocation, type GeoLocation } from './geo-location'
import { hasMotionPermissionGate, intensity, startShake, STILL_FRAME, type ShakeFrame } from './shake'
import { confirmBuzz, doubleBuzz, hapticStatus } from './haptics'
import { IdlePreview } from './idle-preview'
import { mountReleaseName, mountVersionHud, nameDecodeStatus, versionHudRunning } from './version'
import { mountQueuePanel } from './queue-panel'
import { mountPowder } from './powder'
import {
  DEFAULT_ATMOSPHERIC_VIEW,
  DEFAULT_GEOMETRIC_VIEW,
  isAtmosphericViewName,
  isGeometricViewName,
  type AtmosphericViewName,
  type GeometricViewName,
} from './views'
import { shuffled, dnaQuery, SHUFFLE_RESEED, SHUFFLE_VIEWS, SHUFFLE_EVERYTHING, CAMERA_ROLL_CHANCE, CAMERA_ROLL_MAX } from './session/look'
import { idleParams } from './session/idle'
import { createGestureState, dispatchGestures, noteDisturb, gesturesCalm } from './session/gestures'

/** Relative loudness: self-calibrates between a quiet room and a sound system. */
const DEFAULT_MAPPING: MappingName = 'relative'

function fail(message: string): void {
  const error = document.getElementById('error')
  const button = document.getElementById('start')
  if (error) error.textContent = message
  if (button instanceof HTMLButtonElement) button.disabled = true
}

/** A 0-100 URL parameter as a 0-1 value, or the fallback when absent or junk. */
function pct(raw: string | null, fallback: number): number {
  if (raw === null || Number.isNaN(Number(raw))) return fallback
  return Math.min(1, Math.max(0, Number(raw) / 100))
}

function resolvePrefs(): Prefs {
  const stored = loadPrefs({
    geometricView: DEFAULT_GEOMETRIC_VIEW,
    geoColour: DEFAULT_GEO_COLOUR,
    // White is identity for a colour gain, so a layer nobody has tinted looks
    // exactly as it always did.
    atmColour: { r: 1, g: 1, b: 1 },
    camColour: { r: 1, g: 1, b: 1 },
    atmosphericView: DEFAULT_ATMOSPHERIC_VIEW,
    mergeMode: DEFAULT_MERGE_MODE,
    atmMergeMode: DEFAULT_ATM_MERGE_MODE,
    mix: DEFAULT_MIX,
    geoAlpha: DEFAULT_MIX,
    atmAlpha: 1,
    passthrough: 0,
    mapping: DEFAULT_MAPPING,
    autopilot: true,
    showStats: false,
    gravity: false,
    day: false,
    skyOverride: 'auto',
  })

  // A URL parameter is an explicit instruction for this load and overrides what
  // the device remembers. `view` is kept as an alias for `atmospheric` — links
  // shared before the two-layer split still land somewhere sensible.
  const query = new URLSearchParams(window.location.search)
  const geometric = query.get('geometric')
  const rgb = parseGeoColour(query.get('rgb'))
  const atmospheric = query.get('atmospheric') ?? query.get('view')
  const merge = query.get('merge')
  const mix = query.get('mix')
  const geo = query.get('geo')
  const atm = query.get('atm')
  const mapping = query.get('mapping')

  return {
    geometricView: isGeometricViewName(geometric) ? geometric : stored.geometricView,
    geoColour: rgb ?? stored.geoColour,
    atmColour: stored.atmColour,
    camColour: stored.camColour,
    atmosphericView: isAtmosphericViewName(atmospheric) ? atmospheric : stored.atmosphericView,
    mergeMode: isMergeModeName(merge) ? merge : stored.mergeMode,
    // No `?atmMerge=` — not specified in scope, and stored is enough: this
    // control is reached from the HUD, not shared via link, at least for now.
    atmMergeMode: stored.atmMergeMode,
    mix: pct(mix, stored.mix),
    // ?mix= keeps meaning exactly what it always meant, because it is in links
    // already in the world: the geometric layer's opacity, with the atmosphere
    // full. ?geo= and ?atm= are the new pair and win when both are present —
    // new parameters are free, renaming or repurposing one is not.
    geoAlpha: pct(geo, pct(mix, stored.geoAlpha)),
    atmAlpha: pct(atm, mix !== null ? 1 : stored.atmAlpha),
    // Deliberately no `?camera=` parameter, though the Hard Stop on URL shape
    // would allow adding one freely. Every other parameter here sets how the
    // page *looks*; this one would set whether it reaches for a sensor, and a
    // link is not consent — a shared URL that silently opened someone's camera
    // is the exact shape of the thing the capture Hard Stop is protecting.
    // The camera is turned on from the HUD, by the person holding the phone.
    passthrough: 0,
    mapping: mapping && mapping in MAPPINGS ? (mapping as MappingName) : stored.mapping,
    // The autopilot is unconditional now (docs/todo.md entry 45) and nothing
    // reads this field to decide whether it runs any more — it survives here
    // only because the stored-shape rule keeps a field once added. `?auto=`
    // is handled separately, in main(), precisely so it never gets merged
    // into this object and saved back the next time an unrelated control
    // calls save() — see the comment there.
    autopilot: stored.autopilot,
    // `?debug` is deliberately NOT merged in here any more — docs/todo.md
    // entry 31. This field is "the setting this person chose", full stop;
    // what a `?debug` load shows on screen is a separate, per-load session
    // value the HUD tracks itself, passed to createHud below rather than
    // folded into a Prefs field that gets written back to storage.
    showStats: stored.showStats,
    // No URL parameter, deliberately — this changes the picture's motion at
    // rest rather than its appearance, and every parameter here today is the
    // latter. Reached from the HUD like autopilot and the numeric readout.
    gravity: stored.gravity,
    // No URL parameter either, for the same reason gravity has none — a
    // shared link is about what to show, not what the room looks like on
    // the far end. Reached from the HUD chip.
    day: stored.day,
    // Also no URL parameter, for the same reason. docs/todo.md entry 71.
    skyOverride: stored.skyOverride,
  }
}

/**
 * docs/todo.md entry 137 — the four numbers this load opens on. Deliberately
 * not part of `resolvePrefs()`/`Prefs`: this is read once, at construction,
 * and never written back to storage — a persisted seed would show your last
 * shape on every load, and the release's own seed (the whole point) would be
 * seen once, by whoever's storage is empty, and never again.
 *
 * `?seed=` beats the release seed, matching how `?rgb=` already outranks a
 * stored colour above; malformed or missing falls back the same way every
 * other parameter here already does.
 */
function resolveSeed(): readonly [number, number, number, number] {
  const raw = new URLSearchParams(window.location.search).get('seed')
  return (raw && decodeSeedHex(raw)) || releaseSeed()
}

/** docs/todo.md entry 92 — how long a colour ramp takes, by source: "a
 *  machine's changes ease; a person's changes are instant." The director
 *  gets a slow, visible travel; a shake reads as a single event rather
 *  than a graceful glide, so it gets a short one instead of the
 *  director's — both figures are **Mine**, Decided names neither. */
const COLOUR_RAMP_DIRECTOR_S = 2.0
const COLOUR_RAMP_SHAKE_S = 0.25

/**
 * Flash the screen white on a detected shake, when the numeric readout is on.
 *
 * The diagnostic, not the feedback — docs/todo.md entry 54 adds
 * `shakePulse()` below as the confirmation everyone gets, always on; this
 * one stays exactly as it is, gated and full-screen, for the debugging job
 * it already does well. The two now sit next to each other and the
 * difference is not obvious from the names alone, so: this is for someone
 * who already suspects a bug and turned the readout on to look for one;
 * `shakePulse()` is for someone who just shook the phone and wants to know
 * it heard them.
 *
 * Built for one report: "the shake isn't working, no double detection" — with
 * nothing to check it against but the eye. `probe:shake` passes every
 * synthetic case for both single and double, and `main.ts` reads the
 * frame's own event correctly (docs/todo.md entry 86), so nothing in the
 * code points at a bug. What is missing is the one thing a probe cannot
 * supply: whether *anything* is firing on this particular phone at all,
 * and if so, which kind.
 *
 * Gated on `panel.showingStats()` rather than a second `?debug` flag — that
 * already means "diagnostics are visible" and a flash on every shake once
 * this ships permanently would turn a quiet instrument into a strobe. Reads
 * the HUD's own session value rather than `prefs.showStats` directly, so a
 * `?debug` load gets the flash for that load without it persisting past a
 * reload — see docs/todo.md entry 31.
 *
 * A DOM overlay, not a shader uniform: it must be visible even if the render
 * path itself is the thing broken, and it must cost nothing when off.
 */
function flashShake(double: boolean): void {
  const el = document.getElementById('shake-flash')
  if (!el) return
  el.classList.remove('on', 'double')
  if (double) {
    // Restart the animation: removing and re-adding the class in the same
    // tick would be coalesced by the browser into no change at all.
    void el.offsetWidth
    el.classList.add('double')
  } else {
    el.classList.add('on')
    requestAnimationFrame(() => el.classList.remove('on'))
  }
}

/** Faintest and boldest a shake pulse's edge ever gets — docs/todo.md
 *  entry 54. `intensity()` is 0 at the gentlest qualifying shake and 1 at
 *  PEAK_CEILING, and 0 opacity would mean the gentlest shake that counts
 *  produces no confirmation at all — the exact failure this entry exists
 *  to close. **Mine**, no value named in the entry beyond "scale with
 *  depth". */
const PULSE_MIN = 0.15
const PULSE_MAX = 0.9

/**
 * The always-on confirmation that a shake was accepted — docs/todo.md
 * entry 54. `#shake-flash` above is the diagnostic (gated behind the
 * numeric readout); this is the feedback, ungated, for the same two event
 * kinds a frame's own `events[0]` ever carries (`'strong'`/`'double'`,
 * docs/todo.md entry 86) — never for mere disturbance, which the tumble
 * already answers continuously. `peak` sets `--pulse-amt` via
 * `intensity()`, the same normaliser the buzz and the shuffle's depth
 * already share, so a light shake gets a faint edge and a hard one an
 * unmistakable one.
 *
 * A DOM overlay outside the canvas, like `#shake-flash` and the capture
 * glyph: it must be visible even if the render path is the thing broken,
 * and a screenshot (which reads the canvas) can never contain it.
 */
function shakePulse(double: boolean, peak: number): void {
  const el = document.getElementById('shake-pulse')
  if (!el) return
  const amt = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * intensity(peak)
  el.style.setProperty('--pulse-amt', String(amt))
  el.classList.remove('on', 'double')
  // Restart the animation even if one is already mid-flight — the same
  // reflow trick flashShake's double path uses, needed here for both
  // shapes since an animation (unlike shake-flash's transition-driven
  // `.on`) does not restart just by re-adding a class that was never
  // removed for a frame.
  void el.offsetWidth
  el.classList.add(double ? 'double' : 'on')
}

/**
 * A camera glyph confirming a screenshot was saved, fading within about
 * half a second — docs/todo.md entry 41. Not `#shake-flash`'s white `.on`
 * fade, which this used to reuse: with the readout on, a single shake and
 * a capture produced the exact same full-screen white flash, which is
 * indistinguishable at exactly the moment someone is trying to tell them
 * apart. A distinct glyph fixes that and reads more clearly now that the
 * capture zone is a third of the screen rather than a fifteenth of it.
 *
 * Never gated behind `showStats`, unlike flashShake: this is feedback for
 * an action just taken, not a diagnostic. A DOM overlay outside the
 * canvas, so it can never end up in the saved PNG — the capture reads the
 * canvas, drawn and read before this is ever called.
 */
function flashCapture(): void {
  const el = document.getElementById('capture-flash')
  if (!el) return
  el.classList.add('on')
  requestAnimationFrame(() => el.classList.remove('on'))
}

/**
 * The one mechanical gesture a camera makes — docs/todo.md entry 72. A
 * keyframe animation, unlike flashCapture's transition-based flash above,
 * so it needs the reflow-restart trick flashShake's own double-tap path
 * already established: removing and re-adding the same class in one tick
 * would be coalesced into no change at all.
 */
function flashShutter(): void {
  const el = document.getElementById('shutter-glyph')
  if (!el) return
  el.classList.remove('pulse')
  void el.offsetWidth
  el.classList.add('pulse')
}

// The three zones this used to carve the screen into — CAPTURE_BAND_FRACTION,
// safeBottomInset() and zone() — are retired by docs/todo.md entry 52: a
// single tap now saves and a double opens, anywhere on the screen, with no
// region either belongs to. See dispatchGestures() in session/gestures.ts.

/** How many captures this session has already saved. Widens the counter's
 *  own padding past 99 on its own — docs/todo.md entry 26. */
let captureCount = 0

/**
 * Save the current frame as a PNG, named with the build it came from — the
 * difference between a bug report that can be acted on and one that cannot.
 *
 * The timestamp is the phone's own local time, not UTC — the person who has
 * to find this file reads their own clock, and a name an hour off its own
 * screenshot is worse than no timestamp; nothing here is ever compared
 * across devices, so the ambiguity a local stamp introduces costs nothing.
 * It is cut to the second, not the minute a first version of this used,
 * because a tap is not a long-running job and two of them a minute apart
 * are entirely reachable. Seconds alone are still not *unique*, though —
 * two taps inside the same second are reachable too, and wall-clock time on
 * a phone is not even monotonic: a handset picking up NTP mid-session can
 * hand back an *earlier* stamp than one it already used, which no amount of
 * resolution fixes. `captureCount` is what actually guarantees a name
 * nothing else can take; the timestamp exists to make that name legible,
 * not to make it unique.
 */
function saveCapture(visualiser: Visualiser): void {
  visualiser.requestCapture((blob) => {
    if (!blob) return
    const pad = (n: number, width = 2): string => String(n).padStart(width, '0')
    const now = new Date()
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    captureCount++
    const stamp = `${date}-${time}-${pad(captureCount)}`
    const name = `kiyo-${__BUILD_NUMBER__}-${RELEASE_NAME.replace(/\s+/g, '-')}-${stamp}.png`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    // Not added to the DOM: Chrome and Firefox both fire a synthetic click
    // on a detached <a> without complaint, and this element has no reason to
    // outlive the click that triggers it.
    a.click()
    // Revoked on a delay rather than immediately: revoking before the
    // browser has actually started the download can cancel it, especially
    // on the platforms this matters most for (a slower phone under load).
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    flashCapture()
  })
}

async function main(): Promise<void> {
  const canvas = document.getElementById('canvas')
  const gate = document.getElementById('gate')
  const button = document.getElementById('start')
  const error = document.getElementById('error')

  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !gate ||
    !(button instanceof HTMLButtonElement) ||
    !error
  ) {
    throw new Error('missing required elements in index.html')
  }

  mountVersionHud()
  applyReleaseTone(__BUILD_NUMBER__)
  mountReleaseName()
  mountQueuePanel()
  mountShare()
  // docs/todo.md entry 62: the fullscreen retry re-requests on the next tap
  // of the picture itself, never `window` — set once, here, well before the
  // first tap that could ever need it.
  setFullscreenRetryTarget(canvas)

  if (!checkWebGL()) {
    fail('This browser does not support WebGL2, which this page needs to draw.')
    return
  }

  const prefs = resolvePrefs()
  // docs/todo.md entry 137 — the four numbers this load opens on, computed
  // once here and read only at construction below.
  const seed = resolveSeed()

  // docs/todo.md entry 45: the autopilot is unconditional now, and
  // `prefs.autopilot` is kept only as a stored-shape fact, no longer
  // consulted below. `?auto=0` (or `off`) is the one way left to run with it
  // off, and read straight from the URL rather than merged into `prefs` —
  // see the comment on that field in resolvePrefs() — so a session that asks
  // for it can never leak the choice into storage via an unrelated save().
  const autoParam = new URLSearchParams(window.location.search).get('auto')
  const autoOverrideOff = autoParam === '0' || autoParam === 'off'

  // Built before the gate resolves, not after.
  //
  // The start screen used to be a page *about* the piece — a title, a button
  // and some invented decoration standing in for what the app does. It can
  // simply be the piece instead, running quietly behind the words, because
  // nothing about the renderer needs the microphone: it needs numbers, and
  // idleParams() below makes plausible ones. The gate becomes an overlay on
  // something real rather than a poster for something absent.
  //
  // docs/todo.md entry 60: the poster it stands in front of is rolled fresh
  // on every load — colours, both views, both merge modes, via the same
  // shuffled() a shake already uses — rather than showing whatever was last
  // stored, forever. This is `shuffled()` called directly, never through
  // `panel.adopt()`: adopt() writes to `prefs` and calls `save()`, and the
  // whole point here is a look nobody's picture actually has. `current` is
  // passed only to satisfy the signature — at SHUFFLE_VIEWS every field it
  // reads is above SHUFFLE_RESEED, so `shuffled()` takes the full-reroll
  // branch and never looks at it. A `?rgb` link keeps the colour it names —
  // the roll is skipped outright rather than carved around just that one
  // field, since "the gate shows your stored picture" is exactly correct
  // for a link that asked for a specific one. **Mine.**
  const rgbRequested = parseGeoColour(new URLSearchParams(window.location.search).get('rgb')) !== null
  const gateLook = rgbRequested
    ? null
    : shuffled(SHUFFLE_VIEWS, {
        geoColour: prefs.geoColour,
        atmColour: prefs.atmColour,
        geoAlpha: prefs.geoAlpha,
        atmAlpha: prefs.atmAlpha,
      })
  const visualiser = createVisualiser(canvas, {
    geometricView: gateLook?.geometricView ?? prefs.geometricView,
    geoColour: gateLook?.geoColour ?? prefs.geoColour,
    atmColour: gateLook?.atmColour ?? prefs.atmColour,
    camColour: prefs.camColour,
    atmosphericView: gateLook?.atmosphericView ?? prefs.atmosphericView,
    mergeMode: gateLook?.mergeMode ?? prefs.mergeMode,
    atmMergeMode: gateLook?.atmMergeMode ?? prefs.atmMergeMode,
    geoAlpha: prefs.geoAlpha,
    atmAlpha: prefs.atmAlpha,
    seed,
  })

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
  let shake = hasMotionPermissionGate() ? startShake(false) : startShake(true)
  // Only used to turn devicemotion's own irregular cadence into a proper dt
  // for shake.frame() during the idle preview — the live loop already has
  // audio.dt for this once the real render loop takes over below.
  let lastGateShakeAt = idleStart

  // docs/todo.md entry 126 — the space bar's own synthetic shake. `held` is
  // set by keydown/keyup/blur (bindKeyboard below); `synthShake` is the pure
  // state `updateSynthShake` advances once a frame, in the same render loop
  // that calls `shake.frame()`, so a synthesised sample reaches this frame's
  // `Tumble.advance()` the same way a real `devicemotion` sample would.
  let spaceHeld = false
  const synthShake = createSynthShake()

  // The powder easter egg — docs/todo.md entry 46. Wired here, before Start,
  // since the entry's whole point is a secret found on the screen everyone
  // sees first, not a mode reachable only after the app has already started.
  //
  // docs/todo.md entry 61 widens this from tilt alone to tilt plus disturb
  // plus a shake's scatter impulse — one motion source, still, per the
  // module's own comment on why it takes a getter rather than a sensor
  // reference.
  //
  // docs/todo.md entry 86 — `latestShake` is the one place either loop below
  // (idle, then real) publishes the snapshot its own once-per-frame
  // `shake.frame()` call produced; the powder reads it here rather than
  // calling into `shake` a second time, but reading it is no longer
  // consuming, unlike the pending-flag variables this replaces. Two watchers
  // of the same frame — this closure and whichever loop just produced it —
  // now see the same shake rather than racing over which one drains it
  // first.
  let latestShake: ShakeFrame = STILL_FRAME
  const powder = mountPowder(() => {
    // A double is also a strong for the powder's purposes — it does not
    // distinguish kinds, only "was there an impulse this frame" — so either
    // event in the frame counts.
    const strongPeak = latestShake.events[0]?.peak ?? 0
    return { tilt: latestShake.tilt, disturb: latestShake.disturb, strongPeak }
  })
  let stopGateTaps: () => void = () => {}
  {
    // Each tap has to land within this many milliseconds of the one before
    // it to count toward the three — **Mine**, matching the entry's own
    // number for the trigger.
    const TAP_WINDOW_MS = 600
    let tapCount = 0
    let lastTapAt = 0
    // On `document`, not `#gate` — "getting out" is the same three taps
    // (Decided), landing on `#powder-canvas` while the gate is hidden, which
    // is a DOM sibling of `#gate` rather than a descendant of it. A listener
    // scoped to `#gate` would never see them once `#gate` is
    // `display:none`, since a real tap cannot land on an element that is not
    // rendered — only a synthetic, script-dispatched one can, which is how
    // this gap first went unnoticed. `#version-hud` needs an explicit
    // exclusion here that it did not need when the listener lived on
    // `#gate`, for the same reason: it is a sibling, not a descendant, so it
    // is not excluded "for free" by scoping any more.
    //
    // Removed the instant Start resolves (see below) — a `document`-level
    // tap counter left running into the real session would mean three quick
    // taps on the running picture itself (a thing entries 41/48/50 all make
    // completely ordinary) could summon an easter egg mid-session. The
    // powder is a fact about the gate, not about the app.
    const onGateTap = (e: PointerEvent): void => {
      // Every other control on this screen has the same claim to its own
      // taps as Start does — a `closest()` test rather than a coordinate
      // box, so this cannot drift when a later entry moves one of them
      // around, and it applies in both directions: reload must not count
      // toward either entering or leaving the powder.
      if (e.target instanceof Element && e.target.closest('#start, #share, #qr, #version-hud')) return
      const now = performance.now()
      tapCount = now - lastTapAt <= TAP_WINDOW_MS ? tapCount + 1 : 1
      lastTapAt = now
      if (tapCount === 3) {
        tapCount = 0
        powder.toggle()
        // "Swap the gate for a black field" is two elements changing
        // together, not one: `#gate`'s own z-index (10) sits above
        // `#powder`'s (6) so the black field would otherwise render
        // underneath it, fully hidden, rather than replacing it. Hiding
        // the gate rather than tearing it down is what makes "leaving must
        // be exact" (Decided) free — there is nothing here to rebuild.
        gate.hidden = powder.active
        // docs/todo.md entry 61: the third tap is itself a live user gesture,
        // so requestFullscreen() is allowed here — this is not one of the
        // dialog-opening calls permission-gate.ts's own comment warns against
        // spending the gesture on. Only on the way in: leaving the egg does
        // not leave fullscreen (Decided, Mine), so there is no matching
        // exitFullscreen() call on the other branch of this toggle.
        if (powder.active) goFullscreen()
      }
    }
    document.addEventListener('pointerup', onGateTap)
    stopGateTaps = () => document.removeEventListener('pointerup', onGateTap)
  }

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
    if (live) return
    const wasStopped = idle.isStopped
    idle.touch(performance.now())
    if (wasStopped) requestAnimationFrame(idleFrame)
  }
  document.addEventListener('pointerdown', resumeIdle)
  document.addEventListener('pointermove', resumeIdle)

  const idleFrame = (now: number): void => {
    if (live) return
    if (idle.tick(now)) {
      const t = (now - idleStart) / 1000
      // The tumble, and nothing else: no re-seed, no shuffle, at any
      // intensity. There is no audio yet and the idle programme is fixed, so
      // rerolling anything here would change what the person is about to
      // walk into for reasons they cannot connect to anything they did. A
      // double firing here used to need an explicit discard so it would not
      // also fire the instant the real loop started reading afterwards —
      // docs/todo.md entry 86 removes the need outright: `latestShake` is
      // just replaced wholesale next frame, by whichever loop calls
      // `shake.frame()` next, so there is nothing left over to discard.
      const dt = (now - lastGateShakeAt) / 1000
      lastGateShakeAt = now
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
  requestAnimationFrame(idleFrame)

  const { source, motion } = await waitForStart({ gate, button, error })
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
  document.removeEventListener('pointerdown', resumeIdle)
  document.removeEventListener('pointermove', resumeIdle)
  // The powder easter egg is a fact about the gate, not about the running
  // app — docs/todo.md entry 46. Its tap counter goes with the gate rather
  // than living on into the session, where three quick taps on the running
  // picture are something entries 41/48/50 all make completely ordinary.
  stopGateTaps()
  // The gate is going; the version chip drops to its running form — no name,
  // and a reload button that fades out of the way. See versionHudRunning().
  versionHudRunning()
  void keepAwake()

  // Replaces the gate's stub on iOS/iPadOS with a real sensor once the start
  // gesture's own motion result is in; everywhere else `shake` already is
  // the real thing and has been running since load, so this is a no-op.
  if (hasMotionPermissionGate()) shake = startShake(motion)

  /** Roll a new picture at the given depth and let the panel adopt it, so the
   *  HUD opened afterwards shows what is actually on screen rather than what
   *  was. Below SHUFFLE_RESEED the four continuous quantities nudge from
   *  whatever `panel.current()` reports rather than being replaced — entry
   *  35 — which is why `shuffled()` needs to read them fresh on every call
   *  rather than being handed a value that could go stale between shakes.
   *  The seed only re-rolls once SHUFFLE_RESEED is reached — see
   *  shuffled()'s own file comment for why the two used to be backwards
   *  from each other. */
  const shuffle = (depth: number): void => {
    const next = shuffled(depth, panel.current())
    panel.adopt(next, COLOUR_RAMP_SHAKE_S)
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
   * raising the camera needs `applyPassthrough()`'s async work, a kind of
   * gate no other field in the shuffle has. Runs after `shuffle()` rather
   * than inside it, and updates the panel itself once resolved rather than
   * folding into the same `adopt()` call — the level is not known yet when
   * `shuffle()` returns.
   */
  function maybeRollCamera(depth: number): void {
    if (depth < SHUFFLE_EVERYTHING) return
    // docs/todo.md entry 72: the director must not fight camera mode — it
    // may keep rolling views and colours while the mode is on, but the
    // passthrough level is borrowed for the duration and is not its own to
    // touch. `cameraMode` is declared further down this same closure, but
    // this function is only ever called later (from shuffle(), on a real
    // shake), well after that declaration has already run.
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
      // `devicemotion` event is not. This one is unchanged. `cameraSource` is declared further
      // down this same closure but, as with `cameraMode` above, this
      // function only ever runs later, after that declaration.
      if (level > 0 && !(cameraSource?.isLive() ?? false)) return
      const actual = await applyPassthrough(level)
      panel.adopt({ passthrough: actual }, 0)
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
   * `applyPassthrough` then `panel.adopt` — so the band, `prefs.passthrough`
   * and `localStorage` all agree without a second path through any of them.
   * A refused or absent camera needs nothing extra: `applyPassthrough`
   * already returns 0 and the band stays where it was.
   *
   * `cameraMode` and `cameraSource` are declared further down this same
   * closure; as with `maybeRollCamera` above, this only ever runs from the
   * frame loop, long after those declarations have.
   */
  function maybeRaiseCameraOnPress(): void {
    if (
      !shouldRaiseCamera({
        shake: true,
        fingersDown: gestures.fingersOnPicture > 0,
        panelOpen: document.querySelector('.hud-scrim.open') !== null,
        cameraMode,
        live: cameraSource?.isLive() ?? false,
      })
    ) {
      return
    }
    void (async () => {
      const actual = await applyPassthrough(PRESS_SHAKE_PASSTHROUGH)
      panel.adopt({ passthrough: actual }, 0)
    })()
  }

  let mapping: Mapping = MAPPINGS[prefs.mapping]()

  // The minutes tier and the thing that acts on it. Kept out of `mapping` on
  // purpose: a mapping swap throws away several seconds of envelope state,
  // which is the right call for a fast tier and exactly the wrong one for a
  // five-minute buffer.
  const slow = new SlowAnalysis()
  const director = new Director()
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

  /** Held open only while passthrough is actually showing. See applyPassthrough. */
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
  async function applyPassthrough(mix: number): Promise<number> {
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

  // How long the glyph's own fade-out takes once an automatic expiry
  // decides to leave camera mode — matches index.html's own
  // `#shutter-glyph.fading` transition duration. **Mine**: entry 109 asks
  // for "visible rather than instantaneous" without a figure.
  const GLYPH_FADE_MS = 600
  let glyphFadeTimeout = 0

  // docs/todo.md entry 109 — only the automatic-expiry path fades; a manual
  // exit (a tap on the picture, or the chip) still hides the glyph
  // instantly via `exitCameraMode` below, unchanged since entry 87.
  function fadeOutGlyph(): void {
    const glyph = document.getElementById('shutter-glyph')
    if (!glyph || glyph.hidden) return
    window.clearTimeout(glyphFadeTimeout)
    glyph.classList.add('fading')
    glyphFadeTimeout = window.setTimeout(() => {
      glyph.hidden = true
      glyph.classList.remove('fading')
    }, GLYPH_FADE_MS)
  }

  function enterCameraMode(): void {
    if (cameraMode) return
    cameraMode = true
    const glyph = document.getElementById('shutter-glyph')
    if (glyph) {
      window.clearTimeout(glyphFadeTimeout)
      glyph.classList.remove('fading')
      glyph.hidden = false
    }
    armCamera(cameraArmState, performance.now() / 1000)
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
    window.clearTimeout(glyphFadeTimeout)
    const glyph = document.getElementById('shutter-glyph')
    if (glyph) {
      glyph.classList.remove('fading')
      glyph.hidden = true
    }
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
  // nothing an interrupted gesture can leave behind — `unsoloLayer` just
  // re-reads whatever the true current values are at the moment it is
  // called, which is correct even if something else (a shuffle, the
  // director) moved them while the chip was held.
  //
  // The camera layer's own opacity, `prefs.passthrough`, is forced through
  // `visualiser.setPassthrough` directly rather than through
  // `applyPassthrough` — that function closes the live stream outright on
  // any mix <= 0 (see its own comment: holding a powered, undrawn camera
  // open is exactly the OS-indicator problem it exists to prevent), which
  // would turn a momentary solo into tearing down and re-acquiring the
  // actual camera on every press and release. Forcing the render value
  // alone leaves `cameraSource` untouched throughout.
  function soloLayer(layer: 'geo' | 'atm' | 'cam'): void {
    if (layer !== 'geo') visualiser.setGeoAlpha(0)
    if (layer !== 'atm') visualiser.setAtmAlpha(0)
    if (layer !== 'cam') visualiser.setPassthrough(cameraSource, 0)
  }

  function unsoloLayer(): void {
    visualiser.setGeoAlpha(prefs.geoAlpha)
    visualiser.setAtmAlpha(prefs.atmAlpha)
    visualiser.setPassthrough(cameraSource, cameraSource ? prefs.passthrough : 0)
  }

  const panel = createHud(prefs, {
    onGeometricView: (name: GeometricViewName) => visualiser.setGeometricView(name),
    onColour: (layer, colour, rampS) => visualiser.setLayerColour(layer, colour, rampS),
    onAtmosphericView: (name: AtmosphericViewName) => visualiser.setAtmosphericView(name),
    onMergeMode: (layer, mode: MergeModeName) => visualiser.setMergeMode(layer, mode),
    onAlpha: (layer, a) => {
      if (layer === 'geo') visualiser.setGeoAlpha(a)
      else visualiser.setAtmAlpha(a)
    },
    // Mappings carry several seconds of internal state (running means, feature
    // history), none of which is transferable, so switching starts a fresh one
    // rather than trying to hand the old state over.
    onMapping: (name: MappingName) => {
      mapping = MAPPINGS[name]()
    },
    onPassthrough: applyPassthrough,
    onSolo: soloLayer,
    onUnsolo: unsoloLayer,
    onManualChange: () => director.suspend(),
  }, new URLSearchParams(window.location.search).has('debug'))

  bindKeyboard({
    // docs/todo.md entry 126 — `visualiser.randomise()` used to be called
    // directly here; it is now reached *through* the shake, same as a real
    // one, because a held space bar re-seeds by shaking hard enough for
    // long enough, exactly like a hand would. Starting the gesture rolls a
    // fresh bearing (see synth-shake.ts) so a second tap does not inherit
    // the first's fading direction.
    onShakeStart: () => {
      spaceHeld = true
      startSynthShake(synthShake)
    },
    onShakeEnd: () => {
      spaceHeld = false
    },
    // docs/todo.md entry 116 — the same one path the `num` chip takes, not a
    // second implementation of it.
    onToggleStats: () => panel.toggleStats(),
  })

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
  const isChip = (t: EventTarget | null): boolean => t instanceof Element && t.closest('.hud-chip') !== null

  const touchField = createTouchField()
  // docs/todo.md entry 112 — the mouse cursor's own state, owned here beside
  // the touch field because this is where the pointer events are. The
  // hover never enters `touchField`: a cursor resting on the glass would be
  // a finger permanently down, holding `touchAnyDown` true for ever and
  // parking the tap recogniser below mid-gesture.
  const hover = createHoverState()
  // The gesture recogniser's own memory between frames — docs/todo.md
  // entries 41, 50, 67, 103, 115, 117, 125, 141 and 146 — moved to
  // session/gestures.ts so it is drivable from Node; see that file's own
  // field comments (mousePointers, contactIdFor and the rest) for what each
  // part of this remembers and why.
  const gestures = createGestureState()

  document.addEventListener('pointerdown', (e) => {
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
      if (isChip(e.target) || e.target !== canvas) return
      // Right click while armed leaves the mode without taking a picture —
      // entry 72's "two fingers always means get me out of what I am in",
      // applied to the device that has a second button. Entry 87 locked the
      // menu out during the mode, which was right when the only exit was the
      // shot; a mode whose exits are a photo or a fifteen-second timeout is
      // one a right click should be able to leave.
      // `exitCameraMode` leaves without opening anything since entry 115
      // took its `panel.open()` out, so this is a plain disarm and the
      // `panel.open()` below is the right click's own doing.
      if (cameraMode) exitCameraMode()
      gestures.lastTap = null
      panel.open()
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
    touchField.down(performance.now() / 1000, e.pointerId, x, y, e.clientX, e.clientY, isChip(e.target), '')
  })
  document.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect()
    const [x, y] = toShaderUv(e.clientX, e.clientY, rect)
    touchField.move(performance.now() / 1000, e.pointerId, x, y, e.clientX, e.clientY)
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
    moveHover(hover, performance.now() / 1000, x, y)
  })
  // docs/todo.md entry 112 — the cursor leaving. `relatedTarget === null` is
  // what distinguishes leaving the *window* from merely crossing between two
  // elements inside it, which fires `pointerout` constantly and must not stop
  // anything. `blur` covers the case `pointerout` cannot see at all: a
  // window switched away from with the cursor still over it.
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'mouse' && e.relatedTarget === null) hoverLeft(hover)
  })
  window.addEventListener('blur', () => hoverLeft(hover))
  document.addEventListener('pointerup', (e) => {
    touchField.up(e.pointerId)
    gestures.mousePointers.delete(e.pointerId)
  })
  document.addEventListener('pointercancel', (e) => {
    touchField.cancel(e.pointerId)
    gestures.mousePointers.delete(e.pointerId)
  })
  // A lost capture (another element or the browser chrome stealing it
  // mid-drag) is not followed by pointerup or pointercancel on this target
  // — the same "handed between people" scenario entry 49's field is built
  // to survive.
  document.addEventListener('lostpointercapture', (e) => touchField.cancel(e.pointerId))
  // docs/todo.md entry 117 — the browser's own context menu must not open
  // over the picture, since a right click there is now the way into this
  // app's menu. Bound on the canvas rather than the document on purpose: a
  // right click on a `.hud-chip`, on the gate, or anywhere else keeps the
  // browser's menu, which is the escape hatch for anyone who needs it.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())

  // The way back into fullscreen once it has been lost — docs/todo.md entry
  // 19. Shown only for `exited`/`refused`, never `active` (nothing to offer),
  // `unasked` (nothing has gone wrong yet) or `unsupported` (a button that
  // can never work is worse than no button). Fixed in the top-left utility
  // corner by index.html's own CSS (entry 25) rather than placed on the
  // HUD's icon arc, so this only ever toggles visibility — no positioning,
  // no resize listener, and no reserved slot on a row this chip is no
  // longer part of.
  {
    const chip = document.getElementById('fullscreen-chip')
    if (chip instanceof HTMLButtonElement) {
      const updateFullscreenChip = (): void => {
        chip.hidden = !['exited', 'refused'].includes(fullscreenStatus().state)
      }
      chip.addEventListener('pointerup', (e) => {
        // Stops here, at the target, before hud.ts's own bubble-phase
        // tap-to-open listener on `document` ever sees it — the same guard
        // every existing chip already applies in mkChip().
        e.stopPropagation()
        goFullscreen()
      })
      onFullscreenChange(updateFullscreenChip)
      updateFullscreenChip()
    }
  }

  window.addEventListener('resize', visualiser.resize)
  // iOS fires resize before the viewport has settled after a rotation, so the
  // first measurement is the old orientation's. Re-measure a beat later.
  window.addEventListener('orientationchange', () => {
    window.setTimeout(visualiser.resize, 250)
  })

  let running = true
  const frame = () => {
    if (!running) return
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
          performance.now() / 1000,
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
          fadeOutGlyph()
        }
      }
      sinceCelestialSample += audio.dt
      if (sinceCelestialSample >= CELESTIAL_SAMPLE_S) {
        sinceCelestialSample = 0
        celestialSample = celestialFor(new Date(), geoLocationForDirector)
      }

      if (!autoOverrideOff) {
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
        if (next) panel.adopt(next, COLOUR_RAMP_DIRECTOR_S)
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
      noteDisturb(gestures, latestShake.disturb, performance.now() / 1000)
      dispatchGestures(gestures, performance.now() / 1000, {
        field: touchField,
        hover,
        visualiser,
        shellOpen: document.querySelector('.hud-scrim.open') !== null,
        gateShowing: !gate.hidden,
        fullscreenBlocking: fullscreenStatus().want && !document.fullscreenElement,
        canvas,
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
      const panelOpen = document.querySelector('.hud-scrim.open') !== null
      // `frame()` has already resolved double-vs-strong precedence — see its
      // own comment in shake.ts — so at most one of these ever applies.
      const event = latestShake.events[0]
      if (event?.kind === 'double') {
        const doublePeak = event.peak
        if (!panelOpen) {
          if (panel.showingStats()) flashShake(true)
          shakePulse(true, doublePeak)
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
          if (panel.showingStats()) flashShake(false)
          shakePulse(false, strongPeak)
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
      panel.update(params, {
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
          blocked: !gesturesCalm(gestures, performance.now() / 1000),
          sinceDisturbed: Math.min(99, performance.now() / 1000 - gestures.lastDisturbedAt),
        },
        // docs/todo.md entry 137 — the whole look, live, as one copyable
        // string. Recomputed every visible frame like everything else on
        // this readout; a URLSearchParams-worth of string building is not
        // something a numeric debug overlay needs to worry about the cost of.
        dna: `${window.location.origin}${window.location.pathname}?${dnaQuery(prefs, seed)}`,
      })
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  window.addEventListener('pagehide', () => {
    running = false
    visualiser.dispose()
    shake.close()
    source.close()
    // Release the camera on the way out like every other capture here. A
    // backgrounded tab holding an open video track keeps the sensor awake and
    // the indicator lit with nothing on screen to explain it.
    cameraSource?.close()
  })
}

void main().catch((err: unknown) => {
  console.error(err)
  fail(err instanceof Error ? err.message : 'Something went wrong.')
})
