// "Chorus" — a geometric-layer programme, and the second variation on Circles.
//
// Same ring as Circles, same growth, same double stroke; the emitter is what
// differs. Instead of one origin at the centre there are several, spaced
// evenly around a circle, and each transient fires exactly one of them. Rings
// from different nodes are the same size at the same age, so where two
// families overlap their fronts cross at a shallow angle and produce the
// lens-shaped interference this view exists for. Drift gets crossings too, but
// from a single origin sliding between hits; here the origins are fixed and
// far apart, so the crossings are wide and symmetric rather than incidental.
//
// Which node fires is hashed from the ring's birth time, for the same reason
// Drift derives its path from birth: uRipples carries only (birthTime,
// birthLevel), so a ring's origin has to be recoverable from its birth alone
// or it will move underneath itself as it ages. Hashing the birth also beats
// the obvious alternative of using the loop index — uRipples is a ring buffer
// whose cursor advances one slot per spawn (ripples.ts), so indexing by slot
// would walk the nodes in strict rotation and a steady beat would draw a
// tidy carousel instead of anything colliding.
//
// White and hard-edged like the rest of the layer; colour is an RGB filter on
// the finished layer (see geo-colour.ts).

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform float uLow;
uniform float uBreak;
// docs/todo.md entry 96 — the moon's own abundance, over ripple reach
// and lifespan only (colour stays the sun's alone). 1.0 at new moon or
// moon-down, identical to today; scene.ts is the only writer.
uniform float uMoonReach;
uniform float uMoonLife;
// docs/todo.md entry 106 -- the moon third quality, over the opacity
// envelope only (never the growth curve -- see FADE_FROM own comment).
// 0 at new moon, full moon or moon-down, identical to today; signed,
// added directly to FADE_FROM at every place this shader reads it.
uniform float uMoonBloom;

// Must match MAX_RIPPLES in ripples.ts — GLSL can't import a JS constant, and
// a mismatch here means scene.ts uploads an array of the wrong length.
//
// Twenty-four since docs/todo.md entry 57: eight audio slots as before,
// plus sixteen reserved for touch, up from four — see ripples.ts.
const int MAX_RIPPLES = 24;
const int AUDIO_RIPPLES = 8;
uniform vec4 uRipples[MAX_RIPPLES];
uniform vec2 uOrigin; // docs/todo.md entry 132 — the geometric centre, hanging under gravity
// docs/todo.md entry 146 — the node ring itself, as offsets from `uOrigin`,
// uploaded from scene.ts rather than computed here from `uSeed`: a drag
// moves one node off the seeded arrangement, and scene.ts's own hit-test
// needs to agree with this shader about where every node actually is, which
// only holds if there is exactly one place the positions are computed.
// Eight slots — `uNodeCount` is never more, `chorusNodeOffsets`'s own
// ceiling in origin.ts — `uNodeCount` says how many are real.
const int MAX_NODES = 8;
uniform vec2 uNodes[MAX_NODES];
uniform int uNodeCount;

const float LIFESPAN = 3.2;
const float FADE_FROM = 0.6;

// Circles' proportions, unchanged — the variation is in the emitter alone.
const float OUTER_STROKE = 0.22; // of radius
const float INNER_STROKE = 0.09; // of the outer radius
const float INNER_RADIUS = 0.70; // of radius

