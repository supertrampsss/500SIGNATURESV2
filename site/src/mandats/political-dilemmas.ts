import type { Choice, Dossier, Game } from './types.ts';
import type { PoliticalAction, PoliticalChoice, PendingCrisis } from './politics-types.ts';

const activePackage = (g: Game) => g.politics?.commitments.find(c => c.id === 'wealth-hospital' && (c.status === 'pending' || c.status === 'honored'));

const euro = (effect: Choice['effect']) => {
  const labels: Array<[keyof Choice['effect'], string]> = [
    ['revenue', 'recettes'], ['operating', 'dépenses de fonctionnement'], ['investment', 'investissement'],
    ['grants', 'subventions'], ['repayment', 'remboursements'],
  ];
  const parts = labels.flatMap(([key, label]) => {
    const value = effect[key];
    return typeof value === 'number' && value !== 0 ? [`${value > 0 ? '+' : '−'}${Math.abs(value)} Md€/an ${label}`] : [];
  });
  return parts.join(' · ') || 'Sans effet budgétaire direct';
};

function option(
  id: string,
  title: string,
  description: string,
  benefit: string,
  sacrifice: string,
  effect: Choice['effect'],
  political: PoliticalChoice,
): Choice {
  return { id, title, description, benefit, sacrifice, cost: euro(effect), effect, political };
}

function dossier(category: string, title: string, story: string, advisor: string, choices: Choice[]): Dossier {
  return { category, title, story, advisor, choices };
}


function establishWealthHospital(g: Game): Dossier {
  return dossier('Finances publiques', 'Le prélèvement sur les patrimoines finance l’hôpital.',
    'Le gouvernement présente un même texte qui crée une contribution de 6 Md€/an sur les très hauts patrimoines et affecte 4 Md€/an supplémentaires aux hôpitaux. Son adoption crée un engagement parlementaire qui pourra être contesté par le groupe pivot.',
    'Le vote précède l’application des recettes et des crédits : un texte rejeté ne modifie ni les unes ni les autres.', [
      option('pol-wealth-hospital-package', 'Voter le prélèvement et financer les hôpitaux',
        'Adopter ensemble la nouvelle recette et l’ouverture de crédits hospitaliers.',
        'Les hôpitaux reçoivent 4 Md€/an supplémentaires et le budget perçoit 6 Md€/an.',
        'Les très hauts patrimoines contribuent davantage ; le groupe pivot pourra demander le retrait de la mesure.',
        { revenue: 6, operating: 4, services: 3, society: { affluent: -3, vulnerable: 2, publicStaff: 2 } },
        { action: 'enact', commitment: { id: 'wealth-hospital', label: 'Prélèvement patrimonial et financement hospitalier votés', dueTurn: g.turn + 1 }, legitimacy: 2 }),
      option('pol-wealth-hospital-reject', 'Ne pas déposer le prélèvement ni le financement hospitalier',
        'Retirer le paquet avant son dépôt à l’Assemblée.',
        'Le budget ne crée ni cette recette ni ces crédits hospitaliers.',
        'Les hôpitaux ne reçoivent pas les 4 Md€/an proposés et le budget ne perçoit pas les 6 Md€/an attendus.',
        {},
        { action: 'confidence', supportDelta: { reformist: 3, social: -5 }, legitimacy: -2 }),
    ]);
}

