/** Shared authored footprint for the school shown in the Lyon subjects. */
export const LYON_SCHOOL_SITE = {
  town: "lyon",
  x: -.264,
  z: -.60,
  halfW: .155,
  halfD: .085,
  publicHalfW: .18,
  publicHalfD: .09,
  buildingWidth: .30,
  buildingDepth: .134,
  // Keep the established channel when relocating the building onto its dry
  // bank. The river survey still uses this fixed hydraulic clearance anchor.
  riverWidthAnchor: { x: -.22, z: -.60 },
} as const;
