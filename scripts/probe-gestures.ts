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
    canvas: { getBoundingClientRect: () => rect },
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
