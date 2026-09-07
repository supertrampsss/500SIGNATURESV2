import { campaignCost } from './campaign-content.ts';
import { REFORMS } from './national-reforms.ts';
import { SOCIETY_LABELS } from './national-society.ts';
import type { Choice, Dossier, Effect, Game, Society } from './types.ts';

const advisor = 'Modèle v7 : enveloppes et rendements hypothétiques, effets sociaux simulés. Les économies portent sur des budgets distincts ; une suite ne recompte pas la réforme initiale.';
function choice(id: string, title: string, effect: Effect, sacrifice: string, delayed?: Choice['delayed']): Choice {
  return { id, title, effect, sacrifice, description: sacrifice,
    benefit: 'La décision modifie la trajectoire et les dossiers suivants.',
    cost: campaignCost(effect, delayed, 'Md€'), ...(delayed ? { delayed } : {}) };
}
function dossier(category: string, title: string, story: string, choices: Choice[]): Dossier {
  return { category, title, story, advisor, choices };
}
const social = (group: keyof Society, value: number): Partial<Society> => ({ [group]: value });
const localServices = [
 'l’aide à l’autonomie','l’accueil administratif','l’aide aux achats essentiels','l’appui aux petites entreprises',
 'les soins de proximité','l’accompagnement social','l’insertion professionnelle','les activités associatives',
 'l’emploi des seniors','les consultations hospitalières','la formation des agents','la sécurisation des parcours',
 'la conversion énergétique','la remise en location','les permanences communales','les jeunes entreprises innovantes',
 'l’accueil des enfants','la création culturelle','les projets de coopération','les projets territoriaux',
];
const stories = [
 'Les pensions constituent un engagement durable. Réduire leur montant, augmenter l’impôt des retraités ou préserver leurs revenus répartit différemment l’effort.',
 'Des agents partent à la retraite. Vous pouvez supprimer leurs postes, financer les remplacements ou renforcer les accueils.',
 'Les aides à la consommation soutiennent le pouvoir d’achat. Les réduire et relever la TVA n’affectent pas les ménages de la même manière.',
 'Les entreprises bénéficient de subventions et d’exonérations distinctes. Vous arbitrez entre soutien à l’activité et financement public.',
 'Les remboursements protègent les patients. Les réduire transfère la dépense ; une contribution supplémentaire répartit autrement le financement.',
 'Les plafonds d’accès aux aides déterminent qui reste protégé. Les resserrer réduit la dépense mais exclut des ménages.',
 'La résidence peut conditionner certaines aides. Une nouvelle règle nécessite une transition juridique et administrative.',
 'Les associations proposent des activités et emploient des salariés. Couper les subventions implique de décider quelles activités disparaissent.',
 'Un départ plus tardif réduit la durée de versement des pensions, mais tous les seniors ne retrouvent pas un emploi.',
 'Certains hôpitaux peuvent être regroupés. Les économies de fonctionnement doivent être mises en regard de la distance pour les patients.',
 'Les rémunérations publiques influencent les recrutements. Leur gel réduit les charges et le pouvoir d’achat des agents.',
 'Une indemnisation plus courte réduit les dépenses. Elle peut aussi laisser des demandeurs d’emploi sans revenu avant leur retour au travail.',
 'Les soutiens aux usages fossiles amortissent les factures. Leur suppression accélère le besoin de conversion et renchérit certains usages.',
 'Les aides au logement réduisent l’effort des locataires. Les supprimer peut créer des impayés, tandis que taxer le patrimoine immobilier déplace l’effort.',
 'Plusieurs collectivités disposent de fonctions similaires. Les regrouper réduit les coûts et change l’accès aux services.',
 'La recherche reçoit des subventions et un soutien fiscal. Réduire ces deux enveloppes n’affecte pas les mêmes projets.',
 'Les allocations familiales et les avantages fiscaux répartissent le soutien entre foyers. Vous décidez qui doit contribuer davantage.',
 'L’audiovisuel et les opérateurs culturels dépendent de financements publics. Une réduction implique des programmes et activités en moins.',
 'La coopération soutient des projets à l’étranger. Réduire ces engagements libère des moyens mais limite les interventions futures.',
 'Les grands projets engagent des budgets pour longtemps. Renoncer à de nouveaux programmes réduit les charges et les infrastructures futures.',
];
const roots = REFORMS.map((r,index) => dossier(r.category, r.question, stories[index],
  [
    choice(r.id+'a', r.cut, { operating: -r.saving, services: -2, cohesion: -2, trust: -1, society: social(r.group,r.id === "r01" ? -15 : -6) }, r.sacrifice),
    choice(r.id+'b', r.tax, { revenue: r.yield, trust: -2, society: r.taxSociety }, r.taxSacrifice),
    choice(r.id+'c', 'Renforcer '+localServices[index], { operating: 2, services: 2, cohesion: 1, society: social(r.group,4) }, 'Les bénéficiaires sont mieux protégés. Le déficit augmente de 2 Md€/an.'),
  ]));
