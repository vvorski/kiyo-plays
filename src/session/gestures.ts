/**
 * The pointer recogniser, as pure state — docs/todo.md entries 41, 50, 67,
 * 103, 115, 117, 125, 141 and 146 all changed what a tap, a double, a hold
 * or a drag means, and every one of them landed inside `main.ts`'s own
 * `dispatchTouches` and its dozen surrounding closure variables, because
 * that was the only place any of this had ever lived. Moved here verbatim
 * — comments included — with the closure reshaped into `GestureState` (what
 * the recogniser remembers between frames) and `GestureDeps` (what it reaches
 * for outside itself), which is what makes `scripts/probe-gestures.ts`
 * possible: until this move, the only way to exercise a tap, a hold or a
 * double was a finger on a real screen.
 *
 * `dispatchGestures` runs once per rendered frame, same as `dispatchTouches`
 * did — CLAUDE.md's "sampled, not callback-driven" discipline `touches.ts`
 * already follows.
 */

import type { Visualiser } from '../scene'
import type { TouchField, HoverState } from '../engine'
import { updateHover, CHARGE_TIME } from '../engine/index.ts'

/** A tap that travels further than this is a drag or a swipe, not a tap —
 *  entry 27 removed the pointer-swipe gestures that once claimed anything
 *  past this boundary, so it now simply marks what a tap-to-open is not.
 *  Exported so main.ts's screenshot band uses the exact same boundary rather
 *  than a second copy of the same number. */
export const TAP_SLOP_PX = 12

// A tap plays; only a double opens the panel — docs/todo.md entry 103,
// replacing entry 52's tap-saves-a-frame design. Entry 87 built a
// deliberate two-tap camera shutter and it landed invisibly, because
// entry 52's ordinary tap already wrote a PNG of its own 400ms later —
// arming camera mode only changed *when* the save happened, never
// *whether* one did. The two reports this entry answers — an ordinary
// tap taking a photo, and the two-shot camera looking unbuilt — turn out
// to be the same fault: remove the save from a single tap and both close
// at once. Play is untouched by any of this: entry 50's emitter still
// fires on the raw `down`, immediately, never waiting on or cancelled by
// what a tap resolves to.
//
// The double still needs telling apart from two unrelated singles, so the
// window and radius below survive entry 52 even though what they gate no
// longer includes a save: a second qualifying tap arriving within
// TAP_RESOLVE_MS of the first, and close enough to it, opens the panel;
// if none arrives, the first tap simply did what a tap already does
// elsewhere — play — and nothing further happens.
//
// docs/todo.md entry 67: recognised on the second tap's *down*, not its
// *up*, and the window runs from the first tap's down rather than its
// release — down-to-down, the way every platform's own double-tap
// detector measures it, and the way a hand actually experiences "how fast
// did I tap": a deliberate double with real (non-zero) contact durations
// used to lose that time out of a budget measured release-to-release,
// which nobody's idea of tapping speed includes. 400ms (up from 280) buys
// back the frame-quantisation dispatchTouches' once-per-frame draining
// adds on both ends, without reaching the ~500ms where two genuinely
// separate taps start pairing by accident.
export const TAP_RESOLVE_MS = 400
export const DOUBLE_TAP_RADIUS_PX = 30

/**
 * How long a still contact must be held before the camera arms — docs/todo.md
 * entries 115 and 125.
 *
 * Entry 115 put the *menu* here and the camera on the double tap; entry 125
 * swapped them back on Victor's instruction, which agrees with the choice he
 * made first ("hold picture → armed (glyph appears) · tap picture → one
 * photo"). Renamed with the swap: a constant named for the menu that arms a
 * camera is exactly the sort of name that survives into being read as a
 * decision.
 *
 * Derived rather than picked: `emitter.ts` saturates its charge at
 * `CHARGE_TIME`, so **past that point a hold already buys nothing** — it is
 * gesture space the emitter's own design has vacated — and the extra second
 * leaves a full-charge hold a moment to sit at full charge before the menu
 * claims it. Written against the constant so it moves if that moves.
 *
 * The known cost, stated rather than hidden: a deliberate long hold to
 * fatten rings now ends in the camera arming at 3.5s. That is a real loss to
 * the play gesture and there is no version of hold-does-something without
 * it.
 */
