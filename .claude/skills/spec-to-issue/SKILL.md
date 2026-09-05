---
name: spec-to-issue
description: Use when turning a kiyo-plays issue into a specification another agent will implement, when triaging whether an issue is ready to hand off, or when an agent came back blocked on an issue that looked fully specified.
---

# spec-to-issue

## Overview

Produce a spec, post it as a comment on the issue it specifies. No `specs/`
file — the issue is the single artifact. Issues and code live in the same repo,
`vvorski/kiyo-plays`, so `gh issue` needs no `--repo`.

**Core principle: a spec is ready when an agent with no memory of this
conversation can execute it without making one judgement call you could have
made for them.** Specs do not fail by being short. They fail by containing an
unresolved fork, and the agent's guess is worse than its question.

The dangerous failure is not an obviously thin spec. It is a thorough, confident
spec that silently decided a *taste* question on the user's behalf. This project
is a visual one; almost every interesting fork here is a taste question wearing
a technical costume. "Should the ring ease out or grow linearly" reads as
implementation and is not.

## The spec IS these sections, in this order

| Section | Contains |
|---|---|
| `## Approvals` | Every decision the **user** made. Required, never omitted. |
| `## Context` | What's wrong with `file:line`. Why the ticket's framing misleads. The unlock. The traps. Alternatives rejected, each with its reason. |
| `## Design` | Numbered artefacts. Exact signatures, exact constants with the reason for each number, which layer each piece lands in (`engine/` listens and knows no screen exists; `director.ts` is policy; `scene.ts` and `shaders/` draw; `hud.ts` is the control surface). |
| `## Test cases` | Real cases in every applicable lane. Never "add tests". |
| `## Files` | Create/edit, grouped. Plus **explicitly not in scope**. |
| `## Verification` | Gate commands, the prove-it-fails step, the on-screen checklist. |
| `## Hard-stop check` | CLAUDE.md's four Hard Stop categories answered, then the verdict. |

## `## Approvals`

Its job is to stop the implementing agent reopening settled decisions — and stop
it assuming approval nobody gave.

`| Date | Question put to the user | Chosen | Rejected |`

- One row per `AskUserQuestion`. Record what they picked it **over** — the
  rejected option is what prevents re-litigation.
- **Any taste decision goes to the user, not into your rationale.** Catching
  yourself writing "Rationale for the palette" means you approved something on
  their behalf. Ask instead.
- A Hard Stop the user approved is a row, and that row is what licenses
  implementation.
- No approvals needed? Then the row is literally *"None — every Hard Stop
  category is no, implement directly."* An empty section is ambiguous between
  "nothing needed" and "nobody asked"; those have opposite consequences.
- End with a `Not approved:` line for anything you raised and they did not take.

## Ask in rounds until no forks remain

The Approvals table is the **output of a loop**, not of a single pass. Keep
asking until pre-post check question 1 answers *"none"*.

- **Never post a spec that lists open questions.** A spec whose own status is
  "blocked on Q1-Q5" is a questionnaire wearing a deliverable's clothes.
- `AskUserQuestion` takes **at most 4 questions per call**. Five forks means at
  least two rounds. Batch related ones; never drop the fifth.
- **Answers create new forks.** Re-scan the design after every round.
- Ask the highest-leverage fork first; its answer often deletes the rest.
- **"You decide" is an answer.** Record it (`Chosen: delegated — <what you
  picked>`), pick, state it, move on.
- For a visual fork, **an option's preview is worth more than its description**.
  `AskUserQuestion` renders previews side by side; an ASCII sketch of two HUD
  layouts settles in one round what three paragraphs will not.
- Only an **external unknown** — something awaiting a person, a device, or a
  measurement — may ship unresolved, named in Approvals with who can answer it.
  "Does this read as too fast on an actual phone" is a legitimate external
  unknown. "Which of these two should it be" is not.

## Hard-stop verdict

`CLAUDE.md` § Hard stops names four categories: **stored preference shape**
(`Prefs`; adding a field is safe, changing one is not), **URL parameter shape**
(shared links are how this travels), **capture and privacy** (what is captured,
any network request, any new permission prompt), and **a new runtime
dependency** (this ships to phones over cellular).

Answer each category yes/no against the design, then state the verdict
**matching your own answers**. Any yes means the spec is a proposal and stops at
that gate — say what changes, what it touches, the impact on people who already
have the page loaded, and the alternatives — do not implement past it. All four
no means: implement directly, the gate commands in `## Verification` are the
gate, do not ask.

