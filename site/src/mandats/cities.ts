import type { Finance } from './types.ts';
import { extractCityContext, validCityContext } from './city-context.ts';
import type { CityContext } from './city-context.ts';

/** No main application, map, geolocation or private resident data is loaded here. */
const BASE = import.meta.env?.VITE_DONNEES_URL ?? 'https://pub-fc39d357004540a182a907aed4875ef5.r2.dev';
const CODE = /^(?:\d{5}|2[AB]\d{3})$/;
const PUBLICATION = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const FIELDS = {
  revenue: 'ofgl_recettes_fonctionnement', operating: 'ofgl_depenses_fonctionnement',
  debt: 'ofgl_encours_dette', investment: 'ofgl_depenses_d_investissement_hors_remb',
  savings: 'ofgl_epargne_brute', financialCharges: 'ofgl_charges_financieres',
  repayment: 'ofgl_remboursements_d_emprunts_hors_gad', grants: 'ofgl_subventions_recues_et_participations',
} as const;
type Observed = Readonly<Record<keyof typeof FIELDS, number>>;
export type CitySearchResult = Readonly<{ code: string; name: string; department: string }>;
export type CityBaseline = Readonly<{
  version: 1; code: string; name: string; population: number; populationYear: number | null;
  year: number; publication: string; observed: Observed; mappedFinance: Readonly<Finance>;
  center: Readonly<{ longitude: number; latitude: number; source: string }> | null;
  provenance: Readonly<{ producer: string; title: string; licence: string; source: string; extraction: string; snapshot: string }>;
  assumptions: readonly string[];
  context?: CityContext;
}>;
type Index = { codes: string[]; noms: string[]; parents: (string | null)[]; population_municipale: (number | null)[]; millesime_geographique: number | null };
type Territory = { nom: string; population: number | null; series: Record<string, Record<string, number | null>>; drapeaux?: Record<string, unknown> };
type Manifest = { jeux: { id: string; titre: string; producteur: string; licence: string; url: string; extraction: string }[] };
const ASSUMPTIONS = Object.freeze([
  'Comptes OFGL consolidés de la commune, pas budget de toute son intercommunalité. Paris exerce aussi des compétences départementales.',
  'Montants observés en euros ; moteur en millions d’euros. Recettes, dépenses et investissements du dernier exercice commun sont reconduits comme point de départ, sans prévision.',
  'Les charges financières sont retirées du fonctionnement puis portées par le taux implicite charges financières / dette. Ce proxy inclut des charges autres que les intérêts et ne constitue pas un taux bancaire. Sans dette initiale, les charges restent en fonctionnement et le taux des futurs emprunts est une hypothèse de 3,5 %.',
  'Trésorerie de départ : hypothèse prudente de 0, faute de solde disponible dans ce modèle. Elle ne décrit pas la trésorerie réelle de la commune.',
  'Remboursement du capital : reconduction hypothétique du dernier montant observé, plafonnée à la dette restante. Les subventions passées sont reconduites à titre de scénario, sans garantie.',
  'Les autres recettes d’investissement ne sont pas reconduites. Le financement résiduel du programme passe par l’emprunt dans les limites du modèle.',
  'État des services, quartiers, événements et effets des décisions : hypothèses de jeu, pas observations de cette commune. Un centre géographique peut provenir de l’API Découpage administratif, sans géométrie de bâtiments dans cet instantané.',
]);
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0 && x.length < 2000;
const normalise = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const lot = (code: string) => /^(97|98)/.test(code) ? code.slice(0, 3) : code.slice(0, 2);
const fail = (): never => { throw new Error('Les comptes disponibles ne permettent pas de démarrer un mandat fiable pour cette commune. Choisissez une autre ville.'); };

function validCenter(center: CityBaseline['center'], code: string): boolean {
  return center === null || !!center && finite(center.longitude) && finite(center.latitude) &&
    Math.abs(center.longitude) <= 180 && Math.abs(center.latitude) <= 90 && center.source === `https://geo.api.gouv.fr/communes/${code}?fields=centre`;
}

