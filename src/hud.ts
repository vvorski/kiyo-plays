/**
 * The control HUD: a wedge of arcs, one band per parameter.
 *
 * A 120° wedge hinged just outside the bottom-right corner — where the thumb
 * actually pivots from. Icons on the outermost arc choose what the wedge is
 * showing; the bands inside are that thing's controls, stacked outward-in.
 *
 * Everything here is an arc. There is not a straight edge in the control
 * surface, which is a rule rather than a preference: a rectangular panel of
 * sliders was tried and it read as a settings screen bolted onto a piece of
 * work, not as part of it. Arcs also happen to be what a thumb can reach on a
 * phone held one-handed, which is why the wedge existed in the first place.
 *
 * Every layer gets the same controls, and that uniformity is the point:
 *
 *   view      an arc of options, turned past a notch     (not the camera)
 *   opacity   an arc dragged 0-100
 *   R, G, B   three more arcs, dragged 0-100
 *
 * Colour used to belong only to the geometric layer. Tinting a real camera
 * image is a different gesture from tinting generated line work — it is a
 * filter over something that already has colours — but it is the same
 * arithmetic and the same control, and layers differing in what could be done
 * to them was what made the stack feel arbitrary rather than composed.
 *
 * Merge mode is a per-layer property too, for the same reason: it describes
 * how *that* layer combines with what is beneath it, so the geometric and
 * atmospheric groups each carry their own — the atmosphere's own blend, over
 * the camera, used to be hardcoded and is now this band.
 *
 * The last icon selects no layer at all: it is Listening, and holds mapping —
 * how the picture *hears*, which every layer shares equally, rather than a
 * property of any one of them.
 */

import {
  ATMOSPHERIC_VIEWS,
  type AtmosphericViewName,
  GEOMETRIC_VIEWS,
  type GeometricViewName,
} from './views'
import { MERGE_MODES, type MergeModeName } from './merge-modes'
import { MAPPINGS, type MappingName, type VisualParams } from './engine'
import { type GeoColour } from './geo-colour'
import type { Prefs } from './prefs'
import type { SessionStats } from './session/shell'
import type { LookPatch } from './session/look'

const SVG_NS = 'http://www.w3.org/2000/svg'
import { chipPosition } from './chip-arc.ts'

const DEG = Math.PI / 180
const TAU = Math.PI * 2

/** The wedge's opening, in degrees about the hinge. Drives the tick rim and
 *  the enum bands, which are read at the notch and never need their ends —
 *  see SCALAR_A/SCALAR_B for why a scalar band cannot use this directly. */
const SWEEP_A = 165
const SWEEP_B = 285
/**
 * A scalar band's own, narrower span — its track, its knob's travel, and the
 * angle a drag maps back to a value all use this instead of SWEEP_*.
 *
 * From a bottom-right hinge the screen occupies exactly 180°-270°; SWEEP_*
 * is 30° wider than that on purpose, so an enum band's ends can sit off-
 * screen with nothing lost, since they're only ever read at the notch. A
 * scalar band maps its *whole range* onto that arc, so its own ends — 100%
 * and 0% — landed off-screen too, at roughly 15%/85% reachable rather than
 * 0%/100%. Symmetric about the 225° notch, like SWEEP_*, so 50% stays put:
 * 8.3px inside the viewport at 320×568 (10.6px at 360×640), which 186°-264°
 * does not quite clear and 192°-258° clears with 4° more travel spent than
 * needed. Costs sensitivity — the full range is 70° now instead of 120°,
 * about 1.7x more value per degree of thumb travel — which is worth it for
 * ends that are actually reachable. See docs/todo.md entry 14.
 */
const SCALAR_A = 190
const SCALAR_B = 260
/** Where a selection is read off. Midway along the sweep. */
const NOTCH = 225 * DEG
/** Angular spacing between adjacent options on an enum band. */
const PITCH = 26 * DEG
/** Options fade out this far from the notch, so a band reads as a strip
 *  passing a window rather than a full circle of equal candidates. */
const CUTOFF = 40 * DEG

/**
 * Band radii, as fractions of the smaller viewport dimension, outermost first.
 *
 * Six, because that is the most any one selection needs now: view, merge,
 * opacity, and three colour channels, for the geometric and atmospheric
 * layers. A selection with fewer takes the first few and the rest are simply
 * not built, so the spacing never depends on how many there happen to be.
 *
 * The sixth radius, 0.33, is new: the old single merge-mode band lived at
 * 0.30 in the retired `set` group, so an arc this small is already proven
 * draggable on a phone.
 */
const BAND_R = [0.88, 0.75, 0.63, 0.53, 0.43, 0.33]

/** docs/todo.md entry 77. The outer ring is drawn smaller, not harder to
 *  hit — see `mkChip`'s own comment on how that split is achieved. **Mine**. */
const R_CHIPS_OUTER_SCALE = 0.8

// TAP_SLOP_PX moved to session/gestures.ts, where the recogniser it bounds
// now lives, and is re-exported here so this file's own use and
// hud-probe.html are unaffected.
export { TAP_SLOP_PX } from './session/gestures'
/** Half-width of an invisible grab arc. The thumb-safe minimum this file is
 *  built around; the drawn tracks are far thinner. */
const GRAB_PX = 24

/** Per-channel identity, used by every layer's colour bands. */
const CHANNELS = [
  { key: 'r' as const, label: 'R', tint: '#ff4d5e' },
  { key: 'g' as const, label: 'G', tint: '#4dff8f' },
  { key: 'b' as const, label: 'B', tint: '#5c8bff' },
]

const MAPPING_LABELS: Record<MappingName, string> = {
  relative: 'Relative',
  'speech-band': 'Absolute',
  'auto-normalised': 'Normalised',
  beat: 'Beat',
  dynamics: 'Dynamics',
  'bass-led': 'Bass-led',
}

export interface Hud {
  /** Call every frame with the current state; only does work while visible. */
  update(params: VisualParams, stats: SessionStats): void
  /** The session changed the look on its own — the autopilot, a shake, a
   *  camera raise. Nothing to write: `controls.look` is already what is on
   *  screen. Only redraw what is visible; the HUD is closed most of the
   *  time and setOpen rebuilds from the look anyway. */
  lookChanged(): void
  /**
   * Open the panel — docs/todo.md entries 41 and 52. main.ts's single
   * recogniser calls this once it resolves a double tap anywhere on the
   * picture (entry 52 retired the middle-third zone a plain tap used to
   * need); this file no longer listens for that tap itself, since two
   * independent recognisers agreeing through a capture-phase
   * `stopPropagation()` is exactly what entry 41 replaced with one.
   */
  open(): void
  /** Close the panel without the scrim's own tap-to-close gesture —
   *  docs/todo.md entry 72: entering camera mode closes the panel as part
   *  of the same tap that enters it, which is not a tap on the scrim at
   *  all. */
  close(): void
  /**
   * Whether the numeric readout is showing this session — docs/todo.md
   * entry 31. Not the same as `prefs.showStats`: a `?debug` load shows the
   * readout for that load only, without writing the choice back, so a
   * caller gating other diagnostics (main.ts's shake flash) on "is it on
   * screen right now" needs this rather than the stored preference.
   */
  showingStats(): boolean
  /**
   * Flip the numeric readout, exactly as tapping the `num` chip does —
   * docs/todo.md entry 116, for the `d` key. The same one path, including
   * the write back to `prefs` and the chip's own repaint, so the two can
   * never disagree about what is showing or whether it was remembered.
   */
  toggleStats(): void
}

