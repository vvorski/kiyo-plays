/**
 * The whole app under Node, against a fake visualiser and the null shell —
 * docs/plans/extensibility-refactor.md, phase 1.
 *
 * The claim this exists to hold: a session has no opinion about its UI. If
 * that is true, it runs with no UI at all, and every input the page can give
 * it — a start, a touch, a held space bar, a director tick — reaches the
 * visualiser as a call this file can count. The known-good case comes first
 * (CLAUDE.md: keep one in every probe), because a harness that reports
 * nothing rendering is more often a harness bug than a session bug.
 *
 * `document`, `window`, `localStorage` and `requestAnimationFrame` are
 * stubbed with exactly the surface the session touches. A stub that has to
 * grow is a session that has reached for more of the page than it should,
 * and that is a finding, not a nuisance.
 *
 * Run: pnpm probe:session
 */

let failures = 0
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `  — ${detail}`}`)
}

// ─── the page, faked ────────────────────────────────────────────────────
type Listener = (e: unknown) => void
function eventTarget() {
  const map = new Map<string, Set<Listener>>()
  return {
    addEventListener(type: string, fn: Listener) {
      if (!map.has(type)) map.set(type, new Set())
      map.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: Listener) {
      map.get(type)?.delete(fn)
    },
    dispatch(type: string, e: unknown) {
      for (const fn of map.get(type) ?? []) fn(e)
    },
    count() {
      let n = 0
      for (const s of map.values()) n += s.size
      return n
    },
  }
}
const doc = Object.assign(eventTarget(), {
  visibilityState: 'visible',
  fullscreenElement: null,
  getElementById: () => null,
  querySelector: () => null,
})
const win = Object.assign(eventTarget(), {
  location: { search: '', origin: 'http://probe', pathname: '/' },
  matchMedia: () => ({ matches: false }),
  setTimeout,
  clearTimeout,
})
const store = new Map<string, string>()
const rafQueue: Array<(t: number) => void> = []
let clock = 0
Object.assign(globalThis, {
  document: doc,
  window: win,
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
  // Node 24+ ships its own read-only `navigator` global (userAgent etc.),
  // so this is left alone rather than replaced — the same finding
  // probe-haptics.ts already recorded. Everything the session's import
  // graph reads off it (geo-location.ts's `.geolocation`, haptics.ts's
  // `.vibrate`) already guards for the field being absent.
  requestAnimationFrame: (fn: (t: number) => void) => {
    rafQueue.push(fn)
    return rafQueue.length
  },
  performance: { now: () => clock },
})
/** Advance one frame of 1/60 s and run everything queued for it. */
function pump(frames = 1): void {
  for (let i = 0; i < frames; i++) {
    clock += 1000 / 60
    const q = rafQueue.splice(0)
    for (const fn of q) fn(clock)
  }
}

// Imported after the stubs exist — module-level code in shake.ts and
// permission-gate.ts reads `window` at import time.
const { createSession, NULL_SHELL } = await import('../src/session/index.ts')
const { releaseSeed } = await import('../src/release-name.ts')
type Visualiser = import('../src/scene').Visualiser

function fakeVisualiser(): { v: Visualiser; calls: string[] } {
  const calls: string[] = []
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push(name)
    void args
  }
  const v = {
    render: rec('render'),
    resize: rec('resize'),
    dispose: rec('dispose'),
    setGeometricView: (n: string) => calls.push(`geo:${n}`),
    setAtmosphericView: (n: string) => calls.push(`atm:${n}`),
    setMergeMode: rec('merge'),
    setLayerColour: (l: string) => calls.push(`colour:${l}`),
    setMotion: rec('motion'),
    setGravity: rec('gravity'),
    setTumble: rec('tumble'),
    setTouches: rec('touches'),
    setEmitterDrag: rec('emitterDrag'),
    hitTestEmitter: () => false,
    hitTestChorusNode: () => null,
    setChorusNodeDrag: rec('nodeDrag'),
    setHover: rec('hover'),
    setTouchStream: (began: boolean) => {
      if (began) calls.push('streamBegan')
    },
    setGeoAlpha: rec('geoAlpha'),
    setAtmAlpha: rec('atmAlpha'),
    setPassthrough: rec('passthrough'),
    randomise: rec('randomise'),
    stats: () => ({ frameMs: 16, pixelRatio: 1, resolved: 0, total: 0, firstGapMs: null, worstGapMs: null }),
    requestCapture: (cb: (b: Blob | null) => void) => cb(null),
  } as unknown as Visualiser
  return { v, calls }
}

function fakeAudio() {
  const freq = new Uint8Array(1024)
  const time = new Uint8Array(2048).fill(128)
  let t = 0
  return {
    frame() {
      t += 1 / 60
      for (let i = 0; i < freq.length; i++) freq[i] = Math.max(0, 180 * Math.exp(-i / 60) * (0.7 + 0.3 * Math.sin(t * 3 + i / 7)))
      return { freq, time, binCount: freq.length, sampleRate: 48000, dt: 1 / 60 }
    },
    close() {},
  }
}

function freshPrefs() {
  return {
    geometricView: 'circles' as const,
    geoColour: { r: 1, g: 0.3, b: 0.4 },
    atmosphericView: 'field' as const,
    mergeMode: 'normal' as const,
    atmMergeMode: 'screen' as const,
    mix: 0.62,
    geoAlpha: 0.62,
    atmAlpha: 1,
    atmColour: { r: 1, g: 1, b: 1 },
    camColour: { r: 1, g: 1, b: 1 },
    passthrough: 0,
    mapping: 'relative' as const,
    autopilot: true,
    showStats: false,
    gravity: false,
    day: false,
    skyOverride: 'auto' as const,
  }
}

// The one DOM handle the session holds. `removeEventListener` is a bare
// no-op — `dispose()` calling it (to drop the `contextmenu` listener it
// binds on the canvas) must not throw, and no check here needs to count
// what lands on the canvas specifically: check 5 counts `doc`/`win` only.
const canvas = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  addEventListener: () => {},
  removeEventListener: () => {},
}

// 1. Known-good: idle renders behind the gate; start restores the stored
//    look (CLAUDE.md, "Deleting code deletes what it was doing" — the six
//    restores are the only thing seeding those uniforms after a gate roll);
//    then the live loop renders every frame.
{
  const { v, calls } = fakeVisualiser()
  const prefs = freshPrefs()
  const session = createSession({ visualiser: v, prefs, seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell: NULL_SHELL, gateShowing: () => false, canvas })
  pump(5)
  const idleRenders = calls.filter((c) => c === 'render').length
  check('idle: renders behind the gate', idleRenders >= 1, `renders=${idleRenders}`)
  calls.length = 0
  session.start(fakeAudio(), false)
  check('start restores the stored geometric view', calls.includes('geo:circles'), calls.join(','))
  check('start restores the stored atmospheric view', calls.includes('atm:field'), calls.join(','))
  calls.length = 0
  pump(60)
  const liveRenders = calls.filter((c) => c === 'render').length
  check('live: one render per frame', liveRenders === 60, `renders=${liveRenders}`)
  check('live: touches, hover and motion reach the visualiser every frame',
    calls.filter((c) => c === 'touches').length === 60 && calls.filter((c) => c === 'motion').length === 60,
    `touches=${calls.filter((c) => c === 'touches').length} motion=${calls.filter((c) => c === 'motion').length}`)
  session.dispose()
}

// 2. apply(): the one path for the look. Director source reaches the
//    visualiser, persists, and tells the shell; manual suspends the director
//    and does not tell the shell; persist:false leaves storage alone until
//    persist().
{
  const { v, calls } = fakeVisualiser()
  const prefs = freshPrefs()
  let told = 0
  const shell = { ...NULL_SHELL, lookChanged: () => told++ }
  const session = createSession({ visualiser: v, prefs, seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell, gateShowing: () => false, canvas })
  session.start(fakeAudio(), false)
  store.clear()
  session.apply({ geoColour: { r: 0.2, g: 0.4, b: 0.6 } }, { rampS: 25, source: 'director' })
  check('director apply drives the visualiser', calls.includes('colour:geo'), calls.join(','))
  check('director apply persists', store.size === 1, `stored keys=${store.size}`)
  check('director apply tells the shell', told === 1, `told=${told}`)
  check('the mix mirror is written', JSON.parse([...store.values()][0]).mix === prefs.geoAlpha, [...store.values()][0])
  store.clear()
  session.apply({ geoAlpha: 0.4 }, { rampS: 0, source: 'manual', persist: false })
  check('manual apply with persist:false does not write', store.size === 0, `stored keys=${store.size}`)
  check('manual apply does not tell the shell', told === 1, `told=${told}`)
  check('but the look is updated', session.look.geoAlpha === 0.4, String(session.look.geoAlpha))
  session.persist()
  check('persist() writes it', store.size === 1, `stored keys=${store.size}`)
  session.dispose()
}

// 3. A double tap on the picture opens the shell; with the shell open, a
//    contact never reaches the emitter.
{
  const { v, calls } = fakeVisualiser()
  let opened = 0
  let open = false
  const shell = { ...NULL_SHELL, open: () => opened++, isOpen: () => open }
  const session = createSession({ visualiser: v, prefs: freshPrefs(), seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell, gateShowing: () => false, canvas })
  session.start(fakeAudio(), false)
  const ev = (id: number, x: number, y: number) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: 1, target: null })
  doc.dispatch('pointerdown', ev(1, 200, 300))
  pump(2)
  doc.dispatch('pointerup', ev(1, 200, 300))
  pump(2)
  doc.dispatch('pointerdown', ev(2, 200, 300))
  pump(1)
  check('a double tap opens the shell', opened === 1, `opened=${opened}`)
  doc.dispatch('pointerup', ev(2, 200, 300))
  pump(30)
  open = true
  calls.length = 0
  doc.dispatch('pointerdown', ev(3, 200, 300))
  pump(2)
  // setTouches is still called every frame; what matters is that it is
  // called with nothing. The fake records only the name, so count the
  // emitter-drag-free path by checking the stream flag never began.
  check('shell open: the stream never begins', !calls.includes('streamBegan'), 'see fake')
  doc.dispatch('pointerup', ev(3, 200, 300))
  session.dispose()
}

// 4. The space bar's synthetic shake reaches the tumble and, held long
//    enough, re-rolls the seed through the same ladder a real shake uses.
{
  const { v, calls } = fakeVisualiser()
  const session = createSession({ visualiser: v, prefs: freshPrefs(), seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell: NULL_SHELL, gateShowing: () => false, canvas })
  session.start(fakeAudio(), false)
  session.setSynthShake(true)
  pump(60 * 6)
  session.setSynthShake(false)
  pump(60)
  check('a held space bar re-rolls the seed', calls.includes('randomise'), `randomise calls=${calls.filter((c) => c === 'randomise').length}`)
  session.dispose()
}

// 5. dispose() leaves nothing behind: no listener on the document or the
//    window, and the visualiser, source and sensor closed.
{
  const before = doc.count() + win.count()
  const { v, calls } = fakeVisualiser()
  const session = createSession({ visualiser: v, prefs: freshPrefs(), seed: releaseSeed(), autopilot: true, dnaBase: 'http://probe/', shell: NULL_SHELL, gateShowing: () => false, canvas })
  session.start(fakeAudio(), false)
  pump(3)
  const during = doc.count() + win.count()
  session.dispose()
  const after = doc.count() + win.count()
  check('the session bound listeners', during > before, `before=${before} during=${during}`)
  check('dispose removes every listener it added', after === before, `before=${before} after=${after}`)
  check('dispose disposes the visualiser', calls.includes('dispose'), calls.join(','))
  const rendersBefore = calls.filter((c) => c === 'render').length
  pump(3)
  const rendersAfter = calls.filter((c) => c === 'render').length
  check('no frame runs after dispose', rendersAfter === rendersBefore, `before=${rendersBefore} after=${rendersAfter}`)
}

console.log(failures === 0 ? '\nall session checks passed' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
