/**
 * « +20,3 % depuis 2018 » — dont combien d'inflation ?
 *
 * Une évolution de montants en euros courants sur sept ans est d'abord une
 * évolution des prix. Entre 2018 et 2025, un euro a perdu près d'un cinquième
 * de son pouvoir d'achat : une dépense qui progresse de 20 % sur cette période
 * n'a presque pas bougé en volume. Afficher la hausse nue laisse le lecteur
 * conclure de travers, et il conclura toujours dans le même sens.
 *
 * **Le déflateur est la moyenne annuelle de l'indice des prix à la consommation
 * harmonisé**, celle que le site publie déjà comme indicateur de conjoncture.
 * Ce n'est pas une approximation d'autre chose : c'est la mesure d'inflation
 * qu'emploient l'INSEE et Eurostat quand ils comparent deux années entières,
 * par opposition au glissement de décembre à décembre.
 *
 * **Une année incomplète ne se moyenne pas.** Les taux publiés sont mensuels ;
 * la moyenne des huit premiers mois d'une année n'est pas son inflation
 * annuelle, et l'employer ferait dériver toute la chaîne. Une année à laquelle
 * il manque un mois interrompt le calcul, et la phrase n'est pas écrite.
 *
 * **Le déflateur n'est pas local.** L'indice est national : il ne dit pas ce que
 * les prix ont fait dans cette commune, il dit ce qu'ils ont fait en France. La
 * phrase le nomme, parce qu'appliquer un indice national à un territoire est
 * précisément le genre de raccourci que ce site refuse de faire en silence.
 */

/** Combien de mois une année doit porter pour que sa moyenne soit son inflation. */
const MOIS_ATTENDUS = 12;

/**
 * Le facteur de hausse des prix entre deux exercices, ou `null`.
 *
 * `1,146` pour 2018 → 2025 : cent euros de 2018 en valent 114,60 en 2025. Le
 * chaînage part de l'année **suivant** celle de départ — l'inflation de 2018
 * s'est produite avant le point de départ, la compter reviendrait à déflater
 * d'une année de trop.
 */
export function facteurDePrix(
  ipch: Record<string, number> | undefined,
  depuis: string,
  jusqua: string,
): number | null {
  if (!ipch || depuis >= jusqua) return null;
  const premiere = Number(depuis.slice(0, 4));
  const derniere = Number(jusqua.slice(0, 4));
  if (!Number.isFinite(premiere) || !Number.isFinite(derniere)) return null;

  const parAnnee = new Map<string, number[]>();
  for (const [periode, taux] of Object.entries(ipch)) {
    if (!Number.isFinite(taux)) continue;
    const annee = periode.slice(0, 4);
    parAnnee.set(annee, [...(parAnnee.get(annee) ?? []), taux]);
  }

  let facteur = 1;
  for (let annee = premiere + 1; annee <= derniere; annee += 1) {
    const mois = parAnnee.get(String(annee));
    if (!mois || mois.length !== MOIS_ATTENDUS) return null;
    facteur *= 1 + mois.reduce((s, t) => s + t, 0) / mois.length / 100;
  }
  return facteur;
}

/**
 * La même évolution, une fois les prix retirés.
 *
 * `null` quand le déflateur manque, quand la grandeur n'est pas monétaire — un
 * taux de pauvreté ne se déflate pas — ou quand l'écart est trop petit pour que
 * la distinction ait un sens.
 */
export function enEurosConstants(
  serie: Record<string, number>,
  depuis: string,
  jusqua: string,
  unite: string,
  ipch: Record<string, number> | undefined,
): { inflation: number; reel: number } | null {
  if (unite !== "EUR") return null;
  const debut = serie[depuis];
  const fin = serie[jusqua];
  if (!debut || fin === undefined) return null;
  const facteur = facteurDePrix(ipch, depuis, jusqua);
  if (facteur === null || facteur <= 0) return null;
  const inflation = (facteur - 1) * 100;
  // Sous un demi-point cumulé, l'inflation n'explique rien et la phrase
  // n'ajouterait qu'une ligne.
  if (Math.abs(inflation) < 0.5) return null;
  const reel = (fin / (debut * facteur) - 1) * 100;
  return { inflation, reel };
}
