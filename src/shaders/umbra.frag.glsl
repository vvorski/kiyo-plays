// "Umbra" — an atmospheric-layer programme, docs/todo.md entry 138.
//
// The first view here organised around occlusion rather than emission.
// views.ts's own header names the six principles the registry has already
// claimed — cloud, symmetry, a diagram, a place, focusing, superposed waves,
// divided space — and every one of them is light being added. Nothing here
// has ever cast a shadow. This is one bright source, off-centre and always
// behind everything, and a drift of solid bodies between it and the frame:
// where a body covers the source, that part of the picture goes dark, and
// the only light left is what leaks through the gaps and what grazes each
// body's own edge on the side facing the light.
//
// Entry 138's own Decided says the shader should draw white only, "as
// everywhere else" — but that is the geometric layer's contract
// (lattice.frag.glsl:16, "everything is additive... only emission", filtered
// to colour downstream), not the atmospheric one. Every sibling here —
// caustics, aurora, field, cells, fringe — draws its own full RGB and gets
// atmColour multiplied on top at composite as an additional tint, same as
// this one. Corrected in the build note rather than followed into drawing a
// silhouette view in pure white, which would have had no eclipse to speak
// of: darkness IS this view's picture, and a luminance-only silhouette on a
// white light is a grey disc, not a shadow.
//
// The three couplings are chosen the way entry 32 asks: each has to be
// *seen* moving on its own, so each acts on a different part of the image —
// uLow is area (the bodies swell, capped so the frame can never go fully
// black), uTransient is the source (a flare through every gap at once,
// leaving the dark bodies dark), uHigh is the rim (sharper and brighter,
// never the body interior or the source itself). Bodies drift on uFlow, not
// uTime, so a silent room still turns slowly rather than freezing solid —
// the same swell-and-decay discipline every view here follows.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uFlow;
uniform float uLow;
uniform float uHigh;
uniform float uTransient;
uniform float uBreak;
uniform vec4 uSeed;

const float TAU = 6.28318530718;

// Three blobs merge into one mass — two reads as a figure-eight and reveals
// the primitive; four costs the smooth-min chain a third call for a coverage
// difference nobody could see at this frame's typical viewing distance.
const int BODY_COUNT = 3;

// Off-centre, fixed for the session (from uSeed, not uFlow) — Decided's own
// "never in front": the source's position never competes with the bodies for
// depth, only its brightness moves. A radius in [0.28, 0.42] keeps it well
// off the frame's own centre (where Lattice and Field already live) without
// pushing it so far out that a portrait frame crops it.
const float SOURCE_RADIUS_MIN = 0.28;
const float SOURCE_RADIUS_MAX = 0.42;
const float SOURCE_CORE = 0.05; // uv radius of the source's own hot centre
const float GLOW_FALLOFF = 0.62; // uv — e-folding distance of the glow field

// Each body orbits the frame's own centre, not the source — tried tying the
// orbit to the source position directly first, and at high uLow the swollen
// radius exceeded the distance between the two, so the source sat *inside*
// the merged mass permanently rather than being passed in front of. An
// independent band that overlaps the source's own radius range means a body
// crosses the source as it drifts — an event, the way an eclipse actually
// works — rather than a standing state.
const float ORBIT_RADIUS_MIN = 0.20;
const float ORBIT_RADIUS_MAX = 0.34;

// How far a blob's radius grows per unit of uLow, and the ceiling on that
// growth. A higher BASE_RADIUS with the same swell rate let three merged
// blobs cover essentially the whole frame at uLow = 1 — tried first, and it
// reads as a hard cut to black rather than an eclipse, which is
// indistinguishable from the view breaking (the same ceiling argument
// shake.ts's own MAX_ANGLE and entry 32's refusal of whole-frame scale both
// make). BASE_RADIUS_MAX is the real cap, sized against ORBIT_RADIUS above so
// even three fully swollen, fully merged bodies leave the frame's corners lit.
const float LOW_SWELL = 0.7;
const float BASE_RADIUS_MIN = 0.09;
const float BASE_RADIUS_MAX = 0.14;
const float MERGE_K = 0.09; // smooth-min blend radius — see smin() below

// A transient's flare, and the rim's own base/peak brightness and width. 0.01
// uv was tried first and is under a pixel at any resolution this actually
// renders at — invisible regardless of how bright it is set, and the reason
// the first pass of this shader read as a plain vignette with no shadow in
// it. Width still shrinks with uHigh (a sharper edge reads as more treble,
// not just a brighter one) but never below something a screen can show.
const float FLARE_AMOUNT = 1.4;
const float RIM_WIDTH_MAX = 0.052;
const float RIM_WIDTH_MIN = 0.024;
const float RIM_BASE = 1.1;
const float RIM_PEAK = 3.4;