export const HOLD_ARM_S = CHARGE_TIME + 1.0
/**
 * A hold that travels is never an arm — it is entry 50's fling, and turning
 * that into a mode would take the loudest emitter gesture away from the
 * picture. Measured against the contact's *original* touchdown point rather
 * than the previous frame's, so a slow drift out and back cannot creep past
 * it unnoticed.
 *
 * **This test cannot see a shake, and that is what entry 125 exists for.**
 * It measures the finger's travel *relative to the screen*, and during a
 * shake the finger and the screen move together — so a thumb resting on a
 * violently shaken phone travels approximately zero and satisfies this
 * perfectly. The 24px is not a weak guard against that; it is not a guard
 * against it at all. The calm gate below is.
 */
export const HOLD_ARM_SLOP_PX = 24

/**
 * How disturbed the phone may be before gestures stop being answered —
 * docs/todo.md entry 125. Victor: "shake is getting good, we don't want the
 * menu coming up accidentally."
 *
 * 0.35 because `shake.ts` records its own measurement in a comment —
 * "walking peaks at disturb 0.15, well under LEVEL" — so this clears an
 * ordinary gait by better than twice while a deliberate shake, which
 * saturates `disturb` near 1.0, is blocked decisively. Derived from a number
 * already in the file rather than picked.
 */
export const GESTURE_CALM_MAX = 0.35
/**
 * How long the gate stays shut after `disturb` was last above the line.
 * Long enough that the dying swing of a shake cannot re-open it between two
 * beats of the same gesture, short enough that the menu is there the moment
 * the phone stops.
 */
export const GESTURE_SETTLE_S = 0.4
/** docs/todo.md entry 141 — within this many CSS pixels of the emitter on
 *  a `down` picks it up. Smaller than a chip (48px) so it is deliberate,
 *  larger than the centre ring (0.02 uv, about 7px) so it is findable. */
export const EMITTER_PICK_PX = 36
// docs/todo.md entry 72: camera mode's own rate limit. Every tap in here
// is a deliberate shutter press, not one entry 52 needed protecting from
// — this exists only to stop a genuinely double-tapped shutter from
// writing the same frame twice.
export const CAMERA_SAVE_RATE_LIMIT_MS = 300

// docs/todo.md entry 103: one remembered tap, not a list of pending
// ones — with no save left to schedule, there is nothing to commit and
// therefore no per-tap timer to hold, only a position and a down-time to
// compare the next qualifying down against. `pointerId` is kept so that
// *that same contact's* own later drag or cancel can forget it — a
// gesture that turns out not to have been a tap at all should not still
// be sitting here, eligible to pair with some later, unrelated tap into a
// spurious double.
interface LastTap {
  x: number
  y: number
  t: number
  pointerId: number
}

/** The recogniser's own memory between frames — what used to be a dozen
 *  closure variables in main.ts. All of it is per-session and none of it
 *  survives a dispose. */
