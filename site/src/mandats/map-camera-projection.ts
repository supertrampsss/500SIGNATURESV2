type Point = { x: number; z: number };
type Knot = readonly [number, number];
type Homography = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

/** Fixed country composition, calibrated against the confirmed desktop image. */
export const COUNTRY_REFERENCE_POSE = {
  alphaOffset: 0.0554234,
  beta: 0.86,
  radius: 13.3,
  fov: 0.63,
  target: [-0.31952487944989993, 0.1268400798635092, -0.3045569170926967],
  aspect: 1268 / 801,
  groundY: 0.13,
  width: 1268,
  height: 801,
} as const;

const latitudeKnots: readonly Knot[] = [
  [42.34, 0], [43.3, 0.19628990666247978],
  [45.76, 0.7332517438749783], [47.22, 0.27250233805412616],
  [50.63, -0.19505596664117453], [51.0964, 0],
];
const shearKnots: readonly Knot[] = [
  [-5.5247999999999955, 0], [-3.2597100933375236, 0.20789920843655643],
  [-0.06594825612502397, -0.11765995740208113],
  [1.050102338054125, -0.3650155532541809],
  [4.265344033358829, 0.19067510779956762], [5.430512, 0],
];
const latitudeCuts = [42.34, 43.2, 43.3, 45.76, 47.22, 50.63, 51.0964];
const shearWest = 3.648, shearEast = 4.484, shearSpan = 0.836;

// Orthographic plane Y=.13 to COUNTRY_REFERENCE_POSE perspective plane Y=.13.
// Positive on the authored country/context domain; never clamp across its horizon.
const planeProjection: Homography = [
  [1.2206434811198366, 0.024551404176243134, 0.07188295673643995],
  [0.0023615522785805816, 1.1794399357343348, 0.05055059840803732],
  [0.0036593882176851676, -0.06595843159356725, 1],
];
const inversePlaneProjection: Homography = [
  [0.8215890805916422, -0.020347548848902535, -0.058029671564851684],
  [-0.0015119069668573916, 0.8477114739379378, -0.042743641941833964],
  [-0.0031062364135451457, 0.05598817884533398, 1],
];

function finite(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b))
    throw new RangeError("Miniature coordinates must be finite.");
}
function interpolate(knots: readonly Knot[], n: number) {
  if (n <= knots[0][0] || n >= knots[knots.length - 1][0])
    return { value: 0, slope: 0 };
  for (let i = 1; i < knots.length; i++) {
    if (n <= knots[i][0]) {
      const a = knots[i - 1], b = knots[i], slope = (b[1] - a[1]) / (b[0] - a[0]);
      return { value: a[1] + slope * (n - a[0]), slope };
    }
  }
  return { value: 0, slope: 0 };
}
function mainlandWeight(lon: number) {
  const t = Math.max(0, Math.min(1, (lon - 7.2) / 1.1));
  return { value: 1 - t * t * (3 - 2 * t), slope: -6 * t * (1 - t) / 1.1 };
}
function sourceZ(lon: number, lat: number) {
  return (lat - 46.5) * 1.08 + Math.max(0, lat - 50.63) -
    1.2 * Math.max(0, 43.2 - lat) * mainlandWeight(lon).value;
}
function styledZ(lon: number, lat: number) {
  return sourceZ(lon, lat) + interpolate(latitudeKnots, lat).value * mainlandWeight(lon).value;
}
function styledPosition(lon: number, lat: number): Point {
  const x = (lon - 2.4) * 0.76, z = styledZ(lon, lat),
    weight = Math.max(0, Math.min(1, (shearEast - x) / shearSpan));
  return { x: x + interpolate(shearKnots, z).value * weight, z };
}
function projectPlane(h: Homography, x: number, z: number): Point {
  const d = h[2][0] * x + h[2][1] * z + h[2][2];
  if (d <= 1e-8) throw new RangeError("Point is outside the miniature projection.");
  const result = {
    x: (h[0][0] * x + h[0][1] * z + h[0][2]) / d,
    z: (h[1][0] * x + h[1][1] * z + h[1][2]) / d,
  };
  finite(result.x, result.z);
  return result;
}