// A proposal does not instantaneously change existing law or yield a claimed 9 Md€.
roots[6].story = 'Le délai de cinq ans concerne ici une réforme envisagée des aides non contributives. Sa mise en œuvre suppose un changement du cadre juridique, traité au dossier suivant. Aucun gain de 9 Md€ ne lui est attribué.';
roots[6].choices[0] = choice('r07a', REFORMS[6].cut, { investment: .2, trust: -1 },
  'La préparation des systèmes de gestion coûte 0,2 Md€ cette année. Aucune économie n’est encore réalisée.');
roots[6].choices[0].physicalProject = false;

const followUps = REFORMS.map((r,index) => [
  dossier(r.category, r.afterCut, 'La réduction votée modifie les conditions de vie. Vous devez décider de maintenir la réforme, de compenser ses effets ou de revenir dessus.', [
    choice(r.id+'-cuta', 'Maintenir la réforme et ses économies', { trust: -1, society: social(r.group,-2) }, 'Les personnes concernées continuent de supporter la baisse. Aucune nouvelle économie n’est comptée.'),
    choice(r.id+'-cutb', 'Financer une compensation ciblée', { operating: 2, cohesion: 2, services: 1, society: social(r.group,5) }, 'La compensation coûte 2 Md€/an ; la réforme initiale reste en place.'),
    choice(r.id+'-cutc', 'Retirer la réduction votée', { operating: r.saving * Math.pow(1.018, Math.floor((2*index+1)/9)-Math.floor(2*index/9)), services: 2, cohesion: 2, society: social(r.group,r.id === "r01" ? 15 : 6) }, 'L’économie initiale disparaît et les moyens sont rétablis.'),
  ]),
  dossier(r.category, r.afterOther, 'La réduction initiale n’a pas été votée. Un arbitrage distinct sur les moyens de proximité devient possible.', [
    choice(r.id+'-othera', 'Réduire les moyens pour '+localServices[index], { operating: -2, services: -1, society: social(r.group,-2) }, 'Une enveloppe distincte de 2 Md€/an est supprimée ; une partie des usagers perd ce soutien.'),
    choice(r.id+'-otherb', 'Financer '+localServices[index]+' par une contribution ciblée', { revenue: 2, trust: -1, society: social(r.group,-2) }, 'Les bénéficiaires imposables concernés financent 2 Md€/an de recettes supplémentaires.'),
    choice(r.id+'-otherc', 'Renforcer '+localServices[index], { operating: 2, services: 2, society: social(r.group,4) }, 'Les moyens augmentent de 2 Md€/an et aggravent le déficit.'),
  ]),
]);
followUps[6][0] = dossier('Résidence et aides', 'Comment poursuivre la réforme des cinq ans de résidence ?',
  'La règle générale de cinq ans ne devient pas applicable par ce seul vote. Le premier choix explore explicitement un scénario où le cadre juridique a été modifié, avec exemptions. Son rendement est une hypothèse de jeu.',
  [
    choice('r07-cuta', 'Poursuivre sous un cadre juridique modifié', { operating: .5, trust: -2 },
      'L’administration coûte 0,5 Md€/an immédiatement. Certaines aides seraient retirées après la transition.',
      { after: 1, label: 'Scénario juridique modifié : la restriction des aides réduit les charges de 2 Md€/an, pour un coût administratif maintenu de 0,5 Md€/an. Rendement fictif, distinct du chiffrage migratoire global.', effect: { operating: -2, society: { newcomers: -8, vulnerable: -2 }, cohesion: -2 } }),
    choice('r07-cutb', 'Limiter la réforme au contrôle des conditions existantes', { operating: .3 },
      'Les contrôles coûtent 0,3 Md€/an avant les recouvrements hypothétiques.',
      { after: 1, label: 'Les contrôles de résidence existants atteignent leur rendement hypothétique de 0,6 Md€/an.', effect: { operating: -.6 } }),
    choice('r07-cutc', 'Abandonner le nouveau délai et préserver les droits', { trust: 1, society: { newcomers: 2 } },
      'Le coût de préparation déjà engagé reste dépensé. Aucune économie future n’est comptée.'),
  ]);

