/**
 * Offline check of the HUD's chip arcs — docs/todo.md entry 119.
 *
 * The bug this exists for could only be seen at a viewport nobody had looked
 * at: on every landscape size the last chip on the outer ring was placed
 * above the top of the screen, so it existed, was wired, and could not be
 * tapped. `resize_window` lies about the viewport and `hud.ts` cannot be
 * imported headlessly at all, so the geometry moved to `chip-arc.ts` and this
 * scrubs it directly — every aspect ratio in a few milliseconds, rather than
 * four sizes somebody thought to try.
 *
 *   node --experimental-strip-types scripts/probe-chips.ts
 */

import { readFileSync } from 'node:fs'
import { chipPosition } from '../src/chip-arc.ts'

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

/** The touch target `.hud-chip` is always 3rem, on both rings — the outer one
 *  is only drawn smaller (entry 77), and `offsetWidth` reads the button. */
const SIZE = 48

/** What the app actually lays out today: four on the inner ring, three on the
 *  outer since entry 115 deleted the shutter chip. */
const RINGS: { ring: 'inner' | 'outer'; n: number }[] = [
  { ring: 'inner', n: 4 },
  { ring: 'outer', n: 3 },
]

interface Box {
  ring: string
  i: number
  left: number
  top: number
}

function boxes(w: number, h: number, rings = RINGS): Box[] {
  const out: Box[] = []
  for (const { ring, n } of rings) {
    for (let i = 0; i < n; i++) {
      const [x, y] = chipPosition(i, n, SIZE, ring, w, h)
      out.push({ ring, i, left: x - SIZE / 2, top: y - SIZE / 2 })
    }
  }
  return out
}

// 1. The sizes the entry measured, plus their portrait twins. Every one of
//    the landscape rows was off the top before this entry.
{
  const sizes: [number, number][] = [
    [320, 568],
    [360, 640],
    [390, 844],
    [414, 896],
    [768, 1024],
    [568, 320],
    [640, 360],
    [844, 390],
    [896, 414],
    [900, 700],
    [1024, 768],
    [1280, 800],
    [1440, 900],
  ]
  let worst = Infinity
  const bad: string[] = []
  for (const [w, h] of sizes) {
    for (const b of boxes(w, h)) {
      worst = Math.min(worst, b.top, b.left)
      if (b.top < 0 || b.left < 0) bad.push(`${w}x${h} ${b.ring}[${b.i}] top=${b.top.toFixed(0)} left=${b.left.toFixed(0)}`)
    }
  }
  check('no chip is off the top or the left at any measured size', bad.length === 0, bad.join('; '))
  console.log(`      closest any chip comes to an edge across those sizes: ${worst.toFixed(1)}px`)
}

// 2. The general claim, which is the one worth having: scrub the whole space
//    rather than the sizes somebody thought of. A fix that passed the table
//    above and failed here would be a special case wearing a geometry
//    costume, which is exactly what the entry chose against.
{
  const bad: string[] = []
  let worst = Infinity
  for (let w = 280; w <= 1600; w += 17) {
    for (let h = 280; h <= 1600; h += 17) {
      for (const b of boxes(w, h)) {
        worst = Math.min(worst, b.top, b.left)
        if (b.top < 0 || b.left < 0) bad.push(`${w}x${h} ${b.ring}[${b.i}]`)
      }
    }
  }
  check(
    'nor at any of ~6000 viewports from 280 to 1600 on both axes',
    bad.length === 0,
    `${bad.length} placements off screen, first: ${bad.slice(0, 4).join(', ')}`,
  )
  console.log(`      closest across the whole sweep: ${worst.toFixed(1)}px`)
}

// 3. Extreme aspect ratios, where the clamp inside `chipArcSpan` is what
//    stands between the app and `left: NaNpx` — a blank corner reads as "the
//    HUD is gone", which is worse than a clipped chip and harder to report.
{
  const bad: string[] = []
  for (const [w, h] of [
    [280, 1600],
    [1600, 280],
    [200, 200],
    [3000, 300],
    [300, 3000],
  ] as [number, number][]) {
    for (const b of boxes(w, h)) {
      if (!Number.isFinite(b.left) || !Number.isFinite(b.top)) bad.push(`${w}x${h} ${b.ring}[${b.i}]`)
    }
  }
  check('no viewport produces a NaN or infinite position', bad.length === 0, bad.join(', '))
}