/** Fresh mutable engine finance, leaving the frozen observed snapshot intact. */
export function financeForCity(city: CityBaseline): Finance {
  if (!validateCityBaseline(city)) return fail();
  return { ...city.mappedFinance };
}
/** Monetary choices authored for a 100 M€ reference revenue scale proportionally. */
export function scaleForCity(city: CityBaseline): number {
  if (!validateCityBaseline(city)) return fail();
  return city.observed.revenue / 100_000_000;
}

function mapFinance(o: Observed): Finance {
  const rate = o.debt > 0 ? o.financialCharges / o.debt : 0.035;
  return { revenue: o.revenue / 1e6, operating: (o.operating - (o.debt > 0 ? o.financialCharges : 0)) / 1e6,
    debt: o.debt / 1e6, cash: 0, rate, repayment: Math.min(o.repayment, o.debt) / 1e6,
    investment: o.investment / 1e6, grants: o.grants / 1e6,
    gdp: 0, growth: 0, deflator: 0, marketRate: rate, stockFlow: 0 };
}

/** Strict pure guard for saved snapshots. Recomputes the mapping; never repairs observed data. */
export function validateCityBaseline(input: unknown): input is CityBaseline {
  if (!input || typeof input !== 'object') return false;
  const b = input as CityBaseline;
  if (b.version !== 1 || typeof b.code !== 'string' || !CODE.test(b.code) || !text(b.name) || typeof b.publication !== 'string' || !PUBLICATION.test(b.publication) ||
    !finite(b.population) || b.population <= 0 || !Number.isInteger(b.population) ||
    !Number.isInteger(b.year) || b.year < 2000 || b.year > 2200 ||
    (b.populationYear !== null && (!Number.isInteger(b.populationYear) || b.populationYear < 2000 || b.populationYear > 2200)) ||
    !validCenter(b.center, b.code) || !b.observed || !b.mappedFinance || !b.provenance) return false;
  const o = b.observed;
  if (b.context !== undefined && !validCityContext(b.context, b.year, { revenue: o?.revenue, savings: o?.savings, investment: o?.investment, debt: o?.debt })) return false;
  if (Object.keys(FIELDS).some(key => !finite(o[key as keyof Observed]) || o[key as keyof Observed] < 0) ||
    o.revenue <= 0 || o.operating < o.financialCharges ||
    Math.abs(o.revenue - o.operating - o.savings) > 0.02 || o.savings < Math.min(o.repayment, o.debt)) return false;
  const expected = mapFinance(o);
  if (Object.entries(expected).some(([key, value]) => b.mappedFinance[key as keyof Finance] !== value)) return false;
  if (!['producer', 'title', 'licence', 'source', 'extraction', 'snapshot'].every(key => text(b.provenance[key as keyof typeof b.provenance]))) return false;
  if (!b.provenance.source.startsWith('https://') || !b.provenance.snapshot.endsWith(`/data/${b.publication}/territoires/commune/${lot(b.code)}.json`)) return false;
  return Array.isArray(b.assumptions) && b.assumptions.length === ASSUMPTIONS.length && b.assumptions.every((a, i) => a === ASSUMPTIONS[i]);
}