/** What the HUD needs from the session: the look to draw, and one way to
 *  change it. Narrower than `Session` on purpose — the HUD must not be able
 *  to start, stop or dispose the app it is drawn over. */
export interface LookControls {
  readonly look: Readonly<Prefs>
  apply(patch: LookPatch, opts: { rampS: number; persist?: boolean }): void
  persist(): void
  setPassthrough(a: number): Promise<number>
  /**
   * Momentary solo — docs/todo.md entry 83. Forces every layer but `layer`
   * to render at 0 opacity for as long as the chip is held; `unsolo` lifts
   * the force. Neither writes to `prefs` — this is the same
   * render-time-override seam entries 48, 58 and 60 already use, so there
   * is nothing to restore on release beyond removing the override, and
   * nothing an interrupted gesture (a pointer that never delivers `up`)
   * can leave behind.
   */
  solo(layer: 'geo' | 'atm' | 'cam'): void
  unsolo(): void
}

/** Bold geometric masses, because a 20px drawing over a moving visualiser
 *  survives as a silhouette and not as a hairline. Each fills currentColor. */
const ICONS: Record<string, string> = {
  geo:
    '<path d="M12.9 1.2a10.8 10.8 0 0 1 9.3 16.1l-9.3-5.4z"/>' +
    '<path d="M22.2 17.3a10.8 10.8 0 0 1-18.6 0l9.3-5.4z" fill-opacity=".6"/>' +
    '<path d="M3.6 17.3A10.8 10.8 0 0 1 11.1 1.2v10.7z" fill-opacity=".34"/>',
  atm:
    '<path d="M1.4 15.6c3-5.4 6-5.4 9 0s6 5.4 9 0 2.8-4.2 3.2-3.4v9.2H1.4z"/>' +
    '<path d="M1.4 9.4c3-5.4 6-5.4 9 0s6 5.4 9 0 2.8-4.2 3.2-3.4v4.6c-1 .4-2 1.4-3.2 3.4-3 5.4-6 5.4-9 0s-6-5.4-9 0z" fill-opacity=".5"/>',
  cam:
    '<path d="M1.4 2.6h6v3.4H4.8v12H7.4v3.4h-6z"/>' +
    '<path d="M22.6 2.6h-6V6h2.6v12h-2.6v3.4h6z"/>' +
    '<circle cx="12" cy="12" r="5.6"/>',
  // Three concentric arcs, like sound arriving — chosen over the old
  // diagonal-and-blocks glyph (which read as "settings", the mistake this
  // group's rename fixes) and over a level meter (already the numeric
  // readout icon's shape).
  ear:
    '<path d="M9.6 9.6a3.4 3.4 0 0 1 4.8 4.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M6.4 6.4a8 8 0 0 1 11.2 11.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-opacity=".62"/>' +
    '<path d="M3.2 3.2a12.6 12.6 0 0 1 17.6 17.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-opacity=".34"/>',
  num:
    '<path d="M1.6 21V13.4h5.2V21zM9.4 21V6.6h5.2V21zM17.2 21V1.4h5.2V21z"/>' +
    '<path d="M1 22.4h22v1.6H1z" fill-opacity=".45"/>',
  // Four corner brackets, the universal fullscreen mark — straight lines are
  // fine inside a chip, since the circular non-negotiable governs the
  // control surface, not every icon drawn on it (see `cam`'s own brackets).
  // Lives outside this file's own chip set (docs/todo.md entry 19), but the
  // glyph is defined here so main.ts's element and this file's icons never
  // drift into two different fullscreen marks.
  full:
    '<path d="M1 9V1h8v3H4v5z"/>' +
    '<path d="M23 9V1h-8v3h5v5z"/>' +
    '<path d="M1 15v8h8v-3H4v-5z"/>' +
    '<path d="M23 15v8h-8v-3h5v-5z"/>',
  // A plumb bob: a mount, a line, a weight — the plainest glyph for "this
  // answers which way is down". Straight lines are fine here for the same
  // reason `full`'s brackets are — see that icon's own comment.
  grav:
    '<path d="M8 1.4h8v2.6H8z"/>' +
    '<path d="M11.2 4v7.4h1.6V4z"/>' +
    '<circle cx="12" cy="16.4" r="6.2"/>',
  // docs/todo.md entry 127 removed the `day` icon (a filled disc with eight
  // rays, entry 47) along with the sun chip it drew for — the manual sky
  // override it toggled is gone, and an icon with no chip is dead weight.
}

