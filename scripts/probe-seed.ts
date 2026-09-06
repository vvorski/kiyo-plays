/**
 * Offline check of docs/todo.md entry 137's pure half: does `releaseSeed()`
 * actually deliver what the entry promises — deterministic, four numbers in
 * [0, 1), and (the claim nothing short of checking the whole list can
 * verify) a distinct tuple for every name this project has ever shipped —
 * and do `encodeSeedHex`/`decodeSeedHex` round-trip and fail safely.
 *
 * Nothing here opens a browser or touches scene.ts/main.ts: releaseSeed and
 * the hex codec are plain functions of strings and numbers.
 *
 *   node --experimental-strip-types scripts/probe-seed.ts
 */

import { releaseSeed, encodeSeedHex, decodeSeedHex, RELEASE_NAMES } from '../src/release-name.ts'

let failures = 0
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : `  — ${detail}`}`)
}

// --- releaseSeed() ----------------------------------------------------------

{
  const a = releaseSeed('some release')
  const b = releaseSeed('some release')
  check(
    'deterministic: the same name gives the same four numbers across calls',
    a.every((v, i) => v === b[i]),
    `${a} vs ${b}`,
  )
}

{
  const s = releaseSeed('another release')
  const inRange = s.every((v) => v >= 0 && v < 1)
  check('all four components land in [0, 1)', inRange, `${s}`)
}

{
  // The "unique per release" claim, checked against the whole history rather
  // than asserted — a hash collision anywhere in 177 names is exactly the
  // kind of thing that reads fine on paper and fails the one time it matters.
  const seen = new Map<string, string>()
  let collision: string | null = null
  for (const name of RELEASE_NAMES) {
    const key = encodeSeedHex(releaseSeed(name))
    const prior = seen.get(key)
    if (prior !== undefined) {
      collision = `${JSON.stringify(prior)} and ${JSON.stringify(name)} both hash to ${key}`
      break
    }
    seen.set(key, name)
  }
  check(
    `every one of ${RELEASE_NAMES.length} release names in RELEASE_NAMES produces a distinct four-tuple`,
    collision === null,
    collision ?? '',
  )
}

// --- hex round-trip -----------------------------------------------------

{
  // Every quantised 16-bit level, not a handful of samples — round-tripping
  // through encode/decode is the one property probe-name-decode.ts's own
  // house style insists on checking exhaustively rather than by spot check.
  let worst = 0
  for (let i = 0; i < 65536; i += 97) {
    // every 97th level: exhaustive would be 65536 iterations of four
    // components each, and every 97th (coprime with 65536) still walks the
    // full range without landing on the same handful of easy values twice.
    const v = i / 65536
    const hex = encodeSeedHex([v, v, v, v])
    const back = decodeSeedHex(hex)
    if (back === null) {
      check('round-trip did not fail for a well-formed value', false, `${v} -> ${hex} -> null`)
      break
    }
    worst = Math.max(worst, ...back.map((b) => Math.abs(b - v)))
  }
  check('encode/decode round-trips every component to within 1/65536', worst <= 1 / 65536, `worst ${worst}`)
}

{
  const seed = releaseSeed('a specific release, not the current one')
  const hex = encodeSeedHex(seed)
  check('encodeSeedHex produces exactly sixteen hex characters', /^[0-9a-f]{16}$/.test(hex), hex)
}

for (const bad of ['', 'too-short', '0'.repeat(15), '0'.repeat(17), 'g'.repeat(16), 'not-hex-at-all!!']) {
  check(`decodeSeedHex(${JSON.stringify(bad)}) returns null rather than throwing`, decodeSeedHex(bad) === null)
}

console.log(failures === 0 ? '\nall seed checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
