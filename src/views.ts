/**
 * The two view registries — geometric and atmospheric — that scene.ts
 * composites together every frame.
 *
 * Every view shares the same uniforms and the same fullscreen vertex shader,
 * so a view is nothing but a fragment shader plus a label. That constraint is
 * deliberate: it means scene.ts never learns anything about what a particular
 * view does, and adding one is a file plus a line here.
 *
 * The split into two registries is deliberate too. Geometric views are
 * discrete-event things (a ring born on a hit); atmospheric views are
 * continuous fields (noise, spectrograms, envelopes). Nothing stops a future
 * view from blurring that line, but the two are picked independently in the
 * control panel and composited rather than switched between, so they need
 * separate defaults and separate URL params.
 *
 * Switching recompiles a shader (tens of milliseconds). That is fine for a
 * deliberate choice from the control panel and would not be fine per frame.
 */

import annealFrag from './shaders/anneal.frag.glsl?raw'
import auroraFrag from './shaders/aurora.frag.glsl?raw'
import causticsFrag from './shaders/caustics.frag.glsl?raw'
import cellsFrag from './shaders/cells.frag.glsl?raw'
import chorusFrag from './shaders/chorus.frag.glsl?raw'
import circlesFrag from './shaders/circles.frag.glsl?raw'
import driftFrag from './shaders/drift.frag.glsl?raw'
import fieldFrag from './shaders/field.frag.glsl?raw'
import filingsFrag from './shaders/filings.frag.glsl?raw'
import fringeFrag from './shaders/fringe.frag.glsl?raw'
import gridFrag from './shaders/grid.frag.glsl?raw'
import latticeFrag from './shaders/lattice.frag.glsl?raw'
import moireFrag from './shaders/moire.frag.glsl?raw'
import orbitsFrag from './shaders/orbits.frag.glsl?raw'
import roseFrag from './shaders/rose.frag.glsl?raw'
import shardsFrag from './shaders/shards.frag.glsl?raw'
import spectrogramFrag from './shaders/spectrogram.frag.glsl?raw'
import stringsFrag from './shaders/strings.frag.glsl?raw'
import tideFrag from './shaders/tide.frag.glsl?raw'
import umbraFrag from './shaders/umbra.frag.glsl?raw'

export interface View {
  readonly label: string
  readonly description: string
  readonly fragmentShader: string
}

export const GEOMETRIC_VIEWS = {
  circles: {
    label: 'Circles',
    description: 'Rings born on a hit, fading as they reach the rim.',
    fragmentShader: circlesFrag,
  },
  shards: {
    label: 'Shards',
    description: 'Angular fragments thrown outward on a hit, spinning down.',
    fragmentShader: shardsFrag,
  },
  grid: {
    label: 'Grid',
    description: 'Square wavefronts lighting whole cells at a time.',
    fragmentShader: gridFrag,
  },
  // docs/todo.md entry 101 — a fourth answer to "what does a hit look like",
  // not a variation on Circles the way the next three are: Circles' ring is
  // the locus of constant radius, travelling outward; Rose's spoke is the
  // locus of constant angle, travelling in angle. Registry order is HUD
  // order, and this keeps the first-group/variant-group split honest.
  rose: {
    label: 'Rose',
    description: 'Turning N-fold rosettes, sweeping through a standing ladder of bearings.',
    fragmentShader: roseFrag,
  },
  // Three variations on Circles that keep its ring and move its emitter. They
  // sit after the three originals rather than next to Circles because the
  // registry's order is the order the HUD offers them in, and the first three
  // are the three different answers to "what does a hit look like" — the ones
  // worth meeting first. These are the same answer from somewhere else.
  drift: {
    label: 'Drift',
    description: "Circles' ring from a wandering origin, so families overlap off-centre.",
    fragmentShader: driftFrag,
  },
  chorus: {
    label: 'Chorus',
    description: 'Several fixed origins in a ring; each hit fires one and their fronts cross.',
    fragmentShader: chorusFrag,
  },
  tide: {
    label: 'Tide',
    description: 'Rings born on the frame edge, arriving as arcs that sweep inward.',
    fragmentShader: tideFrag,
  },
  // docs/todo.md entry 134 — a fourth answer to "what does a hit look like",
  // in the Rose sense: a new mark, not another emitter variation on Circles'
  // ring. The axis it actually explores is different again from Rose's own —
  // direct manipulation, the one thing none of the other seven views offer.
  strings: {
    label: 'Strings',
    description: 'Nine taut strings tuned to the spectrum. Pull one, pluck it, or strum across.',
    fragmentShader: stringsFrag,
  },
  // docs/todo.md entry 135 — the less-explored axis (Rose's own header names
  // it): the emitter, not the mark. Every view above throws a shape from an
  // origin that expands and dies at the rim; here the shape is small,
  // constant, and never dies of old age — it moves, on a real orbit, and a
  // finger flings it rather than merely placing it.
  orbits: {
    label: 'Orbits',
    description: 'Small bodies on Kepler orbits round the centre. Fling one, or hold a finger for it to slingshot past.',
    fragmentShader: orbitsFrag,
  },
  // docs/todo.md entry 136 — same axis as Orbits (the emitter, not the
  // mark), but explored through two of them at once: a second field of
  // rings whose centre a held finger simply becomes, so what moves is the
  // whole interference pattern between the two fields rather than one body.
  moire: {
    label: 'Moiré',
    description: 'Two fields of hairline rings beat together. Hold to move the second centre; let go and it springs back.',
    fragmentShader: moireFrag,
  },
} satisfies Record<string, View>

