// "Filings" — an atmospheric-layer programme, docs/todo.md entry 139.
//
// Iron filings on glass over six magnetic poles: curved lines that run
// between sources and sinks, never drawn as dots or markers — a filings
// photograph shows the field, not the magnet. Against the registry's own
// taxonomy (views.ts:112, and entry 138's header beside it) this is a vector
// field with topology, which nothing else here has: Caustics focuses light,
// Fringe superposes two scalar waves, Field warps noise, and Umbra occludes
// one — none of them has lines that must start somewhere, end somewhere, and
// re-route entirely when a source flips to a sink.
//
// Entry 138 shipped first and found the same "draw luminance only" line in
// this entry's own Decided wrong before this one was built — that is the
// geometric layer's contract (lattice.frag.glsl:16), not the atmospheric
// one, where every sibling draws its own full RGB and gets atmColour
// multiplied on top as a tint at composite. Followed here from the start
// rather than repeating the mistake.
//
// The potential is a closed-form sum evaluated per pixel, not particles
// advected through the field — Decided's own call: particles need per-agent
// state and a feedback texture (the shape entry 110's Strata needed and was
// reverted for), where a potential is one pass with none. Six poles, one per
// band of a six-band spectrum reduction, so raising one band's energy pulls
// the field toward that pole and nowhere else — the same idiom Strings
// already uses for nine bands, at N=6 instead of 9.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uFlow;
uniform float uTilt;
uniform float uTransient;
uniform float uBreak;
uniform vec4 uSeed;
uniform sampler2D uSpectrum;

const float TAU = 6.28318530718;
const int POLE_COUNT = 6;

// How far the poles spread, driven by uTilt (Decided: "spectral tilt spreads
// them", the same slow-audio-feature-to-slow-visual-parameter pairing entry
// 130 argues for in the lattice). TIGHT is a knot near the centre;
// WIDE reaches most of a portrait frame's own half-width without poles
// drifting off it as they orbit.
const float TIGHT_RADIUS = 0.14;
const float WIDE_RADIUS = 0.50;

// Pole strength: a floor plus a spectrum-driven gain, so a silent room still
// has six weak, near-equal poles and a field to look at (Identity when off)
// rather than a blank frame waiting for the first band to wake up.
const float Q_BASE = 0.55;
const float Q_GAIN = 2.2;
const float EPS = 0.03; // minimum distance a pole's own 1/r term is evaluated at

// Contour spacing, and the fwidth-normalised line width in screen-derivative
// units. 1.0 draws a contour every unit of potential; SOFT_PX close to 1.0
// keeps the line roughly a pixel wide however steeply the potential happens
// to be changing at that pixel — Decided's own "screen-space derivative so
// they hold a constant width", the fix for the artefact CLAUDE.md's Fringe
// already had: thin near a pole and fat at the frame edge is the failure to
// hunt for, not the phenomenon.
const float SPACING = 0.42;
const float SOFT_PX = 1.1;

// Around this, the seed-chosen pole's sign flips — Decided's own signature
// event: "the entire line structure snaps and re-routes", tied directly to
// uTransient rather than any state this shader would otherwise have nowhere
// to keep, so the flip lasts exactly as long as the engine's own transient
// envelope does and reverts on its own as that decays. FLIP_BAND widens a
// hard step() (tried first) into a narrow ease: Decided's own "continuous in
// pixels" is a claim about every frame along the way, not only the frame
// before and the one after, and a real transient can sit for several frames
// near the threshold rather than jumping straight over it.
const float FLIP_THRESHOLD = 0.5;
const float FLIP_BAND = 0.06;

float hash11(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  float spread = mix(TIGHT_RADIUS, WIDE_RADIUS, uTilt);
  int flipIdx = int(mod(floor(uSeed.x * 97.0), float(POLE_COUNT)));
  float flip = smoothstep(FLIP_THRESHOLD - FLIP_BAND, FLIP_THRESHOLD + FLIP_BAND, uTransient);

  float phi = 0.0;
  float nearest = 1000.0;
  for (int i = 0; i < POLE_COUNT; i++) {
    float fi = float(i);

    // Spread a sixth of a turn apart plus a seeded jitter, same shape as
    // Umbra's own orbit placement — evenly launched poles read as a
    // deliberate ring rather than a field, and the jitter is what keeps this
    // from looking like a clock face.
    float seedBase = fi / float(POLE_COUNT) + 0.22 * hash11(uSeed.y * 61.0 + fi * 17.3);
    float driftRate = mix(0.03, 0.07, hash11(fi * 4.1 + 3.0));
    float angle = seedBase * TAU + uFlow * driftRate;
    float radiusJitter = mix(0.85, 1.15, hash11(fi * 6.3 + 5.0));
    vec2 pole = spread * radiusJitter * vec2(cos(angle), sin(angle));
    nearest = min(nearest, length(uv - pole));

    // Alternating base polarity — six poles the same sign draw only nested
    // closed rings around one blob; alternating is what gives the field real
    // topology (saddle points, lines that run between poles) from the first
    // frame, before any transient ever flips one.
    float baseSign = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float sign_ = (i == flipIdx) ? baseSign * mix(1.0, -1.0, flip) : baseSign;

    float band = (fi + 0.5) / float(POLE_COUNT);
    float energy = texture2D(uSpectrum, vec2(band, 0.5)).r;
    float q = Q_BASE + Q_GAIN * energy;

    // Plummer-softened 1/r: bounded and smooth as a pixel approaches the pole,
    // rather than the hard max(dist, EPS) tried first. That clamp still let
    // phi's *gradient* blow up right at dist == EPS — the potential itself
    // was capped but its slope was not, so the rings crowded to sub-pixel
    // spacing in a thin band around every pole and aliased into exactly the
    // "beads into dots" failure CLAUDE.md's own Fringe story warns about,
    // which for this view is worse than an artefact: Decided explicitly
    // requires poles to never read as a marker, and an aliased blob is one.
    float dist = length(uv - pole);
    phi += sign_ * q / sqrt(dist * dist + EPS * EPS);
  }

  // The standard fwidth-normalised contour: distance (in screen-derivative
  // units) to the nearest integer multiple of SPACING. Constant apparent
  // width everywhere phi is smooth.
  float f = phi / SPACING;
  float w = fwidth(f);
  float toLine = abs(fract(f - 0.5) - 0.5) / max(w, 1e-4);
  float ink = 1.0 - clamp(toLine / SOFT_PX, 0.0, 1.0);

  // Belt and braces beside the softened potential above: fade to ground
  // within a couple of EPS of whichever pole is nearest, so the one place
  // the softening still leaves a slightly denser knot of rings fades to
  // plain glass rather than to a bright smudge. This is the mask that
  // actually keeps Decided's "the poles themselves are never drawn" — the
  // potential's own softening controls aliasing, not visibility.
  ink *= smoothstep(EPS, EPS * 2.5, nearest);

  vec3 ground = vec3(0.015, 0.017, 0.03); // near-black, cold — glass in shadow
  vec3 lineColour = vec3(0.82, 0.88, 0.98); // pale, slightly cool — filings under light

  vec3 col = ground + lineColour * ink;

  // House convention: a break desaturates rather than dims, so a drop reads
  // as the colour draining instead of the picture failing.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
