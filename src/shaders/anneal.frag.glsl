// "Anneal" — an atmospheric-layer programme, docs/todo.md entry 140.
//
// A sheet of stressed glass between crossed polarisers: the oily rainbow
// fringes of photoelasticity (isochromatics — bands of equal retardation,
// which is to say equal stress) and the dark brushes that sweep across them
// wherever the local stress axis lines up with a polariser (isoclinics —
// bands of equal angle, an entirely separate phenomenon from the colour).
// Against the registry's own principles (views.ts:112, and the header
// entries 138 and 139 sit beside) this is the third new one: a material
// under load, where Umbra occludes and Filings has topology.
//
// **The documented exception to this layer's own colour contract.** Every
// other atmospheric shader here draws for `atmColour` to multiply on top —
// entries 138 and 139 both say so, having each had to correct a first draft
// that assumed the opposite (geometric layer) convention. This one is
// different on purpose: fringe order *is* the stress measurement, and the
// sequence from black through yellow, red, blue and green is the readout,
// not a palette. Filtering it to one hue would be showing stress with the
// stress removed. `uAtmColour` still multiplies on top at composite, same as
// always — a user who kills a channel still gets their filter — but what it
// multiplies is this shader's own physically-motivated colour, not white.
//
// The colour comes from the same identity a real crossed-polariser rig uses:
// transmitted intensity per wavelength is sin²(π · retardation / wavelength).
// Red, green and blue see the same physical retardation at three different
// effective periods (redder light, longer wavelength, fewer cycles per unit
// of retardation) — three sin² terms in a fixed ratio, not three unrelated
// palette frequencies, which is what makes zero retardation come out black
// (every channel's sin² is 0 at 0) and high retardation wash toward grey (the
// three channels desynchronise and average out) exactly the way the real
// phenomenon does, rather than a designer's approximation of it.

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uTime;
uniform float uFlow;
uniform float uLevel;
uniform float uRoughness;
uniform float uBreak;
uniform vec4 uSeed;

// Only the audio half of the shared ripple buffer — Decided's own "uTransient
// is a hammer blow", built the way every other entry from this recon batch
// builds a travelling front: from uRipples' own birth times rather than the
// instantaneous uTransient value, because a wave that should be seen moving
// across several frames needs to know *when* it started, which only a real
// timestamp carries. scene.ts's updateRipples() edge-triggers a spawn here
// the same way it does for every geometric view, so this reacts to a real
// transient crossing, not to whatever the raw signal happens to read on one
// given frame.
const int AUDIO_RIPPLES = 8;
uniform vec4 uRipples[AUDIO_RIPPLES];

const float PI = 3.14159265359;
const int LOAD_COUNT = 3;

// Wavelength ratios, red:green:blue, from real visible-light wavelengths
// (~650:550:450nm) inverted to frequency — blue completes more cycles than
// red for the same physical retardation, which is the actual reason the
// fringe sequence is a rainbow and not a single colour cycling through grey.
const float FREQ_R = 1.0;
const float FREQ_G = 1.18;
const float FREQ_B = 1.44;

// How much stress (in the same units the colour formula reads) a load
// contributes, and how close a pixel can get to one before that is clamped —
// same softened-singularity lesson entries 138 and 139 both needed: an
// unsoftened 1/r term crowds fringes to sub-pixel spacing right at a load and
// aliases, and Decided's own risk here is specifically "must not look like
// Fringe", so an aliased mess at a concentrator is the last thing this view
// can afford.
const float LOAD_STRENGTH = 0.14;
const float LOAD_EPS = 0.05;

// The background shear alone, in silence — Identity when off's "a few wide
// fringes", not a blank sheet.
const float SHEAR_AMOUNT = 0.9;

// The hammer blow: front speed and width, matching Umbra's own WAVE_SPEED/
// WAVE_SIGMA naming and reasoning.
const float WAVE_SPEED = 0.5;
const float WAVE_SIGMA = 0.07;
const float WAVE_AMOUNT = 0.9;

// How fast the polariser axis this view is judged against turns — Decided's
// own "isoclinic brushes rotate on uFlow", the slow second motion that keeps
// a static passage alive.
const float ISOCLINIC_RATE = 0.05;
const float ISOCLINIC_WIDTH = 0.10; // radians either side of alignment
const float ISOCLINIC_DEPTH = 0.75; // how dark the brush gets at exact alignment

float hash11(float x) {
  return fract(sin(x * 127.1) * 43758.5453123);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y);
}

/** The stress field's own scalar magnitude at `uv` — background shear plus
 *  however many point loads are currently pressing on the sheet. Everything
 *  the colour and the isoclinic angle below are both derived from this one
 *  function, which is what keeps the two phenomena visibly registered to the
 *  same underlying stress rather than drawn independently. */
