/**
 * Asserts the ripple constants match, across ripples.ts and every geometric
 * shader — docs/todo.md entry 59.
 *
 * `MAX_RIPPLES` and `AUDIO_RIPPLES` are declared once in `ripples.ts` and
 * copied by hand into every geometric shader, which has no way to import a
 * JS constant. Fourteen declarations of two facts, kept in step only by a
 * comment asking nicely. If `ripples.ts` disagrees with a shader in either
 * direction, one view silently misbehaves: an array uploaded larger than
 * the shader's own `uniform vec4[N]` gets truncated by the driver, or a
 * shader reading past what was actually written reads garbage — five views
 * look right and the sixth reads as an unrelated quirk, which is exactly
 * the failure that survives ordinary testing.
 *
 * Reads the shaders as text and matches a regex rather than compiling
 * them, so this runs under plain Node beside every other probe here — no
 * GL context, no browser.
 *
 *   node --experimental-strip-types scripts/probe-ripples.ts
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_RIPPLES, AUDIO_RIPPLES } from '../src/engine/ripples.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

check(
  'ripples.ts itself is coherent: AUDIO_RIPPLES < MAX_RIPPLES with a non-empty touch band',
  AUDIO_RIPPLES > 0 && AUDIO_RIPPLES < MAX_RIPPLES,
  `AUDIO_RIPPLES=${AUDIO_RIPPLES} MAX_RIPPLES=${MAX_RIPPLES}`,
)

// Discovered by grep rather than a hardcoded list, so which *files* to check
// never needs updating by hand as views are added. The *count* below still
// does — `views.ts` imports every shader through Vite's `?raw` suffix, which
// plain Node has no loader for, so this file cannot import GEOMETRIC_VIEWS
// itself to derive the number automatically and has to be told it.
const SHADER_DIR = new URL('../src/shaders/', import.meta.url).pathname
const shaderFiles = readdirSync(SHADER_DIR).filter((f) => f.endsWith('.frag.glsl'))

const MAX_RE = /const\s+int\s+MAX_RIPPLES\s*=\s*(\d+)\s*;/
const AUDIO_RE = /const\s+int\s+AUDIO_RIPPLES\s*=\s*(\d+)\s*;/

let matched = 0
for (const file of shaderFiles) {
  const text = readFileSync(join(SHADER_DIR, file), 'utf8')
  const maxMatch = MAX_RE.exec(text)
  const audioMatch = AUDIO_RE.exec(text)
  // Not every shader declares these — only the geometric ones that actually
  // spawn or read ripples (eight as of entry 134's Strings; was six when
  // this comment was first written, then seven once Rose landed — the
  // count below is the one that can't quietly go stale, this one already
  // had). A shader with neither declaration is simply out of scope, not a
  // failure; one with only one of the two is a real defect (a partial
  // edit), so that case still gets checked and can fail.
  if (!maxMatch && !audioMatch) continue
  matched++

  check(
    `${file}: MAX_RIPPLES matches ripples.ts (${MAX_RIPPLES})`,
    maxMatch !== null && Number(maxMatch[1]) === MAX_RIPPLES,
    maxMatch ? `found ${maxMatch[1]}` : 'MAX_RIPPLES not declared',
  )
  check(
    `${file}: AUDIO_RIPPLES matches ripples.ts (${AUDIO_RIPPLES})`,
    audioMatch !== null && Number(audioMatch[1]) === AUDIO_RIPPLES,
    audioMatch ? `found ${audioMatch[1]}` : 'AUDIO_RIPPLES not declared',
  )
}

// A probe that only ever passes cannot be trusted — confirm it actually
// found the ten geometric shaders it is meant to be checking (docs/todo.md
// entry 101 added Rose as the seventh; entry 134 added Strings as the
// eighth; entry 135 added Orbits as the ninth; entry 136 added Moiré as the
// tenth), so a future rename or a shader moved out of src/shaders/ doesn't
// silently make this check vacuous. Bump this number by hand, same as
// GEOMETRIC_VIEWS in views.ts, whenever the registry gains or loses a
// geometric view.
check('found the ten geometric shaders that declare these constants', matched === 10, `found ${matched}`)

// docs/todo.md entry 79's own Verify: the combine operator (screen, not
// summation) cannot drive `ink` above 1 regardless of how many rings
// overlap. Pure arithmetic, mirroring `ink = 1.0 - (1.0 - ink) * (1.0 - c)`
// from circles/drift/tide.frag.glsl by eye, same convention every probe
// here uses for logic it can't import straight from GLSL.
{
  const screen = (ink: number, c: number): number => 1 - (1 - ink) * (1 - c)

  let maxInk = -Infinity
  for (let trial = 0; trial < 1000; trial++) {
    let ink = 0
    for (let i = 0; i < 16; i++) ink = screen(ink, Math.random())
    maxInk = Math.max(maxInk, ink)
  }
  check('sixteen overlapping contributions, screened: ink never exceeds 1', maxInk <= 1 + 1e-9, String(maxInk))

  // The degenerate worst case Decided names: sixteen touch slots, every one
  // at full strength, stacked on the same pixel.
  let inkAllFull = 0
  for (let i = 0; i < 16; i++) inkAllFull = screen(inkAllFull, 1)
  check('sixteen full-strength contributions, screened, on one pixel: ink is exactly 1', inkAllFull === 1, String(inkAllFull))

  // Done-when's own "a single ring looks exactly as it does today": with no
  // prior ink, screen(0, c) reduces to plain addition, so a lone ring's
  // brightness is bit-identical to the old `ink += c`.
  const single = screen(0, 0.42)
  check(
    "a single ring: screen(0, c) equals plain addition — unchanged from before this entry",
    Math.abs(single - 0.42) < 1e-9,
    String(single),
  )
}

// docs/todo.md entry 122's own finding, mirrored: a headless copy of
// Circles' touch-ring loop (`circles.frag.glsl` — `ring()`, the stroke
// constants, the screen composite) over a 90x160 grid (9:16, the same
// convention this repo's other probes use for a phone frame), driven by a
// 2s drag at 0.4 uv/s through the centre. `SPAWN_DIST` (emitter.ts) fires a
// new ring every 0.125s at that speed, faster than `SPAWN_INTERVAL`'s
// 0.15s, so sixteen spawns land in exactly the drag's 2s and fill every
// touch slot with none yet recycled — the "full load" case entry 122's own
// table measures, evaluated at the instant the last one lands, when every
// ring from the drag is still within `LIFESPAN` (3.2s > 2s).
//
// Arithmetic only, same convention as the screen-operator block above: this
// cannot import the GLSL, so the shader's own constants and functions are
// copied here by eye and mirrored, not re-derived.
{
  const W = 90
  const H = 160
  const MIN_DIM = Math.min(W, H) // 90 — matches circles.frag.glsl's uv normalisation
  const px = 1 / MIN_DIM
  const halfExtent = { x: 0.5, y: (0.5 * H) / MIN_DIM }
  const maxRadius = Math.max(halfExtent.x, halfExtent.y) // uMoonReach = 1
  const LIFESPAN = 3.2
  const FADE_FROM = 0.6
  const OUTER_STROKE = 0.22
  const INNER_STROKE = 0.09
  const INNER_RADIUS = 0.7
  const N_TOUCH = 16
  const SPAWN_GAP = 0.05 / 0.4 // SPAWN_DIST / drag speed — 0.125s, the binding trigger
  const BIRTH_LEVEL = 0.8 // the entry's own figure

  const hash = (x: number): number => {
    const s = Math.sin(x * 127.1) * 43758.5453123
    return s - Math.floor(s)
  }
  const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
  }
  const ring = (dist: number, radius: number, halfWidth: number): number => {
    const d = Math.abs(dist - radius) - halfWidth
    return 1 - smoothstep(0, px * 1.5, d)
  }
  const screenOp = (ink: number, c: number): number => 1 - (1 - ink) * (1 - c)

  // Sixteen rings laid every SPAWN_GAP along a horizontal drag through the
  // centre, oldest first — mirrors ripples.ts's ring buffer with nothing yet
  // recycled (16 spawns, 16 slots). `birthTime` rather than a fixed `age`,
  // so the frame can be evaluated at any instant while all sixteen are
  // still alive (birthTime 0 .. lifespan, the drag's own last 2s).
  const rings = Array.from({ length: N_TOUCH }, (_, i) => ({
    birthTime: i * SPAWN_GAP,
    x: -0.4 + 0.8 * (i / (N_TOUCH - 1)),
    y: 0,
    slotPhase: hash(i + 31.0),
    slotStroke: hash(i + 11.0),
  }))
  const dragEnd = (N_TOUCH - 1) * SPAWN_GAP // last ring's birth — the drag's own duration

  function inkAt(x: number, y: number, t: number, touchWeight: number): number {
    let ink = 0
    for (const r of rings) {
      const age = t - r.birthTime
      if (age < 0 || age > LIFESPAN) continue
      const percent = age / LIFESPAN
      let radius = maxRadius * percent
      radius *= 0.98 + 0.04 * r.slotPhase
      const scale = (0.8 + 0.4 * BIRTH_LEVEL) * (0.88 + 0.24 * r.slotStroke)
      const outerHalf = Math.max(radius * OUTER_STROKE * 0.5 * scale, px * 0.5)
      const innerHalf = Math.max(radius * INNER_STROKE * 0.5 * scale, px * 0.5)
      let opacity = percent > FADE_FROM ? 1 - (percent - FADE_FROM) / (1 - FADE_FROM) : 1
      opacity *= (0.35 + 0.65 * BIRTH_LEVEL) * touchWeight
      const dist = Math.hypot(x - r.x, y - r.y)
      const outer = ring(dist, radius, outerHalf)
      const inner = ring(dist, radius * INNER_RADIUS, innerHalf)
      ink = screenOp(ink, (outer + inner) * opacity)
    }
    return ink
  }

  function coverageAt(t: number, touchWeight: number): { above9: number; above1: number } {
    let above9 = 0
    let above1 = 0
    for (let py = 0; py < H; py++) {
      const uvY = (py + 0.5 - H / 2) / MIN_DIM
      for (let px_ = 0; px_ < W; px_++) {
        const uvX = (px_ + 0.5 - W / 2) / MIN_DIM
        const ink = inkAt(uvX, uvY, t, touchWeight)
        if (ink > 0.9) above9++
        if (ink > 0.1) above1++
      }
    }
    const total = W * H
    return { above9: (100 * above9) / total, above1: (100 * above1) / total }
  }

  // "Full load" is a window, not an instant: every t from the drag's last
  // spawn to the first ring's own death has all sixteen slots alive at
  // once. Sampled across that window (worst frame kept) the same way the
  // entry's own table reports a range rather than a single figure.
  function worstOverWindow(touchWeight: number): { above9: number; above1: number } {
    let above9 = 0
    let above1 = 0
    const steps = 12
    for (let s = 0; s <= steps; s++) {
      const t = dragEnd + (s / steps) * (LIFESPAN - dragEnd)
      const c = coverageAt(t, touchWeight)
      above9 = Math.max(above9, c.above9)
      above1 = Math.max(above1, c.above1)
    }
    return { above9, above1 }
  }

  const unweighted = worstOverWindow(1.0)
  const weighted = worstOverWindow(1 / Math.sqrt(N_TOUCH))

  check(
    'full-load drag, unweighted: frame above 0.9 ink exceeds 40% (the fault this entry guards against)',
    unweighted.above9 > 40,
    `${unweighted.above9.toFixed(1)}%`,
  )
  check(
    'full-load drag, 1/sqrt(n) weighted: frame above 0.9 ink stays under 10% (unweighted clears 40%)',
    weighted.above9 < 10,
    `${weighted.above9.toFixed(1)}%`,
  )
  check(
    'full-load drag: coverage above 0.1 ink is within 5 points weighted vs unweighted — the trail survives, only the wall does not',
    Math.abs(weighted.above1 - unweighted.above1) <= 5,
    `weighted ${weighted.above1.toFixed(1)}% vs unweighted ${unweighted.above1.toFixed(1)}%`,
  )

  const weight = (n: number): number => 1 / Math.sqrt(Math.max(n, 1))
  check('weight(1) === 1 — a lone ring is bit-identical to before this entry', weight(1) === 1, String(weight(1)))
}

console.log(failures === 0 ? `\nall checks passed` : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