const CSS = `
.hud-scrim {
  position: fixed; inset: 0; z-index: 30;
  opacity: 0; pointer-events: none;
  transition: opacity 200ms ease;
  /* Dimmed only where the HUD actually is. A full-screen scrim would hide the
     visualiser, which is the one thing you need to see while adjusting it. */
  background: radial-gradient(
    130% 95% at 100% 100%,
    rgba(3, 4, 8, 0.86) 0%, rgba(3, 4, 8, 0.58) 46%, rgba(3, 4, 8, 0) 80%);
}
.hud-scrim.open { opacity: 1; pointer-events: auto; }
@media (prefers-reduced-motion: reduce) { .hud-scrim { transition: none; } }

.hud-dial { position: absolute; inset: 0; width: 100%; height: 100%; }
/* Only the grab arcs take input; everywhere else falls through to the scrim,
   which closes. */
.hud-dial * { pointer-events: none; }
.hud-dial .hit { pointer-events: stroke; cursor: pointer; }

.hud-track { fill: none; stroke: rgba(18,18,35,0.78); }
.hud-rule  { fill: none; stroke: rgba(255,255,255,0.07); stroke-width: 1; }
.hud-tick  { stroke: rgba(169,166,232,0.20); stroke-width: 1; }
.hud-tick.major { stroke: rgba(169,166,232,0.42); }

.hud-item {
  font: 500 12px "Chakra Petch", ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.06em; text-transform: uppercase;
  fill: #6f6b8c; text-anchor: middle; dominant-baseline: middle;
}
.hud-item.on { fill: #f0eeff; }
.hud-selector { fill: rgba(169,166,232,0.13); stroke: rgba(169,166,232,0.85); stroke-width: 1.4; }

.hud-fill { fill: none; stroke-linecap: round; }
.hud-knob { stroke: none; }
/* The atmospheric texture: a soft, wide field behind the fill it belongs to —
   a continuous layer reads as a glow, not an edge. See docs/hud-design.md. */
.hud-halo { fill: none; stroke-linecap: round; opacity: 0.22; }
/* A band's own name and value, on the notch line just inside its radius —
   clear of the option labels, which sit on the radius itself. */
.hud-band-label {
  font: 500 9.5px ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.08em; text-transform: uppercase;
  text-anchor: middle; dominant-baseline: middle;
}

.hud-btns { position: absolute; inset: 0; pointer-events: none; }
/* Invisible must also mean untappable. The scrim is pointer-events:none when
   closed, but a child that sets pointer-events:auto is still a hit target
   regardless of its parent — so with the HUD shut, a tap that happened to land
   where an icon sits changed the selected group and swallowed the tap that was
   meant to open the thing. Nothing visible happened, which is the worst
   version of that bug. */
.hud-scrim:not(.open) .hud-chip { pointer-events: none; }
/* docs/todo.md entry 77: the button itself is the touch target and stays a
   fixed 3rem always — a hand doesn't get less thumb-safe for being on the
   outer ring. Everything drawn (the circle, the border, the icon) lives on
   the nested .hud-chip-face instead, which the outer ring alone scales down
   with a transform — a transform changes what is painted, not the box a
   pointer event hit-tests against, which is exactly the "smaller drawn, not
   smaller to hit" split this entry asks for. */
.hud-chip {
  appearance: none; cursor: pointer; position: absolute; pointer-events: auto;
  width: 3rem; height: 3rem; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: #8a86a4;
}
.hud-chip-face {
  width: 100%; height: 100%; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(12,12,26,0.85);
  border: 1px solid rgba(44,41,71,0.9);
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease, transform 160ms ease;
}
.hud-chip--outer .hud-chip-face {
  transform: scale(${R_CHIPS_OUTER_SCALE});
}
.hud-chip[aria-pressed='true'] .hud-chip-face {
  background: rgba(26,24,48,0.9); border-color: var(--tint, #9d9bf0); color: #f0eeff;
}
/* (0,2,0) specificity — one class plus one attribute — beats .hud-chip's own
   (0,1,0) display:flex without needing !important. Without this, the UA
   stylesheet's own [hidden] display:none rule (0,1,0) loses to this file's
   later, equal-specificity .hud-chip rule, and an element's own hidden
   attribute does nothing. Missing this made a hidden fullscreen chip
   (docs/todo.md entry 19) visible from the moment the HUD's CSS loaded,
   which reads as fullscreen having been lost the instant it was entered. */
.hud-chip[hidden] { display: none; }
.hud-icon { width: 19px; height: 19px; display: block; }

.hud-stats {
  position: absolute; margin: 0;
  left: calc(0.75rem + env(safe-area-inset-left, 0px));
  top: calc(0.75rem + env(safe-area-inset-top, 0px));
  font: 400 10.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre; color: #77809a; pointer-events: none;
}
`

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v))
  return n
}