float stressAt(vec2 uv) {
  float shearAngle = uSeed.x * PI;
  float n = SHEAR_AMOUNT * (uv.x * cos(shearAngle) + uv.y * sin(shearAngle));

  for (int i = 0; i < LOAD_COUNT; i++) {
    float fi = float(i);
    float seedBase = fi / float(LOAD_COUNT) + 0.3 * hash11(uSeed.y * 53.0 + fi * 11.3);
    float radius = mix(0.12, 0.34, hash11(fi * 7.1 + 1.0));
    vec2 load = radius * vec2(cos(seedBase * 2.0 * PI), sin(seedBase * 2.0 * PI));
    float dist = length(uv - load);
    n += LOAD_STRENGTH * uLevel / sqrt(dist * dist + LOAD_EPS * LOAD_EPS);
  }

  return n;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);

  float n = stressAt(uv);

  // The hammer blow, from the first load's own position — a real travelling
  // compression, not a global brightening: max() across slots rather than a
  // sum, this layer's own habit whenever more than one hit could otherwise
  // overlap and blow past any sensible range.
  float loadAngle0 = 0.3 * hash11(uSeed.y * 53.0 + 0.0);
  vec2 load0 = mix(0.12, 0.34, hash11(1.0)) * vec2(cos(loadAngle0 * 2.0 * PI), sin(loadAngle0 * 2.0 * PI));
  float distToLoad0 = length(uv - load0);
  float wave = 0.0;
  for (int i = 0; i < AUDIO_RIPPLES; i++) {
    float birth = uRipples[i].x;
    float level = uRipples[i].y;
    float age = uTime - birth;
    if (age < 0.0) continue;
    float front = WAVE_SPEED * age;
    float delta = distToLoad0 - front;
    wave = max(wave, level * exp(-(delta * delta) / (WAVE_SIGMA * WAVE_SIGMA)));
  }
  n += WAVE_AMOUNT * wave;

  // Jaggedness, not amplitude: a small, zero-mean perturbation so a sweep of
  // uRoughness roughens the contours' own edges without shifting how many of
  // them a line crosses — Done-when's own "changes contour smoothness
  // without changing band count", checked directly against this line rather
  // than assumed from a small-amplitude argument alone. 0.10 was tried first
  // and, measured the same way Done-when does (crossings of a fixed row's own
  // mean), added two spurious crossings at full roughness — enough to read as
  // a band-count change, not only a smoothness one. 0.05 keeps the visible
  // jaggedness (a fixed row's second-difference sum still rises by a third
  // from calm to full) without adding a crossing at either end of the sweep.
  // Clamped at the point of use per Decided: this project's own convention
  // hands back an out-of-band value to mean "no answer" (CLAUDE.md's
  // spectralFlatness at -1 on silence), and an unclamped negative here would
  // invert the jaggedness in exactly the room nothing was tested with music
  // playing.
  float rough = clamp(uRoughness, 0.0, 1.0);
  n += rough * 0.05 * (noise(uv * 9.0 + vec2(uFlow * 0.03)) - 0.5);

  // Isochromatics: the physical sin² identity described in the file header,
  // one call per channel at its own wavelength-derived frequency.
  vec3 col = vec3(
    sin(PI * n * FREQ_R) * sin(PI * n * FREQ_R),
    sin(PI * n * FREQ_G) * sin(PI * n * FREQ_G),
    sin(PI * n * FREQ_B) * sin(PI * n * FREQ_B));

  // Isoclinics: wherever the local stress axis (the gradient of the same
  // stress field, screen-derivative rather than a second evaluation of
  // stressAt at an offset point, since this is exactly the "hold width
  // constant" job fwidth already exists for) lines up with the rotating
  // polariser, the brush goes dark — a real second phenomenon, independent
  // of retardation magnitude, which is what makes a static passage still
  // read as glass under load rather than a fixed rainbow.
  vec2 gradN = vec2(dFdx(n), dFdy(n));
  float theta = atan(gradN.y, gradN.x);
  float polariser = uFlow * ISOCLINIC_RATE;
  // Period pi/2: a stress axis and its own 90-degree rotation are optically
  // identical between crossed polarisers, so the brush repeats twice as fast
  // as a full turn of theta.
  float rel = mod(theta - polariser, PI * 0.5);
  float distToAxis = min(rel, PI * 0.5 - rel);
  float brush = ISOCLINIC_DEPTH * (1.0 - smoothstep(0.0, ISOCLINIC_WIDTH, distToAxis));
  col *= 1.0 - brush;

  // House convention: a break desaturates rather than dims, so a drop reads
  // as the colour draining instead of the picture failing.
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(luma) * 0.7, uBreak * 0.8);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
