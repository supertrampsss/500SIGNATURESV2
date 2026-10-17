import type { Choice, Game } from './types.ts';
import type { PressureProgramme, PressureSectorId } from './pressure-types.ts';

export type PresidencyCrisis = {
  id: string; spec: string; sector: PressureSectorId; startedPeriod: number;
  sourceJournalIndex: number; deadline: number; status: 'active' | 'contained' | 'resolved';
  parentId?: string; propagated?: boolean; resolvedPeriod?: number;
};
type Response = { id: string; title: string; detail: string; sacrifice: string; investment: number;
  operating: number; delay: number; work: number; capacity: number; duration?: number; outcome: 'contain' | 'resolve' };
type CrisisSpec = { id: string; sector: PressureSectorId; title: string; cause: string; worsening: string;
  recovery: string; loss: number; need: number; deadline: number; propagation: string; responses: readonly Response[] };
const response = (id: string, title: string, detail: string, sacrifice: string, investment: number,
  operating: number, delay: number, work: number, capacity: number, outcome: 'contain' | 'resolve', duration?: number): Response =>
  ({ id, title, detail, sacrifice, investment, operating, delay, work, capacity, outcome, duration });
/** Authored simulation hypotheses. Each response has specific costs, delays and
 * sacrifices, all using the same finite workforce as ordinary programmes. */
