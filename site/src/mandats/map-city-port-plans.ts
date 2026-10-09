import { FRANCE_OUTLINES } from "./map-geography.ts";
import { mapPosition } from "./map-state.ts";
import { landContains, landHeight } from "./map-landscape.ts";

export type HarbourPoint = { x: number; z: number };
export type HarbourStation = HarbourPoint & {
  distance: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  height: number;
  shoreHeight: number;
};
export type HarbourPlan = {
  place: string;
  kind: "atlantic" | "mediterranean" | "island";
  frontage: number;
  apronDepth: number;
  stations: HarbourStation[];
  access: HarbourPoint[];
  jetties: Array<{ points: HarbourPoint[]; width: number }>;
  quayPolygons: HarbourPoint[][];
  coastalJoins: HarbourPoint[][];
  stairsFootprints: HarbourPoint[][];
  landReservations: HarbourPoint[][];
  warehouses: Array<{ point: HarbourPoint; angle: number; width: number; depth: number; height: number; footprint: HarbourPoint[] }>;
};

const coastlines = FRANCE_OUTLINES.map(outline => outline.slice(0, -1).map(([lon, lat]) => mapPosition(lon, lat)));
const cross = (a: HarbourPoint, b: HarbourPoint, c: HarbourPoint) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);

export function harbourPolygonContains(polygon: HarbourPoint[], point: HarbourPoint): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Includes crossings with neither polygon's corners contained in the other. */
export function harbourPolygonsOverlap(a: HarbourPoint[], b: HarbourPoint[]): boolean {
  if (a.some(point => harbourPolygonContains(b, point)) || b.some(point => harbourPolygonContains(a, point))) return true;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length];
    if (cross(p, q, r) * cross(p, q, s) < 0 && cross(r, s, p) * cross(r, s, q) < 0) return true;
  }
  return false;
}

export function harbourRectangle(point: HarbourPoint, angle: number, width: number, depth: number): HarbourPoint[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]]
    .map(([x, z]) => ({ x: point.x + c * x + s * z, z: point.z - s * x + c * z }));
}

export function harbourStation(plan: HarbourPlan, distance: number, offset = 0): HarbourStation {
  const stations = plan.stations;
  let index = 1;
  while (index < stations.length - 1 && stations[index].distance < distance) index++;
  const a = stations[index - 1], b = stations[index],
    t = Math.max(0, Math.min(1, (distance - a.distance) / (b.distance - a.distance))),
    nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t,
    normal = Math.hypot(nx, nz), tx = a.tx + (b.tx - a.tx) * t, tz = a.tz + (b.tz - a.tz) * t,
    tangent = Math.hypot(tx, tz), x = a.x + (b.x - a.x) * t + nx / normal * offset,
    z = a.z + (b.z - a.z) * t + nz / normal * offset;
  return { x, z, nx: nx / normal, nz: nz / normal, tx: tx / tangent, tz: tz / tangent, distance,
    height: a.height + (b.height - a.height) * t, shoreHeight: a.shoreHeight + (b.shoreHeight - a.shoreHeight) * t };
}

function ribbon(points: HarbourPoint[], width: number): HarbourPoint[][] {
  return points.slice(1).map((b, i) => {
    const a = points[i], dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz), nx = -dz / length * width / 2, nz = dx / length * width / 2;
    return [{ x: a.x + nx, z: a.z + nz }, { x: b.x + nx, z: b.z + nz }, { x: b.x - nx, z: b.z - nz }, { x: a.x - nx, z: a.z - nz }];
  });
}