/** Original 12b world coordinates, used to survey retained authored geometry. */
export function mapSourcePosition(lon: number, lat: number): Point {
  finite(lon, lat);
  return { x: (lon - 2.4) * 0.76, z: sourceZ(lon, lat) };
}
export function mapSourceCoordinates(x: number, z: number): { lon: number; lat: number } {
  finite(x, z);
  const lon = x / 0.76 + 2.4, mainland = mainlandWeight(lon).value,
    north = (50.63 - 46.5) * 1.08, south = (43.2 - 46.5) * 1.08;
  return { lon, lat: z > north ? 50.63 + (z - north) / 2.08 :
    z < south ? 43.2 + (z - south) / (1.08 + 1.2 * mainland) : z / 1.08 + 46.5 };
}

/** One geographic projection for the coast, routes, topics and town origins. */
function baseMapPosition(lon: number, lat: number): Point {
  finite(lon, lat);
  const p = styledPosition(lon, lat);
  return projectPlane(planeProjection, p.x, p.z);
}
/** Exact inverse: homography, triangular shear, then monotone latitude intervals. */
function baseMapCoordinates(x: number, z: number): { lon: number; lat: number } {
  finite(x, z);
  const p = projectPlane(inversePlaneProjection, x, z), shear = interpolate(shearKnots, p.z).value;
  const originalX = p.x <= shearWest + shear ? p.x - shear :
    p.x >= shearEast ? p.x :
      (p.x - shear * shearEast / shearSpan) / (1 - shear / shearSpan);
  const lon = originalX / 0.76 + 2.4, levels = latitudeCuts.map(lat => styledZ(lon, lat));
  if (p.z <= levels[0])
    return { lon, lat: latitudeCuts[0] + (p.z - levels[0]) / (1.08 + 1.2 * mainlandWeight(lon).value) };
  const last = levels.length - 1;
  if (p.z >= levels[last]) return { lon, lat: latitudeCuts[last] + (p.z - levels[last]) / 2.08 };
  for (let i = 1; i < levels.length; i++) {
    if (p.z <= levels[i]) return {
      lon, lat: latitudeCuts[i - 1] + (p.z - levels[i - 1]) *
        (latitudeCuts[i] - latitudeCuts[i - 1]) / (levels[i] - levels[i - 1]),
    };
  }
  throw new RangeError("Miniature latitude has no inverse interval.");
}

/** SOURCE world to FINAL world. Town-local offsets are deliberately not passed here. */
export function mapAuthoredPosition(x: number, z: number): Point {
  const geo = mapSourceCoordinates(x, z);
  return mapPosition(geo.lon, geo.lat);
}
/** FINAL world to SOURCE world for terrain heights, masks and original field surveys. */
export function mapAuthoredCoordinates(x: number, z: number): Point {
  const geo = mapCoordinates(x, z);
  return mapSourcePosition(geo.lon, geo.lat);
}

/** Differential SOURCE world to FINAL world for field directions and rendered normals.
 *  Apply J to (dx,dz); transform field corners individually for their full footprint.
 *  Local town plans and rigid model dimensions do not use this differential.
 */
function baseMapAuthoredJacobian(x: number, z: number) {
  const { lon, lat } = mapSourceCoordinates(x, z), mainland = mainlandWeight(lon),
    correction = interpolate(latitudeKnots, lat), sourceLon = -1.2 * Math.max(0, 43.2 - lat) * mainland.slope,
    sourceLat = 1.08 + (lat > 50.63 ? 1 : 0) + (lat < 43.2 ? 1.2 * mainland.value : 0),
    targetLon = sourceLon + correction.value * mainland.slope,
    targetLat = sourceLat + correction.slope * mainland.value,
    zx = (targetLon - targetLat * sourceLon / sourceLat) / 0.76,
    zz = targetLat / sourceLat, rawX = (lon - 2.4) * 0.76, rawZ = styledZ(lon, lat),
    shear = interpolate(shearKnots, rawZ), weight = Math.max(0, Math.min(1, (shearEast - rawX) / shearSpan)),
    weightSlope = rawX > shearWest && rawX < shearEast ? -1 / shearSpan : 0,
    xx = 1 + shear.value * weightSlope + shear.slope * weight * zx,
    xz = shear.slope * weight * zz, p = styledPosition(lon, lat),
    projected = projectPlane(planeProjection, p.x, p.z), h = planeProjection,
    d = h[2][0] * p.x + h[2][1] * p.z + h[2][2],
    hxx = (h[0][0] - projected.x * h[2][0]) / d,
    hxz = (h[0][1] - projected.x * h[2][1]) / d,
    hzx = (h[1][0] - projected.z * h[2][0]) / d,
    hzz = (h[1][1] - projected.z * h[2][1]) / d;
  const result = { xx: hxx * xx + hxz * zx, xz: hxx * xz + hxz * zz,
    zx: hzx * xx + hzz * zx, zz: hzx * xz + hzz * zz };
  return { ...result, determinant: result.xx * result.zz - result.xz * result.zx };
}

