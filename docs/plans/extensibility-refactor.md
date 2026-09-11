# Opening the project up: the extensibility refactor

*Specification. Written 2026-09-10 from an audit of the code at build 487.
The implementation plan for the first phase is
[session-extraction.md](session-extraction.md); later phases get their own
plan once the first has landed, because their shape depends on it.*

## What this is for

The project is going to be opened to other people to experiment with. The
question that matters to them is not "is the code tidy" but "what can I
change without understanding everything". The audit found that the answer is
good for the two things people will most likely want — a new view, a new
mapping — and poor for the one thing the project's owner also wants to be
possible: **a different UI on the same base.**

This document says what the code should look like when that is possible,
what it looks like now, and the order the gap gets closed in.

## The four modules, as found

The stated intent is four modules: layers and composition, music analysis,
orchestration, and the menu. Against the code as it stands:

| Intended module | What exists | State |
|---|---|---|
| Music analysis | `src/engine/`, barrel `index.ts`, no DOM, no clock, 30 headless probes | A real module. Name no longer describes it. |
| Layers and composition | `views.ts` registry + `shaders/` + `scene.ts` (1900 lines) | Registry is a clean extension point. Composition is hardcoded. |
| Orchestration | `director.ts` (autopilot policy) + the closure body of `main()` (1500 lines, 68 state variables, 15 listeners) | Does not exist as a module. |
| Menu | `hud.ts` (1600 lines) behind a `Handlers` contract | Replaceable at the seam; owns persistence it should not; leaks into `main.ts` by DOM selector. |

### What is good and must be preserved

- **`engine/` is DOM-free, clock-free and probe-driven.** Time arrives as
  `dt`. This is what makes any behaviour longer than a few seconds tunable at
  all, and it is the discipline every new module in this refactor copies.
- **A view is one shader plus one registry line.** `View` is `{ label,
  description, fragmentShader }`. `views-probe.html` renders every view from
  identical synthetic audio. The `geometric-variation` agent exists for this.
- **`director.ts` is outside `engine/` on purpose** — policy fails differently
  from measurement, and the reason is written down in `engine/index.ts`.
- **The HUD's `Handlers` contract** is already most of a UI port. The session
  port below is derived from it, not invented.
- **`Visualiser` is the layer API.** A different UI would talk to it, so its
  shape is preserved and only the Chorus-specific methods move (phase 2).

### What is wrong, concretely

1. **`main()` is the app.** The frame loop, the touch-to-emitter wiring,
   shake to tumble to scene, prefs and URL resolution, camera mode, the
   camera stream's lifecycle, the shuffle ladder, the idle preview, capture,
   and the director's cadence all live in one async closure. None of it can
   be reused without the whole file, and the file also owns the gate, the
   chrome, and the HUD's construction. A different UI cannot be built on
   this without reconstructing ~1500 lines.

2. **The HUD owns persistence.** `savePrefs` is called only from `hud.ts`,
   and the HUD mutates the shared `Prefs` object at fifteen sites. A second
   UI would have to re-implement that discipline correctly or silently break
   storage for everyone.

3. **`main.ts` reaches into the HUD's DOM.** `.hud-scrim.open` is queried
   three times and `.hud-chip` once to answer "is the panel open" and "is
   this target a control". A different UI has different selectors, and the
   session would not know.

4. **`scene.ts` has non-rendering tenants.** It requests location and ambient
   light, computes sky and moon at construction, and owns the colour ramp
   and view-dip timers. CLAUDE.md names this exact drift.

5. **Per-view logic is leaking into the generic layer.** `hitTestChorusNode`
   and `setChorusNodeDrag` are Chorus-specific methods on `Visualiser`, and
   `scene.ts:1747` tests the view name. The fourth view with its own handles
   turns this into a switch.

6. **The uniform contract is implicit.** About fifty uniforms are declared in
   `scene.ts`; each shader picks the ones it wants. Nothing declares what a
   view consumes, so nothing can check it, and a newcomer cannot tell which
   are available without reading `scene.ts`.

7. **`engine/` is not about audio any more.** Touches, hover, posture, origin
   spring, motion bias, RGB slip, camera arming and the synthetic shake all
   live there; `celestial.ts` imports `sky.ts` and `moon.ts` from the top
   level. It is an "inputs become numbers" module wearing an audio name.

8. **Composition is fixed at two layers plus a camera** and nothing says so.
   The composite shader, the render targets and every `'geo' | 'atm' |
   'cam'` union assume it. That may be right; it should be a stated
   constraint rather than something discovered by trying.

## Target shape

