/**
 * Every name this release chip has ever carried, oldest first.
 *
 * The build number answers "is this newer than what I had"; it cannot answer
 * "is this the one with the camera in it", and that is the question actually
 * being asked when someone is looking at a phone across a room. Consecutive
 * integers are also genuinely hard to tell apart at a glance — most of a long
 * session spent hunting a deploy went into establishing that the screen said
 * 22 rather than 45, which a name would have settled instantly.
 *
 * Two words, lowercase, evocative rather than descriptive. Descriptive names
 * go stale the moment the release after them changes the same thing; a name
 * only has to be memorable and distinct from its neighbours.
 *
 * Keep it under about 18 characters. The chip is set large on purpose — it is
 * meant to be read at arm's length from a propped-up phone — so a long name is
 * the one thing that can crowd a 320px screen. The size clamps down to fit
 * rather than truncating, but a short name gets the full size. It is also the
 * width `index.html` reserves for the release-name flip (docs/todo.md entry
 * 55, `#release-name`'s own `min-width: 18ch`) — a name past this ceiling is
 * the one thing that can make that flip reflow.
 *
 * Appended in the same commit as the work it names, not changed —
 * docs/todo.md entry 55. Every commit that reaches main deploys, so every
 * commit that reaches main adds a line here. An append cannot silently lose
 * the previous name the way an edit once could; the list itself is what entry
 * 55's load animation runs through, oldest to newest, before settling on
 * `RELEASE_NAME` below. Recovered once, in full, from `git log --follow` —
 * the seed data below is not invented, it is what actually shipped.
 */
export const RELEASE_NAMES: readonly string[] = [
  'false calm',
  'watch fire',
  'one window',
  'one road',
  'plain sight',
  'first light',
  'step back',
  'one voice',
  'wide orbit',
  'paper lantern',
  'quiet order',
  'red wedge',
  'one axis',
  'already playing',
  'three dials',
  'all arcs',
  'bare start',
  'note board',
  'short long',
  'twice asked',
  'paper trail',
  'white noise',
  'two colours',
  'idle guard',
  'first glance',
  'quiet credit',
  'own blend',
  'grain speaks',
  'harder ask',
  'stays loud',
  'ask twice',
  'full reach',
  'shake depth',
  'soft breathe',
  'true round',
  'keep frame',
  'way back',
  'first tremor',
  'never dark',
  'ask first',
  'stays hidden',
  'own corner',
  'local time',
  'one gesture',
  'now legible',
  'light touch',
  'ambient gain',
  'plumb line',
  'quiet slate',
  'lattice pulse',
  'three zones',
  'finger paint',
  'true zero',
  'gentle nudge',
  'lower ceiling',
  'play it',
  'hears loudness',
  'six ways',
  'dead centre',
  'louder gate',
  'twin chips',
  'never waits',
  'four fingers',
  'living picture',
  'quiet powder',
  'fourteen agree',
  'stacks up',
  'one or two',
  'play invites',
  'held colour',
  'light ground',
  'follows sky',
  'edge glows',
  'own history',
  'borrowed corner',
  'rolled poster',
  'powder piles',
  'keeps recovering',
  'new name',
  'quiet pulse',
  'two fingers',
  'true hue',
  'said once',
  'rolls colour',
  'both ways',
  'tap shutter',
  'proven live',
  'keeps time',
  'colour lags',
  'two rings',
  'door back',
  'one shot',
  'first claim',
  'holds bar',
  'two planes',
  'held alone',
  'own tempo',
  'gentle counts',
  'one snapshot',
  'raised bar',
  'eventual move',
  'known gait',
  'second engine',
  'quiet swap',
  'shown queue',
  'room alone',
  'second clock',
  'stays here',
  'real room',
  'still moves',
  'twin lights',
  'right angle',
  'soft landing',
  'one shutter',
  'held bearing',
  'null surface',
  'quiet quarter',
  'run of rings',
  'still framing',
  'says i am',
  'brief crossing',
  'turn over',
  'further apart',
  'quieter gate',
  'cursor plays',
  'slow reveal',
  'bends toward',
  'hold opens',
  'one key',
  'right opens',
  'steady hand',
  'inside edges',
  'stays armed',
  'room arrives',
  'touch returns',
  'sand out',
  'name shows',
  'hangs low',
  'held budget',
  'paused clock',
  'key shake',
  'sun retires',
  'tunnel breathes',
  'taut strings',
  'closed orbit',
  'missed beat',
  'own places',
  'open house',
]

