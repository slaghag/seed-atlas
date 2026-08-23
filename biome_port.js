// ============================================================================
// Valheim GetBiome / GetBaseHeight — JS port, first draft
// ============================================================================
// Ported from:
//  - DUtils.PerlinNoise -> Mathf.PerlinNoise, via crazicrafter1/Avledet's
//    reverse-engineered implementation (VUtilsMath.cpp), itself Ken Perlin's
//    classic 2002 "Improving Noise" algorithm + an empirically-tuned rescale
//    to match Unity's output range. NOT confirmed byte-exact — author's own
//    words: "I have not extensively tested... but they are very similar."
//  - WorldGenerator.GetBiome / GetBaseHeight, decompiled directly from
//    assembly_valheim.dll (session 2026-08-21/22).
//
// STATUS: untested. This is a direct mechanical translation, not yet
// validated against any real game output. Do not trust results yet.
// ============================================================================

// ---- Perlin noise (ported from Avledet/VUtilsMath.cpp) ----

const PERLIN_PERM = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
  8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,
  117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,
  165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,
  105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,
  187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,
  64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,
  227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,
  221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,
  178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,
  241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,
  176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,
  128,195,78,66,215,61,156,180,
];
// Duplicate to avoid wraparound index checks (standard Perlin trick)
const P = PERLIN_PERM.concat(PERLIN_PERM);