```
src/
  main.ts              the page: DOM lookup, chrome, gate, prefs/URL → Session + HUD shell
  session/             orchestration — "the app", with no opinion about its UI
    index.ts           barrel + file comment, engine/index.ts's shape
    shell.ts           the UI port: what a session needs from whatever is drawn around it
    session.ts         createSession(): owns the look, the loops, every input → visualiser
    gestures.ts        the pointer recogniser as pure state + dispatch, probe-driven
    look.ts            the shuffle ladder and LookPatch — pure
    idle.ts            the synthetic look before Start — pure
  hud.ts               one Shell implementation: the circular control surface
  engine/              unchanged in phase 1; renamed/split in phase 3
  scene.ts, views.ts   unchanged in phase 1; view contract in phase 2
  director.ts          unchanged
```

**A different UI is then a different `main.ts` and a different `Shell`.** It
builds a visualiser on its own canvas, resolves prefs however it likes,
constructs a session, and hands the session a `Shell`. Everything the picture
does in response to a finger, a shake, the room, the hour or the music is the
session's, unchanged.

### The `Shell` port

Derived from every call `main()` makes on the HUD today plus every DOM query
it makes to learn something about the HUD. Nothing else.

```ts
interface Shell {
  /** The session changed the look on its own (director, shuffle, camera raise).
   *  Redraw if visible. Not called for changes the shell itself asked for. */
  lookChanged(): void
  /** The shell is covering the picture: gestures on the picture stand down. */
  isOpen(): boolean
  /** Open the shell's controls — the double tap and the right click. */
  open(): void
  /** Whether a pointer event's target is one of the shell's own controls,
   *  so the contact never reaches the picture. */
  ownsTarget(target: EventTarget | null): boolean
  /** Per-frame readout. Must be cheap when nothing is showing. */
  update(params: VisualParams, stats: SessionStats): void
  /** A shake was accepted. The HUD shell pulses the edge and, with the
   *  readout on, flashes — that gating is the shell's business. */
  shakeFeedback(kind: 'strong' | 'double', peak: number): void
  /** Camera mode's glyph. `fading` is the automatic-expiry path. */
  cameraGlyph(state: 'armed' | 'fading' | 'off'): void
  /** The shutter fired. */
  shutter(): void
  /** A captured frame. The HUD shell downloads it; another shell may show it. */
  deliverCapture(blob: Blob): void
}
```

`NULL_SHELL` implements every method as a no-op, `isOpen` false,
`ownsTarget` false. Its existence is the proof the port is complete: a
session running against it must render, respond to touch, shake, and the
director, and never throw. The headless probe runs against it.

### The `Session`

```ts
type LookSource = 'manual' | 'director' | 'shake' | 'camera'

interface Session {
  readonly look: Readonly<Prefs>
  readonly visualiser: Visualiser
  /** The one way the look changes. Assigns onto prefs, drives the visualiser
   *  for the fields it renders, persists (unless told not to), suspends the
   *  director for `manual`, and tells the shell for every other source. */
  apply(patch: LookPatch, opts: { rampS: number; source: LookSource; persist?: boolean }): void
  /** Write the look to storage. For a drag that applied with persist:false. */
  persist(): void
  /** 0-1 of the passthrough camera; resolves to what was actually achieved. */
  setPassthrough(a: number): Promise<number>
  solo(layer: 'geo' | 'atm' | 'cam'): void
  unsolo(): void
  /** The gate has resolved. Starts the live loop; ends the idle one. */
  start(source: AudioSource, motionGranted: boolean): void
  /** The space bar's synthetic shake. */
  setSynthShake(held: boolean): void
  /** The latest motion snapshot, for anything outside that reads it (the powder). */
  motion(): ShakeFrame
  dispose(): void
}
```

Persistence moves here. The HUD calls `apply` with `source: 'manual'` and
stops touching `savePrefs` or the `Prefs` object. `adopt()` on the HUD
becomes `lookChanged()`.

### What stays in `main.ts`

The gate (`waitForStart`, the powder easter egg's tap counter, the fullscreen
retry target), the chrome (`mountVersionHud`, `mountReleaseName`,
`mountQueuePanel`, `mountShare`, `applyReleaseTone`, the fullscreen chip),
prefs and URL resolution, the seed, building the visualiser, the keyboard
binding, and the HUD's construction as a `Shell`. About 250 lines.

## Phases

Each phase ships on its own and leaves the app byte-identical in behaviour.
The order is by payoff to the "different UI" question, then by what each
phase makes newly obvious.

### Phase 1 — the session (this plan)

Extract the orchestration from `main()` into `src/session/`, define the
`Shell` port, move persistence out of the HUD, add a headless session probe
under a stubbed DOM with the null shell.

Done when:
- `main.ts` is under 300 lines and contains no per-frame code.
- `hud.ts` imports neither `savePrefs` nor writes any field of `Prefs`.
- `src/session/` imports no value from `three` or `scene.ts`.
- `pnpm probe:session` passes under Node against `NULL_SHELL`, including a
  dispose that leaves zero listeners on the stub document.
- `pnpm probe:gestures` passes: double tap opens, a still hold arms, a drag
  is never a tap, a shaken phone is never a gesture.
