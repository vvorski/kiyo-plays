/**
 * The audio analysis engine.
 *
 * One microphone in, two timescales out. Everything in here is about
 * *listening*; nothing in here knows that a screen exists.
 *
 *   capture.ts   getUserMedia → AnalyserNode → AudioFrame
 *   fast.ts      AudioFrame → Motion       10 ms – 4 s   (swappable strategies)
 *   slow.ts      AudioFrame → Character    30 s – 5 min
 *   features.ts  descriptors both tiers share
 *   ripples.ts   the transient → event-buffer edge detector
 *   emitter.ts   the touch → event-buffer equivalent, a held gesture rather
 *                than a threshold crossing
 *   touches.ts   one owner of every finger on the picture, up to four at
 *                once — docs/todo.md entry 49. Feeds `emitter.ts`, among
 *                others; does not replace it.
 *   tilt.ts      what counts as "flat", for the two features that ask
 *   origin.ts    the geometric layer's own centre, hanging on a spring under
 *                the phone's gravity — docs/todo.md entry 132.
 *   raise-camera.ts  whether a shake with a finger down may bring the room
 *                in — docs/todo.md entry 121. The finger is what supplies
 *                the user activation `getUserMedia` needs.
 *   hover.ts     a mouse cursor moving over the picture, as a thing the
 *                picture answers — docs/todo.md entry 112. Deliberately not
 *                a synthesised touch; see its own comment for why.
 *   touch.ts     the touch → atmospheric-stream envelope — docs/todo.md
 *                entry 48. A different shape of "turn a contact into a
 *                number" from ripples.ts/emitter.ts: no position, since the
 *                views it feeds have no notion of one.
 *   motion-bias.ts  the phone's own posture and handling reaching the
 *                picture's colour, continuously — docs/todo.md entry 58.
 *   rgb-slip.ts  the phone's own disturbance pulling the colour channels
 *                apart and springing them back — docs/todo.md entry 76.
 *   posture.ts   still, carried, driving, dancing, handled — how the phone
 *                is currently being held, for director.ts's own pacing —
 *                docs/todo.md entry 90.
 *   camera-arm.ts  how long armed camera mode stays armed, read from
 *                posture and tilt rather than a wall clock — docs/todo.md
 *                entry 109.
 *   synth-shake.ts  a held space bar, synthesised into the same `MotionSample`
 *                shape `shake.ts`'s real `devicemotion` listener produces —
 *                docs/todo.md entry 126. The one motion source that starts
 *                from a key rather than a sensor.
 *
 * This became a directory when the slow tier arrived. Before that there was one
 * interpretation of the captured audio living behind an interface, which is a
 * guess about the future; two is a fact about the present, and the moment the
 * second one existed the boundary was worth naming. `ripples.ts` came along
 * because it never belonged where it was: it is a pure edge-triggered state
 * machine over `(transient, breakdown)` with no imports, and it sat on the
 * rendering side only because `MAX_RIPPLES` has to match a GLSL constant.
 *
 * The two tiers are deliberately not symmetrical. `Motion` is consumed every
 * frame and drives movement. `Character` is consumed as *decisions* — see
 * director.ts, which is outside this directory because it is policy, and policy
 * fails differently from measurement.
 *
 * Nothing here touches the DOM, uses a global, or reads a clock; time arrives
 * as `dt` on the frame. That is what lets the whole chain run under
 * `node --experimental-strip-types` against synthetic input, which is the only
 * practical way to tune anything with a timescale longer than a few seconds.
 * Value imports between these files therefore carry the `.ts` extension, which
 * Node requires and the bundler does not mind.
 */

export { startMicrophone, MAX_DB, MIN_DB } from './capture.ts'
export type { AudioFrame, AudioSource } from './capture.ts'

export { MAPPINGS, Envelope } from './fast.ts'
export type { Mapping, MappingName, VisualParams } from './fast.ts'

export { StructureAnalysis, bandVector, BAND_EDGES, N_BANDS } from './features.ts'
export type { Features } from './features.ts'

export { SlowAnalysis, BLANK } from './slow.ts'
export type { Character } from './slow.ts'

export { createRippleState, updateRipples, spawnAt, MAX_RIPPLES, AUDIO_RIPPLES } from './ripples.ts'
export type { RippleState } from './ripples.ts'

export { createEmitterState, updateEmitter, CHARGE_TIME } from './emitter.ts'
export type { EmitterState } from './emitter.ts'

export {
  createHoverState,
  moveHover,
  hoverLeft,
  updateHover,
  HOVER_QUIET,
  HOVER_CHARGE_CAP,
  PRESENCE_TAU,
} from './hover.ts'
export type { HoverState, HoverReading } from './hover.ts'

export { createTouchField, toShaderUv, pointerAction, VELOCITY_SMOOTH } from './touches.ts'
export type { Touch, TouchField, TouchFieldEvent, TouchEventKind, PointerAction } from './touches.ts'

export { createTouchStreamState, updateTouchStream } from './touch.ts'
export type { TouchStreamState, TouchStream } from './touch.ts'

export { createMotionBiasState, updateMotionBias } from './motion-bias.ts'
export type { MotionBiasState, MotionBias } from './motion-bias.ts'

export { createRgbSlipState, updateRgbSlip, MAX_SLIP } from './rgb-slip.ts'
export type { RgbSlipState } from './rgb-slip.ts'

export { createPostureState, updatePosture } from './posture.ts'
export type { Posture, PostureState, PostureReading } from './posture.ts'

export { createCameraArmState, armCamera, disarmCamera, updateCameraArm } from './camera-arm.ts'
export type { CameraArmState, CameraArmReading } from './camera-arm.ts'

export { isFlatTilt, FLAT_TILT_MIN } from './tilt.ts'

export {
  createOriginState,
  updateOrigin,
  resetOrigin,
  setAnchor,
  pickEmitter,
  pickNode,
  chorusNodeOffsets,
  ORIGIN_SAG,
} from './origin.ts'
export type { OriginState } from './origin.ts'

export { shouldRaiseCamera, PRESS_SHAKE_PASSTHROUGH } from './raise-camera.ts'
export type { RaiseCameraInput } from './raise-camera.ts'

export { celestialFor, CELESTIAL_IDENTITY } from './celestial.ts'
export type { CelestialInfluence } from './celestial.ts'

export { createSynthShake, startSynthShake, updateSynthShake } from './synth-shake.ts'
export type { SynthShakeState } from './synth-shake.ts'