function fade(t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

function lerp(t, a, b) {
  return a + t * (b - a);
}

function grad(hash, x, y) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/**
 * Direct port of Avledet's PerlinNoise(float x, float y).
 * NOTE: not yet validated against real Unity/Valheim output.
 */
function perlinNoise(x, y) {
  const X = Math.floor(x) & 0xff;
  const Y = Math.floor(y) & 0xff;
  x -= Math.floor(x);
  y -= Math.floor(y);

  const A = P[X] + Y;
  const B = P[X + 1] + Y;
  const AA = P[P[A]];
  const AB = P[P[A + 1]];
  const BA = P[P[B]];
  const BB = P[P[B + 1]];

  const u = fade(x);
  const v = fade(y);

  const gradAA = grad(AA, x, y);
  const gradBA = grad(BA, x - 1, y);
  const gradAB = grad(AB, x, y - 1);
  const gradBB = grad(BB, x - 1, y - 1);

  let res = lerp(v, lerp(u, gradAA, gradBA), lerp(u, gradAB, gradBB));

  // Empirically-tuned rescale from Avledet, to match Unity's output range
  res += 0.69;
  res /= 1.483;

  return res;
}

// ---- Small helpers (from DUtils, decompiled) ----

function dLength(x, y) {
  return Math.sqrt(x * x + y * y);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function dLerp(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return a * (1 - t) + b * t;
}

// WorldGenerator.WorldAngle
function worldAngle(wx, wy) {
  return Math.sin(Math.atan2(wx, wy) * 20.0);
}

// WorldGenerator.IsAshlands (constants from decompiled source)
const ASHLANDS_MIN_DISTANCE = 12000.0;
const ASHLANDS_Y_OFFSET = -4000.0;

function isAshlands(x, y) {
  const num = worldAngle(x, y) * 100.0;
  return dLength(x, y + ASHLANDS_Y_OFFSET) > ASHLANDS_MIN_DISTANCE + num;
}

// WorldGenerator.IsDeepnorth
function isDeepnorth(x, y) {
  const num = worldAngle(x, y) * 100.0;
  const len = dLength(x, y + 4000.0);
  return len > 12000.0 + num;
}

// ---- GetBaseHeight (decompiled, non-menu path only for now) ----
// NOTE: only ports the real in-game path (menuTerrain=false).
// The menu/main-menu-background path is not needed for our use case.
function getBaseHeight(wx, wy, offset0, offset1, minMountainDistance) {
  const num4 = dLength(wx, wy);
  let x = wx + 100000.0 + offset0;
  let y = wy + 100000.0 + offset1;

  let h = 0;
  // NOTE: these frequencies were confirmed 2026-08-22 against BjarkeCK/ValheimSeedFinder
  // (a real, working Unity-based reference implementation, MIT licensed). The prior
  // draft had every constant here at exactly half the real value (0.001 vs 0.002, etc.)
  // -- a transcription error, not a Unity-proprietary-noise problem. Fixing this alone
  // took ocean-boundary classification from ~60% to ~99% accuracy against real
  // valheim-map.world ground-truth data, using the same (approximate, non-Unity) JS
  // Perlin noise the whole time. Do not "simplify" these back toward the old values.
  h = h + perlinNoise(x * 0.002 * 0.5, y * 0.002 * 0.5) * perlinNoise(x * 0.003 * 0.5, y * 0.003 * 0.5) * 1.0;
  h = h + perlinNoise(x * 0.002 * 1.0, y * 0.002 * 1.0) * perlinNoise(x * 0.003 * 1.0, y * 0.003 * 1.0) * h * 0.9;
  h = h + perlinNoise(x * 0.005 * 1.0, y * 0.005 * 1.0) * perlinNoise(x * 0.01 * 1.0, y * 0.01 * 1.0) * 0.5 * h;
  h = h - 0.07;

  // Mountain-band smoothing (the "num8/num9/v/num10" block in decompiled code)
  const num8 = perlinNoise(x * 0.002 * 0.25 + 0.123, y * 0.002 * 0.25 + 0.15123);
  const num9 = perlinNoise(x * 0.002 * 0.25 + 0.321, y * 0.002 * 0.25 + 0.231);
  const v = Math.abs(num8 - num9);
  let num10 = 1.0 - lerpStep(0.02, 0.12, v);
  num10 = num10 * smoothStep(744, 1000, num4);
  h = h * (1.0 - num10);

  if (num4 > 10000) {
    const t = lerpStep(10000, 10500, num4);
    h = dLerp(h, -0.2, t);
    if (num4 > 10490) {
      const t2 = lerpStep(10490, 10500, num4);
      h = dLerp(h, -2, t2);
    }
    return h;
  }

  if (num4 < minMountainDistance && h > 0.28) {
    const t3 = clamp01((h - 0.28) / 0.1);
    h = dLerp(dLerp(0.28, 0.38, t3), h, lerpStep(minMountainDistance - 400, minMountainDistance, num4));
  }

  return h;
}

function lerpStep(l, h, v) {
  return clamp01((v - l) / (h - l));
}

function smoothStep(pMin, pMax, pX) {
  const t = clamp01((pX - pMin) / (pMax - pMin));
  return t * t * (3.0 - 2.0 * t);
}

// ---- Biome enum (subset — matches Heightmap.Biome from decompile) ----
const Biome = {
  Meadows: 'Meadows',
  Swamp: 'Swamp',
  Mountain: 'Mountain',
  BlackForest: 'BlackForest',
  Plains: 'Plains',
  AshLands: 'AshLands',
  DeepNorth: 'DeepNorth',
  Ocean: 'Ocean',
  Mistlands: 'Mistlands',
};

/**
 * GetBiome — decompiled from WorldGenerator.GetBiome(float, float, float, bool),
 * non-menu path only.
 *
 * Needs offset0, offset1, offset2, offset4 (NOT offset3/riverSeed/streamSeed —
 * those only feed height/river rendering, confirmed not used in this function).
 *
 * maxMarshDistance and minDarklandNoise are per-world-version constants from
 * VersionSetup() — using confirmed current-version defaults here (6000 / 0.4).
 * Older-version worlds used different values (8000 / 0.5) — not handled yet.
 */
function getBiome(wx, wy, offset0, offset1, offset2, offset4, oceanLevel = 0.02) {
  const num = dLength(wx, wy);
  const baseHeight = getBaseHeight(wx, wy, offset0, offset1, 1000 /* m_minMountainDistance default */);
  const num2 = worldAngle(wx, wy) * 100.0;

  if (isAshlands(wx, wy)) return Biome.AshLands;
  if (baseHeight <= oceanLevel) return Biome.Ocean;

  if (isDeepnorth(wx, wy)) {
    return baseHeight > 0.4 ? Biome.Mountain : Biome.DeepNorth;
  }

  if (baseHeight > 0.4) return Biome.Mountain;

  const maxMarshDistance = 6000; // current worldgen version default
  const minDarklandNoise = 0.4;  // current worldgen version default

  if (
    perlinNoise((offset0 + wx) * 0.001, (offset0 + wy) * 0.001) > 0.6 &&
    num > 2000 && num < maxMarshDistance &&
    baseHeight > 0.05 && baseHeight < 0.25
  ) {
    return Biome.Swamp;
  }

  if (
    perlinNoise((offset4 + wx) * 0.001, (offset4 + wy) * 0.001) > minDarklandNoise &&
    num > 6000 + num2 && num < 10000
  ) {
    return Biome.Mistlands;
  }

  if (
    perlinNoise((offset1 + wx) * 0.001, (offset1 + wy) * 0.001) > 0.4 &&
    num > 3000 + num2 && num < 8000
  ) {
    return Biome.Plains;
  }

  if (
    perlinNoise((offset2 + wx) * 0.001, (offset2 + wy) * 0.001) > 0.4 &&
    num > 600 + num2 && num < 6000
  ) {
    return Biome.BlackForest;
  }

  if (num > 5000 + num2) return Biome.BlackForest;

  return Biome.Meadows;
}

// ============================================================================
// GetHeight / GetMeadowsHeight / GetBiomeArea
// ============================================================================
// Ported from decompiled WorldGenerator method bodies confirmed by Cowork
// during the 2026-08-23 location-placement session (captured then in a
// throwaway height_port.js, never merged into this canonical file — that
// placement-prediction attempt ultimately failed and pivoted to Option C,
// but the failure was isolated to Stage 3's Random.Range/insideUnitCircle
// gap, not this height chain, so it's brought forward here unchanged).
//
// SCOPE: Meadows path only (getMeadowsHeight). GetHeight returns null for
// any other biome — callers must treat null as "can't check altitude,
// auto-pass" and flag it. This is fine for the green-zone check, since
// WoodFarm1 only ever targets Meadows anyway.
//
// APPROXIMATION carried over from the original port: AddRivers is treated
// as a no-op (the river-point generation system, m_riverPoints/GetRiverGrid,
// was never ported — rivers are a narrow linear feature, not a large area
// fraction, so this is a reasonable simplification, not a hidden one).
// ============================================================================

function getHeightMultiplier() {
  return 200.0;
}

function createAshlandsGap(wx, wy) {
  const num = worldAngle(wx, wy) * 100.0;
  const value = Math.abs(dLength(wx, wy + ASHLANDS_Y_OFFSET) - (ASHLANDS_MIN_DISTANCE + num));
  return smoothStep(0, 1, clamp01(value / 400.0));
}

function createDeepNorthGap(wx, wy) {
  const num = worldAngle(wx, wy) * 100.0;
  const value = Math.abs(dLength(wx, wy + 4000) - (12000.0 + num));
  return smoothStep(0, 1, clamp01(value / 400.0));
}

/**
 * GetMeadowsHeight — needs offset3, a dependency not used anywhere in
 * getBiome/getBaseHeight (those only need offset0/1/2/4). offset3 otherwise
 * only ever fed height/river rendering per the blueprint doc.
 */
function getMeadowsHeight(wx, wy, offset0, offset1, offset3) {
  const baseHeight = getBaseHeight(wx, wy, offset0, offset1, 1000);
  const x = wx + 100000.0 + offset3;
  const y = wy + 100000.0 + offset3;

  let num3 = perlinNoise(x * 0.01, y * 0.01) * perlinNoise(x * 0.02, y * 0.02);
  num3 = num3 + perlinNoise(x * 0.05, y * 0.05) * perlinNoise(x * 0.1, y * 0.1) * num3 * 0.5;

  let num4 = baseHeight + num3 * 0.1;
  const num5 = 0.15;
  const num6 = num4 - num5;
  const num7 = clamp01(baseHeight / 0.4);
  if (num6 > 0) {
    num4 = num4 - num6 * ((1.0 - num7) * 0.75);
  }
  // AddRivers(wx, wy, num4) approximated as identity — see note above.

  num4 = num4 + perlinNoise(x * 0.1, y * 0.1) * 0.01;
  return num4 + perlinNoise(x * 0.4, y * 0.4) * 0.003;
}

/**
 * GetHeight — real, meters-scale terrain height (distinct from
 * getBaseHeight's raw normalized noise). Meadows path only; returns null
 * for any other biome (caller must handle).
 */
function getHeight(wx, wy, offset0, offset1, offset2, offset3, offset4) {
  const biome = getBiome(wx, wy, offset0, offset1, offset2, offset4);
  const gapMultiplier = getHeightMultiplier() * createAshlandsGap(wx, wy) * createDeepNorthGap(wx, wy);
  if (dLength(wx, wy) > 10500) return -2 * getHeightMultiplier();
  if (biome === Biome.Meadows) {
    return getMeadowsHeight(wx, wy, offset0, offset1, offset3) * gapMultiplier;
  }
  return null;
}

/**
 * GetBiomeArea — exact 9-point neighbor consensus, confirmed full body.
 * Returns 'Edge' or 'Median'. NOTE: real code SUBTRACTS the sample offset
 * (point - Vector3(dx, 0, dy)), matched exactly here rather than assumed.
 * Not actually needed for the green-zone check (WoodFarm1's m_biomeArea is
 * EdgeMedian, which passes unconditionally — see project_plan.md), included
 * here anyway since it's real confirmed code and cheap to carry forward.
 */
function getBiomeArea(wx, wy, offset0, offset1, offset2, offset4) {
  const b0 = getBiome(wx, wy, offset0, offset1, offset2, offset4);
  const neighborOffsets = [[-64,-64],[64,-64],[64,64],[-64,64],[-64,0],[64,0],[0,-64],[0,64]];
  for (const [dx, dy] of neighborOffsets) {
    const b = getBiome(wx - dx, wy - dy, offset0, offset1, offset2, offset4);
    if (b !== b0) return 'Edge';
  }
  return 'Median';
}

// ============================================================================
// GetForestFactor (Fbm) — CONFIRMED literal decompile, 2026-08-23
// (fbm_terraindelta_findings.md, IL-level read of DUtils.Fbm /
// WorldGenerator.GetForestFactor / DUtils.PerlinNoise). Replaces the prior
// textbook-fbm placeholder — one real, confirmed bug fixed below, not just
// an assumption resolved.
// ============================================================================
// Confirmed call chain: GetForestFactor(pos) = Fbm(pos*0.01f*0.4f, 3, 1.6, 0.7)
//                                             = Fbm(pos*0.004, 3, 1.6, 0.7)
// Confirmed: no seed-specific offset is applied to `pos` anywhere in this
// chain — GetForestFactor is provably seed-invariant at a fixed world
// position (unlike GetBaseHeight, which adds offset0/offset1). Was
// previously "shows no offset term, so none applied here" (inferred from
// absence); now independently confirmed from the full method body itself.
//
// Confirmed: DUtils.PerlinNoise(x,y) is a direct passthrough to
// UnityEngine.Mathf.PerlinNoise(float,float) — the exact same underlying
// noise function GetBiome/GetBaseHeight already use via this file's own
// perlinNoise(). No separate noise algorithm needed here.
//
// REAL BUG FIXED: amplitude starts at 1.0, not 0.5 as the prior textbook
// assumption had it. Frequency is applied by scaling the position vector
// itself each iteration (pos *= lacunarity) rather than a separate
// frequency variable — behaviorally equivalent to before, just implemented
// differently, and confirmed to carry no 2x-style bug. The raw sum is
// returned with NO normalization (no divide by total amplitude, no clamp)
// — this means forestFactor's real range runs meaningfully higher than the
// old amplitude=0.5 version assumed (roughly up to ~2.2 at the high end
// with real Mathf.PerlinNoise output, vs ~1.1 before), so the existing
// `forestFactor ∈ [0,1]` eligibility check will now reject more points
// than it did previously — a real behavior change, not a wash. Retested
// below.
//
// NOT replicated: the decompiled body casts through double-precision
// intermediates and back to float32 after every add/multiply (IL
// conv.r8/conv.r4 on every step). JS numbers are already double-precision
// throughout, so this port is actually MORE precise per-step than the real
// float32-truncating original, not less — confirmed immaterial for a
// [0,1] threshold check. Deliberate decision not to chase float32
// rounding with Math.fround() here, especially since perlinNoise() itself
// is still an approximate (not byte-exact) Perlin port; matching float32
// truncation on top of an approximate noise function wouldn't meaningfully
// improve accuracy.
function getForestFactor(wx, wy) {
  const octaves = 3;
  const lacunarity = 1.6;
  const gain = 0.7;

  let sum = 0;
  let amplitude = 1.0;
  let px = wx * 0.004;
  let py = wy * 0.004;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * perlinNoise(px, py);
    amplitude *= gain;
    px *= lacunarity;
    py *= lacunarity;
  }
  return sum;
}

// ============================================================================
// GetTerrainDelta — CONFIRMED literal decompile, 2026-08-23
// (fbm_terraindelta_findings.md). Real signature turned out to be different
// than assumed: WorldGenerator.GetTerrainDelta(Vector3 center, float radius,
// out float delta, out Vector3 slopeDirection) — an instance method with
// TWO out-params, not a float-returning GetTerrainDelta(pos, radius). Only
// `delta` is needed for WoodFarm1's filter (m_minTerrainDelta/
// m_maxTerrainDelta); `slopeDirection` (a genuinely new finding — a unit
// vector from the lowest sampled point toward the highest) isn't used by
// any confirmed WoodFarm1 filter and isn't implemented here. Flagged, not
// hidden, in case a future filter type needs it.
//
// CONFIRMED, not approximated: 10 samples (matches the prior assumption
// exactly); delta is literally max(height) − min(height) across the 10
// samples (the max-min approximation already in this file was the right
// computation all along — now confirmed exact, not just a reasonable
// guess); height at each sample comes from the plain 2-arg
// GetHeight(wx, wy) overload — this file's real getHeight() dispatcher,
// not the getMeadowsHeight-only shortcut the prior version used (that
// shortcut skipped the Ashlands/DeepNorth gap multiplier; negligible at
// WoodFarm1's typical 500–2000m distance band where the gap ≈1.0, but
// worth fixing now that the real call site is confirmed).
//
// STILL APPROXIMATE, and permanently so: the real algorithm samples
// offsets via UnityEngine.Random.insideUnitCircle * radius, whose
// internals remain a confirmed, permanent decompilation dead end (native/
// extern, no shipped IL). This port uses a fixed ring of points instead,
// per project_plan.md's own explicit blessing — exact sample LOCATIONS
// were never going to be reproducible outside Unity; the computation done
// on them is what's now confirmed above.
//
// NEW EDGE CASE from switching to the real getHeight() dispatcher: it
// returns null for non-Meadows biomes (this file's own known, pre-existing
// scope limit). WoodFarm1's exteriorRadius is only 32m, so nearly every
// sample lands back in Meadows in practice, but a sample near a biome edge
// could still come back null. Handled by skipping null samples rather than
// guessing a value for them; if every sample is null (degenerate — the
// center point already passed a Meadows check earlier in
// isGreenZoneEligible, so this shouldn't happen), falls back to delta=0
// rather than NaN from an empty min/max.
function getTerrainDelta(wx, wy, radius, offset0, offset1, offset2, offset3, offset4, sampleCount = 10) {
  const heights = [];
  const centerHeight = getHeight(wx, wy, offset0, offset1, offset2, offset3, offset4);
  if (centerHeight !== null) heights.push(centerHeight);

  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const sx = wx + Math.cos(angle) * radius;
    const sy = wy + Math.sin(angle) * radius;
    const h = getHeight(sx, sy, offset0, offset1, offset2, offset3, offset4);
    if (h !== null) heights.push(h);
  }

  if (heights.length === 0) return 0;
  return Math.max(...heights) - Math.min(...heights);
}