const late: { group: keyof Society; tense: string; calm: string }[] = [
  {group:'vulnerable',tense:'Comment répondre à la précarité de fin de mandat ?',calm:'Faut-il étendre les protections des ménages modestes ?'},
  {group:'workers',tense:'Comment répondre aux tensions sur les revenus du travail ?',calm:'Faut-il financer de nouveaux parcours professionnels ?'},
  {group:'publicStaff',tense:'Comment rétablir les capacités des services publics ?',calm:'Faut-il moderniser les conditions de travail des agents ?'},
  {group:'businesses',tense:'Comment soutenir une activité économique fragilisée ?',calm:'Faut-il accélérer les investissements des entreprises ?'},
  {group:'pensioners',tense:'Comment protéger les retraités fragilisés par le mandat ?',calm:'Faut-il renforcer les services aux personnes âgées ?'},
];
const finalDossiers = late.map((r,i) => [true,false].map(tense => {
  const id='s'+i+(tense?'t':'c');
  return dossier('Bilan social',tense?r.tense:r.calm,
    tense ? 'Les conditions matérielles de ce groupe sont passées sous 50/100 dans le scénario. La situation résulte des choix du mandat.' : 'Les conditions matérielles de ce groupe restent à au moins 50/100. Vous arbitrez une nouvelle intervention.',
    [
      choice(id+'a',tense?'Maintenir l’effort malgré les tensions':'Réduire les prestations secondaires', { operating: -2, society:social(r.group,-3),cohesion:-1 }, 'La nouvelle coupe économise 2 Md€/an et réduit encore les prestations de ce groupe.'),
      choice(id+'b','Financer une aide ciblée par une contribution dédiée', { operating:2,revenue:4,society:social(r.group,2),trust:-2 }, '4 Md€/an de prélèvements financent 2 Md€/an d’aides. Le déficit baisse de 2 Md€/an.'),
      choice(id+'c','Renforcer la protection sans nouvelle recette', { operating:3,society:social(r.group,5),cohesion:2 }, 'La protection augmente ; le déficit aussi, de 3 Md€/an.'),
    ]);
}));

/** 20 reforms + 40 conditional continuations + 10 social outcomes = 70 dossiers.
 * A game visits 20 + 20 + 5 = 45. Historical IDs freeze the visited route.
 * No random draw or cache keyed only by turn can replace a committed dossier. */
export const NATIONAL_CATALOGUE: readonly Dossier[] = [...roots,...followUps.flat(),...finalDossiers.flat()];
export function nationalBranchDossiers(g: Game): Dossier[] {
  return Array.from({length:45},(_,slot) => {
    const candidates = slot<40 ? slot%2===0 ? [roots[slot/2]] : followUps[Math.floor(slot/2)] : finalDossiers[slot-40];
    const historical = g.choices[slot];
    if (historical) {
      const found = candidates.find(d=>d.choices.some(c=>c.id===historical));
      if (!found) throw new Error('Dossier historique inconnu.');
      return found;
    }
    // Only the current dossier is actionable. Future previews cannot claim a route.
    if(slot!==g.turn)return candidates[0];
    if(slot<40 && slot%2===0)return candidates[0];
    const selected = slot<40 ? (g.choices[slot-1]===REFORMS[Math.floor(slot/2)].id+'a'?0:1)
      : (g.society![late[slot-40].group]<50?0:1);
    const d=candidates[selected];
    const origin=slot<40?g.history.at(-1)?.title:SOCIETY_LABELS[late[slot-40].group];
    return {...d,story:`Suite à « ${origin} ». ${d.story}`};
  });
}