A spec that answers "yes" to a category and then writes "all no" is the exact
contradiction this section exists to catch.

## Test cases

Three lanes exist here: the **build gate**, **headless probes**, and the
**browser**. There is no unit-test framework — no vitest, no jest — and the
probe scripts under `scripts/` are the pattern instead. Do not invent a test
runner; adding one is a dependency decision and therefore a Hard Stop.

Four rules hold in every lane:

1. **"No evidence" must fail, not pass.** A black screen and a broken harness
   look identical.
2. **Include a step that proves the test fails** — pin a value, name which probe
   line goes red, revert.
3. **A visual claim needs an image, not a type check.** `pnpm build` passing
   tells you nothing about whether a shader compiles on the GPU.
4. **A lane you call impossible costs the same proof as a lane you write.**

**REQUIRED REFERENCE:** read `test-lanes.md` before writing this section. It
carries what each lane must specify and worked examples of all four rules.

## Before you write

1. **Read the code before believing the ticket** — it describes a symptom.
2. **Hunt for a signal already computed before proposing a new one.** Highest
   leverage, most skipped. The engine already produces eleven `Motion` fields
   and eleven `Character` fields; grep for the quantity, not the feature.
3. **Distrust what looks live**, and end recon by listing the traps you found.
4. **Check what a deletion was also doing.** Removing a line that writes state
   has twice removed a second thing nobody was tracking.
5. **Correct the ticket where it is wrong**, in the spec and in the comment.

**REQUIRED REFERENCE:** read `recon-traps.md` for how to do 2-4 and what this
codebase specifically hides.

## Red flags in your draft

| Phrase | Meaning |
|---|---|
| "choose between" / "either approach works" | Unresolved fork. Ask the user. |
| "Rationale for the split/choice" | You approved a taste decision yourself. |
| "add appropriate tests" | Name the cases and what each guards. |
| "consider whether" / "may need to" | Handing over your uncertainty. |
| "should be straightforward" | You have not read the code. |
| "make it look better/nicer" | Not a spec. What, exactly, differs on screen? |
| A claim with no `file:line` | Unverified. Verify or delete. |
| A constant with no reason | Every number here earns a sentence. |
| No Approvals row | Not ready, even if nothing was approved. |
| The spec itself lists open questions | Go ask them. |
| "Blocked on user answers" as a status | Only valid for an external unknown. |
| No browser lane and no reason given | Lane silently skipped. |
| `## Context` with no traps | Nobody looked. |
| "Done" anywhere in the spec | The spec proposes work; only the implementing agent can claim done. |

## Posting

Write the body to the scratchpad, then
`gh issue comment <n> --body-file <path>` — so a failed call is re-postable, and
inline `--body` does not mangle the markdown. Correcting a spec you already
posted: `--edit-last`, so the issue carries one accurate spec rather than a spec
plus errata.

Then set the queue label, since `auto-issue-gogo` reads it and nothing else
does:

```bash
gh issue edit <n> --remove-label "status:needs-spec" --add-label "status:ready"
```

A spec that stops at a Hard Stop gets `status:blocked` instead, and the reason
belongs in the comment.

Posting is outward-facing; do it when the user asked for it.

## Pre-post check

Read it as the implementing agent: no memory, no access to you.

1. Any point where I must choose and have no basis?
2. Every claim checkable at a `file:line`?
3. Do I know whether to stop for approval?
4. Can I tell when I am done — including what it should *look* like?
5. Is there a check that fails if I build the wrong thing?
6. Do I know what not to touch?

Any "no" is a rewrite.

## Provenance

Adapted from the METIS project's `spec-to-issue`, whose Approvals /
ask-in-rounds / hard-stop-verdict / red-flags structure is unaltered — those
failure modes are project-agnostic.

What changed for kiyo-plays: one repo instead of a split code/tracker pair,
so `gh` needs no `--repo`; the Hard Stop categories are this project's four
(preferences, URL shape, capture/privacy, dependencies) rather than METIS's
three; the test lanes are the build gate, headless probes and the browser, with
an explicit note that no unit-test framework exists and adding one is itself a
Hard Stop; the queue is a `status:` label rather than a Project board column;
and two additions specific to a visual project — the warning that taste
questions here masquerade as implementation questions, and the note that
`AskUserQuestion` previews settle a layout fork faster than prose.