/** The miniature's actual coastline supplies the curved quay and its land contact. */
export function surveyHarbour(place: string, origin: HarbourPoint): HarbourPlan | undefined {
  if (!["brest", "nantes", "marseille", "ajaccio"].includes(place)) return;
  const frontage = place === "ajaccio" ? .48 : place === "brest" ? .75 : place === "nantes" ? .85 : .90,
    apronDepth = place === "ajaccio" ? .070 : .108,
    preferred = place === "marseille" ? [-.20, -.98] : place === "ajaccio" ? [-.90, -.43] : [-.82, -.57];
  let selected: { stations: HarbourStation[]; score: number } | undefined;
  for (const polygon of coastlines) {
    const lengths = polygon.map((a, i) => Math.hypot(polygon[(i + 1) % polygon.length].x - a.x, polygon[(i + 1) % polygon.length].z - a.z)),
      starts: number[] = [], perimeter = lengths.reduce((sum, length) => sum + length, 0);
    let accumulated = 0;
    for (const length of lengths) { starts.push(accumulated); accumulated += length; }
    const along = (distance: number): HarbourPoint => {
      let progress = ((distance % perimeter) + perimeter) % perimeter, index = 0;
      while (index < lengths.length - 1 && progress > lengths[index]) progress -= lengths[index++];
      const a = polygon[index], b = polygon[(index + 1) % polygon.length], portion = progress / lengths[index];
      return { x: a.x + (b.x - a.x) * portion, z: a.z + (b.z - a.z) * portion };
    };
    for (let edge = 0; edge < polygon.length; edge++) {
      const a = polygon[edge], b = polygon[(edge + 1) % polygon.length], dx = b.x - a.x, dz = b.z - a.z, squared = dx * dx + dz * dz;
      if (!squared) continue;
      const t = Math.max(0, Math.min(1, ((origin.x - a.x) * dx + (origin.z - a.z) * dz) / squared)),
        start = starts[edge] + lengths[edge] * t, centre = along(start), distanceToTown = Math.hypot(centre.x - origin.x, centre.z - origin.z);
      if (distanceToTown > .95) continue;
      const stations: HarbourStation[] = [], count = Math.ceil(frontage / .035);
      let score = distanceToTown * 5;
      for (let i = 0; i <= count; i++) {
        const distance = (i / count - .5) * frontage, point = along(start + distance),
          before = along(start + distance - .009), after = along(start + distance + .009), tangent = Math.hypot(after.x - before.x, after.z - before.z),
          tx = (after.x - before.x) / tangent, tz = (after.z - before.z) / tangent, nx = -tz, nz = tx;
        // Natural Earth's France rings are clockwise. Their left-hand normal
        // always points outwards; testing a neighbouring cape must not flip it.
        if (!landContains(point.x - nx * .025, point.z - nz * .025)) score += 4;
        for (const offset of [.025, .11, .23, .40]) if (landContains(point.x + nx * offset, point.z + nz * offset)) score += 4;
        score += Math.max(0, .20 - nx * preferred[0] - nz * preferred[1]) * .30;
        const shoreHeight = Math.max(landHeight(point.x, point.z), landHeight(point.x - nx * .035, point.z - nz * .035)) + .010,
          base = place === "marseille" ? .016 : place === "nantes" ? .021 : place === "brest" ? .020 : .012,
          bay = place === "marseille" || place === "nantes" ? distance < -frontage * .18 ? .003 : distance > frontage * .18 ? .001 : -.003 : 0,
          height = Math.max(.008, Math.min(.032, shoreHeight - .055, base + (shoreHeight - .135) * .22 + bay));
        // Low local decks meet the sea, while each short access separately
        // meets the real higher shoreline. No whole port adopts its high point.
        stations.push({ ...point, distance, tx, tz, nx, nz, height, shoreHeight });
      }
      for (let i = 1; i < stations.length; i++) {
        const a = stations[i - 1], b = stations[i], alignment = a.nx * b.nx + a.nz * b.nz;
        if (alignment < .50) score += (1 - alignment) * 2;
      }
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, landing = stations[Math.floor(stations.length / 2)];
        if (!landContains(origin.x * (1 - t) + (landing.x - landing.nx * .035) * t, origin.z * (1 - t) + (landing.z - landing.nz * .035) * t)) score += 2;
      }
      if (!selected || score < selected.score) selected = { stations, score };
    }
  }
  if (!selected) return;
  const stations = selected.stations;
  const plan: HarbourPlan = { place, kind: place === "ajaccio" ? "island" : place === "marseille" ? "mediterranean" : "atlantic",
    frontage, apronDepth, stations, access: [], jetties: [], quayPolygons: [], coastalJoins: [], stairsFootprints: [], landReservations: [], warehouses: [] };
  const sample = (fraction: number, offset: number) => harbourStation(plan, fraction * frontage, offset);
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i], length = Math.hypot(b.x - a.x, b.z - a.z),
      nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length,
      shift = (p: HarbourStation, offset: number) => ({ x: p.x + nx * offset, z: p.z + nz * offset });
    // Each straight surveyed edge has a regular ribbon. Fan joins below fill
    // its corners, avoiding twisted quads in the coastline's narrow bends.
    plan.quayPolygons.push([shift(a, -.037), shift(b, -.037), shift(b, apronDepth), shift(a, apronDepth)]);
    plan.landReservations.push([shift(a, -.043), shift(b, -.043), shift(b, .005), shift(a, .005)]);
  }
  for (let i = 1; i < stations.length - 1; i++) {
    const previous = plan.quayPolygons[i - 1], next = plan.quayPolygons[i], centre = stations[i];
    for (const triangle of [[centre, previous[2], next[3]], [centre, next[0], previous[1]]]) {
      if (Math.abs(cross(triangle[0], triangle[1], triangle[2])) > .00000001) plan.coastalJoins.push(triangle);
    }
  }
  // An inhabited waterfront, not the same rectangular basin in every city.
  if (place === "marseille") {
    plan.jetties.push({ width: .033, points: [sample(-.46, .055), sample(-.42, .18), sample(-.28, .34), sample(-.02, .43), sample(.24, .43)] });
    plan.jetties.push({ width: .043, points: [sample(.31, .062), sample(.28, .22)] });
  } else if (place === "ajaccio") {
    plan.jetties.push({ width: .024, points: [sample(-.44, .04), sample(-.36, .16), sample(-.05, .27), sample(.26, .29)] });
    plan.jetties.push({ width: .016, points: [sample(.18, .042), sample(.16, .132)] });
  } else if (place === "brest") {
    plan.jetties.push({ width: .033, points: [sample(-.37, .055), sample(-.34, .20), sample(-.17, .31)] });
  } else {
    plan.jetties.push({ width: .046, points: [sample(.32, .061), sample(.33, .23), sample(.24, .29)] });
    plan.jetties.push({ width: .027, points: [sample(-.36, .062), sample(-.34, .19)] });
  }
  for (const jetty of plan.jetties) plan.quayPolygons.push(...ribbon(jetty.points, jetty.width));
  const landing = sample(0, -.035);
  plan.access = [{ x: origin.x, z: origin.z }, { x: origin.x * .45 + landing.x * .55, z: origin.z * .45 + landing.z * .55 }, landing];
  plan.landReservations.push(...ribbon(plan.access, .044));
  const shoreLanding = sample(0, .005), stairAngle = Math.atan2(shoreLanding.nx, shoreLanding.nz);
  plan.stairsFootprints.push(harbourRectangle(shoreLanding, stairAngle, .046, .084));
  plan.landReservations.push(...plan.stairsFootprints);
  const warehouseSpecs = place === "ajaccio" ? [[.05, .115, .075]] : [[-.22, .171, .092], [.19, .158, .087]];
  for (const [fraction, width, depth] of warehouseSpecs) {
    let point = sample(fraction, -.093);
    const angle = Math.atan2(point.nx, point.nz);
    let footprint = harbourRectangle(point, angle, width, depth);
    for (let attempt = 0; attempt < 5 && footprint.some(p => !landContains(p.x, p.z)); attempt++) {
      point = sample(fraction, -.105 - attempt * .02);
      footprint = harbourRectangle(point, angle, width, depth);
    }
    if (footprint.some(p => !landContains(p.x, p.z))) continue;
    const height = Math.max(...footprint.map(p => landHeight(p.x, p.z))) + .007;
    plan.warehouses.push({ point: { x: point.x, z: point.z }, angle, width, depth, height, footprint });
    plan.landReservations.push(harbourRectangle(point, angle, width + .016, depth + .012));
  }
  return plan;
}
