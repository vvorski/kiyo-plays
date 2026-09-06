/**
 * The geometric layer's centre, hanging on a spring — docs/todo.md entry 132.
 *
 * Victor: *"use those dynamics to move the emitters of the geometrics and
 * affect the lower layer also … think what it would be like for the toy as a
 * whole to feel gravity."* Gravity already reached the toy in two places and
 * both were small: the whole picture slides up to 0.033 uv (entry 30), and a
 * *released* touch emitter falls (entry 102). Neither moves what the picture
 * is made of — every audio-born ring, shard, cell and rose is born at
 * `vec2(0.0)`, dead centre, whatever the phone is doing.
 *
 * **A pendulum bob, not a falling grain**, and it is the one decision here
 * that changes what the picture is. A body on a spring anchored at the frame
 * centre, loaded by gravity: held upright it hangs below centre, laid flat it
 * hangs *at* centre, tilted it hangs toward the low edge, and every
 * transition swings and settles. Entry 102's fall-to-the-edge physics would
 * instead carry the centre to the bottom edge whenever the phone is held
 * normally — half the picture off screen in the commonest posture — and leave
 * it there when the phone was laid down.
 *
 * The bob answers "flat" by returning to centre **with no rule saying so**,
 * which is the same property entry 102 valued in the grain: *"a mode flag
 * here would be strictly worse than the physics."* In-plane gravity is the
 * full vector when the phone is upright and has zero length when it is flat,
 * so flat-versus-upright is not a case anything branches on.
 *
 * The toy now has two kinds of gravity — a bob that swings and a grain that
 * falls — and that is the sand frame's own vocabulary rather than an
 * inconsistency: the pile sits, the falling grains fall.
 *
 * Pure state and a pure update, same discipline as `emitter.ts` and
 * `motion-bias.ts`: no DOM, no clock of its own, `dt` from the caller.
 */

/**
 * How far the centre hangs below the middle at 90°, in uv — linear in the
 * in-plane magnitude, so it is the full sag when the phone is upright and
 * nothing when it is flat.
 *
 * Entry 30 caps its own whole-picture slide at 0.033 because the overscan
 * hiding the picture's edge is only 0.055 uv, and that cap is right for
 * *sliding the composite*, which exposes an edge. Moving the **origin** of
 * the geometry exposes nothing — the shaders draw everywhere regardless of
 * where their centre is — so it can move an order of magnitude further. 0.28
 * is the largest value at which Circles' outermost wake rungs still reach the
 * top of a portrait frame; the bottom edge is 0.89 away, so the bob is never
 * near it. **Mine.**
 */
export const ORIGIN_SAG = 0.28

/**
 * The swing: natural frequency in rad/s and damping ratio. ω = 3 is a period
 * of about 2.1s, and ζ = 0.35 overshoots by roughly a third, swings back once
 * and settles inside three seconds — raise the phone and the centre drops,
 * hesitates, and hangs.
 *
 * Deliberately *not* the tumble's own `OFF_STIFF`/`OFF_DAMP` (ω ≈ 9), which
 * are tuned for a knock and are far too twitchy for a thing meant to feel
 * heavy. Two springs at different frequencies is the same reasoning
 * `rgb-slip.ts` gives for keeping its own away from the tumble's: a shared
 * frequency would make this read as the tumble happening twice rather than as
 * its own effect. **Mine.**
 */
const OMEGA = 3
const ZETA = 0.35
/** Standard spring form: stiffness ω², damping 2ζω — the same convention the
 *  tumble and the RGB slip both already use. */
const STIFF = OMEGA * OMEGA
const DAMP = 2 * ZETA * OMEGA

/**
 * How much of a tumble kick reaches the bob, in uv per (m/s²). The tumble's
 * own impulses are already computed every frame for the picture's shake, so a
 * knock swings the bob and a shake throws it without any new coupling — the
 * bob simply also receives them. Small, because a kick is an impulse on a
 * heavy thing: a hard shake moves it a fraction of the sag rather than
 * flinging it across the frame. **Mine.**
 */