async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}/${path}`, { signal });
  if (!response.ok) throw new Error('Les données des communes sont indisponibles. Réessayez avec une connexion.');
  return response.json() as Promise<T>;
}
let loaded: { publication: string; index: Index } | undefined;
async function catalogue(signal?: AbortSignal): Promise<{ publication: string; index: Index }> {
  signal?.throwIfAborted();
  if (loaded) return loaded;
  const pointer = await read<{ version: string }>('data/derniere.json', signal);
  if (typeof pointer.version !== 'string' || !PUBLICATION.test(pointer.version)) throw new Error('Publication des communes invalide.');
  const index = await read<Index>(`data/${pointer.version}/territoires/commune/index.json`, signal);
  if (!Array.isArray(index.codes) || !Array.isArray(index.noms) || !Array.isArray(index.parents) || !Array.isArray(index.population_municipale) ||
    [index.noms, index.parents, index.population_municipale].some(a => a.length !== index.codes.length)) throw new Error('Répertoire des communes incomplet.');
  // Only successful, complete requests are cached. An aborted search never poisons later searches.
  return loaded = { publication: pointer.version, index };
}

/** At most 12 commune names, accent insensitive. Codes are INSEE, never postal codes. */
export async function searchCities(query: string, signal?: AbortSignal): Promise<CitySearchResult[]> {
  signal?.throwIfAborted();
  const needle = normalise(query.trim());
  if (needle.length < 2) return [];
  const { index } = await catalogue(signal);
  return index.codes.flatMap((code, i) => {
    const name = index.noms[i];
    if (!CODE.test(code) || !text(name)) return [];
    const normalized = normalise(name);
    if (!normalized.includes(needle) && !code.toLowerCase().startsWith(needle)) return [];
    return [{ code, name, department: index.parents[i] ?? lot(code), rank: code.toLowerCase() === needle || normalized === needle ? 0 : normalized.startsWith(needle) ? 1 : 2 }];
  }).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'fr')).slice(0, 12)
    .map(({ code, name, department }) => Object.freeze({ code, name, department }));
}

async function loadCenter(code: string, signal?: AbortSignal): Promise<CityBaseline['center']> {
  const source = `https://geo.api.gouv.fr/communes/${code}?fields=centre`;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 3000);
  try {
    signal?.throwIfAborted();
    const response = await fetch(source, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json() as { centre?: { type: string; coordinates: number[] } };
    if (data.centre?.type !== 'Point' || !Array.isArray(data.centre.coordinates) || data.centre.coordinates.length !== 2) return null;
    const center = { longitude: data.centre.coordinates[0], latitude: data.centre.coordinates[1], source };
    return validCenter(center, code) ? Object.freeze(center) : null;
  } catch {
    signal?.throwIfAborted();
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

/** Downloads one departmental lot, strips histories and personal fields, freezes an offline-ready snapshot. */
export async function loadCity(code: string, signal?: AbortSignal): Promise<CityBaseline> {
  if (!CODE.test(code)) throw new Error('Code INSEE de commune invalide.');
  const { publication, index } = await catalogue(signal);
  const position = index.codes.indexOf(code);
  if (position < 0) throw new Error('Cette commune ne figure pas dans la publication disponible.');
  const path = `data/${publication}/territoires/commune/${lot(code)}.json`;
  const [territories, manifest, center] = await Promise.all([
    read<Record<string, Territory>>(path, signal), read<Manifest>(`data/${publication}/manifeste.json`, signal), loadCenter(code, signal),
  ]);
  const territory = territories[code];
  const source = manifest.jeux?.find(j => j.id === 'ofgl-communes');
  if (!territory?.series || !source) return fail();
  // Latest complete year, not an assembly of unrelated vintages.
  const year = Object.keys(territory.series[FIELDS.revenue] ?? {}).filter(y => /^\d{4}$/.test(y) &&
    Object.values(FIELDS).every(id => finite(territory.series[id]?.[y]))).sort().at(-1);
  if (!year) return fail();
  const observed = Object.freeze(Object.fromEntries(Object.entries(FIELDS).map(([key, id]) => [key, territory.series[id][year]])) as Observed);
  const baseline = {
    version: 1 as const, code, name: territory.nom, population: index.population_municipale[position],
    populationYear: index.millesime_geographique ?? null, year: Number(year), publication, observed,
    mappedFinance: Object.freeze(mapFinance(observed)), center,
    provenance: Object.freeze({ producer: source.producteur, title: source.titre, licence: source.licence, source: source.url, extraction: source.extraction, snapshot: `${BASE}/${path}` }),
    assumptions: ASSUMPTIONS,
    context: extractCityContext(territory.series, territory.drapeaux, Number(year)),
  };
  if (!validateCityBaseline(baseline)) return fail();
  return Object.freeze(baseline);
}
