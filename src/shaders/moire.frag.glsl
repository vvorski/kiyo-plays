// "Moiré" — a geometric-layer programme, docs/todo.md entry 136.
//
// Every other view here draws a handful of rings and answers "what does a hit
// look like" with the rings themselves. This is hundreds of rings, and the
// picture is not the circles but what happens *between* them: two dense
// fields of concentric hairlines, centred on two different points, beat
// against each other into hyperbolic bands of light and dark that sweep the
// frame the instant either centre moves. That is the axis this view explores
// and none of the other eight do — not a new mark (it is still a hairline
// ring, Circles' own idiom at its thinnest) but a *second emitter permanently
// alive*, so the interaction is not "watch a hit arrive" but "move a centre
// and watch the whole picture reorganise".
//
// Field A rings about uOrigin, the frame's own hanging centre (entry 132) and
// the audio's home, same as every other view here. Field B rings about `c`,
// a second centre that a held finger *is* — not nudges, not orbits, but
// becomes, for as long as contact holds (see the live-finger derivation
// below) — and that springs back to a fixed rest point once the finger lifts.
// Two fields, not three: a third was worked out on paper before writing any
// GLSL and abandoned there. Three pairwise beats interfere with each other
// and the result reads as a fine grey texture with no legible bands at
// all — moiré needs exactly two combs to produce one clean interference
// pattern; a third comb adds a second, incommensurate one on top of it, and
// two interference patterns superposed is indistinguishable from noise. One
// pair is the rule. **Mine.**
//
// No live finger uniform reaches a phone (entry 112 — uPointer is mouse-only
// and stays at 0 presence on touch), so the second centre has to be found in
// uRipples' own touch band the way every other entry from this recon batch
// does it: uRipples[AUDIO_RIPPLES..MAX_RIPPLES) holds sixteen (birth, level,
// x, y) touch slots (ripples.ts), refreshed every 0.15s a finger is down or
// every 0.05uv it moves (emitter.ts), and kept alive for a further 2-4s
// afterlife once it lifts. The slot with the largest birth time is whichever
// touch happened most recently; if that birth is under LIVE_WINDOW seconds
// old, a finger (or its still-falling afterlife) is refreshing it *right
// now*, and c can simply be that slot's own (x, y) — the cheapest possible
// interaction this layer could offer, one vec2, and the largest visible
// change any view here has to a finger, because every pixel of field B reads
// off it.
//
// White and hard-edged like the rest of the layer; colour is an RGB filter
// applied to the finished frame afterwards (see geo-colour.ts). Hairlines,
// not bands: a moiré pattern is a hairline phenomenon by construction — widen
// the strokes to Circles' own OUTER_STROKE and the individual rings blur into
// a uniform grey before they ever get close enough to beat, which is exactly
// the failure a "thicken it so it reads better on a phone" instinct would
// produce. **Mine.**

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
// The idle creep (see REST_ANGLE below) and nothing else — this view has no
// use for uLevel/uLow/uMid/uHigh: the picture already answers to a hit
// through the spacing wave below, which reads uRipples directly rather than
// a smoothed band.
uniform float uFlow;
uniform float uBreak;
uniform vec4 uSeed;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
// Twenty-four: eight audio, sixteen touch — see ripples.ts.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
uniform vec4 uRipples[MAX_RIPPLES];
uniform vec2 uOrigin; // docs/todo.md entry 132 — the geometric centre, hanging under gravity

const float TAU = 6.28318530718;

// Ring spacing, in the same uv units as everything else here (half the short
// screen dimension is 1.0). A re-roll picks anywhere in [0.024, 0.04] — the
// coarse-versus-fine character of the whole view, per Decided. Below 0.024 the
// hairlines start aliasing against each other before they ever get near a
// second centre; above 0.04 there are too few rings across the frame for a
// beat pattern to read as anything but "two sets of circles overlapping".
const float SPACING_MIN = 0.024;
const float SPACING_MAX = 0.04;

