import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// A monotonic build marker for the on-screen version HUD (src/version.ts).
// The commit count, not a hand-maintained number, because a number nobody has
// to remember to bump is a number that can't fall out of sync with what
// actually shipped. And the commit count, not a build timestamp, because two
// builds of the same commit — a local build and the one CI publishes — would
// otherwise show different numbers for what is supposed to be identical.
// Needs full git history, which is why both GitHub Actions workflows'
// checkout steps are configured with fetch-depth: 0 rather than the default
// shallow clone.
const buildNumber = execSync('git rev-list --count HEAD').toString().trim()

const rootDir = dirname(fileURLToPath(import.meta.url))

interface QueueRow {
  n: number
  title: string
  build?: number
}

/** docs/todo.md entry 93 — 24 characters, the entry's own number, plus an
 *  ellipsis on anything longer so a cut title never reads as a complete
 *  one. The ellipsis-on-truncation itself is **Mine**: Decided names only
 *  the character cap. */
function truncateTitle(title: string, max = 24): string {
  return title.length > max ? `${title.slice(0, max - 1)}…` : title
}

/**
 * docs/todo.md entry 93 — the queue's own state, read from the working
 * tree at build time, not the git log: unlike __BUILD_NUMBER__ this needs
 * no history and no CI change. Parses `### N. Title` headers and the
 * `` `status: ...` `` line that the format in docs/todo.md's own "##
 * Format" section always places immediately below each header — never a
 * bare regex over the whole file, which also matches the word "status:"
 * inside ordinary prose (a build note once quoted the claiming protocol's
 * own status line verbatim, and a naive whole-file scan picks that up as a
 * second entry 61).
 */
function buildQueue(): { shipped: QueueRow[]; waiting: QueueRow[]; remaining: number } {
  // Both files, and this is not optional. `/ccc` moves an entry from
  // docs/todo.md to docs/built.md once it has been read back against the
  // code, so the *most recently shipped* entries are precisely the ones most
  // likely to have left the queue already. Reading todo.md alone — which this
  // did until build 353 — makes the gate's "last two built" drift steadily
  // further into the past with every archival commit, and the drift is
  // invisible because the panel still renders two plausible-looking rows.
  //
  // A missing built.md is not an error: it does not exist before the archive
  // split, and this file has to keep building an old checkout.
  const entries: { n: number; title: string; status: string; build?: number }[] = []
  for (const file of ['docs/todo.md', 'docs/built.md']) {
    let text: string
    try {
      text = readFileSync(resolve(rootDir, file), 'utf8')
    } catch {
      continue
    }
    const lines = text.split('\n')
    const entriesStart = lines.findIndex((l) => l.trim() === '## Entries')
    if (entriesStart === -1) continue

    for (let i = entriesStart + 1; i < lines.length; i++) {
      const header = /^### (\d+)\.\s*(.+)$/.exec(lines[i])
      if (!header) continue
      const statusLine = lines[i + 1] ?? ''
      const status = /^`status:\s*([a-z]+)/.exec(statusLine)?.[1]
      if (!status) continue
      const buildMatch = status === 'done' ? /build (\d+)/.exec(statusLine) : null
      entries.push({
        n: Number(header[1]),
        title: header[2].trim(),
        status,
        build: buildMatch ? Number(buildMatch[1]) : undefined,
      })
    }
  }

  // The two most recently shipped, oldest of the pair first — a short
  // timeline reading top to bottom into the waiting rows below it, past
  // into present.
  const shipped = entries
    .filter((e): e is typeof e & { build: number } => e.status === 'done' && e.build !== undefined)
    .sort((a, b) => b.build - a.build)
    .slice(0, 2)
    .reverse()
    .map((e) => ({ n: e.n, title: truncateTitle(e.title), build: e.build }))

  // `building` counts as waiting, not shipped — it is still ahead of the
  // gate, not behind it, and this is exactly the state entry 93 itself
  // will be in while this very build runs.
  const waitingAll = entries.filter((e) => e.status === 'ready' || e.status === 'building')
  const waiting = waitingAll.slice(0, 5).map((e) => ({ n: e.n, title: truncateTitle(e.title) }))
  const remaining = Math.max(0, waitingAll.length - waiting.length)

  return { shipped, waiting, remaining }
}

export default defineConfig({
  // actions/configure-pages resolves this to /<repo>/ for the GitHub Pages
  // build; pnpm dev and vite preview need it to stay at root. Reading it from
  // the environment rather than hardcoding either keeps both cases working.
  base: process.env.BASE_PATH ?? '/',
  define: {
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
    // Double-stringified: the inner JSON.stringify turns the queue object
    // into JSON text, the outer one turns that text into a valid JS string
    // literal for `define`'s raw substitution — queue-panel.ts JSON.parses
    // it back at runtime, the same shape it left this file in.
    __QUEUE__: JSON.stringify(JSON.stringify(buildQueue())),
  },
  server: {
    // Bind to 0.0.0.0 so the dev server is reachable from a phone on the same
    // network. Testing this on a real device is not optional — the gesture
    // unlock, the wake lock and the GPU budget all behave differently there
    // than they do in a desktop browser's device emulation.
    host: true,
  },
  build: {
    target: 'es2022',
    // Everything here is one small module graph plus Three. Inlining the CSS
    // and shaders saves round trips on a cellular connection, which is the
    // realistic first-load case.
    assetsInlineLimit: 8192,
    rollupOptions: {
      output: {
        // Three is by far the largest dependency and never changes between
        // deploys; splitting it out keeps it cached across releases.
        manualChunks: { three: ['three'] },
      },
    },
  },
})
