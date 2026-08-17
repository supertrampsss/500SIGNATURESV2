/**
 * Les libellés des thèmes du catalogue.
 *
 * Cette table vivait dans `main.ts`, seul module à en avoir besoin tant que
 * les thèmes ne se nommaient que dans la fiche territoire. L'index des
 * analyses en a besoin lui aussi — sa facette « thème » propose des thèmes, et
 * un menu qui affiche « budget_etat » montre un identifiant de base à un
 * lecteur. `analyse-rendu.ts` est un module pur, que `main.ts` ne peut pas
 * fournir : la table sort donc dans son propre fichier, plutôt que d'être
 * recopiée d'un côté et de dériver de l'autre.
 *
 * Un thème absent de cette table n'est pas écarté : il est affiché sous une
 * forme lisible. Filtrer sur une liste écrite en dur avait déjà fait
 * disparaître des données parfaitement publiées.
 */
export const THEMES: Record<string, string> = {
  vie_associative: "Vie associative",
  finances_locales: "Finances locales",
  revenus: "Revenus et pauvreté",
  population: "Population",
  famille: "Familles et unions",
  logement: "Logement",
  professions: "Professions et catégories sociales",
  emploi: "Emploi et chômage",
  diplomes: "Diplômes de la population",
  entreprises: "Entreprises",
  secteurs_etablissements: "Établissements par secteur",
  secteurs_salaries: "Salariés par secteur",
  equipements: "Équipements et services",
  tourisme: "Hébergement touristique",
  elections: "Participation électorale",
  fonctions: "Dépenses par fonction",
  securite_sociale: "Sécurité sociale",
  retraites: "Retraites",
  securite: "Sécurité",
  sante: "Santé",
  education: "Éducation",
  impots_locaux: "Impôts locaux",
  macro: "Conjoncture",
  dette: "Dette publique",
  budget_etat: "Budget de l'État",
  depenses_fiscales: "Niches fiscales",
  energie: "Énergie",
  transports: "Transports",
  environnement: "Environnement",
  justice: "Justice",
  europe: "Comparaisons européennes",
};

export function libelleTheme(theme: string): string {
  return THEMES[theme] ?? theme.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
