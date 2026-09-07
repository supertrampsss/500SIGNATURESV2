/** Editorial advertising contract. No SDK, DOM insertion, storage or network requests. */
export const MAX_AD_SLOTS_PER_PAGE = 2;

const PLACEMENTS = {
  france: ['france-after-revenue', 'france-after-europe'],
  salary: ['salary-after-explanation'],
  analysis: ['analysis-after-evidence', 'analysis-after-body'],
} as const;
export type AdPlacement = (typeof PLACEMENTS)[keyof typeof PLACEMENTS][number];

/** Actual canonical editorial routes only; unknown routes fail closed. */
export function adPlacements(pathname: string, expanded = false): readonly AdPlacement[] {
  const page = /^\/bilan\/?$/.test(pathname) ? 'france'
    : /^\/salaires\/?$/.test(pathname) ? 'salary'
    : /^\/analyses\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(pathname) ? 'analysis'
    : null;
  if (!page) return [];
  return PLACEMENTS[page].slice(0, expanded ? MAX_AD_SLOTS_PER_PAGE : 1);
}

/** Eligibility only. A future adapter must also enforce consent withdrawal and layout limits. */
export function programmaticAdAllowed(pathname: string, consent: boolean, enabled: boolean): boolean {
  return enabled && consent && adPlacements(pathname).length > 0;
}
