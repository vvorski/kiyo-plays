# To-do

A capture buffer, so an idea can be caught and made buildable without stopping
whatever is being built right now.

This is deliberately *not* the GitHub issue queue. `spec-to-issue` and
`auto-issue-gogo` are the heavyweight path: a full spec, labels, a branch per
issue, an autonomous loop. That path is right when work is going to be handed to
an agent unattended. This file is right when an idea arrives mid-flight and the
only thing that matters is that it is written down in a state somebody can pick
up cold. An entry here can graduate to an issue later; nothing here has to.

## The rule

**An entry is ready when someone with no memory of the conversation can build it
without making a single judgement call you could have made for them.**

Entries do not fail by being short. They fail by containing an unresolved fork,
and the builder's guess is worse than its question. In a visual project almost
every interesting fork is a taste question wearing a technical costume — "should
the arc ease out or grow linearly" reads as implementation and is not.

Add entries with `/aaa <idea>`. It decides everything it can defend and asks
only about hard stops and genuine taste forks, so most ideas cost one answer or
none. Calls it made itself are marked **Mine** with a reason, which is what
makes them overturnable later without re-deriving them. Writing an entry by
hand is fine too; the format is below.

## Format

```markdown
### N. Title
`status: ready` · added YYYY-MM-DD

**Do** — one sentence, imperative.
**Why** — one sentence. The problem, not the solution.

**Decided** — every fork, what it was chosen *over*, and whose call it was.
- Question → chosen, over rejected.
- Question → chosen, over rejected. **Mine**, because reason.

**Lands in** — files, with line numbers where they are known.
**Done when** — an observable outcome, not "it works".
**Verify** — the gates, plus the on-screen check this project always wants.
**Hard stops** — all four answered. Any "yes" needs the user's approval quoted
in Decided, and without it the status is `blocked`, not `ready`.
```

`status:` is one of `ready`, `building`, `blocked` (needs a decision — say
which), or `done` (leave it, with the build number that shipped it).

Two things belong on the `status:` line beyond the status itself:

- **Build order**, when an entry only makes sense after another — `build after
  88`, `build before 90–92`. Entries are claimed in the order somebody reads
  them, not the order they were written, and a dependency living only in
  somebody's head gets built backwards.
- **What was left out**, when an entry ships partially — `the expansion-curve
  envelope is deliberately incomplete — see build note`. CLAUDE.md's *Shipping
  part of an entry* requires the follow-up entry to exist before the parent is
  marked `done`; this clause is what makes the omission visible without reading
  git.

## Claiming an entry

**Whoever starts building an entry sets it to `building` first, in its own
commit, before touching any other file.** Two agents work this file: one
captures entries, one builds them, and they share a checkout. `building` is how
each knows what the other is holding.

```markdown
`status: building` · added YYYY-MM-DD · started YYYY-MM-DD
```

Three rules follow from it:

- **A `building` entry is not to be edited by anyone else** — not amended, not
  superseded, not re-scoped. An entry rewritten under a builder mid-flight is
  how both halves end up wrong; it has already been avoided once by leaving
  entry 33 alone as a single emitter while entry 49 was written around it.
- **A capture session may still append entries that supersede a `building`
  one**, and should say so in the new entry rather than editing the old. The
  claim protects the text, not the idea.
- **Set it back to `ready` if the work is abandoned**, with a line saying what
  was learned. A `building` entry nobody is building is worse than a `ready`
  one, because it stops anybody else picking it up.

The status moves `ready` → `building` → `done` in the same commit as the work
it names, so the build number and the status never disagree.

## Entries

### 40. The buzz has never been tested apart from the shake
`status: blocked` · added 2026-08-30 · abandoned 2026-08-30

**Blocked on:** a phone that vibrates for anything at all. Not on this repo.

**Outcome, 2026-08-30 — browser vibration is given up on for now, Victor's
call.** The ladder was built and run on the phone, and **every rung failed,
including a flat 600 ms pulse and three continuous seconds**. Both are far
beyond anything the app sends, so this repo was never the cause, and the
system-level checks that follow from that — Do Not Disturb, silent mode, the
haptic level, battery saver, Chrome's site settings — did not recover it
either. The instrument did its job: it moved the question out of the app in
one tap and kept it out.

What that retires: entry 1's whole line of work — 22 ms, then 40 ms, then the
primed two-pulse pattern at build 68 — was tuning a signal against a phone
that was not going to produce one. **Do not reopen it, do not tune the
patterns again, and do not treat a silent shake as evidence about
`CONFIRM_PATTERN`.** If vibration is ever revisited, the ladder is the first
thing to run and its verdict is the gate.

Nothing has to be removed for this. `haptics.ts` opens by stating that the
Vibration API "is a bonus on one platform, absent on the other, and nothing
may be built to depend on it", and that promise is exactly what makes
abandoning it free: the code is silent where it is unsupported, costs nothing
when it does not fire, and no feature is waiting on it.

The consequence worth knowing: **a shake now has no confirmation at all.**
`flashShake()` is gated on the numeric readout being visible, so in ordinary
use the only evidence a shake registered is the picture changing — which is
the exact ambiguity `haptics.ts` was written to resolve, since "the picture
was already moving, and it changes to a different picture that is also
moving". Entry 1 anticipated this for iOS and said the entry would then become
"replace the haptic with something visual". That is now the open question on
Android too, and it wants its own entry rather than a note here.

**Do** — land the haptic ladder in the repo as `haptics-probe.html`, beside
`hud-probe.html` and `camera-probe.html`: a rung per pattern, coarsest first,
each firing `navigator.vibrate` from a real tap and reporting what it returned.
**Why** — a weekend of not feeling anything cannot currently distinguish "the
motor never moved" from "the shake was never detected", and those have nothing
in common.

**Decided**
- The two faults are indistinguishable from inside the app → the buzz only
  ever fires as a consequence of a detected shake, so a silent phone is
  evidence about the *pair*. Every haptics change so far — 22ms, then 40ms,
  then the primed pattern at build 68 — has been aimed at the buzz on the
  assumption the shake was fine. That assumption has never been tested, and it
  is free to test: a button is a user gesture, and a user gesture is all
  `vibrate()` needs.
- The ladder, coarsest first → **600ms flat, 300ms flat, the old bare `[40]`,
  `CONFIRM_PATTERN`, `CONFIRM_PATTERN` at MAX_SCALE, `DOUBLE_PATTERN`,
  `DOUBLE_PATTERN` at MAX_SCALE.** **Mine.** The top rung is far beyond
  anything the app sends, so failing it proves the fault is the phone or a
  system setting and not this repo — which is the single most valuable thing
  the page can establish, and it establishes it in one tap.
- Show the boolean → `vibrate()` returns false when the browser declines, and
  `haptics.ts` already counts `attempts`/`accepted`/`suppressed` for exactly
  this reason. Print the return beside each rung. A page of buttons that all
  return true while nothing is felt is a *different* finding from one where
  the calls are being declined, and the two want opposite next steps.
- The patterns are imported, not retyped → `CONFIRM_PATTERN` and
  `DOUBLE_PATTERN` are module-private in `haptics.ts` today. Export them for
  the probe rather than copying the numbers in, because a probe that tests
  last month's constants is worse than no probe. `MAX_SCALE` is already
  exported.
- What already exists and does **not** need building → `hapticStatus()` is
  wired: `main.ts:874` feeds it to the HUD and `hud.ts:189` has a field for
  it, so a `?debug` load already shows why there was or wasn't a buzz. **Check
  that line before writing any code for this entry** — if it says attempts are
  being made and accepted while a shake is being felt as nothing, the ladder
  will confirm the pattern is the fault; if attempts are zero, the shake never
  arrived and no haptics change can help.
- A published copy exists already and is not a substitute → the ladder was
  published as an artifact so it could be opened on the phone the same
  evening, without a dev server or a deploy. That URL is not in version
  control, does not track the constants, and cannot be run by anyone who does
  not have the link. This entry is what makes it survive.
- Not reachable from the app → a dev page like its two neighbours, so the
  circular control surface constraint does not apply and it may use plain
  buttons.

**Lands in**
- `haptics-probe.html` — new, at the repo root beside the other probe pages.
- `src/haptics.ts` — export `CONFIRM_PATTERN` and `DOUBLE_PATTERN`.

**Done when** — opening the page on the phone and working down it identifies
the first rung that can be felt, or shows that none can while every call
returns true. Either outcome names the next change; today neither is
available.
**Verify** — the phone, which is the only instrument that can answer this;
`pnpm probe:haptics` must still pass, since exporting the patterns must not
alter them. Also `pnpm build`, `pnpm lint`.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 71. The sky gets a noon and a night, and the override swings both ways
`status: done` · added 2026-08-30 · shipped at build 238 · build with or after 68 · **control retired by 127**

**Build note** — `sky.ts`'s single four-anchor table split into two:
`DAYLIGHT_ANCHORS` (six: 04:00/0.0, 06:30/0.35, 10:30/1.0, 15:30/1.0,
19:30/0.4, 23:00/0.0 — two pairs at equal value holding the night floor and
day plateau flat, the two original dawn/dusk anchors unmoved carrying the
transitions) and `WARMTH_ANCHORS` (the original four, untouched). Both
interpolated by one shared `interpolate()` generic over an anchor list,
rather than two copies of the wrap-and-segment-search logic.

