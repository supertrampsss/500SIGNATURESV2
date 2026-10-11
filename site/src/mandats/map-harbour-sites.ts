/** Shared sites keep terrain reservations and rendered quays in agreement. */
export const HARBOUR_SITES = [
  { name: "brest", lon: -4.49, lat: 48.39 },
  // Decorative coastal towns already present in the national miniature.
  // These harbours add no agenda location, decision or player-state field.
  { name: "cherbourg", lon: -1.62, lat: 49.64 },
  { name: "dunkerque", lon: 2.40, lat: 51.025 },
  { name: "nantes", lon: -1.55, lat: 47.22 },
  { name: "la-rochelle", lon: -1.15, lat: 46.16 },
  { name: "marseille", lon: 5.37, lat: 43.30 },
  { name: "ajaccio", lon: 8.74, lat: 41.92 },
] as const;