// 4. Portrait must not move. The three verified-and-approved HUD passes all
//    happened in portrait, and this entry is not licensed to shift them — so
//    the bound is 1px against the positions the old centring produced, which
//    are reproduced here rather than trusted from memory.
{
  // What the pre-entry-119 code computed: centre on 232°, clamp the start at
  // 209°, radius from min(w, h), no top-edge bound at all.
  const DEG = Math.PI / 180
  const old = (i: number, n: number, ring: 'inner' | 'outer', w: number, h: number): [number, number] => {
    const base = Math.min(w, h)
    const cx = w + 10
    const cy = h + 10
    const r = base * (ring === 'outer' ? 1.22 : 1.08)
    const step = (SIZE + 5) / r
    const start = Math.max(232 * DEG - ((n - 1) / 2) * step, 209 * DEG)
    const a = start + i * step
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  let worst = 0
  for (const [w, h] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [414, 896],
    [768, 1024],
  ] as [number, number][]) {
    for (const { ring, n } of RINGS) {
      for (let i = 0; i < n; i++) {
        const [nx, ny] = chipPosition(i, n, SIZE, ring, w, h)
        const [ox, oy] = old(i, n, ring, w, h)
        worst = Math.max(worst, Math.abs(nx - ox), Math.abs(ny - oy))
      }
    }
  }
  check(`portrait layouts move by at most 1px (worst ${worst.toFixed(3)}px)`, worst <= 1, `${worst}px`)
}

// 5. The ladder's first rung, and the reason it exists: a ring that has grown
//    past what its arc can hold must tighten rather than overflow. Eight
//    chips on one ring is well past anything shipped — entry 77 split exactly
//    that many into two rings — and it is what the next chip added would
//    start walking toward.
{
  const bad: string[] = []
  for (const n of [4, 5, 6, 7, 8]) {
    for (const [w, h] of [
      [320, 568],
      [568, 320],
      [844, 390],
    ] as [number, number][]) {
      for (const b of boxes(w, h, [{ ring: 'outer', n }])) {
        if (b.top < 0 || b.left < 0) bad.push(`n=${n} ${w}x${h} [${b.i}]`)
      }
    }
  }
  check('a ring of up to eight chips still fits, at every tested aspect', bad.length === 0, bad.join(', '))
}

// 6. Chips stay in order along the arc and never land on top of each other,
//    which the compression rung could otherwise trade away silently.
{
  const bad: string[] = []
  for (const [w, h] of [
    [320, 568],
    [568, 320],
    [844, 390],
    [1440, 900],
  ] as [number, number][]) {
    for (const { ring, n } of RINGS) {
      const pts = Array.from({ length: n }, (_, i) => chipPosition(i, n, SIZE, ring, w, h))
      for (let i = 1; i < pts.length; i++) {
        const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        if (d < SIZE * 0.9) bad.push(`${w}x${h} ${ring} ${i - 1}->${i} ${d.toFixed(1)}px apart`)
        if (pts[i][0] <= pts[i - 1][0]) bad.push(`${w}x${h} ${ring} ${i} is not to the right of ${i - 1}`)
      }
    }
  }
  check('neighbouring chips stay ordered and never overlap', bad.length === 0, bad.join('; '))
}

// A closed HUD takes no input — the assembled bug this case exists for: the
// `.hit` grab arcs carry their own `pointer-events: stroke`, which outranks the
// closed scrim's `none`, and once the session extraction built the HUD before
// the gate they sat invisibly over the Start disc at z-index 30. 2-27% of the
// disc took a tap on a phone-sized viewport and its centre took none. Chips had
// already been excused from the same bug one selector at a time, which is how
// the arcs got missed, so what is asserted is the universal form: a selector
// naming one child would pass this while a third tenant walked straight past.
// hud.ts cannot be imported headlessly, so this reads its source; the geometry
// itself gets measured in a browser with elementFromPoint.
{
  const css = readFileSync(new URL('../src/hud.ts', import.meta.url), 'utf8')
  // The known-good half: the arcs must still be live once it is open, or a rule
  // that simply killed all input would pass the check below.
  check(
    'grab arcs take input when the HUD is open',
    /\.hud-scrim\.open \{[^}]*pointer-events: auto/.test(css) &&
      /\.hud-dial \.hit \{ pointer-events: stroke/.test(css),
    'the open-state input rules have gone',
  )
  check(
    'nothing inside a closed HUD takes input',
    /\.hud-scrim:not\(\.open\) \* \{ pointer-events: none !important; \}/.test(css),
    'no universal closed-state rule in hud.ts: an invisible child can eat taps meant for the gate or the picture',
  )
}

console.log(failures === 0 ? '\nall chip-arc checks passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