**Honest finding, not silently corrected**: the entry's own Decided text
estimates the resulting mid-band at "~2.5 hours at each end of the day"
(~5 total). Measured directly (`probe:sky`, reproducible with the one-line
scrub the entry's own Verify credits): each transition is 4.6-5.3 hours,
~9.95 total — roughly double the estimate. The anchor *hours and values*
are the entry's own explicit "Mine as to the hours" choice and are exactly
what is implemented; the "~5" reads as an eyeballed guess at what those
anchors would produce, not re-derived from them. Implemented the anchors
as specified and recorded the true measured number in the probe and here,
rather than either quietly shipping a wrong comment or re-tuning anchor
hours the entry itself claimed as a deliberate choice. The qualitative
point — day and night are states held for hours, not instants touched
once — holds regardless: 9.95 hours of transition against 14.05 held is
still a real fix for a curve that spent 16 of 24 hours in between.

`scene.ts`: `overrideTarget`/`overrideCurrent` now range -1..1 (was 0..1);
the existing min/max chase logic needed no change, since it already moves
toward a target from either side. `uDay` splits into two branches at the
sign of `overrideCurrent` — `skyDaylight + (1-skyDaylight)*overrideCurrent`
for day-ward (unchanged from before), `skyDaylight*(1+overrideCurrent)`
for night-ward — both collapsing to plain `skyDaylight` at 0. New
`skyDaylightSample`/`skyDaylight` split: the sample updates once a second
as before, but `skyDaylight` (what `uDay` actually reads) chases it at
`SKY_CHASE_RATE = 1/3` (full-scale over ~3s) every frame, so a DST jump or
a tab resumed hours later fades rather than snapping. Warmth is not
chased — a secondary tint, and the entry's own finding was specifically
about `uDay`.

`prefs.ts` gained `skyOverride: 'auto'|'day'|'night'`, exported as
`SkyOverride`. `day: boolean` stays exactly as it was — read, written,
untouched in shape or meaning — with a new one-way migration: a valid
stored `skyOverride` always wins; absent that, a stored `day: true`
migrates in as `'day'`; `day` itself is never rewritten by this. Verified
live (not just by reading the code) against the real `loadPrefs()`: an
old-shaped stored value (`day: true`, no `skyOverride`) reads back as
`skyOverride: 'day'` with `day` still `true`; a modern stored value
(`skyOverride: 'night'`, `day: true`) reads back `'night'` — the newer
field wins over the older one exactly as specified, not merely by absence
of a bug in the one case that was easy to picture.

`hud.ts`'s day chip cycles `auto → day → night → auto` on tap, relabelling
itself each time (`'Sky: auto'`/`'Outdoor'`/`'Night'`) since `aria-pressed`
alone can no longer distinguish pinned-day from pinned-night. `prefs.day`
is no longer written by this chip at all — entry 71 supersedes it with
`prefs.skyOverride`, matching the entry's own "the old field is left in
place" for entry 69's process-lapse lesson applied deliberately this time,
not by oversight. Verified live: three taps against the real, mounted
`createHud()` (via `hud-probe.html`, not a stub) produced exactly
`onSkyOverride` calls `['day'], ['night'], ['auto']` in order, with the
chip's own `aria-label`/`aria-pressed` matching at every step.

`scripts/probe-sky.ts` rewritten for the two-table split: anchors checked
separately, new plateau/floor checks (sampled throughout each window, not
only at its labelled edge), the mid-band check restated with the true
measured ceiling (see the honest finding above) rather than the entry's
own estimate, and the steepest-transition-point check recomputed for the
new 06:30-10:30 dawn segment (~08:30, not the old curve's ~09:45). All
twenty checks pass.

Not verified live: the override fade's and the chase's own real-time
dynamics (the ~1.2s and ~3s durations) — `render()` computes its own `dt`
internally from wall-clock time with no way to inject a controlled value
from outside, and this harness's timers are independently unpredictable
(established in earlier entries this session). What was verified instead:
override *seeding* at construction (`stats().sky.override` reads exactly
0/1/-1 for `'auto'`/`'day'`/`'night'`, checked against a real, freshly
constructed `Visualiser` via direct module import — not a stub), and the
chase/fade formulas by code review, since both are simple, previously-
shipped patterns this entry only widens rather than replaces. The
`~10:30/15:30/23:00/04:00`-are-the-right-hours question is, per the
entry's own Verify line, only ever answerable on a phone across an actual
evening — not attempted here.

**Do** — reshape the sky's anchors so the day has a plateau and the night has a
floor, make the chip cycle auto → day → night instead of only pinning day, and
smooth the clock's own jumps.

**Why** — reviewed as asked. The mechanism is sound and well-made: a pure
function of the clock, four anchors smoothstepped on a wrapped circle, sampled
once a second, one 1.2s override fade, probe-covered, and the geolocation
refusal in `sky.ts`'s header is the right call made for the right reason. The
findings are about the *shape* of the curve and one missing direction, not the
machinery.

**Decided**
- **Scrubbed the actual curve** (`skyFor` over 24 hours — reproducible with
  one node line). Daylight touches 1.0 at 13:00 *exactly* and 0.0 at 02:00
  *exactly*; it sits in the 0.3-0.8 mid-band from about 06:00 to 22:00 —
  **sixteen hours of neither-day-nor-night**. Four anchors smoothstepped
  pairwise cannot produce a plateau: every anchor is a peak or a valley, so
  "day" is an instant, not a state.
- **Why that matters doubles once entry 68 lands.** 68's own dawn analysis
  identifies mid-`uDay` as the least readable zone — ink and paper converging —
  and mandates the ink leading the paper through dawn so the *crossover* is
  brief. But with these anchors the crossover is not dawn: it is **the entire
  morning, evening, and most of the afternoon**. A curve tuned when day mode
  was a chip nobody left on becomes the resident state of the picture the
  moment the clock drives it.
- **So: six anchors, holding the ends** → night 0.0 from 23:00 to 04:00, day
  1.0 from 10:30 to 15:30, with the existing warm dawn/dusk anchors carrying
  the transitions between them. The mid-band becomes ~2.5 hours at each end
  of the day instead of sixteen. Warmth keeps its four-point shape — warm at
  both ends, coolest in the small hours — since that part is right and was the
  original entry's whole point. **Mine** as to the hours; the principle (day
  and night are *states*, transitions are *events*) is the review's finding.
- **The override only goes one way, and the missing direction is the common
  case.** `uDay = skyDaylight + (1 − skyDaylight) × override` can force day at
  night — but nothing can force night at noon. A phone in a dark bedroom, a
  cinema, a bar at 2pm: the clock says full day, the picture is a lit sheet of
  paper, and there is no way back. The asymmetry is an accident of entry 47's
  chip ("Outdoor") predating the clock, not a decision anyone made.
- **So the chip cycles: auto → day → night → auto.** Same chip, same place,
  labelled by what it is currently doing. Night is a second override mixing
  toward 0 exactly as day mixes toward 1, through the same
  `DAY_OVERRIDE_FADE_S`. **Mine** as to the shape — a cycle on one chip over
  two chips, because the circular surface is the non-negotiable and a second
  chip spends scarce arc on the same concept.
- **Hard Stop, answered:** `prefs.day` is a stored boolean and its meaning must
  not change. **A new field** `skyOverride: 'auto' | 'day' | 'night'` is added
  (the safe half of the rule); `day: true` is read once as `'day'` for
  migration and the old field is left in place, exactly the shape `gravity`'s
  own addition followed. A stored `day: true` therefore behaves identically
  before and after.
- **The clock can snap; the override fade never covers it.** `skyDaylight` is
  assigned directly from `skyFor(new Date())` once a second — a DST jump, a
  timezone change in flight, or a tab resumed hours later lands as a one-frame
  step in `uDay`, and the 1.2s fade smooths only the *chip's* transitions.
  Chase the sampled value at a bounded rate (full-scale over ~3s) instead of
  assigning it. Three lines, and the once-a-second cadence stops being visible
  at the boundary between samples on a long dawn as well.
- **Warmth at night is dead weight, and stays dead** → the ground is scaled by
  `uDay`, so the "coolest in the small hours" anchor value is multiplied by
  zero all night. Reviewed and left alone deliberately: tinting the night
  picture from the clock would repaint the palette entries 58 and 70 own, and
  the anchor is still worth keeping correct for the hours where it shows.
- Not touched → the geolocation refusal, the 1-second sample, the pure-function
  boundary, and `probe-sky.ts`'s role as the scrubber. All right as they are.

**Lands in**
- `src/sky.ts` — the `ANCHORS` table grows to six for daylight; warmth keeps
  its four.
- `src/scene.ts:555-570, 904-925` — the night override joins the day one; the
  chased `skyDaylight`.
- `src/hud.ts:906` — the chip cycles and says which state it is in.
- `src/prefs.ts` — `skyOverride` added beside `day`, with the migration read.
- `scripts/probe-sky.ts` — the plateau (10:30-15:30 ≥ 0.999, 23:00-04:00
  ≤ 0.001) and the mid-band's total width.

**Done when** — a full-day scrub shows real night until 04:00, real day from
10:30, and no more than ~5 of 24 hours between 0.1 and 0.9; the chip reaches
night-at-noon in two taps and back to auto in one more; a DST-sized clock jump
takes ~3s on screen rather than one frame; and a stored `day: true` from before
the change still lands in forced day.

**Correction, entry 108, 2026-09-04** — the "~5 of 24 hours" line above was
unreachable from this entry's own **Decided** anchors: 04:00/23:00 and
10:30/15:30, smoothstepped, produce 9.95 hours of mid-band, not ~5 — the two
sections were written in the same sitting and disagreed with each other, and
`probe-sky.ts`'s check 4 asserted `< 11`, loose enough to pass at the real
number, so nothing caught it before `/ccc` did at build 355. Entry 108 re-times
the same six anchors (dawn/dusk spans shortened from ~4 hours each to 1.5) for a
measured 4.90 hours, tightens the probe's threshold to 5.2, and this line is
now genuinely met rather than merely unflagged.
**Verify** — `probe-sky.ts` for the curve and the migration; the phone across
an actual evening for whether 10:30/15:30/23:00/04:00 are the right hours,
which a probe cannot answer and the original anchors' own comment ("settled by
eye") already concedes.
**Hard stops** — prefs **yes — a new field only**, `skyOverride`, with
`day: true` migrated on read and never rewritten; the existing field's type and
meaning are untouched · url no · capture no · dependency no.

### 74. Paper: true white, true black, and ink that takes or doesn't
`status: blocked` · added 2026-08-30 · build after 68

**Blocked 2026-08-30 — needs Victor's decision, and must not be built
meanwhile.** Entries 68 and 70 shipped (builds 229 and 234) and the result was
approved: *"both ways has good colours, finally, don't break it."* This entry
is the **only** pending work that touches the constants that approval is about
— it would move `PAPER` 0.88 → 0.97, `INK` 0.10 → 0.03 and add a
`pow(density, 0.7)` curve, in a composite that now lays ink in HSL with warmth
at ±0.10.

The decision needed is not "is paper a good idea" — it was asked for
explicitly, and the body below still holds. It is **whether whiter paper and
blacker ink are wanted now that the shipped middle looks right**, since those
are the same numbers being praised and the entry was written before anyone had
seen them working.

Do not build this on inference from the original request. It needs one look at
the two side by side, and the honest possibility is that the answer is no and
this entry is closed unbuilt.

**Do** — take entry 68's ink model and push it to actual paper: a white ground,
near-black marks, and a density curve so thin marks read as ink rather than as
grey.

**Why** — asked for directly, and it goes further than entry 68's numbers.
68 is being built now with a 0.88 ground and 0.10 ink, which were **Mine** and
are hereby overridden: Victor wants paper, and paper is white.

**Decided**
- **This does not touch entry 68**, which is `building`. Everything here is a
  change of values and one curve on the mechanism 68 ships. Build 68, then
  this. Nothing in 68's design is being revisited — the density/colour split,
  the ink leading the paper through dawn, and the `(1 − uCameraMix)` retirement
  all carry over exactly.
- **Ground 0.97, ink 0.03.** A range of 0.94 against night's ~1.0, where the
  measured original was 0.15. **Not pure 1.0/0.0**: a ground at exactly 1.0
  cannot show a highlight and clips anything the vibrance stage (entry 70)
  lifts, and ink at exactly 0.0 loses the hue that entry 68's colour split
  exists to preserve. Three percent at each end is the difference between
  paper and a clipped scan.
- **Ink takes or it doesn't** → `density = pow(density, 0.7)` before it is
  laid. Real ink is not linear: a mark is either on the page or the page is
  bare, and the interesting part is how quickly it commits. The plain linear
  density leaves every thin mark as mid-grey, which is exactly the "anaemic"
  reading in a paper palette. **Mine**, and 0.7 is a starting point the
  acceptance floor below can move.
- **The paper is warm, not blue-white.** Entry 53's `uSky.y` already carries
  warmth and entry 71 keeps it; at 0.97 it should read as cream at dawn and
  dusk and near-neutral at noon. Real paper is warm and a blue-white ground is
  the thing that makes a screen look like a screen. Entry 68 widened the tint
  to ±0.10 for the same reason and that value stands.
- **Camera off only**, as asked, and it is already true: 68 scales the whole
  ground by `(1 − uCameraMix)`, so a real room is never papered over. Restated
  here because "when camera off" is in the request and a builder should not
  have to go and check.
- **The floors move with the values.** 68 asks for ≥70% of night's tonal range
  and saturation; with a 0.94 range available that becomes **≥85% of the range**
  and the saturation floor stays at 70%, since ink laid on white desaturates
  mid-densities no matter how it is done and demanding parity there would be
  demanding something the model cannot give.

**Lands in**
- `src/shaders/composite.frag.glsl` — the two constants 68 introduces, plus the
  density curve.
- `scripts/probe-composite.ts` — the raised range floor.

**Done when** — day mode with the camera off is white paper with near-black
marks; a coloured layer reads as coloured ink rather than grey; contrast
measures ≥ 85% of the same scene at night; a warm hour gives cream rather than
blue-white; and passthrough at any non-zero mix is unaffected.
**Verify** — the same measurement entry 68 established, on the same four views,
plus a phone in real daylight. The number to watch is `p5`: it should sit near
0.03, where the original frames could not go below 0.606.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 107. Does the gate say what kiyo is aware of?
`status: done` · added 2026-08-31 · answered 2026-09-04 · build 374 · **answer reversed 2026-09-04 by 118, build 397** · the remainder of 97, reopened under the new rule

**Do** — nothing yet. This is a question for Victor, raised because entry 97
shipped without the gate copy it asked for and `CLAUDE.md`'s amended Hard Stop
3 now says a conflict like that becomes a proposal rather than a silent no.

**Why** — entry 97 (build 321) asked the gate to name that the app uses the
phone's location for the sun and the moon. It was not built: the standing rule
said the gate carries no copy about capture or privacy at all, and the build
agent read that as louder than one entry's narrower ask. **That call was
right.** What was wrong is that it ended there — disclosed in a commit nobody
was scheduled to read, with the entry marked `done`.

**The question**
> The gate currently says nothing about what the app senses. Since entries 96,
> 97 and 100 it senses the room, the hour, the sky, the moon and — with
> permission — roughly where it is. Should the gate name any of that, and if
> so, as what?

**What the answer changes**
- **Nothing.** The browser's permission prompts are the consent point, the gate
  stays as clean as build 66 left it, and 97's ask is retired as superseded by
  the standing rule. This is the status quo and it is defensible — the app is
  more present for knowing where it is whether or not it announces it.
- **One line of awareness.** Not a disclaimer — no "your audio never leaves
  this device", which is the thing build 66 removed and which stays removed.
  Something in the app's own register, naming a sense rather than a policy:
  *"listens · knows the hour · follows the moon"*. It reads as the piece
  describing itself, which is what the amended clause now permits.
- **Awareness that answers.** The same line, but live: it names only what is
  actually available on this device right now, so a phone that refused location
  simply does not claim to know where it is. More honest, more work, and the
  only version that could be wrong in front of someone.

**Decided in advance, so the answer is a single choice and not a design
session**
- Whatever the answer, **no promise-shaped sentence appears on the gate.** The
  ban on reassurance copy is unchanged by this entry and is not up for review
  here.
- If it is a line, it goes in the app's voice and at the gate's existing type
  scale — no new band, no icon row, no second paragraph. **Mine.**
- If the answer is "nothing", this entry closes as `done` with the answer
  recorded, so nobody proposes it a third time.

**Lands in** `index.html` — the gate copy, and nothing else, whichever way it
goes.
**Done when** — Victor has answered, and the answer is written here.
**Verify** — on the phone, at the gate, in daylight, if there is anything to
see at all.
**Hard stops** — prefs no · url no · capture **yes, and that is the entire
point of the entry** · dependency no.

**The answer, 2026-09-04 — Victor's call.** One line: **"i am"**. Not the
fuller *"listens · knows the hour · follows the moon"* sketched above — just
the app naming its own presence, in two words, in its own register. No
disclaimer, no list of senses, no live/available-only-if-granted logic: the
plainest of the three options on offer.

**The answer again, later the same day — Victor's call, and it reverses the
one above.** *"don't need the text 'i am' on the opening page."* So the answer
is the first of the three options this entry sketched: **nothing**. The gate
names no sense at all, and stays as clean as build 66 left it. Entry 118 takes
the line back out, at build 397 — so the line was shipped at 374, seen on
screen, and removed three hours later, and the absence is a decision with a
build number on either side of it rather than a gap waiting to be filled. Recorded here rather than only in 118 because this entry's
own closing condition says the answer must live where the question was asked —
it has been raised twice already, and nobody should raise it a third time
without reading that it was tried on screen and taken off again.

### 108. The sky's crossover is twice as long as entry 71 promised
`status: done` · added 2026-08-31 · answered 2026-09-04 · build 376 · found by `/ccc` at build 355

**Do** — move `DAYLIGHT_ANCHORS` to dawn 05:30/07:00/08:30 and dusk
17:45/19:30/21:45, and make `probe-sky.ts` assert the crossover *duration*
tightly enough to have caught this.

**Why** — entry 71 set out to stop the picture spending most of the day in a
grey between-state. Its own **Done when** says *"no more than ~5 of 24 hours
between 0.1 and 0.9"*. Measured on the shipped build, scrubbing `skyFor()`
minute by minute through a full day: **9.95 hours.** The entry's Done-when is
not met and never could have been.

**The finding, precisely**
- **The build is not wrong. The entry is internally inconsistent.** `probe-sky`
  asserts all six anchors land exactly, and they do: 04:00→0.0, 06:30→0.35,
  10:30→1.0, 15:30→1.0, 19:30→0.4, 23:00→0.0. Those are the anchors entry 71's
  own **Decided** section names, hour for hour. The builder implemented
  precisely what was decided.
- **Those anchors cannot produce that number.** 04:00→10:30 is six and a half
  hours of rising and 15:30→23:00 is seven and a half of falling; smoothstepped,
  the part of that lying strictly between 0.1 and 0.9 is 9.95 hours. Decided
  and Done-when were written in the same sitting and disagree with each other,
  and nothing checked one against the other — the probe asserts the *anchors*,
  which is the easier claim and the one that passes.
- **It is still a large improvement, which is why nobody noticed.** Before 71
  the figure was ~16 hours, and the entry's own recon measured that. 9.95 is a
  38% reduction and the picture visibly has a noon and a night now. The claim
  that failed is the *degree*, not the direction.

**The answer, 2026-09-04 — option B with a lingering dusk. Victor's call.**
Dawn 05:30/07:00/08:30, dusk 17:45/19:30/21:45. Measured on that table:
**4.90 h crossover**, night held 9.02 h, day held 10.08 h — against the
shipped 9.95 / 7.02 / 7.03. Day and night become states you sit inside for
the better part of ten hours instead of instants between two long smears.

**What the answering recon added, and it is the part that settles the size of
the move.** `skyForLocation` (`src/sky.ts:320`) does not use this table at
all: for anyone who has granted location it maps daylight from real solar
altitude across civil twilight, ±6°. Scrubbed minute by minute, that path's
own crossover is **0.98 h at the equator, 1.28–1.50 h at NYC, 1.57–2.03 h at
London, 2.23–5.70 h at Reykjavík**. So the app already spends one to two hours
a day in crossover for most of the inhabited world, and the clock fallback was
spending ten. The fallback had drifted five-fold from the thing it is a
fallback for, and that — not the entry's own arithmetic — is the real argument
for shortening it.

**Why not go all the way to the real sun's ~2 h.** That table was measured too
(06:00/06:45/07:30 and 19:00/19:45/20:30 → 2.12 h) and is the wrong move, for a
reason specific to *this* curve: the clock fallback is known to be wrong about
the hour — the file's own opening comment says it will call 2am night in
Reykjavík in June. A soft transition hides that error; a sharp one advertises
it, giving a decisive dawn at a visibly wrong time. **The fallback should be
gentler than the real path on purpose**, and roughly double is the right amount
of gentle.

**Decided**
- Ten hours or five → **five, taken as the ~4.2 h option B rather than the
  ~5.6 h option C.** Over keeping the shipped curve, which was the safe answer
  and the one "don't break it" pointed at. Victor's call, made against the
  three costed tables and the solar measurements above.
- Symmetric or lingering → **lingering dusk.** Dawn keeps option B's 3 h
  (05:30→08:30); dusk is stretched to 4 h (17:45→21:45), which is what takes
  the figure from 4.22 h to 4.90 h. Over the symmetric 3+3. Victor's call:
  evenings feel longer than mornings do, and the curve should say so.
- Are the approved colours at risk → **no, and this is why the entry can be
  built at all.** Only anchor *hours* move; every daylight *value* on the curve
  is one already on screen and already approved, and `WARMTH_ANCHORS` is not
  touched. **Mine**, because entries 68 and 70's approval is about what each
  end looks like, and this changes only how long each end lasts.
- What happens to `Sky.slope` and its one reader → **nothing needs
  recalibrating.** Peak slope rises 0.244 → 0.650 daylight-units per hour, but
  `PEAK_DAYLIGHT_SLOPE` in `engine/celestial.ts:78` is computed at module load
  by scrubbing this very curve, so `sunRateFor` stays normalised 0–1 by
  construction. What changes is that the sun's restlessness concentrates into
  the dawn and dusk hours instead of smearing across the day — the same
  improvement, appearing free in a second place. **Mine**, because it is a
  measurement, not a taste call.

**The correction this entry owes.** Its own **Lands in** said `probe-sky.ts`
needed "an assertion on the crossover *duration*, which is the check nobody
wrote". **That was wrong.** Check 4 at `scripts/probe-sky.ts:140-150` *does*
assert exactly that — `midBandHours < 11` — and it passed at 9.95 h because
the threshold was set loose enough to accommodate what had been built. The
check was written; its number was chosen to pass rather than to hold the
entry's promise. That is a worse failure than an absent check and the reason
this must not close by simply loosening it again: **the new threshold is
5.2 h**, sized to the 4.90 h the chosen table actually produces, so any future
drift of more than a few minutes fails the gate.

**Two existing probe checks fail on the new table and must be repaired, not
deleted** — both measured, both consequences of the transitions being steeper:

- **Check 2, `scripts/probe-sky.ts:78`** — "no per-minute daylight jump" asserts
  `maxDaylightStep < 0.01`. The new peak per-minute step is **0.01083, at
  07:44**. Raise the threshold to **0.015**. That 0.01 was never a perceptual
  limit: it was headroom over the *old* curve's peak of 0.00407, and 0.015
  keeps a comparable ratio over the new peak while still catching a genuine
  discontinuity. **Mine**, because the check's purpose is "no corner", and its
  number was always relative to whatever curve was shipped.
- **Check 5's second half, `scripts/probe-sky.ts:165-170`** — the
  anchor-straddling control asserts a ±5 min window across the 10:30 anchor
  moves less than 0.001. Across the new 08:30 anchor the same window moves
  **0.00580**, because the anchor now joins two short segments instead of two
  long ones. **Make the check relative rather than absolute**: assert the
  straddle is less than a tenth of the mid-transition delta measured beside it
  — 0.00580 against 0.10789 at 07:45 is 18.6×, so it passes with margin, and
  the check keeps its actual meaning (an anchor is flat *compared to* the
  middle of a segment) instead of depending on a constant that only held while
  the segments were four hours wide. **Mine**, over narrowing the window to
  ±1 min, which passes at 0.00024 but quietly weakens what is being claimed.

**Decided in advance, and unchanged by the answer**
- **The warmth anchors are untouched.** 71 said that curve was already right
  and left it alone; nothing here disagrees.
- **This does not reopen PAPER, INK or the vibrance lift.** Those are frozen
  (entries 68 and 70, build 234) and the crossover's *length* is independent of
  what either end looks like. **Mine.**
- **`skyForLocation` is not touched.** The real-position path is the standard
  this entry measured against, not a thing to bring into line with it.
  **Mine.**

**Lands in**
- `src/sky.ts:73-80` — `DAYLIGHT_ANCHORS`, the six hours only. Its comment
  above (`:64-72`) names 04:00/23:00 and 10:30/15:30 as the held ends and calls
  the hours "settled by eye"; that comment must be rewritten to the new hours
  and to *why* they are what they are, or it becomes exactly the kind of
  expired justification CLAUDE.md warns about.
- `src/sky.ts:26-35` — the file header's own paragraph claiming "the crossover
  is what it should be: an event, not most of the day". That sentence has been
  false since it was written, by a factor of two. It becomes true with this
  build; make it carry the measured number so it cannot go stale silently.
- `scripts/probe-sky.ts:30-35` — the daylight anchor table in check 1.
- `scripts/probe-sky.ts:96-115` — check 3's plateau and floor windows:
  day 10:30–15:30 → **08:30–17:45**, night 23:00–04:00 → **21:45–05:30**.
  Both verified to hold exactly on the new table (plateau min 1.000000, floor
  max 0.000000).
- `scripts/probe-sky.ts:140-150` — check 4's threshold, 11 → **5.2**.
- `scripts/probe-sky.ts:78` and `:165-170` — the two repairs above.
- `scripts/probe-sky.ts:158-162` and `:176-178` — checks 5 and 6 sample
  08:25/08:35 and 08:30/10:30 as "mid-dawn" and "at an anchor". Mid-dawn is now
  **07:45** (delta 0.10789 across ten minutes) and the anchor is **08:30**.

**Done when**
- `skyFor` scrubbed minute by minute over 24 h spends **4.90 h ± 0.05** with
  daylight strictly between 0.1 and 0.9, and `probe-sky.ts` asserts it against
  **5.2 h**, not 11.
- Night is held at ≤0.001 for at least 9 h and day at ≥0.999 for at least 10 h,
  asserted over the new windows rather than only at their edges.
- `pnpm probe:sky` passes with every check repaired rather than removed, and
  the count of checks does not go down.
- Entry 71's **Done when** carries a line recording that its "~5 of 24 hours"
  was unreachable from its own Decided anchors, that the figure is now met by
  this entry, and that the gap survived because check 4's threshold was sized
  to pass.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:sky`. Then the picture:
`views-probe.html` at a few scrubbed hours to confirm no colour moved, since
only hours were meant to. No HUD surface is touched, so the 320×568 / 360×640
pass is not required here. Finally, if it can be had, the phone across an
actual dawn — the only test of whether a crossover reads as an event, and the
one thing no probe can answer.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 109. Camera mode ends when you put the phone down, not when a clock runs out
`status: done` · added 2026-09-02 · build 372 · follows the build-369 fix · **gap found at build 373, fixed by 120 at build 420** — the arm died after 15s on any device with no motion data

**Do** — replace the armed mode's wall-clock timeout with one that reads
whether the phone is still being held and aimed, and make the expiry visible
when it does happen.

**Why** — reported: *"the photo mode doesn't work"*. The immediate cause was a
10-second window that expired silently while the person was still framing, and
that is fixed at build 369 by raising it to 60s. This entry is the part the
number cannot fix: **a clock is measuring the wrong thing.**

**Decided**
- **The timeout's real job is "this was forgotten", and a clock is a poor
  proxy for it.** Sixty seconds is generous enough for most shots and still
  arbitrary: it expires on someone lining up a long exposure of a stage, and
  it keeps the mode armed for a phone that went into a pocket at second three.
  The app already measures the difference — entry 90's posture classifier
  distinguishes **still**, **carried**, **driving**, **dancing** and
  **handled**, and `shake.ts` has `disturb` continuously.
- **So: the arm persists while the posture is `handled` or the phone is
  plainly being aimed, and expires after a short quiet period once it is
  not.** A phone held up and moving is someone composing; a phone flat and
  still for fifteen seconds, or in a pocket, is someone who has moved on.
  **Mine**, and the shape is entry 90's own "it reads, it never writes".
- **Keep an absolute ceiling anyway.** Five minutes, whatever the posture, so
  a phone propped up and vibrating on a table cannot hold the mode open
  indefinitely. A rule with no bound is how the director latched shut (entry
  89) and the lesson transfers. **Mine.**
- **The expiry stops being silent, and this reverses entry 87 deliberately.**
  87 chose a quiet disarm because "the person has stopped looking, and forcing
  the menu back open over whatever they moved on to would be its own
  surprise". That was correct when a late tap still saved a frame — the
  expiry was unobservable *and* harmless. Since entry 103 a late tap does
  nothing at all, so the silence now hides a real failure. **The glyph should
  fade out visibly rather than vanish between frames**, which is a signal
  without being an interruption: it does not reopen the menu, so 87's actual
  objection is untouched.
- **Not decided here** → whether arming should survive a backgrounded tab.
  Related, separate, and needs the `visibilitychange` behaviour entry 73
  established to be thought about properly.

**And the process finding, which is the more useful half**

This fault existed because **two entries that are each correct do not
compose**, and nothing in the system looks for that. 87 and 103 were both
verified clause by clause by `/ccc` in the days before this was reported, and
both passed, because neither entry's **Done when** mentions the other. 87's
window was chosen against an assumption — *a late tap still saves* — that 103
removed without knowing it was load-bearing anywhere.

- **`/ccc` should read the entries a change supersedes.** 103's own Decided
  says it supersedes tap-to-save "and both reports close at once"; what it did
  not do is ask which *other* entries relied on the behaviour being removed.
  A grep for the removed mechanism's name across `docs/built.md` would have
  found 87's dependence on it in one read.
- **Camera mode has no probe and cannot have one as written.** It lives in a
  `main.ts` closure with DOM handles and `window.setTimeout`, so nothing
  headless can reach it. Every fault in it has been found by a person using
  the app. Extracting the arm/disarm state machine as a pure module — the
  `shake.ts`/`emitter.ts` pattern, state plus a pure update taking `now` —
  would make this entry's own rules testable and is most of its work.

**Lands in** `src/engine/camera-arm.ts` (new — pure state, pure update over
`now`, posture and `disturb`); `src/main.ts:1040-1075` — `enterCameraMode` and
the timeout give way to it; `index.html` — the glyph gains a fade-out;
`scripts/probe-camera-arm.ts` (new), which is the first probe this feature has
ever had.
**Done when** — a simulated trace of a phone held and moving keeps the mode
armed past 60s; the same trace going still expires it after the quiet period;
neither exceeds the five-minute ceiling; the glyph's disappearance is visible
rather than instantaneous; and taking a photo still exits immediately as entry
87 requires.
**Verify** — the probe for the state machine, which is the point of extracting
it. Then the phone: arm it, spend a slow minute framing something, and take
the picture — which is the gesture that was reported broken and the only test
that matters.
**Hard stops** — prefs no · url no · capture **yes, and it narrows**: the mode
that saves becomes harder to leave armed by accident, never easier ·
dependency no.

### 110. Strata: the picture is sand between two panes of glass
`status: done` · added 2026-09-04 · build 386 · **reverted by 131** — the sand was a misreading of "take inspiration from those sand art frames", which was about the dynamics, not a picture. Kept in the file as the record of it. · **reverted by 131 — the view was a misreading of the ask; see 132 for what was meant**

**Do** — add an atmospheric view, **Strata**, in which the audio pours coloured
sand from whichever edge is up, the grains sift down under the phone's own
in-plane gravity and pile in layers along whichever edge is down; laid flat,
nothing falls — the pile holds and new grains hang as dust until the phone is
raised again; turned over, the pile becomes the source and rains back down.
**Why** — the app already measures which way is down and uses it three times
(entries 30, 61, 102), and every use is a *nudge*: the picture slides a little,
an emitter drops, powder skids. None of them makes lying-flat and held-upright
*different pictures*. A sand-art frame does exactly that with nothing but
gravity, and it is the one toy whose entire behaviour is "what angle am I at".

**What the recon settled, and it overturns the ask's own premise.** Victor asked
to *"use the axis detection"* — the `gravZ` component `shake.ts:370` keeps and
never exposes. **It is not needed, and must not be used here.** Three built
entries already reached this fork and decided it the same way; `built.md`'s
record of entry 102 is the clearest: *"Phone upright: that projection is the
full vector and things fall. Phone flat on a table: the vector points into the
screen, its in-plane length is zero, and the emitter stays exactly where it
was put — not by a rule saying so, but because there is nothing pulling it
… **A mode flag here would be strictly worse than the physics.**"* Flat-versus-
vertical is *already the physics* of the in-plane pair `shake.tilt()` returns:
`(0, 0)` flat, unit length vertical, every angle between correct for free, and
a sideways or upside-down phone handled with no case for it. `gravZ` would
only add face-up versus face-down, and a sand frame lying on its face behaves
exactly like one lying on its back. **Decided against, on that reasoned
record.**

**A naming trap the builder will fall into unless told.** `uTilt` in
`caustics`, `cells` and `aurora` (`scene.ts:573`, default 0.5) is *spectral*
tilt — bass-versus-treble balance — and has nothing to do with the phone. The
phone's tilt reaches `scene.ts` only through `setMotion(tiltX, tiltY,
disturb)` (`:364`, `:1495`), where it currently feeds a colour bias and
nothing else; **no fragment shader has ever received the phone's tilt.** This
entry does not change that: the tilt is consumed in TypeScript by the sediment
model below, and what the shader receives is the resulting picture.

**Decided**
- A new view, or gravity applied to the existing picture → **a new atmospheric
  view.** Over a composite-level "sift" that would let any view's pixels fall
  and pile. **Mine**: the second modifies every approved picture at once —
  Victor's *"both ways has good colours, finally, don't break it"* covers all
  of them — and needs a feedback render target `scene.ts` does not have; the
  first is additive, costs the other fourteen views nothing, and matches
  `views.ts`'s own rule that *"adding one is a file plus a line here."* The
  identity when off is therefore total: a view not selected draws nothing.
- Where the state lives → **a pure-state module, `src/engine/sediment.ts`,
  uploaded as a `DataTexture` — the shape `uHistory` already is.** Over
  simulating in the shader with a ping-pong target. **Mine**: `views.ts`
  says a view is *"nothing but a fragment shader plus a label"* and that the
  constraint is deliberate; a view with its own render target breaks that for
  everyone. The spectrogram already accumulates its state in TypeScript
  (`historyTexture`, `scene.ts:550`) and hands it over as a texture, so this
  is the second tenant of an existing pattern, not a new one. It is also what
  makes the model probeable headless, which a shader never is.
- The model → **a falling-sand cellular automaton on a fixed low-resolution
  grid, colour per cell.** Over a heightfield (a pile along one edge as a 1D
  profile), which cannot be turned over — the whole point of a sand frame is
  that flipping it makes the pile the source, and a profile has no way to
  fall. **Mine.** Entry 61 wrote *"a cellular-automaton sand model this entry
  is deliberately not"* about the powder egg's pile; that was a scope line for
  that entry, not a rule for the project, and this entry is exactly that
  model on purpose. Grid **96 cells across the short side**, the long side by
  aspect (≈170 tall in portrait: ~16k cells, one pass a frame, trivially
  cheap in TypeScript; the upload is ~64 KB a frame, less than the spectrum
  ring already moves).
- Which way is down, on a square grid → **the dominant in-plane axis of
  `tilt()`, with the minor component's sign choosing which diagonal a blocked
  grain slips to first.** Portrait, landscape, upside-down and every diagonal
  hold fall out of that: a phone leaned to the left builds its pile in the
  bottom-left corner rather than flat along the bottom. **Mine**, over
  rotating the grid into the gravity frame, which makes the flip continuous
  but the pile's own cells shear on every re-sample.
- What "flat" is → **in-plane magnitude below `0.2`** — the same `AIM_TILT_MIN`
  `camera-arm.ts:33` already uses for "flat, not held up", about 11.5°, so
  the app has one notion of flat. **Mine.** Below it, **landed grains do not
  move at all** (sand lying flat stays where it lies); **airborne grains lose
  their fall and take a random walk** instead, at about a cell every 0.25 s,
  and never land. Raising the phone drops every one of them at once — the
  reward for picking it up, and the reason the dust exists at all.
- What pours, and where → **each spectrum band is a source along the up
  edge, bass at one end, treble at the other, emitting grains in proportion
  to its energy.** Over a single central pour. **Mine**: the pile's *shape*
  then becomes the long-run spectrum of whatever has been playing and its
  *layers* become the history, which is the spectrogram's whole idea rotated
  ninety degrees and given weight. Reads `uSpectrum`'s own bands; no new
  analysis.
- Grain colour → **the atmospheric layer's colour, shifted by spectral tilt
  at birth** — darker and warmer for a bass-heavy moment, lighter and cooler
  for a bright one, ±0.08 in lightness and the same magnitude in hue, both
  chosen so a track with changing texture writes visible strata and a steady
  one writes a plain pile. **Mine** on the magnitudes; the layer colour as
  the base is the only choice consistent with every other atmospheric view.
- Pour rate → sized so a loud passage fills about **a fifth of the frame in
  ninety seconds** of continuous vertical play, and silence pours nothing.
  **Mine.** Faster and the frame is full before a song ends; the frame filling
  is not a failure — see the next line — but it should take a whole side of a
  record to get there.
- A full frame → **the pile simply stops growing**; new grains that find no
  room are dropped. Nothing fades, nothing scrolls. **Mine**: a sand frame
  that has all its sand at the bottom is finished, not broken, and the person
  turns it over — which is the gesture this entry exists for. The turn-over is
  also the only reset there is; no tap, no shake clears it (a shake still
  disturbs the picture through `uTumble` like every other view — that is
  untouched and needs nothing here).
- No motion data at all (desktop; iOS with the sensor refused) → **assume
  portrait-down**, `g = (0, 1)` in screen space, rather than `(0, 0)`. Over
  the refusal-is-behaviour answer of letting the view hang as dust for ever.
  **Mine**: a view that can never do anything on a laptop is not a smaller
  feature, it is an inert one, and portrait-down is what a phone in a hand
  almost always is. The condition is *no `devicemotion` sample has ever
  arrived*, which is the `samples` count `hud.ts:1507` already prints as
  `motion N ev`. The camera-arm expiry fault found at build 373 (armed mode
  dies in 15 s on any device with no motion data — not yet an entry) needs
  the identical test, so **expose it once from `shake.ts`** and let that fix
  read it when it is written.
- Gated by `prefs.gravity`? → **No.** Over sitting behind the `grav` chip like
  entries 30 and 102. **Mine**: those are gated because they move an approved
  picture; here the falling *is* the picture, and a Strata that ignores
  gravity has nothing left to show. Selecting the view is the consent.
- Frozen while backgrounded → the model advances only when `render()` runs,
  so a tab in the background does not fill or dissolve anything while unseen.
  Falls out of where the tick lives; no timer of its own. **Mine.**

**Lands in**
- `src/engine/sediment.ts` — new: `createSedimentState(w, h)`, `updateSediment
  (state, dt, tiltX, tiltY, bands, colour)`, pure, no DOM, no clock; the
  eighth pure-state module beside `posture.ts`, `camera-arm.ts`,
  `motion-bias.ts`.
- `src/shaders/strata.frag.glsl` — new: samples the sediment texture with
  soft cell edges, nothing else. Reads no audio uniforms itself — the
  pouring already happened in TypeScript.
- `src/views.ts:90-133` — one line in `ATMOSPHERIC_VIEWS`, the eighth.
- `src/scene.ts` — a `uSediment` `DataTexture` beside `uHistory` (`:550`,
  `:585`) and a per-frame `updateSediment` call in `render()`, fed from
  `motionTiltX/Y` (`:1496`) which are already there — no new setter from
  `main.ts`, the same "no new plumbing" shape entries 76 and 104 used.
- `src/shake.ts` — expose whether any motion sample has ever arrived, for the
  portrait-down fallback; written to be shared with the camera-arm fix above.
- `scripts/probe-sediment.ts` — new, and `package.json`'s `probe:sediment`.
- `views-probe.html` — Strata renders beside the other seven from the same
  synthetic audio, per CLAUDE.md; this is where "looks like sand, not like a
  bar chart" is judged.

**Done when**
- Headless, from empty: 90 s of synthetic loud audio with `tilt = (0, 1)`
  fills **18–22 %** of cells, all of them landed, none above a cell with
  nothing under it; the pile's column heights correlate with the synthetic
  band energies (bass-heavy input → the bass end of the pile is taller).
- Then `tilt = (0, 0)` for 60 s: **the landed count does not change by a
  single cell**; airborne grains present at the flip are still airborne and
  have all moved.
- Then `tilt = (0, -1)`: within 10 s at least 90 % of the previously landed
  grains are landed again against the opposite edge.
- `tilt = (0.7, 0.7)`: the pile's centre of mass sits in the corresponding
  corner, not along an edge.
- `tilt = (0.1, 0.1)` (below the flat threshold) behaves as `(0, 0)`.
- With the no-motion flag set and `tilt = (0, 0)`, grains fall as if `(0, 1)`.
- A frame at 96×170 with 16k cells updates in under **2 ms** in the probe.
- In `views-probe.html`, Strata is visibly banded after the synthetic run and
  no other view's output has changed by a pixel.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:sediment`, then
`views-probe.html` looked at, then the phone: hold it up, watch it pour; lay
it on the table, watch the dust hang; turn it over. The HUD is untouched — the
view arrives in the existing atmospheric band — so the 320×568 / 360×640 pass
is not required, but the band should be opened once to confirm the eighth
option seats under the notch.

**Hard stops** — prefs no (a new value on an existing validated enum, as
Fringe and Rose were) · url no (`?atmospheric=strata`, a new value not a new
parameter) · capture no · dependency no. The control surface is unchanged.

### 111. The slip goes further, and further still when the phone has been moving
`status: done` · added 2026-09-04 · build 392 · unfreezes 76

**Do** — raise the RGB slip's cap, put a response curve on its target so
ordinary handling reaches a visible fraction of that cap, and let the cap
itself stretch with how much the phone has been moving lately.

**Why** — the effect is built, correct and passing its probe, and Victor's
report is that it "doesn't appear strong". It isn't: at a nudge it is 3.3px of
total red-to-blue separation on a 1080px phone, along the same axis the tumble
is simultaneously sliding the whole picture 59px down.

**The freeze is lifted, by name.** Entry 76 is `done · FROZEN` and says the
four constants are "not to be retuned… If a future request wants the effect
changed, that is a new entry with Victor's word in it, not a tweak." This is
that entry, and the word is: **"make it stronger, also can you detect ongoing
motion then it should stretch further"** (2026-09-04). `MAX_SLIP` and the
target curve are in scope. `STIFF = 400` and `DAMP = 14` are **not** — the
ζ 0.35 overshoot is what "flicks apart and bounces back" means and nothing in
the request is about the spring's feel.

**Decided**
- **How much stronger, and why the old ceiling was mis-calibrated** → `MAX_SLIP`
  0.006 → **0.010** uv. **Mine**, and this is the load-bearing recon finding:
  entry 76 justified 0.006 as "about two to four pixels on a phone… past a few
  pixels line art stops looking dispersed and starts looking broken." Entry 104
  then measured it and found the *comment* wrong, not the geometry — 0.006 uv
  is 6.5px per channel, **13px total**, because the compositor's `uv` spans the
  full frame width. So the "broken" ceiling was never tested at 3–4px; the
  approved-and-liked picture has been sitting at 13px the whole time, and the
  argument that 13px is the limit is an argument that was actually made about a
  number three times smaller. 0.010 uv is 21.6px total at the cap — a real
  increase, still under twice what has already been looked at and approved.
- **A curve on the target, not only a bigger cap** → the magnitude spring
  chases `pow(disturb, 0.6)` rather than `disturb`. **Mine**, because raising
  the cap alone barely changes what anyone feels: `disturb` is
  `(mag − 1.2) / (14 − 1.2)`, so a nudge at 8 m/s² asks for 0.53 of the range
  and a hand tremor asks for nothing at all. The exponent front-loads exactly
  the small-`disturb` regime ordinary handling lives in — the same shape and
  the same reason `shake.ts`'s `busyness()` takes `sqrt(calm)` — without
  touching `FLOOR`, which is what keeps a phone lying on a table at zero.
- **"Ongoing motion" is `busyness()`, which already exists** → the cap becomes
  `MAX_SLIP + busyness * SUSTAIN_SLIP`, with `SUSTAIN_SLIP = 0.010`. **Mine**,
  over inventing a second slow envelope inside `rgb-slip.ts`: entry 88 already
  built precisely this signal — `calm`, an EMA of `disturb` at `CALM_TAU = 25s`,
  read as `sqrt(calm)` — for the adaptive shake bar, and a second one at a
  different time constant would drift from it and give the app two disagreeing
  opinions about how busy the phone is. It is `shake.ts:502`, currently
  `private`.
- **The stretch holds during a shake rather than compounding** → `updateCalm`
  freezes while a detection is in progress or cooling down, and that freeze is
  inherited unchanged. **Mine**: the request is that *ongoing* motion stretches
  the slip, and a gesture inflating its own cap mid-gesture is the same
  self-eating fault entry 88's freeze was written to prevent.
- **Exposed as a per-frame fact, not a clearing accessor** → `busyness: number`
  joins `ShakeFrame` (`shake.ts:900`) beside `disturb`, `Tumble.busyness()`
  becomes public, `STILL_FRAME` reports 0, and it reaches the shader path
  through `setMotion`'s existing call in `main.ts:1627` gaining a fourth
  argument. **Mine** — it is exactly as much a per-frame fact as `disturb` is,
  and `ShakeFrame`'s own comment is explicit that non-clearing per-frame values
  belong there so two watchers see the same reading.
- **The whole magnitude stays in `rgb-slip.ts`** → `updateRgbSlip` gains a
  `busyness` parameter and computes its own cap; `MAX_SLIP` keeps its name and
  its export so `engine/index.ts:80` and the probe are unchanged in shape.
  **Mine**, over computing a cap in `scene.ts` and passing it in — `scene.ts`
  accumulating analysis is the specific drift CLAUDE.md's refactor rule names.
- **Direction, spring feel and the still-phone identity are untouched** → the
  held direction, `PEAK_RATIO`, `PEAK_TAU`, `STIFF` and `DAMP` are all entry
  104's and entry 76's and stay exactly as they are.

**Identity when off** — exactly nothing changes on a still phone, and it falls
out of the maths rather than a guard: `pow(0, 0.6)` is 0, so the spring's
target is 0, so `amount` is 0, so `magnitude` is 0 and `updateRgbSlip` returns
`{x: 0, y: 0}` before the cap is ever consulted. `busyness` at 0 leaves the cap
at exactly `MAX_SLIP`, so a device that has never moved is byte-identical to a
build with `SUSTAIN_SLIP` deleted.

**Lands in** — `src/engine/rgb-slip.ts` (the curve, `SUSTAIN_SLIP`, the new
`busyness` parameter and the cap it computes; `MAX_SLIP` 0.006 → 0.010, and its
own comment, which entry 104 has already corrected once and which must state
the new pixel figure); `src/shake.ts:502` (`busyness()` public), `:768` and
`:900` and `:833` (`ShakeFrame`, the returned frame, `STILL_FRAME`);
`src/main.ts:1627` (`setMotion` call); `src/scene.ts:838` and `:1287` (the
stored value and the `updateRgbSlip` call); `scripts/probe-rgb-slip.ts` (the
handling table, which must now be printed at three busyness levels).

**Done when** — `pnpm probe:rgb-slip`'s handling table prints, at `busyness`
0: a peak of **at least 1.8× today's** printed figure for the *nudge*
(0.00307), *jolt* (0.00368) and *sustained low agitation* (0.00171) rows; a
cap of 0.010 uv, which the probe's own pixel line reports as **21.6px total
red-to-blue separation** at 1080px wide. At `busyness` 0.5 the cap is 0.015
(32.4px) and at 1.0 it is 0.020 (43.2px). The still-on-a-table and
hand-tremor rows still print **0.00000 at every busyness level** — the curve
must not lower the floor. Entry 104's four assertions still pass unchanged:
zero direction reversals through a knock's decay up to 120 m/s², zero through
a 5 Hz, 3 Hz and 2 Hz sustained shake, a cross-aimed second hit re-aims the
axis, and every case settles back to zero.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:rgb-slip` and
`pnpm probe:shake` (the latter because `busyness()` changing visibility must
not change the adaptive bar it feeds — the walking-then-shake case is the
one that would catch it). Then the phone, which is the only place the actual
question is answered: nudge it once and look for colour on the edges, then
carry it around for a minute and nudge it again — the second nudge must be
visibly further apart than the first. No HUD surface changes, so no 320×568
pass is owed.

**Hard stops** — prefs no · url no · capture no · dependency no. The frozen
constants of entry 76 are overridden, with Victor's word quoted above and by
the mechanism entry 76 itself specifies.

### 112. The cursor is a finger, while it is moving and while it is on the glass
`status: done` · added 2026-09-04 · build 400 · independent of 110 and 111 · unlocks 114 and 117

**Do** — on desktop, let a moving mouse drive a geometric emitter at the cursor,
so passing the pointer across the canvas changes the picture; a cursor that has
left the window, or that has been parked, drives nothing.

**Why** — a desktop visit currently has no way to play with the thing at all
short of clicking. The emitter, the ripples and the whole gesture vocabulary
are already built and a mouse never reaches any of it.

**Recon: hover already reaches the code and is thrown away.** `main.ts:1233`
forwards every `pointermove` to `touchField.move()`, including hover moves with
no button down — and `touches.ts:225` drops them on the floor, because
`slots.get(id)` is empty for a pointer that never sent a `down`. So the events
are arriving; nothing is listening for them. That is what makes this small.

**Decided**
- **A separate hover emitter, not a synthesised touch** → the hover path never
  enters `touchField` at all. **Mine**, and it is the load-bearing call: making
  a hover into a real contact would give the app a finger that is *permanently
  down*, which would hold `touchAnyDown` true forever (`scene.ts:1465`), park
  the tap/double-tap recogniser mid-gesture (`main.ts:1325`), and charge to a
  full 2.5s hold within three seconds of the mouse entering the window. Every
  one of those is a regression on the touch path, bought for nothing.
- **A parked cursor goes quiet; a moving one is answered immediately** → the
  emitter is active only while the cursor has moved within `HOVER_QUIET`, and
  **1.5 seconds** is that window. This is not taste, it is
  `docs/the-toy-wants-to-be-played-with.md`'s own rule applied: *"restraint
  belongs in what persists, generosity belongs in what responds"* — a moving
  mouse is a person responding and gets no threshold and no delay, and a cursor
  abandoned on the glass is a thing changing on its own while nobody is
  touching it, which the same page says must be quiet. 1.5s is long enough that
  a pause to look does not cut the emitter off mid-thought and short enough
  that a laptop left open goes still. **Mine.**
- **It stops by going inactive, not by being deleted** → both the parked case
  and the left-the-window case set `active` false and let entry 102's afterlife
  run. **Mine**: the rings thin out over the emitter's own remaining life
  instead of stopping dead, which is exactly what a lifted finger already does,
  and it costs no new code. On desktop `emitterGravity` is zero (no
  accelerometer), so the dying emitter simply fades where it was left rather
  than falling — consistent with entry 102 rather than an exception to it.
- **A hover is quieter than a press** → `updateEmitter` gains a
  `chargeCap = 1` parameter and the hover path passes **0.35**. **Mine**, and
  it fixes a fault the naive version would have: `CHARGE_TIME` is 2.5s and
  charge only ever accumulates while active, so an uncapped hover would sit at
  charge 1.0 — *louder than any deliberate hold a finger can give it* — for as
  long as the mouse kept moving. 0.35 sits below `CHARGE_FLOOR`'s 0.6, so a
  passing cursor is quieter than the briefest tap, which is the right ordering:
  a click is still worth more than a hover. The default of 1 is what keeps
  every existing call byte-identical.
- **Speed rides along, as it does for a finger** → the smoothed cursor speed
  feeds `updateEmitter`'s existing `speed` parameter, so a fast sweep throws
  brighter rings exactly as entry 50's fling does. **Mine** — it is the same
  parameter, already there, and it is most of what "moving the mouse changes
  the image" means.
- **Its own pure-state module, `src/engine/hover.ts`** → position, smoothed
  speed and last-moved time, with `createHoverState` / `updateHover` / 
  `hoverLeft`, no DOM and no clock of its own. **Mine**: it is the shape
  `touches.ts`, `ripples.ts` and `emitter.ts` already have, it is where
  `HOVER_QUIET` belongs, and it is the only way the 1.5s timeout gets a
  headless probe instead of being tested by waiting.
- **`VELOCITY_SMOOTH` gets exported from `touches.ts:44` rather than copied** →
  the hover's speed smoothing is the same filter a touch's is, and a second
  0.3 in a second file is precisely CLAUDE.md's *"duplication that only exists
  because something was not exported"*. **Mine.**
- **Mouse pointers only** → gated on `e.pointerType === 'mouse'`, over a
  `(hover: hover)` media query. **Mine**: it is a per-event fact needing no
  query, a pen hovering is deliberately excluded (it has its own press), and a
  tablet with a mouse attached is a mouse and should work.
- **Chips are excluded, exactly as they are for touch** → the existing
  `isChip(e.target)` test (`main.ts:1202`) gates the hover path too, so running
  the pointer over the HUD does not spray rings underneath it. **Mine.**
- **No touch ring is drawn for the cursor** → the hover feeds neither
  `setTouches` nor `setTouchStream`. **Mine**: the OS already draws a cursor
  there, and a second marker under it is a duplicate, not a response. The
  emitter's rings are the feedback.

**Identity when off** — a touch-only phone never fires a `pointermove` with
`pointerType === 'mouse'`, so `present` is never true, `updateEmitter` is
called with `active: false` on a state whose `life` is 0, and it returns
without spawning. Nothing is added to any uniform and nothing changes in any
shader. The `chargeCap` default of 1 leaves all eight existing emitter slots
arithmetically identical. Idle behaviour is unchanged too — `main.ts:832`
already resumes the frame chain on `pointermove` and this entry does not touch
that listener.

**Lands in** — `src/engine/hover.ts` (new); `src/engine/touches.ts:44`
(`VELOCITY_SMOOTH` exported); `src/engine/emitter.ts:205` (the `chargeCap`
parameter and the charge line it clamps); `src/engine/index.ts` (the two new
exports); `src/main.ts:1233` (the hover branch on the existing `pointermove`
listener) and a new `pointerout` listener whose `relatedTarget` is `null`, plus
`window` `blur`, both calling `hoverLeft`; `src/scene.ts:812` (a
`hoverEmitter: EmitterState` beside `emitterSlots`), `:1184` (ticked in the
same loop), `:406` (a `setHover(x, y, present, speed)` on the interface) and
`:1461`; `package.json` (`probe:hover`); `scripts/probe-hover.ts` (new).

**Done when** — on a desktop browser, moving the mouse across the canvas spawns
rings that follow the cursor, at the same cadence a held finger gets; parking
the cursor stops new rings **within 1.5s plus one spawn interval** and the
rings already alive fade out rather than vanishing; moving the pointer off the
window stops new rings on the next frame; and hovering a HUD chip spawns
nothing. `pnpm probe:hover` asserts, headless: a hover that never moves after
entering produces exactly one active period ending at 1.5s; `hoverLeft` makes
the emitter inactive on the next tick regardless of how recently it moved; a
hover's ring birth level is **strictly below** that of a 0.1s finger tap on the
same view (charge 0.35 against `CHARGE_FLOOR` 0.6); and a hover that has never
happened leaves `updateEmitter`'s output bit-identical to a build without this
entry. `pnpm probe:emitter` and `pnpm probe:touches` must pass **unchanged** —
that is what proves the `chargeCap` default and the `VELOCITY_SMOOTH` export
changed nothing on the touch path.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:hover`, `pnpm probe:emitter`,
`pnpm probe:touches`, `pnpm probe:tap` (the recogniser this deliberately does
not feed). Then a desktop browser, which for once is the device the entry is
*about* rather than a stand-in: sweep the pointer over the canvas in each
geometric view, park it, leave the window, come back. No HUD surface changes,
so no 320×568 pass is owed — but check on a phone that touch is unaffected,
since the emitter path is shared and a touch regression here is the expensive
kind.

**Hard stops** — prefs no (deliberately not a stored toggle: a new `Prefs`
field is a hard stop and this needs none — it is on wherever a mouse exists and
absent wherever one does not) · url no · capture no · dependency no. The
control surface is unchanged; this adds no control.

### 113. The gate's name decodes ten times slower
`status: done` · added 2026-09-04 · build 402 · independent of 110–112 · the "does 15s read as deliberate" judgement is Victor's and could not be made here — see build note · **its reduced-path re-anchoring is corrected by 133**

**Do** — multiply both timing constants of the opening screen's release-name
flip by ten: `NAME_FLIP_MS` 850 → **8500**, `NAME_LOCK_STEP_MS` 55 → **550**.

**Why** — asked for. At today's numbers the whole thing is over in about 1.5
seconds, which is less time than it takes to notice it is happening.

**Recon: nothing at the landing site argues against this, and the one comment
that could have does the opposite.** `version.ts:388` — *"Never delays Start:
this only ever writes to `#release-name`'s own text, on a `requestAnimationFrame`
loop that does not block or gate anything else — the disc is live and pressable
from the very first frame, and pressing it mid-decode is not a special case, it
just leaves."* A ten-fold slowdown costs nobody anything they cannot skip. And
entry 99's *"total around 1.6s"* is not a defended number: `NAME_LOCK_STEP_MS`'s
own comment says so in as many words — *"'around', not a hard ceiling this is
tuned against."*

**Decided**
- **Both constants, not one** → phase one (the history flip, 850ms) and phase
  two (the per-character lock, 55ms a character) both go up ten times, so the
  two phases keep their present proportions and the handover still reads as one
  effect slowing into another rather than as a fast half followed by a slow
  one. **Mine** — "the flip" in the request is the whole opening animation, and
  scaling one phase alone would change its shape as well as its speed, which is
  not what was asked for.
- **The reduced-motion path is re-anchored to the same step, at 550ms a
  character** → `reducedLockedCountAt`'s hardcoded `1000 / 3` becomes
  `NAME_LOCK_STEP_MS`. **Mine**, and this is the fork the naive version gets
  wrong: today the reduced path is deliberately the *slower* one (about 3
  characters a second against 18), and slowing only the normal path would
  invert that — reduced motion would suddenly be the fast decode, contradicting
  `mountReleaseName`'s own *"`prefers-reduced-motion` gets a slower decode, not
  none."* Matching the two rates preserves the ordering by making them equal,
  and it does not weaken the reduced path's actual protection, which is that it
  **never scrambles** — it types (`.slice`, not `renderLockFrame`). 550ms a
  character is also strictly less churn than the 333ms it has today, so the
  reduced path comes out more compliant than it went in, not less.
- **The reload chip's flip is not touched** → `RELOAD_FLIP_MS` stays at 600.
  **Mine**: entry 56 gave it that number for a reason this request has nothing
  to do with — *"a confirmation in front of an action someone is already
  waiting on, not an arrival"* — and a six-second wait in front of a reload is
  the one place a slow flip would actually cost something.
- **The scramble tail keeps re-rolling every frame** → unchanged. **Mine**:
  entry 99's argument is about the *rate* of churn, and that is set by the
  frame loop, not by the step size — this entry changes how long the churn
  lasts, not how fast it flickers. If fifteen seconds of a cycling tail reads
  as broken rather than as deliberate, that is a follow-up entry with a
  re-roll interval in it, not a guess made at build time.
- **`NAME_LOCK_STEP_MS` gets exported and the probe imports it** →
  `scripts/probe-name-decode.ts:28` currently reads
  `const NAME_LOCK_STEP_MS = 55 // duplicated by eye from version.ts's own
  constant`. **Mine**, and it is the reason this entry is not a two-character
  edit: with the constant duplicated, changing `version.ts` alone leaves the
  probe **green while testing nothing** — its assertions are self-consistent
  against its own stale 55 and would keep passing forever. This is exactly
  CLAUDE.md's *"duplication that only exists because something was not
  exported"*, and it is load-bearing here because the probe is the only gate
  that would otherwise catch a half-applied change.

**Identity when off** — not applicable in the usual sense: this is a change to
two existing constants, adds no uniform, no state and no branch, and costs
nothing anywhere the flip was not already running. The `n === 0` and
empty-history fallbacks (`version.ts:415`) are untouched, and a name that
somehow arrives after the loop has ended still shows correctly, because both
`lockedCountAt` and `reducedLockedCountAt` already clamp at the target length
however long elapsed runs.

**Lands in** — `src/version.ts:252` (`NAME_FLIP_MS`), `:262`
(`NAME_LOCK_STEP_MS`, and its `export`), `:314` (`reducedLockedCountAt`'s
`stepMs`), and the comments on all three, which state the old durations and
must state the new ones; `scripts/probe-name-decode.ts:28` (import rather than
duplicate), `:101` and `:110` and `:120` (the reduced-path assertions and loop
bounds, which are written against 3 characters a second).

**Done when** — `pnpm probe:name-decode` passes with the constant **imported**,
and asserts: `lockedCountAt(551, 12) === 1`; `lockedCountAt(550 * 12 + 1, 12)
=== 12`; `reducedLockedCountAt` and `lockedCountAt` agree at every millisecond
tested, since they now share a step. The probe prints the total for the current
`RELEASE_NAME` — with the median name on record at 11 characters that is
**8500 + 6050 ≈ 14.6s**, and the longest at 16 characters gives **17.3s**. On
screen, at the gate: the name is still visibly decoding ten seconds in, the
Start disc is pressable within the first second and pressing it leaves
immediately rather than waiting for the decode, and the name that finally lands
is the real one with no leftover scramble characters.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:name-decode`. Then the gate
itself at 320×568 and 360×640, since it is a shared surface and the span is
laid out inside the gate's own type: the widest name must still not reflow
(`release-name.ts:19` reserves the width for exactly this), and the real
question a probe cannot answer is whether fifteen seconds of a cycling tail
reads as deliberate or as a page that has failed to load. Look at it before
committing.

**Hard stops** — prefs no · url no · capture no · dependency no. No gate *copy*
changes, so CLAUDE.md's gate-copy clause is not engaged — this changes how long
an existing element takes to resolve, not what it says.

### 114. The lattice bends toward the cursor
`status: done` · added 2026-09-04 · build 404 · followed 112

**Do** — on desktop, contract the lattice's space toward the mouse pointer: a
smooth local lens centred on the cursor, fading to nothing at its edge and to
nothing when the cursor is gone.

**Why** — asked for. The lattice is the one view whose whole geometry is a
space you are looking *into*, and a pointer that bends that space is the most
direct thing a mouse could possibly do to it.

**Recon: two findings, and both make this smaller than it looks.**

1. **The pointer position needs no conversion at all.** `toShaderUv`
   (`touches.ts:143`) returns `(clientX − centre) / min(w, h)` with y up, and
   `lattice.frag.glsl:131` computes its own `uv` as
   `(gl_FragCoord.xy − 0.5 * uResolution) / min(uResolution.x, uResolution.y)`.
   Those are the *same space*, already. The cursor's coordinates can go
   straight into the uniform.
2. **Nothing but the geometric layer has ever had a pointer.** `uRipples` is
   read by seven geometric programmes (circles, drift, chorus, grid, shards,
   tide, rose — counted, not recalled) and by no atmospheric one; the lattice
   declares fifteen uniforms and not one of them is a touch. So this is the
   first time a pointer reaches the atmospheric layer, which is why it needs a
   uniform rather than a parameter.

**Decided**
- **A local lens, not a moved centre** → the mandala stays centred and the
  cursor bends space around itself. **Mine**, and a reasoned comment is what
  decides it: the shader's own header calls the lattice *"radial symmetry — a
  kaleidoscopic fold gives the mandala structure and the single central focus
  his compositions are built around."* Dragging the log-polar singularity
  around under the cursor would be a coherent effect and a different work; it
  overrides a stated composition decision, and CLAUDE.md is explicit that such
  a comment outranks an entry that did not know about it. If the moved centre
  is what was actually wanted, that is a new entry and it should say so.
- **A radial scale about the pointer, not a displacement along a normal** →
  `uv = P + (uv − P) * (1.0 + PULL * presence * w)`, with
  `w = smoothstep(1.0, 0.0, length(uv − P) / REACH)`. **Mine**, over
  `uv += normalize(uv − P) * PULL * w`: the normalised form is singular exactly
  where the cursor is, which is the one place the effect is strongest and the
  one place a NaN would be most visible. The scale form has no singularity, is
  conformal, and a conformal warp is the right kind for a shader whose entire
  construction rests on log-polar being conformal (`lattice.frag.glsl:216`).
  Scaling the sample coordinates *outward* is what makes the *picture* contract
  toward the cursor, which is the direction "warp towards" asks for.
- **`PULL = 0.8` and `REACH = 0.45`, and the number that bounds them** →
  the map stays injective (space compresses, never folds back on itself) while
  `PULL < 4`: `f(d) = d(1 + k·w(d/R))` has `f'(d) = 1 + k(w + t·w')`, and
  `w + t·w'` bottoms out at −0.25 for a `smoothstep`, so `f' ≥ 1 − 0.25k`. At
  0.8 that is `f' ≥ 0.8` — a fifth of a margin, five times under the fold. Peak
  apparent displacement is about 9% of the short screen dimension, roughly 58px
  in a 640px-tall window. **Mine**: the fold bound is the only hard constraint
  here and 0.8 sits well inside it, chosen visible rather than tasteful because
  the last motion effect to ship was reported as too subtle (entry 111). `REACH`
  0.45 is just under half the short dimension, so the lens is a local event on
  the picture and not a whole-frame zoom.
