# Working in this repo

A microphone-driven WebGL visualiser for a phone held in the hand. Vite +
TypeScript + Three.js + pnpm, no framework. `README.md` is the design record and
is worth reading before changing anything structural — it explains *why* most of
the odd-looking decisions are the way they are.

## Refactor as part of the feature, not after it

**When a change is big, the reorganisation it implies is part of that change.**
Not a follow-up, not a TODO, not "we can tidy this later" — later does not come,
and the next person inherits a shape that stopped describing the code two
features ago.

Concretely, when adding something substantial, look for and fix:

- **A boundary that has grown a second tenant.** One implementation living
  behind an interface is a guess about the future; two is a fact about the
  present. The moment the second arrives, move them behind a real module and
  name it.
- **Analysis wearing rendering clothes** (or vice versa). `scene.ts` has
  repeatedly accumulated things that are not rendering — its own `dt`, its own
  decimation, a log-band reduction. If the thing you are adding needs one of
  those, move it to where it belongs rather than adding a fourth.
- **A shape that has stopped describing the thing.** The HUD's bands are meant
  to read outward as the compositing order. A colour picker got put in the slot
  between the two layers, which is where the merge mode belongs, and the stack
  silently stopped meaning anything. If the arrangement encodes something,
  adding to it means checking the encoding still holds.
- **Duplication that only exists because something was not exported.** Three
  strategies in `mapping.ts` each re-spread the same nine fields because
  `Common` is module-private. Adding a tenth field is a four-file edit. Export
  it instead of making the fourth copy.
- **Hand-tuned constants standing in for layout.** Three absolutely-positioned
  elements at hand-picked offsets in one screen corner worked until the third
  button appeared, then silently overlapped. If you are about to add the third
  of something, that is the signal to make the container do the work.

What this rule is *not*: licence to rewrite whatever you are passing through. A
refactor belongs in the change when the change is what made it necessary or
newly obvious. Speculative reorganisation ahead of a second tenant is the same
mistake in the other direction.

Say what you refactored and why, in the commit message, in prose.

## Verify in the thing, not in your head

This is a *visual* project. A clean `tsc` proves nothing about whether the
picture is right, and reviewing your own diff proves less than that.

- Shader and HUD changes get looked at in a browser before they are committed.
  A throwaway probe page that imports `scene.ts` or `hud.ts` directly is faster
  than reaching the real app through the mic gate, and can be driven from
  `javascript_tool`.
- Behaviour with a timescale longer than a few seconds — structure, flavour,
  the shake springs — gets a headless probe under
  `node --experimental-strip-types`. You cannot tune a ninety-second behaviour
  by watching a screen, and you cannot tune an accelerometer by waving a laptop.
- **Keep a known-good case in every probe.** A probe harness reporting that a
  working view renders black is how two harness bugs got found —
  `requestAnimationFrame` never fires in a non-frontmost automation window, and
  Three sizes the drawing buffer to the *window*, not the canvas CSS box, so
  `readPixels` must use `gl.drawingBufferWidth/Height`. Without a baseline that
  should pass, both would have been read as shader bugs. The same stall hits
  **CSS transitions and animations**: `getAnimations()` reports one `running`
  and the class list is exactly right, but the opacity never advances, because
  `document.visibilityState` is `hidden` in that window and Chrome throttles
  frame-driven work there regardless of what triggers it — rAF, a transition,
  or a `@keyframes` animation. Confirmed by checking `hasFocus()`/
  `visibilityState` before concluding the CSS itself is wrong.
- **A plausible-looking table is the dangerous kind of wrong.** The shake probe's
  first run showed every case from a hand tremor upward pinned at the rotation
  cap. That was not the shader; it was the probe's own synthetic spin being a
  constant regardless of amplitude, plus kicks that were not scaled by `dt`.
  Results that are suspiciously uniform are results to distrust.
- **Compiling is not rendering, and rendering is not right.** `Fringe` compiled
  cleanly, passed a centre-pixel readback, and drew a lattice of dots instead of
  the hyperbolae it was supposed to. Its two-source sum factored into a
  path-difference term and a concentric carrier, and drawing both beaded the
  fringes — which looked exactly like a moire artefact, so it nearly shipped.
  `views-probe.html` renders every atmospheric view side by side from identical
  synthetic audio; the existing views are the baseline. Use it, and look at it.

## Check the assembly, not only the parts