export const ATMOSPHERIC_VIEWS = {
  field: {
    label: 'Field',
    description: 'Domain-warped fractal noise. Nocturnal, atmospheric, slow.',
    fragmentShader: fieldFrag,
  },
  lattice: {
    label: 'Lattice',
    description: 'Visionary mandala after Alex Grey. Endless, symmetric, emissive.',
    fragmentShader: latticeFrag,
  },
  spectrogram: {
    label: 'Spectrogram',
    description: 'The last 8 seconds, spiralling out. Radius is time, angle is pitch.',
    fragmentShader: spectrogramFrag,
  },
  aurora: {
    label: 'Aurora',
    description: 'Hanging curtains of light. The only view with a horizon.',
    fragmentShader: auroraFrag,
  },
  // Three more, each built on an organising principle none of the four above
  // uses. Field is cloud, Lattice is symmetry, Spectrogram is a diagram and
  // Aurora is a place; these are focused light, superposed waves, and divided
  // space. Added at the end because the registry's order is the order the HUD
  // offers them in, and the first four remain the ones worth meeting first.
  caustics: {
    label: 'Caustics',
    description: 'Light through moving water. A bright web that focuses and slides.',
    fragmentShader: causticsFrag,
  },
  fringe: {
    label: 'Fringe',
    description: 'Two coherent sources. Where their wavefronts cross, hyperbolae.',
    fragmentShader: fringeFrag,
  },
  cells: {
    label: 'Cells',
    description: 'The frame divided. Each cell lit by its own slice of the spectrum.',
    fragmentShader: cellsFrag,
  },
  // docs/todo.md entry 138 — an eighth principle none of the seven above
  // use: occlusion. One light, a drift of solid bodies between it and the
  // frame, and a lit rim where each body's edge faces the source. Every
  // other view here is additive; this is the first thing that casts a
  // shadow.
  umbra: {
    label: 'Umbra',
    description: 'A light behind a drift of solid bodies. Silhouettes, lit rims, and gaps the light leaks through.',
    fragmentShader: umbraFrag,
  },
  // docs/todo.md entry 139 — a ninth principle: topology. Six poles, one per
  // band, and lines that must start somewhere and end somewhere — a vector
  // field, where every view above it is a scalar one.
  filings: {
    label: 'Filings',
    description: 'Iron filings over six magnetic poles the spectrum moves. A hit flips one, and the field re-routes.',
    fragmentShader: filingsFrag,
  },
  // docs/todo.md entry 140 — a material under load, the only view whose
  // colour is the measurement itself rather than filtered by atmColour: the
  // photoelastic sin² identity below is what fringe order actually is.
  anneal: {
    label: 'Anneal',
    description: 'Glass under load between crossed polarisers. Coloured fringes, dark brushes, a hammer blow.',
    fragmentShader: annealFrag,
  },
} satisfies Record<string, View>

export type GeometricViewName = keyof typeof GEOMETRIC_VIEWS
export type AtmosphericViewName = keyof typeof ATMOSPHERIC_VIEWS

export const DEFAULT_GEOMETRIC_VIEW: GeometricViewName = 'circles'
export const DEFAULT_ATMOSPHERIC_VIEW: AtmosphericViewName = 'field'

export function isGeometricViewName(v: string | null): v is GeometricViewName {
  return v !== null && v in GEOMETRIC_VIEWS
}

export function isAtmosphericViewName(v: string | null): v is AtmosphericViewName {
  return v !== null && v in ATMOSPHERIC_VIEWS
}