/** Shortest signed difference a-b, wrapped to [-PI, PI). */
function delta(a: number, b: number): number {
  let d = (a - b) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/** A ring of discrete options, turned past the notch. */
interface EnumBand {
  readonly kind: 'enum'
  readonly name: string
  readonly keys: readonly string[]
  label(k: string): string
  current(): string
  commit(k: string): void
  /** Rotation, in radians. 0 puts keys[0] under the notch. */
  rot: number
}

/**
 * A continuous 0-1 value, dragged along its arc.
 *
 * `texture` is what says which layer this is, for the one band type where
 * that matters — see docs/hud-design.md. Left undefined it means "colour
 * channel": every layer's R/G/B stays visually identical on purpose, because
 * a colour band must read as a colour band wherever it appears.
 */
interface ScalarBand {
  readonly kind: 'scalar'
  readonly name: string
  readonly tint: string
  readonly texture?: 'solid' | 'halo' | 'segmented'
  current(): number
  /** Live, on every pointermove. */
  apply(v: number): void
  /** Once, on release — where persistence and any prompting belong. */
  settle(): void
}

type Band = EnumBand | ScalarBand

/**
 * `debugFromUrl` forces the readout on for this load only, without touching
 * `prefs.showStats` — docs/todo.md entry 31. Kept as its own parameter
 * rather than folded into `prefs`, which is exactly the mistake this entry
 * exists to undo: `prefs` is what persists, and a per-load URL flag is not
 * a persisted fact.
 */
export function createHud(controls: LookControls, debugFromUrl = false): Hud {
  const prefs = controls.look
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const scrim = document.createElement('div')
  scrim.className = 'hud-scrim'
  scrim.setAttribute('role', 'dialog')
  scrim.setAttribute('aria-label', 'Controls')

  /** What is actually on screen this session — see docs/todo.md entry 31.
   *  Starts from the stored preference or, for this load only, `?debug`;
   *  only the `num` chip below ever writes it back to `prefs`. */
  let showStats = debugFromUrl || prefs.showStats
  const stats = document.createElement('pre')
  stats.className = 'hud-stats'
  stats.hidden = !showStats
  scrim.appendChild(stats)

  const svg = el('svg', { class: 'hud-dial' })
  scrim.appendChild(svg)

  const btnBar = document.createElement('div')
  btnBar.className = 'hud-btns'
  scrim.appendChild(btnBar)

  document.body.appendChild(scrim)

  const geometricKeys = Object.keys(GEOMETRIC_VIEWS) as GeometricViewName[]
  const atmosphericKeys = Object.keys(ATMOSPHERIC_VIEWS) as AtmosphericViewName[]
  const mergeKeys = Object.keys(MERGE_MODES) as MergeModeName[]
  const mappingKeys = Object.keys(MAPPINGS) as MappingName[]

  /** What the camera band shows, which during a drag runs ahead of what has
   *  actually been granted. `controls.setPassthrough` is the only thing
   *  allowed to make it true — see the camera opacity band's settle(). */
  let camShown = 0

  /** The three colour bands every layer gets, built from one description. */
  function colourBands(layer: 'geo' | 'atm' | 'cam', read: () => GeoColour): ScalarBand[] {
    return CHANNELS.map(({ key, label, tint }) => ({
      kind: 'scalar' as const,
      name: label,
      tint,
      current: () => read()[key],
      apply: (v: number) => {
        const next = { ...read(), [key]: v }
        controls.apply({ [`${layer}Colour`]: next } as LookPatch, { rampS: 0, persist: false })
      },
      settle: controls.persist,
    }))
  }

  /** A layer's own merge-mode band — how it combines with what's beneath it. */
  function mergeBand(layer: 'geo' | 'atm'): EnumBand {
    return {
      kind: 'enum',
      name: 'Merge',
      keys: mergeKeys,
      label: (k) => MERGE_MODES[k as MergeModeName].label,
      current: () => (layer === 'geo' ? prefs.mergeMode : prefs.atmMergeMode),
      commit: (k) => {
        controls.apply(
          layer === 'geo' ? { mergeMode: k as MergeModeName } : { atmMergeMode: k as MergeModeName },
          { rampS: 0 },
        )
      },
      rot: 0,
    }
  }

  function alphaBand(layer: 'geo' | 'atm', tint: string): ScalarBand {
    return {
      kind: 'scalar',
      name: 'Opacity',
      tint,
      // Geometric is drawn line work — solid, square-capped, the plainest
      // reading of "a stroke". Atmospheric is a continuous field, so its
      // opacity band carries a soft halo behind it rather than a hard edge.
      // See docs/hud-design.md.
      texture: layer === 'geo' ? 'solid' : 'halo',
      current: () => (layer === 'geo' ? prefs.geoAlpha : prefs.atmAlpha),
      apply: (v) => {
        controls.apply(layer === 'geo' ? { geoAlpha: v } : { atmAlpha: v }, { rampS: 0, persist: false })
      },
      settle: controls.persist,
    }
  }

  /** What each icon puts on the wedge. Same shape for every layer, which is
   *  the point — see the file comment. */
  const GROUPS: Record<string, { tint: string; name: string; bands: Band[] }> = {
    geo: {
      tint: '#9d9bf0',
      name: 'Geometric layer',
      bands: [
        {
          kind: 'enum',
          name: 'View',
          keys: geometricKeys,
          label: (k) => GEOMETRIC_VIEWS[k as GeometricViewName].label,
          current: () => prefs.geometricView,
          commit: (k) => {
            controls.apply({ geometricView: k as GeometricViewName }, { rampS: 0 })
          },
          rot: 0,
        },
        mergeBand('geo'),
        alphaBand('geo', '#9d9bf0'),
        ...colourBands('geo', () => prefs.geoColour),
      ],
    },
    atm: {
      tint: '#4dd6ff',
      name: 'Atmospheric layer',
      bands: [
        {
          kind: 'enum',
          name: 'View',
          keys: atmosphericKeys,
          label: (k) => ATMOSPHERIC_VIEWS[k as AtmosphericViewName].label,
          current: () => prefs.atmosphericView,
          commit: (k) => {
            controls.apply({ atmosphericView: k as AtmosphericViewName }, { rampS: 0 })
          },
          rot: 0,
        },
        mergeBand('atm'),
        alphaBand('atm', '#4dd6ff'),
        ...colourBands('atm', () => prefs.atmColour),
      ],
    },
    cam: {
      tint: '#ffcf8a',
      name: 'Camera layer',
      // No view band: the camera's programme is the room. Its opacity takes
      // the outermost radius instead, so a group with fewer bands is simply
      // shorter rather than leaving a gap where a control used to be.
      bands: [
        {
          kind: 'scalar',
          name: 'Opacity',
          tint: '#ffcf8a',
          // Sampled reality, not drawn — a broken line rather than a
          // continuous one. See docs/hud-design.md.
          texture: 'segmented',
          current: () => camShown,
          apply: (v) => {
            camShown = v
            // The only band whose live-drag value isn't written to `prefs`
            // until settle() — so there is no patch to carry the suspend
            // that every other control gets from naming a field. An empty
            // apply still defaults to source 'manual' and suspends the
            // director, without writing `prefs` or touching the visualiser.
            controls.apply({}, { rampS: 0, persist: false })
          },
          settle: () => {
            // The one control whose value is not ours to decide: the first
            // non-zero drag is what asks for the camera, and the answer can
            // be no.
            void controls.setPassthrough(camShown).then((granted) => {
              camShown = granted
              controls.apply({ passthrough: granted }, { rampS: 0 })
              build()
            })
          },
        },
        ...colourBands('cam', () => prefs.camColour),
      ],
    },
    ear: {
      tint: '#c8c4e6',
      name: 'Listening',
      // Mapping alone: it drives every layer equally, so it belongs to a
      // group named for what it is — how the picture hears — rather than to
      // any one layer, or to a leftover "settings" catch-all.
      bands: [
        {
          kind: 'enum',
          name: 'Map',
          keys: mappingKeys,
          label: (k) => MAPPING_LABELS[k as MappingName],
          current: () => prefs.mapping,
          commit: (k) => {
            controls.apply({ mapping: k as MappingName }, { rampS: 0 })
          },
          rot: 0,
        },
      ],
    },
  }

  let group = 'geo'

  // ── geometry ────────────────────────────────────────────────────────────

  let cx = 0
  let cy = 0
  let base = 0

  const polar = (r: number, a: number): [number, number] => [
    cx + r * Math.cos(a),
    cy + r * Math.sin(a),
  ]

  function arcPath(r: number, a0: number, a1: number): string {
    const [x0, y0] = polar(r, a0)
    const [x1, y1] = polar(r, a1)
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
  }

  /** Pointer position as an angle about the hinge, in the svg's own coordinate
   *  space (which is CSS pixels). */
  function angleFrom(e: PointerEvent): number {
    const r = svg.getBoundingClientRect()
    return Math.atan2(e.clientY - r.top - cy, e.clientX - r.left - cx)
  }

  /** Where an angle falls along a scalar band's own span, as 0-1, clamped to
   *  its ends. Only ever called from a scalar band's drag — see SCALAR_A/
   *  SCALAR_B for why that span is narrower than the wedge's own SWEEP_*.
   *  Built on delta() rather than "(a-a0)/(a1-a0)" so it survives a0/a1
   *  straddling the 0/360 wrap. */
  function angleToUnit(a: number): number {
    const t = delta(a, SCALAR_A * DEG) / delta(SCALAR_B * DEG, SCALAR_A * DEG)
    return Math.max(0, Math.min(1, t))
  }

  /**
   * Take the pointer, if the browser will.
   *
   * Capture keeps a drag alive once the finger wanders off a 48px arc, which
   * happens constantly. It is an enhancement and must never be what arms the
   * drag: setPointerCapture throws on an id that is not an active pointer, and
   * a throw above the line that sets the flag abandons the gesture rather than
   * degrading it.
   */
  function capture(hit: SVGPathElement, e: PointerEvent): void {
    try {
      hit.setPointerCapture(e.pointerId)
    } catch {
      // No capture; the flag carries the drag on its own.
    }
  }

  function bindArcDrag(hit: SVGPathElement, band: ScalarBand): void {
    let live = false
    const set = (e: PointerEvent): void => {
      band.apply(angleToUnit(angleFrom(e)))
      paint()
    }
    hit.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      capture(hit, e)
      live = true
      set(e)
    })
    hit.addEventListener('pointermove', (e) => {
      if (live) set(e)
    })
    const end = (e: PointerEvent): void => {
      if (!live) return
      live = false
      e.stopPropagation()
      band.settle()
    }
    hit.addEventListener('pointerup', end)
    hit.addEventListener('pointercancel', end)
  }

  function bindTurnDrag(hit: SVGPathElement, band: EnumBand): void {
    let last = 0
    let moved = false
    hit.addEventListener('pointerdown', (e) => {
      e.stopPropagation()
      capture(hit, e)
      last = angleFrom(e)
      moved = true
    })
    hit.addEventListener('pointermove', (e) => {
      if (!moved) return
      const a = angleFrom(e)
      let rot = band.rot + delta(a, last)
      last = a
      // Can't spin an option out past either end of the strip.
      const lo = -(band.keys.length - 1) * PITCH
      if (rot > 0) rot = 0
      if (rot < lo) rot = lo
      band.rot = rot
      paint()
    })
    const settle = (e: PointerEvent): void => {
      if (!moved) return
      moved = false
      e.stopPropagation()
      const i = Math.max(0, Math.min(band.keys.length - 1, Math.round(-band.rot / PITCH)))
      band.rot = -i * PITCH
      // Commit before repainting, so the repaint's read of "what's current"
      // already reflects it.
      if (band.keys[i] !== band.current()) band.commit(band.keys[i])
      paint()
    }
    hit.addEventListener('pointerup', settle)
    hit.addEventListener('pointercancel', settle)
  }

  // ── build ───────────────────────────────────────────────────────────────

  interface Drawn {
    band: Band
    r: number
    labels: SVGTextElement[]
    fill?: SVGPathElement
    knob?: SVGCircleElement
    caption: SVGTextElement
    selector?: SVGPathElement
    /** The atmospheric texture's wide, faint path, drawn behind `fill`. */
    halo?: SVGPathElement
  }
  let drawn: Drawn[] = []

  const chips = new Map<string, HTMLButtonElement>()

  // docs/todo.md entry 83 — not derived from anything, just how long a
  // press has to hold before it means "solo" rather than "tap". Mine.
  const SOLO_PRESS_MS = 350

  /** docs/todo.md entry 77. `ring` selects which arc `placeChips` puts this
   *  chip on and whether it is drawn at `R_CHIPS_OUTER_SCALE` — see
   *  `.hud-chip-face`'s own comment for how "smaller drawn, not smaller to
   *  hit" is achieved: the icon and its circle live on a nested element that
   *  the outer ring alone scales down, while `.hud-chip` itself, the actual
   *  touch target, is always the same 3rem box regardless of ring.
   *
   *  `solo`, docs/todo.md entry 83: present only for the three layer chips.
   *  A press held past `SOLO_PRESS_MS` calls `solo.onStart` instead of
   *  `onTap`; releasing, cancelling or the pointer leaving the chip while
   *  that hold is live calls `solo.onEnd`. A press released before the
   *  threshold is an ordinary tap, exactly as before this entry — `fired`
   *  is what the release/cancel/leave handlers all check to tell the two
   *  apart, since it is the timer callback, not whichever event happens to
   *  arrive first, that decides which one this press turned out to be. */
  function mkChip(
    id: string,
    name: string,
    tint: string,
    onTap: () => void,
    ring: 'inner' | 'outer' = 'inner',
    solo?: { onStart: () => void; onEnd: () => void },
  ): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = ring === 'outer' ? 'hud-chip hud-chip--outer' : 'hud-chip'
    b.dataset.ring = ring
    b.style.setProperty('--tint', tint)
    b.setAttribute('aria-label', name)
    b.innerHTML =
      `<span class="hud-chip-face">` +
      `<svg class="hud-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[id]}</svg>` +
      `</span>`
    if (solo) {
      let timer = 0
      let fired = false
      const release = (): boolean => {
        window.clearTimeout(timer)
        const wasFired = fired
        if (wasFired) solo.onEnd()
        fired = false
        return wasFired
      }
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation()
        fired = false
        timer = window.setTimeout(() => {
          fired = true
          solo.onStart()
        }, SOLO_PRESS_MS)
      })
      b.addEventListener('pointerup', (e) => {
        e.stopPropagation()
        if (!release()) onTap()
      })
      b.addEventListener('pointercancel', release)
      b.addEventListener('pointerleave', release)
    } else {
      b.addEventListener('pointerup', (e) => {
        e.stopPropagation()
        onTap()
      })
    }
    btnBar.appendChild(b)
    chips.set(id, b)
    return b
  }

  for (const id of ['geo', 'atm', 'cam', 'ear'] as const) {
    mkChip(
      id,
      GROUPS[id].name,
      GROUPS[id].tint,
      () => {
        group = id
        build()
      },
      'inner',
      id === 'geo' || id === 'atm' || id === 'cam'
        ? { onStart: () => controls.solo(id), onEnd: () => controls.unsolo() }
        : undefined,
    )
  }
  // docs/todo.md entry 77. Everything from here down toggles something
  // about the whole app and never changes what the bands mean — the outer
  // ring, by that same test the file's own GROUPS/loose-mkChip split
  // already drew, now made visible as a second arc rather than only as
  // which function these four calls happen to sit in.
  /**
   * Flip the numeric readout — docs/todo.md entries 31 and 116.
   *
   * Extracted from the `num` chip's own handler by entry 116, which gave the
   * readout a second way in (the `d` key) and needed both to be the same
   * thing rather than two that agree by inspection. This does five things —
   * flips `showStats`, writes it back to `prefs`, hides the element, clears
   * its text, saves and repaints — and a key that reimplemented four of them
   * would be a state that disagrees with the chip's own pressed paint the
   * first time anyone used both.
   *
   * Writing to prefs is what makes it an explicit choice, and is why
   * arriving via `?debug` and never touching either control writes nothing
   * about stats at all.
   */
  const toggleStats = (): void => {
    showStats = !showStats
    stats.hidden = !showStats
    if (!showStats) stats.textContent = ''
    controls.apply({ showStats }, { rampS: 0 })
    paint()
  }

  const statsChip = mkChip('num', 'Numeric readout', '#9d9bf0', toggleStats, 'outer')
  // docs/todo.md entry 30. A boolean needs a chip rather than a band, same
  // as the readout above — no visualiser call here, either: main.ts reads
  // prefs.gravity itself, once per frame, the same way it already reads
  // prefs.showStats.
  const gravChip = mkChip(
    'grav',
    'Gravity',
    '#9d9bf0',
    () => {
      controls.apply({ gravity: !prefs.gravity }, { rampS: 0 })
      paint()
    },
    'outer',
  )
  // docs/todo.md entry 127 deleted the sun chip that stood here (entries 47,
  // 53 and 71's own three-way cycle): asked directly whether it earned its
  // place, Victor said remove it — it was the only chip that corrected a
  // guess rather than doing something asked for, and the guess is right
  // nearly all the time. The stored field it read/wrote (`prefs.skyOverride`)
  // stays exactly where it is, keeps its type and its `'auto'` default, and
  // simply stops being read or written — the same retirement `prefs.day`
  // itself already went through for entry 71, and the reason this is not a
  // Hard Stop 1: no field changed shape, so no visitor's `localStorage` is
  // reset or misread. `onSkyOverride` goes with it off `Handlers` — see
  // scene.ts/main.ts for the rest of the override machinery this take with
  // it, and prefs.ts for the comment marking the field retired.
  //
  // docs/todo.md entry 115 deleted the shutter chip that stood here before it.
  // Camera mode is reached by a double tap on the picture now and has no
  // presence in the HUD at all — "I said the camera should be a totally
  // separate thing from the menu". Everything that existed only to serve
  // this chip went with it: the pointer-events exception above, the
  // `cameraActive` flag, `setCameraActive`, and the paint branch. Deleting
  // the chip without them would have left `Hud` claiming a capability it no
  // longer has.

  /**
   * Lay the icons along their own arc — now two, docs/todo.md entry 77:
   * `geo`/`atm`/`cam`/`ear` on the inner ring against the wedge, since
   * those choose what it edits; `num`/`grav` on the wider, smaller ring
   * outside (`day` retired with it — docs/todo.md entry 127), since those
   * toggle something about the whole app and never change what the bands
   * mean. Split by `dataset.ring` — set
   * once in `mkChip` — rather than by array position, so the grouping
   * survives whatever order the calls above happen to run in.
   *
   * Spacing comes from the measured chip size, which is always the same
   * 3rem *touch target* for both rings even though the outer one is drawn
   * smaller — `offsetWidth` reads `.hud-chip` itself, not the scaled-down
   * `.hud-chip-face` nested inside it, so the outer ring's spacing is exactly
   * as thumb-safe as the inner one's rather than visually cramped to match
   * its smaller drawn size.
   */
  function placeChips(): void {
    const inner = [...chips.values()].filter((c) => c.dataset.ring !== 'outer')
    const outer = [...chips.values()].filter((c) => c.dataset.ring === 'outer')
    const place = (list: HTMLButtonElement[], ring: 'inner' | 'outer'): void => {
      const size = list[0]?.offsetWidth || 48
      list.forEach((chip, i) => {
        const [x, y] = chipPosition(i, list.length, size, ring, window.innerWidth, window.innerHeight)
        chip.style.left = `${x - size / 2}px`
        chip.style.top = `${y - size / 2}px`
      })
    }
    place(inner, 'inner')
    place(outer, 'outer')
  }

  function build(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    base = Math.min(w, h)
    // Hinge sits just outside the corner, so the wedge opens into the screen.
    cx = w + 10
    cy = h + 10

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    while (svg.firstChild) svg.removeChild(svg.firstChild)
    drawn = []

    const a0 = SWEEP_A * DEG
    const a1 = SWEEP_B * DEG
    const s0 = SCALAR_A * DEG
    const s1 = SCALAR_B * DEG

    // Ticks along the outer edge, as a rim for the whole wedge.
    const outer = base * BAND_R[0] + base * 0.07
    for (let d = SWEEP_A; d <= SWEEP_B; d += 3) {
      const a = d * DEG
      const major = d % 15 === 0
      const [px0, py0] = polar(outer - (major ? 8 : 4), a)
      const [px1, py1] = polar(outer, a)
      svg.appendChild(
        el('line', {
          x1: px0, y1: py0, x2: px1, y2: py1,
          class: `hud-tick${major ? ' major' : ''}`,
        }),
      )
    }
    svg.appendChild(el('path', { d: arcPath(outer + 4, a0, a1), class: 'hud-rule' }))

    const bands = GROUPS[group].bands
    bands.forEach((band, i) => {
      const r = base * BAND_R[i]
      // Enum bands are read at the notch and spin past the wedge's full
      // sweep; scalar bands map a value onto their own, narrower span so
      // both of its ends land on screen — see SCALAR_A/SCALAR_B.
      const [ba0, ba1] = band.kind === 'enum' ? [a0, a1] : [s0, s1]

      svg.appendChild(
        el('path', {
          d: arcPath(r, ba0, ba1),
          class: 'hud-track',
          'stroke-width': band.kind === 'enum' ? Math.max(30, base * 0.09) : 7,
        }),
      )

      const d: Drawn = { band, r, labels: [], caption: el('text', { class: 'hud-band-label' }) }

      if (band.kind === 'enum') {
        // Park the current option under the notch on every build, whatever a
        // previous drag left rot sitting at.
        band.rot = -Math.max(0, band.keys.indexOf(band.current())) * PITCH
        d.labels = band.keys.map(() => {
          const t = el('text', { class: 'hud-item' })
          svg.appendChild(t)
          return t
        })
        const r0 = r - base * 0.045
        const r1 = r + base * 0.045
        const p = (rr: number, half: number): [number, number] =>
          polar(rr, NOTCH + Math.atan2(half, rr))
        const [lx0, ly0] = p(r0, -13)
        const [rx0, ry0] = p(r0, 13)
        const [lx1, ly1] = p(r1, -20)
        const [rx1, ry1] = p(r1, 20)
        d.selector = el('path', {
          d: `M${lx0} ${ly0}L${lx1} ${ly1}L${rx1} ${ry1}L${rx0} ${ry0}Z`,
          class: 'hud-selector',
        })
        svg.appendChild(d.selector)
      } else {
        // The halo goes in first, so it sits behind the fill it belongs to —
        // see docs/hud-design.md for what each texture means.
        if (band.texture === 'halo') {
          d.halo = el('path', { class: 'hud-halo', 'stroke-width': base * 0.05 })
          d.halo.style.stroke = band.tint
          svg.appendChild(d.halo)
        }
        d.fill = el('path', { class: 'hud-fill', 'stroke-width': 7 })
        d.fill.style.stroke = band.tint
        if (band.texture === 'solid') d.fill.style.strokeLinecap = 'square'
        if (band.texture === 'segmented') d.fill.style.strokeDasharray = '9 6'
        svg.appendChild(d.fill)
        d.knob = el('circle', { r: 7, class: 'hud-knob' })
        d.knob.style.fill = band.tint
        svg.appendChild(d.knob)
      }

      svg.appendChild(d.caption)
      drawn.push(d)
    })

    // Grab arcs last, so they sit above everything they control.
    drawn.forEach(({ band, r }) => {
      const [ba0, ba1] = band.kind === 'enum' ? [a0, a1] : [s0, s1]
      const hit = el('path', {
        d: arcPath(r, ba0, ba1),
        class: 'hit',
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': GRAB_PX * 2,
      })
      if (band.kind === 'enum') bindTurnDrag(hit, band)
      else bindArcDrag(hit, band)
      svg.appendChild(hit)
    })

    placeChips()
    paint()
  }

  function paint(): void {
    const s0 = SCALAR_A * DEG
    const s1 = SCALAR_B * DEG

    for (const d of drawn) {
      const { band, r } = d
      if (band.kind === 'enum') {
        const sel = band.current()
        band.keys.forEach((k, i) => {
          const a = NOTCH + i * PITCH + band.rot
          const off = Math.abs(delta(a, NOTCH))
          const vis = off > CUTOFF ? 0 : 1 - (off / CUTOFF) * 0.72
          const [x, y] = polar(r, a)
          const t = d.labels[i]
          t.setAttribute('x', String(x))
          t.setAttribute('y', String(y))
          t.setAttribute('opacity', vis.toFixed(3))
          t.textContent = band.label(k)
          t.classList.toggle('on', k === sel)
        })
        // The band's own name sits inside its radius, clear of both the option
        // labels (which sit on the radius) and the selector, which reaches
        // base*0.045 either side of it. 0.10 clears the selector with room and
        // still leaves a gap before the next band inward, which is 0.13 away.
        const [lx, ly] = polar(r - base * 0.1, NOTCH)
        d.caption.setAttribute('x', String(lx))
        d.caption.setAttribute('y', String(ly))
        d.caption.textContent = band.name
        d.caption.style.fill = '#5d5a78'
      } else {
        const v = band.current()
        const va = s0 + v * (s1 - s0)
        const fillD = arcPath(r, s0, Math.max(s0 + 0.001, va))
        d.fill?.setAttribute('d', fillD)
        d.halo?.setAttribute('d', fillD)
        const [kx, ky] = polar(r, va)
        d.knob?.setAttribute('cx', String(kx))
        d.knob?.setAttribute('cy', String(ky))
        const [lx, ly] = polar(r - base * 0.05, NOTCH)
        d.caption.setAttribute('x', String(lx))
        d.caption.setAttribute('y', String(ly))
        d.caption.textContent = `${band.name} ${Math.round(v * 100)}`
        d.caption.style.fill = band.tint
      }
    }

    for (const [id, chip] of chips) {
      const on =
        id === 'num'
          ? showStats
          : id === 'grav'
            ? prefs.gravity
            : group === id
      chip.setAttribute('aria-pressed', String(on))
    }
    void statsChip
    void gravChip
  }

  build()
  window.addEventListener('resize', build)
  // iOS reports the old viewport for a moment after a rotation, so re-measure.
  window.addEventListener('orientationchange', () => window.setTimeout(build, 250))

  // ── open / close ────────────────────────────────────────────────────────

  let open = false
  const setOpen = (v: boolean): void => {
    open = v
    scrim.classList.toggle('open', v)
    // Rebuild rather than repaint: an enum band may have been changed by the
    // autopilot or a shake-driven shuffle while the HUD was closed, and
    // build() is what parks the current option back under the notch.
    if (v) build()
    else stats.textContent = ''
    // `.hud-scrim.open` is already the fact; this is that fact made public
    // rather than something another module has to reach into this file's
    // own DOM structure to observe — docs/todo.md entry 56, whose reload
    // chip needs to know the panel's own open state and lives in a
    // separate module (version.ts) with no other reason to import this one.
    document.dispatchEvent(new CustomEvent('hud-panel', { detail: { open: v } }))
  }

  // Anything reaching the scrim itself is outside the wedge — the arcs and the
  // icons stop their own events.
  scrim.addEventListener('pointerup', (e) => {
    e.stopPropagation()
    setOpen(false)
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false)
  })

  const bar = (v: number): string => {
    const n = Math.round(Math.max(0, Math.min(1, v)) * 18)
    return '#'.repeat(n).padEnd(18, '.')
  }

  return {
    update(p, s) {
      // The one per-frame DOM write in the app, and only when asked for.
      if (!open || !showStats) return
      stats.textContent = [
        `${(1000 / s.frameMs).toFixed(0)} fps   ${s.frameMs.toFixed(1)} ms   @${s.pixelRatio}x`,
        `level ${bar(p.level)} ${p.level.toFixed(2)}`,
        `low   ${bar(p.low)} ${p.low.toFixed(2)}`,
        `mid   ${bar(p.mid)} ${p.mid.toFixed(2)}`,
        `high  ${bar(p.high)} ${p.high.toFixed(2)}`,
        `trans ${bar(p.transient)} ${p.transient.toFixed(2)}`,
        `tilt  ${bar(p.tilt)} ${p.tilt.toFixed(2)}`,
        `break ${bar(p.breakdown)} ${p.breakdown.toFixed(2)}`,
        `surge ${bar(p.surge)} ${p.surge.toFixed(2)}`,
        `novel ${bar(p.novelty)} ${p.novelty.toFixed(2)}`,
        `rough ${bar(p.roughness)} ${p.roughness.toFixed(2)}`,
        // docs/todo.md entry 75 — a tempo nobody can see cannot be
        // debugged, the same argument that put samples/peak on the shake
        // diagnostics below and want/armed on the fullscreen line. `bpm` is
        // already 0 while unlocked, so "—" only ever means "no lock", never
        // "a lock at literally 0bpm".
        `beat  ${bar(p.beatConfidence)} ${p.beatConfidence.toFixed(2)}  ${p.bpm > 0 ? Math.round(p.bpm) + ' bpm' : '—'}`,
        // Only when there is a sensor. On a laptop this would read 0.00 forever
        // and say nothing; on a phone it is the only way to see what the shake
        // thresholds are actually being fed.
        ...(s.disturb === undefined ? [] : [`shake ${bar(s.disturb)} ${s.disturb.toFixed(2)}`]),
        // docs/todo.md entry 58 — posture, disturbance and agitation, the
        // three tiers feeding the picture's colour bias. Without this, a
        // feature whose whole design brief is "slight" is indistinguishable
        // from doing nothing. "bias", not "motion" — that label is already
        // the accelerometer diagnostic two lines below.
        ...(s.motion === undefined
          ? []
          : [
              `bias  post ${s.motion.posture.toFixed(2)}  ` +
                `dist ${s.motion.disturbance.toFixed(2)}  ` +
                `agit ${s.motion.agitation.toFixed(2)}`,
            ]),
        // docs/todo.md entry 53 — testable without waiting for dusk: this
        // prints exactly the pair sky.ts computed for right now, over the
        // same clock a screenshot's filename already reads.
        ...(s.sky === undefined
          ? []
          : [
              `sky   day ${s.sky.daylight.toFixed(2)}  ` +
                `warm ${s.sky.warmth >= 0 ? '+' : ''}${s.sky.warmth.toFixed(2)}` +
                // docs/todo.md entry 97 — which of the two curves fed the
                // pair above, since they can print near-identical numbers
                // near the equinox and the difference is otherwise invisible.
                (s.sky.located ? '  located' : '  stylised'),
            ]),
        // docs/todo.md entry 96 — Decided's own "report it in the readout":
        // phase (waxing/waning, from the signed term), illuminated fraction
        // and presence, beside the sky line above. `abundance` is the same
        // illuminated x presence product scene.ts derives its reach/life/
        // cadence swings from — printed directly rather than left for
        // someone to multiply by hand.
        ...(s.moon === undefined
          ? []
          : [
              `moon  ${s.moon.waxing >= 0 ? 'waxing ' : 'waning '}` +
                `lit ${s.moon.illuminated.toFixed(2)}  ` +
                `up ${s.moon.presence.toFixed(2)}  ` +
                `abundance ${(s.moon.illuminated * s.moon.presence).toFixed(2)}`,
            ]),
        // docs/todo.md entry 98 — beside the sun and moon lines above:
        // the third environmental sense, and on iOS (or any Android
        // session that refused or has no sensor) `available` reads false,
        // which is itself the answer to "why doesn't it respond to the
        // room here" rather than a silently missing line.
        ...(s.ambient === undefined
          ? []
          : s.ambient.available
            ? [
                `light ${s.ambient.lux === null ? 'reading…' : `${Math.round(s.ambient.lux)} lux`}  ` +
                  `exposure ${s.ambient.exposure.toFixed(2)}`,
              ]
            : ['light unavailable (no ambient sensor on this device)']),
        // The numbers that tell a dead sensor apart from a shake that is
        // simply not hard enough — and, docs/todo.md entry 88, from one that
        // wasn't hard enough for the *current* context. `/18` stays fixed
        // (intensity()'s own scale, untouched by entry 88); `bar` is the
        // adaptive threshold a peak actually has to clear right now.
        ...(s.samples === undefined
          ? []
          : [
              `motion ${s.samples} ev  peak ${(s.peak ?? 0).toFixed(1)}/18  bar ${(s.bar ?? 0).toFixed(1)}` +
                (s.rejected ? `  drop ${s.rejected}` : '') +
                (s.synthActive ? '  key' : ''),
            ]),
        // Why the autopilot has not done anything. Without this the restraint
        // rules in director.ts are indistinguishable from a broken feature.
        // docs/todo.md entry 89 — `blocked` takes priority over the generic
        // "auto warming" line: colour can be live and due-but-blocked well
        // before the view axis's own, much longer, full warmth, and a
        // change that has been due with `till 0s` and nothing to show for
        // it is exactly the fault this entry exists to make legible.
        ...(s.director === undefined
          ? []
          : [
              s.director.suspended > 0
                ? `auto held ${Math.ceil(s.director.suspended)}s (manual)`
                : s.director.blocked
                  ? `auto blocked: ${s.director.blocked}`
                  : !s.warm
                    ? 'auto warming'
                    : `auto ${s.director.candidate ?? '—'} ` +
                      `${Math.floor(s.director.candidateHeld)}s  ` +
                      `next ${Math.ceil(s.director.tillView)}s`,
            ]),
        // docs/todo.md entry 100 — "report it": the sun's own rate multiplier
        // and the moon's own reach multiplier, beside entry 90's posture line
        // and entry 89's blocked-gate line above. Gated on the same
        // `s.director` presence the two lines above already use, since both
        // numbers live on the same status object.
        ...(s.director === undefined || s.director.sunRate === undefined || s.director.moonReach === undefined
          ? []
          : [`sun ${s.director.sunRate.toFixed(2)}x  moon ${s.director.moonReach.toFixed(2)}x`]),
        // docs/todo.md entry 90 — five states that silently change the
        // director's own cadence, reported for the same reason the director
        // line above is: a silent classifier is indistinguishable from a
        // broken one. `candidate` shown only while it differs from the
        // reported `posture` — the ~10s it takes to settle in is otherwise
        // just noise next to the number that actually governs anything.
        ...(s.handling === undefined
          ? []
          : [
              `hold ${s.handling.posture}` +
                (s.handling.periodicHz > 0 ? ` ${s.handling.periodicHz.toFixed(1)}Hz` : '') +
                (s.handling.candidate !== s.handling.posture
                  ? `  →${s.handling.candidate} ${Math.floor(s.handling.candidateHeld)}s`
                  : ''),
            ]),
        // Separates "nothing asked for a buzz" from "asked and refused" from
        // "asked, accepted, and the phone did nothing you could feel".
        ...(s.haptics === undefined
          ? []
          : [
              !s.haptics.supported
                ? 'buzz unsupported'
                : s.haptics.suppressed > 0
                  ? `buzz off (reduced-motion) ${s.haptics.suppressed}`
                  : `buzz ${s.haptics.accepted}/${s.haptics.attempts}`,
            ]),
        // "We lost full screen" is three different bugs wearing one sentence.
        // docs/todo.md entry 66: `want`/`armed` beside state, since state
        // alone cannot tell "not fullscreen and about to retry on the next
        // tap" apart from "not fullscreen and nothing is even trying" — the
        // distinction the whole entry exists to make visible.
        ...(s.fullscreen === undefined
          ? []
          : [
              `full ${s.fullscreen.state}` +
                (s.fullscreen.want ? ' want' : '') +
                (s.fullscreen.armed ? ' armed' : '') +
                (s.fullscreen.attempts > 1 ? ` ×${s.fullscreen.attempts}` : '') +
                (s.fullscreen.error ? ` (${s.fullscreen.error})` : ''),
            ]),
        // docs/todo.md entry 65 — one word turning "did the pulse not show
        // up" from a guess into a fact, since a phone in this state also
        // silently drops the byline glow and both shake-flash tiers. Named
        // "os motion" rather than "motion" — that word is already the
        // sensor diagnostic line above, and this is an unrelated OS setting.
        ...(s.reducedMotion === undefined ? [] : [`os motion ${s.reducedMotion ? 'reduced' : 'full'}`]),
        // docs/todo.md entry 73 — a frozen camera and a working one look
        // identical whenever the room itself is still, which is exactly
        // the report this line exists to stop being ambiguous.
        ...(s.camera === undefined
          ? []
          : [`cam   ${!s.camera.open ? 'closed' : s.camera.live ? 'live' : 'frozen'}`]),
        ...(s.decode === undefined
          ? []
          : [
              `name  ${s.decode.branch}  ${(s.decode.elapsedMs / 1000).toFixed(1)}s  ` +
                `${s.decode.resolved}/${s.decode.total}`,
            ]),
        // docs/todo.md entry 123 — the two numbers that separate "the
        // decode animation isn't showing" from "it showed, but a stall ate
        // most of it before the first frame you saw" — same shape as
        // `motion N ev  peak X/18` above, for the same reason: two
        // candidate causes behind one symptom need two different numbers.
        // Absent (rather than 0) until a second real frame has happened,
        // so this line does not falsely claim "no stall" before there was
        // anything to measure one against.
        ...(s.decode?.firstGapMs == null
          ? []
          : [`decode first ${s.decode.firstGapMs.toFixed(0)}ms  worst ${(s.decode.worstGapMs ?? 0).toFixed(0)}ms`]),
        ...(s.arm === undefined
          ? []
          : [
              `arm   ${s.arm.armed ? 'armed' : 'off'}  hold ${s.arm.hold.toFixed(1)}s` +
                (s.arm.blocked ? '  BLOCKED' : `  calm ${s.arm.sinceDisturbed.toFixed(1)}s`),
            ]),
        // docs/todo.md entry 137 — the whole look as one copyable string.
        ...(s.dna === undefined ? [] : [`dna   ${s.dna}`]),
      ].join('\n')
    },

    showingStats: () => showStats,
    toggleStats,
    open: () => setOpen(true),
    close: () => setOpen(false),

    /** The session changed the look on its own — the autopilot, a shake, a
     *  camera raise. Nothing to write: `controls.look` is already what is on
     *  screen. Only redraw what is visible; the HUD is closed most of the
     *  time and setOpen rebuilds from the look anyway. */
    lookChanged() {
      camShown = prefs.passthrough
      if (open) build()
    },
  }
}