export interface GestureState {
  lastTap: LastTap | null
  /** The contact that has already opened the menu this gesture, so a finger
   *  still resting on the glass at 3.6s does not reopen it every frame. */
  holdOpenedBy: number | null
  /** docs/todo.md entry 141 — the contact currently holding the
   *  centre-anchored emitter, if any. Belongs to it for its whole life, the
   *  same exclusive-claim shape `fsBlocking` already has: no ring, no
   *  drag-trail, no tap or double, no hold-arming the camera. */
  emitterDragId: number | null
  /** docs/todo.md entry 146 — which Chorus node `emitterDragId` is holding,
   *  when it is Chorus's several nodes rather than the single anchor:
   *  `null` for every other view and for the anchor itself. One shared
   *  claim variable (`emitterDragId`) plus this index is simpler than a
   *  second parallel `Map`, because at most one contact-to-drag claim is
   *  ever open per contact and `emitterDragId` already tracks that. */
  emitterDragNodeIndex: number | null
  /** The longest still contact on the glass right now, in seconds — for the
   *  `?debug` readout only. Recomputed each frame in `dispatchGestures`; 0
   *  when nothing qualifies. */
  longestStillHold: number
  /** How many non-chip fingers are on the picture — docs/todo.md entry 121's
   *  press-and-shake. Recomputed each frame in `dispatchGestures` and read
   *  in the frame loop's own shake branch, which is a different function,
   *  so it lives out here rather than in either. */
  fingersOnPicture: number
  /** When `disturb` last exceeded `GESTURE_CALM_MAX`. `-Infinity` until it
   *  ever has, so a phone that has never moved — and a machine with no
   *  accelerometer, which reports `disturb` 0 for ever — is never gated. */
  lastDisturbedAt: number
  lastShotAt: number
  /** Contact ids for the geometric emitter's pool (scene.ts) — docs/todo.md
   *  entry 57. `touchField`'s own id is a *pointer* id, which the platform
   *  can reuse across two separate taps of the same finger (lift, then tap
   *  again); minted fresh on every qualifying `down` instead, so a pointer
   *  id being reused never reads as "the same contact continuing" to the
   *  emitter pool. Cleared on `up`/`cancel` — the id itself lives on inside
   *  scene.ts's pool for as long as that emitter's afterlife runs, but
   *  nothing here needs to remember it once the pointer is gone. */
  nextContactId: number
  contactIdFor: Map<number, number>
  /**
   * Which live contacts came from a mouse — docs/todo.md entry 117.
   *
   * The touch field carries no `pointerType`, and deliberately: it is a field
   * of contacts, and what hardware made one is this file's question. A set
   * keyed by pointer id is enough, and it is read in `dispatchGestures` rather
   * than acted on in the listener for a reason worth stating — arming in the
   * listener would arm *before* the same event reached the dispatch, and the
   * dispatch would then see an armed mode and shoot on the very click that
   * armed it. One click cannot be both.
   */
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
  /** The canvas's own box — read only on a `down` that actually needs a
   *  hit-test radius, same as the original's own placement of
   *  `canvas.getBoundingClientRect()` inside that branch. Narrowed to the
   *  one method this file calls, same reasoning as `visualiser` above. */
  canvas: { getBoundingClientRect(): { width: number; height: number } }
  camera: {
    readonly armed: boolean
    arm(): void
    /** Take the shot and leave the mode. The rate limit is applied here, in
     *  the recogniser, so the caller's `shoot` is unconditional; `write`
     *  says whether this call falls inside the limit and should actually
     *  save a frame. The original both saved and exited inside one
     *  `if (cameraMode)`, with the save behind the rate limit and the exit
     *  unconditional — this keeps that exactly, making explicit in the
     *  signature what used to be implicit in nested control flow. */
    shoot(write: boolean): void
  }
  openShell(): void
}

/** docs/todo.md entry 125 — the calm gate's own clock. Called once per frame
 *  by the session with this frame's `disturb`, before dispatch. */
export function noteDisturb(state: GestureState, disturb: number, now: number): void {
  if (disturb > GESTURE_CALM_MAX) state.lastDisturbedAt = now
}

/**
 * Whether a deliberate gesture should be answered right now.
 *
 * Guards the menu *and* the arm, not only the one that was reported: a
 * double tap is harder to trigger by accident than a hold, but two thumb
 * bounces inside entry 67's window during a hard shake are not impossible,
 * and without this the accident would simply move from the menu to the
 * camera — where it costs a photograph rather than a panel.
 */
export function gesturesCalm(state: GestureState, now: number): boolean {
  return now - state.lastDisturbedAt >= GESTURE_SETTLE_S
}

const resolveTapDown = (
  state: GestureState,
  deps: GestureDeps,
  now: number,
  pointerId: number,
  clientX: number,
  clientY: number,
): void => {
  if (
    state.lastTap !== null &&
    now * 1000 - state.lastTap.t <= TAP_RESOLVE_MS &&
    Math.hypot(clientX - state.lastTap.x, clientY - state.lastTap.y) <= DOUBLE_TAP_RADIUS_PX
  ) {
    state.lastTap = null
    // docs/todo.md entry 125 — the menu is the double tap again, and the
    // camera moved to the still hold. Victor: "require double tap for
    // menu, shake is getting good, we don't want the menu coming up
    // accidentally." That agrees with the choice he made first, before
    // entry 115's reading of a middle instruction moved it.
    //
    // Gated on calm for the same reason the hold is: two thumb bounces
    // inside entry 67's window during a hard shake are not impossible,
    // and a menu opening mid-shake is the report this fixes.
    if (gesturesCalm(state, now)) deps.openShell()
    return
  }
  state.lastTap = { x: clientX, y: clientY, t: now * 1000, pointerId }
}