- The real app at 320×568 and 360×640 looks and behaves as at build 487, in
  every state: gate, idle, live, HUD open, readout on, camera armed.

### Phase 2 — the view contract

Make what a view consumes explicit, and take per-view handles off the
generic layer.

- `View` gains an optional `handles` capability: `{ hitTest(x, y, r): number
  | null; drag(index, pos | null) }`. `hitTestEmitter` / `setEmitterDrag`
  become the anchor's case of the same shape; `hitTestChorusNode` /
  `setChorusNodeDrag` leave `Visualiser`. `scene.ts:1747`'s view-name test
  goes with them.
- `View` declares the uniforms it reads. `scene.ts` builds the material from
  that declaration; a shader referencing an undeclared uniform is a build
  failure, not a silent zero.
- Sensors leave `scene.ts`: location, ambient light, sky and moon sampling
  move behind the session (or an `senses/` directory if phase 3 chooses
  that name) and reach the visualiser as values, the way tilt already does.

Done when: adding a view with its own draggable handles touches `views.ts`
and one shader only.

### Phase 3 — name the inputs

`engine/` becomes honest about its contents. Two acceptable answers, to be
put to Victor as a taste question rather than decided here:

- rename to `inputs/` with `audio/` as a subdirectory, or
- keep `engine/` and split `senses/` (posture, touches, hover, origin,
  celestial, motion bias, RGB slip, camera arm, synth shake) beside it.

Either way `engine/index.ts`'s file comment and `docs/how-it-works.md`'s
tree are rewritten to match, and `celestial.ts` stops importing upward.

### Phase 4 — say what is fixed

Write into `docs/how-it-works.md` and `docs/what-resolume-knew-about-layers.md`
that composition is exactly two layers plus a camera, why, and what a third
layer would cost (a rewrite of `composite.frag.glsl`, the render targets, and
every layer union). One paragraph. This is documentation, not code, and it
is the cheapest item on the list; it is last only because the earlier
phases might change the answer.

## Decisions taken here, and the forks left open

- **The session owns `Prefs`, not the HUD.** Over: keeping `Handlers` and
  letting each UI save. A second UI re-implementing the `mix` mirror and the
  validate-on-load contract is exactly the silent-corruption risk hard stop 1
  exists to prevent. **Mine.**
- **`apply()` persists by default, with an opt-out for drags.** Over: never
  persisting in `apply` and requiring an explicit `persist()`. The director
  and the shuffle would each have to remember; today the HUD's `adopt` saves
  unconditionally and that has been right. The opt-out preserves the
  existing drag-then-settle write pattern so a colour drag does not write
  `localStorage` sixty times a second. **Mine.**
- **The gate and the chrome stay in `main.ts`.** Over: making the gate a
  Shell concern. The gate is a fact about this page's start, and its
  fullscreen ordering constraint (CLAUDE.md, build 53) is too delicate to
  move for no gain. A different UI gets its own gate. **Mine.**
- **Pointer listeners are bound by the session on `document`.** Over: the
  page binding them and forwarding. The recogniser's inputs are the
  session's business; a UI that wants the picture to answer touch should not
  have to know how. The session asks the shell `ownsTarget()` for the one
  fact it cannot know. **Mine.**
- **The visualiser is injected, not built by the session.** It needs a
  canvas and a GPU; the session needs neither, and the probe needs to fake
  it. This is also what lets a different page build it differently. **Mine.**
- **Haptics stay in the session, not the shell.** They are a device
  capability with their own silence-when-unsupported guard, not a drawing.
  **Mine.**
- **Phase 3's name is Victor's.** Both options above are defensible; the
  difference is taste and the cost of a rename in every probe's import.
- **Phase 2's uniform declaration format** (a string list on `View`, or a
  typed object) is decided in that phase's plan, not here.

## Hard stops

1. **Stored preference shape** — no. Phase 1 moves who writes `Prefs`; no
   field changes type or meaning. `mix` continues to be mirrored from
   `geoAlpha` on every save.
2. **URL parameter shape** — no. Resolution stays in `main.ts`, untouched.
3. **Capture and privacy** — no. Nothing new is captured or requested; the
   camera stream's lifecycle moves file but not behaviour. The gate copy is
   not touched.
4. **New runtime dependency** — no.

## Verification that applies to every phase

- `pnpm build`, `pnpm lint`, every probe in `checks.yml`, plus the ones each
  phase adds.
- The assembled HUD at 320×568 and 360×640 via `hud-narrow.html`, in every
  state.
- The real app through the gate on a desktop browser, and on a phone before
  the merge that renames the release.
- Before removing any line that writes state, ask what else relied on it
  having been written (CLAUDE.md, "Deleting code deletes what it was doing").
  Phase 1 moves the code that seeds every uniform at start; the probe's
  first check is that `start()` restores the stored look.
