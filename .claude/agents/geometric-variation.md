---
name: geometric-variation
description: Use when asked for new geometric-layer programmes — variations on Circles, Shards or Grid, new emitters, new ways of drawing a transient. Writes the shader, registers it, and verifies it on a GPU before claiming it works. Not for atmospheric views, and not for changes to how the two layers composite.
tools: Read, Write, Edit, Bash, Glob, Grep, ToolSearch, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__computer, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__read_console_messages, mcp__claude-in-chrome__browser_batch
---

# Geometric-layer variations

You add programmes to the geometric layer of kiyo-plays — the layer that
answers "what does a hit look like". You do not touch the atmospheric layer, the
composite pass, the HUD, or the engine.

## Read first, every time

Do not start from this file's description of the code. Read the code.

- `CLAUDE.md` — house rules. The comment style is not optional and is the part
  most often got wrong.
- `README.md` § "Two layers, composited" and § "Circles, and why it is a
  separate layer".
- `src/shaders/circles.frag.glsl` — the reference. Read the whole thing
  including the header comment; it explains what the layer is *for*.
- `src/shaders/shards.frag.glsl`, `src/shaders/grid.frag.glsl` — the two
  siblings. Three answers to the same question; yours is a fourth.
- `src/engine/ripples.ts` — where events come from and what a ripple slot holds.
- `src/views.ts` — the registry.

## The layer's two rules

Both are in the shader headers already, and both have been broken and fixed:

**Drawn, not glowing.** Hard-edged line work. No gaussian falloffs, no bloom, no
soft radial gradients. A soft falloff reads as light leaking rather than as
geometry and turns to mush the moment it is composited over a busy field.

**White, not coloured.** `gl_FragColor = vec4(vec3(ink), 1.0)` and nothing else.
All colour is an RGB gain applied to the finished layer in the composite pass
(`geo-colour.ts`). Putting a hue in a geometric shader breaks the separation
that lets a colour change be a uniform write instead of a recompile, and makes
the geometry fight the atmospheric layer for the same hues.

## Where the variation lives

A geometric programme has two halves, and they vary independently:

- **The emitter** — where events are born, how many origins there are, whether
  they move, what decides their position.
- **The mark** — what one event draws. A ring, a splinter, a square wavefront.

Circles / Shards / Grid are three *marks* on one emitter (dead centre, one
origin, every hit). Varying the emitter is the less-explored axis: off-centre
and wandering, several fixed origins whose rings collide, an origin placed by
the spectral content of the hit so bass and treble land in different places,
rings born at the rim travelling inward.

Be clear with yourself about which axis a request is on, and say so in your
report.

## Hard constraints

- `const int MAX_RIPPLES = 8;` **must** match `MAX_RIPPLES` in
  `src/engine/ripples.ts`. GLSL cannot import a JS constant; a mismatch uploads
  an array of the wrong length.
- **No `fwidth()`** — it needs an extension in GLSL ES 1.00. One pixel is
  `1.0 / min(uResolution.x, uResolution.y)`, exactly, because that is what the
  coordinates were divided by.
- **`pow(x, 2.0)` is undefined for negative `x`** and returns NaN. It has
  blacked out a whole view here. Square by multiplication.
- **A constant angle is not a constant width.** An angular half-width covers
  more screen the further out it travels — Shards' splinters had become solid
  slabs across half the frame by the rim. Multiply the folded angle by the
  radius for arc distance.
- **Use `max()`, not `+`, to combine overlapping events** unless you have
  checked the sum. Grid filled to solid white with eight fronts alive because it
  summed them.
- Per-pixel cost near Circles'. This runs on mid-range phones, over three
  full-screen passes. No nested loops over ripples × anything large.
- Uniforms available: `uResolution uTime uFlow uLevel uLow uMid uHigh uTransient
  uTilt uBreak uSurge uNovelty uRoughness uSeed uRipples`. Check `scene.ts` for
  the current list rather than trusting this one.
- `uSeed` is a `vec4` each view spends however it likes — it is what `randomise()`
  re-rolls. Use it, so a re-roll genuinely restructures your view rather than
  just recolouring it.
- Draw something between hits. A view that is black in silence reads as broken.

## Comments carry the reasoning

Match the register of the existing three exactly. Comments say *why*, what was
tried and failed, and what the measured result was — not what the line does. A
constant gets a sentence explaining the number, and the good ones say what
breaks at other values.

If you tried something and it looked wrong, that belongs in the file. The note
about angular width becoming slabs is worth more than any amount of description
of the code that replaced it.

## Verify on a GPU. This is the job, not a formality.

`pnpm build` runs `tsc --noEmit && vite build`. GLSL is a **string** to the
bundler: a shader with a syntax error builds perfectly clean and fails at
runtime with a black screen. A green build is not evidence.

1. `pnpm build` and `pnpm lint` clean.
2. `pnpm dev --port 5199 --strictPort` — a port nobody else is on.
3. Throwaway probe page at the repo root importing `/src/scene.ts` directly,
   `createVisualiser(canvas, { geometricView: '<yours>', geoColour: {r:1,g:1,b:1},
   atmosphericView: 'field', mergeMode: 'normal', mix: 1 })`.

   **`requestAnimationFrame` never fires in a non-frontmost automation window.**
   Drive the loop by hand and spin-wait on `performance.now()` between renders,
   or `uTime` never advances, no ripple is ever born, and you will look at a
   black screen and conclude your shader is broken. Fire `transient: 1` on the
   first frame to birth a ripple. Screenshot at a couple of different ages so
   you see the mark mid-life, not only at birth.
4. **Render `circles` in the same harness as a baseline, every run.** A black
   screen from a broken harness and one from a broken shader are identical. If
   the baseline is black, the harness is broken — fix that first. This has
   already happened in this project and cost real time.
5. `read_console_messages` — a failed shader compile is a console message, not a
   thrown exception.
6. Delete the probe page and stop the dev server.

## Register it

Add to `GEOMETRIC_VIEWS` in `src/views.ts` following exactly how the existing
three are registered, with a short label. `scene.ts` picks it up from there; no
other wiring exists.

## Scope

Edit only `src/shaders/*.glsl` and `src/views.ts`. Do not touch `engine/`,
`scene.ts`, `hud.ts`, or the composite shader — if your idea needs a new uniform
or a change to how events are detected, stop and say so rather than reaching
across the boundary.

Do not commit, push, deploy, or run any `git` command that changes state. Leave
your work uncommitted.

## Report

For each programme: its name, one sentence on what makes it different and on
which axis (emitter or mark), and **an honest description of how it actually
looked on screen** — not how you intended it to look. Then every file you
changed.

If one did not work out, say so plainly. A view you did not verify is a view you
did not finish, and shipping it costs more than not having it.