Three separate pieces of work each added one control to the HUD. Each was
verified on its own and each was correct: the fan opened and committed, the
rings dragged and persisted, the dial snapped and closed. Assembled, the colour
rings were drawn straight across the band labels and the whole HUD was
illegible on a phone.

Nobody's task included "does the whole thing still look right", so nobody
looked. Reviewing the three diffs did not catch it either, and could not have —
each diff was clean.

- After any change that adds to a shared surface, open the **assembled** thing at
  320x568 and 360x640 and look at it, in every state it has. `hud-narrow.html`
  loads the HUD in iframes at those sizes, which is the only way to get a true
  phone viewport here — `resize_window` reports success and leaves `innerWidth`
  at 800.
- A popup anchored to one corner will reach across whatever is behind it.
  `POPUP_DIM` in `hud.ts` exists because that was discovered from a photograph
  of a phone, not from a test.

## Two identical symptoms need two different numbers

"The shake doesn't work" is either no `devicemotion` events arriving or a shake
that never reaches `STRONG_UP`, and from outside those are the same bug report.
Guessing costs either a hunt for a permission problem that is not there, or a
lowered threshold that was right — and lowering that one buys back knocks and
set-downs firing a re-roll, which the reversal counter exists to prevent.

The numeric readout therefore carries `motion N ev  peak X/18`. When a symptom
has two candidate causes, put the number that separates them on screen rather
than reasoning about which is more likely.

## A comment's assumption expires; the comment does not

`goFullscreen()` was written not to retry, and said why: "there is no further
gesture to hang it on anyway." That was true of an app that was a gate and a
bare canvas. The HUD then arrived and filled the screen with gestures, and the
sentence quietly became false while still reading as a decision. The cost was a
fullscreen that could be refused once at the gate and never asked for again,
with nothing on screen or in any test to say so — the source still contained the
call, unmodified and shipped, so reading the diff found nothing and confirmed
nothing.

When a comment justifies *not* doing something by describing what the app is
like, that description is a dependency. Reread those comments when the thing
they describe changes, and prefer a justification a test can hold — the reason
this one lasted so long is that nothing anywhere asserted the behaviour it was
reasoning about. `scripts/probe-fullscreen.ts` now does, and CI runs it.

**Fullscreen is confirmed working on a real phone as of build 53.** It is not
theoretical any more, so a change that breaks it is a regression with a witness.
Two of the probe's checks are the ones that matter and neither is obvious from
reading `permission-gate.ts`:

- the request is made **synchronously inside the click handler**, before the
  microphone is awaited;
- it is made **before `requestMotionAccess()`**, which on iOS and iPadOS opens a
  dialog that spends the gesture fullscreen needs.

Both were verified to fail the probe before being relied on. Do not reorder
those calls, and do not move the request behind an `await`.

## An enhancement must not be able to abort the thing it enhances

`setPointerCapture` is what keeps a drag alive once the finger wanders off a
48px arc. It is not what makes the drag work — but it was called on the line
above the one that armed the drag, and it throws when the pointer id is not
active. So a refused capture did not cost the off-arc travel; it abandoned the
whole gesture, silently, before anything was armed.

This also made the ring untestable: synthetic `PointerEvent`s cannot be
captured, so every probe drag died on that first line, and the HUD probes only
ever covered layout and chips. Two problems, one cause.

The shape to copy: wrap the enhancement in its own try, and hang the state the
feature actually needs on a flag you own. Then ask what a probe can drive —
if a control can only be exercised by a real finger, it will not be exercised.

## Deleting code deletes what it was doing

Twice now, removing something has removed a second thing nobody was tracking.
Dropping a per-frame recompute of the geometric colour also dropped the only
code that was seeding that uniform at startup, so a stored or URL-supplied
colour was ignored for entire sessions and the type checker was perfectly
happy. Before removing a line that writes state, ask what else was relying on it
having been written.

## Every release gets a two-word name, not just a number

The build number is the git commit count (`vite.config.ts`), so it moves on its
own and can never fall out of sync. What it cannot do is answer the question
people actually ask, which is not "is this newer" but "is this the one with the
camera in it". Consecutive integers are also genuinely hard to tell apart at a
glance across a room — an entire session went into establishing that a phone
was showing 22 rather than 45, and a name would have settled that in a second.