float hash11(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

// iq's polynomial smooth minimum. k is the blend radius: two circles closer
// than k merge into one rounded mass; further apart than k they read as two
// bodies again. This is what stops the drift looking like separate bubbles
// (a lava lamp) and is the only reason a true rim is available at all — a
// smin surface has a well-defined edge everywhere, where a noise field or a
// screened sum of soft circles does not.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  float sourceAngle = uSeed.w * TAU;
  float sourceRadius = mix(SOURCE_RADIUS_MIN, SOURCE_RADIUS_MAX, uSeed.z);
  vec2 sourcePos = sourceRadius * vec2(cos(sourceAngle), sin(sourceAngle));

  float radius = mix(BASE_RADIUS_MIN, BASE_RADIUS_MAX, uSeed.y) * (1.0 + LOW_SWELL * uLow);

  // Each body: its own orbit round the frame's own centre (see ORBIT_RADIUS
  // above for why not the source's), spread a third of a turn apart plus a
  // seeded jitter so they never launch evenly spaced, and its own drift
  // rate, so the three never move in lockstep and the merge itself keeps
  // changing shape rather than just sliding.
  float d = 1000.0;
  vec2 nearestCentre = vec2(0.0);
  float nearestAbs = 1000.0;
  for (int i = 0; i < BODY_COUNT; i++) {
    float fi = float(i);
    float seedBase = fi / float(BODY_COUNT) + 0.22 * hash11(uSeed.x * 97.0 + fi * 13.7);
    float orbitAngle = seedBase * TAU + uFlow * mix(0.05, 0.11, hash11(fi * 3.1 + 1.0));
    float orbitRadius = mix(ORBIT_RADIUS_MIN, ORBIT_RADIUS_MAX, hash11(fi * 5.7 + 2.0));
    vec2 centre = orbitRadius * vec2(cos(orbitAngle), sin(orbitAngle));

    float di = length(uv - centre) - radius;
    d = smin(d, di, MERGE_K);

    // The dominant blob at this pixel — whichever raw (pre-blend) distance
    // is smallest — stands in for the local surface normal below. With
    // three softly-merged blobs this is an approximation only inside the
    // blend band itself, which is exactly where a wrong normal matters
    // least: MERGE_K's own smoothing already means no true edge exists
    // there to get wrong.
    float absDi = abs(di);
    if (absDi < nearestAbs) {
      nearestAbs = absDi;
      nearestCentre = centre;
    }
  }

  float distToSource = length(uv - sourcePos);
  float glow = exp(-distToSource / GLOW_FALLOFF) * (1.0 + FLARE_AMOUNT * uTransient);
  glow += smoothstep(SOURCE_CORE, SOURCE_CORE * 0.35, distToSource);

  vec2 normal = normalize(uv - nearestCentre);
  vec2 toSource = normalize(sourcePos - uv);
  float facing = clamp(dot(normal, toSource), 0.0, 1.0);

  float rimWidth = mix(RIM_WIDTH_MAX, RIM_WIDTH_MIN, uHigh);
  float rimShape = exp(-abs(d) / rimWidth);
  // A hard-ish window on the exponential's own long tail. Without it, two
  // bodies far enough apart to read as separate still leave a faint seam
  // exactly on the perpendicular bisector between their centres, where
  // `nearestCentre` above flips which body's normal a pixel borrows — the
  // flip itself is harmless where rimShape is near zero, which this window
  // guarantees rather than trusting the exponential to decay fast enough on
  // its own by the time a pixel is that far from any real edge.
  rimShape *= 1.0 - smoothstep(rimWidth * 1.5, rimWidth * 3.0, abs(d));
  float rim = rimShape * facing * mix(RIM_BASE, RIM_PEAK, uHigh);

  // Outside every body (d > 0): the source's own falloff, which is the gap
  // light Decided asks for — visible between bodies without any of them
  // needing to move. Inside (d < 0): none of it, full stop; the rim above is
  // what still shows there, added back in afterwards, never gated by this.
  float visible = smoothstep(0.0, 0.01, d);

  vec3 deep = vec3(0.012, 0.008, 0.02); // near-black, the body's own colour
  vec3 sourceColour = vec3(1.0, 0.86, 0.62); // warm — this is the light
  vec3 rimColour = vec3(1.0, 0.72, 0.42); // warmer still, grazing light

  vec3 col = deep + sourceColour * glow * visible + rimColour * rim;

  // House convention: a break desaturates rather than dims, so a drop reads
  // as the colour draining instead of the picture failing.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
