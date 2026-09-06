/**
 * Headless exercise of the geometric centre's pendulum — docs/todo.md entry
 * 132 — and, since entry 141, of the anchor a drag moves it to and the
 * hit-test that decides whether a contact picked it up at all.
 *
 * Every claim this entry makes about the swing is a claim about a second or
 * two of behaviour: overshoot by a third, settle inside three seconds, return
 * to centre when the phone is laid flat. None of that can be tuned by waving
 * a laptop, and CLAUDE.md says so in as many words — a behaviour with a
 * timescale longer than a few seconds gets a headless probe.
 *
 *   node --experimental-strip-types scripts/probe-origin.ts
 */

import { createOriginState, updateOrigin, resetOrigin, setAnchor, pickEmitter, ORIGIN_SAG } from '../src/engine/origin.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

const DT = 1 / 60

interface Trace {
  peak: number
  final: { x: number; y: number }
  signChanges: number
  settledBy: number
}

/** Run a fixed tilt for `seconds`, reporting the peak displacement along the
 *  tilt's own direction, how many times the velocity reversed, and when the
 *  bob last moved more than `tol` from where it ended. */
function run(state: ReturnType<typeof createOriginState>, seconds: number, tiltX: number, tiltY: number, tol = 0.01): Trace {
  const frames = Math.round(seconds / DT)
  const dirLen = Math.hypot(tiltX, tiltY) || 1
  const ux = tiltX / dirLen
  const uy = tiltY / dirLen
  let peak = 0
  let signChanges = 0
  let lastV = 0
  const history: { t: number; x: number; y: number }[] = []
  for (let i = 0; i < frames; i++) {
    updateOrigin(state, DT, tiltX, tiltY)
    const along = state.x * ux + state.y * uy
    peak = Math.max(peak, along)
    const v = state.vx * ux + state.vy * uy
    if (lastV !== 0 && Math.sign(v) !== 0 && Math.sign(v) !== Math.sign(lastV)) signChanges++
    if (v !== 0) lastV = v
    history.push({ t: (i + 1) * DT, x: state.x, y: state.y })
  }
  const final = { x: state.x, y: state.y }
  let settledBy = 0
  for (const h of history) {
    if (Math.hypot(h.x - final.x, h.y - final.y) > tol) settledBy = h.t
  }
  return { peak, final, signChanges, settledBy }
}

// 1. Raised from flat: it drops, overshoots, swings back once, and hangs.
//
//    A phone held upright reports tilt (0, -1) — measured, not assumed:
//    `tilt.y` is `gravY / EARTH_G` and the harness's own "still" sample is
//    `y = -G`. The shaders' uv has y up, so the resting y being negative is
//    what puts the centre *below* the middle. Getting this backwards would
//    have produced a probe that passed while the picture hung off the top.
{
  const s = createOriginState()
  const t = run(s, 6, 0, -1)
  const overshoot = (t.peak - ORIGIN_SAG) / ORIGIN_SAG
  check(
    `raised upright, it overshoots the hanging point by a quarter to two fifths (${(overshoot * 100).toFixed(0)}%)`,
    overshoot >= 0.25 && overshoot <= 0.4,
    `peak ${t.peak.toFixed(4)} against a sag of ${ORIGIN_SAG}`,
  )
  check(
    `and hangs ${ORIGIN_SAG} uv below centre — a negative uv.y, which is down`,
    Math.abs(t.final.y + ORIGIN_SAG) <= 0.01 && Math.abs(t.final.x) <= 0.01,
    `rested at (${t.final.x.toFixed(4)}, ${t.final.y.toFixed(4)})`,
  )
  check('settling inside three seconds', t.settledBy <= 3, `still moving at ${t.settledBy.toFixed(2)}s`)
  check('with a swing, not a crawl — the velocity reverses at least once', t.signChanges >= 1, `${t.signChanges} reversals`)
}