// Cheap scalar hash. It only has to decorrelate two birth times, and the
// spawn cooldown in ripples.ts guarantees they differ by at least 0.28 s,
// which is some 35 radians into the sine — plenty.
float hash(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

float ring(float dist, float radius, float halfWidth, float px) {
  float d = abs(dist - radius) - halfWidth;
  return 1.0 - smoothstep(0.0, px * 1.5, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 halfExtent = 0.5 * uResolution / min(uResolution.x, uResolution.y);
  float maxRadius = max(halfExtent.x, halfExtent.y) * uMoonReach;
  // docs/todo.md entry 96 — same abundance scaling as Circles.
  float lifespan = LIFESPAN * uMoonLife;
  // docs/todo.md entry 106 -- computed once for the same reason lifespan
  // above is: every opacity test below reads it. Waxing raises it (stays
  // full almost to the rim, then fades quickly); waning lowers it (fades
  // almost immediately, trailing off for most of the ring travel).
  float fadeFrom = FADE_FROM + uMoonBloom;

  // docs/todo.md entry 146 — node count and positions arrive as `uNodes`/
  // `uNodeCount` now (scene.ts's own `chorusNodeOffsets`, seeded exactly as
  // this used to compute inline — three to seven nodes, a re-roll choice).
  // The ceiling is set by the buffer, not by the geometry: only eight rings
  // can be alive at once, so past seven nodes a run of hits mostly lights
  // each node once and nothing meets a neighbour's front.
  float ink = 0.0;

  // docs/todo.md entry 122 — an ink budget for touch rings, same finding and
  // identity as Circles' own touch loop: a drag's sixteen slots at ≥0.74
  // opacity flood the frame solid; 1/sqrt(n) holds total ink energy constant
  // instead. Counted here (touch slots only, same `age`-alive test the loop
  // below uses) rather than handed down as a uniform, for the same reason
  // `lifespan` above is computed once per-shader: it differs with
  // `uMoonLife`, so TypeScript cannot know "alive" exactly. Exactly 1.0 for
  // a lone ring, and audio rings (`i < AUDIO_RIPPLES`) are never counted or
  // weighted, so a single tap or an audio-only frame is bit-identical.
  float touchAlive = 0.0;
  for (int i = AUDIO_RIPPLES; i < MAX_RIPPLES; i++) {
    float aliveAge = uTime - uRipples[i].x;
    if (aliveAge >= 0.0 && aliveAge <= lifespan) touchAlive += 1.0;
  }
  float touchWeight = inversesqrt(max(touchAlive, 1.0));

  for (int i = 0; i < MAX_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float birthLevel = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0 || age > lifespan) continue;

    // docs/todo.md entry 33: a touch ring fires the nearest of the fixed
    // nodes rather than an arbitrary hashed one — the finger is an
    // *influence* on which origin fires, not a new origin of its own, since
    // this view's identity is its ring of fixed nodes. docs/todo.md entry
    // 146 replaces the closed-form nearest (exact only while every node sits
    // at its seeded angle) with a real loop over `uNodes`, since a dragged
    // node breaks the even spacing the old shortcut relied on — the same
    // structural change `origin.ts`'s own `pickNode` made on the CPU side,
    // done here for the shader's own copy of "which node is nearest".
    int origin_i = 0;
    if (i < AUDIO_RIPPLES) {
      origin_i = int(floor(hash(birth) * float(uNodeCount)));
    } else {
      float nearest = 1.0e9;
      for (int j = 0; j < MAX_NODES; j++) {
        if (j >= uNodeCount) break;
        float d = distance(uRipples[i].zw, uOrigin + uNodes[j]);
        if (d < nearest) {
          nearest = d;
          origin_i = j;
        }
      }
    }
    // docs/todo.md entry 132 — the whole node ring hangs with the geometric
    // centre; entry 146 lets a dragged node also move independently within
    // it, and the figure otherwise still translates as one.
    vec2 origin = uOrigin + uNodes[origin_i];
    float dist = length(uv - origin);

    float percent = age / lifespan;
    float radius = maxRadius * percent;

    float opacity = percent > fadeFrom ? 1.0 - (percent - fadeFrom) / (1.0 - fadeFrom) : 1.0;
    opacity *= (0.35 + 0.65 * birthLevel) * (i < AUDIO_RIPPLES ? 1.0 : touchWeight);

    float scale = 0.8 + 0.4 * birthLevel;
    float outerHalf = max(radius * OUTER_STROKE * 0.5 * scale, px * 0.5);
    float innerHalf = max(radius * INNER_STROKE * 0.5 * scale, px * 0.5);

    // docs/todo.md entry 79, applied here by /ccc at build 350. 79 named
    // circles, drift and tide and stopped there; chorus is the fourth ring
    // family and saturates the same way — more readily, in fact, since its
    // whole premise is several fronts crossing each other. The node dots
    // below keep `+=`: they are the standing structure, one contribution
    // each, and Circles keeps its own ladder and centre added for the same
    // reason.
    float stroke =
      (ring(dist, radius, outerHalf, px) + ring(dist, radius * INNER_RADIUS, innerHalf, px)) *
      opacity;
    ink = 1.0 - (1.0 - ink) * (1.0 - stroke);
  }

  // The nodes themselves, so the arrangement is legible between hits and a
  // ring visibly comes *from* somewhere. docs/todo.md entry 146 replaces the
  // angular fold this used to close-form with a real loop over `uNodes` —
  // the fold was exact only while every node sat at its seeded angle, evenly
  // spaced by construction, which a drag no longer guarantees. Up to seven
  // extra length() calls per pixel is the measured cost of that.
  float dNode = 1.0e9;
  for (int j = 0; j < MAX_NODES; j++) {
    if (j >= uNodeCount) break;
    dNode = min(dNode, length(uv - (uOrigin + uNodes[j])));
  }
  float nodeR = 0.010 + 0.040 * uLow;
  ink += ring(dNode, nodeR, px * 0.9, px) * (0.22 + 0.55 * uLow);

  // A break thins the ink rather than draining colour — there is none here.
  ink *= 1.0 - uBreak * 0.55;

  gl_FragColor = vec4(vec3(clamp(ink, 0.0, 1.0)), 1.0);
}