- **Applied after the break/surge scale, with the pointer scaled to match** →
  `lattice.frag.glsl:134` already does `uv *= 1.0 + uBreak*0.35 − uSurge*0.28`,
  and the lens goes after it with `P` multiplied by the same factor. **Mine**:
  that keeps the lens centred under the cursor's actual screen position even
  mid-break, where applying it first would slide the lens up to 35% away from
  the pointer exactly when the picture is moving most.
- **`uPointer` is a `vec3`, xy position and z presence** → added to the shared
  uniforms object at `scene.ts:564`, which its own comment says is *"shared by
  both layers"*. **Mine**: one uniform carries the whole state, presence
  multiplies `PULL` so the identity is arithmetic rather than a branch, and the
  eased presence means a cursor entering the window does not snap the picture.
- **Presence eases over 0.25s, in entry 112's `hover.ts`** → the hover module
  gains an eased `presence` alongside its position and speed. **Mine**, and it
  is why this entry says *build after 112*: that entry already decides what
  "the cursor is here" means — mouse pointers only, chips excluded, parked for
  1.5s counts as gone, off-window counts as gone — and a second answer to the
  same question in this entry would be two cursors that disagree.
- **The lattice only, and no touch equivalent** → the uniform is shared and
  every other programme could read it, and none does here. **Mine**: one
  implementation behind a boundary is a guess about the future, and CLAUDE.md
  names speculative reorganisation ahead of a second tenant as the same mistake
  in the other direction. A finger warping the lattice on a phone is a separate
  taste question and is deliberately not answered by this entry.

**Identity when off** — presence 0 gives `uv = P + (uv − P) * 1.0`, which is
`uv` exactly, for every pixel, with no clamp and no branch protecting it. A
phone never raises presence above 0 (entry 112 gates the whole hover path on
`pointerType === 'mouse'`), so the lattice on a phone is bit-identical to today
and the other twelve programmes are bit-identical everywhere, since none of
them reads the uniform.

**Lands in** — `src/shaders/lattice.frag.glsl:52` (the `uPointer` declaration)
and `:134` (the lens, immediately after the break/surge scale and before
`radius` is taken); `src/scene.ts:564` (the uniform) and its per-frame write
beside the other pointer-derived values; `src/engine/hover.ts` (entry 112's
module — the eased `presence`); `src/engine/index.ts` if the ease constant is
exported for the probe.