const KICK_SCALE = 0.004

/** Beyond this the bob is clamped, so no accumulation of kicks can push the
 *  origin somewhere the picture has nothing left to draw around. Twice the
 *  sag: reachable by a hard shake at full tilt, never by gravity alone. */
const MAX_ORIGIN = ORIGIN_SAG * 2

export interface OriginState {
  x: number
  y: number
  vx: number
  vy: number
  /** docs/todo.md entry 141 — where the spring hangs from, moved by a drag
   *  rather than fixed at the frame centre. `(0, 0)` (its own default)
   *  reproduces every existing calculation exactly: the target below was
   *  simply `tilt * ORIGIN_SAG` before this entry, which is `anchor + tilt *
   *  ORIGIN_SAG` at `anchor = (0, 0)`. */
  anchorX: number
  anchorY: number
}

export function createOriginState(): OriginState {
  return { x: 0, y: 0, vx: 0, vy: 0, anchorX: 0, anchorY: 0 }
}

/**
 * docs/todo.md entry 141 — move where the spring hangs from. Called on
 * release, once, with wherever the finger last was: the drag itself sets
 * `uOrigin` directly (no spring — Decided's own "no lag, no spring" while
 * held), and this is what the spring re-anchors to once the finger lifts.
 */
export function setAnchor(state: OriginState, x: number, y: number): void {
  state.anchorX = x
  state.anchorY = y
}

/**
 * docs/todo.md entry 141 — is `(x, y)` within `radiusUv` of the anchor?
 * `radiusUv` is the caller's own 36px, already converted through the same
 * `toShaderUv` scale factor a hit-test elsewhere in this codebase would use
 * to go the other way — this function only ever compares two uv distances
 * and knows nothing about pixels.
 *
 * Returns a boolean rather than folding into a larger "which emitter"
 * function: this is the single-emitter views' own hit-test (Circles, Shards,
 * Grid, Rose), where the anchor *is* the one pickable emitter and there is
 * nothing to disambiguate. `pickNode` below is entry 146's separate function
 * for Chorus's several.
 */
export function pickEmitter(state: OriginState, x: number, y: number, radiusUv: number): boolean {
  const dx = x - state.anchorX
  const dy = y - state.anchorY
  return dx * dx + dy * dy <= radiusUv * radiusUv
}

/**
 * docs/todo.md entry 146 — Chorus's several nodes, each an *offset* from the
 * anchor (so the whole constellation still moves with 132's bob, per entry
 * 141's own Decided — "the whole node ring hangs with the geometric
 * centre"). `nodes` is whatever length the current seed's node count is (3
 * to 7 — see `chorusNodeOffsets` below), never the full 8-slot uniform array
 * padding scene.ts uploads.
 *
 * Returns the *nearest* node within `radiusUv`, not merely the first one
 * found — two nodes can be close enough together for their pick radii to
 * overlap, and "whichever the finger meant" is answered by proximity, not by
 * array order.
 */
export function pickNode(
  nodes: readonly { x: number; y: number }[],
  anchor: { x: number; y: number },
  x: number,
  y: number,
  radiusUv: number,
): number | null {
  let nearest: number | null = null
  let nearestDist2 = radiusUv * radiusUv
  for (let i = 0; i < nodes.length; i++) {
    const dx = x - (anchor.x + nodes[i].x)
    const dy = y - (anchor.y + nodes[i].y)
    const dist2 = dx * dx + dy * dy
    if (dist2 <= nearestDist2) {
      nearest = i
      nearestDist2 = dist2
    }
  }
  return nearest
}

const TAU = 2 * Math.PI