export const PRESIDENCY_CRISES: readonly CrisisSpec[] = [
  { id: 'cyber', sector: 'health', title: 'Hôpital paralysé', cause: 'Une cyberattaque bloque les dossiers et désorganise les admissions.',
    worsening: 'Les admissions sont réorientées ; les transferts s’accumulent.', recovery: 'Les admissions reprennent ; les soins reportés restent à rattraper.', loss: 2.4, need: .6, deadline: 2, propagation: 'ambulances', responses: [
      response('papier', 'Passer en dossiers papier', 'Organiser les soins en mode dégradé pendant quatre mois.', 'La panne informatique reste ouverte.', 0, .36, 1, 1, .3, 'contain', 2),
      response('restaurer', 'Restaurer les systèmes isolés', 'Reconstruire les accès sécurisés avant de reconnecter les services.', 'Deux unités d’exécution par période pendant quatre mois minimum.', .55, 0, 2, 2, .4, 'resolve') ] },
  { id: 'transformateur', sector: 'energy', title: 'Réseau électrique coupé', cause: 'Un transformateur endommagé prive plusieurs équipements de leur alimentation habituelle.',
    worsening: 'Les équipements de secours fatiguent et des services ferment.', recovery: 'Le réseau reprend son alimentation normale.', loss: 2.3, need: .4, deadline: 2, propagation: 'medicaments', responses: [
      response('groupes', 'Déployer les groupes de secours', 'Alimenter les équipements prioritaires pendant six mois.', 'Les groupes ne réparent pas le réseau.', .05, .3, 1, 1, .2, 'contain', 3),
      response('remplacer', 'Remplacer le transformateur', 'Réparer le point de rupture avec une équipe spécialisée.', 'L’équipe reste mobilisée quatre mois minimum.', .65, 0, 2, 2, .6, 'resolve') ] },
  { id: 'port', sector: 'transport', title: 'Port bloqué', cause: 'Un conflit sur les horaires interrompt le chargement des marchandises.',
    worsening: 'Les stocks de pièces et de fournitures diminuent.', recovery: 'Les quais rouvrent et les livraisons redémarrent.', loss: 2.2, need: .5, deadline: 2, propagation: 'medicaments', responses: [
      response('detourner', 'Détourner les livraisons', 'Réserver des itinéraires alternatifs pendant quatre mois.', 'Deux unités logistiques mobilisées ; le conflit reste ouvert.', 0, .6, 1, 2, .4, 'contain', 2),
      response('accord', 'Négocier un accord sur les horaires', 'Financer les rotations supplémentaires et préparer la reprise.', 'Le nouvel accord conserve un coût annuel.', .08, .18, 2, 1, .5, 'resolve') ] },
  { id: 'evacuation', sector: 'housing', title: 'Immeubles évacués', cause: 'Une expertise impose l’évacuation de logements dangereux.',
    worsening: 'L’hébergement provisoire se remplit.', recovery: 'Les logements sécurisés accueillent à nouveau les habitants.', loss: 1.4, need: 1.6, deadline: 3, propagation: 'guichets', responses: [
      response('heberger', 'Réserver des hébergements relais', 'Mettre les familles à l’abri pendant six mois.', 'Aucun logement n’est remis en état.', 0, .48, 1, 1, .4, 'contain', 3),
      response('securiser', 'Sécuriser et réouvrir les logements', 'Engager les travaux puis les contrôles de sécurité.', 'Six mois minimum avec deux unités de chantier par période.', .72, 0, 3, 2, .8, 'resolve') ] },
  { id: 'chaleur', sector: 'education', title: 'Écoles sous forte chaleur', cause: 'Des salles surchauffées ne permettent plus d’assurer tous les cours.',
    worsening: 'Les fermetures partielles désorganisent les familles.', recovery: 'Les salles protégées retrouvent leurs horaires.', loss: 1.8, need: .6, deadline: 2, propagation: 'guichets', responses: [
      response('horaires', 'Décaler les cours et ouvrir des salles relais', 'Maintenir une partie des cours pendant quatre mois.', 'Les familles doivent adapter leurs horaires.', .04, .24, 1, 1, .3, 'contain', 2),
      response('ombrage', 'Protéger les salles les plus exposées', 'Installer ombrage et ventilation avant réouverture.', 'Quatre mois minimum de travaux.', .48, .04, 2, 2, .6, 'resolve') ] },
  { id: 'guichets', sector: 'administration', title: 'Démarches engorgées', cause: 'Un afflux de dossiers dépasse les permanences disponibles.',
    worsening: 'Les autorisations attendues ralentissent logements et travaux.', recovery: 'Les demandes retrouvent un circuit d’instruction.', loss: 1.6, need: 1, deadline: 2, propagation: 'permis', responses: [
      response('permanences', 'Ouvrir des permanences du soir', 'Mobiliser une équipe temporaire pendant six mois.', 'Le renfort expire après six mois.', 0, .3, 1, 1, .5, 'contain', 3),
      response('simplifier', 'Unifier l’instruction des dossiers', 'Former les agents à une procédure commune avec recours.', 'Quatre mois de transition, équipes indisponibles ailleurs.', .28, .1, 2, 1, .7, 'resolve') ] },
  { id: 'medicaments', sector: 'health', title: 'Médicaments en attente', cause: 'Les approvisionnements perturbés réduisent les fournitures disponibles pour les soins.',
    worsening: 'Les reports de soins augmentent faute de fournitures.', recovery: 'Les approvisionnements sont rétablis.', loss: 1.6, need: .7, deadline: 2, propagation: 'ambulances', responses: [
      response('reserves', 'Mobiliser les réserves sanitaires', 'Distribuer les stocks de secours pendant quatre mois.', 'Les livraisons restent fragiles.', .03, .36, 1, 1, .4, 'contain', 2),
      response('fournisseurs', 'Sécuriser un circuit alternatif', 'Contrôler et contractualiser un nouvel approvisionnement.', 'Quatre mois de contrôles avec la logistique.', .32, .14, 2, 2, .5, 'resolve') ] },
  { id: 'ambulances', sector: 'transport', title: 'Transferts sanitaires débordés', cause: 'Les transferts entre établissements saturent les véhicules disponibles.',
    worsening: 'Les trajets urgents empiètent sur les autres déplacements.', recovery: 'Les rotations retrouvent des créneaux disponibles.', loss: 1.3, need: 1.1, deadline: 2, propagation: 'remplacements', responses: [
      response('rotations', 'Affréter des véhicules sanitaires', 'Ajouter des rotations pendant quatre mois.', 'L’affrètement expire ; la cause des transferts reste ouverte.', 0, .48, 1, 1, .6, 'contain', 2),
      response('regulation', 'Créer une régulation des transferts', 'Partager les places et les véhicules entre établissements.', 'Quatre mois de formation et de coordination.', .26, .08, 2, 1, .5, 'resolve') ] },
  { id: 'permis', sector: 'housing', title: 'Chantiers de logement à l’arrêt', cause: 'Des autorisations en attente bloquent les mises en service.',
    worsening: 'Les logements attendus ne peuvent pas accueillir leurs habitants.', recovery: 'Les chantiers peuvent reprendre.', loss: 1.4, need: .8, deadline: 3, propagation: 'recrutement', responses: [
      response('cellule', 'Monter une cellule de déblocage', 'Traiter les dossiers prêts pendant six mois.', 'Deux unités d’exécution retirées aux autres chantiers.', 0, .36, 1, 2, .5, 'contain', 3),
      response('instruction', 'Partager les équipes d’instruction', 'Installer un traitement durable des demandes.', 'Quatre mois de préparation et une charge annuelle.', .22, .12, 2, 1, .7, 'resolve') ] },
  { id: 'recrutement', sector: 'administration', title: 'Postes publics non pourvus', cause: 'Les difficultés de logement et de mobilité freinent les prises de poste.',
    worsening: 'Les permanences ferment des créneaux faute d’agents.', recovery: 'Les agents prennent leurs postes.', loss: 1.8, need: .3, deadline: 3, propagation: 'permis', responses: [
      response('mobilite', 'Financer la mobilité des recrues', 'Accompagner les prises de poste pendant six mois.', 'L’accompagnement expire et mobilise les crédits communs.', 0, .42, 1, 1, .5, 'contain', 3),
      response('former', 'Former et affecter les équipes locales', 'Ouvrir une session ciblée sur les postes vacants.', 'Six mois de formation avant la prise de poste.', .3, .15, 3, 1, .9, 'resolve') ] },
  { id: 'maintenance', sector: 'energy', title: 'Maintenance du réseau reportée', cause: 'Les pièces manquantes retardent l’entretien des équipements.',
    worsening: 'Les indisponibilités fragilisent les autres services.', recovery: 'Les équipements entretenus reprennent leur service.', loss: 1.7, need: .4, deadline: 3, propagation: 'transformateur', responses: [
      response('inspection', 'Renforcer les inspections de sécurité', 'Maintenir un fonctionnement réduit pendant quatre mois.', 'Les réparations de fond restent nécessaires.', 0, .24, 1, 1, .2, 'contain', 2),
      response('reparer', 'Acheter les pièces et réparer', 'Remettre les équipements en état.', 'Six mois minimum en concurrence avec les autres chantiers.', .5, 0, 3, 2, .8, 'resolve') ] },
  { id: 'remplacements', sector: 'education', title: 'Classes sans remplacement', cause: 'Des absences simultanées dépassent les enseignants disponibles.',
    worsening: 'Les heures perdues désorganisent les familles.', recovery: 'Les remplacements assurent de nouveau les cours.', loss: 1.6, need: .5, deadline: 2, propagation: 'guichets', responses: [
      response('vacataires', 'Mobiliser des remplaçants temporaires', 'Ouvrir des vacations pendant six mois.', 'Le vivier doit être renouvelé après six mois.', 0, .3, 1, 1, .5, 'contain', 3),
      response('vivier', 'Former un vivier de remplacement', 'Préparer une équipe permanente de remplaçants.', 'Six mois de formation et un coût annuel durable.', .24, .16, 3, 1, .8, 'resolve') ] },
];
export const crisisSpec = (crisis: PresidencyCrisis): CrisisSpec => PRESIDENCY_CRISES.find(item => item.id === crisis.spec)!;
const round = (n: number) => Math.round(n * 1000) / 1000;
const active = (g: Game) => g.presidency?.crises?.filter(c => c.status !== 'resolved') ?? [];
export function crisisPhase(crisis: PresidencyCrisis, programmes: readonly PressureProgramme[], period: number): PresidencyCrisis['status'] {
  const delivered = programmes.filter(p => p.crisisId === crisis.id && p.deliveredTurn !== undefined && p.deliveredTurn <= period);
  if (delivered.some(p => p.crisisOutcome === 'resolve' && p.status !== 'cancelled')) return 'resolved';
  if (delivered.some(p => p.crisisOutcome === 'contain' && p.status !== 'cancelled' && (p.endsTurn ?? Infinity) > period)) return 'contained';
  return 'active';
}
export function crisisSeverity(crisis: PresidencyCrisis, period: number): number {
  return crisis.status === 'contained' ? 1 : Math.min(3, 1 + Math.floor(Math.max(0, period - crisis.startedPeriod) / crisis.deadline));
}
export function crisisImpact(g: Game, sector: PressureSectorId, programmes: readonly PressureProgramme[], period: number): { loss: number; need: number; labels: string[] } {
  let loss = 0, need = 0; const labels: string[] = [];
  for (const crisis of g.presidency?.crises ?? []) {
    if (crisis.sector !== sector) continue;
    const phase = crisisPhase(crisis, programmes, period);
    if (phase === 'resolved') continue;
    const spec = crisisSpec(crisis), severity = crisisSeverity({ ...crisis, status: phase }, period);
    const factor = phase === 'contained' ? .2 : 1 + (severity - 1) * .4;
    loss += spec.loss * factor; need += spec.need * factor;
    labels.push(`${spec.title} : capacité −${round(spec.loss * factor)}, besoins +${round(spec.need * factor)} par période (simulation).`);
  }
  return { loss: round(loss), need: round(need), labels };
}
export function crisisChoices(g: Game, sector: PressureSectorId): Choice[] {
  return active(g).filter(c => c.sector === sector).flatMap(crisis => {
    const programmes = g.pressure!.programmes.filter(p => p.crisisId === crisis.id);
    if (programmes.some(p => p.status === 'preparing')) return [];
    return crisisSpec(crisis).responses.filter(r => !(crisis.status === 'contained' && r.outcome === 'contain')).map(r => ({
      id: `live-crisis-${crisis.id}-${r.id}`, title: r.title, description: r.detail,
      cost: `${r.investment.toLocaleString('fr-FR')} Md€ d’investissement · ${r.operating.toLocaleString('fr-FR')} Md€/an${r.duration ? ` pendant ${r.duration * 2} mois` : ''}`,
      benefit: r.outcome === 'resolve' ? 'Incident levé après livraison ; les retards acquis restent à traiter.' : `Perturbation réduite de 80 % pendant ${r.duration! * 2} mois après livraison.`,
      sacrifice: r.sacrifice, effect: { investment: r.investment, ...(r.duration ? { temporaryOperating: r.operating } : { operating: r.operating }) },
      pressure: { sector, kind: r.duration ? 'relief' as const : 'programme' as const, label: r.title, capacity: r.capacity,
        delay: r.delay, implementation: r.work, ...(r.duration ? { duration: r.duration } : {}), crisisId: crisis.id, crisisOutcome: r.outcome },
      political: { action: 'administrative' as const },
    }));
  });
}
function spawn(g: Game, spec: CrisisSpec, parentId?: string): void {
  const p = g.presidency!; p.crises ??= [];
  p.crises.push({ id: `${spec.id}-${g.turn}`, spec: spec.id, sector: spec.sector,
    startedPeriod: g.turn, sourceJournalIndex: g.choices.length, deadline: spec.deadline, status: 'active', ...(parentId ? { parentId } : {}) });
  p.lastEvents.push(`${spec.title}. ${parentId ? `Conséquence de « ${crisisSpec(p.crises.find(c => c.id === parentId)!).title} ». ` : ''}${spec.cause}`);
}
export function initialCrises(g: Game): void {
  const p = g.presidency!; p.crises = []; p.nextCrisisPeriod = 2;
  spawn(g, PRESIDENCY_CRISES[g.seed % 6]);
}
/** One call per clock transition. Children cannot propagate on their birth tick. */
export function advanceCrises(g: Game, previous: Game): void {
  const p = g.presidency!; if (!p.crises) return;
  let resolved = false;
  for (const c of p.crises) {
    const phase = crisisPhase(c, g.pressure!.programmes, g.turn);
    if (phase !== c.status) {
      p.lastEvents.push(phase === 'resolved' ? crisisSpec(c).recovery : phase === 'contained' ? `${crisisSpec(c).title} : le secours est opérationnel.` : `${crisisSpec(c).title} : le secours expire, la cause reste ouverte.`);
      if (phase === 'resolved') { c.resolvedPeriod = g.turn; resolved = true; }
      c.status = phase;
    }
  }
  if (resolved && !active(g).length) p.quietUntilPeriod = g.turn + 2;
  if (g.turn >= 27 || g.turn < (p.quietUntilPeriod ?? 0)) return;
  const used = new Set(p.crises.map(c => c.spec));
  for (const old of previous.presidency?.crises ?? []) {
    const c = p.crises.find(item => item.id === old.id)!;
    if (old.status !== 'active' || c.status !== 'active' || c.propagated || g.turn - old.startedPeriod < old.deadline || active(g).length >= 3) continue;
    const target = PRESIDENCY_CRISES.find(s => s.id === crisisSpec(old).propagation)!;
    if (used.has(target.id)) continue;
    spawn(g, target, old.id); c.propagated = true; used.add(target.id);
  }
  if (g.turn < (p.nextCrisisPeriod ?? 2) || active(g).length >= 3) return;
  const candidates = PRESIDENCY_CRISES.filter(s => !used.has(s.id));
  candidates.sort((a, b) => {
    const score = (s: CrisisSpec) => g.pressure!.sectors[s.sector].pressure + ((g.seed * 13 + g.turn * 17 + PRESIDENCY_CRISES.indexOf(s) * 23) % 41);
    return score(b) - score(a) || a.id.localeCompare(b.id);
  });
  if (candidates[0]) spawn(g, candidates[0]);
  p.nextCrisisPeriod = g.turn + 3 + g.seed % 2;
}
