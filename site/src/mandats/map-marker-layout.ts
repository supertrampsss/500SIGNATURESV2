import { MAP_PLACES, mapSourcePosition } from "./map-state.ts";
import type { MandateMapState } from "./map-state.ts";

type MarkerBox = { x: number; y: number; width: number; height: number };
export function mapObstacles(host: HTMLElement): MarkerBox[] {
  const bounds = host.getBoundingClientRect();
  return [...host.querySelectorAll<HTMLElement>(".map-camera, [data-map-toggle]")]
    .map(control => control.getBoundingClientRect())
    .filter(rectangle => rectangle.width > 0 && rectangle.height > 0)
    .map(rectangle => ({
      x: rectangle.x - bounds.x + rectangle.width / 2,
      y: rectangle.y - bounds.y + rectangle.height / 2,
      width: rectangle.width,
      height: rectangle.height,
    }));
}
export function placeMarker(
  host: HTMLElement,
  element: HTMLElement,
  origin: { x: number; y: number },
  placed: MarkerBox[],
) {
  const ground = { ...origin };
  element.classList.remove("map-marker--label-left");
  const iconSize = element.querySelector<HTMLElement>(".map-marker__point")?.offsetWidth ?? 0;
  element.classList.toggle("map-marker--label-left",
    origin.x - iconSize / 2 + element.offsetWidth > host.clientWidth - 8);
  const anchor = element.querySelector<HTMLElement>("[data-map-anchor]");
  // Recalculate from the CSS dimensions on every projection. The previous
  // frame's displaced callout must never become the next geographic origin.
  anchor?.style.removeProperty("left");
  anchor?.style.removeProperty("top");
  const width = element.offsetWidth,
    height = element.offsetHeight;
  // The visual ring, rather than the centre of the complete icon and label,
  // locates the saved subject on the ground. CSS adapts its exact dimensions
  // for ordinary, urgent and small tracking pins on each screen size.
  if (anchor) origin = {
    x: origin.x + width / 2 - anchor.offsetLeft - anchor.offsetWidth / 2,
    y: origin.y + height / 2 - anchor.offsetTop - anchor.offsetHeight / 2,
  };
  const marginX = Math.min(host.clientWidth / 2, width / 2 + 8),
    marginY = Math.min(host.clientHeight / 2, height / 2 + 8);
  origin = {
    x: Math.max(marginX, Math.min(host.clientWidth - marginX, origin.x)),
    y: Math.max(marginY, Math.min(host.clientHeight - marginY, origin.y)),
  };
  const candidates: MarkerBox[] = [];
  for (const dx of [0, 12, -12, 24, -24, 36, -36, width + 12, -width - 12,
    2 * (width + 12), -2 * (width + 12)])
    for (const dy of [0, 12, -12, 24, -24, 36, -36, height + 12, -height - 12,
      2 * (height + 12), -2 * (height + 12), 3 * (height + 12), -3 * (height + 12)])
      candidates.push({
        x: Math.max(
          marginX,
          Math.min(host.clientWidth - marginX, origin.x + dx),
        ),
        y: Math.max(
          marginY,
          Math.min(host.clientHeight - marginY, origin.y + dy),
        ),
        width,
        height,
      });
  candidates.sort(
    (a, b) =>
      (a.x - origin.x) ** 2 +
      (a.y - origin.y) ** 2 -
      (b.x - origin.x) ** 2 -
      (b.y - origin.y) ** 2,
  );
  const point =
    candidates.find((candidate) =>
      placed.every(
        (previous) =>
          Math.abs(previous.x - candidate.x) >=
            (previous.width + width) / 2 + 6 ||
          Math.abs(previous.y - candidate.y) >=
            (previous.height + height) / 2 + 6,
      ),
    ) ?? candidates[0];
  placed.push(point);
  element.style.left = `${Math.round(point.x)}px`;
  element.style.top = `${Math.round(point.y)}px`;
  const hostBounds = host.getBoundingClientRect(), bounds = element.getBoundingClientRect(),
    left = bounds.left - hostBounds.left, top = bounds.top - hostBounds.top,
    groundX = ground.x - left, groundY = ground.y - top;
  // Only the callout avoids neighbouring controls and subjects. Its ground
  // ring always stays on the projected town, including on narrow screens.
  if (anchor) {
    anchor.style.left = `${groundX - anchor.offsetWidth / 2}px`;
    anchor.style.top = `${groundY - anchor.offsetHeight / 2}px`;
  }
  const icon = element.querySelector<HTMLElement>(".map-marker__point"),
    leader = element.querySelector<SVGPathElement>("[data-map-leader] path");
  if (icon && leader) leader.setAttribute("d",
    `M ${icon.offsetLeft + icon.offsetWidth / 2} ${icon.offsetTop + icon.offsetHeight / 2} L ${groundX} ${groundY}`);
  const subject = element.querySelector<HTMLElement>(".map-marker__subject");
  if (subject) {
    subject.style.left = `${Math.max(8 - left,
      Math.min(host.clientWidth - 8 - left - subject.offsetWidth, icon?.offsetLeft ?? 2))}px`;
    // The compact map has little space between Lille and Lyon. Place the
    // urgent caption below its ground ring there, keeping both pins readable.
    const captionTop = host.clientWidth <= 820 ? (icon?.offsetHeight ?? 48) + 31 : -subject.offsetHeight - 7;
    subject.style.top = `${Math.max(8 - top,
      Math.min(host.clientHeight - 8 - top - subject.offsetHeight, captionTop))}px`;
    placed.push({ x: left + subject.offsetLeft + subject.offsetWidth / 2,
      y: top + subject.offsetTop + subject.offsetHeight / 2,
      width: subject.offsetWidth, height: subject.offsetHeight });
  }
  element.dataset.mapGroundX = String(ground.x);
  element.dataset.mapGroundY = String(ground.y);
  return point;
}
export function placeFallbackMarkers(host: HTMLElement, state: MandateMapState): void {
  for (const label of host.querySelectorAll<HTMLElement>("[data-map-label]")) label.hidden = true;
  const width = host.clientWidth,
    height = host.clientHeight,
    scale = Math.min(width / 1000, height / 920),
    placed = mapObstacles(host);
  const urgentIds = new Set(state.markers.filter(marker => marker.urgent).map(marker => marker.id));
  for (const item of [...state.markers, ...state.tracking].sort((a, b) =>
    Number(urgentIds.has(b.id)) - Number(urgentIds.has(a.id)))) {
    const element = [
      ...host.querySelectorAll<HTMLElement>("[data-map-marker]"),
    ].find((marker) => marker.dataset.mapMarker === item.id);
    if (!element) continue;
    element.hidden = false;
    const position = item.id.startsWith("policy:") ? { x: 0, z: 0 } :
      mapSourcePosition(MAP_PLACES[item.place].lon, MAP_PLACES[item.place].lat);
    const x = (width - 1000 * scale) / 2 + (500 + position.x * 72) * scale,
      y = (height - 920 * scale) / 2 + (450 - position.z * 72) * scale;
    placeMarker(host, element, { x, y }, placed);
  }
}
export function watchPreviewImage(host: HTMLElement): (() => void) | undefined {
  const image = host.querySelector<HTMLImageElement>(".mandate-map__preview");
  if (!image) return;
  const update = () => host.classList.toggle("mandate-map--preview-ready",
    image.complete && image.naturalWidth > 0);
  image.addEventListener("load", update);
  image.addEventListener("error", update);
  update();
  return () => {
    image.removeEventListener("load", update);
    image.removeEventListener("error", update);
  };
}
