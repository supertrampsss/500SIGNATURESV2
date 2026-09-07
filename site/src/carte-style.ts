import type { FilterSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

export const COUCHES: Record<string, string> = {
  commune: "communes",
  departement: "departements",
  region: "regions",
};

const LISERE: Record<string, number[]> = {
  regions: [3, 0.35, 5, 0.7, 9, 1.25],
  departements: [4.5, 0, 6, 0.45, 10, 1.05],
  communes: [7, 0, 8.5, 0.35, 12, 0.85],
};

export function largeurLisere(couche: string): unknown {
  return ["interpolate", ["linear"], ["zoom"], ...LISERE[couche]];
}

/** Style analytique autonome : la donnée locale, aucune tuile ni étiquette
 * tierce. Les noms sont posés une seule fois par la couche HTML du site. */
export function styleCarte(urlTuiles: string, sombre = false): StyleSpecification {
  const layers: LayerSpecification[] = [
    { id: "fond", type: "background", paint: { "background-color": sombre ? "#0c2029" : "#f6f3eb" } },
  ];
  for (const couche of Object.values(COUCHES)) {
    layers.push(
      {
        id: `remplissage-${couche}`,
        type: "fill",
        source: "territoires",
        "source-layer": couche,
        paint: {
          "fill-color": sombre ? "#31505a" : "#ccd5d0",
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "survol"], false],
            0.98,
            0.88,
          ] as never,
        },
      },
      {
        id: `contour-${couche}`,
        type: "line",
        source: "territoires",
        "source-layer": couche,
        paint: {
          "line-color": sombre ? "#142e38" : "#fffdf7",
          "line-width": largeurLisere(couche) as never,
        },
      },
      {
        id: `selection-${couche}`,
        type: "line",
        source: "territoires",
        "source-layer": couche,
        filter: ["==", ["get", "code"], ""] as FilterSpecification,
        paint: {
          "line-color": sombre ? "#efcc83" : "#806021",
          "line-width": 3,
          "line-opacity": 1,
        },
      },
    );
  }
  return {
    version: 8,
    sources: {
      territoires: {
        type: "vector",
        url: `pmtiles://${urlTuiles}`,
        promoteId: "code",
      },
    },
    layers,
  };
}