// Baseline13 remains the shared geographic frame; the eastern correction is
// applied once after interpolation and inverted before every height lookup.
const eastDisplacementKnots: readonly Knot[] = [[-3.4, 0], [-2.62, 1.258433668273753], [-2.3, 1.1325903014463776], [-1.5, 0.8437374763119094], [2.2, 0.8437374763119094], [3.4, 0.684285698864346], [3.84, 0.8637836404922967], [4.8, 0.8637836404922967], [5.8, 0]];
const eastStartKnots: readonly Knot[] = [[-3.4, 3.62], [-2.58, 3.62], [-1.5, 2.75], [5.8, 2.75]];
const eastEndKnots: readonly Knot[] = [[-3.4, 4.2], [-2.58, 4.2], [-1.5, 3.15], [5.8, 3.15]];
function eastInterpolate(knots: readonly Knot[], z: number): { v: number; d: number } {
  if (z <= knots[0][0]) return { v: knots[0][1], d: 0 };
  if (z >= knots[knots.length - 1][0]) return { v: knots[knots.length - 1][1], d: 0 };
  for (let index = 1; index < knots.length; index++) if (z <= knots[index][0]) {
    const a = knots[index - 1], b = knots[index], d = (b[1] - a[1]) / (b[0] - a[0]);
    return { v: a[1] + d * (z - a[0]), d };
  }
  throw new RangeError("Invalid eastern projection coordinate.");
}
function eastParameters(z: number) {
  const D = eastInterpolate(eastDisplacementKnots, z),
    a = eastInterpolate(eastStartKnots, z), b = eastInterpolate(eastEndKnots, z);
  return { D, a, b, L: b.v - a.v };
}
export const mapBaselinePosition = baseMapPosition;
export const mapBaselineCoordinates = baseMapCoordinates;
function eastFinalFromBaseline(x: number, z: number): Point {
  finite(x, z);
  const { D, a, b, L } = eastParameters(z),
    weight = x <= a.v ? 0 : x >= b.v ? 1 : (x - a.v) / L;
  return { x: x + D.v * weight, z };
}
function eastBaselineFromFinal(X: number, z: number): Point {
  finite(X, z);
  const { D, a, b, L } = eastParameters(z);
  return { x: X <= a.v ? X : X >= b.v + D.v ? X - D.v :
    (X + D.v * a.v / L) / (1 + D.v / L), z };
}
function eastJacobian(x: number, z: number) {
  const { D, a, b, L } = eastParameters(z);
  let weight = 0, wx = 0, wz = 0;
  if (x >= b.v) weight = 1;
  else if (x > a.v) {
    weight = (x - a.v) / L; wx = 1 / L;
    wz = (-a.d * L - (x - a.v) * (b.d - a.d)) / (L * L);
  }
  return { xx: 1 + D.v * wx, xz: D.d * weight + D.v * wz };
}
// Reference31 broadens the southwestern land mass after the retained F22 map.
// This is an X-only common coordinate transform, never a per-layer scene offset.
// At Bordeaux baseline Z=-1.34093 the shift is about .65; on the Basque coast
// Z=-3.06128 it is 1.648. Northern/central/eastern landmarks remain unchanged.
const southwestShape = { maxShift: 1.65, southStart: 0, southFull: -3.12,
  westFull: -2.55, westEnd: .40 } as const;
