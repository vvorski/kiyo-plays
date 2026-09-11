/**
 * Let Node resolve the imports Vite resolves for free.
 *
 * The app writes `from './engine'` and `from './shake'`; Vite finds
 * `engine/index.ts` and `shake.ts`. Node's ESM resolver does neither — it
 * throws ERR_UNSUPPORTED_DIR_IMPORT for the first and ERR_MODULE_NOT_FOUND for
 * the second — so any probe that imports a module which in turn imports either
 * shape fails before it runs a line of the code it meant to test.
 *
 * The existing probes never hit this because they import leaf modules only.
 * probe-fullscreen does, because permission-gate.ts imports `./engine`, and the
 * alternative to this hook is either not testing that file in Node at all or
 * restructuring the app's imports to suit the test harness. Neither is worth it
 * for twenty lines.
 *
 * probe-session.ts (docs/plans/session-extraction.md) added the second half:
 * views.ts imports every shader as `./foo.frag.glsl?raw`, a Vite asset-query
 * import with no Node equivalent — `getFileProtocolModuleFormat` doesn't
 * recognise `.glsl` and throws ERR_UNKNOWN_FILE_EXTENSION before the file is
 * even read. `createSession` reaches views.ts through look.ts's shuffle
 * ladder, so a session probe cannot avoid it the way probe-fullscreen and
 * probe-gestures avoid it by staying clear of prefs.ts/look.ts. The `load`
 * hook below treats any `.glsl` URL (the query is irrelevant — Vite's `?raw`
 * is the only one this codebase uses, but nothing here depends on that)
 * as plain text and hands back the same shape `?raw` produces under Vite:
 * a module whose default export is the file's source string.
 *
 * Register with: node --import ./scripts/dir-import-hook.mjs
 */

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(
  'data:text/javascript,' +
    encodeURIComponent(`
    import { existsSync, readFileSync } from 'node:fs'
    import { fileURLToPath } from 'node:url'

    // Directory imports resolve to an index; extensionless ones get an
    // extension. Order matters only in that .ts is what this project writes.
    const SUFFIXES = ['/index.ts', '/index.js', '.ts', '.js', '.mjs']

    export async function resolve(specifier, context, next) {
      try {
        return await next(specifier, context)
      } catch (err) {
        // Only rescue the two failure modes this exists for. Anything else is
        // a genuine unresolved import and must stay an error.
        if (err?.code !== 'ERR_UNSUPPORTED_DIR_IMPORT' && err?.code !== 'ERR_MODULE_NOT_FOUND') {
          throw err
        }
        if (!err.url) throw err
        const base = fileURLToPath(err.url)
        for (const suffix of SUFFIXES) {
          if (existsSync(base + suffix)) return next(base + suffix, context)
        }
        throw err
      }
    }

    // A shader source file, requested the way Vite's own \\\`?raw\\\` suffix
    // requests it: as text, not as something Node's loader should try to
    // parse. The query itself is never inspected — the only .glsl imports
    // this codebase writes are \\\`?raw\\\`, and treating every .glsl URL as
    // text regardless of its query is simpler than teaching this hook one
    // more asset-query convention it would otherwise have to keep in step
    // with views.ts.
    export async function load(url, context, next) {
      const pathname = new URL(url).pathname
      if (pathname.endsWith('.glsl')) {
        const source = readFileSync(fileURLToPath('file://' + pathname), 'utf8')
        return { format: 'module', source: 'export default ' + JSON.stringify(source), shortCircuit: true }
      }
      return next(url, context)
    }
`),
  pathToFileURL('./'),
)
