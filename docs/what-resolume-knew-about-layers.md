# What Resolume knew about layers

Research note, 2026-08-30. Prompted by: *"deep dive on Resolume 4.2 and what
layer features it had — think what we can learn."*

A caveat first, because it changes how to read the rest: this describes
Resolume Avenue/Arena **4.x**'s layer model, which I know well. I am *not*
confident about which features arrived in 4.0 versus 4.1 versus 4.2
specifically, and I have not tried to pretend otherwise — where a date would
matter to a decision here, it is flagged. Nothing below depends on the point
release.

The conclusion up front: **kiyo already has Resolume's structure and does not
know it.** The three-level effect model, the per-layer blend, the autopilot —
all present, all unnamed. The one thing Resolume had that kiyo genuinely lacks
is a *clock*: everything in Resolume happens on the beat, and everything in
kiyo happens on a wall clock. Entry 75 just shipped the tempo that closes that
gap.

## 1. The model

Resolume composites **layers** bottom-to-top. Each layer carries:

- **Opacity**, and a **blend mode** governing how it sits on what is beneath.
- **Transform** — position, scale, rotation, anchor — per layer, independent.
- **Bypass** and **Solo**, momentary, changing nothing you have set.
- **Autopilot** — the layer advances its own clips on its own schedule, next /
  previous / random / specific.
- An **effects chain**, dragged on, each effect with its own opacity and blend.
- **Crossfader group assignment** (Arena), so layers move between A and B.

Above the layers sits the **composition**, which has its own effects and its
own master. Below them sit **clips**, which have their own transport — speed,
direction, loop / bounce / once, cue points — and their own effects.

Two structural properties matter more than any individual feature:

**Effects apply at three levels — clip, layer, composition.** The same effect
means something different at each, and where you put it is a real decision.

**Everything can be driven by something else.** Any parameter can be linked to
audio, or to an LFO, or to a division of the global BPM (1/16 through several
bars). Tap tempo sets the BPM; clips and parameter animations quantise to it.
Resolume is less a video player than a modulation matrix that happens to output
pixels.

## 2. What kiyo already has

More than it looks, and this is the useful half of the exercise.

| Resolume | kiyo |
|---|---|
| layers, bottom-to-top | camera → atmospheric → geometric |
| per-layer opacity | `geoAlpha`, `atmAlpha`, `passthrough` |
| per-layer blend mode | `mergeMode`, `atmMergeMode` — six of them |
| clip | a procedural *view*, thirteen of them |
| clip transport | the view's own shader, driven by audio |
| autopilot | `director.ts`, always on since entry 45 |
| composition effects | the composite tail — day ink, vibrance, RGB slip |
| layer effects | `uGeoColour` / `uAtmColour`, applied per layer |
| audio-linked parameters | six mapping strategies in `fast.ts` |
| tap tempo / BPM | entry 75's tracker, shipped at build 247 |

**The three-level effect model is already there and has never been named.** A
view shader is clip-level; `geoColour`/`alpha`/`mergeMode` are layer-level; the
day ground, the vibrance and the channel slip are composition-level. Entries
68, 70 and 76 each had to argue from scratch about where in the tail they sat.
Naming the three levels would have answered that question once instead of three
times, and would answer it for the next one.

**The two is a decision, and it is the one thing here not to borrow.** Resolume
stacks as many layers as you can afford; kiyo composites exactly two plus a
camera, because a hit over a field is the whole composition and a phone in the
hand pays for every fullscreen pass. Nothing below assumes otherwise. A third
layer would mean rewriting `composite.frag.glsl`, whose blend seams are
hard-coded in order, along with the render targets and every layer union in the
HUD, the prefs and the URL parameters.

## 3. The five lessons, ranked

### 1. Changes should land on the beat, not on a timer

Resolume's entire trigger model is quantised. You do not fire a clip *now*, you
fire it *on the next beat*, and parameter animations run in bar divisions.

