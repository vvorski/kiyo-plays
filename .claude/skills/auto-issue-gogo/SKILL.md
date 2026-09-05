---
name: auto-issue-gogo
description: Use when asked to work the ready queue autonomously — take each issue labelled status:ready in turn, branch, fix, review at high, verify on screen, run the gates, merge to main and deploy. Carries each fix all the way through without stopping for approval on every step.
---

# Working the ready queue end to end

Takes every issue labelled **`status:ready`** in `vvorski/kiyo-plays` and
carries it to `main` and to the deploy, one at a time.

The loop is: **select → branch → fix → probe → review → browser → gates → merge
→ deploy → report → next**.

This repo has **no Project board**. The queue is the `status:` label family, and
that label is the only thing that says an issue is workable. `spec-to-issue`
sets it; nothing else does.

| Label | Means |
|---|---|
| `status:needs-spec` | Not workable. Skip. |
| `status:ready` | Specced and approved. **This is the queue.** |
| `status:working` | You are on it right now. |
| `status:review` | Merged and deployed, awaiting the user's eyes. |
| `status:blocked` | Stopped at a Hard Stop or an external unknown. Skip. |

Create them once if `gh label list` does not show them:

```bash
gh label create status:needs-spec --color ededed --description "Not ready to implement"
gh label create status:ready      --color 0e8a16 --description "Specced and approved — the queue"
gh label create status:working    --color fbca04 --description "In progress"
gh label create status:review     --color 1d76db --description "Merged and deployed, awaiting confirmation"
gh label create status:blocked    --color b60205 --description "Needs a decision"
```

## Before anything: preflight

**One issue at a time, in this checkout.** `deploy/deploy.sh` publishes whatever
is built from the working tree, and the Pages workflow publishes whatever is on
`main`. Two issues in flight means one of them gets deployed by accident.

**Do not start with uncommitted changes.** Check first, and stop and ask if
there are any — they are not yours to commit or discard.

```bash
git status --short && git switch main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm build && pnpm lint
pnpm probe && pnpm probe:shake && pnpm probe:slow
```

**All of that must be green before you touch an issue.** If `main` is already
red you cannot tell your breakage from the inherited kind — stop the run and say
so.

**Then check the browser lane works, before branching anything.** §6 needs it,
and discovering mid-issue that it does not means finished work sits unverified.
Load the tools in one call:

```
ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages")
```

Start `pnpm dev --port 5199 --strictPort`, load a probe page that renders the
`circles` view, and confirm you get rings and not a black rectangle. **That
baseline is the harness check** — see `spec-to-issue/test-lanes.md` rule 1. If
the baseline is black, the harness is broken and every visual verdict in the run
would be worthless. Fix it here.

## 1. Select the queue

```bash
gh issue list --label status:ready --state open --limit 50 \
  --json number,title,labels,createdAt
```

Work in the order the user gave; absent one, take live user-facing bugs before
refactors, and put anything large last so it cannot absorb the run.

**Then triage each one before touching it.** An issue is workable only if the
cause is already located *or* is findable without a decision that is the user's
to make. Skip and record, do not guess, when the issue:

- names an **open taste decision** in its body or comments. On a visual project
  these hide well: "make the transition smoother" is a fork, not a spec;
- would need a **Hard Stop** — stored preference shape, URL parameter shape,
  capture/privacy, or a new runtime dependency (`CLAUDE.md` § Hard stops).
  Autonomy is over *approved* work, not over the approval — **unless** the issue
  body has a `## Hard Stop sign-off` section naming the specific Hard Stop(s) as
  approved. A comment thread does not count, even from the repo owner: it is
  easy to miss on a fast triage pass and easy to lose track of which comment is
  operative. The body is the one place a triage pass is guaranteed to read. If
  the section approves a preference change but the fix also needs a new
  dependency, the un-named one is unapproved and you stop;
- is a feature with no spec comment yet. Those need `spec-to-issue` first, not
  an improvised implementation.

A skipped issue is a reported outcome, not a failure. Say why, and move on.

## 2. Branch from fresh main

```bash
git switch main && git pull --ff-only
git switch -c fix/<issue-number>-<short-slug>
gh issue edit <n> --remove-label status:ready --add-label status:working
```

Always branch from an up-to-date `main` — the previous iteration merged into it,
and branching from a stale one silently reverts that work in the squash.

Move the label right after branching, not retroactively. It is what lets the
user glance at the issue list mid-run and see which one is live.

## 3. Fix

Ordinary `CLAUDE.md` rules. **`CLAUDE.md` is not suspended because the run is
unattended** — in particular its first rule: when the change is big, the
reorganisation it implies is part of that change, not a follow-up.

If the fix turns out to need a Hard Stop after all: **stop that issue**, label
it `status:blocked`, leave the branch, say why, carry on with the next. Do not
negotiate with yourself about whether a preference migration is "small".

## 4. Probe — seen failing, then everything

Both, in this order. The first is the one that gets skipped under time pressure.

```bash
# the new or changed probe case must be watched going red
git stash push -- <fixed files>
pnpm probe:<lane>          # expect the CHECK line, not PASS
git stash pop
```

Record what actually went red. A case that was already true is fine — name it as
a guard. A probe that passes without exercising anything is indistinguishable
from a real one until the day it matters.

Then the whole set:

```bash
pnpm build && pnpm lint
pnpm probe && pnpm probe:shake && pnpm probe:slow
```

**Nothing downstream runs these.** The Pages workflow builds; it does not probe.
If you skip this, nothing else catches it.