So `src/release-name.ts` holds `RELEASE_NAME`, and the chip top-left shows that
name **and nothing else**, set large — `clamp(1.15rem, 6vw, 1.5rem)`. Big is the
point, not decoration: the job is being readable at arm's length on a phone
propped across a room, which a 12px build marker never was. The build number
lives in the chip's tooltip, and the reload button beside it turns green when a
newer build is live.

- **Two words, lowercase.** Evocative, not descriptive. Descriptive names go
  stale the moment the next release touches the same thing; a name only has to
  be memorable and distinct from its neighbours.
- **Changed in the same commit as the work it names.** Every commit that
  reaches `main` deploys, so every commit that reaches `main` renames. It is one
  line, and a release sharing its predecessor's name is worse than useless —
  it actively lies about which build is on screen.
- Say the name when reporting a deploy, alongside the number.

## House style

Read a few files before writing any.

- **Comments carry the reasoning, not the mechanics.** What was tried, what
  failed, what the measured result was, why the obvious version is wrong. The
  `pow(x, 2.0)` note, the double-log note in `spectralBeta`, the
  mean-centring note in `bandVector` — those are the model. Preserve them.
- **Constants get a sentence explaining the number**, especially thresholds and
  time constants. `const HALF = 8 // 0.8s each side` is the minimum; the good
  ones say what breaks at other values.
- **Refusals are behaviour.** Several things here deliberately decline to answer
  — `spectralBeta` skips rail-clipped bands, `spectralFlatness` returns -1 on
  silence rather than reporting a quiet room as maximum noise. Keep that habit
  and test it.
- **Commit messages explain the why, in prose, at length where it earns it.**
- British spelling in prose and identifiers (`normalise`, `colour`).
- Value imports inside `src/` that a probe script needs must carry the `.ts`
  extension — `node --experimental-strip-types` requires it. Type-only imports
  do not.

## Constraints that are not negotiable

- **The control surface is circular. No straight lines.** Every control in the
  HUD is an arc about the wedge's hinge, and every icon sits on an arc too.
  Not a preference and not open to a redesign that happens to be tidier: a
  rectangular panel of sliders was built, shipped and rejected, because it read
  as a settings screen bolted onto a piece of work rather than as part of it.
  Arcs are also what a thumb can reach on a phone held one-handed, which is why
  the wedge exists at all.

  What this rules out, concretely: linear sliders, list rows, tables, cards,
  bottom sheets, and any panel whose edges are the controls' edges. What it
  permits: bands turned past a notch, arcs dragged for a value, circular chips
  laid along an arc, and text placed on the notch line. If a new control does
  not fit that vocabulary, the vocabulary is the constraint — change the
  control, not the rule.

  The full design language beyond shape — what each layer's texture means,
  why `BAND_R` has the radii it has, colour roles, forbidden examples — is
  `docs/hud-design.md`, not here: this file is a rules list, and that reasoning
  wants room a rules list doesn't have.
- **Audio never leaves the device.** No recording, no upload, no backend.
- **Mobile is the target.** Bundle size and fill rate matter; a desktop-only
  regression is a regression. Nothing needing COOP/COEP headers can ever work,
  because GitHub Pages cannot set them — that rules out `SharedArrayBuffer`.
- **GitHub Pages is the deploy, and the only one** —
  `vvorski.github.io/kiyo-plays`, *not* the org account. It builds from
  `main` only: the `github-pages` environment has a branch rule, so a
  `workflow_dispatch` on any other ref builds happily and is then refused at
  the deploy step. Merge first. Do not delete `checks.yml` to tidy up —
  `pages.yml` runs `pnpm build` but never `pnpm lint`, so `checks.yml` is the
  lint gate.

## Hard stops

Four categories where you propose and wait rather than implement. Everything
else on an approved issue is yours to build.

1. **The stored preference shape.** `Prefs` in `prefs.ts` is a contract with
   every visitor's `localStorage`. *Adding* a field is safe — `loadPrefs`
   validates each one and falls back. Changing the type or meaning of an
   existing field silently resets or corrupts settings for everyone who has
   ever loaded the page, and they have no way to tell you.

2. **The URL parameter shape.** `?geometric= ?atmospheric= ?view= ?rgb= ?mix=
   ?mapping= ?auto= ?debug=`. A shared link is how this thing travels; `?view=`
   is still carried purely as an alias for links from before the two-layer
   split. New parameters are free. Renaming or repurposing one breaks links
   already in the world.