**Done when** — rendered side by side in `views-probe.html` from identical
synthetic audio, the lattice with `uPointer = (0.25, 0.0, 1.0)` differs
visibly from the same lattice with presence 0 *inside* the lens, and is
**pixel-identical outside it**: the pixel at uv (−0.4, 0.35) is 0.738 from the
pointer, well past `REACH` 0.45, and must match byte for byte. `pnpm probe:hover`
(entry 112's) additionally asserts that presence reaches 0.95 within 0.75s of
the cursor arriving and returns below 0.05 within 0.75s of it leaving. On a
desktop browser, moving the pointer across the lattice visibly draws the
network toward it, and the warp follows continuously rather than in steps.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:hover`. Then
`views-probe.html`, which CLAUDE.md names as the tool for exactly this — every
atmospheric view side by side from identical synthetic audio, with the existing
views as the baseline — and **look at it**, because a conformal warp that
compiles and passes a pixel check can still bead or shear the fold the way
`Fringe`'s hyperbolae did. Specifically: check the kaleidoscopic fold's seams
where the lens crosses a sector boundary, since the fold uses `abs()` and a
warp that is smooth in screen space is not automatically smooth across a
mirror line. No HUD surface changes, so no 320×568 pass is owed; do confirm on
a phone that the lattice is unchanged.

**Hard stops** — prefs no · url no · capture no · dependency no. The control
surface is unchanged; this adds no control.

### 115. The camera leaves the menu, and the menu moves to a hold
`status: done` · added 2026-09-04 · build 407 · **supersedes the entry points built by 72, 78 and 87**

**Do** — take camera mode out of the HUD entirely: delete the shutter chip,
arm on a **double tap** of the picture, land on the plain picture after the
shot, and move menu-opening to a **still hold** of 3.5s.

**Why** — Victor: *"I said the camera should be a totally separate thing from
the menu"*, and, on how: *"touch hold to open menu, and single tap (or double
tap?) for camera arm."* Every entry point the camera has ever had was an
agent's choice, not his.

**Recon: this is the third reading of one instruction, and the first two are on
the record as wrong.** Entry 87 quotes him — *"camera mode is not connected to
the menu!!"* — and answers it three lines later with *"**After the shot, back
to the menu.** **Mine**, and it is the direct answer to..."*. That is the
sentence read backwards: it was a demand for separation and was taken as a
complaint about a missing connection. Entry 78's title makes the same
inversion a whole entry earlier (*"a door back to the menu, not a one-way
trip"*), and entry 72's *"Entering → a camera chip on the arc"* is marked
**Mine** — the chip was never asked for. The connection is `main.ts:1117`, one
line: `panel.open()` at the end of `exitCameraMode`.

**Decided**
- **Double tap arms, not single tap** → **Mine**, and it is a correction to the
  request rather than a preference. The emitter fires on every `down`
  unconditionally (entry 50), so a single tap that also armed would arm on
  *every* touch of the picture and the touch after it would take a photo —
  nobody could tap twice without a capture. Double tap is free precisely
  because the hold below takes over what it used to do.
- **A still hold of 3.5s opens the menu** → `CHARGE_TIME + 1.0`, derived rather
  than picked: `emitter.ts:37` saturates the charge at 2.5s, so **past 2.5s a
  hold already buys nothing** — that is gesture space the emitter's own design
  has vacated — and the extra second leaves a full-charge hold a moment to sit
  at full charge before the menu claims it. Written as `CHARGE_TIME + 1.0` so
  it moves if that constant moves. **Mine.**
- **A hold that travels is never a menu** → the contact must stay within
  **24px** of its `downClientX`/`downClientY` for the whole 3.5s. **Mine**: a
  moving hold is entry 50's fling and turning it into a menu would take the
  loudest emitter gesture away from the picture.
- **The known cost, stated rather than hidden** → a deliberate long hold to
  fatten rings now ends in a menu at 3.5s. That is a real loss to the play
  gesture and there is no version of hold-opens-the-menu without it. Named
  here so whoever reads this cold knows it was seen and accepted, not missed.
- **No partial-open ramp during the hold** → the menu opens at 3.5s, full stop.
  **Mine**, over fading the scrim in over the last 0.6s as an abort
  affordance: that would put a finger and the wedge's own open animation in
  charge of the same element at once, which is the shape of several bugs
  already in this file's history. 3.5s is itself the affordance.
- **The two-finger tap stays** → entry 67's second way in is untouched and
  becomes the *fast* path to the menu, with the hold as the one-thumb path.
  **Mine**: they do not conflict, one-handed is exactly when two fingers is
  awkward, and removing a working way into the menu in the same entry that
  moves the primary one is how a build ends with no way in at all.
- **The shutter chip is deleted, with everything that existed only to serve
  it** → `hud.ts:1137` (the chip), `:524` (the
  `.hud-chip--shutter[aria-pressed='true']` pointer-events exception),
  `:1603`/`:649` (`setCameraActive` and `cameraActive`), `:1354` (the
  `id === 'shutter'` paint branch) and `:1368` (`void shutterChip`). **Mine**,
  and it is the CLAUDE.md rule that deleting code deletes what it was doing:
  all five exist solely to let a chip enter and report camera mode, and with
  no chip they are not simplification, they are dead weight that would keep
  `Hud`'s interface claiming a capability it no longer has.
- **After the shot, the plain picture** → `panel.open()` goes from
  `exitCameraMode` (`main.ts:1117`). That single line is the whole substance
  of the complaint.
- **The glyph and the arm state are unchanged** → `#shutter-glyph`, its
  `shutter-pulse` keyframe, `camera-arm.ts`'s 15s-quiet and 5-minute expiry
  (entries 87 and 109) all stay exactly as they are. This entry changes how
  you get in and where you come out, and nothing about what the mode does.
- **The `?debug` readout gains `arm`** → armed or not, and the current hold's
  elapsed seconds. **Mine**, and it is CLAUDE.md's *two identical symptoms
  need two different numbers* applied before the symptom appears: "the camera
  doesn't arm" will otherwise be indistinguishable from "the double tap isn't
  being recognised", and this feature has now been misdiagnosed from the
  outside twice.

**Identity when off** — a hold shorter than 3.5s, or one that moves past 24px,
does exactly what it does today: charges the emitter and nothing else. A single
tap is untouched. The saved PNG, the flash, the rate limit and the arm expiry
are all byte-identical; only the two gestures that reach camera mode and the
menu change.

**Lands in** — `src/main.ts:1462` (the two-finger branch, unchanged, for
context), the double-tap resolution in `resolveTapDown`'s own consumer
(`panel.open()` → `enterCameraMode()`), a new still-hold check in the
per-frame contact loop at `:1389` using `Touch.downFor` and
`downClientX`/`downClientY` (both already on the sample — no new state),
`:1117` (`panel.open()` deleted); `src/hud.ts` at the five sites listed above;
the `?debug` readout's own line.

**Done when** — on the phone: a double tap arms (glyph appears) and does
**not** open the menu; the next tap saves exactly one frame and leaves you on
the plain picture with no menu; a still hold of 3.5s opens the menu; a hold of
3.0s does not; a hold that drags 40px never opens it however long it lasts; a
two-finger tap still opens it immediately; and a single tap still plays with a
ring under the finger. The HUD's outer ring shows **three** chips, not four,
correctly spaced. `pnpm probe:tap` and `pnpm probe:touches` are updated to
assert the new mapping rather than the old one — a probe still asserting that a
double tap opens the menu is a probe asserting the bug.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:tap`, `pnpm probe:touches`,
`pnpm probe:camera-arm`. Then `hud-narrow.html` at 320×568 and 360×640, because
the outer ring loses a chip and `placeChips` respaces the remaining three —
CLAUDE.md's *check the assembly* rule is exactly about a shared surface being
changed by work that verified only its own part. Then the phone, counting
files: arm, shoot, arm, shoot, confirm exactly two frames and that the menu
never appeared.

**Hard stops** — prefs no · url no · **capture yes, and answered by Victor's
own two instructions quoted above**: arming moves from a chip behind the menu
to a double tap on the picture, which is *easier* to reach, and that is the
change he asked for. It is kept deliberate by the double tap being a distinct
gesture from play, by arming changing nothing except the glyph, and by every
existing guard — one shot per arm, the rate limit, the 15s-quiet and 5-minute
expiries — surviving untouched. Nothing new is captured, nothing leaves the
device · dependency no.

### 124. The autopilot cannot reach Strata, and the obvious fix hands it a black screen
`status: closed` · added 2026-09-04 · found while building 110 · **closed by 131: Strata is being removed, so there is nothing for the autopilot to reach; no answer needed**

**Do** — nothing yet. This is a question for Victor, raised because entry 110
shipped a view the director can never choose, and the standing rule in
`director.ts` says that is the worse of the two available failures while
Strata's own warm-up says otherwise.

**Why** — `viewFor()` (`src/director.ts:324-330`) is a hand-written
seven-bucket tree naming each atmospheric view literally, and its own doc
comment (`:288-323`) states the rule plainly: *"An unreachable programme is a
worse failure than a branch that sometimes picks the second-best of two
plausible answers."* Strata is the eighth view and has no bucket, so the
autopilot will never once show it — it is reachable only by someone going
looking through the HUD. By that rule alone, the fix is obvious and small.

**What stops it being obvious.** Every other view is a full picture on its
first frame. Strata starts **empty** and stays nearly empty for the better
part of a minute: entry 110 sized the pour so a loud passage fills about a
fifth of the frame in ninety seconds, deliberately, because "the frame filling
is not a failure — a sand frame that has all its sand at the bottom is
finished". Measured on the shipped model, thirty seconds of loud audio covers
about 7 % of the frame. So an autopilot switch to Strata gives the viewer a
black screen with a scatter of falling dots on it, for around a minute, having
just taken away a picture that was already working. **`director.ts`'s rule was
written when every view was instant, and it has never had to price a view with
a warm-up.**

**The question**
> Should the director be able to choose Strata at all, and if so, on what
> terms — knowing it hands over a nearly-empty frame for about a minute?

**What the answer changes**
- **Leave it unreachable.** Strata is a thing you choose, like turning an
  hourglass over, and the autopilot never touches it. One comment in
  `director.ts` recording the exception and why, so the next person to count
  the buckets does not read it as an oversight. Costs: the rule above gets its
  first exception, and a view most people never open the HUD to find is a view
  most people never see.
- **A bucket, and it keeps its empty minute.** The honest version of the
  standing rule: the director picks Strata for the material it suits and the
  viewer watches it fill. Grainy, non-rhythmic, non-bright material is the
  natural home — `c.noisy` is the tiebreaker `director.ts` already prefers —
  which would take some traffic from `['field', 'fringe']`.
- **A bucket, but only once it has something to show.** The director may
  select Strata only when its pile is already past some fraction of the frame,
  which means it can be *returned* to but never arrived at cold. More faithful
  to both rules and the only option that needs new plumbing: the director
  currently knows nothing about any view's internal state, and this would be
  the first time it asked.

**Decided in advance, so the answer is one choice and not a design session**
- Whatever the answer, **the pour rate is not reopened.** Ninety seconds to a
  fifth of the frame is entry 110's own decided figure and the reason the
  layers mean anything; making Strata fill faster to suit the autopilot would
  trade the feature for its own delivery mechanism. **Mine.**
- If it is a bucket, it splits on an axis already in use (`rhythmic`, `dense`,
  `bright`, `noisy`), per `director.ts`'s own constraint. No new character
  dimension. **Mine.**

**Lands in** `src/director.ts:324-330` — `viewFor`, and its doc comment either
way, since a deliberate exception to the rule stated there has to be recorded
there.
**Done when** — Victor has answered, the answer is written here, and either
the bucket exists or the exception is documented in `director.ts`.
**Verify** — `pnpm build`, `pnpm lint`, and the director's own probe if a
bucket lands; then a real session long enough for the autopilot to actually
make the choice, which is the only test of whether an empty frame arriving
unasked reads as a gift or as a fault.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 116. `d` toggles the numbers
`status: done` · added 2026-09-04 · build 409 · independent of 110–115

**Do** — pressing `d` toggles the numeric readout, exactly as the `num` chip
does, through the same one path.

**Why** — asked for. On a desktop the readout is the debugging surface and it
currently costs a double tap, a menu and a chip to reach.

**Recon: "in desktop mode" needs no desktop gate.** `keyboard.ts` already
exists — one `keydown` listener, bound unconditionally, carrying the space bar
that entry 27 gave desktop as its re-seed (a phone has the shake instead). It
has no platform check and needs none: a device with no keyboard sends no
`keydown`. A phone with a Bluetooth keyboard attached would get `d`, and that
is correct rather than a leak.

**Decided**
- **One toggle, not a second copy of it** → `hud.ts:1080`'s chip handler body
  moves to a `toggleStats()` on the `Hud` interface, and the chip calls it.
  **Mine**, and it is the reason this is not a four-line entry: that handler
  does five things — flips `showStats`, writes `prefs.showStats`, hides the
  element, clears its text, `save()` and `paint()` — and a key that reimplements
  four of them is a state that disagrees with the chip's own pressed paint the
  first time anyone touches both. CLAUDE.md's *duplication that only exists
  because something was not exported*, caught before the second copy rather
  than after.
- **`e.key`, not `e.code`** → matched as `e.key.toLowerCase() === 'd'`.
  **Mine**: the space bar uses `e.code === 'Space'` because space is a
  *position* on every layout, but "pressing d" means the key that types a d,
  which on AZERTY or Dvorak is not where `KeyD` sits. A letter binding follows
  the character.
- **Modifiers are never this app's** → any of `ctrlKey`, `metaKey` or `altKey`
  held means the key belongs to the browser or the OS, and the handler returns
  before doing anything. **Mine**, and it is a fix as well as a rule: the space
  bar has no such guard today, so Ctrl+Space — an IME switch on Windows and a
  Spotlight binding on macOS — currently re-rolls the seed as a side effect.
  Both keys share the one guard.
- **It persists, because the chip does** → `d` writes `prefs.showStats` the
  same way a tap does. **Mine**, over a session-only toggle: two ways to
  change one setting that disagree about whether it is remembered is worse
  than either behaviour on its own. On a `?debug` load the interaction is
  unchanged from today — `showStats` starts true from the URL, and pressing
  `d` writes the result to prefs exactly as tapping the chip already would.
- **The decision is extracted and made pure** → `keyAction(e)` returns
  `'randomise' | 'stats' | null` from `{ key, code, ctrlKey, metaKey, altKey,
  targetTag }`, and `bindKeyboard` becomes a listener that calls it and
  dispatches. **Mine**: the target-tag exclusion and the modifier rule are
  exactly the logic that gets a key binding wrong, and neither is testable
  while it lives inside an event listener. It is also the pure-state shape
  every other module here already has.
- **No new chip, no HUD change** → the readout keeps its chip; this is a
  second way to reach the same toggle. **Mine**: the control surface is
  unchanged, so the circular-surface constraint is not engaged at all.

**Identity when off** — a build where nobody presses a key is byte-identical:
`keyAction` returns `null` for every other key and `bindKeyboard` binds the
same single listener it binds today. The readout's own default is untouched,
and `prefs.showStats` is an existing validated field whose type and meaning do
not change — nothing stored is reshaped.

**Lands in** — `src/keyboard.ts` (the `keyAction` extraction, the `d` case, the
shared modifier guard, `KeyboardHandlers` gaining `onToggleStats`);
`src/hud.ts:1080` (the chip handler's body becomes `toggleStats`) and `:341`
(the `Hud` interface, beside `showingStats`); `src/main.ts:1176` (the
`bindKeyboard` call gains the handler); `package.json` and
`scripts/probe-keyboard.ts` (new, `pnpm probe:keyboard`).

**Done when** — `pnpm probe:keyboard` asserts, headless: `d` and `D` both give
`'stats'`; `Ctrl+d`, `Cmd+d` and `Alt+d` all give `null`; `d` with
`targetTag: 'INPUT'` gives `null`; `Space` still gives `'randomise'` and
`Ctrl+Space` now gives `null` where it previously re-rolled; every other key
gives `null`. On a desktop browser: pressing `d` shows the numbers, pressing it
again hides them and clears their text, the `num` chip's pressed state agrees
with the keyboard in both directions, and the choice survives a reload.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:keyboard`. Then a desktop
browser with the panel open, pressing `d` while the `num` chip is visible —
that is the one check that catches the chip and the key disagreeing, and it is
the failure this entry's first decision exists to prevent. No HUD surface
changes, so no 320×568 pass is owed.

**Hard stops** — prefs no (`showStats` is an existing validated field; no field
is added, retyped or repurposed) · url no · capture no · dependency no.

### 117. A mouse gets its own map: right click opens the menu, left click arms the camera
`status: done` · added 2026-09-04 · build 411 · followed 112 and 115 · does not supersede 115 — 115 is the finger's map, this is the mouse's

**Do** — on a mouse, right click opens the menu and left click enters camera
mode; the next left click takes the picture and leaves. Touch keeps entry 115's
map unchanged.

**Why** — Victor: *"in desktop mode right click should open the menu, single
click should enter camera mode."* A mouse has buttons and hover; a finger has
neither, and one map cannot serve both.

**Recon: three findings, and the third is a live oddity nobody has hit yet.**

1. **Nothing in the app handles a mouse button.** There is no `contextmenu`
   listener and no `e.button` check anywhere in `src/` — counted, not recalled.
   Right click currently opens the *browser's* menu over the picture.
2. **Left click is currently the only way to play on desktop**, which is why
   this entry cannot ship before 112. Entry 112 puts play on hover; without it,
   giving the click to the camera leaves a desktop visitor with no play gesture
   at all.
3. **Every mouse button already reaches the touch field.** `main.ts:1216`
   forwards `pointerdown` with no button filter, so a *right* click today
   spawns an emitter and increments `nonChipDown` — which means right-then-left
   satisfies `nonChipDown === 2` at `main.ts:1462` and opens the menu by
   accident. Middle click does the same. This entry fixes that as part of
   routing buttons at all.

**Also found, and fixed here because this entry is the one that makes them
newly wrong:** three comments claim the seed re-rolls on gestures that no
longer exist — `lattice.frag.glsl:143` and `scene.ts:627` both say *"space bar,
double-tap, double-click"*, and `main.ts:1550` says *"the same action the space
bar and a vertical swipe already perform"*. Double-tap has opened the menu
since entry 103, double-click has never had a handler, and entry 27 deleted the
vertical swipe. CLAUDE.md's *a comment's assumption expires; the comment does
not*, three times in one feature.

**Decided**
- **Two maps, split by `pointerType`, not one map with exceptions** → the whole
  routing is `e.pointerType === 'mouse'`, the same gate entry 112 established.
  **Mine**: a mouse has two buttons and a hover state and a finger has neither,
  so the maps differ because the hardware does. Entry 115's finger map — single
  tap plays, double tap arms, 3.5s hold opens the menu, two fingers open the
  menu — is untouched, and a touchscreen laptop gets whichever map the actual
  contact came from.
- **The mouse map, in full** → left click arms; the next left click shoots and
  leaves; right click opens the menu; hover plays (112); moving the mouse warps
  the lattice (114); `d` toggles the numbers (116); space re-seeds. **No hold
  on the mouse** — entry 115's 3.5s hold is the finger's way to the menu
  because a finger has no second button, and a mouse has one. **Mine**: two
  gestures for one action on the same device is how a map stops being learnable.
- **Left click still plays** → the emitter fires on `pointerdown` exactly as it
  does today, arming or not. **Mine**: entry 87's rule is that *arming* changes
  nothing on screen, not that the gesture which arms must stop doing what it
  did — and a click that produced no ring on a machine where merely hovering
  produces rings would read as broken rather than as a mode.
- **Right click while armed disarms and opens the menu, without taking a
  picture** → **Mine**, and it is entry 72's own principle applied to the
  device that now has a second button: *"two fingers always means get me out of
  what I am in."* Entry 87 locks the menu out during the mode; that was right
  when the mode's only exit was the shot, and a mode whose only exits are a
  photo or a 15-second timeout is one a right click should be able to leave.
- **`contextmenu` is prevented on the canvas only** → not on the document.
  **Mine**: a right click on a `.hud-chip` or on the gate keeps the browser's
  own menu, which is the escape hatch for anyone who needs it, and the picture
  is the only surface this entry claims.
- **Buttons other than 0 and 2 are ignored entirely** → middle click and the
  back/forward buttons reach neither the touch field nor the menu. **Mine**,
  and it is the fix for finding 3 above rather than a new rule: they currently
  play and can pair into a spurious two-contact menu open.
- **The routing is a pure function, in `touches.ts`** → `pointerAction({
  pointerType, button })` returning `'play' | 'menu' | 'ignore'`, beside
  `toShaderUv`. **Mine**: `touches.ts` is already the module that translates a
  DOM pointer event into this app's terms, it is where `toShaderUv` lives for
  the same reason, and `pnpm probe:touches` already exists — so this needs no
  new file and no new probe script, only new assertions in one that runs today.
- **The 15-second expiry is the bound on accidental captures, and it does work
  on a desktop** → `camera-arm.ts`'s `QUIET_S` disarms after 15s of the phone
  reading flat and unhandled, and a machine with no accelerometer reports
  exactly that from the first frame, so an armed desktop always disarms in 15s.
  **Mine** to state it; the behaviour is entry 109's and is unchanged. Worth
  stating because "two clicks anywhere is a photo" is otherwise unbounded, and
  the thing that bounds it is a module written for a phone.

**Identity when off** — a touchscreen device never produces
`pointerType === 'mouse'`, so `pointerAction` returns `'play'` for every
contact it sees and the dispatch is exactly entry 115's, unchanged. On a mouse
with no click, nothing fires. The saved PNG, the flash, the rate limit and the
arm expiry are all untouched; this entry only routes which input reaches which
existing path.

**Lands in** — `src/engine/touches.ts:143` (`pointerAction`, beside
`toShaderUv`); `src/main.ts:1216` (the `pointerdown` listener routes on it),
`:1462` (the two-contact branch, now unreachable from a mouse), and a
`contextmenu` listener on the canvas; `src/shaders/lattice.frag.glsl:143`,
`src/scene.ts:627` and `src/main.ts:1550` (the three stale comments);
`scripts/probe-touches.ts` (the new assertions).

**Done when** — `pnpm probe:touches` asserts: `pointerAction` gives `'menu'`
for a mouse button 2, `'play'` for a mouse button 0, `'ignore'` for mouse
buttons 1, 3 and 4, and `'play'` for a touch or pen contact **whatever the
button reads**. On a desktop browser: a right click opens the menu and the
browser's own context menu never appears over the picture; a left click shows
the camera glyph and a ring, and the *next* left click saves exactly one frame
and leaves you on the plain picture; a right click while the glyph is showing
opens the menu and saves **nothing**; an armed session left alone for 15
seconds disarms and the glyph fades; and a right-click-drag no longer spawns an
emitter. On a phone, entry 115's map is unchanged in every one of its cases.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:touches`,
`pnpm probe:tap`, `pnpm probe:camera-arm`. Then a desktop browser, counting
files in the download folder across a deliberate arm-shoot-arm-shoot and a
minute of ordinary clicking around — the second half is the real test, because
this entry makes a capture two clicks away and the question is whether an
ordinary session produces any. Then a phone, to confirm the finger map did not
move. No HUD surface changes, so no 320×568 pass is owed.

**Hard stops** — prefs no · url no · **capture yes, and answered by Victor
twice**: *"single click should enter camera mode"* (2026-09-04) and, in entry
87, *"Enter camera mode display camera icon next click takes picture exits
camera mode."* Captures become materially easier to reach on a mouse — two
clicks, no menu — and that is the change he asked for. It is bounded by the
existing 15-second disarm, by right click leaving the mode without a shot, and
by every other guard surviving untouched: one shot per arm, the rate limit, the
five-minute ceiling. Nothing new is captured and nothing leaves the device ·
dependency no.

### 119. In landscape, the Camera mode chip is drawn above the top of the screen
`status: done` · added 2026-09-04 · build 417 · found at build 373 from a "there is no camera" report · 115 built first, so the clipped chip was the Sky chip — measured, still clipped, still fixed

**Do** — make `chipPosition()` derive the arc's usable angular span from the
viewport it is given, on both the left edge and the top edge, so no chip on
either ring can be placed outside the screen at any aspect ratio.
**Why** — on every landscape viewport the last chip on the outer ring — the
one that arms camera mode — is placed with its top edge 42–44 px above `y = 0`.
The chip exists, is wired, and cannot be tapped.

**The finding, measured on the real `hud-probe.html` in iframes** (the only way
to get a true viewport here, per CLAUDE.md — `resize_window` lies):

| viewport | Camera mode chip `top` | |
|---|---|---|
| 320×568, 360×640, 390×844, 414×896, 768×1024 | 204, 237, 412, 440, 225 | on screen |
| **568×320, 640×360, 844×390, 896×414** | **−44, −43, −42, −42** | **off the top** |
| 900×700, 1024×768, 1280×800, 1440×900 | −33, −31, −29, −26 | off the top |

At phone-landscape sizes it takes `Sky: auto` with it (−14 to −17) and at
568×320 `Listening` too (−8). Every portrait size is clean.

**The mechanism, exactly.** `chipPosition()` (`hud.ts:141-152`) hinges every
arc at `(w + 10, h + 10)` and uses `base = min(w, h)` for the radius, so in
landscape the outer ring's radius is `1.22 × h` swung from below the bottom
edge — the far end of that arc is above the screen by construction. At 844×390:
`r = 475.8`, step `6.38°`, start `222.4°`, the fourth chip lands at `241.6°`,
`y = 400 + 475.8·sin(241.6°) = −18.6`, top `= −42.6`. Matches the measurement.
**The left edge already has a guard** — `CHIP_ARC_MIN_START = 209°`
(`hud.ts:129`), added when a seventh chip pushed the leading one off the left
(entry 19) and kept after entry 77 split the row into two rings of four with
the note *"neither ring should ever reach it again."* True of the left edge;
**nothing has ever guarded the top**, and landscape is a supported state
(`hud.ts` rebuilds on `orientationchange`). The shutter chip is last on the
outer arc, so it is the first casualty every time — a hand-tuned constant
standing in for layout, which is the exact failure CLAUDE.md's refactor rule
names.

**Decided**
- Fix the geometry or special-case landscape → **the geometry.** Both edges
  become analytic bounds on the angle: for a chip of size `s` at radius `r`
  from hinge `(cx, cy)`, it is inside the left edge when
  `cos a ≥ (s/2 − cx) / r` and inside the top edge when
  `sin a ≥ (s/2 − cy) / r`; on the 180°–270° quadrant the first gives
  `a_min` and the second gives `a_max`. Centre the row on `CHIP_ARC_MID`
  (232°, unchanged) and clamp it into `[a_min, a_max]`. Over an
  `if (w > h)` branch, which would fix the four sizes measured and none of the
  ones not measured. **Mine.** Worked at 568×320 for the outer ring:
  `a_min = 180°` (the left edge is nowhere near), `a_max = 231.6°`, the row
  needs `23.4°` — it fits with room, and only because the left bound is now
  computed rather than the fixed 209°, which would have left `22.6°`.
- `CHIP_ARC_MIN_START` → **deleted, replaced by the computed `a_min`.** Over
  keeping it as a floor under the computation. **Mine**: at 320×568 the
  computed left bound is 218.3° for the outer ring and 207.7° for the inner,
  and the rows already start at 220.3° and 218.8° — so the constant was never
  what kept them on screen; centring was. Two guards for one edge is how the
  next person stops trusting either.
- If the span is still too short for the row → **compress the step until the
  chips touch (`CHIP_GAP` → 0), and only then shrink `r`.** A ladder, so the
  order is checkable: natural spacing, then tighter spacing, then a smaller
  ring. Over overlapping chips or dropping one. **Mine.** No tested viewport
  reaches the second rung; the rule exists so the next chip added does not
  reopen this entry.
- A safety margin inside the edge → **4 px** beyond `s/2`, so a chip's own
  border is not the pixel touching the screen edge. **Mine.**
- Portrait must not move → **positions at 320×568 and 360×640 change by at
  most 1 px** on every chip. The three verified-and-approved HUD passes all
  happened in portrait; this entry is not licensed to shift them.
- Make it testable → **`chipPosition` takes `(w, h)` as parameters instead of
  reading `window.innerWidth/innerHeight` itself**, so a headless probe can
  scrub aspect ratios. Same move `camera-arm.ts` made for the same reason:
  a control that can only be exercised by a real viewport will not be
  exercised. `placeChips` passes the window's numbers, so behaviour is
  unchanged. **Mine.**

**Lands in**
- `src/hud.ts:98-129` — `R_CHIPS_INNER`, `R_CHIPS_OUTER`, `CHIP_ARC_MID`,
  `CHIP_GAP` stay; `CHIP_ARC_MIN_START` and its comment go, the comment's
  history (entries 19 and 77) folded into the new one.
- `src/hud.ts:141-152` — `chipPosition`, rewritten as above and exported for
  the probe.
- `src/hud.ts:1171-1184` — `placeChips`, passes `(innerWidth, innerHeight)`.
- `scripts/probe-hud-arc.ts` — new: scrubs every ring at 320×568, 360×640,
  390×844, 414×896, 768×1024, 568×320, 640×360, 844×390, 896×414, 1024×768,
  1280×800, 1440×900 and asserts every chip's box is inside the viewport with
  the margin; also asserts the portrait positions against the current build's
  numbers (recorded in the probe as the baseline) to within 1 px.
- `.github/workflows/checks.yml:62-64` — add `pnpm probe:hud-arc`. Only
  `probe`, `probe:shake` and `probe:fullscreen` run there today.
- `hud-narrow.html` — two more frames, 568×320 and 844×390, so the
  `escaped` count it already reports covers landscape; today it only asks
  about portrait, which is why this was never seen.

**Done when**
- `probe-hud-arc.ts` passes: zero chips outside the viewport at all twelve
  sizes, and every portrait position within 1 px of today's.
- `hud-narrow.html` reports `escaped 0` at all four of its frames.
- On a phone turned sideways with the HUD open, all eight chips are visible
  and the Camera mode chip arms the mode when tapped.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:hud-arc`; `hud-narrow.html`
at all four frames, looked at, in every state the HUD has (each of the four
groups open); then a phone in landscape.

**Hard stops** — prefs no · url no · capture no · dependency no. The control
surface stays circular — this moves chips along the arc they are already on.

### 120. Armed camera mode dies after 15 seconds on any device with no motion data
`status: done` · added 2026-09-04 · build 420 · found at build 373 from the same "there is no camera" report · follows 109

**Do** — teach `camera-arm.ts` the difference between "the phone reads as put
down" and "the phone has never reported anything", and in the second case run
only the five-minute ceiling.
**Why** — entry 109 (build 372) replaced the 60-second wall clock with a
posture-and-tilt state machine. On a device that never delivers a
`devicemotion` event, posture sits at its initial `'still'`
(`engine/posture.ts:123`) and tilt is the frozen zero reading
(`shake.ts:832`, `:939`), so `aimed` is never true, the quiet window starts the
instant the chip is tapped, and the arm expires after `QUIET_S`.

**Measured**, driving `camera-arm.ts` headless with exactly that input:

```
no motion data (posture 'still', tilt 0,0):   arm survives 15.02 s
phone reporting motion (posture 'handled'):   arm survives 300.00 s
```

On desktop it is therefore **always 15 seconds and can never be more**. On iOS
it is 15 seconds whenever the motion permission was declined or never asked.
Before build 372 it was 60. The failure is indistinguishable from the feature
being absent: tap the chip, frame the shot, and the tap that should take the
photo plays a ripple instead. `scripts/probe-camera-arm.ts` has four cases and
every one supplies tilt readings; there is no case for a device that reports
none, which is how this passed. **`probe:camera-arm` is also not in CI** —
`checks.yml:62-64` runs only `probe`, `probe:shake` and `probe:fullscreen`.

**Decided**
- What "no motion data" means → **no `devicemotion` sample has ever arrived
  in this session**, read live on every frame — not a permission query, not a
  flag captured at arming time. Over checking at arm time only. **Mine**: the
  first sample can land a few hundred milliseconds after the gate, and a
  reading taken per frame hands over to the posture path the moment data
  starts, with no state to reset.
- Where that fact comes from → **`shake.ts` exposes it once**, from the
  `samples` counter it already keeps (`shake.ts:468`, incremented `:576`,
  printed as `motion N ev` at `hud.ts:1507`, reachable today only through
  `diagnostics().samples`). Entry 110 shipped at build 386 without adding a
  reader for it, so **this entry adds one**, named for what it answers.
  **Mine.**
- What the arm does without motion → **the quiet path is disabled and only
  `CEILING_S` (five minutes) applies.** Over restoring the 60-second clock.
  **Mine**: entry 109's own Decided calls the ceiling *"five minutes, whatever
  the posture"*, and a device that cannot report a posture is precisely the
  case that clause describes. A separate 60 s figure would be a third clock
  for the same mode. Five minutes armed on a laptop is not a hazard: arming
  is deliberate, the glyph is showing, and the next tap on the picture exits.
- Signature → **`updateCameraArm(state, now, posture, tiltX, tiltY,
  motionAvailable: boolean)`**, a sixth argument, so the module stays pure and
  the probe can set it directly. Over reading `shake` from inside the module,
  which would give it a dependency `posture.ts` and `motion-bias.ts` do not
  have. **Mine.**
- Entry 109's record → its `status:` line gets the clause CLAUDE.md's
  *Shipping part of an entry* requires: `· gap found at build 373 — see 120`.
  109 shipped believing it covered every device; it did not, and the entry
  should say so where the queue is read.

**Lands in**
- `src/engine/camera-arm.ts:33-45` — the constants' comments gain the
  no-motion clause; `:80-105` `updateCameraArm` gains the argument and the
  branch: when `!motionAvailable`, skip the quiet bookkeeping entirely and
  test only `armedElapsed >= CEILING_S`.
- `src/shake.ts` — one exported reader of `samples > 0` (name it for what it
  answers: whether the sensor has ever spoken, not whether permission was
  granted — those differ on Android, where no permission exists).
- `src/main.ts:1577-1583` — the call site passes it.
- `scripts/probe-camera-arm.ts` — a fifth case: `'still'`, tilt `(0, 0)`,
  `motionAvailable = false`, must survive to `CEILING_S` and expire there; and
  the existing four pass `true` so their meaning is unchanged.
- `.github/workflows/checks.yml:62-64` — add `pnpm probe:camera-arm`.
- `docs/todo.md` — entry 109's status line, as above.

**Done when**
- The probe's new case reads armed at 299 s and disarmed at 300 s ± one frame;
  the four existing cases produce the same numbers they do today.
- The probe runs in CI.
- Headless, a run that starts with `motionAvailable = false` and switches to
  `true` with `'still'`/`(0, 0)` at 20 s expires at 35 s — the quiet window
  begins when data begins, not before.
- On a desktop browser: tap the shutter chip, wait 60 s, tap the picture — a
  photo is saved and the mode exits.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:camera-arm`; the desktop
check above; then a phone with motion granted, to confirm the 15-second quiet
window still fires when it is genuinely laid flat.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 121. Press and shake brings the room in
`status: done` · added 2026-09-04 · build 426 · extends 22 · **the phone half is unverified — no probe can answer whether iOS honours the activation; see build note**

**Do** — when a strong or double shake lands while at least one finger is on
the picture, do everything the shake already does *and* raise the passthrough
camera from zero to **0.5**, opening it for the first time if it has never been
opened.
**Why** — Victor: *"press and shake should activate the AR camera mode — so
adds to the shake action."* A shake alone may only ever raise a camera that is
already live (entry 22, narrowed by 73); a finger on the glass is the gesture
that lets it be turned on.

**"AR camera mode" is read as the passthrough layer** — the live room behind
the picture, `prefs.passthrough`, the `cam` band — not entry 87's photo-taking
"camera mode". Entry 115 is moving *that* onto a double tap; this entry does
not touch it. If the reading is wrong the whole entry is wrong, so it is said
here first.

**Recon: the detection already exists in pieces, and the wall entry 22 hit
is exactly what a press removes.**
- Both facts meet in `main.ts`'s frame loop already: `latestShake.events[0]`
  is the shake (`kind: 'strong' | 'double'`, `peak`), resolved once per frame
  (`:1647-1681`), and `touchField.sample(now)` is every contact on the glass,
  each with `onChip` (`:1389-1398`) — the same loop that counts
  `nonChipDown` for the two-finger recogniser. No new sensor, no new event.
- Entry 22 licensed a shake to raise the camera and then hit a technical
  wall, recorded in its Decided: *"a `devicemotion` event carries no user
  activation, so `getUserMedia` called from the shake path has no gesture
  behind it."* Entry 73 narrowed it further — raise only over a stream that is
  *already live*, because a refused `play()` was the frozen-camera report's
  cause. `maybeRollCamera()` (`main.ts:930-955`) is that rule in code, and
  `applyPassthrough()`'s comment (`:1031-1035`) says the first-open branch is
  reached only "from the control's own pointer handler — the gesture
  getUserMedia requires is still live there." **A finger on the glass *is* a
  pointer handler's gesture.** `pointerdown` grants transient user
  activation; a shake is recognised 0.5–0.75 s after it starts (three
  reversals in a 1.2 s window, `shake.ts:194-195`), well inside any
  browser's activation window. So this is not a fourth exception to the
  capture rule; it is the one case where the shake path *has* the gesture
  the rule demands.
- Precedent for gating a shake's action on app state: entry 102's *"shake
  while the HUD is open → the discrete shuffle stands down"*, with the flags
  consumed and discarded. This entry adds a branch beside that one.

**Decided**
- Capture hard stop → **licensed by Victor, 2026-09-04**, in the words quoted
  above. It widens entry 22's licence in one respect: this path **may open
  the camera for the first time**, and therefore may be what puts the
  browser's camera prompt on screen. That is acceptable for the same reason
  the `cam` band's first drag is: the person's finger is on the glass and
  the prompt is the consent point (CLAUDE.md, Hard Stop 3). Entry 22's "only
  where permission already exists" was the activation wall, not a scruple,
  and its own Decided says so.
- "Adds to" → **the shuffle, tumble, pulse and buzz all happen exactly as
  today**; the camera raise is an extra effect of the same event, not a
  replacement. Victor's words. So a press+shake also re-rolls the picture,
  which is right: the room arrives with a new picture over it.
- Level → **0.5**, over `CAMERA_ROLL_MAX` (0.6) and over the stored
  `prefs.passthrough`. **Mine**: entry 22 capped the shuffle at 0.6 because
  *"passthrough at 1 leaves the room and no visualiser"*; 0.5 is unambiguously
  both room and picture, and a fixed figure means the gesture always does
  the same visible thing. The `cam` band adjusts it afterwards as ever.
- Already on → **nothing extra happens.** Over toggling off. **Mine**: a
  shake with the room already in should still be a shuffle, and a thumb
  resting on the glass during an ordinary shake must not switch the room off
  — that is the same "control lying about its state" fault entry 102 avoids.
  Activate-only, as asked.
- Which fingers count → **any non-chip contact, excluding one currently spent
  on the fullscreen retry** (`fsBlocking`, entry 80) — the identical rule
  `nonChipDown` already applies. `hudOpen` → no, for the same reason the
  shuffle stands down. `cameraMode` (photo mode armed) → **no**, matching
  `maybeRollCamera()`'s own guard: the passthrough level is borrowed for the
  duration of that mode. **Mine**, all three by reuse.
- The finger's own trail → **not claimed.** A hard shake drags the glass under
  a still thumb, the contact acquires speed, and the emitter lays a trail of
  rings (`SPAWN_DIST`, entry 57). Left alone: the picture is tumbling and
  re-rolling in that instant anyway, and claiming the contact would need the
  one-claimant-per-tap machinery for a gesture that ends in under a second.
  **Mine**; overturn if it reads as a fault on the phone.
- Where it lives → **a pure decision function in `src/engine/`,
  `shouldRaiseCamera({ shake, fingersDown, panelOpen, cameraMode, live })
  → boolean`**, called from the frame loop beside `maybeRollCamera()`, with
  the actual raise going through `applyPassthrough(0.5)` and
  `panel.adopt({ passthrough: actual }, 0)` — the same two calls
  `maybeRollCamera()` makes, so the band, `prefs.passthrough` and
  `localStorage` all agree without a second path. **Mine**: the condition is
  the only new logic, and a closure in `main.ts` is the shape camera mode
  lived in until entry 109 made it probeable.
- Persistence → **the same as the shuffle's raise**: `adopt()` writes
  `prefs.passthrough` and saves (`hud.ts:1653-1656`). Existing field, no
  shape change. **Mine**, by consistency with 22.
- Refused or absent camera → `applyPassthrough` already returns 0 and the
  band stays at 0; nothing new to write. The shuffle has already happened.
- Comments that expire → `main.ts:304-312` ("never itself ask for the camera
  the first time") and `maybeRollCamera()`'s ("this path can never be the one
  that calls `startCamera()` for the first time") stay **true of the
  shake-alone path** and must gain a sentence saying the press+shake path is
  the exception and why. CLAUDE.md: a comment's assumption expires; the
  comment does not.

**Lands in**
- `src/engine/raise-camera.ts` — new, the pure decision; exported from
  `engine/index.ts`.
- `src/main.ts:1647-1681` — one call in each of the `double` and `strong`
  branches after `maybeRollCamera(...)`, passing `nonChipDown > 0` (already
  computed at `:1388`), `panelOpen`, `cameraMode`,
  `cameraSource?.isLive() ?? false`.
- `src/main.ts:304-312`, `:914-955` — the two comments above.
- `scripts/probe-raise-camera.ts` — new, plus `package.json` and
  `checks.yml`.

**Done when**
- Headless: the decision is true for `(strong or double) && fingersDown &&
  !panelOpen && !cameraMode && !live`, and false for every single-flag
  negation of that — eight cases, all asserted; a shake with no finger never
  raises (the identity: the shake path is byte-for-byte what it was).
- On a phone with passthrough at 0 and the camera never granted: thumb on
  the picture, hard shake → the browser asks for the camera; allow → the room
  is visible behind a re-rolled picture within a second, `cam` band reads 50.
  Deny → picture re-rolls, band stays 0, no further prompt on the next shake
  without a finger.
- Same phone, camera granted, passthrough at 0: shake **without** a finger →
  re-roll only, room stays out. Then with a finger → room in at 50.
- Passthrough already at 30, thumb on glass, shake → re-roll, level still 30.
- Whether iOS Safari honours the activation at the moment the shake lands is
  the one thing no probe can answer; if it refuses, the entry's fallback is
  the existing one (level 0, band 0) and the finding goes in the build note.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:raise-camera`,
`pnpm probe:shake` unchanged (detection is untouched); then the four phone
cases above, on both an Android and an iPhone if both are to hand. No HUD
surface changes, so the 320×568 / 360×640 pass is not required.

**Hard stops** — prefs no (existing field, same writer as 22) · url no ·
capture **yes — licensed, quoted in Decided** · dependency no.

### 118. The gate stops saying "i am"
`status: done` · added 2026-09-04 · build 397 · **reverses the answer recorded in 107**

**Do** — remove the `i am` line from the gate: the `<p class="gate-aware">` and
the `.gate-aware` rule that exists only for it.

**Why** — Victor: *"don't need the text 'i am' on the opening page."*

**Recon: this is an exact revert, and git has the target.** Build 374
(`5d32113`) added the line in a purely additive diff to `index.html` — one CSS
block at `:418-430` and one comment-plus-paragraph at `:826-832`, and nothing
else in that file changed. There is no layout to re-derive and no spacing to
guess at: the gate as it stood before build 374 *is* the answer, and the two
hunks come straight back out.

**The one thing that must not be reverted with it:** the same build added
`'says i am'` to `RELEASE_NAMES` (`release-name.ts:151`). That stays — see
Decided.

**Decided**
- **The CSS rule goes with the paragraph** → `.gate-aware` at `index.html:418`
  has exactly one user and no other, so leaving it behind is dead code
  pretending to be a style. **Mine.**
- **`'says i am'` stays in `RELEASE_NAMES`** → **Mine**, and it is the
  CLAUDE.md *deleting code deletes what it was doing* rule caught before the
  fact rather than after. That array is an append-only record: `version.ts`
  flips the gate's name through **every** past name on load, and
  `SCRAMBLE_ALPHABET` is built from the characters of the whole history, so
  removing an entry rewrites what the decode animation runs through and
  narrows the alphabet it draws from. A release name is what a build *was
  called*, not a claim the app still makes — build 374 really was the one that
  said it.
- **The byline paragraph is not this one** → `index.html:817` is
  `<p class="gate-byline">by flyflyfly © 2026<span id="motion-glyph">…</p>`,
  which sits *above* the `<h1>` and carries entry 99's reduced-motion
  diagnostic glyph. **Mine** to state it: "the paragraph under the title" is an
  ambiguous instruction and removing the wrong one would silently take out the
  glyph that exists so nobody has to ask about an OS setting again.
- **Nothing replaces it** → no shorter line, no icon, no fade. **Mine**: entry
  107 offered three options and named "nothing" as *"the status quo and it is
  defensible — the app is more present for knowing where it is whether or not
  it announces it."* This is that option being chosen after the alternative was
  tried on screen, which is a better way to reach it than the argument was.
- **Entry 107 records the reversal, at both ends** → its `status:` line gains
  `· reversed 2026-09-04 by 118`, and its answer paragraph gains the new
  answer beneath the old one. **Not optional**, and 107 says why in its own
  words: *"If the answer is 'nothing', this entry closes as done with the
  answer recorded, so nobody proposes it a third time."* The question has now
  been raised twice (97, then 107). An entry whose recorded answer is the one
  that was just removed from the screen is how it comes back a third time.

**Identity when off** — not a modulation; this is a deletion, and its identity
claim is stronger than usual: after it, `index.html`'s gate header is
byte-identical to `5d32113^`. Nothing else on the gate moves — the title, the
byline, the release-name flip, the QR, the Start disc and the queue panel are
all untouched, and no JavaScript reads `.gate-aware` at all, so nothing can be
left holding a reference to it.

**Lands in** — `index.html:418-430` (the `.gate-aware` rule) and `:826-832`
(the comment and the paragraph); `docs/todo.md`'s own entry 107 (the reversal
note). No `.ts` file changes.

**Done when** — `git diff 5d32113^ -- index.html` reports **no difference in
the gate header or in the stylesheet block containing `.gate-aware`**; the
string `gate-aware` appears nowhere in the repository; `'says i am'` is still
present in `release-name.ts`; and on the gate, the release name still flips and
decodes, `#motion-glyph` still appears, and the title sits directly above the
release name with no gap where the line was.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:name-decode` (the gate's
name element is the paragraph's immediate sibling, so it is the one thing a
mis-scoped deletion would take with it). Then the gate at **320×568 and
360×640** via `hud-narrow.html`'s iframe technique — the header loses a line of
type and CLAUDE.md requires the assembled surface to be looked at, not reasoned
about, and the narrow widths are where the title's own `9vw` term bites.

**Hard stops** — prefs no · url no · **capture: this is gate copy, so
CLAUDE.md's Hard Stop 3 is engaged and answered** — that clause says anything
touching gate copy is a proposal rather than a no, and Victor's instruction
above *is* the decision. The direction is toward the build-66 baseline rather
than away from it: this removes a line, adds none, and the ban on
reassurance copy is untouched · dependency no.

### 122. A drag floods the frame: sixteen touch rings need an ink budget
`status: done` · added 2026-09-04 · build 445 · finishes 79 · independent of the rest of the queue

**Do** — weight every touch ring's opacity by `1/√n`, where `n` is the number of
touch rings alive in that shader this frame, in the six geometric views that
draw touch rings; and fix the `+=` entry 79 missed in Shards.
**Why** — a press-and-drag on Circles, Rose, Drift, Tide, Chorus or Shards
turns the frame solid in the layer colour. Entry 79 (build 343) stopped the
ink *exceeding* 1; it did nothing about the frame reaching 1 everywhere, and
solid-at-exactly-1 times `uGeoColour` is one flat colour.

**The finding, measured.** A headless mirror of Circles' touch loop (same
by-eye convention `probe-ripples.ts` already uses): 9:16 frame on a 90×160
grid, a 2 s drag across the middle at 0.4 uv/s followed by the emitter's
2.5 s afterlife, rings laid every 0.15 s or 0.05 uv (`emitter.ts:53,60`),
sixteen slots with the oldest recycled, `birthLevel` 0.8.

| | rings alive | frame above 0.9 ink | frame above 0.1 | mean ink |
|---|---|---|---|---|
| as shipped, mid-drag | 8 | 9.2 % | 13.6 % | 0.12 |
| as shipped, full load | 16 | **53.8–58.9 %** | 59.9–73.4 % | 0.58–0.69 |
| stroke cap 0.04 uv, full load | 16 | 50.0–50.5 % | 57–69 % | 0.55–0.63 |
| `1/n`, full load | 16 | 0.0 % | 48–51 % | **0.10–0.11** |
| **`1/√n`, full load** | 16 | **0.0–3.0 %** | 59.2–72.6 % | 0.28–0.33 |

Three numbers multiply into the flood: stroke width is *proportional to
radius* (`circles.frag.glsl:124-126` — `OUTER_STROKE 0.22`, `INNER_STROKE
0.09`, of radius), so a ring's painted area grows as r²; **sixteen** touch
slots (`ripples.ts:35`) stay full for the whole of a drag and its afterlife;
and each ring is `0.35 + 0.65 × birthLevel` opaque, ≥ 0.74 on a drag because
speed *adds* level (entry 50). Screen ink of sixteen bands at ≥ 0.74 on
sixteen different radii is 1 almost everywhere.

**What the measurement overturned.** Capping the stroke width — the obvious
"attack the r²" fix — barely moves the number (58.9 → 50.5 %). It is not the
root; count × opacity is. Recorded so the next reader does not reach for it,
and it also means the approved look of a single ring at full size is not in
question here. `1/n` conserves ink linearly and leaves a drag too faint to see
(mean 0.10). `1/√n` — total ink energy held constant, the same compromise
audio mixing makes — removes the solid field while keeping every ring
visible: coverage is unchanged to within a point, so the trail is still
there; it is simply no longer a wall.

**Decided**
- Weight → **`1/√n`**, over `1/n` (too faint, table above) and over a stroke
  cap (does not address the cause). **Mine**, on the numbers.
- What `n` counts → **touch slots only**, `i ≥ AUDIO_RIPPLES`, alive by the
  shader's own existing test `age ≥ 0 && age ≤ lifespan`. Audio rings are
  eight, independent, and not part of the report; **with no finger on the
  glass the picture is bit-identical.** **Mine.**
- Where `n` is counted → **in the shader, a pre-pass over the sixteen touch
  slots before the drawing loop**, over a `uTouchAlive` uniform from
  `ripples.ts`. **Mine**: `lifespan` is `LIFESPAN × uMoonLife` (entry 96) and
  differs per shader, so TypeScript cannot know "alive" exactly; sixteen
  compares a frame is nothing; and the same test in the same file cannot
  drift from the loop it governs.
- Identity → `weight = inversesqrt(max(n, 1.0))`, **exactly 1 for a lone
  ring, by arithmetic, not a guard.** A single tap is bit-identical to today.
- Shards → **`shards.frag.glsl:127`'s `ink +=` becomes the screen operator**
  entry 79 gave the other five, *and* takes the weight. Entry 79's build note
  says Grid and Shards were "intensity-based" and correctly left alone; **that
  was true of Grid (`grid.frag.glsl:123`, `max`) and false of Shards.** Owned
  here and noted under 79 in `built.md`.
- Grid → **untouched.** `max` cannot accumulate density, and its fronts are a
  record where the strongest wins, exactly as the wake ladder is.
- Interference (a signed wave per ring, magnitude at the end) → **still not
  this entry.** Entry 79 reserved it for its own entry proven on Circles
  first; nothing here changes that.
- The per-slot phase/stroke variation entry 79 added → untouched; it and the
  weight compose.

**Lands in** — the touch-ring contribution line in each of six shaders, plus
the pre-pass above its loop:
- `src/shaders/circles.frag.glsl:346-380` (touch loop; the audio loop at
  `:268` and the wake are untouched)
- `src/shaders/rose.frag.glsl:294-337`
- `src/shaders/drift.frag.glsl:141-176` — shared loop; weight gated on
  `i >= AUDIO_RIPPLES`, the same gate 79's slot hash already uses at `:162`
- `src/shaders/tide.frag.glsl:109-155` — shared loop, same gate
- `src/shaders/chorus.frag.glsl:106-146` — shared loop, same gate
- `src/shaders/shards.frag.glsl:75-127` — shared loop, same gate, and the
  `+=` → screen change
- `scripts/probe-ripples.ts` — the drag scene above, mirrored: assert **above
  0.9 ink on < 5 % of the frame** with the weight and **> 40 % without it**
  (so the probe is shown to detect the fault it guards), coverage above 0.1
  within 5 points of the unweighted figure, and `weight(1) === 1`. Its
  "found the seven geometric shaders" count is unchanged — no shader is
  added. Grep the six files for the pre-pass so a seventh ring view added
  later without it fails the probe.
- `docs/built.md` — one dated note under entry 79.

**Done when**
- The probe's four new assertions pass, and its unweighted control still
  reports > 40 % solid.
- `pnpm probe:ripples`'s existing checks are unchanged.
- On a phone: a slow two-second drag across Circles, then Shards, leaves
  individual rings distinguishable for the whole afterlife and never a solid
  field of the layer colour; a single tap on each is indistinguishable from
  build 373.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:ripples`; then the phone,
each of the six views, drag then tap. No HUD surface is touched, so the
320×568 / 360×640 pass is not required.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 123. The opening name decode cannot be skipped by a slow first frame
`status: done` · added 2026-09-04 · build 448 · strengthens 99 · build in either order with 113 — whichever lands second re-runs `probe:name-decode` · **the ten-reload phone check is unverified — see build note**

**Do** — make both of `mountReleaseName()`'s decode loops advance on
*bounded per-frame time* instead of wall-clock time since mount, and put the
first-frame delay on the numeric readout so a skipped decode has a number.
**Why** — Victor: *"it doesn't work many releases, only saw it work once or
twice."* The animation is built, wired and correct (entries 55, 94, 99). It is
skipped whole whenever the main thread stalls for longer than the animation
lasts — which on a phone, on a cold load, is most of the time.

**Recon, in the order 1a requires.**
1. **The code exists and runs.** `version.ts:mountReleaseName` — phase one
   flips through `RELEASE_NAMES` for `NAME_FLIP_MS` (850 ms), phase two locks
   the real name at `NAME_LOCK_STEP_MS` (55 ms a character); an 11-character
   name is done in ~1.45 s. The reduced-motion path types at 3 characters a
   second. Both were verified by `probe-name-decode.ts` and on screen at
   build 352.
2. **What masks it: `const start = performance.now()` is taken at mount, and
   every frame computes `elapsed = now - start`.** Mount is `main.ts:645`.
   What follows it *synchronously* on the same tick: `resolvePrefs()`, a
   `shuffled()` roll, and **`createVisualiser()` at `:699`** — a
   `new WebGLRenderer` (context creation) and four `ShaderMaterial`s. Then
   the idle preview's first `render()` is where three.js actually compiles
   those four programs, so the *first* animation frame after mount is also
   the shader-compile frame. On a phone that is one to three seconds with
   nothing else running. The first `step()` call is synchronous and paints
   the oldest name; the next frame arrives with `elapsed` past the whole
   animation, and the loop's own exit — `if (locked >= target.length)
   { el.textContent = target; return }` — fires on that first real frame.
   **What is seen is the oldest name, a pause, then a cut to the real name.
   Nothing flips and nothing decodes.** A warm shader cache or a fast phone
   shortens the stall below 1.45 s, and the animation is seen — "once or
   twice". The reduced-motion path has the identical flaw with the identical
   `now - start`.
3. **Not a switch or device state.** Entry 99 already removed the
   `prefers-reduced-motion` dependency and added `#motion-glyph` so that
   state is visible on the gate; this is a different fault with the same
   symptom, which is why 99's verification passed and the report persists.
4. **The diagnosis goes on screen**, per CLAUDE.md's two-symptoms rule:
   "it didn't animate" is now three candidate causes — reduced motion (the
   glyph), a stall (this entry), or the loop never ran — and only a number
   separates the second from the third.

**Why entry 113 does not fix this on its own.** 113 makes the decode ten
times longer (8.5 s flip + 550 ms a character). A two-second stall then eats
a quarter of phase one rather than all of both phases, so the fault becomes a
jump rather than a skip — better, still wrong, and still invisible to any
probe, because the stall happens between frames on a real device. Both
entries are wanted and neither depends on the other: 113 changes the
constants, this changes the clock.

**Decided**
- The clock → **accumulate `elapsed += min(now − last, MAX_FRAME_MS)` each
  frame, `MAX_FRAME_MS = 50`.** Any gap longer than 50 ms — shader compile,
  GC, a hidden tab, a phone that drops to 20 fps — counts as 50 ms, so a
  stall *pauses* the decode rather than skipping it, and the animation is
  guaranteed to show every frame it has regardless of what else the page is
  doing. Over starting the clock at the first `requestAnimationFrame`
  instead of at mount, which fixes the init stall but not the compile stall
  on frame one, nor any later gap. **Mine.** 50 ms is the 20 fps floor: a
  phone genuinely rendering that slowly still sees real time; below that,
  the difference between "slow" and "stalled" is not one a person can see.
- Both paths → the reduced-motion typing loop gets the same clock. **Mine**:
  it has the same flaw, and entry 99's whole point was that path must
  actually be seen.
- The pure helpers `lockedCountAt` / `reducedLockedCountAt` → **unchanged**;
  the bounded clock is a new pure function beside them,
  `advanceDecodeClock(state, nowMs) → elapsedMs`, exported for the probe.
  113's changes to the constants those helpers read compose with this
  without conflict. **Mine.**
- Mount order in `main.ts` → **unchanged.** The synchronous first `step()`
  that paints the oldest name immediately is documented and right
  (`version.ts`'s own comment: *"an unstarted flip is a worse failure than
  one that has not finished"*). Moving the mount after `createVisualiser`
  would trade one stall for a blank span. The clock fix makes order
  irrelevant. **Mine.**
- Visibility → **no `document.hidden` branch.** A hidden tab gets no rAF and
  therefore no advance; the first frame back is clamped to 50 ms and the
  decode resumes where it paused. Falls out of the clock. **Mine.**
- The number → record **the gap from mount to the first rAF callback** and
  **the longest single frame gap during the decode**, and print them on the
  numeric readout as `decode first Nms  worst Mms`, one line, the same shape
  as `motion N ev  peak X/18`. Reached through the existing `panel.update`
  stats object like `samples` is; nothing on the gate itself changes.
  **Mine**: without this the next "it didn't animate" report is another
  five rounds of guessing, which is exactly what 99's build note describes.
- Back-forward-cache restore (`pageshow` with `persisted`) → **not this
  entry.** A page restored from bfcache shows the final name with no
  animation; that is a different path, was not reported, and would need
  its own decision about whether a *return* should replay an *arrival*.
  Recorded so it is not mistaken for this fault later.

**Identity when off** — with no stall, `min(now − last, 50)` equals
`now − last` on every frame and the accumulated clock equals wall time to
within a millisecond; the animation is unchanged frame for frame. The probe
asserts this directly.

**Lands in**
- `src/version.ts` — `mountReleaseName()`'s two `step` closures (full and
  reduced) read the new clock; the comment above `NAME_FLIP_MS` gains the
  reason wall-clock was wrong; a new exported `advanceDecodeClock` beside
  `lockedCountAt`; the two recorded gaps exposed by a small getter for
  `main.ts` to read (the same way `versionHudRunning` already is).
- `src/main.ts:645` — unchanged; `panel.update(...)` near `:1685` passes the
  two gaps.
- `src/hud.ts:1500-1512` — one readout line beside `motion N ev`.
- `scripts/probe-name-decode.ts` — a new section driving `advanceDecodeClock`
  with a synthetic frame sequence.

**Done when**
- The probe feeds 60 fps frames for 100 ms, then **one 2000 ms gap**, then
  60 fps to the end, through `advanceDecodeClock` → `lockedCountAt` and the
  phase-one index: the sequence of distinct phase-one names shown and of
  locked counts reached is **identical** to an unstalled run of the same
  frames — every locked count from 0 to the name's length appears, in order,
  none skipped. The probe also runs the *old* `now − start` arithmetic on
  the same sequence and asserts it yields a single frame after the gap, so
  the probe is shown to detect the fault it guards.
- Unstalled, the accumulated clock differs from wall time by < 1 ms at
  every frame (identity).
- The readout shows `decode first Nms  worst Mms` with real numbers on a
  phone.
- On a phone, **ten consecutive reloads from the reload chip** all show the
  history flip and then the left-to-right lock; zero cuts. The readout's
  `worst` figure on those loads is the evidence that a stall happened *and*
  was survived.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:name-decode`; then the ten
reloads above with the numeric readout on. The gate's own markup and CSS are
untouched, so the 320×568 / 360×640 pass is only for the readout line, which
is the HUD's and already wraps.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 125. The menu is a double tap again, and no gesture fires while the phone is moving
`status: done` · added 2026-09-05 · build 415 · **swaps the two assignments entry 115 shipped at build 407** · the calm gate is unverifiable off a phone — see build note · **Identity paragraph corrected by 126, build 450** — the gate is no longer permanently open on desktop

**Do** — put the menu back on the double tap, move camera arming to the still
hold, delete the two-finger opener, and refuse both gestures while the phone is
being shaken.

**Why** — Victor: *"require double tap for menu, shake is getting good, we
don't want the menu coming up accidentally."*

**Recon: the hold's stillness test cannot see a shake, and that is the whole
bug.** `main.ts:1549` measures the hold as
`hypot(clientX − downClientX, clientY − downClientY) <= HOLD_MENU_SLOP_PX` —
the finger's travel **relative to the screen**. During a shake the finger and
the screen move together, so a thumb resting on a violently shaken phone
travels approximately zero and satisfies that test *perfectly*. The 24px slop
is not a weak guard against this; it is not a guard against it at all. Three
and a half seconds of shaking with a thumb down opens the menu every time.

**And the two-finger path is worse.** `main.ts:1628` fires on
`nonChipDown === 2` the instant the second finger lands — no duration, no
stillness, no travel test of any kind. Two fingers gripping a phone that is
being shaken is not an edge case; it is how a phone is held.

**Recon also reconciles three instructions rather than picking the newest.**
Asked directly on 2026-09-04, Victor chose *"hold picture → armed (glyph
appears) · tap picture → one photo"* from a list. He then wrote *"touch hold to
open menu, and single tap (or double tap?) for camera arm"*, which entry 115
built. Today's instruction agrees with the **first** of those, not the second:
the menu on the double tap puts arming back on the hold, exactly where he first
put it. The middle instruction is the outlier, and this entry is a return to
the choice on either side of it rather than a reversal of a settled one.

**Decided**
- **Double tap opens the menu; the still hold arms the camera** → the two
  assignments entry 115 shipped swap places, and nothing else about either
  gesture changes: 3.5s and 24px stay exactly as they are, and the double tap
  keeps entry 67's down-to-down window and radius. `HOLD_MENU_S` and
  `HOLD_MENU_SLOP_PX` are renamed to `HOLD_ARM_S`/`HOLD_ARM_SLOP_PX`, since a
  constant named for the menu that arms a camera is the kind of name that
  survives into being read as a decision. **Mine** as to the rename only; the
  swap is Victor's.
- **The two-finger tap stops opening the menu, and is not replaced** →
  deleted, not gated. **Mine**, and it is the direct reading of *"require
  double tap"*: a second way in that needs no duration and no stillness is
  exactly the accidental opener he is describing. Entry 115 kept it on the
  argument that *"removing a working way into the menu in the same entry that
  moves the primary one is how a build ends with no way in at all"* — that was
  right then and does not apply now, because the primary is moving **to** the
  gesture people already know rather than away from it.
- **Neither gesture fires while the phone is disturbed** → a shared gate:
  `disturb > 0.35` blocks both the menu and the arm, and keeps blocking for
  **0.4s** after it was last exceeded. **Mine**, and it is the part that
  answers his stated *reason* rather than only his stated fix — a double tap is
  harder to trigger by accident than a hold, but two thumb bounces inside entry
  67's window during a hard shake are not impossible, and without this the
  accident simply moves from the menu to the camera, where it costs a
  photograph instead of a panel.
- **0.35, because walking peaks at 0.15** → `shake.ts:255` records that
  measurement in its own comment (*"walking peaks at disturb 0.15, well under
  LEVEL"*), so 0.35 clears an ordinary gait by better than 2× while a
  deliberate shake — which saturates `disturb` near 1.0 — is blocked
  decisively. **Mine**, and derived from a number already in the file rather
  than picked.
- **0.4s of settle** → long enough that the dying swing of a shake does not
  re-open the gate between two beats of the same gesture, short enough that the
  menu is there the moment the phone stops. **Mine.**
- **The gate reads `latestShake.disturb`, which `main.ts` already holds** → no
  new sensor path, no new module, no change to `shake.ts`. **Mine**: the value
  is already sampled every frame for the colour bias and the slip, and a second
  opinion about how much the phone is moving is the exact drift entry 111's own
  Decided argued against.
- **`?debug` gains the gate** → the readout says whether gestures are currently
  blocked, and how long since `disturb` last exceeded the threshold. **Mine**,
  and it is CLAUDE.md's *two identical symptoms need two different numbers*:
  "the menu won't open" will otherwise be indistinguishable from "the double
  tap wasn't recognised", and this map has now changed twice in two days.
- **Entry 117 needs no change in substance** → its desktop map (right click
  opens the menu, left click arms) is untouched by any of this, and its *"no
  hold on the mouse"* decision still holds for the reason it gave — a mouse has
  a second button. Only that clause's aside about the finger's hold being the
  menu path goes stale. 117 is `status: building` as this is written, so it is
  deliberately **not edited here**; whoever finishes it should fix the aside
  and nothing else. **Mine.**

**Identity when off** — on a still phone `disturb` is 0, because `FLOOR` in
`shake.ts` is 1.2 m/s² and a phone at rest reads under it, so the gate is open
and both gestures behave exactly as they do today apart from the swap. ~~A
machine with no accelerometer reports `disturb` 0 forever, so the gate is
permanently open on desktop~~ — **corrected by entry 126, which this
paragraph's own instruction asked for:** a desktop with no accelerometer now
also has a real `Tumble`, fed by the space bar rather than a sensor, so a
*held* space bar saturates `disturb` exactly as a real shake does and this
gate closes on desktop too while it is held — correctly, since a held space
bar is the desktop's own version of "the phone is being shaken". It clears
again the same 0.4s after release that it does on a phone. Entry 117's mouse
map still pays nothing for this existing, because a mouse produces no
`devicemotion` and drives no synthetic feed either — only the keyboard does.

**Lands in** — `src/main.ts`: `HOLD_MENU_S`/`HOLD_MENU_SLOP_PX` renamed, and
their `panel.open()` at `:1561` becomes `enterCameraMode()`; the double-tap
resolution's `enterCameraMode()` becomes `panel.open()`; the
`nonChipDown === 2` branch at `:1628` deleted, and the `nonChipDown` counter at
`:1525`/`:1536` with it **if nothing else reads it** — check before removing,
per CLAUDE.md's *deleting code deletes what it was doing*; the new calm gate
and its two constants; the `?debug` line. `scripts/probe-tap.ts` and
`scripts/probe-touches.ts`: every assertion about which gesture opens the menu
is now asserting the old map and must be swapped, not merely extended.

**Done when** — on the phone, the case that prompted this: **shake it hard for
five seconds with a thumb resting on the screen, and neither the menu opens nor
the camera arms** — `?debug` shows the gate blocked throughout. Then, standing
still: a double tap opens the menu; a 3.5s still hold shows the camera glyph
and the next tap saves exactly one frame; two fingers do nothing at all; a
single tap still plays. Walking on the spot while double-tapping still opens
the menu — that is the case 0.35 is chosen to let through, and the one a
tighter threshold would silently break. `pnpm probe:tap` and
`pnpm probe:touches` assert the swapped map and fail against the old one.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:tap`, `pnpm probe:touches`,
`pnpm probe:camera-arm`, `pnpm probe:shake` (which must pass unchanged — this
reads `disturb` and must not alter it). Then the phone, shaken, which is the
only place the report can be reproduced and the only place the fix can be
believed: a desktop browser reports `disturb` 0 forever and therefore cannot
exercise the gate at all. No HUD surface changes, so no 320×568 pass is owed.

**Hard stops** — prefs no · url no · **capture yes, and in the safe
direction**: arming moves from a double tap to a 3.5s still hold *plus* the new
calm gate, so a photograph becomes strictly harder to reach than it is at build
407, not easier. Every existing guard survives — one shot per arm, the rate
limit, the 15s quiet disarm, the five-minute ceiling · dependency no.

### 126. The space bar is a shake, and holding it is a shake that keeps going
`status: done` · added 2026-09-05 · build 450 · replaces the space bar's direct re-seed · interacts with 125 — see Decided (corrected there) · **"holding scrambles repeatedly" and Done-when's "at least three in two seconds" do not hold against the real Tumble — see build note and follow-up entry 143**

**Do** — make the space bar synthesise accelerometer samples into the real
`Tumble`, so it tumbles, disperses and re-seeds exactly as a shake does; held
down, it keeps shaking for as long as it is held.

**Why** — Victor: *"in desktop make spacebar act like a shake, a continuously
pressed spacebar like a repeating hard shake."* Today it calls
`visualiser.randomise()` and nothing else — the one thing a shake does that
leaves no trace of having been a shake.

**Recon: the injection point already exists and is already live on desktop.**
`requestMotionAccess()` (`shake.ts:873`) returns `true` on any browser where
`DeviceMotionEvent` is defined and carries no permission gate — which is
desktop Chrome — so `startShake(true)` builds a **real `Tumble`** and attaches
a `devicemotion` listener that simply never fires. The springs, `disturb`, the
gravity estimator and the STRONG/DOUBLE detector are all constructed and
ticking on a laptop right now, receiving nothing. Feeding them one synthetic
sample per frame is therefore the whole feature: the tumble, the RGB slip
(entries 76/104/111), the colour bias (58), the re-seed and the double-shake
scramble all follow with no further wiring.

**Two things that would go wrong if it were only that, and both are found
rather than guessed:**

- **`hasMotionData()` must stay false.** It reads the sample count, and entry
  110's Strata uses it to tell *"lying flat"* from *"there is no sensor here"*,
  with the interface comment naming entry 116's camera-arm as the identical
  test. Synthetic samples would tell both that a laptop has an accelerometer.
- **The gravity-free feed is safe, and the file says so.** `onMotion`'s own
  comment: *"the estimator converges on whatever DC the signal has, which for a
  gravity-free feed is ~0, and it subtracts that."* So injecting pure AC needs
  no special case — and with `az` at 0 the tilt stays (0, 0), which is what
  keeps entry 30's gravity offset and entry 102's falling emitters from
  acquiring a fake "down" on a machine that has none.

**Decided**
- **Synthesised samples into the existing `Tumble`, not a parallel effect** →
  **Mine**, over reproducing a tumble from the keyboard: every motion consumer
  in the app reads `disturb` or the `ShakeFrame`, so one injection point gives
  all of them the real behaviour, and any consumer added later gets it for
  free. Reproducing it would be a second definition of what a shake is.
- **Driven per frame, not by key auto-repeat** → `keydown` sets a held flag
  (ignoring `e.repeat`), `keyup` clears it, and the synthesis runs from the
  render loop. **Mine**: auto-repeat rate is an OS setting, so a shake built on
  it would be a different shake on every machine.
- **`window` `blur` ends the shake** → **Mine**, and it is the specific bug
  this shape always has: a key released while the tab is not focused sends no
  `keyup`, and without this the picture shakes forever with nothing on screen
  explaining why and no way to stop it but a reload.
- **26 m/s², and the number is derived** → `STRONG_UP` is 18, but entry 88's
  adaptive bar *rises* to `STRONG_UP_BUSY` = 20 as the phone reads busy — and a
  held space bar is precisely what makes it busy. An amplitude that only just
  cleared 18 would fire once and then go quiet as the bar climbed past it,
  which reads as the feature breaking after the first press. 26 clears the busy
  bar by 30%. **Mine.**
- **5 Hz** → `shake.ts`'s own probe table already calibrates *"deliberate shake
  (28 m/s², 4 Hz)"* and *"violent shake (45 m/s², 6 Hz)"*; 5 Hz sits between
  them, so the synthetic gesture lands inside the range the detector was
  actually tuned against rather than outside it. **Mine.**
- **A tap is one burst of 0.35s; holding simply does not stop** → about two
  cycles at 5 Hz, enveloped so it rises and falls rather than starting and
  stopping at full amplitude. **Mine**, and the held case needs no repeat logic
  of its own: a continuous 26 m/s² at 5 Hz *is* a repeating hard shake, and how
  often it re-seeds is then governed by `shake.ts`'s existing cooldown and
  double-window rather than by a new rate limit invented here.
- **A new in-plane bearing per press, held for that press** → **Mine**: the RGB
  slip holds a direction (entry 104) and needs one that stays put across a
  gesture, and a bearing re-rolled every frame is exactly the oscillating input
  entry 104 was written to stop reading.
- **The direct `visualiser.randomise()` call goes** → the space bar re-seeds
  *through* the shake, because a hard shake already re-seeds. **Mine**, and it
  is the request: a space bar that re-seeded directly *and* shook would fire
  two re-seeds for one press. Note the consequence plainly — **holding space
  will now scramble the look repeatedly, not merely re-seed once**, because a
  double shake is a full scramble (`main.ts:1648`). That is what "repeating
  hard shake" means, and it is intended rather than overlooked.
- **`startShake` builds the real `Tumble` even when motion is refused** → today
  a refused or absent `DeviceMotionEvent` returns a stub whose `frame()` is a
  constant, and the space bar would do nothing there. **Mine**: only the
  *listener* should be conditional, never the machinery, and `hasMotionData()`
  keeps reporting the truth about the sensor either way.
- **`hasMotionData()` reads a flag set only in `onMotion`** → not the sample
  count. **Mine**, and see Recon: it is the one line that keeps a synthetic
  shake from telling Strata and the camera arm that a laptop has an
  accelerometer.
- **`?debug` marks synthetic samples** → the existing `motion N ev` readout
  gains a `key` marker while the space bar is driving. **Mine**, CLAUDE.md's
  *two identical symptoms need two different numbers*: "the space bar does
  nothing" is otherwise indistinguishable from "the samples arrive but never
  clear the bar", which is exactly the failure the 26 m/s² decision above
  exists to avoid.
- **Its own pure module** → `src/engine/synth-shake.ts`, `createSynthShake` /
  `updateSynthShake(state, dt, held)` returning a sample or `null`. **Mine**:
  the amplitude, the envelope and the bearing are the parts that can be wrong,
  and none of them is testable inside a `keydown` listener. `pnpm
  probe:synth-shake` drives a **real `Tumble`** with them, which is the only
  assertion that actually proves the feature works.

**Identity when off** — `updateSynthShake` returns `null` on every frame the
space bar is not held, and nothing is pushed, so the `Tumble` receives exactly
what it receives today: nothing on a desktop, real events on a phone. A phone
with no keyboard sends no `keydown` and is untouched. `hasMotionData()` is
unchanged for every real device, because the flag it now reads is set in the
same handler that used to be the only thing incrementing the count.

**Interaction with entry 125, stated rather than left to be discovered** — 125
(`ready`) blocks the menu and the camera arm while `disturb` exceeds 0.35, and
its Identity section reasons that *"a machine with no accelerometer reports
`disturb` 0 forever, so the gate is permanently open on desktop."* This entry
makes that no longer true: while space is held, `disturb` saturates and the
gate closes on desktop too. That is correct — you are shaking — and it clears
0.4s after release. Whoever builds the later of the two should correct 125's
Identity paragraph rather than either behaviour.

**Lands in** — `src/engine/synth-shake.ts` (new); `src/engine/index.ts` (its
exports); `src/shake.ts:964` (the stub path keeps the real `Tumble`; a
`pushSample` on `ShakeSensor`; `hasMotionData` reads its own flag);
`src/keyboard.ts` (`keyAction`'s `'randomise'` becomes `'shake'`,
`KeyboardHandlers` gains start/end, the `blur` listener); `src/main.ts:1188`
(the handler) and its render loop (the per-frame push); the `?debug` line.
`scripts/probe-keyboard.ts` (the renamed action) and
`scripts/probe-synth-shake.ts` (new), plus `package.json`.

**Done when** — `pnpm probe:synth-shake` asserts, headless, against a **real
`Tumble`**: a single 0.35s burst produces **exactly one** `strong` event; two
seconds held produces **at least three**; an unheld state produces **zero**
samples and leaves `disturb` at exactly 0; the peak magnitude reaches at least
26 m/s²; the held bearing does not reverse through a burst (the property entry
104 asserts for a real shake); and `hasMotionData()` is **false** throughout,
which is the assertion that would fail if the sample count were reused.
`pnpm probe:keyboard` still passes with the action renamed. On a desktop
browser: one press tumbles the picture, disperses the colour channels and
re-seeds; holding scrambles repeatedly; releasing settles within about a
second; and pressing space, switching tabs, releasing it there and coming back
leaves the picture still — the `blur` case.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:synth-shake`,
`pnpm probe:keyboard`, and `pnpm probe:shake` **unchanged** — that last one is
what proves a real phone's shake is untouched, which is the regression this
entry could most easily cause and the one no desktop check would catch. Then a
desktop browser, watching the picture rather than the console. Then a phone,
confirming a real shake still behaves and that `?debug` does not show the `key`
marker. No HUD surface changes, so no 320×568 pass is owed.

**Hard stops** — prefs no · url no · capture no (the space bar reaches no
capture path; entry 117's left click is what arms, and 125's gate — once built
— makes a held space bar *block* arming rather than assist it) · dependency no.

### 127. The sun chip goes; the clock keeps the sky
`status: done` · added 2026-09-05 · build 454 · **retires the control built by 71** · helps 119 rather than conflicting with it

**Do** — remove the sun chip and the manual sky override behind it. The
automatic clock-driven day/night stays exactly as it is.

**Why** — Victor, asked whether the chip earns its place: **yes, remove it.**
It is the only chip that corrects a guess rather than doing something you asked
for, and the guess is right nearly all the time.

**Recon: this project already has a way to retire a stored preference, and it
is in the same file.** `prefs.ts:105` carries a `day` boolean marked
*"Superseded by `skyOverride` below (entry 71) and no longer written"* — kept in
the shape, still validated, simply never set. `skyOverride` follows it. That is
what keeps this **out of Hard Stop 1 entirely**: no field is removed, retyped
or repurposed, so no visitor's `localStorage` is reset or misread.

**Counted, not recalled:** the outer ring holds **three** chips today — `num`,
`grav`, `day` — the shutter having gone with entry 115 at build 407. After this
it holds two.

**Decided**
- **The stored field stays; it stops being read** → `prefs.skyOverride` keeps
  its type, its validation and its `'auto'` default, and the app behaves as if
  it always says `'auto'`. **Mine**, over deleting the field: deleting is a
  Hard Stop and buys nothing, and the `day` boolean two lines above it is the
  precedent for exactly this.
- **Anyone currently pinned is released, not stranded** → a visitor whose
  stored value is `'day'` or `'night'` returns to automatic on their next load.
  **Mine**, and it is the reason "leave the field and keep honouring it" is
  wrong rather than merely lazy: with the chip gone, honouring a stored
  `'night'` would pin someone to the dark look **permanently, with nothing on
  screen able to undo it**. That is the worst outcome available here and it is
  the one the laziest version produces.
- **The override machinery goes with the control** → `setSkyOverride` off the
  `Visualiser` interface (`scene.ts:483`), the `onSkyOverride` handler
  (`main.ts:1168`), and the override fade at `scene.ts:1000-1002` whose
  `overrideTarget` can now only ever be 0. **Mine**, and CLAUDE.md's *deleting
  code deletes what it was doing* is answered explicitly: that fade existed to
  smooth the **chip's** transition between pinned and automatic, and with no
  chip there is no transition to smooth. The clock's own per-second sampling
  (`SKY_SAMPLE_S`) is a different path and is untouched — it is what still
  moves the sky.
- **The icon goes too** → `ICONS.day` (`hud.ts:384`), the paint branch at
  `:1265`, and the `aria-label` cycle at `:1272`. **Mine**: an icon with no
  chip is dead weight, and this set is a deliberate visual vocabulary rather
  than a library.
- **The cost, stated plainly and accepted** → **there will be no way to force
  the bright, outdoor-readable look.** If the clock says night and you are
  standing in sunlight, the screen is hard to read and nothing will fix it.
  That is the case the chip existed for, it is uncommon, and Victor's answer
  above is the decision. Recorded here rather than discovered later.
- **The ambient light sensor is not a replacement, and should not be presented
  as one** → entry 98's sensor reads real brightness, but it drives
  `uExposure` (dim/brighten) and not `uDay` (the ink-on-paper switch), and it
  exists only on Chrome for Android. **Mine** to state it, so nobody closes
  this gap by assuming the sensor already covers it. Making the sensor drive
  `uDay` is a coherent future entry and is deliberately not this one.
- **Entry 71 records its own retirement** → its `status:` line gains
  `· control retired by 127`. **Mine**, per the both-ends rule: 71 built the
  three-state override, is marked `done`, and would otherwise read as
  describing a control that exists.
- **This is not entry 119's fix and does not pre-empt it** → 119 makes
  `chipPosition()` derive its arc from the viewport so no chip is clipped in
  landscape. Removing one chip makes the crowding milder and fixes nothing:
  the two that remain can still be clipped. **Mine**, and it is worth saying
  because "we removed a chip" is exactly the kind of thing that gets a real
  layout bug closed as fixed.

**Identity when off** — not a modulation, but the claim it needs is stronger
than usual: for the overwhelming majority of visitors, whose stored
`skyOverride` is already `'auto'`, the rendered picture is **bit-identical**
before and after, because `overrideTarget` was already 0 for them and the fade
was already contributing nothing. Only a visitor who had actively pinned day or
night sees a change, and that change is a return to the automatic behaviour.
The clock, the warmth term, entry 98's exposure and every other layer are
untouched.

**Lands in** — `src/hud.ts:384` (`ICONS.day`), `:1046-1056` (`dayChip`),
`:1265` (the paint branch), `:1272` (the label), and `onSkyOverride` off the
handlers type; `src/main.ts:117`/`:180`/`:722` (stop threading it) and `:1168`
(the handler); `src/scene.ts:336`/`:340`/`:483`/`:807`/`:1000-1002` (the
option, the interface method and the fade — `:807`'s initial `uDay` seed
becomes `skyForNow.daylight` unconditionally); `src/prefs.ts:121` (a comment
marking the field retired, beside the `day` one that says the same thing).

**Done when** — the HUD's outer ring shows **two** chips, correctly spaced, and
no sun icon appears anywhere; the string `skyOverride` appears in `prefs.ts`
and nowhere else in `src/`; a profile with `skyOverride: 'night'` written into
`localStorage` by hand loads and shows the **automatic** sky rather than a
pinned dark one, and still parses without error; and across a simulated day the
picture still goes bright at midday and dark at 2am, which is the behaviour
this entry must not touch.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:sky` (the clock path, which
must pass **unchanged** — it is the thing being kept, and a probe that changes
here means the wrong half was removed). Then `hud-narrow.html` at **320×568 and
360×640**, in every panel state, because the outer ring respaces and CLAUDE.md
requires the assembled surface to be looked at rather than reasoned about —
this is precisely the *check the assembly* case, one chip's removal changing a
layout nobody's diff would show.

**Hard stops** — prefs **no**: `skyOverride` keeps its name, type, meaning and
default and is still validated on load; it merely stops being written and read,
exactly as the `day` boolean above it already does · url no (there has never
been a sky parameter — `?geometric= ?atmospheric= ?view= ?rgb= ?mix= ?mapping=
?auto= ?debug=` is the whole list and none of them is this) · capture no ·
dependency no. The control surface loses a control and gains none, so the
circular constraint is not engaged.

### 128. On an iPhone, no tap on the picture has played since build 277
`status: done` · added 2026-09-05 · build 429 · found at build 416 while checking touch response

**Do** — stop `goFullscreen()` recording a *want* for fullscreen on a platform
that has no element Fullscreen API, so entry 80's tap gate can never be held
shut by a request that could never succeed.
**Why** — `fsBlocking = fullscreenStatus().want && !document.fullscreenElement`
(`main.ts:1525`) drops every non-chip tap — no emitter, no stream, no
resolution (`:1576`, `:1642`) — so that the tap can re-request fullscreen
instead. On iPhone Safari there is no `requestFullscreen` on elements:
`goFullscreen()` sets `wantFullscreen = true` **and then** discovers that
(`permission-gate.ts:214-219`, state → `'unsupported'`), `want` stays true for
the life of the page, `document.fullscreenElement` is always `undefined`, and
the gate is shut on every frame. **Every geometric view has been touch-dead
on an iPhone since entry 80 landed at build 277.**

**Recon.** Not a report of "touch is lost" being taken at face value: all seven
geometric views were rendered at build 416 with the same synthetic
`setTouches()` contact and every one answered at the finger (mean pixel change
0.6–11.6 against a 0.0–0.1 time-only baseline). The rendering is fine. The
input layer has three ways to consume a tap; this is the one that is a bug
rather than a decision. `scripts/probe-fullscreen.ts:220-232` already has a
"no API" section and asserts `attempts === 0` and `armed === false` — and
does **not** assert `want === false`, which is exactly the fact the gate
reads. The probe passes today because nobody wrote the one line that would
have failed. Entry 80's own Decided records the gate as *"fullscreen has
right of way"* over a tap; it did not consider a platform where fullscreen
can never arrive, and the `?debug` readout on such a phone says exactly that
— `full unsupported want` — without anyone having read it.

**Decided**
- Where the fix goes → **`goFullscreen()`: test for the API first, and only
  then set `wantFullscreen`.** Over special-casing `'unsupported'` inside
  `fsBlocking` in `main.ts`. **Mine**: `want` is defined at
  `permission-gate.ts:93-99` as *"the one desire … true from the moment
  anything first asks for fullscreen"*, and a desire for something the
  platform cannot provide is not a state the rest of the app should have to
  know how to read around. Fix the fact, not every reader of it.
- The `'unsupported'` state itself → **unchanged**; it is what the readout and
  the fullscreen chip already key on, and it stays true.
- The powder egg's own `goFullscreen()` call (`main.ts:818`) and the gate's →
  both go through the same function; nothing else to change.
- `want`'s "nothing here ever sets it back to false" comment (`:96-98`) →
  **still true**; this entry never *sets* it false, it declines to set it true.
  The comment gains one sentence saying so.

**Identity when off** — on any platform with the API, `requestFullscreen` is
present, `want` is set exactly as today on the same line's next statement,
and the probe's granted/refused/recovered sections are byte-identical.

**Lands in** — `src/permission-gate.ts:214-219` (reorder two statements, one
comment); `scripts/probe-fullscreen.ts:220-232` — add `no API → want is
false` beside the two existing "no API" checks, **and run it before the fix
to confirm it fails**, since a check that has never failed has never been
shown to test anything. CI already runs `probe:fullscreen`.

**Done when** — the new probe assertion fails at build 416 and passes after;
on an iPhone, with the readout on, the fullscreen line reads
`full unsupported` with **no `want`**, and a tap on Circles draws a ring.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:fullscreen` (both before
and after); then an iPhone. No HUD surface is touched.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 129. The tap after a hold is a shutter, not a play — is that the price?
`status: blocked` · added 2026-09-05 · found at build 416 with the entry above · **needs Victor** · concerns 115 and 125

**Do** — nothing yet. This puts a cost to Victor that entries 115 and 125 each
recorded and neither put to him.
**Why** — since build 415 a finger held still on the picture for **3.5 s**
(`HOLD_ARM_S = CHARGE_TIME + 1.0`, within 24 px, phone calm) arms camera
mode. The confirmation is a 1.4 px-stroke circle at **25 % opacity** over a
moving picture. **The next tap on the picture then saves a PNG and exits;
it does not play.** `main.ts:1390`'s own comment: *"fatten rings now ends in
the camera arming at 3.5s. That is a real loss to the play gesture and there
is no version of hold-does-something without it."* Pressing and holding is
also exactly how the picture was tested yesterday, and the tap after such a
hold looks like a mode that has stopped answering.

**The question**
> A still 3.5 s hold arms the camera, and the following tap takes a photo
> instead of playing. That is a deliberate trade both 115 and 125 made on your
> behalf. Is the trade right, and if not, which side of it moves?

**Costed, so the answer is one choice**
- **Keep it, and make the armed state impossible to miss.** The gesture map
  stands; `#shutter-glyph` goes from 0.25 to something that reads across a
  room (0.7, with the existing 180 ms pulse on arm), so the "dead" tap is
  never a surprise. Cheapest; changes nothing about what a hold means.
- **Lengthen the hold.** `HOLD_ARM_S` to 5 s: a casual rest of the thumb no
  longer arms, a deliberate one still does. Costs the hold gesture nothing it
  has not already lost — charge is full at 2.5 s either way — but "hold to
  arm" gets slower to reach, and this is the third value the constant would
  have had in three days.
- **Arming does not eat the next tap.** The shot fires *and* the tap plays: a
  ring is born at the finger as the frame is saved, so the picture always
  answers and the photograph is a bonus. Entry 87's *"one shot, then done"*
  stays; only the ring is added back. Changes what a photograph of a tap
  contains — it will contain the ring.
- **Move arming off the hold altogether.** There is no fourth finger gesture
  left that is not already spoken for (tap plays, double tap opens the menu,
  press+shake is entry 121's), so this means the HUD again or a desktop-only
  camera; 115 removed the chip on your instruction. Recorded for completeness;
  not recommended.

**Decided in advance**
- Whatever the answer, the calm gate (125) and the desktop map (117) are
  untouched — neither is the cost being asked about.
- If the answer is "keep it", the glyph change is a one-line CSS edit and this
  entry closes as `done` with the answer recorded, so the cost is not
  re-found and re-raised.

**Lands in** — depends on the answer: `index.html:217-229` (`#shutter-glyph`
opacity) for the first; `main.ts:1394` for the second; `main.ts:1655-1670`
(the `cameraMode` branch's `continue`) for the third.
**Done when** — Victor has answered and the answer is recorded here; then the
chosen change's own check: on a phone, hold 3.5 s, then tap — what happens is
what he chose, and he can see the armed state from arm's length.
**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:tap`; then the phone.
**Hard stops** — prefs no · url no · capture no · dependency no.

### 130. The lattice's timbre reaches its shape, not only its hue
`status: done` · added 2026-09-05 · build 456 · the same diagnosis as 32, one tier up · lattice only

**Do** — give the two continuous shape parameters an audio term each:
`uRoughness` thickens the tunnel's shell density, `uTilt` tightens its spiral.
Both additive on top of the existing breath, neither replacing it.

**Why** — Victor: *"review how lattice changes shape and how music shapes it,
and make it more dynamic flow."* The review is below and it has a clean answer:
every timbral feature the shader reads lands in colour.

**The review, counted rather than recalled**

*What is already musical, and genuinely is:* `uFlow` appears **9 times** and is
not a clock — `scene.ts:1316` builds it as
`churn = 0.06 + level*0.95 + transient*0.6 + surge*1.5`, integrated per frame
and stalled 85% by a breakdown. So the drain speed down the tunnel, which is
the lattice's dominant motion, is played. Entry 32 then deepened the fast and
loud tiers: `uTransient` got a global node-brightness term, `past`'s weight in
`nodeR` went 0.5→1.0, the filament width's `uLevel` term went 9→14.

*What is frozen, and must stay frozen:* `SYMMETRY` (4..9) and `ACROSS` (3..6)
are integers consumed by `floor()` and `mod()`. They cannot be animated
continuously without the whole figure jumping a sector at each step. The
discrete skeleton being seed-only is a fact about the construction, not an
omission — see Decided.

*What is nominally continuous but barely moves:* only two parameters are free
— `DEPTH` and the twist rate — and both are driven by decorative sines on the
flow clock and nothing else:

| parameter | line | base | its only continuous motion | swing |
|---|---|---|---|---|
| `DEPTH` (shells per unit log-radius) | 152 | 1.6 .. 3.2 | `0.18 * sin(uFlow * 0.07)` | **±6–11%** |
| twist rate | 161 | 0.16 | `0.06 * sin(uFlow * 0.11)` | ±37% of a small term |

*And the finding:* **`uTilt`, `uNovelty` and `uRoughness` appear exactly once
each in the body — lines 334 and 339 — and all three compute hue.** Not one of
the three timbral features touches geometry anywhere. That is entry 32's own
diagnosis restated one tier up: 32 found the transient confined to a thin ring
and fixed the rhythmic tier; the *timbral* tier is still entirely a colour
signal. So, as in 32, the fix is coupling depth and no new uniform is needed.

**Decided**
- **Additive, on top of the two sines — they are not replaced** → `DEPTH`'s and
  the twist's existing `sin(uFlow …)` terms stay exactly as they are. **Mine**,
  and a reasoned comment is what decides it: `lattice.frag.glsl:150` calls the
  sine *"a permanent breath, independent of any reshape, so the tunnel is never
  perfectly still even through a long unchanging stretch of the track."* That
  is a deliberate answer to silence and to a static passage, and CLAUDE.md is
  explicit that such a comment outranks an entry that did not know about it.
- **`uRoughness` → shell density**, `DEPTH += 0.55 * clamp(uRoughness, 0.0,
  1.0)`. **Mine**: against a 1.6–3.2 base that is up to +17–34% more shells
  down the tunnel, which is the same order as the seed's own range rather than
  a new extreme, and density is what a gritty, noisy texture ought to read as —
  the tunnel packing tighter. Bounded above by construction, so it can never
  collapse the log-polar step toward zero.
- **The clamp is load-bearing, not decoration** → **Mine**, and it is the one
  detail a straight `+ 0.55 * uRoughness` would get wrong invisibly. This
  project's features deliberately refuse to answer rather than guess:
  CLAUDE.md names `spectralFlatness` returning **-1 on silence** *"rather than
  reporting a quiet room as maximum noise"*. An unclamped negative would make
  the tunnel **thinner than its own base in a silent room** — the opposite of
  the intent, and invisible to any test that only ever plays music. Clamping at
  the point of use also means the entry does not have to assert a range it did
  not measure.
- **`uTilt` → twist rate**, the rate term becoming
  `0.16 + 0.06 * sin(uFlow * 0.11) + 0.10 * clamp(uTilt, 0.0, 1.0)`. **Mine**:
  up to +63% on the base, so a bright, treble-led passage visibly coils the
  lattice tighter and a bass-led one lets it run straight — and spectral tilt
  is the slowest and most expressive thing the shader reads, which is what
  makes it right for the parameter that shapes rather than flickers. Clamped
  for the same reason as above, and matching line 334, which already clamps
  `uTilt` where it uses it.
- **`SYMMETRY` and `ACROSS` are deliberately not animated** → **Mine**, and
  written down so nobody tries: they are integers inside `floor()`/`mod()`, so
  any continuous drive makes the whole mandala jump a sector at every integer
  crossing. The seed changing them at a structural boundary — which is already
  what happens — is the only way they can move without popping.
- **The whole-frame scale is not touched** → entry 32 refused it in writing:
  *"whole-frame scale is the one coupling that turns responsive into
  nauseating, and it is already the largest single geometric swing in the file.
  If the result still reads as flat, the answer is another emissive term, not
  more zoom."* Unchanged by this entry, and quoted so it is not reopened.
- **`uNovelty` stays on hue** → **Mine**: a real structural boundary already
  re-rolls the seed, which changes symmetry, density and twist together, so
  novelty's structural job is done by the biggest lever in the shader. A second
  novelty term on geometry would fire at the same moment and read as the same
  event twice.
- **This view only** → the same scope clause entry 32 wrote, for the same
  reason. `chorus`, `grid`, `shards`, `tide` and `circles` are thinner still,
  and whether that is restraint or the same gap is a separate entry.

**Identity when off** — both new terms are `clamp(x, 0, 1)` multiplied by a
coefficient and added, so in silence — where the features read 0, or the
negative that means *no answer* — each contributes exactly 0 and the shader is
bit-identical to today. The identity falls out of the clamp rather than being
guarded by a branch, and the clamp is there for the refusal case anyway, so
there is no separate guard to forget.

**Lands in** — `src/shaders/lattice.frag.glsl:152` (`DEPTH`) and `:161` (the
twist rate), plus their comments, which currently describe the sines as the
only continuous motion and will no longer be telling the whole truth. Nothing
else: no uniform, no `scene.ts` change, no mapping change.

**Done when** — driven from `views-probe.html` with synthetic params, all else
held: a `uRoughness` sweep 0→1 **visibly adds shells** down the tunnel and the
shell count at a fixed radius increases monotonically; a `uTilt` sweep 0→1
**visibly tightens the spiral**, measurable as the angular offset of a fixed
shell against its neighbour; `uRoughness = -1` renders **pixel-identical** to
`uRoughness = 0`, which is the refusal case; and an all-zero param set renders
**pixel-identical to the current build**. Then real music: a bright passage and
a bass-heavy one produce visibly different tunnel geometry, not only different
colour — which is the thing the eye has been failing to see and the reason this
entry exists.

**Verify** — `pnpm build`, `pnpm lint`, and `pnpm probe` **unchanged** (the
mapping is untouched; if its numbers move, something other than this shader
changed — entry 32's own Verify makes the same point for the same reason).
Then `views-probe.html`, every atmospheric view side by side from identical
synthetic audio, and **look at it**: CLAUDE.md's `Fringe` lesson is exactly
this case — a shader that compiles, passes a pixel readback and still draws the
wrong figure. Specifically watch the kaleidoscopic fold's seams as the twist
term grows, since `abs()` mirrors each sector and a shear that is smooth in
screen space is not automatically smooth across a mirror line. No HUD surface
changes, so no 320×568 pass is owed.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 131. Strata comes out: the sand was a misreading
`status: done` · added 2026-09-05 · build 435 · **reverts 110 (build 386) and closes 124** · build before 132 · **`setMotion`'s fourth argument came out too — see build note**

**Do** — remove the Strata view and everything that exists only for it, and
leave in place the two things entry 110 built that other entries now depend
on.
**Why** — Victor: *"oh no, you added sand on top of everything? that's not what
I wanted, it was just a suggestion on the dynamics."* Entry 110 read "use the
axis detection to change the display … take inspiration from those sand art
frames" as *a sand picture* and built a view. The sand frame was the
**dynamics** — how things fall and settle when the phone is upright and hang
when it is flat — and the display it was meant to change was the one already
there. Entry 132 is what the instruction actually asked for; this entry clears
the misreading out of the way first.

**Owned here, not only in chat.** The misreading was the capture agent's (this
session's), not the builder's: 110's Decided argued *"a new view, over gravity
applied to the existing picture"* and marked it **Mine**, on the grounds that
the existing picture was approved and a feedback render target was missing.
Both facts were true and neither was the question. The rejected option was the
instruction.

**What comes out** — everything in build 386 (`11ec8c5`) that exists for the
view, and nothing else:
- `src/engine/sediment.ts`, `src/shaders/strata.frag.glsl`,
  `scripts/probe-sediment.ts`; the `probe:sediment` line in `package.json`;
  the `strata` entry in `views.ts`'s `ATMOSPHERIC_VIEWS`; the `uSediment`
  texture and its per-frame `updateSediment` in `scene.ts`; the sediment
  exports in `engine/index.ts`.
- Entry 124 (*the autopilot cannot reach Strata*) → `status: closed` with the
  reason: there is no Strata for it to reach. No decision from Victor is
  needed any more; the question it asked dissolves.

**What stays** — two things 110 built that were right and are now load-bearing
elsewhere:
- `src/engine/tilt.ts` and `isFlatTilt()` — `camera-arm.ts` imports it in
  place of its own `AIM_TILT_MIN`; removing it would re-duplicate the constant
  CLAUDE.md says not to duplicate.
- `shake.hasMotionData()` and the fourth argument to `setMotion()` — entry 120
  reads it for the camera arm's no-motion case. Nothing else about 110's
  `main.ts` change survives.

**Decided**
- Revert by hand, not `git revert` → **by hand.** `11ec8c5` also carries the
  two keepers above and a `release-name.ts` line, and eight builds have landed
  on top of it. **Mine.**
- A stored `atmosphericView: 'strata'` in someone's `localStorage` → `loadPrefs`
  validates each field and falls back to the default (`prefs.ts`), so a phone
  that had Strata selected opens on the default view. Adding a value was safe;
  removing one is safe for the same reason. Hard Stop 1: **no** — no field
  changes type or meaning.
- `?atmospheric=strata` links → break, and land on the default view. Hard Stop
  2 names renaming and repurposing, not removal of a value one day old, and
  Victor's instruction is the licence; but it is said here rather than
  discovered. Any such link was made in the last 24 hours.
- 110's own record → its `status:` line gets `· reverted by 131` and stays
  in the file; it is the record of the misreading, which is worth more than a
  clean queue.

**Lands in** — the files listed above; `docs/todo.md` entries 110 and 124's
status lines (edited in the same commit as this entry, with this entry's own
number).
**Done when** — `grep -ri strata src scripts package.json` returns nothing;
`pnpm build`, `pnpm lint` pass; `pnpm probe:camera-arm` passes unchanged
(proving `tilt.ts` survived); `views-probe.html` shows seven atmospheric
views; the `atm` band in the HUD has seven options and seats them under the
notch at 320×568 and 360×640; a phone with Strata stored opens on the default
view without an error.
**Verify** — the gates above, `hud-narrow.html` for the band, then the phone.
**Hard stops** — prefs no · url no (removal, licensed — see Decided) · capture
no · dependency no.

### 132. The toy feels gravity
`status: done` · added 2026-09-05 · build 443 · **what entry 110 should have been** · extends 30 and 102 · **the atmosphere's weight reads the uncapped tilt, not the capped `gravity()` Lands-in named — see build note**

**Do** — give the geometric layer's own centre a body that hangs under gravity
— swinging down when the phone is raised, settling with a bounce, hanging at
centre when the phone is flat — and give the atmospheric layer weight, so it
sits heavier toward whichever edge is down. Both from the in-plane gravity the
app already measures, both behind the `grav` chip that already exists.
**Why** — Victor: *"use those dynamics to move the emitters of the geometrics
and affect the lower layer also … think what it would be like for the toy as
a whole to feel gravity."* Today gravity reaches the toy in two places, both
small: the whole picture slides up to 0.033 uv (entry 30), and a *released
touch emitter* falls (entry 102). Neither moves what the picture is made of.
The audio-born rings, shards, cells and roses are all born at `vec2(0.0)` —
dead centre, whatever the phone is doing — and the field behind them is
weightless.

**Recon — what is already decided, and what is already there.**
- **The physics of flat-versus-upright is settled and is not a mode.** Entry
  102's record: *"Phone upright: that projection is the full vector and things
  fall. Phone flat on a table: … there is nothing pulling it … A mode flag here
  would be strictly worse than the physics."* `shake.gravity()` is that
  in-plane vector, capped; `shake.tilt()` is it uncapped; both already
  low-passed (`GRAVITY_TAU` 0.5 s) so nothing downstream needs its own
  smoothing. Everything here reads those two and adds no sensor path.
- **A body that falls, bounces and settles already exists** —
  `emitter.ts:289-335`: `GRAVITY_ACCEL_SCALE 36`, restitution 0.45, tangential
  loss 0.85, `TERMINAL_SPEED 2.0`, `SETTLE_SPEED 0.25`, bouncing off whichever
  frame edge is down. Entry 102 tuned those by feel and they are approved.
- **A spring that gravity loads already exists** — the tumble's offset springs
  in `shake.ts` (`OFF_STIFF 80`, `OFF_DAMP 7.1`) and entry 30's steady bias on
  top of them. Entry 30 is *this idea at small amplitude*: it chose 0.6 ×
  `MAX_OFFSET` because the overscan that hides the picture's edge is 0.055 uv.
  That cap is the reason 30 could never be felt, and it is the right cap for
  *sliding the whole composite*, which exposes an edge. Moving the **origin**
  of the geometry exposes nothing — the shaders draw everywhere regardless of
  where their centre is — so the origin can move an order of magnitude further
  than the picture can.
- **Where every shader anchors its audio-born geometry** — seven sites, counted:
  `circles.frag.glsl:227` (`dist = length(uv)`), `shards:85` (origin
  `vec2(0.0)`) and `:134`, `grid:92` (`originCell`), `rose:174`, `drift:98/151/185`
  (`emitterAt`, which already wanders — around the centre), `chorus:124/154`,
  `tide:132`. Touch-born slots already carry their own origin in `uRipples[i].zw`
  and are untouched.
- **The atmosphere already moves with the tumble** at `uAtmTumbleScale = 0.55`
  (entry 82, `composite.frag.glsl:186-189`), so it already slides a little with
  entry 30's gravity. It has no *weight*.
- **The switch.** All of 30 and 102 sit behind `prefs.gravity`, default
  `false` (`main.ts:869-873`). Skill rule 1a-3 applies to whoever verifies
  this: **test with the `grav` chip on.**

**Decided**
- The geometric centre is **a pendulum bob, not a falling grain.** A body on a
  spring anchored at the frame centre, loaded by gravity: upright, it hangs
  below centre; flat, it hangs *at* centre; tilted, it hangs toward the low
  edge; and every transition swings and settles. Over the emitter's
  fall-to-the-edge physics, which would carry the picture's centre to the
  bottom edge whenever the phone is held normally — half the picture off
  screen in the commonest posture — and would leave it there when the phone is
  laid flat. A bob answers "flat" by returning to centre **with no rule saying
  so**, the same way 102's grain answers it by not moving. **Mine**, and the
  only decision in this entry that changes what the picture is; overturn it if
  the sand frame's *staying put when flat* is the point rather than the swing.
- How far it hangs → **`ORIGIN_SAG = 0.28` uv at 90°**, linear in the in-plane
  magnitude (`|tilt()|`, uncapped). Portrait, upright: the centre sits 0.28
  below the middle — a third of the way to the bottom edge; the rings still
  fill the frame. **Mine**: 30's 0.033 is invisible and the edge is 0.89 away;
  0.28 is the largest value at which Circles' outermost wake rungs still reach
  the top of a portrait frame.
- The swing → **natural frequency ω = 3 rad/s (period ~2.1 s), damping ratio
  0.35**: raise the phone and the centre drops, overshoots by about a third,
  swings back once and settles inside 3 s. **Mine**, over reusing the tumble's
  `OFF_STIFF/OFF_DAMP` (ω ≈ 9, tuned for a knock — too twitchy for a thing
  meant to feel heavy). The tumble's own kicks still reach the bob: a knock
  swings it, a shake throws it, the spring brings it home — no new coupling,
  the bob simply also receives `pendingX/pendingY` each frame.
- **Touch emitters keep entry 102's fall** — a dropped grain still falls to
  the edge and bounces. A bob and a grain are different things and both are
  right; the toy having two kinds of gravity is the sand frame's own
  vocabulary (the pile sits, the falling grains fall). **Mine.**
- Where the bob's position goes → **one uniform, `uOrigin` (vec2, uv), shared
  by both layers' materials like every other uniform in `scene.ts:564`**, and
  each geometric shader measures its audio-born geometry from it: the seven
  sites above become `uv - uOrigin`, `uOrigin`, `floor(uOrigin / cellSize)`,
  `emitterAt(...) + uOrigin`. About ten lines across seven files. Over
  shifting the layer in the composite (which is entry 30's job and exposes an
  edge) and over shifting `uv` itself at the top of each shader (which would
  drag the touch-born origins along with it). **Mine.**
- **Identity at `uOrigin = (0,0)` is exact** — `uv - vec2(0.0)` is `uv`; with
  the chip off the uniform is never written and every shader is
  bit-identical. With the chip on and the phone flat, the bob rests at centre
  and the same holds.
- The atmosphere → **weight, not displacement.** In `composite.frag.glsl`, the
  atmosphere's contribution is scaled by `1 + WEIGHT · |g| · s`, where `s` is
  the pixel's position along the down direction (−0.5 at the up edge, +0.5 at
  the down edge) and `WEIGHT = 0.5`: upright, the field reads 25 % denser
  along the bottom and 25 % thinner along the top, and the gradient turns with
  the phone. Over warping the sample coordinate to pool content downward,
  which reads past the texture's edge (ClampToEdge streaks) exactly where the
  content is thinnest. Over per-view gravity in eight atmospheric shaders,
  which is a project and would make each field its own physics. **Mine**, and
  on `the-toy-wants-to-be-played-with.md`'s own rule: the field is what
  *persists*, so it gets restraint (a gradient); the geometry is what
  *responds*, so it gets the swing.
- The weight follows the low-passed gravity directly, **no spring**: a fluid
  settles, it does not bounce. **Mine.**
- The camera layer → untouched, as 30 already decided: a room does not slide
  or sag when you tilt the phone.
- The switch → **everything here sits behind `prefs.gravity`, exactly as 30
  and 102 do.** Whether gravity should *stop being optional* — the ask says
  "the toy as a whole" — is a Hard Stop 1 question (the stored field's
  meaning) and is **put to Victor separately, below**, not decided here.
  Proposal, for his answer: keep the chip, flip the default to `true` for
  new installs (safe — `loadPrefs` supplies the default only when the field
  is absent), and leave existing installs as they are. That is not part of
  this build.
- The second tenant → the bob's step is a pure-state module,
  `src/engine/origin.ts` (`createOriginState`, `updateOrigin(state, dt,
  tiltX, tiltY, kickX, kickY)`), beside `emitter.ts` and `motion-bias.ts`,
  probeable headless. **Mine**, per CLAUDE.md's refactor rule — two bodies
  reading gravity is a fact, not a guess.

**Lands in**
- `src/engine/origin.ts` — new; exported from `engine/index.ts`.
- `src/scene.ts:564` — `uOrigin` in the shared uniforms; the per-frame
  `updateOrigin` call beside the emitter loop (`:1342`), fed from
  `motionTiltX/Y` (already recorded by `setMotion`) and the tumble's pending
  kicks; written only while the caller passes gravity (`setGravity` non-null,
  `main.ts:873`), otherwise left at `(0,0)`.
- `src/shaders/{circles,shards,grid,rose,drift,chorus,tide}.frag.glsl` — the
  seven sites above, plus `uniform vec2 uOrigin;` in each.
- `src/shaders/composite.frag.glsl` — `uGravity` (vec2, in-plane) and the
  weight term on the atmosphere sample; `scene.ts` writes it from the same
  `setGravity` value 30 already receives.
- `scripts/probe-origin.ts` — new; `package.json`; `checks.yml`.
- `src/main.ts:869-873` — unchanged: the same two calls already pass gravity
  or `null` by the chip.

**Done when**
- Headless: from rest, `tilt = (0, 1)` → the bob's displacement passes 0.28
  (overshoot ≥ 25 %, ≤ 40 %) and settles within ±0.01 of 0.28 by 3 s; then
  `tilt = (0, 0)` → returns within ±0.01 of centre by 3 s with at most two
  sign changes; `tilt = (0.7, 0.7)` → rests along that diagonal at 0.28 ×
  its magnitude; a kick with `tilt = (0,0)` decays to centre.
- Probe: with gravity `null`, `uOrigin` is never written and stays `(0,0)`.
- `views-probe.html` with a synthetic `tilt` of `(0, 1)`: every geometric
  view's centre sits 0.28 uv below the middle; every atmospheric view is
  visibly heavier along the bottom; at `(0, 0)` every view is pixel-identical
  to build 416 with the chip on.
- On a phone with the `grav` chip on: raise it from flat and the picture's
  centre falls, swings once and hangs; lay it flat and the centre floats back;
  tilt it left and the centre hangs left with the field heavier on that side.
  With the chip off, nothing moves.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:origin`, `pnpm probe:shake`
unchanged (the tumble is not touched), `pnpm probe:emitter` unchanged (102's
grain is not touched); `views-probe.html` at the two tilts; then the phone,
**with the chip on**. No HUD surface changes.

**Hard stops** — prefs no (read only, same switch) · url no · capture no ·
dependency no. **Put to Victor, not blocking this build:** should gravity stop
being a switch? Proposal above.


### 133. The gate's name starts blank, and on a phone that is all anyone sees
`status: done` · added 2026-09-05 · build 439 · **corrects the reduced path re-anchored by 113** · the reduced branch could not be watched animating here — see build note

**Do** — stop the reduced-motion decode from rendering an empty span on its
first frame, return its pace to entry 99's, and put the branch it took and how
far it got into the `?debug` readout.

**Why** — Victor: *"on mobile the name animation on enter screen is not
showing, on browser looks nice, on mobile chrome android it doesn't show?!"*

**Recon: there is a real bug, at `version.ts:456`, and its own comment says it
must not exist.** The reduced-motion branch calls `step(start)` synchronously
with a comment reading *"an unstarted decode must never leave the span
empty"* — and then does exactly that:

```
const locked = reducedLockedCountAt(now - start, target.length)  // floor(0 / 550) = 0
el.textContent = target.slice(0, locked)                          // = ''
```

So on any device where `prefers-reduced-motion` matches, **the name is an empty
string for the first character-step**, then types in one character at a time.
That window was 333ms when entry 99 shipped it. Entry 113 (build 402)
re-anchored the reduced step to `NAME_LOCK_STEP_MS`, making it **550ms** blank
followed by 550ms per character — 6.6s for a median 11-character name.

**Why this lands on Android specifically:** entry 99 already established that
**Battery Saver and Accessibility → Remove animations both set
`prefers-reduced-motion` on Android**, and a phone that has been running a
WebGL visualiser is exactly a phone with Battery Saver on. Desktop Chrome
almost never matches it, which is precisely the split reported.

**This is the fourth time this animation has been reported invisible** —
entries 65, 94, 99 and now this one — and every previous cause was a masker
rather than a missing feature. CLAUDE.md's own rule from that history applies
here and shapes the entry: *"never ask the user to inspect an OS setting"*, and
*"if a diagnosis needs something only the device knows, put it in the on-screen
readout."*

**Three candidate causes, and the entry makes all three distinguishable rather
than betting on one:**

1. **Reduced motion, blank first frame** — the bug above. Fixed outright.
2. **Reduced motion, too slow to read before Start is tapped** — 6.6s on a
   gate a phone user leaves in two. Fixed by the pace decision below.
3. **Full motion, and the gate is simply left before 113's 8.5s phase one
   gets anywhere.** Not a bug; a 15-second animation meeting a 2-second visit.
   Made measurable rather than fixed — see Done-when.

**The diagnostic for which one already exists and needs no new work:**
`#motion-glyph` on the gate is filled when the full path runs and hollow when
the reduced one does (`version.ts:441`). Entry 99 built it for this exact
question. **One glance at the gate answers it**, and nobody has to open Android
settings.

**Decided**
- **The reduced path renders the full name from frame zero, then resolves it
  in place** → the span carries every character immediately and each one
  arrives at its true form on schedule, instead of the string growing from
  nothing. **Mine**, and it is the fix the file's own comment already asked
  for: an empty element is indistinguishable from a broken one, which is the
  entire report. Concretely, the unresolved tail is rendered at reduced
  opacity rather than absent, so the element's width is the name's width from
  the first frame and the gate never reflows.
- **Not a scramble, on that path** → the unresolved tail is the *target's own
  characters*, dimmed, never `renderLockFrame`'s random draws. **Mine**, and it
  keeps entry 99's actual protection intact: that entry's argument is that
  resolving characters carry no motion vector but **rapid churn is closer to
  flashing content than to an animation**. A dimmed character brightening is a
  fade, not a flicker.
- **The reduced pace returns to entry 99's 3 characters a second** →
  `reducedLockedCountAt` gets its own step of 333ms again rather than following
  `NAME_LOCK_STEP_MS`. **Mine**, and it corrects a call of mine in entry 113:
  113 tied the two together to preserve an ordering ("reduced must not become
  the *faster* path"), which was sound arithmetic and the wrong model —
  scrambling in place is legible at every instant, so it can afford to be slow,
  while a reveal is only legible once it has arrived. Entry 113's own status
  line already records that the "does 15s read as deliberate" judgement was
  never made; this changes only the reduced branch and leaves the full path's
  8500/550 exactly as 113 shipped them, because that half is Victor's taste
  call and he has said the browser *"looks nice"*.
- **`?debug` gains the decode's own three numbers** → which branch ran
  (`reduced` or `full`), milliseconds since the gate appeared, and characters
  resolved of the total. **Mine**, and it is the rule this feature's own
  history wrote: three of the four reports were diagnosed by guessing, and
  *"the app is where the problem is reported, so it is where the diagnosis
  belongs."*
- **The `#motion-glyph` is not changed** → it already answers the branch
  question at a glance and has since build 325. **Mine**: the fault here is
  that nobody was told to look at it, which is a line in this entry's Verify,
  not a code change.
- **The full-motion path is not touched at all** → no timing, no phase
  boundary, no scramble alphabet. **Mine**: Victor reports it looks nice, and
  the reported fault is on the branch he cannot see from a desktop.

**Identity when off** — on any device that does not match
`prefers-reduced-motion`, which includes every desktop browser this was
approved on, **not one line of the executed path changes**: the `reduced`
branch is not entered, the full two-phase decode runs with entry 113's exact
constants, and the rendered frames are identical. The `?debug` addition writes
only into a readout that is hidden unless asked for.

**Lands in** — `src/version.ts:452-467` (the reduced branch: a dimmed-tail
render, and the synchronous first call that must now produce the full-width
name), `:313` (`reducedLockedCountAt`'s own step, back to 333ms and its comment
saying why it is no longer tied to `NAME_LOCK_STEP_MS`); `index.html` (a class
for the dimmed tail, beside `.gate-name`'s own rule); the `?debug` readout's
own line. `scripts/probe-name-decode.ts`: the reduced assertions, which
currently encode 113's shared step.

**Done when** — `pnpm probe:name-decode` asserts that at elapsed **0ms** the
reduced path's rendered string has **the full length of the name** and is never
`''` — that is the regression, stated as the thing the eye failed at — and that
`reducedLockedCountAt(1000, len)` is `min(len, 3)` again. On the phone that
reported it, with `?debug`: the readout names the branch, and **whichever
branch it names, the name is legible on screen within 500ms of the gate
appearing**. If it says `full`, candidate 3 is the answer and the remaining
question is whether 113's 8.5s is too long on a phone — record the gate's
on-screen time before Start was tapped and put that number in a follow-up
entry rather than guessing at it here.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:name-decode`. Then the
gate at **320×568 and 360×640**, in **both** branches — Chrome DevTools can
force `prefers-reduced-motion: reduce`, and the reduced branch is the one that
has now shipped broken through two entries because nobody looked at it. Then
the actual Android phone, glancing first at `#motion-glyph`: **filled means the
full path, hollow means reduced**, and that one glance is the whole diagnosis.

**Hard stops** — prefs no · url no · capture no (no gate *copy* changes — this
is how an existing element resolves, not what it says, so CLAUDE.md's gate-copy
clause is not engaged) · dependency no.

### 134. Strings: a lines view you pluck, fret and strum
`status: done` · added 2026-09-05 · build 459 · new geometric view, lines · independent of 135 and 136; the three share nothing but the registry and the probe count · **live-vs-released is a level-drop heuristic, not a real signal — see build note** · the phone pull/pluck gesture and landscape orientation are unverified

**Do** — a geometric view of nine taut strings spanning the frame, each tuned
to a spectrum band, that vibrate when hit; a finger that lands on one **pulls
it to the fingertip** while held and **releases it as a pluck**; a drag across
them **strums**.
**Why** — Victor: *"one based on lines … be creative … design a great
interaction with touch."* Every geometric view today is a mark *thrown from an
origin* — ring, shard, cell front, spoke. None is a thing you take hold of.

**What every geometric view can read about a finger** (recon, counted at build
416, shared by entries 134–136): sixteen touch slots in `uRipples[8..23]`, each
`(birth, level, x, y)` in the shader's own uv, written by `spawnAt`
(`ripples.ts:105`) every **0.15 s** a finger is down or every **0.05 uv** it
moves (`emitter.ts:53,60`), and for a 2–4 s afterlife after release. `level`
is charge (0.6 at a tap, 1.0 after 2.5 s) plus drag speed. There is **no live
finger uniform on a phone**: `uPointer` (`lattice.frag.glsl:58`, entry 114) is
the mouse and its presence never rises above 0 on touch (entry 112). So **the
newest touch slot with `age < 0.3 s` is the live finger** — a held finger
refreshes it every 0.15 s, and it goes stale within two spawn intervals of
release. Drag *direction* is not stored; a drag's consecutive slots are
consecutive indices born ≤ 0.25 s apart, so the vector from slot `i−1` to `i`
is the finger's direction when their births are that close. Both derivations
are the entries' own, marked **Mine** where used. The `geometric-variation`
agent's own notes are the builder's guide, with one stale line: it says
`MAX_RIPPLES = 8`; it is **24** (`ripples.ts:28`), eight audio and sixteen
touch. `probe-ripples.ts:79` counts seven geometric shaders and must count ten
once all three land.

**The picture.** Nine straight strings, evenly spaced across the **short**
axis and running the full long axis, so portrait gives nine verticals and
landscape nine horizontals (`uResolution` decides; no orientation flag).
Hard-edged, `px`-wide, `ring()`-style antialiasing over 1.5 px. String `k`
listens to spectrum band `k` (bass at the thumb edge, treble at the far edge
— nine of `bandVector`'s bands read from `uSpectrum`). Each string's shape is
a standing wave: `x(y) = A · sin(π·m·y/L) · cos(ω·t) · e^{−t/τ}`, first mode
by default (`m = 1`), amplitude `A` from the hit, `ω` from the band's index
(higher strings ring faster: `ω_k = 6 + 2k` rad/s), `τ = 1.4 s`. In silence
every string hums at the `px`-scale amplitude its band's energy gives it, so
the view is never black.

**Hits.** An audio slot (`i < 8`) plucks the string nearest its `level`
mapped across the nine — a loud hit plucks the bass end, a quiet one the
treble — with `A = 0.06 · level` uv. **Mine** on the mapping: a hit has no
position, and level-to-string keeps a loud passage on the bass strings, which
is where the eye expects weight.

**The interaction, in three verbs**
- **Pull.** While the live-finger slot (definition above) is within 0.05 uv of
  a string, that string is drawn **bent to the fingertip**: two straight
  segments from each end to the finger, not a curve — a pulled string is two
  lines, and it is what makes the pull read as tension. The string it grabs is
  fixed at first contact and kept while held, even if the finger crosses others.
- **Release.** The frame the live slot goes stale, the string plucks with `A`
  equal to the pull displacement (capped 0.15 uv) and mode `m = 1 + floor(3 ·
  |y_finger − L/2| / (L/2))` — pulled at the middle it rings in the fundamental,
  pulled near an end it rings in a higher mode with a node — the physics a
  guitarist knows, and free once `m` is a parameter.
- **Strum.** A drag whose consecutive slots cross a string plucks it at `A =
  0.04 · level` the frame it is crossed, so a fast swipe across all nine
  sounds nine plucks in order. Crossing is `sign(x_{i−1} − s_k) ≠ sign(x_i −
  s_k)`, the same consecutive-slot pairing the shared note describes.

**Decided**
- Lines, not a lattice or a grid → **strings**, because a line that vibrates
  is the one line that answers a hit *and* a hand. **Mine.**
- Nine → over six (too sparse to strum) and twelve (thinner than a thumb can
  pick). Spacing at 360 px is 40 px, one string per thumb width. **Mine.**
- Two segments while pulled, not a bent curve → tension reads as a corner.
  **Mine.**
- Damping `τ = 1.4 s` → a pluck is audible-length; six strums a second stack
  legibly. **Mine.**
- `uSeed` → re-rolls which end is bass and a ±15 % irregularity in spacing, so
  a re-roll restructures rather than recolours. **Mine.**
- Combine → `max()`, per the layer's rule; nine strings never overlap anyway.

**Lands in** — `src/shaders/strings.frag.glsl` (new), `src/views.ts` (one line,
appended after `tide`), `scripts/probe-ripples.ts:79` (count), and the
`geometric-variation` agent's own verify ritual — a probe page with `circles`
as the baseline in the same harness, every run.
**Done when** — in the probe page: silence shows nine hairlines; `transient: 1`
bends one visibly within a frame and it is back within `px` of straight by
4 s; a synthetic held slot 0.03 uv off string 4 draws two segments meeting at
the slot; making the slot stale rings string 4 at the pull amplitude; a
synthetic drag of six slots across strings 2–7 plucks all six. On a phone:
pull a string and let go.
**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:ripples`; the probe page,
screenshots at two ages, `read_console_messages` for the compile; then the
phone. No HUD change — the `geo` band gains an option.
**Hard stops** — prefs no (new value on a validated enum) · url no (new value) ·
capture no · dependency no.

### 135. Orbits: bodies you fling into orbit around the centre
`status: done` · added 2026-09-05 · build 463 · new geometric view, circles · independent of 134 and 136 · **the slingshot speed-up was not isolated cleanly in verification — see build note** · the phone fling/hold gesture is unverified

**Do** — a geometric view in which each hit is a small circle set orbiting the
frame's centre, leaving a thin arc of its recent path; a finger **flings a
body** into orbit with the drag's own direction and speed, and a **held**
finger is a second mass the orbits bend around.
**Why** — Victor: *"two on circles … quite different from existing ones."*
Every circle in the layer today expands from where it was born and dies at the
rim. Orbits' circles keep their size and **move**; the path they leave is the
circle.

**What every geometric view can read about a finger** (recon, counted at build
416, shared by entries 134–136): sixteen touch slots in `uRipples[8..23]`, each
`(birth, level, x, y)` in the shader's own uv, written by `spawnAt`
(`ripples.ts:105`) every **0.15 s** a finger is down or every **0.05 uv** it
moves (`emitter.ts:53,60`), and for a 2–4 s afterlife after release. `level`
is charge (0.6 at a tap, 1.0 after 2.5 s) plus drag speed. There is **no live
finger uniform on a phone**: `uPointer` (`lattice.frag.glsl:58`, entry 114) is
the mouse and its presence never rises above 0 on touch (entry 112). So **the
newest touch slot with `age < 0.3 s` is the live finger** — a held finger
refreshes it every 0.15 s, and it goes stale within two spawn intervals of
release. Drag *direction* is not stored; a drag's consecutive slots are
consecutive indices born ≤ 0.25 s apart, so the vector from slot `i−1` to `i`
is the finger's direction when their births are that close. Both derivations
are the entries' own, marked **Mine** where used. The `geometric-variation`
agent's own notes are the builder's guide, with one stale line: it says
`MAX_RIPPLES = 8`; it is **24** (`ripples.ts:28`), eight audio and sixteen
touch. `probe-ripples.ts:79` counts seven geometric shaders and must count ten
once all three land.

**The picture.** Each of the 24 slots that is alive is a body: a `ring()` of
radius `0.012 + 0.02 · level` uv at angle `θ = θ₀ + ω · age` on a circle of
radius `r` about the centre, with `ω = 1.6 · r^{−1.5}` rad/s — Kepler's law,
so inner bodies race and outer ones drift, and a fast one lapping a slow one
is the picture's rhythm. Behind each body, its **trail**: the same orbit circle
drawn only over the last 40° of arc behind it (the angular window scaled so a
fast body's trail is as long on screen as a slow one's), fading linearly to
nothing at the tail. Lifetime `3.2 · uMoonLife` s like Circles', fading from
`FADE_FROM`. In silence a single faint body of radius 0.008 orbits at `r =
0.3` — the sun's own planet, so the view is never black — and the centre is
marked by a `px` ring of radius 0.02.

**Hits.** Audio slot `i` gets `r = 0.12 + 0.55 · (1 − level)` — a loud hit is
a close, fast orbit; a quiet one is far and slow — and `θ₀` from
`hash(birth)`. **Mine** on inverting level: weight belongs near the centre.

**The interaction**
- **Fling.** A touch slot's body starts **at the finger** (`r = |xy|`, `θ₀ =
  atan(y, x)`) and orbits prograde. When the previous slot is a consecutive
  drag sample (shared note), the fling direction is the vector between them:
  the body's orbit is the **ellipse** with the finger's position and that
  velocity — closed-form, eccentricity from the speed (`level`'s speed term),
  so a slow release is a circle and a fast swipe is a long ellipse that swings
  out to the rim and back. Drawn as the ellipse's own arc behind the body.
- **Hold.** While the live-finger slot is present, it is drawn as a mass — a
  `px` ring at the fingertip — and every body's angular speed is scaled by
  `1 + 0.8 · e^{−d/0.15}` where `d` is its distance to the finger: bodies
  passing near the finger **slingshot**, visibly quickening and leaving a
  tighter trail. Over bending the orbit's shape, which needs per-pixel
  integration. **Mine**: a speed change is a one-line closed form and reads as
  gravity; a path change does not fit a fragment shader's budget.

**Decided**
- Kepler over uniform speed → the exponent is the whole feel. **Mine.**
- Prograde for every body, anticlockwise → a re-roll (`uSeed`) flips the
  direction for the whole system and the trail length (25–60°), which
  restructures without recolouring. **Mine.**
- Trails `max()`-combined; bodies `max()` too. Twenty-four thin arcs cannot
  flood, and entry 122's budget is not needed here.
- Ellipses only for flung bodies; audio bodies are circles → the eye then
  reads *shape* as "a person did that". **Mine.**

**Lands in** — `src/shaders/orbits.frag.glsl` (new), `src/views.ts` (one line),
`scripts/probe-ripples.ts:79`. Per-pixel cost: 24 slots × (one ring + one arc
window) — below Circles' two loops with a wake ladder.
**Done when** — probe page: silence shows the centre mark and one orbiting
body; `transient: 1` births a body whose angle advances by `ω · dt` between
two screenshots 0.5 s apart (measure the angle); two consecutive synthetic
slots 0.05 uv apart born 0.1 s apart produce an ellipse (the trail's radius
from centre varies along it); a held live slot at `(0.3, 0)` measurably
quickens a body passing within 0.1 uv of it versus the same body with the
slot absent. On a phone: fling, then hold a finger in a body's path.
**Verify** — as 134's. **Hard stops** — as 134's.

### 136. Moiré: two ring fields, and the finger holds the second centre
`status: ready` · added 2026-09-05 · new geometric view, circles · independent of 134 and 135

**Do** — a geometric view made of two dense fields of concentric hairline
circles whose centres differ, so the frame is an interference pattern; a hit
**pulses the ring spacing** outward as a wave; a finger **holds the second
centre**, so dragging sweeps the whole moiré, and letting go **springs it
back**.
**Why** — the other two circle views are made of a few circles. This one is
made of hundreds, and the picture is not the circles but what happens
*between* them — the one thing no view here has done, and a thing a hand
changes more than a hit does.

**What every geometric view can read about a finger** (recon, counted at build
416, shared by entries 134–136): sixteen touch slots in `uRipples[8..23]`, each
`(birth, level, x, y)` in the shader's own uv, written by `spawnAt`
(`ripples.ts:105`) every **0.15 s** a finger is down or every **0.05 uv** it
moves (`emitter.ts:53,60`), and for a 2–4 s afterlife after release. `level`
is charge (0.6 at a tap, 1.0 after 2.5 s) plus drag speed. There is **no live
finger uniform on a phone**: `uPointer` (`lattice.frag.glsl:58`, entry 114) is
the mouse and its presence never rises above 0 on touch (entry 112). So **the
newest touch slot with `age < 0.3 s` is the live finger** — a held finger
refreshes it every 0.15 s, and it goes stale within two spawn intervals of
release. Drag *direction* is not stored; a drag's consecutive slots are
consecutive indices born ≤ 0.25 s apart, so the vector from slot `i−1` to `i`
is the finger's direction when their births are that close. Both derivations
are the entries' own, marked **Mine** where used. The `geometric-variation`
agent's own notes are the builder's guide, with one stale line: it says
`MAX_RIPPLES = 8`; it is **24** (`ripples.ts:28`), eight audio and sixteen
touch. `probe-ripples.ts:79` counts seven geometric shaders and must count ten
once all three land.

**The picture.** Field A: rings about the centre, spacing `s = 0.03` uv (about
30 rings across a portrait frame), each a `px` hairline (`ring()` on
`fract(dist / s)`). Field B: the same rings about a second centre `c`, resting
at `(0.12, 0.08)` (from `uSeed`, radius 0.1–0.2, any angle). Combined with
`max()`. The two fields beat: hyperbolic bands of light and dark cross the
frame, and any movement of `c` sweeps them — a 0.01 uv move of the centre
moves the bands by a whole spacing, which is why a finger on `c` feels like
turning a large wheel with a small one. In silence the pattern stands; `uFlow`
turns `c` about its rest point at 0.05 rad/s so the bands creep. Never black.

**Hits.** An audio slot at `age` adds a radial **spacing wave** to field A: `s`
is stretched by `0.25 · level · e^{−((dist − v·age)/0.06)²}` at the front's
current radius (`v = 0.6` uv/s) — the rings bunch and spread as the front
passes, and the moiré bands ripple outward with it. Sixteen touch slots do the
same to field **B** from the finger's position, so a tap **anywhere** sends the
pattern rippling from *there*. `max()` of the stretch terms, not a sum.

**The interaction**
- **Hold and sweep.** While the live-finger slot is present, `c` **is** the
  fingertip: field B's centre follows the finger and the entire pattern
  reorganises around wherever it goes. This is the cheapest possible
  interaction to draw — one `vec2` — and the largest visible change any view
  here has to a finger, because every pixel depends on `c`.
- **Let go.** When the slot goes stale, `c` **springs back** to its rest point
  over ~1.5 s with one overshoot (a critically-ish damped return computed in
  the shader from the last held position and its release time — both are in
  the stale slot: `xy` and `birth`). Over staying where it was left: the moiré
  at rest is the composition, and the spring is what makes the release a
  gesture rather than a drop. **Mine.**
- **Re-roll** (`uSeed`) moves the rest point and picks the spacing in
  `[0.024, 0.04]` — the coarse-versus-fine character of the whole view.

**Decided**
- Two fields, not three → three beat into a texture with no readable bands.
  Tried on paper; the rule is one pair. **Mine.**
- Hairlines at `px`, not thicker → moiré is a hairline phenomenon; at 2 px the
  bands blur into grey. **Mine.**
- The finger moves B, not A → A is the frame's own centre and the audio's home;
  the hand takes the second voice. **Mine.**
- Spacing wave on hits over a brightness pulse → the layer is drawn, not lit; a
  spacing change is geometry. **Mine.**
- Cost → two `fract`s and two `ring()`s per pixel plus a 24-slot loop of one
  exponential each. Cheaper than Circles.

**Lands in** — `src/shaders/moire.frag.glsl` (new), `src/views.ts` (one line),
`scripts/probe-ripples.ts:79`.
**Done when** — probe page: silence shows crossing bands; a synthetic held slot
at `(0.3, 0.2)` recentres field B there (measure: the pixel at `(0.3, 0.2)` is
a ring centre — dark inside the first `px` ring); making it stale returns `c`
to rest within 2 s with exactly one overshoot (sample `c`'s implied position
from the pattern at 0.5 s steps, or expose it in a debug uniform for the
probe); `transient: 1` produces a moving band of altered spacing whose radius
grows at `0.6` uv/s between two screenshots. On a phone: hold and sweep,
let go, tap somewhere else.
**Verify** — as 134's. **Hard stops** — as 134's.


### 137. Every release opens on its own seed, and the seed becomes writable
`status: ready` · added 2026-09-05 · independent of the rest of the queue

**Do** — derive the opening `uSeed` from `RELEASE_NAME` instead of
`Math.random()`, add a `?seed=` parameter that restores it, and print the whole
look as one copyable string in the `?debug` readout.

**Why** — Victor: *"I guess there is a set of values which seed the animation,
are we able to write it out as a DNA string? in any case let's have each
release start at it's own unique seed."*

**Recon: most of the DNA already exists and already travels; exactly one gene
is missing.** `?geometric= ?atmospheric= ?view= ?rgb= ?mix= ?mapping= ?auto=`
are already parameters, already parsed at `main.ts:112`, and already restore a
look from a link. The one part of the picture with **no representation
anywhere** is `uSeed` — `Math.random()` at three sites (`scene.ts:647` on
construction, `:1336` on a structural boundary, `:1667` in `randomise()`),
recorded by nothing. So a shape you liked is currently unrecoverable, and
"write it out" is mostly a matter of finishing a string that is already
three-quarters written.

**And there is a reasoned refusal in the way of the obvious place to put it.**
`share.ts:9` — *"Query and hash are dropped. A share is an invitation to the
piece, not to the exact settings of the tab it was sent from — and `?debug` in
particular has no business travelling to somebody else's phone."* That is a
decision, not an oversight, so this entry does **not** put the DNA on the QR or
the share button. See Decided.

**There is no hash function in the codebase** — grepped, none — so the release
seed needs one small pure function, and that is the only new code the second
half requires.

**Decided**
- **The DNA string *is* the URL, completed** → a `?seed=` parameter joins the
  seven that already exist, and the readout prints the full link. **Mine**,
  over inventing a compact bespoke encoding: CLAUDE.md says *"a shared link is
  how this thing travels"* and *"New parameters are free"*, and a novel string
  would need a decoder written, documented and kept in step with a format that
  already works, reaches the app through a path already tested, and can be
  pasted into a phone.
- **`?seed=` is exactly 16 hex characters** — four 16-bit components, four
  characters each, e.g. `seed=3f2a9c14e0b7d582`. **Mine**: `uSeed`'s coarsest consumer is
  `SYMMETRY = 4 + floor(uSeed.y * 6)`, so a 16-bit quantisation is finer than
  the visible difference by four orders of magnitude, and hex round-trips
  without locale or float-formatting hazards. Invalid or malformed values fall
  back to the release seed rather than throwing, the same way every other
  parameter already falls back.
- **The opening seed comes from `RELEASE_NAME`, not the build number** →
  **Mine**: the build number moves on every commit, so a seed keyed to it would
  change the opening look for builds that changed nothing visual; the name
  changes exactly once per release **by rule** (CLAUDE.md: *"Changed in the
  same commit as the work it names"*), which is precisely the cadence "each
  release starts at its own seed" asks for. It also makes the name and the look
  the same fact — the chip says `says i am` and that build always opens the
  same way.
- **The hash is FNV-1a, written out, not imported** → a dozen lines in
  `release-name.ts` beside the name it hashes, producing four components from
  one pass with four different offset bases. **Mine**: a runtime dependency for
  this would be absurd against CLAUDE.md's 117 KB budget, and FNV-1a is chosen
  over a hand-rolled multiply-xor because it is a named, specified function
  someone can check rather than a magic constant nobody can audit.
- **The QR and the share button stay bare** → unchanged, and `shareUrl()` keeps
  dropping the query. **Mine**, and the reason is quoted above from the file
  itself: a share is an invitation to the piece. The `?debug` hazard that
  comment names is real and would be re-created the moment the share carried
  the query. **If Victor wants the QR to carry the whole picture, that is a
  deliberate reversal of a documented decision and belongs in its own entry
  with his word in it** — it is one line, and it is not this entry's to take.
- **The DNA is printed in the `?debug` readout** → one line, the full URL with
  every look parameter and the seed. **Mine**, over adding a copy control: the
  control surface is circular and text-free by a non-negotiable, and the
  readout is the one surface in this app that already prints strings. It is
  also where somebody debugging a look is already looking.
- **The seed is not stored in `Prefs`** → render-time only. **Mine**, and it is
  what keeps the two halves from cancelling: a persisted seed would restore
  your last shape on every load and the release's own seed would be seen once,
  by people with empty storage, and never again. Adding a field would have been
  *safe* under Hard Stop 1 — this declines it on behaviour, not on risk.
- **A re-roll still goes somewhere random** → `randomise()` and the structural
  boundary keep `Math.random()`. **Mine**: the release seed is where a session
  *opens*, not a rail it runs on, and a shake that returned to the same shape
  every time would be the opposite of what entries 27 and 35 built.
- **Precedence, stated once** → `?seed=` beats the release seed, and any
  re-roll beats both. **Mine**, matching how `?rgb=` already outranks a stored
  colour at `main.ts:686`.
- **The gate's shuffle is untouched** → `main.ts:711`'s `shuffled(SHUFFLE_VIEWS,
  …)` still picks a not-yours *view and colour* for the start screen; this
  entry only fixes which four numbers the shader's own shape starts from, and
  the two compose without either knowing about the other. **Mine** to state it,
  because "the gate shows a random look" and "the release has a fixed seed"
  read as contradictory until you notice they are different values.
- **The known cost** → everyone on a build opens on the same shape, so if a
  release's hash lands on an unlovely one, that is what greets every visitor
  until the music crosses a boundary or somebody shakes. Acceptable and
  bounded: both of those happen within seconds of real sound, and the next
  release re-rolls it by rule. Stated rather than discovered.

**Identity when off** — this deliberately changes one thing, so the claim is
narrower than usual and worth being exact about: **after any re-roll, and for
every parameter other than the opening four numbers, behaviour is unchanged.**
`randomise()`, the boundary re-roll, the shuffle, every stored preference and
every existing URL parameter are byte-identical. A link with no `?seed=` gets
the release seed; a link with one gets what it names; nothing else moves. There
is no branch to disable, because the change is which four numbers are written
once at construction.

**Lands in** — `src/release-name.ts` (the FNV-1a hash and a `releaseSeed()`
returning four 0-1 numbers, beside `RELEASE_NAME`); `src/scene.ts:647` (the
construction value, from options rather than `Math.random()`) and the
`VisualiserOptions` field that carries it; `src/main.ts:112` (parsing
`?seed=`) and `:718` (passing it); the `?debug` readout's own line.
`scripts/probe-name-decode.ts` is untouched; a new `scripts/probe-seed.ts` and
`pnpm probe:seed`.

**Done when** — `pnpm probe:seed` asserts: `releaseSeed()` is **deterministic**
(same name, same four numbers, across calls and processes); all four components
are in `[0, 1)`; **every name in `RELEASE_NAMES` produces a distinct
four-tuple** — that is the "unique per release" claim, checked against the
whole history rather than asserted; the hex encoder and parser round-trip every
component to within 1/65536; and a malformed `?seed=` (wrong length,
non-hex, empty) yields exactly the release seed rather than throwing. In the
browser: loading with no `?seed=` twice in a row gives the **same** opening
shape, which is the whole point and is the thing today's build cannot do;
`?debug` prints a link that, pasted into a fresh tab, reproduces the same
picture; and a shake still changes the shape.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:seed`, and `pnpm probe`
unchanged. Then a browser: copy the DNA line, open it in a private window, and
compare the two side by side — that round trip is the only test of whether the
string actually carries what it claims, and reading the parser cannot answer
it. Then confirm the QR still encodes the bare URL, since the entry's own
refusal above is the thing a careless edit to `share.ts` would undo. No HUD
surface changes, so no 320×568 pass is owed.

**Hard stops** — prefs **no** (nothing stored changes; the seed is deliberately
render-time) · url **a new parameter, which CLAUDE.md makes free**: *"New
parameters are free. Renaming or repurposing one breaks links already in the
world"* — `?seed=` renames nothing and repurposes nothing, and every existing
link keeps working, gaining only a deterministic opening shape where it used to
get a random one · capture no · dependency **no** — the hash is written out
rather than imported, for exactly this reason.


### 138. Umbra — the first view that subtracts light instead of adding it
`status: ready` · added 2026-09-05 · a new atmospheric view · independent of 139 and 140, and of 110

**Do** — add an atmospheric view, **Umbra**: one bright source behind a drift
of solid, opaque bodies, seen as silhouettes with lit rims and light leaking
through the gaps between them.

**Why** — asked for, and it fills the one hole the registry's own taxonomy
makes visible. `views.ts:112` names the organising principle of each existing
view — *"Field is cloud, Lattice is symmetry, Spectrogram is a diagram and
Aurora is a place; these are focused light, superposed waves, and divided
space."* **All seven are emissive.** `lattice.frag.glsl:16` states the house
default outright: *"everything is additive. No surfaces, no shading, no
lighting model — only emission."* Nothing in this app has ever cast a shadow,
so **occlusion** is an unclaimed principle rather than a variation on a claimed
one.

**Decided**
- **The principle is occlusion, and it is the whole point** → bodies are
  genuinely opaque: where one covers the source, the frame goes dark. **Mine**,
  over a dark-tinted additive fake, which is what every other view would
  produce if asked for shadow and is why none of them reads as solid.
- **One source, off-centre, behind everything** → a single bright disc at a
  fixed offset from centre, never in front. **Mine**: two sources is Fringe's
  territory and a centred source is Lattice's; one off-centre source is what
  makes the silhouettes lean and gives the rim light a direction.
- **The bodies are a signed-distance field of a few large blobs**, drifting on
  `uFlow` and merged smoothly, so they read as one moving mass rather than as
  circles. **Mine**: smooth-minimum merging is what stops it looking like a
  lava lamp's separate bubbles, and an SDF is what makes a true rim available —
  the rim is the distance to the body's own edge, which no noise field can give
  you.
- **The music, three couplings, chosen so they are separable on screen**:
  **`uLow` swells the bodies** (bass eclipses the source — the frame darkens on
  a kick, which no existing view does); **`uTransient` flares the source**
  (a hit blows light through every gap at once); **`uHigh` sharpens and
  brightens the rim** (treble is the hard edge of the silhouette). **Mine**,
  and separability is the criterion: entry 32's lesson is that a view is
  judged by whether one input can be *seen* moving on its own, so each of the
  three acts on a different part of the image — area, source, edge.
- **The eclipse is bounded** → the bodies' total swell is capped so the frame
  can never go fully black. **Mine**: a view that can extinguish itself on a
  bass note is indistinguishable from a crash, and this is the same ceiling
  argument `shake.ts`'s `MAX_ANGLE` and entry 32's refusal of whole-frame scale
  both make.
- **Colour comes from the layer filter, as everywhere else** → the shader
  draws luminance only. **Mine**, matching `views.ts`'s own contract and every
  geometric shader's stated habit.

**Identity when off** — a new view changes nothing until it is chosen; the
other seven and both defaults are untouched. Within the view, silence still
draws: the source burns steadily and the bodies drift on `uFlow`'s own floor
(`0.06`, `scene.ts:1316`), so a quiet room gets slow eclipses rather than a
black screen — which every existing atmospheric view also does, and which is
the difference between "calm" and "broken".

**Lands in** — `src/shaders/umbra.frag.glsl` (new); `src/views.ts:21-30` (the
import) and `:130` (the registry entry, appended — the registry's order is the
order the HUD offers, and its own comment says the first four remain the ones
worth meeting first).

**Done when** — in `views-probe.html`, side by side with the existing seven
from identical synthetic audio: a `uLow` sweep 0→1 **visibly grows the dark
area** and the mean frame luminance falls monotonically; a `uTransient` spike
**raises luminance in the gaps** while the bodies stay dark, so the two are
distinguishable rather than both reading as "brighter"; a `uHigh` sweep changes
the **rim** without changing the body area; and at `uLow = 1` with everything
else at 1 the frame is **not** fully black — the cap holds. Against real music:
a kick reads as the light being blocked, not as a colour change.

**Verify** — `pnpm build`, `pnpm lint`, then `views-probe.html` and **look at
it**, because this is exactly CLAUDE.md's `Fringe` case: a shader that
compiles, passes a centre-pixel readback and draws the wrong thing. The
specific failure to look for is the bodies reading as *dark blobs added on top*
rather than as things in front of a light — if the rim is not brighter than the
body's interior at every edge, the occlusion is fake and the view has no reason
to exist. Then a phone, for fill rate: an SDF with a smooth-minimum over
several blobs is the most expensive thing here per pixel, and mobile is the
target. Then the HUD's atmospheric band at **320×568 and 360×640** — this is
the eighth notch on that arc (ninth with 110's Strata), and nobody has checked
what that arc looks like past seven.

**Hard stops** — prefs no (a new value on an existing validated enum, as Fringe
and Rose were) · url no (`?atmospheric=umbra` is a new value, not a new
parameter) · capture no · dependency no.

### 139. Filings — a field with poles, and the music moves them
`status: ready` · added 2026-09-05 · a new atmospheric view · independent of 138 and 140, and of 110

**Do** — add an atmospheric view, **Filings**: iron filings on glass over a
handful of magnetic poles, drawn as the curved field lines that run between
them, with the poles placed and signed by the spectrum.

**Why** — asked for. Against the registry's taxonomy this is a **vector field
with sources and sinks**, which nothing claims: Caustics focuses light, Fringe
superposes two scalar waves, Field warps noise. None of them has *topology* —
lines that must start somewhere, end somewhere, and re-route entirely when a
pole flips.

**Decided**
- **The lines are contours of a potential, computed per pixel** → sum
  `q_i / distance` over the poles, then draw the level sets. **Mine**, over
  advecting particles: particles need per-agent state and a texture (the shape
  110's Strata needs), while a potential is a closed-form sum a fragment shader
  evaluates in one pass with no feedback buffer at all — which is the
  difference between a view and a subsystem.
- **Six poles, one per band of a six-band reduction** → each band's energy is
  its pole's strength. **Mine**: six is enough for the field to have interesting
  topology and few enough that the per-pixel loop stays cheap on a phone, and
  reusing a band reduction means the view reads the spectrum without inventing
  a second way to look at it.
- **Polarity flips on a transient, and that is the view's signature event** →
  a hit inverts the sign of one pole, chosen by the seed, and the entire line
  structure snaps and re-routes. **Mine**, and it is the answer to "respond to
  music well": every other view responds *continuously*, so a hit is a swell or
  a flash. This one has a response that is **discontinuous in structure but
  continuous in pixels** — the lines re-route smoothly because the potential is
  smooth, but where they *go* changes completely. Nothing else here does that.
- **Pole positions drift on `uFlow`, and spectral tilt spreads them** → bright,
  treble-led passages push the poles apart (a wide, open field), bass-led ones
  draw them together (a tight, knotted one). **Mine**: it gives the slowest
  audio feature the slowest visual parameter, which is the pairing entry 130
  argues for in the lattice.
- **Contours are drawn with a screen-space derivative so they hold a constant
  width** → `fwidth`-style normalisation on the level-set function. **Mine**,
  and it is the detail that decides whether this looks like filings or like a
  bad gradient: without it the lines are thin near a pole and fat far away,
  which is the artefact, not the phenomenon.
- **The poles themselves are never drawn** → no dots, no markers. **Mine**: a
  filings photograph shows the field, not the magnet, and drawing the source
  would turn a field into a diagram — which is Spectrogram's claimed principle.
- **Colour comes from the layer filter** → luminance only, as everywhere else.

**Identity when off** — a new view, so nothing existing changes. In silence the
six poles sit at their drift positions with near-equal weak strengths and the
field is a calm, slowly-turning lattice of lines — present, quiet, and not
black.

**Lands in** — `src/shaders/filings.frag.glsl` (new); `src/views.ts` (import
and registry entry, appended).

**Done when** — in `views-probe.html`: raising one band's energy alone
**visibly pulls the lines toward that pole's position**, and the effect is
localised rather than global; a `uTransient` spike **re-routes the line
structure** — measurable as more than 20% of sampled pixels changing which side
of a contour they fall on, between the frame before and the frame after — while
the frame-to-frame pixel difference stays smooth rather than flashing; a
`uTilt` sweep visibly changes how spread the field is; and line width measured
near a pole and at the frame edge is **within 30%**, which is the artefact
check. Against real music: a snare reads as the picture re-organising, not as a
brightness pulse.

**Verify** — `pnpm build`, `pnpm lint`, `views-probe.html` side by side with
the other views, **looked at** — the failure mode to hunt is the one Fringe
actually had: a formula that factors into something regular and beads into
dots or a moire, which at a glance reads as an artefact and at second glance
is the whole image. Then a phone for fill rate — a six-pole loop per pixel is
this view's whole cost and is the number that decides whether it ships. Then
the atmospheric band at **320×568 and 360×640**.

**Hard stops** — prefs no (a new value on an existing validated enum) · url no
(`?atmospheric=filings`) · capture no · dependency no.

### 140. Anneal — glass under load, seen through crossed polarisers
`status: ready` · added 2026-09-05 · a new atmospheric view · independent of 138 and 139, and of 110

**Do** — add an atmospheric view, **Anneal**: a sheet of stressed glass between
crossed polarisers, showing the oily rainbow fringes of photoelasticity and the
dark brushes that sweep across them as the stress axis turns.

**Why** — asked for. The principle is **a material under load**, and it is the
only one of the three that puts *colour* in the shader rather than taking it
from the layer filter — because in this phenomenon the colour **is** the
measurement: fringe order is stress magnitude, and that relationship is the
image.

**Decided**
- **Colour is computed in the shader, and this view is the documented
  exception** → **Mine**, and it needs saying loudly because every other
  atmospheric view takes colour from `uAtmColour` and several shaders carry
  comments saying so. Photoelastic colour is not a palette choice; the sequence
  from grey through yellow, red, blue and green *is* the readout of retardation,
  and a view that filtered it to one hue would be showing stress with the stress
  removed. The layer filter still multiplies on top, so a user who kills a
  channel still gets their filter — the shader's own colour is what it filters.
- **The stress field is a few point loads plus a slow background shear** →
  concentrators where the fringes crowd into tight closed loops, which is what
  makes the phenomenon legible. **Mine**: an even stress gives even fringes and
  no image.
- **The music, three couplings, on three separate visual axes**: **`uLevel` is
  the load** — louder crowds more fringe orders into the same space, so the
  rainbow bands multiply; **`uTransient` is a hammer blow** that sends a stress
  wave outward from one concentrator, visible as a travelling compression of
  the fringes; **`uRoughness` sets how jagged the field is** — smooth tones give
  clean concentric loops, noisy ones give a fractured, granular stress pattern.
  **Mine**, and separable by construction: count of bands, a travelling front,
  and the smoothness of the contours.
- **The isoclinic brushes rotate on `uFlow`** → the dark bands that mark where
  the stress axis aligns with a polariser sweep slowly across the frame,
  independent of the fringes. **Mine**: it is the second, slower motion that
  keeps the view alive during a static passage, and it is the thing that makes
  it unmistakably *this* phenomenon rather than a rainbow gradient.
- **`uRoughness` is clamped at the point of use** → `clamp(uRoughness, 0, 1)`.
  **Mine**, and it is the same trap entry 130 found: this project's features
  deliberately return out-of-band values to mean *no answer* — CLAUDE.md names
  `spectralFlatness` returning **-1 on silence** — and an unclamped negative
  would invert the jaggedness in a quiet room, invisibly to any test that only
  plays music.
- **The named risk: this must not look like Fringe** → both draw banded curves.
  They differ in kind — Fringe's hyperbolae are open and run off the frame,
  Anneal's are **closed loops around concentrators**, and Anneal is polychrome
  where Fringe is monochrome. **Mine** to name it, and Done-when tests it
  rather than trusting it, because CLAUDE.md's own account of Fringe is that
  it *"drew a lattice of dots instead of the hyperbolae it was supposed to"*
  and nearly shipped because the artefact looked plausible.

**Identity when off** — a new view; nothing existing changes. In silence the
background shear alone holds a few wide fringes and the brushes keep turning on
`uFlow`'s floor, so the sheet is quiet and coloured rather than blank.

**Lands in** — `src/shaders/anneal.frag.glsl` (new); `src/views.ts` (import and
registry entry, appended).

**Done when** — in `views-probe.html`: a `uLevel` sweep 0→1 **increases the
number of colour bands** crossed along a fixed radial line, counted rather than
eyeballed; a `uTransient` spike produces a **front that moves outward** across
consecutive frames; a `uRoughness` sweep changes contour smoothness without
changing band count; `uRoughness = -1` renders **identically to 0**; and the
fringes form **closed loops** — a contour traced from a concentrator returns to
itself rather than leaving the frame, which is the test that separates this
from Fringe. Against real music: a sustained loud passage reads as the sheet
being squeezed.

**Verify** — `pnpm build`, `pnpm lint`, then `views-probe.html` with **Fringe
placed immediately beside it** and both looked at, because "these two are
different enough" is a judgement no probe can make and the whole entry rests on
it. If they read as siblings on screen, say so and stop rather than shipping
the third view of the same idea. Then a phone. Then the atmospheric band at
**320×568 and 360×640**.

**Hard stops** — prefs no (a new value on an existing validated enum) · url no
(`?atmospheric=anneal`) · capture no · dependency no.

### 141. Pick up an emitter and put it down somewhere else
`status: ready` · added 2026-09-05 · **build after 132** (it moves the anchor 132's bob hangs from) · extends 33 and 57

**Do** — on the geometric views whose emitters have a fixed place on screen,
a press that lands **on** an emitter picks it up: it follows the finger while
held and stays where it is put down. Circles, Shards, Grid and Rose have one
such emitter, the centre; Chorus has three to seven, its nodes.
**Why** — Victor: *"on the circle geometric layers which have fixed emitters on
the screen, pressing an emitter with touch or click allows dragging it."*
Today a finger anywhere on the picture births a *new* emitter (entry 33); the
ones the view was born with cannot be reached at all.

**Recon.**
- **Which views, counted.** Seven geometric views. Centre-anchored, one
  emitter: `circles` (`:227`), `shards` (`:85`, `:134`), `grid` (`:92`),
  `rose` (`:174`). Several fixed emitters: `chorus` — `3 + floor(uSeed.x·5)`
  nodes on a ring of radius `NODE_RADIUS = 0.30` at `phase = uSeed.z·TAU`
  (`chorus.frag.glsl:97-99`), positions computed **in the shader** from the
  seed, so today TypeScript does not know where they are and cannot hit-test
  them. Excluded: `tide` (born on the frame edge — nothing on screen to pick
  up) and `drift` (its emitter wanders by design; a finger holding it would
  fight `emitterAt`). Entries 135 (Orbits) and 136 (Moiré) are written with
  their own hand gestures and are not touched here; Orbits' centre would
  qualify later and should reuse this entry's anchor.
- **Entry 132 puts the centre into TypeScript already.** Its `origin.ts` bob
  hangs on a spring from the frame centre and is published as `uOrigin`; every
  centre-anchored site above measures from `uOrigin` after 132. This entry
  therefore does not add a second notion of "where the centre is" — it gives
  132's spring an **anchor that can move**. Without 132 first, this would
  build the `uOrigin` plumbing itself and 132 would then re-plumb it; hence
  the build order.
- **A contact can already be claimed by one thing.** `main.ts:1336`'s
  dispatch has four claimants on a tap — fullscreen, camera mode, menu, play
  — and entry 80 established that a claimed contact "counts toward nothing
  else". A fifth claimant is the same shape.
- **What a contact knows.** `touchField.sample(now)` gives `x, y` in shader
  uv, `clientX/Y`, `downClientX/Y`, `downFor`, `vx, vy`, `onChip`
  (`touches.ts:46`), all already read in the per-frame loop (`main.ts:1568`).

**Decided**
- What "on an emitter" means → **within 36 px of it on the `down`**, converted
  from uv with the canvas rect the same way `toShaderUv` goes the other way.
  Over a uv radius (a thumb is a fixed size; a uv radius shrinks on a big
  screen). 36 px: smaller than a chip (48) so it is deliberate, larger than
  the centre ring (`0.02 uv ≈ 7 px`) so it is findable. **Mine.**
- The claim → **the contact belongs to the emitter for its whole life**: it
  births no touch emitter (entry 33), lays no trail (57), does not resolve as
  a tap or a double (67/125), and **cannot hold-arm the camera** (125) — a
  finger parked on a picked-up emitter for four seconds is holding an
  emitter, not asking for a photograph. The same exclusion pattern
  `fsBlocking` already uses in both loops (`:1576`, `:1642`). **Mine**, by
  reuse.
- While held → **the emitter is at the fingertip**, no lag, no spring; its
  audio-born rings keep firing from wherever it is, so dragging the centre
  drags the whole family of rings with it live. Over easing toward the finger:
  a thing you are holding is where your hand is. **Mine.**
- On release → **it stays where it was put.** Over springing back to its
  default. Victor's ask ("allows dragging it") describes placement, not a
  pull; and a spring-back is entry 132's job for *gravity*, not for a hand.
  With the `grav` chip on, 132's bob now hangs from the new anchor — the
  centre sags below wherever you left it, which is right. **Mine.**
- Persistence → **render-time state only**, never written to `prefs`
  (entries 48, 58, 60 pattern). A reload puts every emitter back. A **re-roll**
  (`uSeed` change: space, double-click, shake) also resets them: the seed
  decides the arrangement, and a new arrangement on old positions would be
  neither. **Mine.**
- Chorus's nodes → **computed once in TypeScript from `uSeed`** (`scene.ts`
  owns the seed value) and uploaded as `uNodes[8]` (vec2) plus `uNodeCount`;
  `chorus.frag.glsl` reads them instead of recomputing from the seed. Over
  duplicating the ring formula in TS and keeping the shader's copy — one
  source, and the hit-test and the picture cannot disagree. The eight-slot
  array is the shader's `nodes ≤ 7` ceiling plus one; unused slots are never
  read. Chorus's node positions are **offsets from `uOrigin`**, so 132's bob
  moves the whole constellation and a drag moves one node within it. **Mine.**
- Clicks → **a mouse press within 36 px of an emitter picks it up instead of
  arming the camera** (entry 117's left-click map). Over letting the click
  arm as well. **Mine**: two things on one click is the fault 117 itself
  avoids, and Victor's ask names click explicitly.
- Two fingers on two emitters → both move; the claim is per contact and per
  emitter. One emitter, two fingers → the first keeps it.
- Where the state lives → `origin.ts` (132's) gains an `anchor` the drag sets
  and a `nodes` array for Chorus; the hit-test is a pure function beside it,
  `pickEmitter(anchor, nodes, x, y, radiusUv) → index | null`, probeable.
  **Mine.**

**Identity when off** — no contact within 36 px of an emitter means no claim,
and every path is byte-for-byte what it was; the anchor at `(0,0)` and the
nodes at their seeded positions render exactly as today.

**Lands in**
- `src/engine/origin.ts` (132's) — `anchor`, `nodes`, `pickEmitter`;
  `engine/index.ts`.
- `src/scene.ts` — node placement from `uSeed` on every re-roll (`:1418`,
  `:1751`), `uNodes`/`uNodeCount` in the shared uniforms; `setEmitterDrag(
  index, x, y | null)` for the caller; the bob's spring anchored at `anchor`.
- `src/shaders/chorus.frag.glsl:97-125` — read `uNodes`; the seed-to-ring
  formula and its comment move to `scene.ts` with the comment intact.
- `src/main.ts` — the fifth claimant in `dispatchTouches`: on `down`, hit-test
  against the current anchor and nodes; a claimed contact is skipped in both
  loops exactly where `fsBlocking` is; on `up`/`cancel` the claim ends and the
  emitter stays.
- `scripts/probe-origin.ts` (132's) — cases for `pickEmitter` (inside, just
  outside, nearest of two) and for an anchor set while the bob is loaded.

**Done when**
- Headless: `pickEmitter` returns the nearest emitter inside 36 px and `null`
  outside; with the anchor moved to `(0.3, 0.1)` and gravity `(0, 1)`, the bob
  settles at `(0.3, 0.38)`.
- Probe page: on Circles, a synthetic contact 20 px from the centre, dragged
  to `(0.3, 0.1)` and released, leaves the next audio ring born there (measure
  the ring's centre), and births **no** touch ring along the way; the same
  contact 60 px from the centre births touch rings as today and moves nothing.
- On Chorus, dragging one node moves only that node; a re-roll puts all back.
- On a phone: press the centre, drag it to a corner, let go; tap elsewhere and
  the ring family is born in the corner. Hold the centre for 5 s: no camera
  glyph.
- Desktop: a left click 20 px from the centre drags it and does not arm.

**Verify** — `pnpm build`, `pnpm lint`, `pnpm probe:origin`, `pnpm probe:tap`
(no tap or hold path changes for unclaimed contacts), `pnpm probe:emitter`
unchanged; the probe page with `circles` as baseline; then the phone. No HUD
surface changes.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 142. The repository becomes kiyo-plays, and the old github.io URL keeps answering
`status: done` · added 2026-09-05 · build 467 · overturns one Decided bullet of entry 63 ·
**build after 144, which strikes every Cloudflare part of this entry — do not
build those** · **build before 145**, which moves the canonical address to
`kiyo.flyflyfly.tv`; if 145 has already shipped, this entry's signpost points
there instead of at the github.io path · claim alone — the git remote changes mid-build, so this must not
be interleaved with another agent's push

**Do** — rename `vvorski/suti-view-2026` to `vvorski/kiyo-plays`, update every
reference to the old name, and leave a redirect standing at each of the two old
live URLs.
**Why** — the app was renamed at build 219 and the repository was deliberately
left behind, because a moved URL would break links already sitting in other
people's messages. That reason has not gone away; it has become the work.

**Decided**
- The name → **`kiyo-plays`**, over `kiyo-play` as typed in the request.
  Victor's call, asked and answered at capture. It matches the wordmark
  `kiyo · plays` and `package.json`'s existing `"name": "kiyo-plays"`, so
  nothing in the repo has to disagree with anything else. A second rename is
  the expensive event here — it breaks the redirect chain again — which is why
  this was worth one question rather than a guess.
- **Entry 63's "the repository and both URLs do not move" is overturned.**
  Victor's call: *"we're going to do it"*. 63 (`docs/built.md`) reasoned that
  *"a Pages URL is not reliably redirected after a repo rename — so renaming
  the repo would quietly break links already in other people's messages"*, and
  that reasoning was correct and still is. This entry does not dispute it; it
  pays the cost 63 declined to pay, by building the redirect 63 assumed did not
  exist. Mark 63 partly superseded at both ends.
- **The github.io redirect is a second repository, not Cloudflare.** **Mine**,
  and this is the recon finding that changes the request as asked. Cloudflare
  cannot redirect `vvorski.github.io/*`: that hostname is GitHub's and sits on
  no Cloudflare zone, so there is nothing there for a rule to attach to. And
  GitHub's own post-rename redirect covers `github.com/vvorski/…` and `git`
  remote URLs — it does **not** cover a Pages project site, which is exactly
  what 63 was right about. The only mechanism that keeps
  `vvorski.github.io/suti-view-2026/` answering is a **new, separate public
  repository named `suti-view-2026`** (the rename frees the name), containing
  one `index.html`, with Pages enabled on its default branch.
- **That stub costs GitHub's automatic redirect of the *code* URL, and that is
  the right trade.** **Mine.** Creating a repository at the old name cancels
  the rename redirect for `github.com/vvorski/suti-view-2026` and for any
  `git remote` still pointing there. Take the loss: this is one developer with
  one clone and one `git remote set-url` to run, whereas the site URL is the
  thing `src/share.ts` exists to put into other people's messages. The code URL
  redirect is worth approximately nothing here; the site URL is the entry.
- **The redirect preserves the query string *and* the hash.** **Mine.** A bare
  `<meta http-equiv="refresh">` drops `?geometric=…&atmospheric=…&mix=…`, and
  those parameters *are* the shared link — a redirect that lands on the
  defaults is barely better than a 404. So the stub's `index.html` is
  `location.replace(NEW + location.search + location.hash)`, with a `<noscript>`
  meta-refresh to the bare new URL and a plain visible anchor beneath it as the
  floor. Nothing else is on that page: no analytics, no third-party script, no
  fonts. It is a signpost, not a site.
- **`suti-view-2026.pages.dev` is live and has been serving a fossil.**
  Recon, and it reframes the Cloudflare half of the request. It returns 200
  with `<title>suti-view</title>` — a build from *before* entry 63 renamed the
  app at build 219, so it has been stale since Cloudflare was parked at
  build 53, and `README.md` and `docs/how-it-works.md` have gone on advertising
  it as **Live** the whole time (`how-it-works.md:9` still says *"Both serve the
  same build. Cloudflare Pages is the primary target"*, which is false and has
  been for roughly three hundred builds). **Struck by entry 144:** Victor's
  call is that the fossil is left exactly where it is — no `_redirects`, no
  deletion of the Pages project, no Cloudflare action of any kind. Only the
  github.io half of this entry's redirect work survives. The finding above is
  kept because it is why the doc lines below are wrong and must still be fixed.
- ~~**`deploy/deploy.sh`'s `PROJECT_NAME` default changes to `kiyo-plays`**~~
  — **struck by entry 144**, which deletes `deploy/` entirely. Nothing to edit.
- ~~**Who runs the Cloudflare step**~~ — **struck by entry 144**. There is no
  Cloudflare step. Nothing in this entry needs a credential.
- **`STORE_KEY` still does not move** — `src/prefs.ts:26` stays
  `'suti-view:prefs'`, comment intact. **Mine**, inherited from 63 and
  untouched by this: the key is invisible and changing it hands every existing
  phone the defaults. Note also that nothing needs to migrate — old and new
  github.io URLs are the **same origin**, `https://vvorski.github.io`, so
  `localStorage` carries across the path change for free. That is only true of
  the github.io pair; `pages.dev` is a different origin and its stored prefs do
  not travel, which costs nothing because the app sitting there is a build-53
  fossil nobody has configured.
- **History stays true.** `src/shaders/circles.frag.glsl:3` and
  `docs/how-it-works.md:93` both say *"suti-view-2026 grew out of
  `~/dev/circles`"*; that sentence is about a repository as it was named then
  and remains accurate. Shipped entries in `docs/built.md` are records and are
  not rewritten either — the only edit there is 63's own supersede note.
  **Mine**, and it is 63's rule, kept.
- **The local working directory is not renamed.** `/Users/vvorski/dev/
  suti-view-2026` stays. **Mine** — Claude Code keys its per-project memory and
  scratchpad directories on the absolute path, so renaming the folder orphans
  both, and the folder name is visible to nobody. The only local change is
  `git remote set-url origin git@github.com:vvorski/kiyo-plays.git`.
- **`vite.config.ts` needs no change.** Recon: `BASE_PATH` is supplied by
  `actions/configure-pages`, which resolves `/<repo>/` at build time
  (`pages.yml`, the `Build` step), so the new path is picked up automatically.
  **Mine**, and it is stated here only because a hardcoded base path is the
  first thing anyone will go hunting for.
- **The `pages.dev` line is removed from both doc headers, not repointed.**
  `README.md:5` and `docs/how-it-works.md:6` list the github.io URL alone,
  updated to `kiyo-plays`. **Mine** — once it is a redirect it is not a place
  to send anyone, and CLAUDE.md already says GitHub Pages is the deploy.
  `how-it-works.md:9`'s "both serve the same build / Cloudflare is primary"
  paragraph goes with it.

**Lands in** — nine files in this repo carry the old name and are counted, not
recalled; two more carry it and are deliberately left alone.
- `README.md:5–6` (2 refs) and `docs/how-it-works.md:6–7, :93` (3 refs — the
  third is the history sentence and stays).
- `CLAUDE.md:243` (1) — the GitHub Pages deploy paragraph.
- `deploy/deploy.sh:13` (1) — `PROJECT_NAME`, per Decided.
- `.claude/skills/auto-issue-gogo/SKILL.md:8, :246, :299` (3 — `:246` is a
  live-URL smoke-check loop and must point at the new URL).
- `.claude/skills/spec-to-issue/SKILL.md:3, :12, :187` (3) and
  `.claude/skills/spec-to-issue/recon-traps.md:132` (1).
- `.claude/agents/geometric-variation.md:9` (1).
- New: `redirect-stub/index.html` (the github.io signpost, copied into the
  stub repository) plus a short `redirect-stub/README.md` saying where it goes.
  At the repository root, not under `deploy/`, which entry 144 deletes.
- Left alone: `src/shaders/circles.frag.glsl:3`, `src/prefs.ts:26`,
  `docs/built.md` (archive; one supersede note on entry 63 only).
- Outside this repo: the GitHub rename, and a new public repository
  `vvorski/suti-view-2026` with Pages enabled serving the stub.

**Done when**
1. `git remote -v` reads `vvorski/kiyo-plays`, `https://vvorski.github.io/
   kiyo-plays/` returns 200, and its `<title>` is `kiyo · plays`.
2. Opening `https://vvorski.github.io/suti-view-2026/?geometric=shards&mix=
   screen` in a browser ends on the new URL **with both parameters intact** and
   the app running Shards on screen blend. Checked by loading it, not by
   reading the redirect's source — a redirect that drops the query looks
   identical to one that keeps it until you follow it.
3. `grep -rn 'suti-view-2026' . --exclude-dir=node_modules --exclude-dir=.git`
   returns only: `docs/built.md`, `src/shaders/circles.frag.glsl:3`, and
   `redirect-stub/`. Nothing else.
4. A phone with settings stored against the old github.io path still has them
   on the new one — same origin, so this should cost nothing, and confirming it
   is how you find out it did.
5. ~~the `pages.dev` redirect~~ — **struck by entry 144**; that URL is left
   serving its fossil by decision, so there is nothing here to check and no
   partial ship to disclose.

**Verify** — `pnpm build`, `pnpm lint`, and one full green `pages.yml` run under
the new repository name (the rename is exactly the kind of change that breaks
CI silently). `pnpm probe:fullscreen` as the standing gate. Look at the stub
page itself at 320×568: it is one sentence and a link, and it must not need
horizontal scroll or leave a blank white screen if the script is blocked.

**Hard stops** — prefs **no**: `STORE_KEY` is untouched and old and new share
an origin, so nothing migrates · url **no as to parameters** — every `?`
parameter keeps its name and meaning; what moves is the origin and path, which
is the thing entry 63 declined and which Victor has approved in this request
(*"we're going to do it"*), with a redirect standing in place of the link rot
63 was avoiding · capture **no** · dependency **no**.

### 143. A held space bar fires one shake, not a repeating one — is that the price?
`status: blocked` · added 2026-09-05 · found while building 126 · needs Victor

**Do** — decide whether a continuously held space bar should keep re-seeding
for as long as it is held, or whether firing once per unbroken press (settling,
then needing a real release-and-repress, or a stop-start hand tremor, to fire
again) is the correct reading of "repeating hard shake" after all.

**Why** — entry 126 built the space bar as a real synthetic shake, fed straight
into `shake.ts`'s existing `Tumble`. Its own Decided section reasoned that "a
continuous 26 m/s² at 5Hz *is* a repeating hard shake, and how often it
re-seeds is then governed by `shake.ts`'s existing cooldown and double-window
rather than by a new rate limit invented here" — and its Done-when asked for
"two seconds held produces at least three [shake events]". Measured against
the real `Tumble` (`pnpm probe:synth-shake`, section 2, and reproduced
independently against `probe-shake.ts`'s own hand-authored sine, not anything
entry 126 built), that figure does not hold: a smooth, unbroken oscillation —
synthetic or a hand-authored sine, it makes no difference — never produces a
contiguous 0.15s dip below `currentStrongDown()`, so `shake.ts`'s own
`QUIET_GAP` guard (added specifically to stop "one long shake tripping the
reversal counter over and over inside the cooldown", per its own comment — a
real, measured bug at the time) never lets `armedForDouble` become true, and
the reversal counter's own escalation resets `cooldown`/`doubleWindow` to their
full values every time it completes three crossings (~0.6s at 5Hz) whether or
not anything fires. A continuous, unbroken press therefore produces **exactly
one** shake event, held for one second or a hundred, and does not re-seed again
without an actual pause.

**What this is not** — a bug in entry 126's synthesis, or a flaw in `QUIET_GAP`.
Both are working exactly as designed and as a real phone's accelerometer would
also behave under the identical mechanism: `probe:synth-shake`'s own comment
walks through the arithmetic, and its assertions pass against both the
synthesised signal and an independent hand-authored one. Entry 126 shipped
everything it could verify — the tumble, the RGB slip's held direction, the
gravity-free feed, `hasMotionData()` staying false, one strong per tap — and
left this one figure as a finding rather than forcing a change to `QUIET_GAP`
to manufacture it: CLAUDE.md's own "a reasoned comment outranks an entry that
did not know about it."

**Decided** — nothing yet; this is the fork itself.
- A held space bar could re-seed on a timer of its own (say, once every N
  seconds while `held` stays true) — new logic this entry's own Decided
  explicitly declined to add, and a real accelerometer has no equivalent, so
  desktop would behave *unlike* a phone rather than standing in for one.
- Or "one shake per unbroken press" could simply be the answer, matching what
  a real continuous shake already does against this exact mechanism, in which
  case Decided's "holding scrambles repeatedly" sentence and Done-when's "at
  least three" figure are both quietly wrong and want correcting in entry 126's
  own text — a small edit, not a rebuild.
- Or `QUIET_GAP`/the escalation logic could be revisited specifically for
  intentional, deliberate re-triggering (a policy question about what "held"
  should mean generally, on a phone as much as a desktop) — the largest of the
  three options, and the one most likely to reopen a decision that fixed a
  real bug for a real reason.

**Lands in** — whichever of the three, `docs/todo.md`'s entry 126 (the
Decided bullet and the Done-when figure), and possibly `src/shake.ts` if the
third option is chosen.
**Done when** — Victor has picked one of the three (or named a fourth), and
whichever entry builds it corrects entry 126's own text to match rather than
leaving two entries quietly disagreeing about what a held space bar does.

**Verify** — n/a until answered.

**Hard stops** — prefs no · url no · capture no · dependency no.

### 144. Cloudflare leaves the repository
`status: done` · added 2026-09-05 · build 465 · **build before 142, then 145** — it
overlaps 142 on six files and strikes 142's Cloudflare parts, so building it
second means renaming things this entry then deletes · **not contradicted by
145**: that entry brings Cloudflare back as *DNS only*, never as a host, and
nothing removed here returns

**Do** — remove every Cloudflare Pages reference from the repo: the deploy
script, the `wrangler` dev dependency, the docs, the workflow comments and the
skill files, keeping only the two comments whose reasoning outlives the target.
**Why** — one host has carried this site since build 53, and a repo that still
documents two of them is describing an arrangement that has not existed for
about three hundred and seventy builds.

**Decided**
- **`suti-view-2026.pages.dev` is left exactly as it is** — live, and serving a
  build-53 fossil titled `suti-view` — over uploading a one-off `_redirects` to
  point it at the new URL, and over deleting the Pages project so it 404s.
  Victor's call, asked at capture with the fossil's status code and title on
  the table. **This entry therefore touches Cloudflare the service not at all**;
  every change is inside the repository, and no credential, token or dashboard
  visit is needed to build it.
- **That decision is recorded here and only here.** **Mine**, and it is the one
  exception to the purge, so overturn it in one line if the silence should be
  total. The option chosen was framed as *"no mention of Cloudflare anywhere"*
  and I am keeping this entry's own account of it, because the queue is where
  this project records decisions and their reasons, and once this archives to
  `docs/built.md` it is the only place a future reader can discover why a URL
  with this project's old name answers with an app nobody recognises. It costs
  no runtime bytes and appears in nothing a visitor to the site reads.
- **`.github/workflows/checks.yml` is kept; only its header comment changes.**
  **Mine**, and CLAUDE.md already says it in as many words: *"do not delete
  `checks.yml` to tidy up — `pages.yml` runs `pnpm build` but never `pnpm
  lint`, so that file is the lint gate."* The new comment says what the file is
  — lint, typecheck, build, probes — without the history of the deploy it grew
  out of. Deleting the file is the single most destructive thing this entry
  could do, which is why Done-when 4 checks for it in CI rather than by eye.
- **CLAUDE.md's "Cloudflare is parked" bullet is rewritten, not deleted.**
  `CLAUDE.md:247–251`. **Mine**, and it is this project's own *"Deleting code
  deletes what it was doing"* rule applied to prose: that bullet is the **only**
  place in the repo that instructs anyone not to delete `checks.yml`. Delete the
  paragraph and the instruction goes with it, and the next tidy-up drops the
  lint gate — the exact failure the paragraph was written to prevent. The
  replacement keeps that sentence, drops everything about tokens, wrangler and
  parking, and no longer reads as a decision that might be revisited.
  `CLAUDE.md:367`'s `pnpm deploy` line leaves the Commands block entirely.
- **`vite.config.ts`'s two Cloudflare comments are rewritten, not deleted.**
  `:11` and `:106`. **Mine** — each explains a live decision and merely uses
  Cloudflare as its evidence. `:11` argues the build marker is the commit count
  rather than a timestamp; the argument survives intact, because a timestamp
  still differs between any two builds of the same commit. `:106` argues `base`
  comes from the environment rather than being hardcoded; the reason is now
  that `actions/configure-pages` supplies `/<repo>/` while `pnpm dev` and
  `vite preview` need `/`, which is a better reason than the one it has.
  Deleting either comment would leave an odd-looking line with nothing arguing
  for it, which is what the house style exists to prevent.
- **`deploy/` is deleted outright**, along with `package.json:41`'s `"deploy"`
  script, `package.json:61`'s `"wrangler": "^3.99.0"` devDependency and
  `.gitignore:8`'s `.wrangler/`. **Mine**, and it is the opposite call to the
  two above for a reason: unlike those comments, none of this carries reasoning
  that outlives its target. A script that deploys to a place nobody deploys to
  is not documentation, it is a loaded gun — and with `PROJECT_NAME` defaulting
  to `suti-view-2026` it points straight at the fossil. Nothing in `pnpm build`,
  `pnpm lint` or any probe imports it; the dev dependency is 6.8 MB of
  `node_modules` and zero runtime bytes.
- **The lockfile is regenerated, never hand-edited.** `pnpm-lock.yaml` carries
  26 matches; run `pnpm install` and commit what it writes. **Mine** — a
  hand-pruned lockfile passes `grep` and fails `--frozen-lockfile` in CI, which
  is Done-when 3.
- **`docs/how-it-works.md`'s Deploying section is rewritten to one target, and
  this is a correction rather than a purge.** Recon: `:597` documents
  **`.github/workflows/deploy.yml`, a file that does not exist** — it was
  deleted when Cloudflare was parked at build 53, and the section has gone on
  describing a two-target deploy and a token setup ever since. `:9`'s *"Both
  serve the same build. Cloudflare Pages is the primary target"* is false in
  both halves and goes with it, and `:6`'s **Live** line loses its `pages.dev`
  half. **Mine.**
- **`README.md:5`'s Live line loses its `pages.dev` half**, leaving the
  github.io URL alone. Entry 142 makes the same edit for a different reason;
  whichever runs first does it and the second finds it done.
- **The `.claude/` skill files are edited too, not exempted.** **Mine** —
  `auto-issue-gogo/SKILL.md:234–239, :246, :305` and
  `spec-to-issue/recon-traps.md:127–131` both carry a "the CI Cloudflare deploy
  has never worked, do not try to fix it" warning and a two-host verification
  loop. The warning describes a thing that will no longer exist to be fixed, and
  a loop that curls two URLs when there is one host is how an agent gets a false
  failure. These files instruct future agents; leaving them stale is worse than
  leaving a stale doc, because nobody proofreads an instruction they are
  following.
- **`docs/built.md` is untouched.** One match at `:5716`, inside shipped entry
  63, which is a record of what was decided then and remains accurate. Shipped
  entries are not rewritten.
- **What this strikes from entry 142** — its `_redirects` artefact, its *"the
  existing Pages project ... gets a deployment containing only `_redirects`"*
  conclusion, its *"Who runs the Cloudflare step"* bullet, its
  `deploy/deploy.sh` `PROJECT_NAME` bullet (the file will be gone), and its
  **Done-when 5** entirely. 142's remaining github.io signpost moves from
  `deploy/redirect-stub/` to `redirect-stub/` at the repository root, since
  `deploy/` will not exist and a signpost is not a deploy of this app. All of
  that is amended into 142 in place and flagged on its `status:` line, so the
  strike is visible at both ends without reading this entry.

**Lands in** — fourteen files carry `cloudflare`, `wrangler` or `pages.dev`
outside `node_modules`; counted, not recalled. Eleven are edited, one is
deleted, one is left alone, one is the queue itself.
- `deploy/deploy.sh` (5 matches) — **deleted**, with the now-empty `deploy/`.
- `package.json` — `:61` the devDependency (1 match) and `:41` the `"deploy"`
  script, which the grep above does not catch because it names no Cloudflare
  word. Both go.
- `pnpm-lock.yaml` (26) — regenerated by `pnpm install`.
- `docs/how-it-works.md` (8) — `:6`, `:9`, and the Deploying section at
  `:592–610`.
- `CLAUDE.md` (4) — `:247–251` rewritten per Decided, `:367` removed.
- `.github/workflows/checks.yml` (3) — header comment only; **the file stays**.
- `.github/workflows/pages.yml` (3) — `:3`, `:12`, `:41`, all comments.
- `vite.config.ts` (2) — `:11`, `:106`, rewritten per Decided.
- `.claude/skills/auto-issue-gogo/SKILL.md` (5) and
  `.claude/skills/spec-to-issue/recon-traps.md` (3).
- `.gitignore:8` (1) and `README.md:5` (1).
- `docs/built.md` (1) — **untouched**.
- `docs/todo.md` — entry 142's Cloudflare parts, amended in place.

**Done when**
1. `grep -rni 'cloudflare\|wrangler\|pages\.dev' . --exclude-dir=node_modules
   --exclude-dir=.git` returns matches in exactly two files: `docs/built.md`
   and `docs/todo.md`. Nothing in `src/`, `README.md`, `CLAUDE.md`,
   `docs/how-it-works.md`, `.github/`, `.claude/`, `package.json` or
   `vite.config.ts`.
2. `deploy/` does not exist, and `pnpm deploy` fails without running anything.
   **Corrected against the actual build**: `deploy` is a reserved pnpm
   subcommand, so removing the project's own `"deploy"` script does not make
   pnpm report "command not found" — it falls through to pnpm's own workspace
   deploy and fails with `ERR_PNPM_CANNOT_DEPLOY: A deploy is only possible
   from inside a workspace`, which this is not. Still a failure, still runs
   nothing; the mechanism just is not the one this line originally named.
3. `pnpm install --frozen-lockfile` succeeds against the committed lockfile —
   the proof it was regenerated rather than pruned by hand.
4. `.github/workflows/checks.yml` still exists and still runs `pnpm lint`,
   confirmed by a **green Checks run** on the branch rather than by reading the
   file. This is the one thing the entry can silently destroy.
5. `CLAUDE.md` still carries a sentence forbidding the deletion of
   `checks.yml`, and `vite.config.ts` still explains why the build marker is a
   commit count and why `base` comes from the environment.
6. `docs/how-it-works.md`'s Deploying section names one target and no file that
   does not exist — every workflow path it mentions is present in
   `ls .github/workflows/`.

**Verify** — `pnpm build`, `pnpm lint`, and `pnpm install --frozen-lockfile`
against a deleted `node_modules`. The full probe set `checks.yml` runs:
`pnpm probe`, `probe:shake`, `probe:fullscreen`, `probe:camera-arm`,
`probe:raise-camera`, `probe:origin`. Then one green **Checks** and one green
**Pages** run on `main` after the merge — editing a workflow's comments is
exactly the kind of change that can only be wrong in CI. **No on-screen check
is required here and that is a decision, not an omission**: nothing in this
entry reaches a rendered surface, a shader, the HUD or the gate.

**Hard stops** — prefs **no** · url **no** — no parameter changes, and the
`pages.dev` origin is deliberately left serving what it serves · capture
**no** — this removes a publishing path and adds no request · dependency
**no, and it removes one**: `wrangler ^3.99.0` leaves `devDependencies`,
6.8 MB out of `node_modules`, zero runtime bytes either way.

### 145. kiyo.flyflyfly.tv
`status: building` · started 2026-09-06 · added 2026-09-05 · **build after 144, then 142** — 144 purges
Cloudflare as a *host*, 142 renames the repo, and this one brings Cloudflare
back as *DNS only*; in any other order the three fight over the same doc lines ·
**the DNS half is already executed — see Progress** · the GitHub Pages half is
not

**Progress, 2026-09-05.** Done, in this order, and verified at each step:
1. Zone `flyflyfly.tv` created in "Victors Sites"
   (`982a8f8320d86f2d233fb2319d5e6146`), Free plan.
2. **Cloudflare's automatic scan imported nothing — zero records.** All four
   were created by hand from the table below, DNS-only, TTLs matched to
   Hover's. This is the entry's central warning turning out to be true in the
   strongest form: had the nameservers moved first, the domain would have gone
   dark. **Create the zone and its records before touching the registrar.**
3. Verified *before* cutover by querying `amir.ns.cloudflare.com` directly
   while the domain still resolved through Hover: apex, `www`, `mail`, `MX`
   and an arbitrary wildcard name all returned byte-identical answers.
4. Nameservers changed at Hover to `amir` / `brenna.ns.cloudflare.com`. Hover
   confirms third-party nameservers. **The `.tv` registry still delegated to
   Hover at the time of writing** — propagation pending, nothing broken.

**Progress, 2026-09-06.** Registry delegation completed on its own — the zone
reads `active` in the Cloudflare API, and public resolvers (1.1.1.1, 8.8.8.8,
9.9.9.9) all return the Cloudflare nameservers. Confirmed live: `http://
flyflyfly.tv/` and `http://www.flyflyfly.tv/` both 200 (Done-when 3), `MX` and
`mail.flyflyfly.tv` resolve exactly as before the move (the `MX`/mail-delivery
half of Done-when 2 could not be tested from here — no email-sending tool
available; the DNS side of it is confirmed correct). All four scanned records
verified byte-identical to the table above via the API, `proxied: false` on
every one. Added the fifth: `CNAME kiyo → vvorski.github.io`, DNS-only,
confirmed via the API rather than the dashboard's colour (Done-when 4). Set
`public/CNAME` and the custom domain in the `kiyo-plays` repo's Pages settings
via `gh api`.

**Blocked on GitHub's certificate issuance.** `https://kiyo.flyflyfly.tv/`
serves 200 over plain HTTP and the app is genuinely live there (byte-identical
`Content-Length` to the real bundle), but HTTPS still answers with GitHub's
generic `*.github.io` certificate rather than one naming this host.
`https_enforced` is still `false` in the Pages API. **Do not tick "Enforce
HTTPS" or consider Done-when 5 met until the certificate itself names
`kiyo.flyflyfly.tv` — curl or openssl `s_client`, never `-k`, which returns 200
against the wrong certificate and reads as success when it is not.**

GitHub's own docs put "up to an hour" as the normal window; no `CAA` record
exists on the zone to block issuance (checked via the API, not assumed).
Passed that hour with no change, so applied the documented remedy — cleared
`cname` on the Pages config via `gh api`, confirmed it read back `null`, then
set it back to `kiyo.flyflyfly.tv` — which re-triggers provisioning and resets
the clock. If a second hour passes with no certificate, that is a real fault
rather than ordinary latency and the next tick should stop retrying blindly
and investigate GitHub's Pages status page and support, rather than
re-triggering a third time on a hunch.

Still to do: the certificate (above); Done-when 5's phone check; Done-when 6
(the github.io → custom-domain redirect, and the query-string check);
Done-when 7 (`public/CNAME` survives a redeploy); the real-mail-delivery half
of Done-when 2.

**Do** — move `flyflyfly.tv`'s DNS to Cloudflare, point `kiyo.flyflyfly.tv` at
GitHub Pages, and make it the address the app is served from.
**Why** — the site's address is a path under someone else's username, and
`share.ts` exists to put that address in other people's messages.

**Decided**
- **The domain moves to Cloudflare wholesale**, over adding one `CNAME` at
  Hover and over using a domain already on Cloudflare. Victor's call, asked at
  capture with the mail risk on the table. **The consequence to hold on to: the
  zone this migrates carries live mail**, and the entry is mostly about not
  breaking it.
- **The MCP cannot do this today, which is why this is an entry and not a
  finished job.** Recon: `flyflyfly.tv` runs on `ns1/ns2.hover.com` and is in
  neither Cloudflare account the MCP can reach (ten zones are; this is not one).
  DNS control begins only after the nameserver change, which is Victor's, at
  Hover. Everything after that point is one MCP call.
- **The zone as it stands, read from Hover's own panel on 2026-09-05.** This
  supersedes an earlier version of this bullet that was assembled by probing
  `ns1.hover.com` from outside; the panel is authoritative and it corrects the
  probe on the one point that mattered. **This is the complete zone — four
  records, nothing else:**

  | Type | Host   | Value                 | TTL     |
  |------|--------|-----------------------|---------|
  | `A`  | `*`    | `162.215.121.122`     | 15 min  |
  | `A`  | `@`    | `162.215.121.122`     | 15 min  |
  | `MX` | `@`    | `10 mail.flyflyfly.tv`| 24 h    |
  | `A`  | `mail` | `162.215.121.122`     | 5 min   |

  No `AAAA`, no `TXT` of any kind (so no SPF, no DKIM, no DMARC), no `CAA`, no
  `SRV`, no `NS` beyond Hover's own. No URL forwards configured, and no Hover
  mailboxes — the Email tab is a sales page, so mail is entirely Bluehost by
  way of that `MX`. No `kiyo` record: the name is free and answers today only
  through the wildcard.
- **The failure mode this entry was written around does not exist, and the real
  one is smaller.** `A mail` is an **explicit record**, not the wildcard, so
  the `MX` target does not depend on `*` and the earlier instruction to add a
  belt-and-braces `A mail` is redundant — it is already there and only has to
  survive the scan. What *is* wildcard-dependent is **`www`**: there is no
  explicit `www` record, so `www.flyflyfly.tv` resolves solely because `A *`
  does. **Lose the wildcard in the migration and the website's `www` breaks,
  not the mail.** That is a visible, same-day failure rather than a silent one,
  which is a materially better risk than the entry originally assumed — but the
  wildcard is still the record to check first in Cloudflare's scan.
- **The site has no HTTPS certificate of its own, and did not before any of
  this.** Port 443 on `162.215.121.122` serves Bluehost's shared certificate
  for `CN=*.accountservergroup.com`, which does not match `flyflyfly.tv`, so
  `https://flyflyfly.tv/` fails verification (`curl` exit 60) while
  `http://` returns 200 on both apex and `www`. Established while the registry
  still pointed at Hover, so it is **pre-existing and not caused by the
  migration**. Recorded because Done-when 3 originally asked for "a valid
  certificate" and would have failed for a reason having nothing to do with
  this entry. **Mine**: change nothing about it here. Once the zone is active,
  turning the orange cloud on for apex and `www` would give that site free
  HTTPS at Cloudflare's edge with SSL mode **Full** (not Full-strict — the
  origin certificate does not match the name) — but that changes how a
  different site of Victor's is served and is his call, not this entry's.
- **The `MX` TTL is 24 hours**, against 15 minutes on everything else. Nothing
  in this entry changes the `MX`, but it does mean a mistake involving it would
  be the slowest thing here to walk back. **Mine**: drop the `MX` TTL to
  15 minutes at Hover a day *before* the nameserver change, and restore it
  afterwards. One reversible edit that buys a fast retreat on the only record
  whose failure is invisible.
- **Every imported record is DNS-only (grey cloud), including the apex and
  `www`.** **Mine**, and it is what makes the migration reversible: a pure
  nameserver change with byte-identical answers means the existing Bluehost
  site and its certificate keep serving exactly as they do now. Proxying the
  apex would put Cloudflare in front of an origin whose TLS nobody here has
  checked, and Flexible SSL against a origin that already redirects to HTTPS is
  the classic infinite loop. It is also the only option for the wildcard, since
  proxied wildcards are an Enterprise feature.
- **`kiyo` is `CNAME` → `vvorski.github.io`, DNS-only.** **Mine**, and the grey
  cloud is not a default here, it is required: GitHub issues its own Let's
  Encrypt certificate for the custom domain and has to see the challenge
  request. Proxying it is the standard cause of a certificate stuck on
  "provisioning" and, with Flexible SSL, a redirect loop. Do not turn the cloud
  orange and then reach for an SSL mode to fix it. The absence of any `CAA`
  record is checked above and means nothing blocks the issuance.
- **The record wins over the wildcard.** An explicit `CNAME kiyo` takes
  precedence over `A *`, so no wildcard change is needed to free the name —
  which also means `kiyo.flyflyfly.tv` **already resolves today**, to Bluehost,
  and a stale cached answer is a thing to expect during cutover rather than a
  fault.
- **`public/CNAME`, one line, `kiyo.flyflyfly.tv`.** **Mine** — with an
  Actions-based Pages deploy the custom domain has to be in the published
  artifact or a later deploy can clear it from repo settings, and `public/` is
  what Vite copies verbatim into `dist/`. This is the only file the entry adds.
- **`vite.config.ts` needs no change.** Recon: `actions/configure-pages`
  resolves `base_path` to `/` once a custom domain is set, and the config
  already reads `BASE_PATH` with a `/` default. Stated because it looks like it
  must change, and because entry 144 rewrites that very comment — after this
  entry its reason holds better, not worse.
- **Every phone loses its stored settings, and nothing is built to prevent
  it.** This is the entry's real cost. `https://kiyo.flyflyfly.tv` is a
  different **origin** from `https://vvorski.github.io`, so `localStorage`
  under `suti-view:prefs` does not travel: view, colours, mapping, mix, all of
  it returns to defaults on the new address, and microphone, motion and camera
  permissions are asked again. There is no cross-origin read, so no migration
  is possible — only a handoff through the URL, which would mean every visitor
  arriving via a link they were already given. **Mine**: build nothing. The
  stored state is a handful of taste settings that a visitor re-picks in
  seconds, and the app re-rolls on a fresh visit by design. Note the contrast
  with entry 142, which is free precisely because it stays on one origin — that
  is not a reason to do this one differently, it is the reason to say the cost
  out loud here.
- **The old addresses are not retired and are expected to redirect
  themselves.** GitHub redirects `<user>.github.io/<repo>/` to the custom
  domain once one is configured, so entry 142's signpost repo still lands
  correctly, via one extra hop. **Mine** as to relying on it rather than
  hand-building a second redirect — and Done-when 6 checks it rather than
  trusting it.
- **Account → "Victors Sites"** (`d21d0e8b6fb0441ae79e0f8d2ae296dd`), where the
  other nine zones already live, on the Free plan, which adding a zone does not
  cost. **Mine**, obvious.
- **Cloudflare is DNS here and never a host**, and that sentence goes into
  `CLAUDE.md` next to entry 144's rewritten bullet. **Mine** — 144 is titled
  "Cloudflare leaves the repository" and without this line the two entries read
  as a reversal instead of a distinction. Nothing about `wrangler`, Pages or
  `deploy/` comes back.

**Lands in**
- **Outside the repo, and Victor's hands:** add `flyflyfly.tv` to the "Victors
  Sites" account; check the scan against the snapshot above, record by record,
  and add what it missed **before** cutover; change the nameservers at Hover;
  then, in the repo's GitHub Pages settings, set the custom domain and tick
  **Enforce HTTPS** once the certificate is issued.
- **Via the MCP, after activation:** confirm the four scanned records against
  the table above — `A *` first — then add `CNAME kiyo → vvorski.github.io`.
  All five DNS-only. Nothing needs creating except `kiyo`; everything else is a
  check that the scan did its job.
- `public/CNAME` — new, one line.
- `README.md:5` and `docs/how-it-works.md:6` — the **Live** line becomes
  `kiyo.flyflyfly.tv`. Both lines are also edited by 142 and 144; this is the
  last of the three and leaves them final.
- `CLAUDE.md:243` — the deploy paragraph names the custom domain, and gains the
  DNS-not-a-host sentence.
- `docs/how-it-works.md`'s Deploying section (as 144 leaves it) — one paragraph
  on where the name comes from.
- Entry 142's signpost target, if that entry has already shipped: it should
  point at `https://kiyo.flyflyfly.tv/`, not the github.io path.

**Done when**
1. `dig +short NS flyflyfly.tv` returns Cloudflare nameservers, and the zone
   reads `active` in the API.
2. **Mail still resolves and still arrives.** `dig +short MX flyflyfly.tv`
   returns `10 mail.flyflyfly.tv`, `dig +short mail.flyflyfly.tv` returns
   `162.215.121.122`, and a real message is sent to an address at the domain
   and confirmed received. Not "the record looks right" — delivered.
3. `http://flyflyfly.tv/` and `http://www.flyflyfly.tv/` return 200, exactly
   as they did before the move. **Plain HTTP, not HTTPS** — see Decided: that
   site has never had a matching certificate, and asking for one here would be
   testing somebody else's bug. **Check `www` specifically and first**: it has
   no record of its own and exists only through the wildcard, so it is the
   thing the migration can drop.
4. `dig +short kiyo.flyflyfly.tv` returns `vvorski.github.io` and not
   `162.215.121.122`, and the record is DNS-only — `proxied: false` in the API
   response, not judged from the dashboard's colour.
5. `https://kiyo.flyflyfly.tv/` serves the app over HTTPS with a certificate
   naming that host, the gate reads `kiyo · plays`, and the build number
   matches the current `main`. Loaded on a phone, not only curled.
6. `https://vvorski.github.io/kiyo-plays/` redirects to
   `https://kiyo.flyflyfly.tv/`, and a link carrying `?geometric=shards&
   mix=screen` arrives with both parameters intact.
7. `public/CNAME` survives a deploy: after the next push to `main`, the custom
   domain is still set in repo settings and `dist/CNAME` is in the artifact.

**Verify** — `pnpm build`, `pnpm lint`, and a green **Pages** run on `main`
after `public/CNAME` lands. Then the whole of Done-when, in order, with 2 and 3
before anything else is celebrated. On the new origin, on a phone: the gate at
320×568, grant the microphone, confirm the app runs and that settings changed
there persist across a reload — a fresh origin with no stored prefs is the
first time in a long while this project's storage path has been exercised from
empty.

**Hard stops** — prefs **no as to shape**, and **yes as to consequence**:
`STORE_KEY` and every field are untouched, but a new origin means every
existing install starts from defaults. Victor has approved the move that causes
it, and Decided records that nothing is built to soften it · url **no** — no
parameter changes; the origin moves and every parameter survives it · capture
**no** — no new request, nothing recorded, and Cloudflare is a nameserver here,
not a proxy in the path · dependency **no** — no runtime bytes; `public/CNAME`
is 18 characters.
