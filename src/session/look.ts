/**
 * The shuffle ladder and the DNA-URL builder: the pure pieces of "what does
 * the picture look like" that need no DOM, no `three`, and no visualiser to
 * compute. See docs/plans/session-extraction.md.
 */

import { MERGE_MODES, type MergeModeName } from '../merge-modes.ts'
import { MAPPINGS, type MappingName } from '../engine/index.ts'
import { encodeSeedHex } from '../release-name.ts'
import {
  ATMOSPHERIC_VIEWS,
  GEOMETRIC_VIEWS,
  type AtmosphericViewName,
  type GeometricViewName,
} from '../views.ts'
import type { GeoColour } from '../geo-colour'
import type { Prefs } from '../prefs'

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

/**
 * docs/todo.md entry 137 — the whole look as one copyable string, for the
 * `?debug` readout. The URL, completed: every look parameter that already
 * exists, plus `?seed=`, so pasting this into a fresh tab reproduces the
 * picture currently on screen — barring any re-roll since load, which
 * Decided deliberately declines to make capturable ("a re-roll still goes
 * somewhere random"). `geo=`/`atm=` rather than `mix=`: a session where the
 * two were set independently (from the HUD, never a link) would otherwise
 * lose the atmosphere's own alpha the moment `mix=` overwrote it back to the
 * value that parameter implies. Built from `prefs` — the same source
 * `Hud.current()` already reads — so this reflects whatever is live right
 * now, including anything the autopilot or a shake has since adopted, not
 * only what the page loaded with.
 *
 * The origin and path are the page's, not the session's, so this returns
 * the query alone and the caller prefixes.
 */
export function dnaQuery(prefs: Readonly<Prefs>, seed: readonly [number, number, number, number]): string {
  const rgb =
    `${Math.round(prefs.geoColour.r * 100)},` +
    `${Math.round(prefs.geoColour.g * 100)},` +
    `${Math.round(prefs.geoColour.b * 100)}`
  return (
    `geometric=${prefs.geometricView}` +
    `&atmospheric=${prefs.atmosphericView}` +
    `&rgb=${rgb}` +
    `&merge=${prefs.mergeMode}` +
    `&geo=${Math.round(prefs.geoAlpha * 100)}` +
    `&atm=${Math.round(prefs.atmAlpha * 100)}` +
    `&mapping=${prefs.mapping}` +
    `&seed=${encodeSeedHex(seed)}`
  )
}

/** What a shuffle changes at each rung. Each rung includes everything below
 *  it — see shuffled()'s own comment for the reasoning behind the order and
 *  the numbers. Below the re-seed (docs/todo.md entry 35) the four
 *  continuous quantities — both layers' colours and opacities — only
 *  *nudge* from wherever they already are; a full re-roll from scratch
 *  joins the re-seed at SHUFFLE_RESEED, since replacing the palette
 *  outright is not the smallest change the ladder can make. */
export const SHUFFLE_RESEED = 0.3
export const SHUFFLE_MERGE = 0.45
export const SHUFFLE_VIEWS = 0.7
export const SHUFFLE_EVERYTHING = 0.9

/** How often the top rung also rolls the camera, and how high it may go —
 *  docs/todo.md entry 22. One in three, not always: the shuffle at this
 *  depth already changes a great deal, and raising the room every single
 *  time would make the camera read as part of the ladder's own logic rather
 *  than as the separate, licensed exception it is. Capped at 0.6, not 1 —
 *  passthrough at 1 leaves the room and no visualiser, which is not a
 *  picture the shuffle should be able to hand back. */
export const CAMERA_ROLL_CHANCE = 1 / 3
export const CAMERA_ROLL_MAX = 0.6

interface Shuffle {
  geometricView?: GeometricViewName
  atmosphericView?: AtmosphericViewName
  mergeMode?: MergeModeName
  atmMergeMode?: MergeModeName
  geoColour?: GeoColour
  atmColour?: GeoColour
  camColour?: GeoColour
  geoAlpha?: number
  atmAlpha?: number
  mapping?: MappingName
}

