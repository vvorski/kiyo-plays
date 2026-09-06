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
]

/** The current release's name — derived as the list's last element, so
 *  `version.ts` and every other reader is unchanged by this being an array
 *  now instead of a single constant. */
export const RELEASE_NAME = RELEASE_NAMES[RELEASE_NAMES.length - 1]