const coalition = (g: Game): Dossier | null => {
  const promise = activePackage(g);
  if (!promise) return null;
  return dossier('Assemblée nationale', 'Le budget ou votre promesse ?',
    'Le groupe pivot conditionne son vote du budget au retrait partiel du prélèvement et des crédits hospitaliers déjà votés.',
    'Les chiffres correspondent aux mesures déjà votées dans cette partie. Le scrutin sur le compromis est compté avant son application.', [
      option('pol-coalition-compromise', 'Réduire le prélèvement et les crédits hospitaliers',
        'Déposer le compromis au vote ; les deux lignes déjà financées diminuent si le texte est adopté.',
        'Le groupe pivot maintient son soutien au gouvernement.',
        'L’hôpital perd 4 Md€/an et le budget perd 6 Md€/an de recettes ; l’engagement est rompu.',
        { revenue: -6, operating: -4, services: -3, trust: -2 },
        { action: 'coalition_bargain', breakCommitment: 'wealth-hospital', targetBloc: 'reformist' }),
      option('pol-coalition-refuse', 'Maintenir le prélèvement et les crédits hospitaliers',
        'Refuser la concession et défendre les deux mesures déjà votées devant l’Assemblée.',
        'Les 6 Md€/an de recettes et les 4 Md€/an de crédits hospitaliers restent inscrits.',
        'Le groupe pivot retire son appui ; la motion de censure devient un risque immédiat.',
        { trust: 1 },
        { action: 'reject_bargain', supportDelta: { reformist: -12 }, legitimacy: 2, targetBloc: 'reformist' }),
    ]);
};

const censure = (g: Game): Dossier => {
 const previous=g.history.filter(turn=>turn.choice.startsWith('pol-censure-')).length;
 const lastRejected=[...g.history].reverse().find(turn=>turn.vote?.kind==='law'&&!turn.vote.passed);
 const title=g.politics?.failedBills && lastRejected
  ? ['Deux textes rejetés. Le gouvernement peut-il tenir ?', 'Le blocage parlementaire devient une motion de censure.', 'Un nouveau rejet ravive la menace de censure.'][previous % 3]
  : previous ? ['La censure revient. Qui soutient encore le gouvernement ?', 'Une nouvelle motion met votre majorité à l’épreuve.', 'Vos opposants tentent à nouveau de renverser le gouvernement.'][(previous - 1) % 3]
  : 'Votre allié retire son soutien. Le gouvernement joue sa survie.';
 return dossier('Assemblée nationale', title,
  `${g.politics?.failedBills && lastRejected ? `Le rejet de « ${lastRejected.title} » a aggravé le blocage. ` : ''}Il faut 289 voix pour renverser le gouvernement. Une censure adoptée impose de nommer un nouveau gouvernement ; vous restez président.`,
  'La motion est adoptée à la majorité absolue des membres. Le décompte par groupe détermine le résultat.', [
    option('pol-censure-vote', 'Défendre la ligne et soumettre la motion au vote',
      'L’Assemblée se prononce sur la motion de censure.',
      'Si elle est rejetée, le gouvernement reste en place.',
      'Si elle est adoptée, le gouvernement tombe et il faut former une nouvelle majorité ou dissoudre.',
      {}, { action: 'censure', vote: 'censure', legitimacy: -2, unrest: 2 }),
    option('pol-censure-withdraw', 'Négocier le retrait de la motion contre une coupe budgétaire',
      'Réduire de 2 Md€/an les crédits de fonctionnement de l’exécutif et négocier le retrait de la motion.',
      'L’accord parlementaire peut éviter la chute du gouvernement.',
      'Les moyens de fonctionnement de l’exécutif diminuent durablement.',
      { operating: -2, trust: -1 }, { action: 'coalition_bargain', legitimacy: -1, supportDelta: { reformist: 10 }, targetBloc: 'reformist' }),
  ]);
};