// ============================================================================
// Green-zone eligibility check (Stage 1 of Maypole-search mode,
// project_plan.md)
// ============================================================================
// Answers: "for this seed, is this point the kind of place a WoodFarm1
// COULD be placed" — deterministic filters only, not the real stochastic
// dart-throw. Passing does NOT mean a WoodFarm1 will land there. See
// project_plan.md's own caveat language — surface that to the user in the
// UI, not just here.
//
// m_biomeArea (EdgeMedian) is deliberately skipped — it always passes for
// WoodFarm1, per project_plan.md's own table.
function isGreenZoneEligible(wx, wy, offsets) {
  const { offset0, offset1, offset2, offset3, offset4 } = offsets;

  const biome = getBiome(wx, wy, offset0, offset1, offset2, offset4);
  if (biome !== Biome.Meadows) {
    return { eligible: false, reason: 'biome', biome };
  }

  const dist = dLength(wx, wy);
  if (dist < 500 || dist > 2000) {
    return { eligible: false, reason: 'distance', dist };
  }

  const height = getHeight(wx, wy, offset0, offset1, offset2, offset3, offset4);
  const altitude = height === null ? null : height - 30;
  if (altitude === null || altitude < 1 || altitude > 1000) {
    return { eligible: false, reason: 'altitude', altitude };
  }

  const forestFactor = getForestFactor(wx, wy);
  if (forestFactor < 0 || forestFactor > 1) {
    return { eligible: false, reason: 'forestFactor', forestFactor };
  }

  const terrainDelta = getTerrainDelta(wx, wy, 32, offset0, offset1, offset2, offset3, offset4);
  if (terrainDelta < 0 || terrainDelta > 4) {
    return { eligible: false, reason: 'terrainDelta', terrainDelta };
  }

  return { eligible: true, reason: null, biome, dist, altitude, forestFactor, terrainDelta };
}

// Guarded CommonJS export — this file is loaded two ways: `require()`d from
// Node (validation scripts, smoke tests) AND included directly via
// <script src="biome_port.js"> in index.html, where `module` doesn't exist.
// Un-guarded `module.exports` would throw a ReferenceError in the browser
// and break the page. In the browser, everything above is just attached to
// the global scope as plain function/const declarations — no separate
// window.* wiring needed since index.html's own <script> runs after this
// one and can reference these names directly.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    perlinNoise, getBaseHeight, getBiome, Biome, worldAngle, isAshlands, isDeepnorth,
    getHeight, getMeadowsHeight, getBiomeArea, getForestFactor, getTerrainDelta,
    isGreenZoneEligible,
  };
}