// Field B's rest point: a fixed offset from uOrigin, distance in [0.1, 0.2]
// uv and any angle, both from uSeed so a re-roll moves it. Far enough from
// centre that the beat is visible immediately at rest (a rest point at 0
// would make the two fields identical and produce no moiré at all); close
// enough that a whole field of hairlines around it stays on screen rather
// than mostly off the near edge.
const float REST_RADIUS_MIN = 0.10;
const float REST_RADIUS_MAX = 0.20;

// uFlow rad/s the rest point orbits uOrigin at, in silence — Decided's own
// figure. uFlow is the audio's motion clock (see field.frag.glsl and
// drift.frag.glsl's own comments on it), not uTime, so a silent room holds
// the bands still and a loud one creeps them — the same "still air, still
// water" idiom Aurora and Caustics already use uFlow for.
const float CREEP_RATE = 0.05;

// Seconds since a touch slot's own birth below which it counts as "a finger
// is holding it right now" rather than "stale and springing back" — the
// recon's own number (entries 134-136): a held finger refreshes its slot
// every 0.15s, so anything under twice that gap is still being renewed.
const float LIVE_WINDOW = 0.3;

// The spacing wave a hit sends through its own field — see WAVE_AMP/
// WAVE_SIGMA below, and Decided's own "spacing wave over a brightness pulse":
// the layer is drawn, not lit, so a hit changing geometry (how far apart the
// rings are) is in the layer's own vocabulary in a way a glow never could be.
const float WAVE_SPEED = 0.6; // uv/s — the front's own travel speed
const float WAVE_SIGMA = 0.06; // uv — width of the bunch-and-spread zone
const float WAVE_AMP = 0.25; // fractional stretch to spacing at the wave's peak

// The spring c takes back to its rest point once a touch slot goes stale.
// Underdamped with one clearly visible overshoot and settled well inside 2s:
// zeta=0.7, wn=4 rad/s puts the decay envelope at e^(-2.8t) and the ringing
// at 2.86 rad/s, so successive overshoots differ by e^(-2.8*pi/2.86) ~= 0.05
// — the second overshoot is a twentieth the size of the first, which reads as
// "one overshoot" to the eye — and by t=1.5s the envelope is at e^-4.2 ~=
// 0.015 of its start, comfortably settled before Done-when's 2s bound.
// Over-damped (no overshoot at all) was the obvious safe choice and was tried
// first: it reads as the pattern merely sliding to a stop, which loses the
// one thing Decided asks the release to have that simply staying put would
// not — "the spring is what makes the release a gesture rather than a drop".
// **Mine.**
const float SPRING_ZETA = 0.7;
const float SPRING_WN = 4.0;