// 2. Laid flat again: it floats back to the centre, and does not oscillate
//    around it more than the one swing.
{
  const s = createOriginState()
  run(s, 6, 0, -1)
  const t = run(s, 6, 0, 0)
  check(
    'laid flat, it returns to the centre within 0.01 uv',
    Math.hypot(t.final.x, t.final.y) <= 0.01,
    `rested at (${t.final.x.toFixed(4)}, ${t.final.y.toFixed(4)})`,
  )
  check('inside three seconds', t.settledBy <= 3, `still moving at ${t.settledBy.toFixed(2)}s`)
  check('with at most two sign changes on the way', t.signChanges <= 2, `${t.signChanges} reversals`)
}

// 3. The diagonal. `tilt` is not clamped to a unit circle — (0.7, 0.7) has a
//    magnitude of 0.99 — so the rest position is the tilt vector scaled, and
//    it lies along the tilt's own direction rather than being squared off to
//    an axis.
{
  const s = createOriginState()
  const t = run(s, 8, 0.7, 0.7)
  const expected = ORIGIN_SAG
  check(
    'tilted on the diagonal, it hangs along that diagonal',
    Math.abs(t.final.x - 0.7 * expected) <= 0.01 && Math.abs(t.final.y - 0.7 * expected) <= 0.01,
    `rested at (${t.final.x.toFixed(4)}, ${t.final.y.toFixed(4)}), expected (${(0.7 * expected).toFixed(4)}, ${(0.7 * expected).toFixed(4)})`,
  )
  const restLen = Math.hypot(t.final.x, t.final.y)
  check(
    'at the sag scaled by the tilt’s own magnitude, not the full sag',
    Math.abs(restLen - Math.hypot(0.7, 0.7) * ORIGIN_SAG) <= 0.01,
    `${restLen.toFixed(4)} vs ${(Math.hypot(0.7, 0.7) * ORIGIN_SAG).toFixed(4)}`,
  )
}

// 4. A kick with the phone flat: the bob swings and comes home. This is the
//    tumble reaching it — a knock swings it, a shake throws it — with no new
//    coupling beyond passing the impulse in.
{
  const s = createOriginState()
  updateOrigin(s, DT, 0, 0, 30, 0)
  const movedBy = Math.abs(s.x)
  check('a knock on a flat phone moves the centre', movedBy > 0.0001, `moved ${movedBy.toFixed(5)}`)
  const t = run(s, 6, 0, 0)
  check(
    'and it decays back to the centre',
    Math.hypot(t.final.x, t.final.y) <= 0.01,
    `rested at (${t.final.x.toFixed(4)}, ${t.final.y.toFixed(4)})`,
  )
}

// 5. The clamp, which exists so no accumulation of kicks can put the origin
//    somewhere the picture has nothing left to draw around.
{
  const s = createOriginState()
  for (let i = 0; i < 200; i++) updateOrigin(s, DT, 0, -1, 400, 400)
  check(
    'a storm of hard kicks cannot push the centre past twice the sag',
    Math.hypot(s.x, s.y) <= ORIGIN_SAG * 2 + 1e-9,
    `reached ${Math.hypot(s.x, s.y).toFixed(4)}`,
  )
  check('and nothing has gone non-finite', Number.isFinite(s.x) && Number.isFinite(s.y), `(${s.x}, ${s.y})`)
}

// 6. The identity. A phone that never moves leaves the origin exactly at
//    (0, 0) — not nearly — so every geometric shader's `uv - uOrigin` is
//    `uv - vec2(0.0)`, which is `uv`, and the picture is bit-identical to a
//    build without this entry.
{
  const s = createOriginState()
  for (let i = 0; i < 60 * 30; i++) updateOrigin(s, DT, 0, 0)
  check(
    'a phone that never moves leaves the centre at exactly (0, 0)',
    s.x === 0 && s.y === 0 && s.vx === 0 && s.vy === 0,
    `(${s.x}, ${s.y}) v=(${s.vx}, ${s.vy})`,
  )
}