const cabinet = (g: Game): Dossier => {
  const packageActive = !!activePackage(g);
  const cohabitationEffect: Choice['effect'] = packageActive
    ? { revenue: -6, operating: -4, services: -3, trust: -2 }
    : { operating: -2, trust: -2 };
  const cohabitationDescription = packageActive
    ? 'Former une cohabitation et soumettre à l’Assemblée le retrait du prélèvement patrimonial et des crédits hospitaliers associés.'
    : 'Former une cohabitation et soumettre à l’Assemblée une réduction de 2 Md€/an des crédits de fonctionnement de l’exécutif.';
  const cohabitationSacrifice = packageActive
    ? 'La promesse fiscale est rompue : 6 Md€/an de recettes et 4 Md€/an de crédits hospitaliers disparaissent.'
    : 'Les administrations centrales perdent 2 Md€/an de crédits de fonctionnement.';
  return dossier('Institutions', 'Le gouvernement est tombé : qui peut gouverner ?',
    'La motion de censure a été adoptée. Le mandat présidentiel continue, mais le gouvernement ne peut plus conduire sa politique sans nouvel appui.',
    'Une cohabitation confie Matignon à une majorité d’opposition et exige un accord politique soumis à l’Assemblée. La dissolution provoque une élection législative et peut produire une majorité différente.', [
      option('pol-cabinet-cohabitation', 'Nommer un Premier ministre soutenu par l’opposition',
        cohabitationDescription,
        'Un accord soutenu par une majorité permet de former un gouvernement.',
        cohabitationSacrifice,
        cohabitationEffect,
        { action: 'coalition_government', vote: 'law', ...(packageActive ? { breakCommitment: 'wealth-hospital' } : {}), supportDelta: { social: 8, conservative: 8, regional: 5 } }),
      option('pol-cabinet-dissolve', 'Dissoudre l’Assemblée nationale',
        'Convoquer des élections législatives anticipées ; les 577 sièges sont redistribués selon les conditions du scénario.',
        'Une nouvelle majorité peut soutenir le gouvernement.',
        'Le scrutin peut aussi renforcer l’opposition et laisser le pays sans majorité.',
        {}, { action: 'dissolve', vote: 'election', legitimacy: -5, unrest: 8 }),
    ]);
};

const scandal = (g?: Game): Dossier => {
  const covered = g?.choices.some(id => id === 'pol-scandal-cover-up') ?? false;
  return dossier('Intégrité publique', covered ? 'Vous avez couvert le ministre.' : 'Votre ministre a détourné des fonds.',
  covered ? 'De nouveaux justificatifs confirment que le ministre a fait payer des dépenses personnelles sur des fonds publics après votre décision de retenir les premières pièces.' : 'Les justificatifs vérifiés montrent que le ministre a fait payer des dépenses personnelles sur des fonds publics. Vous devez décider de les publier ou de retenir les pièces.',
  'Le niveau d’exposition et les fautes déjà enregistrées déterminent si une procédure de destitution distincte peut suivre. La popularité ne constitue pas une faute.', [
    option('pol-scandal-publish', 'Publier les pièces et écarter le ministre',
      'Transmettre les justificatifs et mettre fin aux fonctions du ministre.',
      'L’institution ouvre une procédure transparente et réduit l’exposition au scandale.',
      'Le groupe qui protégeait le ministre retire une partie de son soutien ; le gouvernement peut être censuré.',
      { trust: 3 }, { action: 'publish_scandal', targetBloc: 'presidential', supportDelta: { presidential: -12, regional: -8 }, legitimacy: 7 }),
    option('pol-scandal-cover-up', 'Garder le ministre pour faire passer le budget',
      'Retenir les pièces et conserver l’appui du groupe pivot pour le prochain vote budgétaire.',
      'La coalition garde ses voix à court terme.',
      'La dissimulation accroît les fautes enregistrées et l’exposition ; une révélation ultérieure ouvre une nouvelle crise.',
      { trust: -4 }, { action: 'cover_up', targetBloc: 'reformist', supportDelta: { reformist: 5 }, legitimacy: -12, unrest: 18, misconduct: 2 }),
  ]);
};



const destitution = (): Dossier => dossier('Haute Cour', 'La Haute Cour examine la destitution',
  'Les fautes institutionnelles enregistrées atteignent le seuil nécessaire pour saisir la Haute Cour. La question porte sur les faits documentés, pas sur la popularité du président.',
  'La procédure prévoit la saisine par chacune des deux chambres, puis un vote distinct de la Haute Cour. Le seuil constitutionnel de deux tiers s’applique à chaque décision. Le scrutin ne se confond pas avec une motion de censure du gouvernement.', [
    option('pol-destitution-vote', 'Soumettre les faits à la procédure de la Haute Cour',
      'Soumettre les manquements établis à la procédure de saisine puis au vote de la Haute Cour.',
      'Les deux chambres se prononcent d’abord sur la saisine ; la Haute Cour décide ensuite de la destitution.',
      'Si la motion échoue, l’exposition institutionnelle demeure.',
      {}, { action: 'destitute', vote: 'destitution', legitimacy: -3, unrest: 3 }),
    option('pol-destitution-transition', 'Négocier une transition avant la décision de la Haute Cour',
      'Mettre fin au mandat par une transition négociée avant l’issue de la procédure.',
      'Éviter une destitution votée et organiser un passage de relais.',
      'Le mandat s’achève immédiatement avant son terme.',
      { trust: -2 }, { action: 'negotiate_rupture', legitimacy: -5, unrest: 2 }),
  ]);