/** Called from the matching contact's `up` once it is known whether that
 *  contact travelled past `TAP_SLOP_PX`, and from a `cancel` — a drag or a
 *  cancelled contact was never a tap, and forgetting it here is what keeps
 *  it from later pairing with an unrelated tap into a double it never
 *  earned. A no-op if that down already resolved as a double (`lastTap` is
 *  gone by then), belongs to a different contact, or was never remembered
 *  to begin with (a chip, the HUD, the gate). */
const cancelPendingTap = (state: GestureState, pointerId: number): void => {
  if (state.lastTap !== null && state.lastTap.pointerId === pointerId) state.lastTap = null
}

/**
 * The tap/hold-vs-drag decision for the emitter, and the single/double
 * tap dispatch — docs/todo.md entries 41, 33, 48, 49, 50, 52 and 57.
 * Called once per rendered frame from frame() below, which is what
 * "sampled, not callback-driven" (touches.ts's own file comment) means in
 * practice: every consumer of the field, this dispatch included, reads it
 * on the same clock the picture itself redraws on rather than keeping its
 * own timers.
 */
export function dispatchGestures(state: GestureState, now: number, deps: GestureDeps): void {
  const hudOpen = deps.shellOpen
  // docs/todo.md entry 80 — fullscreen has right of way, rank 1 of the
  // four claimants on a tap (fullscreen, camera mode, menu, play). One
  // tap, not a mode: this is recomputed fresh every call from the same
  // two facts entry 66 already derives `fullscreenStatus().want` from and
  // the DOM's own `document.fullscreenElement`, so there is no separate
  // state to fall out of sync or get stuck in — the moment fullscreen is
  // back, this is false again on its own.
  const fsBlocking = deps.fullscreenBlocking

  // Drained once, read twice below — minting/clearing contact ids first,
  // so the sample pass that follows always has an id ready for a contact
  // that began on this exact frame. events() only ever drains in the
  // order things happened, so a down always precedes any up for the same
  // id within one call.
  const events = deps.field.events()
  for (const e of events) {
    if (e.kind === 'down') {
      if (!e.onChip) state.contactIdFor.set(e.id, state.nextContactId++)
      continue
    }
    state.contactIdFor.delete(e.id)
  }

  // Defensive rather than load-bearing: dispatchGestures only ever runs
  // after Start (frame() is not scheduled before it), so the gate should
  // already be gone by the time a tap can reach here — kept in case a
  // fade is still mid-flight, the same guard the zone dispatch this
  // replaced already carried.
  const gateShowing = deps.gateShowing

  // This loop — every discrete down/up/cancel, including the emitter and
  // Chorus-node claim (entry 141) — now runs *before* the sample pass
  // below, not after it as `dispatchTouches` originally had it. Verbatim
  // order left a one-frame gap `scripts/probe-gestures.ts` caught and
  // `dispatchTouches` itself never had a way to be checked against: a
  // contact landing exactly on the emitter was claimed here, but the
  // sample loop below had already run *this same call* with the claim not
  // yet set, so it read as an ordinary active touch for one frame — a
  // ring and a stream sample entry 141's own comment says a claimed
  // contact should never produce ("not the ring, not the atmospheric
  // stream"). Running the claim first closes the gap: by the time the
  // sample pass sees this frame's own new contact, `state.emitterDragId`
  // already excludes it. Nothing else here reads anything the sample pass
  // computes, so the swap changes only when this decides, not what it
  // decides.
  let streamBegan = false
  for (const e of events) {
    if (e.kind === 'down') {
      // docs/todo.md entry 80 — checked first, before every other
      // claimant on this tap: the emitter and the camera shutter both
      // fire on `down` (entries 50 and 72/87), so waiting for this
      // contact's own `up` — where the retry that actually re-requests
      // fullscreen already lives, entry 62's own choice — would let a
      // ring already be drawn or a photo already written before the
      // request even goes out. `e.onChip` is checked first of all,
      // inside the combined condition below, so the chip stays unaffected.
      if (!e.onChip && !hudOpen && fsBlocking) continue
      if (!e.onChip && !hudOpen) streamBegan = true
      if (e.onChip || hudOpen || gateShowing) continue
      // docs/todo.md entry 87: one shot, then done. Entry 78's two-finger
      // exit does not exist to retire a second time — arming ends at the
      // first qualifying tap regardless, so there is no persisted state
      // left to need an exit gesture for. The shutter is instant — no
      // TAP_RESOLVE_MS wait, no drag check, no pending-tap bookkeeping —
      // because outside this mode that wait exists solely to learn
      // whether a second tap is coming to open the menu, and in here the
      // menu cannot open at all. Fires on this tap's own down.
      if (deps.camera.armed) {
        const inLimit = now - state.lastShotAt >= CAMERA_SAVE_RATE_LIMIT_MS / 1000
        if (inLimit) state.lastShotAt = now
        deps.camera.shoot(inLimit)
        continue
      }
      // docs/todo.md entry 141 — a fifth claimant, checked here: after
      // fullscreen and after camera mode (a tap while armed is always a
      // photo, entirely unaffected by this), before a mouse's own
      // left-click-arms-camera below and before an ordinary tap or drag
      // is resolved at all. `e.x`/`e.y` are already shader-uv — every
      // `TouchFieldEvent` carries them, the same pair `resolveTapDown`'s
      // own caller further down reaches for by client coordinates instead
      // only because that path needs to remember where the tap itself
      // was, not to hit-test against anything.
      {
        const rect = deps.canvas.getBoundingClientRect()
        const radiusUv = EMITTER_PICK_PX / Math.min(rect.width, rect.height)
        if (deps.visualiser.hitTestEmitter(e.x, e.y, radiusUv)) {
          state.emitterDragId = e.id
          state.emitterDragNodeIndex = null
          deps.visualiser.setEmitterDrag({ x: e.x, y: e.y })
          continue
        }
        // docs/todo.md entry 146 — the same claim, for whichever of
        // Chorus's several nodes (if any) the touch landed on. Checked
        // second, after the anchor itself: `hitTestEmitter` is not gated
        // on the mounted view, so a touch within `radiusUv` of the centre
        // still moves the whole constellation (same as gravity's own bob
        // does), and only a touch nearer to one particular node than to
        // the centre falls through to claim that node instead.
        // `hitTestChorusNode` itself answers `null` whenever Chorus is not
        // the mounted geometric view, so this is a no-op everywhere else.
        const nodeIndex = deps.visualiser.hitTestChorusNode(e.x, e.y, radiusUv)
        if (nodeIndex !== null) {
          state.emitterDragId = e.id
          state.emitterDragNodeIndex = nodeIndex
          deps.visualiser.setChorusNodeDrag(nodeIndex, { x: e.x, y: e.y })
          continue
        }
      }
      // docs/todo.md entry 125 deleted entry 67's two-finger opener that
      // stood here. It fired the instant the second finger landed — no
      // duration, no stillness, no travel test of any kind — and two
      // fingers gripping a phone that is being shaken is not an edge case,
      // it is how a phone is held. Deleted rather than gated, as the direct
      // reading of "require double tap for menu": entry 115 kept it on the
      // argument that removing a working way in while moving the primary
      // one risks leaving none, and that no longer applies now the primary
      // is moving *to* the gesture people already know.
      // docs/todo.md entry 117 — a mouse arms on a single left click,
      // where a finger needs a 3.5s still hold. The difference is the
      // hardware: a finger cannot have the single tap, because the emitter
      // fires on every `down`, so every touch of the picture would arm and
      // the touch after it would shoot. A mouse does not have that problem,
      // because it has a second button for the menu and hover for play — so
      // the click is free.
      //
      // (This said "where a finger needs a double tap" until entry 125 put
      // the menu back on the double tap and arming on the hold. The
      // reasoning is unchanged; only which finger gesture it contrasts
      // with moved.)
      //
      // Reached only when `cameraMode` is false: the branch above already
      // took the armed case and shot. That is what keeps one click from
      // arming and shooting at once.
      if (state.mousePointers.has(e.id)) {
        deps.camera.arm()
        continue
      }
      // Recognised on this tap's own `down`, not its `up` — see
      // resolveTapDown's own comment for why. `e.clientX`/`e.clientY`
      // equal `e.downClientX`/`e.downClientY` for a `down` event; using
      // the former reads as "where this tap is", which is what it is.
      resolveTapDown(state, deps, now, e.id, e.clientX, e.clientY)
      continue
    }
    // docs/todo.md entry 141 — up or cancel, the same one line: the claim
    // ends and the emitter stays exactly where this contact leaves it.
    // `setEmitterDrag(null)` is what tells scene.ts to anchor the spring
    // there (or, with `grav` off, to simply hold the picture there) —
    // checked first of everything below, since a dragging contact was
    // never eligible for a tap, a double or the hold-arm gesture and has
    // nothing there to unwind.
    if (state.emitterDragId === e.id) {
      state.emitterDragId = null
      if (state.emitterDragNodeIndex !== null) {
        deps.visualiser.setChorusNodeDrag(state.emitterDragNodeIndex, null)
        state.emitterDragNodeIndex = null
      } else {
        deps.visualiser.setEmitterDrag(null)
      }
      continue
    }
    // A cancelled contact (pointercancel, lostpointercapture) is never a
    // tap — only a clean release can be, exactly as before this entry —
    // but its own `down` may already have remembered itself as a
    // candidate to pair into a double (docs/todo.md entry 67: resolution
    // now begins at `down`, before it is knowable whether the contact
    // will end cleanly). Forget it unconditionally rather than let a
    // contact the platform itself gave up on still be eligible to pair
    // with some later, unrelated tap — a no-op for a chip/HUD/gate
    // contact, which never had a remembered tap to begin with.
    if (e.kind === 'cancel') {
      cancelPendingTap(state, e.id)
      if (state.holdOpenedBy === e.id) state.holdOpenedBy = null
      continue
    }
    // The tap-versus-drag distinction entry 50 explicitly names as not
    // loosened: a release far from where the contact began is a
    // completed drag, not a tap. Forget whatever remembered tap its own
    // `down` may have started, rather than let a gesture that turned out
    // not to be a tap at all pair with a later one into a spurious double.
    if (Math.hypot(e.clientX - e.downClientX, e.clientY - e.downClientY) > TAP_SLOP_PX) {
      cancelPendingTap(state, e.id)
    }
    // docs/todo.md entry 115 — the hold that opened the menu has ended, so
    // the next one is free to open it again. Cleared on the release rather
    // than when the menu closes: it is a property of the *contact*, and a
    // finger still resting on the glass after the menu is dismissed should
    // not immediately reopen it.
    if (state.holdOpenedBy === e.id) state.holdOpenedBy = null
  }

  // docs/todo.md entry 50: no threshold, every zone — a contact emits the
  // instant it begins, wherever it lands, as long as it isn't a chip's
  // own tap and the HUD isn't covering the picture. Entry 41's own
  // zone-and-threshold logic for what a *release* does (save, open the
  // panel) is untouched, above — this is a second, independent
  // thing every contact does, not a replacement for that dispatch.
  const active: { contactId: number; x: number; y: number; speed: number }[] = []
  // Any `.hud-chip` contact never reaches either stream below — a chip's
  // own tap is that chip's gesture, not one that reaches the picture
  // underneath. Also inert while the HUD is open — a HUD control's own
  // drag already stopPropagation()s before it ever reaches this field,
  // but a tap on the scrim itself (closing the panel) would not, and the
  // picture is hidden behind the panel at that moment regardless.
  //
  // Entry 48's own capture-band exclusion is gone along with the zone it
  // was defined against (entry 52): the touch stream's own contribution
  // can now land in a saved frame exactly as entry 50 already made the
  // geometric emitter's ring do, for the same reason stated there — it is
  // picture, not UI, and a save can now happen from any tap rather than
  // only ones landing in a fixed band this file no longer has a way to
  // name. **Mine**, since entry 52's own text does not mention the touch
  // stream at all; leaving the old exclusion in would have needed a
  // "was this the tap that is about to save" fact that is not knowable
  // until 280ms after the fact, which the render loop cannot wait for.
  let streamAnyDown = false
  let streamMaxSpeed = 0
  // docs/todo.md entry 121 — recounted each frame. Entry 67 kept this for
  // its two-finger opener and entry 125 deleted both together, correctly:
  // it had no reader left. It has one again, and a different one — the
  // question now is "is anybody touching the picture", not "are there
  // exactly two".
  let nonChipDown = 0
  state.longestStillHold = 0
  for (const t of deps.field.sample(now)) {
    const speed = Math.hypot(t.vx, t.vy)
    // docs/todo.md entry 80: a non-chip contact this file is currently
    // spending on restoring fullscreen counts toward nothing else here —
    // not the emitter, not the atmospheric stream, not the two-finger
    // recogniser below — "does nothing else" means nothing else, not
    // merely "no ring". A chip contact is unaffected, exactly as Decided
    // states — the `!t.onChip` guard here is what keeps that true.
    if (!t.onChip && fsBlocking) continue
    // docs/todo.md entry 141 — the same total exclusion entry 80's own
    // comment above states for a fullscreen-blocked contact, for the
    // contact currently holding the emitter: not the ring, not the
    // atmospheric stream, not the hold-to-arm recogniser below. Its own
    // live position is still forwarded, every frame, which is what "no
    // lag, no spring" while held actually requires — a `down`-time
    // position alone would leave the emitter wherever the finger first
    // landed rather than following it.
    if (t.id === state.emitterDragId) {
      if (state.emitterDragNodeIndex !== null) {
        deps.visualiser.setChorusNodeDrag(state.emitterDragNodeIndex, { x: t.x, y: t.y })
      } else {
        deps.visualiser.setEmitterDrag({ x: t.x, y: t.y })
      }
      continue
    }
    if (!t.onChip) nonChipDown++
    if (!t.onChip && !hudOpen) {
      streamAnyDown = true
      streamMaxSpeed = Math.max(streamMaxSpeed, speed)
    }
    if (t.onChip || hudOpen) continue
    // docs/todo.md entry 115 — a still hold opens the menu. Checked here,
    // in the per-frame contact loop, because "has this finger been down
    // for three and a half seconds without moving" is a question about
    // elapsed time that no event can answer: the `down` is too early and
    // the `up` is too late. `downFor` and `downClientX`/`Y` are already on
    // the sample, so this needs no new state beyond remembering which
    // contact has already fired.
    if (Math.hypot(t.clientX - t.downClientX, t.clientY - t.downClientY) <= HOLD_ARM_SLOP_PX) {
      state.longestStillHold = Math.max(state.longestStillHold, t.downFor)
    }
    if (
      state.holdOpenedBy === null &&
      t.downFor >= HOLD_ARM_S &&
      Math.hypot(t.clientX - t.downClientX, t.clientY - t.downClientY) <= HOLD_ARM_SLOP_PX &&
      // docs/todo.md entry 125 — the stillness test above cannot see a
      // shake, because the finger and the screen move together. This is
      // what actually stops a thumb on a shaken phone from arming.
      gesturesCalm(state, now)
    ) {
      state.holdOpenedBy = t.id
      // A tap still waiting to pair into a double must not survive the
      // gesture that consumed this contact.
      state.lastTap = null
      deps.camera.arm()
    }
    const contactId = state.contactIdFor.get(t.id)
    // Absent only for a chip contact (never minted one) reaching here by
    // a stale id, which should not happen given the exclusion above —
    // defensive rather than load-bearing.
    if (contactId === undefined) continue
    active.push({ contactId, x: t.x, y: t.y, speed })
  }
  state.fingersOnPicture = nonChipDown
  deps.visualiser.setTouches(active)

  // docs/todo.md entry 112 — asked here rather than at the event, because
  // "has the cursor been parked" is a question about elapsed time and
  // nothing answers it until a frame goes by. `updateHover` is what
  // applies HOVER_QUIET; this file only forwards its verdict.
  const cursor = updateHover(deps.hover, now)
  deps.visualiser.setHover(cursor.x, cursor.y, cursor.active, cursor.speed, cursor.presence)

  deps.visualiser.setTouchStream(streamBegan, streamAnyDown, streamMaxSpeed)
}