/**
 * A new picture, graded by how hard the shake that asked for it was.
 *
 * `depth` is the 0-1 scale shake.ts's `intensity()` computes from a peak —
 * see docs/todo.md entry 15. Every rung includes the ones below it, ordered
 * by how little of what you had survives: a colour shift is recognisably the
 * same picture, a view change is a different instrument.
 *
 *   any qualifying shake   both layers' colours and opacities *nudge*
 *                          (this function only — see entry 35)
 *   0.30                   colours and opacities *re-roll* from scratch,
 *                          + re-seed (the caller's own job — see shuffle())
 *   0.45                   + both merge modes
 *   0.70                   + both views
 *   0.90                   + opacity re-rolls again (span, not nudge),
 *                          mapping, the camera layer's colour
 *
 * Colours used to have no threshold check at all, which sounds the same as
 * "always" but is not: the *re-seed* was what actually had no threshold
 * (`shuffle()` called `visualiser.randomise()` unconditionally, outside
 * every depth test below), and a re-seed replaces the arrangement entirely
 * while keeping only the palette and the view — the biggest change the
 * ladder can make, sitting where the smallest one belongs. Entry 29 gives
 * the re-seed its own threshold (`SHUFFLE_RESEED`, 0.30 — above the old
 * colour boundary, so a shake that used to re-seed silently now shifts the
 * palette instead) and puts colours at the true bottom of the ladder.
 *
 * A full re-roll is still the biggest change *that* rung can make, though —
 * nothing of the palette survives it. Entry 35 makes the true bottom rung a
 * *perturbation* instead: below SHUFFLE_RESEED, `geoColour`, `atmColour`,
 * `geoAlpha` and `atmAlpha` each move a little from their current value
 * (`current`, below) rather than being replaced, so the gentlest qualifying
 * shake shifts the picture you have rather than handing you a different
 * one. The full re-roll moves up to join the re-seed at SHUFFLE_RESEED,
 * which is the one rung it was always meant to share — nothing of the
 * palette surviving is exactly what a re-seed already does to everything
 * else.
 *
 * Opacity and mapping were excluded entirely when this was a single on/off
 * shuffle (entry 6) — opacity because a shuffle that can hand back a black
 * screen looks like a crash recoverable only by shaking at nothing, mapping
 * because it is how the picture *hears*, not what it looks like. Both are
 * back at the top rung: opacity floored at 0.5 (raised from an initial 0.35
 * by entry 21, once the *product* of opacity and colour turned out to be
 * what actually goes dark — see SHUFFLE_MIN_ALPHA's own comment) rather than
 * spanning 0-1, and mapping because at the top of the scale the ask is a
 * genuinely different instrument, not a different palette — overturning
 * entry 6's exclusion on purpose rather than by oversight.
 *
 * The camera may also be raised at the top rung — see maybeRollCamera()
 * below. This overturns what this comment used to say, and what entries 6
 * and 15 both said: that the camera could never be switched on by a
 * shuffle, "not a taste call, the capture hard stop." Licensed by Victor
 * 2026-08-29 (entry 22), narrowly: only at the top rung, only sometimes, and
 * only where permission was already granted — a `devicemotion` event
 * carries no user activation, so this can raise the level but never itself
 * ask for the camera the first time. **That last clause is still true of
 * this path and is no longer true of every path**: docs/todo.md entry 121
 * adds a shake *with a finger already on the glass*, where the finger's own
 * `pointerdown` supplies the activation this one lacks, and which therefore
 * may open the camera for the first time. See `maybeRaiseCameraOnPress`. `shuffled()` itself is unchanged by
 * this; the roll lives in `maybeRollCamera()` because it needs an async
 * permission check this function cannot make.
 *
 * A field is present only when its rung is reached, so `Hud.adopt()`'s
 * "only touch what's given" guards do the rest — a shuffle that doesn't
 * reach mapping must never re-create the live Mapping instance and discard
 * its envelope state for nothing.
 */
/**
 * A layer's actual brightness is its opacity times its colour gain's peak
 * channel (composite.frag.glsl: `base = atmosphere * uAtmAlpha *
 * uAtmColour`) — a product, not either number in isolation. Flooring
 * opacity alone (0.35) left the product as low as 0.07, which read as the
 * screen going dark for no reason anyone could trace back to a shake. See
 * docs/todo.md entry 21.
 *
 * docs/todo.md entry 70 removes the other half of that floor rather than
 * raising it: `colour()` below now rolls a hue at full value (HSV,
 * `v = 1`), so the dominant channel is always exactly 1 by construction —
 * there is no longer a dim-roll case for a floor to catch. Worst case is
 * 0.5 (this alpha floor) × 1 (the roll's own guaranteed peak) = 0.5,
 * better than entry 21's own 0.25 target, for free.
 *
 * Entry 35's nudge below SHUFFLE_RESEED clamps alpha to this same floor,
 * not a nudge-specific one — repeated light shakes are a random walk, and
 * a walk with no floor eventually reaches entry 21's failure by a slower
 * road: twenty small steps down reach black exactly as one big one does.
 */
const SHUFFLE_MIN_ALPHA = 0.5

/** docs/todo.md entry 70: a fresh colour is a hue and a saturation, not
 *  three independent channel gains — sampling r, g and b independently
 *  clusters around the grey diagonal (the three land near each other far
 *  more often than far apart, and near each other *is* grey), and capping
 *  each channel at a 0.2 floor made a pure hue unreachable regardless.
 *  Saturation 0.55-1.0, **Mine** as to the range: high enough that even the
 *  low end reads as colourful, wide enough that "the same colour every
 *  time" is not traded for "the same saturation every time". Value pinned
 *  at 1 (the largest of the three gains is always exactly 1) rather than
 *  independently chosen — gains can only ever remove light, so a saturated
 *  red must already be as bright as gains allow, and letting saturation
 *  and brightness vary independently would make "more colourful" quietly
 *  mean "darker" again. */
