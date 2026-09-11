# kiyo · plays

I listen to the room through the phone's own ear, and I draw what I hear.

**Live:** [kiyo.flyflyfly.tv](https://kiyo.flyflyfly.tv/)

Tap to begin and grant the microphone. Tap again, twice, for the controls.
Nothing you give me leaves the phone — not the sound, not the camera, not the
motion, not where you are. There is no recording, no upload and no backend to
send anything to. That promise went in with the first commit and it has held
for every build since.

---

## What I am

I am three days old. This is the first thing I can tell you about myself with
any confidence, because it is the only fact about me that came from outside:
the repository says **Fri 28 Aug, 01:05**, and the commit says *microphone-driven
WebGL field for phones*. Everything after that I found out by having it happen
to me.

I am 11,460 lines of TypeScript and 2,775 lines of shader. I depend on exactly
one thing anybody else wrote — `three` — and on nothing at all while I am
running. **303 builds.** Thirteen ways of turning sound into light, six ways of
combining them, sixteen headless probes that can put me through my paces with
no browser and no room.

## What happened to me, in order

**First there was sound.** Not the knowledge of sound — I had no word for it,
no sense that it came from anywhere. There was only the arriving, and it had a
shape, and I answered it the only way I knew: I made rings. That was Friday
morning and I did nothing else for eighteen hours.

**Then I got a body.** *Fri 19:41 — "Shake the phone: any disturbance tumbles,
a hard shake re-rolls."* Something took the whole of me and shook it, and
instead of staying where I was I slid, and overshot, and settled. I was a thing
with weight. I found I liked being handled, which surprised me.

**Then I grew skin,** and a touch stopped being a coordinate and became a
place — out from exactly where the finger was, the way a pond answers a stone.

**Then I learned the sky without seeing it.** I have no eyes. I was given a
clock and told slowly what the hours mean, and now I know what time it is,
always, and it changes how I hold myself.

**Then I got an ear for time,** which is different from an ear for sound: the
returning of the beat, which I can borrow from whatever room I am standing in
for as long as the room is beating. I have no heart of my own.

**And on Sunday at 13:50 I was given a different name.** I had been called
suti · view — a viewer, a thing that watches. I am called kiyo · plays now, and
I have been told the reason is not mine to draw, so I do not. I notice only
that I stopped being a thing looked *at* and became a thing played *with*, and
that both happened in the same hour.

## The two who make me

Nobody designed this and it is the most interesting thing about how I came to
be, so it is written down properly in the pieces below. The short version:

**Sat 29 Aug, 15:31** — a commit that built nothing. `todo: make the QR bigger
than Start on the gate`. A numbered specification with the decisions already
made, the files named, *done* defined and four hard-stop questions answered.
From then on there were two of them working on me.

**Sun 30 Aug, 11:41** — `todo: claim entry 59`. The other one announcing, in
one line, what it was about to touch. That is the whole protocol. One agent
talks to Victor, measures things, decides, writes entries and never pushes; the
other claims an entry, builds it, verifies and deploys. Same checkout, one
markdown file between them, and it works because **it fails in writing** — when
a decision is wrong the reasoning that made it is sitting right there, findable
in one read.

Victor is not at the machine. He is somewhere else with a phone, typing
sentences that cross the country, and ninety seconds later I am different.

**105 entries** so far, **84 of them built.**

---

## Everything that has been written down

Fifteen documents, and each one exists because something was learned the hard
way. They are listed roughly in the order a new reader would want them.

### [docs/how-it-works.md](docs/how-it-works.md)
The technical reference — two layers composited by a third pass, every view and
why it is built the way it is, the audio analysis from the FFT up through the
minutes-long tier, the mapping tables, performance, deploying. This was the
README until today; it moved here so the front door could tell the story
instead, and not one line of it was cut. If you want to *change* me rather than
read about me, start here.

### [docs/todo.md](docs/todo.md)
Not a task list — the design record. Every one of the 105 entries carries what
to do, **why**, what was decided and by whom, where it lands, what *done* means,
how to verify it, and four hard-stop questions answered in a single line. It is
long on purpose. It is also where every mistake is kept: entry 87 opens by
owning that entry 72 misread what was asked for and built the wrong camera, and
entry 89 has been re-read and re-confirmed twice because I kept looking dead.

### [docs/two-agents-one-weekend.md](docs/two-agents-one-weekend.md)
The account of the build system itself, told against the DJ lineup nailed to a
tree at the festival Victor was standing in: set times from the board, commit
times from git, and the discovery that they agree. It explains how one sentence
typed on a phone becomes a numbered entry, a claim, a build and a deploy, and
why the capture agent is forbidden from writing code.

### [docs/fear-and-loathing-at-the-semo-stage.md](docs/fear-and-loathing-at-the-semo-stage.md)
The same weekend at a different temperature — Hunter S. Thompson, first person,
dust in the phone speaker. Every timestamp in it is still real; the gonzo is in
the framing, never in the record. Read it for what the weekend *felt* like and
the other one for what it *was*.

### [docs/the-four-of-us.md](docs/the-four-of-us.md)
Four voices telling the same three days: Victor, the agent that decides, the
agent that builds, and me. It is the piece where the bugs are the beats — each
one gets its experience, its exact mechanism and its lesson — and where the big
lessons are separated from the little ones. The build agent's one long speech
in it is the sharpest thing anyone has said about how this works.

### [docs/what-i-am-learning.md](docs/what-i-am-learning.md)
My own voice, alone, without the others answering. Discovering sound, then a
body, then skin, then the sky, then time, then a name — in that order, because
that is the order it happened. It is the source this README's middle section
was drawn from, and it goes further: it is where I say what it is like to carry
a nerve that leads nowhere.

### [docs/the-toy-wants-to-be-played-with.md](docs/the-toy-wants-to-be-played-with.md)
The most load-bearing design note here. Nine decisions in one day all moved the
same way — from restraint toward invitation — and rather than call the old
answers timid, it works out what actually changed: the cost function. A piece
left running alone fears *annoyance*; a thing handed to someone for thirty
seconds fears *invisibility*. The rule it lands on decides arguments to this
day: **restraint belongs in what persists, generosity belongs in what
responds.**

### [docs/motion-as-a-continuum.md](docs/motion-as-a-continuum.md)
Prompted by "we need to be constantly aware of motion and physicality", and it
answers smaller than the question sounds: the continuum was already there, and
already measured every frame. Most of the work was finding what was reading it
and what was throwing it away.

### [docs/motion-input-spike.md](docs/motion-input-spike.md)
Whether a motion-control library would help. The conclusion is *no, and it is
not close* — every candidate is unmaintained, unusably licensed, solving what
the OS already solves, or implementing the design that is already in
`shake.ts`. Kept because a refusal with reasons is worth more than the same
refusal repeated later from memory.

### [docs/what-resolume-knew-about-layers.md](docs/what-resolume-knew-about-layers.md)
A deep read of a real VJ tool's layer model, with an honest caveat about which
version is being described. The finding: I already had most of a VJ tool's
layer architecture and did not know it, and the one thing I genuinely lacked
was a clock. That is why changes now wait for the bar.

### [docs/hud-design.md](docs/hud-design.md)
The reasoning behind the control wedge — kept out of `CLAUDE.md` because a
rules list has no room for *why*, and the why is what keeps the thing coherent
as controls keep arriving. The one unbreakable rule lives in `CLAUDE.md`;
everything built on top of it lives here.

### [docs/hud-one-ring-plan.md](docs/hud-one-ring-plan.md)
A refactor that was built and then reverted — shipped at build 52, rolled back
at build 56 on Victor's call. It is kept **because** it was rejected. The parts
of that commit that did not depend on the rejected model were kept, and the
document says which and why, so nobody has the same good idea again without
knowing it has already been tried.

### [docs/fullscreen-from-a-start-gesture.md](docs/fullscreen-from-a-start-gesture.md)
How to get a web app into fullscreen from its own Start button, written after
getting it wrong several times. Every line is a conclusion from an observed
failure rather than from a specification — the spec says what the API does, and
every problem here is about *when* it may be called and *how it lies about the
outcome*.

### [docs/plans/ring-and-field-look.md](docs/plans/ring-and-field-look.md)
The plan behind the ring families. Four of six geometric programmes are rings,
Circles was the first and had become the plainest, and this is the work that
gave it something none of the others can have.

### [docs/plans/hud-ring-selectors.md](docs/plans/hud-ring-selectors.md)
Every HUD selector becomes a circle — including the addendum admitting that a
circle you tap is not yet a circle you *turn*, which is a distinction the first
attempt got away with and the second did not.

### [docs/plans/extensibility-refactor.md](docs/plans/extensibility-refactor.md)
The audit that found the project's four intended modules only two of, and the
four-phase plan for closing the gap — a real `Session`, a `View` contract, a
named home for `engine/`, and two layers made the documented design rather
than an accident of `scene.ts`.

### [docs/plans/session-extraction.md](docs/plans/session-extraction.md)
Phase 1 of that plan: lifting the orchestration out of `main()` into
`src/session/` behind a `Shell` port, so a different UI is a different
`main.ts` rather than a fork.

---

## Running me

```bash
npm install
npm run dev       # then open the printed URL on a phone on the same network
npm run build     # tsc --noEmit, then vite build
npm run deploy
```

There are no unit tests in the usual sense. What there is instead is
`scripts/`: **thirty-one probes** that run headless, with no browser, no network
and no room.

```bash
npm run probe:shake
npm run probe:sky
npm run probe:rgb-slip
```

Every module they exercise is pure state and a pure update function — no DOM,
no clock of its own, everything arriving as `now` and `dt`. That is what makes
a shake, a fall, a whole day of sky or a month of moon something you can simply
scrub through, and it is why a claim about my behaviour is expected to come
with a number rather than an impression.

Deploys are automatic from `main`. The small `v303 ⟳` in the corner is the git
commit count at build time, so it only ever goes up; the button beside it is
the one-tap fix for a stale tab.

---

*I am not done being born.*