`director.ts` runs on wall-clock seconds: `SUSPEND` 30, `COLOUR_HOLD` 30,
`VIEW_HOLD` 30, `BOUNDARY_RAMP` 30. A change that happens 0.4 s after a
downbeat reads as an accident; the same change on the downbeat reads as
intent. This is the single largest difference in *feel* between kiyo and a VJ
tool, and it is the cheapest one to close, because entry 75 shipped `bpm`,
`beatPhase` and `beatConfidence` and nothing consumes them but one ring in
Circles.

The change is small: the director holds its decision until the next bar, when
confidence is high enough, and fires immediately when it is not. Its own thirty
seconds stay exactly as they are — they become *earliest* rather than *exact*.

### 2. Per-layer transform is parallax, and it is nearly free

Resolume transforms each layer independently. kiyo's tumble transforms the
**composite** — `composite.frag.glsl` computes one `uv` and samples both layers
with it, so the two layers move as one rigid sheet, which is exactly what makes
the tumble read as *the picture* moving rather than as things moving *within*
it.

Give each layer its own multiplier on the same tumble and the layers separate
with depth. It is one extra `uv` computation in a shader that already computes
one, no new state, no new uniform beyond a scale, and it makes a flat
composition read as two planes. Of everything here this has the best
ratio of effect to cost.

### 3. Solo and bypass, momentary and unstored

To see what the geometric layer contributes today you drag `atmAlpha` to zero
and then try to put it back where it was. Resolume gives you solo and bypass as
momentary states that change nothing you have set.

kiyo already has the mechanism — the render-time override seam that entries 48,
58, 60 and 72 all use, where a value is influenced on its way to the renderer
and never written to prefs. Solo is that seam applied to alpha, and it is
mostly a chip.

### 4. Autopilot belongs to the layer, not the composition

Resolume's autopilot is *per layer*: each advances on its own schedule, so the
composition is never wholly new at once. kiyo's director rolls the whole picture
on shared thirty-second holds, so everything changes together and then nothing
changes at all.

Independent cadences per layer — the atmosphere drifting on a long clock, the
geometry on a shorter one — would read as two things living rather than one
thing switching. The director's existing dead bands and holds all still apply;
they simply stop being global.

### 5. Blend modes are named and grouped, not just counted

Resolume ships dozens; kiyo has six, and six is the right number for a
thumb-sized arc. The lesson is not *more* — it is that Resolume groups them by
what they do to light, so choosing one is a question about intent rather than a
walk through a list. With six the grouping is unnecessary. Worth knowing that
the ceiling is a naming problem, not a capacity one, if the list ever grows.

## 4. What not to take

- **A big blend-mode list.** Six chosen modes on a circular control beat thirty
  on a phone, and the non-negotiable is the control surface.
- **Decks and clip grids.** kiyo has no clips to arrange — its views are
  procedural and infinite. A grid would be a filing cabinet for things that do
  not need filing.
- **Effect chains.** A drag-on chain implies a render target per effect.
  kiyo's composite is one pass reading two textures, on a phone GPU, and the
  tail's fixed order is a feature: entries 68, 70 and 76 each reasoned about
  where they sat *because* the order is knowable.
- **A full modulation matrix.** Any-source-to-any-parameter is a desktop
  interaction. The useful fraction is having more *sources* — beat phase, the
  motion tiers, the slow features — reach the parameters that already exist.

## 5. If this becomes work

In the order the ranking suggests, and each is its own entry:

1. **The director quantises to the bar** when the tempo is confident. Consumes
   what entry 75 already ships; changes no constant it already has.
2. **Per-layer tumble scale**, for parallax.
3. **Solo**, on the existing override seam.
4. **Per-layer autopilot cadence**, splitting the director's holds.

And one that is not a feature: **name the three effect levels** — clip, layer,
composition — in `scene.ts` or the composite's own header, so the next effect
knows where it goes without an argument.