/**
 * docs/todo.md entry 146 — Chorus's seeded ring, moved here verbatim from
 * `chorus.frag.glsl`'s own removed lines (comment intact): node count and
 * rotation are both seed choices, so a re-roll restructures the arrangement
 * rather than only re-timing it. Three is the fewest that still reads as an
 * arrangement rather than as two points and an axis; the ceiling is the
 * ripple buffer's own limit (only eight rings can be alive at once), not the
 * geometry — past seven nodes a run of hits mostly lights each node once and
 * nothing meets a neighbour's front.
 *
 * Returns *offsets* from the anchor, in the same uv units as everything
 * else — `NODE_RADIUS` is chorus.frag.glsl's own removed constant, moved
 * here for the one place it is still needed.
 */
const NODE_RADIUS = 0.3

export function chorusNodeOffsets(seed: readonly [number, number, number, number]): { x: number; y: number }[] {
  const count = 3 + Math.floor(seed[0] * 5)
  const sector = TAU / count
  const phase = seed[2] * TAU
  const offsets: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const a = phase + i * sector
    offsets.push({ x: NODE_RADIUS * Math.cos(a), y: NODE_RADIUS * Math.sin(a) })
  }
  return offsets
}

/**
 * Call once per rendered frame while the `grav` chip is on.
 *
 * `tiltX`/`tiltY` are `shake.ts`'s own uncapped in-plane pair — `(0, 0)` flat,
 * unit length upright — and `kickX`/`kickY` are the tumble's own pending
 * impulses in m/s², or 0 when nothing has happened.
 *
 * The rest position is `anchor + tilt × ORIGIN_SAG`, so gravity does not
 * accelerate the bob directly: it moves the point the spring pulls toward,
 * relative to wherever a drag last left it (docs/todo.md entry 141's
 * `anchorX`/`anchorY`, `(0, 0)` until something moves them). That is what
 * makes the response a swing toward a hanging point rather than a fall, and
 * what makes "flat" mean "the hanging point is the anchor" rather than a case
 * anything tests for.
 */
export function updateOrigin(
  state: OriginState,
  dt: number,
  tiltX: number,
  tiltY: number,
  kickX = 0,
  kickY = 0,
): void {
  if (dt <= 0) return

  // The sign convention, measured rather than reasoned about: a phone held
  // upright reports `tilt = (0, -1)` and a phone lying flat reports `(0, 0)`
  // — `tilt.y` is `gravY / EARTH_G`, and the harness's own "still" sample is
  // `y = -G` (probe-shake.ts). The shaders' uv has y up, so a negative target
  // puts the hanging centre *below* the middle of the frame, which is what
  // "hangs" means. No sign flip is needed anywhere: the vector already points
  // the way things fall.
  const targetX = state.anchorX + tiltX * ORIGIN_SAG
  const targetY = state.anchorY + tiltY * ORIGIN_SAG

  state.vx += (STIFF * (targetX - state.x) - DAMP * state.vx) * dt + kickX * KICK_SCALE
  state.vy += (STIFF * (targetY - state.y) - DAMP * state.vy) * dt + kickY * KICK_SCALE
  state.x += state.vx * dt
  state.y += state.vy * dt

  // Clamped the way the tumble clamps its own offsets: kill half the velocity
  // that pushed past the limit rather than let the spring strain against it.
  const len = Math.hypot(state.x, state.y)
  if (len > MAX_ORIGIN) {
    const k = MAX_ORIGIN / len
    state.x *= k
    state.y *= k
    state.vx *= 0.5
    state.vy *= 0.5
  }
}

/** Put the bob back at rest exactly on the anchor, instantly — for the
 *  moment the `grav` chip is switched off, so the picture does not keep
 *  hanging off-anchor with the feature disabled. The uniform stops being
 *  written at the same moment (the caller sets it to the anchor directly
 *  instead — see scene.ts); this is what makes the *next* switch-on start
 *  from rest rather than from wherever the swing was left.
 *
 *  docs/todo.md entry 141 — settles at `anchorX`/`anchorY` rather than the
 *  hardcoded `(0, 0)` this reset to before that entry, which is the same
 *  value whenever nothing has ever dragged the anchor away from there. */
export function resetOrigin(state: OriginState): void {
  state.x = state.anchorX
  state.y = state.anchorY
  state.vx = 0
  state.vy = 0
}