## 5. Review at high, then review the fix

```
/code-review high
```

**Check what it reviewed before you read the findings.** It reviews the
repository it is pointed at, and a session whose working directory is elsewhere
will happily review a different project — that has already happened once. If the
findings name files you do not recognise, it reviewed the wrong tree; re-run it
from this checkout rather than acting on them.

Apply findings deliberately rather than with `--fix`, then **run it again on the
corrections**. Pointing the reviewer at the tree *after* a batch of fixes has the
highest yield of anything tried here.

Render findings as markdown in your reply — never raw JSON. Findings you
disagree with are fine to decline; say so and why. Findings about correctness
are not — fix them or stop the issue.

## 6. Verify on screen

Required for every change to `shaders/`, `scene.ts`, `hud.ts`, or anything that
positions an element. `pnpm build` passing tells you nothing about whether a
shader compiles on the GPU: GLSL is a string to the bundler, and a syntax error
builds clean and fails at runtime with a black screen.

Per `spec-to-issue/test-lanes.md` lane 3: throwaway probe page importing the
module directly, dev server on 5199, screenshot, delete the page afterwards.

Three things that have each cost a debugging session:

- **`requestAnimationFrame` never fires** in a non-frontmost automation window.
  Drive the loop by hand and spin-wait on `performance.now()`, or `uTime` never
  advances, no ripple is ever born, and you conclude the shader is broken.
- **Render the `circles` baseline in the same harness every time.** A black
  screen from a broken harness and a black screen from a broken shader are
  identical.
- **Read `read_console_messages`.** A failed shader compile is a console message,
  not a thrown exception.

**Device lane.** `devicemotion`, safe-area insets, the mic gate, and how large
anything feels in the hand cannot be checked on a desktop. If the issue touches
those, say so in the hand-back and name what the user has to look at on the
phone. Two visibility bugs have already shipped past a passing desktop check.

## 7. Gates

```bash
pnpm build && pnpm lint
```

Then, before merging, check the bundle did not grow unexpectedly. `pnpm build`
prints gzip sizes; the app chunk sits around 35 kB and `three` around 117 kB. A
jump means a dependency crept in, which is a Hard Stop you did not notice
taking.

## 8. Merge

There is no merge script here. Branch, PR, squash, delete:

```bash
git push -u origin HEAD
gh pr create --fill --base main
gh pr merge --squash --delete-branch
git switch main && git pull --ff-only
```

### Verify the merge landed — never trust the exit code alone

"It returned 0" is not the same claim as "the commit is on main":

```bash
git fetch origin main --quiet
git log origin/main --oneline -1
gh issue view <n> --json state -q .state
```

Confirm the squash commit is actually on `origin/main` before deploying or
labelling anything. A run that reports six merges and delivered five is worse
than one that stops at the first failure — the labels say done, `main` says
otherwise, and nobody looks again.

## 9. Deploy, and confirm it landed

GitHub Pages deploys itself from `main` via `.github/workflows/pages.yml`. Wait
for it, then confirm the new bundle is live:

```bash
curl -s https://vvorski.github.io/kiyo-plays/ | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1
```

Two different hashes means one host is stale — say so rather than reporting a
deploy. Note the host is **`vvorski.github.io`**, not the organisation account;
checking the wrong one reports a stale bundle that is not stale.

## 10. Report and hand back

Comment on the issue with what changed, what went red before the fix, what the
review found, what the screen showed, the build number
(`git rev-list --count HEAD`), and anything only checkable on a phone. Then:

```bash
gh issue edit <n> --remove-label status:working --add-label status:review
```

**Do not close the issue.** Merged and deployed is not confirmed — this is a
visual project and the only real verdict is someone looking at it on a phone.
Closing belongs to the user.

## 11. Between issues

Report before starting the next: issue number, what changed, what went red, what
review found, what the screen showed, the merge commit, the deployed build
number. A few lines each. The user is not watching every step; the running log
is how they stay able to stop you.

Then return to §1 — labels may have moved under you.

## Stop the whole run and ask when

- a **Hard Stop** is needed and no `## Hard Stop sign-off` exists on the issue
  body naming that specific one;
- **`main` is red before you start** — build, lint or any probe;
- **the browser baseline renders black** in preflight;
- a merge conflicts, or the §8 verification does not show the commit on
  `origin/main`;
- the same fix fails on-screen verification twice — stop rather than iterate
  blind;
- a deploy does not publish the new bundle and a retry does not fix it;
- anything wants a **new runtime dependency**, however small it looks.

## Provenance

Adapted from the METIS project's `auto-issue-gogo`. The loop shape, the triage
rules, the Hard-Stop-sign-off-must-be-in-the-body rule, the seen-failing-first
discipline, the review-then-review-the-corrections step, and the
verify-the-merge-actually-landed step are unaltered — those are project-agnostic
and each was learned the hard way.

What changed for kiyo-plays: the queue is the `status:` label family rather
than a Project board column, since this repo has no board (so §9's `gh project
item-edit` GraphQL dance is replaced by `gh issue edit --add-label`); the test
lane is `pnpm build`/`lint` plus the three headless probes rather than a Django
suite; there is no `merge-to-main.sh`, so §8 is an explicit PR-and-squash and
the "verify it landed" step guards a different failure; a deploy step was added
to confirm GitHub Pages actually published the new bundle; the browser step is
a throwaway probe page against a
local dev server rather than an authenticated session on a shared dev site, and
carries this project's three specific harness traps; and a device lane was added
for the things a desktop browser cannot check at all.