function shapeTransition(n: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (n - start) / (end - start)));
  return { v: t * t * (3 - 2 * t), d: 6 * t * (1 - t) / (end - start) };
}
function southwestFinalFromEast(x: number, z: number): Point {
  if (z >= southwestShape.southStart || x >= southwestShape.westEnd) return { x, z };
  const south = shapeTransition(z, southwestShape.southStart, southwestShape.southFull).v,
    west = 1 - shapeTransition(x, southwestShape.westFull, southwestShape.westEnd).v;
  return { x: x - southwestShape.maxShift * south * west, z };
}
function southwestEastFromFinal(X: number, z: number): Point {
  finite(X, z);
  if (z >= southwestShape.southStart || X >= southwestShape.westEnd) return { x: X, z };
  const shift = southwestShape.maxShift *
    shapeTransition(z, southwestShape.southStart, southwestShape.southFull).v;
  if (X <= southwestShape.westFull - shift) return { x: X + shift, z };
  // dX/dx is always >=1. The unique inverse lies in [X, X+shift]. Constant
  // regions above return exactly; only the small western transition uses Newton.
  let lower = X, upper = X + shift, x = (lower + upper) / 2;
  for (let iteration = 0; iteration < 8; iteration++) {
    const west = shapeTransition(x, southwestShape.westFull, southwestShape.westEnd),
      residual = x - shift * (1 - west.v) - X;
    if (Math.abs(residual) <= 1e-12) return { x, z };
    if (residual < 0) lower = x; else upper = x;
    const next = x - residual / (1 + shift * west.d);
    x = next >= lower && next <= upper ? next : (lower + upper) / 2;
  }
  // Deterministic bounded fallback for unusual rounding at a transition edge.
  for (let iteration = 0; iteration < 40; iteration++) {
    const west = shapeTransition(x, southwestShape.westFull, southwestShape.westEnd),
      residual = x - shift * (1 - west.v) - X;
    if (Math.abs(residual) <= 1e-12) return { x, z };
    if (residual < 0) lower = x; else upper = x;
    x = (lower + upper) / 2;
  }
  return { x, z };
}
function southwestJacobian(x: number, z: number) {
  const south = shapeTransition(z, southwestShape.southStart, southwestShape.southFull),
    west = shapeTransition(x, southwestShape.westFull, southwestShape.westEnd);
  return { xx: 1 + southwestShape.maxShift * south.v * west.d,
    xz: -southwestShape.maxShift * south.d * (1 - west.v) };
}
// Native reference cap/south-axis fit at the unchanged country camera, Y=.13.
// Rigid inside the island/harbour domain; radial sea/context taper is invertible.
export const CORSE_REFERENCE_POSE = { angle: -0.35456993081176147,
  pivotX: 4.774450884938317, pivotZ: -4.27538238012851,
  fullRadius: 1.15, outerRadius: 1.40 } as const;