// A hard-edged hairline at the nearest ring to `dist`, roughly one pixel
// wide. `spacing` varies per-pixel (the wave above stretches it locally), so
// this reads the ring nearest *this* pixel's own local spacing rather than a
// fixed global ladder — which is what lets the bunch-and-spread wave actually
// move rings rather than merely dimming them.
//
// Half-width px*0.5, not Circles' OUTER_STROKE-scaled band: Decided is
// explicit that this is a hairline phenomenon, and a stroke any heavier
// merges adjacent rings into a grey wash well before they are dense enough to
// beat against a second field.
float ringAt(float dist, float spacing, float px) {
  float k = floor(dist / spacing + 0.5); // rounding, not floor — see circles.frag.glsl's own note on the same line
  float r = k * spacing;
  float d = abs(dist - r) - px * 0.5;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float px = 1.0 / min(uResolution.x, uResolution.y);

  float spacing = mix(SPACING_MIN, SPACING_MAX, uSeed.w);

  // --- field A: about the frame's own hanging centre, audio-driven --------

  float distA = length(uv - uOrigin);

  // The spacing wave audio hits send through field A. max(), not +=ing the
  // eight — Grid's own fronts filled solid white this same way; a wave is a
  // local stretch to spacing, and two overlapping stretches should read as
  // whichever is stronger here, not their sum, or a busy passage inflates
  // the local spacing without bound.
  float bumpA = 0.0;
  for (int i = 0; i < AUDIO_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float level = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0) continue;
    float front = WAVE_SPEED * age;
    float delta = distA - front;
    bumpA = max(bumpA, level * exp(-(delta * delta) / (WAVE_SIGMA * WAVE_SIGMA)));
  }
  float spacingA = spacing * (1.0 + WAVE_AMP * bumpA);

  // --- field B: about `c`, the finger's own centre -------------------------

  // The rest point orbits uOrigin slowly on uFlow — see CREEP_RATE. Computed
  // from the *current* uFlow throughout, including while the spring below is
  // chasing it: the creep is slow enough (0.05 rad/s against a ~1.5s spring)
  // that treating it as stationary during the spring's own short window is a
  // sub-two-degree approximation, well under anything the eye resolves at the
  // spring's own radius.
  float restAngle = uSeed.x * TAU + uFlow * CREEP_RATE;
  float restRadius = mix(REST_RADIUS_MIN, REST_RADIUS_MAX, uSeed.z);
  vec2 restC = uOrigin + restRadius * vec2(cos(restAngle), sin(restAngle));

  // One pass over the touch band does three things at once, for the cost
  // Decided's own budget names: finds the most recently written slot (the
  // live-finger derivation, entry recon shared by 134-136), reads its
  // position for the spring below, and folds in every touch hit's own
  // spacing wave on field B — each measured from *that hit's own* origin,
  // not from wherever `c` currently sits, so a tap anywhere on the glass
  // sends the pattern rippling from there even though it did not move `c`.
  float bumpB = 0.0;
  float latestBirth = -1000.0;
  vec2 latestXY = vec2(0.0);
  for (int i = AUDIO_RIPPLES; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float level = uRipples[i].y;
    vec2 xy = uRipples[i].zw;

    if (birth > latestBirth) {
      latestBirth = birth;
      latestXY = xy;
    }

    float age = uTime - birth;
    if (age < 0.0) continue;
    float front = WAVE_SPEED * age;
    float delta = length(uv - xy) - front;
    bumpB = max(bumpB, level * exp(-(delta * delta) / (WAVE_SIGMA * WAVE_SIGMA)));
  }

  float heldAge = uTime - latestBirth;
  // Damped-oscillator return, zero'd out below LIVE_WINDOW rather than
  // gated with a branch that would pop `c` at the boundary: at t=0 (the
  // instant a slot goes stale) decay(0) = 1 exactly, so c = latestXY —
  // bit-identical to the live branch's own value the frame before — and it
  // relaxes to restC from there with no visible seam at the handover.
  float t = max(0.0, heldAge - LIVE_WINDOW);
  float wd = SPRING_WN * sqrt(1.0 - SPRING_ZETA * SPRING_ZETA);
  float a = SPRING_ZETA * SPRING_WN;
  float decay = exp(-a * t) * (cos(wd * t) + (a / wd) * sin(wd * t));
  vec2 c = heldAge < LIVE_WINDOW ? latestXY : restC + (latestXY - restC) * decay;

  float distB = length(uv - c);
  float spacingB = spacing * (1.0 + WAVE_AMP * bumpB);

  // --- the beat -------------------------------------------------------------

  float ringA = ringAt(distA, spacingA, px);
  float ringB = ringAt(distB, spacingB, px);
  // max(), not a sum or a screen — Decided's own "combined with max()": the
  // two fields are meant to beat by *sitting on top of* one another, not by
  // adding brightness, and a sum here saturates to solid white wherever two
  // rings from the two fields happen to cross, which is exactly the busiest,
  // most interesting part of the pattern and the last place that should turn
  // solid.
  float ink = max(ringA, ringB);

  // A break thins the ink rather than draining colour — there is none here.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
