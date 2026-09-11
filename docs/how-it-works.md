# How kiyo · plays works

A microphone-driven WebGL field, built for a phone held in the hand rather than
a browser window on a desk.

**Live:** [kiyo.flyflyfly.tv](https://kiyo.flyflyfly.tv/)

Served over HTTPS, which the microphone requires as a secure-context
permission.

Tap to begin and grant the microphone. **Tap anywhere again** for the HUD — a
120° dial in the bottom-right corner carrying the two layers, the merge mode,
the mix, audio mapping, and a live readout. Choices persist. Audio never
leaves the device: no recording, no upload, no backend.

A deploy does not reload anyone who already has the page open — there is no
service worker or polling, nothing watching for a new build. The small `v123
⟳` in the bottom-left corner is how to tell: it's the git commit count at
build time, so it only ever moves forward, and the button next to it is the
one-tap fix for a stale tab.

## Two layers, composited

The screen is two independently-chosen views, rendered to their own off-screen
targets and blended by a third pass:

|                 |                          |                                  |
| --------------- | ------------------------ | -------------------------------- |
| **Geometric**   | Circles, Shards, Grid    | discrete events — something per hit |
| **Atmospheric** | Field, Lattice, Spectrogram, Aurora | continuous fields — noise, spectrograms, envelopes |

The geometric three are three answers to "what does a hit look like": Circles
gives it a ring, **Shards** give it a direction — angular fragments thrown
outward, spinning down — and **Grid** quantises it into square wavefronts that
light whole cells at a time. All three read the same transient buffer
(`ripples.ts`); they differ only in what they draw with it.

**The geometric layer is drawn, not lit.** Every view on it renders hard-edged
white line work — no gaussian falloffs, no glow, no colour. Soft radial
falloffs read as light leaking rather than as geometry, and turn to mush the
moment they are composited over a busy field. Antialiasing is done against a
pixel size derived from `uResolution` rather than `fwidth()`, since derivatives
need an extension in GLSL ES 1.00 and one pixel here is exactly
`1/min(resolution)` — that being what the coordinates were divided by.

All of its colour comes from three **RGB channel gains** applied to the
finished layer in the composite pass (`geo-colour.ts`), set from a panel behind
the HUD's colour button. Keeping shape and colour separate means a colour
change is a uniform write rather than a shader recompile, every geometric view
gets colour without repeating a palette, and the geometry can be held out of
the atmospheric layer's hue range so the two never fight for the same colour.

Three continuous gains rather than a list of named colours, for two reasons.
The whole space is reachable — including the desaturated and channel-killed
settings a preset list would have to enumerate one at a time — and, more to the
point, the dial band a palette was occupying belongs to the merge mode. The
HUD's bands read outward as the compositing order: geometric layer, how the two
combine, atmospheric layer. Colour is a gain on a finished layer, not a
programme selection, so it is a button.

On the atmospheric side, **Spectrogram** is the one view here that is literally
readable: radius is time into the past, angle is log frequency, so a sustained
tone is a ray, a sweep is a spiral, and a phrase leaves a visible wake. It costs
nothing extra to run — the ring buffer it draws was already there for Field and
Lattice to consume. **Aurora** is the only view with a horizon rather than a
centre, which suits a phone held upright better than anything radial.

Pick each independently from the HUD (or `?geometric=circles`,
`?atmospheric=lattice`; `?view=` still works as an alias for the atmospheric
side, for links from before the split). The **merge mode** band picks how
the geometric layer combines with the atmospheric one underneath it — Normal,
Add, Screen, Multiply, Overlay, Difference — and the **mix** slider is a
universal opacity on top of that, Photoshop-style: 0% is pure atmosphere,
100% is the full blend, and the merge mode only decides what "full" looks
like in between. Keeping mix meaningful for every mode, rather than only for
Normal, means switching modes never requires also touching the slider to get
back to something legible. Default is Screen at 40% — the rings glow through
the field rather than fighting it for the same pixels.

A view is still nothing but a fragment shader plus a label — `scene.ts` never
learns what any of them do, geometric or atmospheric alike. The three-pass
render (geometric → target, atmospheric → target, composite → canvas) is the
real cost of the split: roughly the price of the atmospheric shader alone plus
a cheap composite, since Circles' per-pixel cost is small next to four-octave
fbm. The [adaptive pixel ratio](#performance) is what keeps that tenable on
weaker phones — it was already doing this job before the split, it just has
more to compensate for now.

### Circles, and why it is a separate layer

suti-view-2026 grew out of `~/dev/circles`, a video-chat app whose waiting
room draws slow concentric rings on a fixed timer while people join — ambient
wallpaper that never looked at what anyone was saying. Circles is the same
shape of idea, rewritten to answer to the room: a ring is born on a
transient crossing a threshold, not a `setInterval`, and its size and
brightness carry the loudness of the hit that made it (`ripples.ts`).

That is also why it lives in its own layer rather than folding into Field or
Lattice. A ring is a discrete event with a start time; Field and Lattice are
continuous fields with no notion of "an event just happened" beyond the single
one-at-a-time ripple/pulse they already borrow from `transient`. Reproducing
genuinely overlapping, independently-aging rings inside a continuous field
means actually tracking events, so `scene.ts` does: it watches for a
transient's rising edge, gated by a cooldown (a fast hi-hat pattern would
otherwise spawn a ring on every one) and silenced during a breakdown, and
hands the shader a small buffer of `(birth time, birth loudness)` pairs to
draw independently. `pnpm probe` checks the trigger logic — spawns on a clean
crossing, doesn't double-spawn on two hits close together, stays silent
through a breakdown — since none of that is visible by staring at rings on
screen.

### Lattice, and why it is built the way it is

Grey described the experience behind _Universal Mind Lattice_ (1981) as every
being and thing appearing as a toroidal fountain and drain of self-illuminating
energy — a cellular node, or jewel, in a network linking omnidirectionally
without end. That is unusually literal about its geometry, so the shader
implements the description rather than imitating the paintings:

- **Endlessness** — log-polar space repeats, so shells recede toward the centre
  forever and nothing terminates.
- **Radial symmetry** — a mirrored kaleidoscopic fold, giving bilateral symmetry
  inside each petal rather than a merely rotated tile.
- **Self-illumination** — everything is additive. No surfaces, no shading, no
  lighting model. This is what lets the palette stay that saturated.
- **The network** — glowing nodes on a hex-packed grid, joined by thin
  filaments. The node is the jewel; the filament is the link.
- **The fountain and drain** — the audio. The rim is now, the centre is ~8
  seconds ago, so the tunnel is a literal recording: a beat is a ring
  travelling inward, a section is a stretch of differently-coloured depth.

The palette bug worth recording: the first version set the colours by _mixing_ a
cool and a warm one, which is precisely how to ruin this idiom. Mixing
complementaries in RGB passes through grey, and the whole screen came out a
muddy brown. Complementaries have to be **assigned to opposing elements** — node
against filament — and never blended. Colour is now chosen by rotating a hue
with saturation pinned high, so it stays electric wherever the audio pushes it.

**The shape isn't fixed either.** Symmetry order, node density, tunnel depth,
and a spiral twist are all drawn from the seed — the same one colour and spin
come from — so a reshape (space bar, a vertical swipe, or a real structural
boundary in the music) is a genuinely different lattice, not a recoloured
version of the same one. The twist also breathes continuously via the flow
clock, on top of whatever the current reshape set it to, so the tunnel keeps
moving even through a long stretch where nothing structural happens. The
automatic reshape uses the same rising-edge-plus-cooldown trigger as Circles'
ripples (see below) — `novelty` crossing a threshold, gated by an 8-second
cooldown so the boundary's own decay tail can't retrigger it — reusing the
one signal this project already has for "the track just changed."

**What populates it.** Grey's lattices aren't empty grids — bodies and eyes sit
in them as the things the network is made of. So the lattice morphs: bare grid,
then human figures, then eyes, then bare again, cycling slowly on the flow clock
and jumping somewhere new on a reshape. The lattice itself recedes as the
population comes forward, which is what makes it a morph rather than an overlay.

Three things had to be got right before a figure was recognisable, and each was
found by looking at it rather than by reasoning:

- **The population needs its own grid.** At the lattice's own cell density a
  cell is a few pixels across — right for a jewel, useless for a body. The
  figures sit on a coarser grid laid over the same log-polar space.
- **It must not use the lattice's coordinates.** The spiral twist shears every
  cell, and the kaleidoscopic fold uses `abs()`, which mirrors each sector about
  its centre line — so the first attempt drew every figure cut in half and
  reflected. The population takes the clean pre-twist angle and a _signed_ fold
  instead, giving one whole upright figure per sector, head pointing outward.
- **The cell has to be square.** Log-polar is conformal, so a cell's screen
  width and height both scale with radius and their ratio is constant — which is
  the only reason drawing a figure in this space works at all. Picking the
  figure grid's divisor as `DEPTH * sector` makes the cell exactly square at
  every symmetry order and tunnel density, instead of a hand-tuned constant that
  breaks the next time the seed changes the geometry.

## Running it

```bash
pnpm install
pnpm dev          # then open the Network URL on your phone, same wi-fi
```

The dev server binds to `0.0.0.0` because testing this in desktop device
emulation is close to useless: the gesture unlock, the wake lock, and above all
the GPU fill-rate budget all behave differently on real hardware.

One caveat — `getUserMedia` requires a secure context. `localhost` counts;
`http://192.168.x.x` does not, so Chrome on Android will refuse the microphone
over plain LAN HTTP. Either use the deployed URL, or enable HTTPS on the dev
server, or add the origin under `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
iOS Safari is stricter still and wants real HTTPS.

```bash
pnpm build        # typecheck + production build
pnpm preview
pnpm lint
pnpm probe        # mapping behaviour, no browser required
./deploy/deploy.sh
```

## The HUD

Tap anywhere and a 120° wedge opens, hinged just outside the bottom-right
corner. Three arc bands stack outward in render order — geometric,
atmospheric, merge — and the innermost arc is the mix. Swipe along a band to
turn it; whatever settles under the notch is what's selected. Tap outside to
dismiss.

This replaced a bottom-sheet list of cards. The list worked, but it took the
whole screen to change one value, so you could never see the thing you were
adjusting actually respond — which for a control surface whose entire job is
blending two live layers is the wrong trade. A thumb also doesn't move in
straight lines; it swings in an arc from the base joint. Laying the controls
along that arc is what makes the whole surface reachable one-handed, and
anchoring it to the corner is what keeps it a thumb's length away on any
phone. Geometry is recomputed from the live viewport on every resize rather
than baked in, because "the corner" is somewhere different on every device and
after every rotation.

Two details that look arbitrary and are not:

- The **mapping and numbers toggles are HTML, not SVG**, and sit after the
  dial in the DOM so they render above it. Inside the SVG they landed within a
  band's grab zone — the invisible grab arcs are 48px wide, far wider than the
  painted band — and the band swallowed the tap.
- **Band labels fade out toward the ends of the sweep** rather than stopping.
  A hard edge reads as "that's the whole list"; a fade reads as a strip
  continuing past the window, which is what it is.

## The phone as an input

Shaking the device does two different things depending on how hard, because a
single threshold would make a physical object behave like a switch.

**Any disturbance tumbles the picture.** Rotation and drift, kicked by the
actual measured motion and sprung back to rest. There is no threshold to cross:
walking with the phone shows faintly, picking it up off a table shows clearly,
and it settles on its own afterwards. Both axes are under-damped harmonic
oscillators rather than decays — a decay slides back to centre and stops, which
reads as an animation playing, while a spring overshoots and settles, which
reads as something with weight being disturbed.

The rotation spring's damping ratio is 0.4 rather than the prettier 0.25 for a
specific reason: its natural frequency is about 2 Hz, and so is walking. At
0.25 the resonant gain is 2×, so carrying the phone in a hand would slowly wind
the image up to its cap.

**A hard, deliberate shake re-rolls the seed** — the same thing the space bar
and a vertical swipe already do. This one has to be earned, and the interesting
part is telling a shake from a knock. Peak acceleration cannot: putting a phone
down hard clears any bar a real shake clears. So it counts oscillations
instead. The magnitude has to cross 18 m/s², fall back below 7, and do that
three times inside 1.2 seconds. An impact gives one crossing, its rebound gives
a second; three means the phone is being shaken.

The tumble is applied in the composite pass, not per view, so every programme
inherits it — including ones written later — and both layers move as one
picture rather than the geometry shearing off its own atmosphere. The transform
scales up by a small overscan before drifting, because the render targets clamp
at their edges and a rotation without it smears the outermost row of pixels
across the corner it exposed.

Everything but the event listener is a pure function of samples and `dt`, which
is what makes `pnpm probe:shake` possible — a phone is the only thing that
produces real accelerometer data and the one device you cannot comfortably
debug while waving it around. The probe's most important row is the last one: a
knock and its rebound must tumble the image and must *not* re-roll the seed.

iOS 13+ gates the accelerometer behind a permission call that must happen
inside a live user gesture, the same rule the microphone has. Both are
therefore started from the tap-to-start button, and the motion request is
issued *before* awaiting the microphone — awaiting first spends the gesture.
Refusal is not a failure: `startShake` returns a sensor that reports "still"
forever, so callers need no branch and the visualiser is fully usable without
it.

## The minutes tier

Everything above reacts inside a second, and until recently nothing in the app
had a memory longer than six of them. `slow.ts` is the part that does. It runs
at 2 Hz off the same frames, and five minutes of history is 600 × 12 floats —
28.8 KB, which is why the obvious objection (a self-similarity matrix is
enormous) never arises: the matrix is never built.

It reports two things. **Structure** — novelty at 4 s, 15 s and 60 s scales,
whether the present resembles somewhere we have already been, and how long the
current section has run. **Flavour** — four named axes (`bright`, `noisy`,
`dense`, `rhythmic`) plus a coarse BPM, each smoothed over tens of seconds.

**None of it is a uniform**, and that is the design. A minutes-scale number
read by a shader every frame becomes *motion* — a drift nothing on screen
explains, which is the worst kind of motion there is. So the slow tier reports,
`director.ts` decides, and decisions are applied through the same setters the
HUD calls. It is an autopilot on the existing controls, not a second bus into
the shaders — which means it can be switched off (the `auto` button), it shows
up correctly in the HUD, and it cannot fight the user.

Three rules keep it restrained. It **never fights the user**: any manual change
suspends it for three minutes. It **never arrives unannounced**: a change only
lands on a section boundary, so a new palette coincides with the music changing
instead of turning up mid-phrase — this is the single thing that separates
"it's listening" from "it's drifting". And it **never flickers**: every
categorical decision has a dead band and has to hold its answer for 30 seconds.

Two things worth knowing about the novelty measure. It uses the mean vector of
each half-window rather than all pairs, which is not an approximation dressed
up — expanding Foote's within-minus-across contrast for mean vectors gives
exactly `|mA − mB|² / 2`, the squared distance between the halves' centroids,
linear in the window instead of quadratic. And it is **deliberately blind to a
pure change of spectral tilt**, because the vectors are L2-normalised and a
tilt change is nearly a scalar multiple. Tilt is already reported as `bright`;
novelty answers "did the energy move to different bands".

`pnpm probe:slow` runs a synthetic five-section arrangement — intro, build,
drop, breakdown, outro, with the outro made of the same material as the intro —
and prints the whole Character track plus every decision. This is not optional
the way a visual check is optional: a five-minute buffer takes five minutes to
say anything, and you cannot hold ninety seconds of behaviour in your head well
enough to judge it. It caught four real bugs on its first run, including an
ambient passage reporting 80% rhythmic with a confident BPM, and one apparent
bug that was not one — see the note in the probe about what L2 normalisation
removes.

## Tuning the mapping

Two tools, because judging this by eye alone does not work — a dark screen looks
identical whether the mapping produces nothing or the shader is simply too dim.

The **HUD** (tap anywhere) carries a live readout: frame time, the
pixel-ratio rung in use, and every parameter as a bar. That is the one that
works in a real room, on a phone, with real sound. `?debug` opens with it
already on.

Space bar or a **vertical swipe** re-rolls a `uSeed` uniform that each view
spends on whatever it doesn't already get from the music — Field gets a new
patch of noise, a spin, and a hue rotation; Lattice gets a new hue, a new
rotational symmetry order (4 to 9), a new node density, a new tunnel depth,
and a new spiral twist. A horizontal **swipe** instead steps the atmospheric
layer forward or back (left for the next one, right for the previous).

This used to be double-tap/double-click, and it did not actually work. The
HUD's tap-to-open listener has zero delay by design — it exists
specifically to open on a tap with no wait — so the first tap of an intended
double tap already opened the panel before a second tap could ever be
compared against it, and the second tap then landed on the now-visible scrim,
which the gesture listener deliberately ignores (so operating the panel
itself never also triggers a gesture underneath it). The double tap could
never complete; it just looked like the panel opening on an ordinary single
tap, because that is exactly what was happening. There is no way to tell "one
tap" from "the first half of two taps" without either holding every single
tap for the double-tap window before acting on it — which defeats the reason
the panel uses a zero-delay tap at all — or picking a gesture a tap cannot be
mistaken for. A swipe already has to clear a distance threshold to register,
so it sidesteps the ambiguity instead of resolving it, and the panel's own
tap-to-open listener checks the pointerdown-to-pointerup distance so a swipe
never also pops it open underneath.

`pnpm probe` runs the mappings over synthetic frames in Node — no browser, no
microphone — and prints their response curves. It exists because you cannot
conveniently produce a controlled −40 dB tone, a 120 bpm kick pattern and a
three-second breakdown on demand in a kitchen, and because a regression here is
invisible until you already dislike how something looks.

It has found every real bug in the mapping so far, none of which were visible on
screen:

- `level` pinned at 0.98 against a mid band of 0.06 — an AGC erasing the
  dynamics the whole design rests on
- `auto-normalised` capped at 0.33 on single-band material
- a fixed gain leaving 4% headroom at music levels, which is what made the
  visuals feel dead on a real phone

Two of its checks are close to pass/fail:

- a 120 bpm pattern must move `level` and `transient` while leaving `break` at
  zero
- `level` must read the same at 6 fps as at 60 fps

The second exists because of a real trap. `dt` is clamped so that returning from
a backgrounded tab does not slam every envelope to its target at once — but the
bound was 1/15 s, tight enough to bite during ordinary slow running. Once it
does, the envelopes advance more slowly than wall-clock, the running mean never
catches up to the instantaneous energy, and _everything measured against it pins
to 1.0_. It showed up as `level`, `low`, `mid` and `high` all sitting at exactly
1.00 in a throttled tab; a phone dropping to 10 fps would have hit the same
wall. The bound is now 1/5 s.

## How it fits together

```
main.ts            the page: DOM, chrome, gate, prefs/URL → a Session and a Shell
 ├─ permission-gate.ts   tap-to-start overlay, WebGL check, wake lock, fullscreen
 ├─ session/             the app, with no opinion about its UI
 │   ├─ session.ts         the loops, every input → visualiser, the look, the camera
 │   ├─ shell.ts           the UI port; NULL_SHELL is what "no UI" means
 │   ├─ gestures.ts        tap / double / hold / drag, as pure state
 │   ├─ look.ts            the shuffle ladder
 │   └─ idle.ts            the picture behind the gate
 ├─ hud.ts               one Shell: the circular control surface
 ├─ engine/              everything that listens; knows no screen exists
 │   ├─ capture.ts         getUserMedia -> AnalyserNode -> AudioFrame
 │   ├─ fast.ts            AudioFrame -> Motion      10ms-4s  <- swappable
 │   ├─ slow.ts            AudioFrame -> Character   30s-5min
 │   ├─ features.ts        descriptors both tiers share
 │   └─ ripples.ts         transient -> event buffer
 ├─ director.ts          Character -> decisions (policy, not measurement)
 ├─ shake.ts             devicemotion -> TumbleState + a hard-shake edge
 └─ scene.ts             Three.js fullscreen quad + shaders/
```

The split between capture and interpretation is the load-bearing one. Capture
is fixed; the interpretation of what was captured is expected to be rewritten
repeatedly, so it lives behind a one-method interface and nothing else knows how
it works.

`engine/` became a directory when the slow tier arrived, not before. One
implementation behind an interface is a guess about the future; two is a fact
about the present. `director.ts` sits deliberately *outside* it, because
measurement and policy fail differently — a wrong measurement is a bug with a
right answer, a wrong opinion is a taste argument — and the measurement is
worth having with the opinions switched off.

`session/` became a directory when `main()` was found to be the app. The
split that matters there is between the session and the shell: the session
is what the picture does in response to a finger, a shake, the room, the
hour and the music; the shell is whatever is drawn around it. A different
control surface is a different `main.ts` and a different `Shell`, and
`scripts/probe-session.ts` holds that claim by running the whole thing
with no shell at all.

## Mappings

Three ship. Switch with `?mapping=` in the URL, so they can be compared on a
phone without a rebuild:

- **`relative`** (default) — `level` is how loud this moment is against the last
  few seconds, not against an absolute scale. Self-calibrates between a quiet
  room and a sound system, keeping headroom at both.
- **`speech-band`** — fixed gain with soft saturation. Quiet genuinely reads as
  quiet and a long decay traces a curve instead of being normalised away. Right
  for ambient recording and voice; saturates on music at room volume.
- **`auto-normalised`** — every band stretched to fill its own range. Most
  robust against unknown material, at the cost of being unable to tell loud
  from quiet.

**Absolute loudness turned out to be the wrong drive signal**, and this is the
single most important thing the project learned. A gain tuned in a quiet room
leaves 4% headroom once real music plays — everything pins near maximum and the
visuals go inert exactly when there is most to react to:

```
byte              relative           speech-band
  10          0.44 (+0.56)          0.18 (+0.82)
 100          0.44 (+0.56)          0.83 (+0.17)
 200          0.44 (+0.56)          0.96 (+0.04)
```

The number in brackets is the headroom, which is the room the visuals have left
to move in. `relative` holds it constant at every input level.

## What reacts to what

Different signals move on deliberately different timescales. Colour that chased
every transient would strobe; motion that ignored them would feel dead.

| Signal      | Timescale | Drives                                                                                 |
| ----------- | --------- | -------------------------------------------------------------------------------------- |
| `transient` | ~0.16 s   | ripples struck outward from the centre                                                 |
| `level`     | ~0.28 s   | flow speed, contrast, warp, brightness                                                 |
| `tilt`      | ~2.5 s    | **colour** — bass-heavy runs blue→violet→magenta, treble-heavy runs midnight→teal→gold |
| `breakdown` | ~0.5 s    | motion stalls, frame contracts, colour drains to grey                                  |
| `surge`     | re-entry  | bloom and expansion coming out of a break                                              |

**Break detection** is the part with a real constraint: it has to fire on a
breakdown but not on the gap between two beats, and those differ only in
duration. A 0.3 s attack on the detector separates them. Against a synthetic
120 bpm pattern (60 ms hits, 440 ms gaps) `break` peaks at **0.000**, while
`level` still swings 0.26–0.93 — the beats are fully visible, and none of them
is mistaken for a drop.

It is also gated on the recent norm being audible at all, without which a silent
room reads as one continuous breakdown.

## Longer-timescale analysis

`mapping.ts` reacts within a second. That covers beats and breaks and nothing
else — it cannot tell a verse from a build, because it never looks further back
than its own envelopes. `features.ts` is the memory.

### Structural novelty — Foote, made causal

[Foote's self-similarity novelty](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S4_NoveltySegmentation.html)
is the standard method: build a self-similarity matrix over timbre features and
convolve a Gaussian-tapered checkerboard kernel down its diagonal. Homogeneous
sections form blocks; a boundary between two of them looks like a checkerboard,
so peaks in the convolution are section boundaries.

That kernel is centred, which means it needs half a window of **future** audio —
about a second of lag before the visuals could react to a change that has
already happened. So the kernel here is evaluated with the boundary at _now_:
the most recent half-window against the one before it. Same +1/−1 quadrant
structure, just causal. It gives up refining a boundary after the fact, which is
meaningless live, and buys back the entire lag.

**Mean-variance normalisation is not optional**, and skipping it is a silent
failure. Log magnitudes are all positive and sit in a narrow range, so the cosine
similarity between _any_ two frames is ~0.9 and cannot discriminate. Measured
novelty peaked at 0.13 on a bass-led → treble-led section change — something you
could not miss by ear. Centring the vectors turns the dot product into a
correlation spanning −1..1:

|                                   | before | after    |
| --------------------------------- | ------ | -------- |
| section change, constant loudness | 0.13   | **0.84** |
| steady 120 bpm beat               | 0.00   | **0.00** |

The second row matters as much as the first: beats must not read as structure.

### Fractal character — the 1/f exponent

Voss and Clarke showed musical audio power follows roughly 1/f — pink noise. The
exponent β is a real timbral descriptor: steep means energy concentrated low,
dark and smooth; shallow means energy spread up the spectrum, bright and noisy.

Since the shader is _already_ built on fractal noise, β drives the fbm octave
gain directly — the audio's spectral self-similarity sets the visual's. Dark
smooth music renders as smooth structure, bright noisy music as fine detail.

The trap here cost a rewrite. `getByteFrequencyData` returns values already
linear in **decibels**, not magnitude, so the obvious `log(byte/255)` is a
second logarithm on top of the first. Regressing dB against log-frequency
instead, with β = −slope/10, recovery of a known exponent improved from 0.06 to
0.5 units of output per unit of β:

```
beta   roughness      (0 = white, 1 = pink, 2 = brown)
0.0      1.000
1.0      0.584        <- where music mostly lives, mid-range
2.0      0.078
```

## Feeding audio to the GPU

Yes — and the useful part is not what you would expect.

**Not the FFT.** The browser's `AnalyserNode` already does that in native code;
reimplementing it as a fragment-shader butterfly would be slower, far more
complex, and WebGL2 has no compute shaders to do it properly. (WebGPU does, and
would be the route if this ever needed genuine DSP on the GPU.)

**The history.** What the GPU can do that the CPU cannot is hold the last few
seconds of spectrum and let _every pixel read a different moment of it_, every
frame, in a single texture fetch. `scene.ts` maintains a 256×64 rolling
spectrogram — time on x, log frequency on y, 16 KB, one column written every
33 ms for ~8.5 seconds of history. The shader renders it as a **polar
spectrogram**: radius is time into the past, angle is frequency. A beat becomes
a shell expanding outward; a section becomes a visible band of texture.

Reconstructing that per-pixel on the CPU is not merely slow, it is not possible
at frame rate. That asymmetry is the whole argument for putting audio on the
GPU.

## Design notes

The visual brief came from a reference recording — a quiet phone capture, no
beat, no sub-bass, swelling over about two seconds and then decaying for twenty.
The aesthetic is still built around **swell and decay rather than pulse**, even
though the default mapping now handles music too:

- Motion runs on `uFlow`, a phase the CPU integrates from the audio level, not
  on wall-clock time. Silence coasts the field almost to a stop; sound makes it
  churn; a break nearly freezes it. Only the slowest drift is time-driven, so a
  silent room still breathes.
- Onsets push a soft ripple out from the centre instead of flashing the frame.
  A full-frame flash reads as a beat marker; this reads as the field being
  struck.
- Neither palette ramp reaches white. It is a nocturnal thing.
- Contrast opens with energy: near-silence is nearly featureless, and structure
  resolves as sound arrives.
- A break drains the colour towards grey. Losing the hue is what makes its
  return on re-entry worth watching.

## Performance

The atmospheric shader is fill-rate bound — three fbm lookups per pixel, four
octaves each — so resolution is the dominant lever by a wide margin, and the
two-layer composite (geometric pass, atmospheric pass, blend pass) makes
resolution matter even more: the extra passes are cheap on their own, but they
still scale with however many pixels the ladder below has chosen.

It is **adaptive**. A fixed cap of 2.0 measured 52 fps on a real phone, close
enough to the edge that any added shader work would have pushed it under. Rather
than guess a lower constant and cost sharpness on hardware that never needed it,
the renderer measures its own frame time and walks a ladder
(1.0 / 1.25 / 1.5 / 1.75 / 2.0), stepping down above 18.5 ms and back up below
13.8 ms, with a 1.5 s settle between changes so it cannot oscillate. `?debug`
shows the rung currently in use.

After resolution, the octave count in `fbm()`.

WebGL context loss is handled rather than treated as an error: mobile browsers
reclaim contexts routinely when a tab is backgrounded.

## Deploying

**GitHub Pages** (`.github/workflows/pages.yml`), on push to `main`. Needs no
configuration at all beyond the repo being public — no token, no account, no
dashboard.

The custom domain `kiyo.flyflyfly.tv` comes from `public/CNAME`, which Vite
copies verbatim into `dist/` — the file has to be in the published artifact or
a later deploy can clear the domain from the repo's Pages settings. DNS for
that name lives at Cloudflare, as a `CNAME` to `vvorski.github.io`, DNS-only
(not proxied) so GitHub can see the certificate challenge — Cloudflare is a
nameserver here, never a host.

`actions/configure-pages` resolves `BASE_PATH` to `/` once a custom domain is
set; `vite.config.ts` already defaults there, which is also what `pnpm dev`
and `vite preview` need.