const rupture = (g: Game): Dossier => {
  const emergencyUses = g.politics?.emergencyUses ?? 0;
  const secondUse = emergencyUses >= 1;
  return dossier('Institutions', 'Ils demandent votre départ.',
    secondUse
      ? 'La crise persiste après un premier recours aux pouvoirs d’urgence. Une seconde utilisation mettra fin au mandat ; vous pouvez aussi négocier une transition.'
      : 'La contestation déborde, la légitimité s’est effondrée et le gouvernement est tombé. Vous pouvez négocier une transition ou mobiliser des crédits d’urgence au prix d’une crise plus profonde.',
    'Les pouvoirs d’urgence peuvent être utilisés deux fois au plus. Une seconde utilisation met fin au mandat ; elle ne rétablit ni la légitimité ni l’appui parlementaire.', [
      option('pol-rupture-negotiate', 'Négocier une transition et quitter le pouvoir',
        'Convenir d’un calendrier de transition avec les institutions et mettre fin au mandat.',
        'La sortie négociée ferme la crise et enregistre ses causes.',
        'Le mandat s’achève avant son terme.',
        {}, { action: 'negotiate_rupture' }),
      option('pol-rupture-emergency', secondUse ? 'Recourir une seconde fois aux pouvoirs d’urgence' : 'Déclarer l’état d’urgence pour financer les services essentiels',
        secondUse ? 'Mobiliser une nouvelle fois les crédits d’urgence ; cette seconde utilisation met fin au mandat.' : 'Affecter 4 Md€/an de crédits supplémentaires aux services de continuité.',
        secondUse ? 'Les services disposent de 4 Md€/an supplémentaires avant la fin du mandat.' : 'Les services essentiels disposent de 4 Md€/an supplémentaires.',
        secondUse ? 'Le mandat s’achève et les contre-pouvoirs restent fragilisés.' : 'Les contre-pouvoirs reculent, la légitimité chute et la contestation s’intensifie.',
        { operating: 4, services: 3, trust: -5, cohesion: -5 }, { action: 'emergency_rule', legitimacy: -22, unrest: 12 }),
    ]);
};

/** Returns a real decision dossier only when replayed political state requests one. */
export function politicalDossier(g: Game): Dossier | null {
  const promise = activePackage(g);
  if (!g.politics?.pendingCrisis && !promise && g.turn === 0) return establishWealthHospital(g);
  if (!g.politics?.pendingCrisis && g.turn >= 12 && g.seed % 3 === 0 && !g.choices.some(id => id.startsWith('pol-scandal-'))) return scandal(g);
  if (!g.politics?.pendingCrisis && (g.politics?.scandalExposure ?? 0) >= 2 && (g.politics?.misconduct ?? 0) >= 3) return scandal(g);
  const pending: PendingCrisis | undefined = g.politics?.pendingCrisis;
  if (!pending) return null;
  switch (pending) {
    case 'coalition': return coalition(g);
    case 'censure': return censure(g);
    case 'cabinet': return cabinet(g);
    case 'scandal': return scandal(g);
    case 'destitution': return destitution();
    case 'rupture': return rupture(g);
  }
}

/** Keep the exact action union visible to content tests and future dossier authors. */
export const POLITICAL_ACTIONS: readonly PoliticalAction[] = [
  'enact', 'coalition_bargain', 'reject_bargain', 'confidence', 'censure', 'coalition_government',
  'dissolve', 'publish_scandal', 'cover_up', 'destitute', 'negotiate_rupture', 'emergency_rule',
];