/** The current release's name — derived as the list's last element, so
 *  `version.ts` and every other reader is unchanged by this being an array
 *  now instead of a single constant. */
export const RELEASE_NAME = RELEASE_NAMES[RELEASE_NAMES.length - 1]

// docs/todo.md entry 137 — every release opens on its own seed, deterministic
// from RELEASE_NAME rather than Math.random(), so the four numbers `uSeed`
// hands out at construction (scene.ts:627) are the same on every load of the
// same build and different from every other name this file has ever carried.
// The build number was considered and rejected as the hash's input: it moves
// on every commit, so a seed keyed to it would change the opening look for
// builds that changed nothing visual, where RELEASE_NAME changes exactly once
// per release, by CLAUDE.md's own rule — precisely the cadence this asks for.

const FNV_PRIME = 0x01000193 // the standard FNV-1a 32-bit prime, unmodified

// Four distinct starting states for one shared pass over the name's bytes,
// each a byte-rotation of the canonical FNV-1a 32-bit offset basis
// (0x811c9dc5) rather than four unrelated constants pulled from nowhere —
// still a single named, checkable function (FNV-1a) run four times with
// four different seeds, not four different hash algorithms to audit.
const FNV_OFFSET_BASES: readonly [number, number, number, number] = [
  0x811c9dc5, 0x1c9dc581, 0x9dc581c9, 0xc581c9dc,
]

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * Four independent-ish FNV-1a-32 hashes of `name`, one pass over the bytes
 * with four running accumulators rather than four separate passes — the
 * "one pass" Decided promises. `Math.imul` for the 32-bit multiply: plain
 * `*` on numbers this size silently loses the low bits to float64 rounding,
 * which would make the hash depend on JS engine behaviour rather than only
 * on the bytes fed in.
 */
function fnv1aQuad(name: string): [number, number, number, number] {
  const h = FNV_OFFSET_BASES.slice() as [number, number, number, number]
  for (let i = 0; i < name.length; i++) {
    const byte = name.charCodeAt(i) & 0xff
    for (let k = 0; k < 4; k++) h[k] = Math.imul(h[k] ^ byte, FNV_PRIME) >>> 0
  }
  return h
}

/**
 * The four 0-1 numbers a release (or any string) opens on. The top 16 bits
 * of each 32-bit hash, not the bottom — FNV-1a's own avalanche is weakest in
 * the low bits it multiplies into last, and `uSeed`'s coarsest consumer
 * (`SYMMETRY = 4 + floor(uSeed.y * 6)`, six-way) only needs the top few bits
 * to already differ between adjacent names for the whole tuple to look
 * unrelated — a margin the probe checks directly against every name this
 * project has ever shipped, rather than assumed from the algorithm's own
 * reputation.
 */
export function releaseSeed(name: string = RELEASE_NAME): readonly [number, number, number, number] {
  const h = fnv1aQuad(name)
  return h.map((x) => (x >>> 16) / 65536) as [number, number, number, number]
}

/**
 * `?seed=` as sixteen hex characters, four per component — a 16-bit
 * quantisation exactly, so the encoder below is lossless within it. Chosen
 * over a hand-rolled compact encoding (Decided): the string is meant to sit
 * in a URL a person retypes or pastes, and hex round-trips through that with
 * no locale or float-formatting hazard a decimal or base64 string would risk.
 */
export function encodeSeedHex(seed: readonly [number, number, number, number]): string {
  return seed
    .map((v) => Math.min(65535, Math.floor(clamp01(v) * 65536)).toString(16).padStart(4, '0'))
    .join('')
}

/**
 * The inverse of `encodeSeedHex`, or `null` for anything that is not exactly
 * sixteen hex characters — wrong length, non-hex, or empty all fall back to
 * the release seed the same way every other malformed URL parameter here
 * already does, rather than throwing.
 */
export function decodeSeedHex(hex: string): readonly [number, number, number, number] | null {
  if (!/^[0-9a-f]{16}$/i.test(hex)) return null
  const out: number[] = []
  for (let i = 0; i < 16; i += 4) out.push(parseInt(hex.slice(i, i + 4), 16) / 65536)
  return out as [number, number, number, number]
}