// 7. `resetOrigin` puts it back at once, for the moment the chip goes off:
//    the uniform stops being written then, and the next switch-on must start
//    from rest rather than from wherever the bob was left hanging.
{
  const s = createOriginState()
  run(s, 3, 0, -1)
  check('after hanging, it is off centre', Math.abs(s.y) > 0.1, `y=${s.y.toFixed(4)}`)
  resetOrigin(s)
  check(
    'and resetOrigin returns it to exact rest',
    s.x === 0 && s.y === 0 && s.vx === 0 && s.vy === 0,
    `(${s.x}, ${s.y}) v=(${s.vx}, ${s.vy})`,
  )
}

// 8. Frame-rate independence, within reason: the same tilt held for the same
//    wall-clock time must land in the same place at 30fps and at 120fps, or
//    the swing is a different gesture on a different phone.
{
  const at = (dt: number): { x: number; y: number } => {
    const s = createOriginState()
    for (let i = 0; i < Math.round(6 / dt); i++) updateOrigin(s, dt, 0, -1)
    return { x: s.x, y: s.y }
  }
  const slow = at(1 / 30)
  const fast = at(1 / 120)
  check(
    'the resting point is the same at 30fps and 120fps',
    Math.abs(slow.y - fast.y) < 0.005,
    `${slow.y.toFixed(5)} vs ${fast.y.toFixed(5)}`,
  )
}

// 9. docs/todo.md entry 141 — pickEmitter: inside 36px (a uv radius the
//    caller derives from the canvas rect) hits, just outside misses. The
//    probe's own radiusUv stands in for "36px on some canvas"; the actual
//    px-to-uv conversion is main.ts's job and not this pure function's.
{
  const s = createOriginState()
  setAnchor(s, 0.2, -0.1)
  const radiusUv = 0.05
  check(
    'pickEmitter: a point just inside the radius hits',
    pickEmitter(s, 0.2 + radiusUv * 0.9, -0.1, radiusUv),
    'expected true',
  )
  check(
    'pickEmitter: a point just outside the radius misses',
    !pickEmitter(s, 0.2 + radiusUv * 1.1, -0.1, radiusUv),
    'expected false',
  )
  check('pickEmitter: dead centre of the anchor hits', pickEmitter(s, 0.2, -0.1, radiusUv), 'expected true')
}

// 10. docs/todo.md entry 141's own worked example: anchor moved to
//     (0.3, 0.1), gravity (0, 1) (this probe's upright-and-tilted-right
//     convention is tiltY = -1 for "upright"; the entry states the tilt as
//     the vector gravity itself points along, which for `updateOrigin`'s own
//     sign convention above is (0, 1) meaning "hangs toward positive y" —
//     matched here literally against the entry's own arithmetic rather than
//     reasoned about, since the entry gives an exact expected answer to
//     check against) settles at (0.3, 0.1 + ORIGIN_SAG) = (0.3, 0.38).
{
  const s = createOriginState()
  setAnchor(s, 0.3, 0.1)
  run(s, 6, 0, 1)
  const expectedY = 0.1 + ORIGIN_SAG
  check(
    'with the anchor at (0.3, 0.1), the bob settles at (0.3, 0.1 + ORIGIN_SAG)',
    Math.abs(s.x - 0.3) < 0.001 && Math.abs(s.y - expectedY) < 0.001,
    `(${s.x.toFixed(4)}, ${s.y.toFixed(4)}) vs (0.3, ${expectedY.toFixed(4)})`,
  )
}

// 11. resetOrigin settles at the anchor, not at the frame centre, once one
//     has been set — the fix for the exact regression a hardcoded (0, 0)
//     would have been: turning `grav` off after a drag must not snap the
//     picture back to the middle of the screen.
{
  const s = createOriginState()
  setAnchor(s, -0.15, 0.22)
  run(s, 3, 0, -1)
  resetOrigin(s)
  check(
    'resetOrigin settles at the anchor, not at (0, 0), once one has been set',
    Math.abs(s.x - -0.15) < 1e-9 && Math.abs(s.y - 0.22) < 1e-9 && s.vx === 0 && s.vy === 0,
    `(${s.x}, ${s.y}) v=(${s.vx}, ${s.vy})`,
  )
}

console.log(failures === 0 ? '\nall origin checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