const SHUFFLE_MIN_SATURATION = 0.55

/** How far a light shake may nudge a colour's hue (degrees) or saturation,
 *  or an opacity, from its current value — docs/todo.md entry 35's floor,
 *  entry 70's hue/saturation split. **Mine** — neither entry names the
 *  hue/saturation pair; chosen so a single gentle shake visibly rotates the
 *  hue a little without ever crossing into "a different colour". */
const NUDGE_HUE_DEG = 20
const NUDGE_SATURATION = 0.08
const NUDGE_ALPHA = 0.06

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** HSV -> RGB with `v` pinned at 1 — see SHUFFLE_MIN_SATURATION's own
 *  comment for why value is never independent of saturation here. `h` in
 *  degrees, wrapped by the caller; `s` already clamped by the caller. */
function hueToColour(h: number, s: number): GeoColour {
  const c = s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = 1 - c
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return { r: r + m, g: g + m, b: b + m }
}

/** The inverse of hueToColour(), for nudging a colour that is already
 *  stored as three gains rather than a hue/saturation pair. Value is
 *  discarded (recomputed as 1 on the way back by hueToColour itself) since
 *  every colour this module ever produces already has it pinned there. */
function colourToHueSat(c: GeoColour): { h: number; s: number } {
  const max = Math.max(c.r, c.g, c.b)
  const min = Math.min(c.r, c.g, c.b)
  const d = max - min
  const s = max === 0 ? 0 : d / max
  if (d === 0) return { h: 0, s }
  let h = max === c.r ? ((c.g - c.b) / d) % 6 : max === c.g ? (c.b - c.r) / d + 2 : (c.r - c.g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s }
}

export function shuffled(
  depth: number,
  current: { geoColour: GeoColour; atmColour: GeoColour; geoAlpha: number; atmAlpha: number },
): LookPatch {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
  const colour = (): GeoColour =>
    hueToColour(Math.random() * 360, SHUFFLE_MIN_SATURATION + Math.random() * (1 - SHUFFLE_MIN_SATURATION))

  // A little from wherever the hue and saturation already are, wrapping hue
  // and clamping saturation to the same [0.55, 1] a fresh roll lives in —
  // entry 35's bottom rung, entry 70's hue/saturation split.
  const nudgeColour = (c: GeoColour): GeoColour => {
    const { h, s } = colourToHueSat(c)
    const newH = (h + (Math.random() * 2 - 1) * NUDGE_HUE_DEG + 360) % 360
    const newS = clamp(s + (Math.random() * 2 - 1) * NUDGE_SATURATION, SHUFFLE_MIN_SATURATION, 1)
    return hueToColour(newH, newS)
  }
  const nudgeAlpha = (a: number): number => clamp(a + (Math.random() * 2 - 1) * NUDGE_ALPHA, SHUFFLE_MIN_ALPHA, 1)

  const next: Shuffle = {}
  if (depth >= SHUFFLE_RESEED) {
    // The full re-roll, exactly as it was before entry 35 — this rung
    // already replaces the arrangement via the re-seed, so replacing the
    // palette outright belongs here rather than at the bottom.
    next.geoColour = colour()
    next.atmColour = colour()
  } else {
    // Entry 35's own point: below the re-seed, the picture you have shifts
    // rather than being replaced.
    next.geoColour = nudgeColour(current.geoColour)
    next.atmColour = nudgeColour(current.atmColour)
    next.geoAlpha = nudgeAlpha(current.geoAlpha)
    next.atmAlpha = nudgeAlpha(current.atmAlpha)
  }
  if (depth >= SHUFFLE_MERGE) {
    next.mergeMode = pick(Object.keys(MERGE_MODES) as MergeModeName[])
    next.atmMergeMode = pick(Object.keys(MERGE_MODES) as MergeModeName[])
  }
  if (depth >= SHUFFLE_VIEWS) {
    next.geometricView = pick(Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[])
    next.atmosphericView = pick(Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[])
  }
  if (depth >= SHUFFLE_EVERYTHING) {
    next.geoAlpha = SHUFFLE_MIN_ALPHA + Math.random() * (1 - SHUFFLE_MIN_ALPHA)
    next.atmAlpha = SHUFFLE_MIN_ALPHA + Math.random() * (1 - SHUFFLE_MIN_ALPHA)
    next.camColour = colour()
    next.mapping = pick(Object.keys(MAPPINGS) as MappingName[])
  }
  return next
}
