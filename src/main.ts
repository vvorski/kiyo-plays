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
import { createHud, type Hud } from './hud'
import { MAPPINGS, type MappingName } from './engine'
import {
  DEFAULT_ATM_MERGE_MODE,
  DEFAULT_MERGE_MODE,
  DEFAULT_MIX,
  isMergeModeName,
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
import { createVisualiser } from './scene'
import { RELEASE_NAME, releaseSeed, decodeSeedHex } from './release-name'
import { intensity } from './shake'
import { mountReleaseName, mountVersionHud, versionHudRunning } from './version'
import { mountQueuePanel } from './queue-panel'
import { mountPowder } from './powder'
import {
  DEFAULT_ATMOSPHERIC_VIEW,
  DEFAULT_GEOMETRIC_VIEW,
  isAtmosphericViewName,
  isGeometricViewName,
} from './views'
import { shuffled, SHUFFLE_VIEWS } from './session/look'
import { createSession, type LookPatch, type Shell } from './session'

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
 * synthetic case for both single and double, and the session reads the
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
 * Save a captured frame as a PNG, named with the build it came from — the
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
function saveCapture(blob: Blob): void {
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
  // idleParams() makes plausible ones. The gate becomes an overlay on
  // something real rather than a poster for something absent.
  //
  // docs/todo.md entry 60: the poster it stands in front of is rolled fresh
  // on every load — colours, both views, both merge modes, via the same
  // shuffled() a shake already uses — rather than showing whatever was last
  // stored, forever. This is `shuffled()` called directly, never through the
  // session's own `apply()`: that writes to `prefs` and saves, and the
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

  // How long the glyph's own fade-out takes once an automatic expiry
  // decides to leave camera mode — matches index.html's own
  // `#shutter-glyph.fading` transition duration. **Mine**: entry 109 asks
  // for "visible rather than instantaneous" without a figure.
  const GLYPH_FADE_MS = 600
  let glyphFadeTimeout = 0

  // Declared with `let` so the shell can reach it — the HUD is built after
  // the session, because the HUD's handlers need the session's apply().
  let panel: Hud | null = null

  const shell: Shell = {
    lookChanged: () => panel?.adopt({}, 0),
    isOpen: () => document.querySelector('.hud-scrim.open') !== null,
    open: () => panel?.open(),
    ownsTarget: (t) => t instanceof Element && t.closest('.hud-chip') !== null,
    update: (params, stats) => panel?.update(params, stats),
    shakeFeedback: (kind, peak) => {
      if (panel?.showingStats()) flashShake(kind === 'double')
      shakePulse(kind === 'double', peak)
    },
    cameraGlyph: (state) => {
      const glyph = document.getElementById('shutter-glyph')
      if (state === 'fading') {
        // docs/todo.md entry 109 — only the automatic-expiry path fades; a
        // manual exit (a tap on the picture, or the chip) still hides the
        // glyph instantly via the `off` branch below, unchanged since
        // entry 87.
        if (!glyph || glyph.hidden) return
        window.clearTimeout(glyphFadeTimeout)
        glyph.classList.add('fading')
        glyphFadeTimeout = window.setTimeout(() => {
          glyph.hidden = true
          glyph.classList.remove('fading')
        }, GLYPH_FADE_MS)
        return
      }
      if (state === 'armed') {
        if (glyph) {
          window.clearTimeout(glyphFadeTimeout)
          glyph.classList.remove('fading')
          glyph.hidden = false
        }
        return
      }
      window.clearTimeout(glyphFadeTimeout)
      if (glyph) {
        glyph.classList.remove('fading')
        glyph.hidden = true
      }
    },
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

  // The interim double write, until the HUD itself becomes a Shell: the
  // handlers below hand every manual change to `session.apply()`, which
  // assigns `prefs` and saves — and `createHud`'s own bands still assign the
  // same field and save again on the way past. Same value into the same
  // store, so it is harmless; it is noted here rather than worked around
  // because working around it means changing hud.ts, which is its own step.
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
    // apply() with source 'manual' already suspends the director.
    onManualChange: () => {},
  }, new URLSearchParams(window.location.search).has('debug'))

  // The powder easter egg — docs/todo.md entry 46. Wired here, before Start,
  // since the entry's whole point is a secret found on the screen everyone
  // sees first, not a mode reachable only after the app has already started.
  //
  // docs/todo.md entry 61 widens this from tilt alone to tilt plus disturb
  // plus a shake's scatter impulse — one motion source, still, per the
  // module's own comment on why it takes a getter rather than a sensor
  // reference.
  //
  // docs/todo.md entry 86 — `session.motion()` is the one place either of
  // the session's loops (idle, then real) publishes the snapshot its own
  // once-per-frame `shake.frame()` call produced; the powder reads it here
  // rather than calling into the sensor a second time, but reading it is no
  // longer consuming, unlike the pending-flag variables this replaces. Two
  // watchers of the same frame — this closure and whichever loop just
  // produced it — now see the same shake rather than racing over which one
  // drains it first.
  const powder = mountPowder(() => {
    const latestShake = session.motion()
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

  const { source, motion } = await waitForStart({ gate, button, error })
  // The powder easter egg is a fact about the gate, not about the running
  // app — docs/todo.md entry 46. Its tap counter goes with the gate rather
  // than living on into the session, where three quick taps on the running
  // picture are something entries 41/48/50 all make completely ordinary.
  stopGateTaps()
  // The gate is going; the version chip drops to its running form — no name,
  // and a reload button that fades out of the way. See versionHudRunning().
  versionHudRunning()
  void keepAwake()
  session.start(source, motion)

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

  bindKeyboard({
    onShakeStart: () => session.setSynthShake(true),
    onShakeEnd: () => session.setSynthShake(false),
    // docs/todo.md entry 116 — the same one path the `num` chip takes, not a
    // second implementation of it.
    onToggleStats: () => panel?.toggleStats(),
  })
}

void main().catch((err: unknown) => {
  console.error(err)
  fail(err instanceof Error ? err.message : 'Something went wrong.')
})
