# Recon traps

What this codebase hides. Every entry here has cost real time at least once.
Read before writing `## Context`; the traps you find go in it.

---

## Hunt for a signal already computed

The highest-leverage recon step and the most skipped one. Before specifying a
new measurement, grep for the *quantity*, not the feature.

The engine already publishes, per frame: `level`, `low`, `mid`, `high`,
`transient`, `tilt`, `breakdown`, `surge`, `novelty`, `roughness` (`Motion`),
and per slow tick: `bright`, `noisy`, `dense`, `rhythmic`, `noveltyShort`,
`noveltyMedium`, `noveltyLong`, `recurrence`, `dwell`, `bpm`, `warm`
(`Character`). `scene.ts` additionally holds an 8.5-second rolling spectrogram
on the GPU (`HISTORY_W × HISTORY_H`), which any atmospheric shader can sample
for free — Spectrogram exists *because* that buffer was already there.

"We need onset density" is already `dense`. "We need to know if it's ambient" is
already `rhythmic`. A spec proposing a second spectral-slope measurement has not
read `features.ts`.

Corollary: **do not recompute in a new module what the fast tier already
computed.** `slow.ts` takes `(frame, motion)` for exactly this reason — a second
copy of the transient detector would be a second set of constants to keep in
step with the first.

---

## Deleting a write deletes what it was doing

Twice now. The clearest case: a per-frame recompute of the geometric layer's
colour was removed as dead work, which was correct — and it was also the only
code seeding that uniform at startup. A stored or URL-supplied colour was then
ignored for entire sessions, `tsc` was perfectly happy, and the bug was found by
a probe rendering white when it should have been red.

Before a spec says "remove X", say what else X was doing. Uniform initialisation
and state seeding are the usual answers.

---

## GLSL traps

- **`pow(x, 2.0)` is undefined for negative `x`** and returns NaN. It has
  blacked out a whole view here. Square by multiplication.
- **`fwidth()` needs an extension** in GLSL ES 1.00. Antialias against
  `px = 1.0 / min(uResolution.x, uResolution.y)`, which is exactly one pixel
  because that is what the coordinates were divided by.
- **`MAX_RIPPLES` is duplicated** — `const int MAX_RIPPLES = 8;` in every
  geometric shader must match `MAX_RIPPLES` in `engine/ripples.ts`. GLSL cannot
  import a JS constant. A mismatch uploads an array of the wrong length.
- **A constant angle is not a constant width.** An angular half-width covers
  more screen the further out it travels; Shards' splinters had become solid
  slabs across half the frame by the time they reached the rim. Multiply the
  folded angle by the radius to get arc distance.
- **Summing overlapping events saturates.** Grid filled to solid white with
  eight fronts alive because it summed them; `max()` is what lets fronts cross
  without pinning.
- **Log-polar space is conformal** — a cell's width and height both scale with
  radius, so their ratio is constant. That is what makes an undistorted figure
  drawable in Lattice, and why a spiral twist shears one.

---

## Distrust what looks live

- **`AudioFrame.freq` and `.time` are reused buffers.** `frame()` returns the
  same two `Uint8Array` objects every call, mutated in place. A consumer that
  retains one is holding a reference to the future, not a snapshot.
- **`AudioFrame.time` is allocated at 1024 but `getByteTimeDomainData` wants
  `fftSize` (2048)**, so it holds half a waveform. Nothing reads it today. Any
  spec that starts reading it must fix the allocation first.
- **There are two clocks.** `engine/capture.ts` clamps `dt` to 1/5 s;
  `scene.ts` computes its own and clamps to 1/15. They disagree below 15 fps.
  Deliberate, per the comment in `scene.ts`, but a spec that assumes one `dt`
  is wrong.
- **`analyser.smoothingTimeConstant = 0.3`** is a hidden smoother applied to
  `freq` before anything in `mapping`/`features` sees it. Every time constant
  downstream sits on top of it.
- **The render loop is skipped entirely while the tab is hidden.** Analysis
  state freezes rather than integrating a huge `dt`. Anything with a long
  memory needs a policy for coming back.

---

## Normalisation removes what you may be measuring

`bandVector` mean-centres and L2-normalises. Both steps are load-bearing and
both remove something:

- Mean-centring is what makes cosine similarity discriminate at all — without
  it every pair of frames sits around 0.9 and novelty peaked at 0.13 on a
  change nobody could miss by ear.
- L2 normalisation makes it timbre rather than loudness — and it therefore
  **removes scalar multiples**, which means a pure change of spectral *tilt* is
  very nearly invisible to novelty by construction. Measured: two sections with
  slopes of 2.0 and 1.2 gave `|mA − mB|² = 0.017`, indistinguishable from noise.

That is not a defect (tilt is reported separately as `bright`), but a spec that
expects novelty to fire on "it got brighter" is specifying something that cannot
work. Novelty answers "did the energy move to different bands".

---

## The HUD

- **Bands read outward as the compositing order**: geometric, merge,
  atmospheric, then the mix arc. The arrangement encodes something. A spec that
  adds a band says where it goes *and why that position is true*.
- **The invisible grab arcs are 48 px wide** and sit above the painted bands.
  Anything placed inside the SVG within that zone has its taps swallowed; the
  buttons are HTML ordered after the SVG for exactly this reason.
- **The bottom-left corner is one flex column** — mix readout, colour panel,
  buttons. It became one after three absolutely-positioned things at hand-tuned
  offsets started overlapping when a third button appeared. Add to the column;
  do not add a fourth absolutely-positioned element.
- `atan2` returns `(-π, π]`. A mapping that assumes `[0, 2π)` produces a control
  that works on half its arc.

---

## Deploy and hosting

- **GitHub Pages is `vvorski.github.io/suti-view-2026`**, not the organisation
  account. Checking the wrong host reports a stale bundle that is not stale.
- **The build number is `git rev-list --count HEAD`** and CI needs
  `fetch-depth: 0` for it. A shallow clone silently produces build 1.
- **A deploy does not reload anyone who already has the page open.** No service
  worker, nothing polling. The version pill is how a stale tab is spotted, which
  is why it is a Hard Stop-adjacent piece of furniture rather than decoration.

---

## When the ticket is wrong

Correct it in the spec and in the comment. Two live examples of the shape:

- A comment in `engine/fast.ts` claimed `novelty` was the longest memory in the
  app. It never was — `longEnergy` runs at τ = 4 s against novelty's 1.6 s
  window — and with `slow.ts` holding five minutes it is not close.
- A ported effect was described as matching its source and did not: the source's
  stroke widths are fractions of the ring's *current radius* (0.22 and 0.09),
  which is the entire look, and the port drew hairlines at a constant pixel
  weight. "It's a port of X" is a claim to verify against X, not to accept.
