/** Small, versioned subset of the public OFGL publication, retained with the save.
 * Reference population is NOT a demographic time series; flags do not prove needs. */
export const CONTEXT_FIELDS = {
  revenue: 'ofgl_recettes_fonctionnement', savings: 'ofgl_epargne_brute',
  investment: 'ofgl_depenses_d_investissement_hors_remb', debt: 'ofgl_encours_dette',
  personnel: 'ofgl_frais_personnel', taxes: 'ofgl_impots_locaux',
  transfers: 'ofgl_concours_de_l_etat', sales: 'ofgl_ventes_de_biens_et_services',
} as const;
export type ContextYear = { year: number; values: Partial<Record<keyof typeof CONTEXT_FIELDS, number>> };
export type CityContext = Readonly<{
  version: 1; years: readonly ContextYear[];
  flags: Readonly<{ rural: boolean | null; tourist: boolean | null; mountain: boolean | null }>;
}>;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
export function extractCityContext(series: Record<string, Record<string, number | null>>, flags: Record<string, unknown> | undefined, year: number): CityContext {
  const years: ContextYear[] = [];
  for (let y = year - 3; y <= year; y++) {
    const values: ContextYear['values'] = {};
    for (const [key, id] of Object.entries(CONTEXT_FIELDS)) {
      const value = series[id]?.[String(y)];
      if (finite(value)) values[key as keyof typeof values] = value;
    }
    if (Object.keys(values).length) years.push(Object.freeze({ year: y, values: Object.freeze(values) }));
  }
  const flag = (key: string): boolean | null => flags?.criteres_source === 'OFGL' ? flags[key] === 'Oui' ? true : flags[key] === 'Non' ? false : null : null;
  return Object.freeze({ version: 1, years: Object.freeze(years), flags: Object.freeze({ rural: flag('rural'), tourist: flag('touristique'), mountain: flag('montagne') }) });
}
export function validCityContext(input: unknown, year: number, observed: { revenue: number; savings: number; investment: number; debt: number }): input is CityContext {
  if (!input || typeof input !== 'object') return false;
  const c = input as CityContext;
  if (c.version !== 1 || !Array.isArray(c.years) || c.years.length < 1 || c.years.length > 4 || !c.flags) return false;
  if (Object.keys(c.flags).length !== 3 || !['rural','tourist','mountain'].every(k => [true,false,null].includes(c.flags[k as keyof typeof c.flags]))) return false;
  let previous = year - 4;
  for (const row of c.years) {
    if (!row || !Number.isInteger(row.year) || row.year <= previous || row.year > year || !row.values || typeof row.values !== 'object') return false;
    const entries = Object.entries(row.values);
    if (!entries.length || entries.some(([k,v]) => !Object.hasOwn(CONTEXT_FIELDS,k) || !finite(v))) return false;
    if (row.values.revenue === 0) return false;
    previous = row.year;
  }
  const last = c.years.at(-1)!;
  return last.year === year && Object.entries(observed).every(([k,v]) => last.values[k as keyof typeof observed] === v);
}