export const CORSICA_SETTLEMENTS: ReadonlySet<string> = new Set(["ajaccio", "bastia", "corte", "bonifacio"]);
export function mapCorsicaLocalVector(x: number, z: number): Point {
  const c = Math.cos(CORSE_REFERENCE_POSE.angle), s = Math.sin(CORSE_REFERENCE_POSE.angle);
  return { x: c * x + s * z, z: -s * x + c * z };
}
function corsicaRotation(radius: number) {
  const taper = shapeTransition(radius, CORSE_REFERENCE_POSE.fullRadius, CORSE_REFERENCE_POSE.outerRadius);
  return { angle: CORSE_REFERENCE_POSE.angle * (1 - taper.v),
    derivative: -CORSE_REFERENCE_POSE.angle * taper.d };
}
function corsicaTransport(x: number, z: number, inverse = false): Point {
  const dx = x - CORSE_REFERENCE_POSE.pivotX, dz = z - CORSE_REFERENCE_POSE.pivotZ;
  if (Math.abs(dx) >= CORSE_REFERENCE_POSE.outerRadius || Math.abs(dz) >= CORSE_REFERENCE_POSE.outerRadius)
    return { x, z };
  const radius = Math.hypot(dx, dz);
  if (radius >= CORSE_REFERENCE_POSE.outerRadius) return { x, z };
  const angle = corsicaRotation(radius).angle * (inverse ? -1 : 1),
    c = Math.cos(angle), s = Math.sin(angle);
  return { x: CORSE_REFERENCE_POSE.pivotX + c * dx + s * dz,
    z: CORSE_REFERENCE_POSE.pivotZ - s * dx + c * dz };
}
function corsicaJacobian(x: number, z: number) {
  const dx = x - CORSE_REFERENCE_POSE.pivotX, dz = z - CORSE_REFERENCE_POSE.pivotZ;
  if (Math.abs(dx) >= CORSE_REFERENCE_POSE.outerRadius || Math.abs(dz) >= CORSE_REFERENCE_POSE.outerRadius)
    return { xx: 1, xz: 0, zx: 0, zz: 1 };
  const radius = Math.hypot(dx, dz);
  if (radius >= CORSE_REFERENCE_POSE.outerRadius) return { xx: 1, xz: 0, zx: 0, zz: 1 };
  const rotation = corsicaRotation(radius), c = Math.cos(rotation.angle), s = Math.sin(rotation.angle),
    rx = c * dx + s * dz, rz = -s * dx + c * dz,
    gx = radius ? rotation.derivative * dx / radius : 0,
    gz = radius ? rotation.derivative * dz / radius : 0;
  return { xx: c + rz * gx, xz: s + rz * gz, zx: -s - rx * gx, zz: c - rx * gz };
}
/** Retained rigid town plans were authored after F22, before SW32. Transport
 * their centres/points through SW once; local GLB dimensions stay unchanged.
 * The NationalSettlement data driver composes Corse's local R afterwards.
 */
export function mapRetainedTownPlanPoint(lon: number, lat: number, x: number, z: number): Point {
  const baseline = baseMapPosition(lon, lat), origin = eastFinalFromBaseline(baseline.x, baseline.z),
    point = southwestFinalFromEast(origin.x + x, origin.z + z),
    projectedOrigin = southwestFinalFromEast(origin.x, origin.z);
  if (point.x === origin.x + x && projectedOrigin.x === origin.x) return { x, z };
  return { x: point.x - projectedOrigin.x, z };
}
export function mapFinalFromBaseline(x: number, z: number): Point {
  const p = eastFinalFromBaseline(x, z), national = southwestFinalFromEast(p.x, p.z);
  return corsicaTransport(national.x, national.z);
}
export function mapBaselineFromFinal(x: number, z: number): Point {
  finite(x, z);
  const national = corsicaTransport(x, z, true), p = southwestEastFromFinal(national.x, national.z);
  return eastBaselineFromFinal(p.x, p.z);
}
export function mapPosition(lon: number, lat: number): Point {
  const p = baseMapPosition(lon, lat);
  return mapFinalFromBaseline(p.x, p.z);
}
export function mapCoordinates(x: number, z: number): { lon: number; lat: number } {
  const p = mapBaselineFromFinal(x, z);
  return baseMapCoordinates(p.x, p.z);
}
export function mapAuthoredJacobian(x: number, z: number) {
  const previous = baseMapAuthoredJacobian(x, z), geo = mapSourceCoordinates(x, z),
    p = baseMapPosition(geo.lon, geo.lat), east = eastJacobian(p.x, p.z),
    eastPoint = eastFinalFromBaseline(p.x, p.z), southwest = southwestJacobian(eastPoint.x, eastPoint.z),
    j = { xx: southwest.xx * east.xx, xz: southwest.xx * east.xz + southwest.xz },
    national = { xx: j.xx * previous.xx + j.xz * previous.zx,
      xz: j.xx * previous.xz + j.xz * previous.zz, zx: previous.zx, zz: previous.zz },
    nationalPoint = southwestFinalFromEast(eastPoint.x, eastPoint.z), corsica = corsicaJacobian(nationalPoint.x, nationalPoint.z),
    result = { xx: corsica.xx * national.xx + corsica.xz * national.zx,
      xz: corsica.xx * national.xz + corsica.xz * national.zz,
      zx: corsica.zx * national.xx + corsica.zz * national.zx,
      zz: corsica.zx * national.xz + corsica.zz * national.zz };
  return { ...result, determinant: result.xx * result.zz - result.xz * result.zx };
}