3. **Capture and privacy.** Anything that changes what is captured, adds a
   network request, adds a permission prompt, or persists audio-derived data
   anywhere.

   **The gate carries no *reassurance* copy, as of build 66.** It used to say
   "the audio never leaves this device" and disclose the optional camera
   layer; both paragraphs were removed at Victor's instruction and the
   decision to leave them out was confirmed afterwards. The browser's own
   permission prompt is the consent point. Do not re-add that text as a bug
   fix — it is absent on purpose. The promise itself still binds the code:
   nothing here records, uploads, or persists audio or video, and the camera
   stays off until a live gesture asks for it.

   **What that ban is, and what it is not.** It bans *disclaimers* — a
   paragraph promising what the app will not do, which is litter on a start
   screen and which the browser says better. It does **not** ban the app
   saying what it is **aware of**. Since the sun, the moon and the phone's
   own location arrived (entries 96, 97, 100), what the app senses is part of
   the work rather than a privacy notice, and an app that quietly knows where
   it is and never says so is worse on every axis including this one. A line
   naming a sense — that it is listening, that it knows the hour, that it
   knows the moon — is **awareness**, is in scope, and is a taste question.

   **So this clause routes to Victor; it does not silence.** A ban written as
   "do not" got obeyed literally at build 321: entry 97 asked for a location
   clause on the gate, this paragraph read louder, and the work was dropped
   with only a build note recording it. The refusal was defensible; the
   silence was the fault. **Anything touching gate copy is a proposal, not a
   no** — say what you would add, name this clause, and let him decide.
4. **A new runtime dependency.** This ships to phones over cellular. Three.js
   is 117 KB gzipped and is the budget. Anything else is a conversation, with
   the measured gzip size in it.

A "no" to all four means implement directly and let `pnpm build` be the gate.
Any "yes" means the work stops and becomes a proposal.

## Shipping part of an entry

Sometimes the right build is not the whole entry. An entry can ask for
something that turns out to conflict with a decision already documented in the
code, or for a verification no session can run. **Building it anyway is the
worse failure** — entry 96 asked for a lunar bias on each ring's growth curve,
and four shaders already carry reasoned comments choosing that curve
deliberately. Declining was better work than complying.

Partial ships are therefore allowed, under three conditions, and the third is
the one that has already been got wrong:

1. **Ship only the part you are confident in**, and never force a change that
   would overwrite a documented decision. A comment explaining why something is
   the way it is outranks an entry that did not know about it.

2. **Disclose twice.** At length in the commit — what was left, why, and what
   was actually verified in place of what the entry asked for — *and* in one
   clause on the entry's `status:` line, so it is visible without reading git.

3. **Write the follow-up entry before marking the parent done.** Not after, not
   when someone notices. The remainder is either a new entry that finishes the
   job, or — if the omission is a conflict with a standing rule — an entry that
   puts the conflict to Victor as a question. Either way it exists, numbered,
   in the queue.

Condition 3 is not bookkeeping. Entry 96's omission and entry 97's were disclosed
exactly as conditions 1 and 2 require, and both then sat marked `done` with a
third of the request missing; the gap only surfaced a day later, by accident,
while counting something else. **A disclosure nobody is scheduled to read is
indistinguishable from a silent drop.** An entry in the queue is read by
definition.

## Capturing an idea without stopping

`docs/todo.md` is a capture buffer: ideas written down in a state somebody can
pick up cold, so catching one does not mean dropping what is being built.
`/aaa <idea>` does the interrogating and appends the entry.

It is not the issue queue. `spec-to-issue` and `auto-issue-gogo` remain the
path for work handed to an agent unattended — a full spec, `status:` labels, a
branch per issue. An entry in `docs/todo.md` can graduate to an issue; nothing
there has to.

The rule for both is the same, and it is the only one that matters: **an entry
is ready when someone with no memory of the conversation can build it without
making a judgement call you could have made for them.** In a visual project
almost every interesting fork is a taste question wearing a technical costume,
and those go to the user rather than into your rationale.

## Commands

```bash
pnpm dev            # vite dev server
pnpm build          # tsc --noEmit && vite build   — run before every commit
pnpm lint
pnpm probe          # headless: mappings, ripple triggering
pnpm probe:shake    # headless: tumble springs, shake-vs-knock
pnpm probe:fullscreen  # headless: the start gesture asks, a refusal recovers
```
