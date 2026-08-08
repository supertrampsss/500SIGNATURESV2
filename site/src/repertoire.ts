/**
 * L'index d'une maille : ce qu'il faut pour **peindre**, pas ce qu'il faut pour
 * lire une fiche.
 *
 * Colorer une couche « par habitant » ne demande que deux choses par
 * territoire : son nom — colonne du tableau, infobulle, étiquette — et sa
 * population de référence pour l'exercice affiché, qui est le dénominateur. Le
 * site allait les chercher dans les fiches : cent un fichiers départementaux,
 * plusieurs centaines de mégaoctets de séries complètes, téléchargés et
 * analysés pour en extraire deux champs. Il lit désormais
 * `territoires/{maille}/index.json`, publié pour cela.
 *
 * Le fichier est **colonnaire** : un tableau par champ, tous rangés dans
 * l'ordre de `codes`. Répéter les noms de clés 34 875 fois coûtait un
 * mégaoctet pour ne rien dire de plus.
 *
 * Les lots départementaux restent nécessaires à la fiche d'un territoire : eux
 * seuls portent les séries, les drapeaux et les événements de périmètre. Un
 * seul lot se charge alors, celui du département ouvert.
 */

export type IndexTerritoires = {
  /** L'indicateur d'où viennent les populations de référence : décrit dans
   *  `indicateurs.json` (source, définition, licence, unité). */
  denominateur: string;
  /** Les millésimes du dénominateur, dans l'ordre de `population_reference`. */
  periodes: string[];
  unite: string;
  /** Millésime du référentiel INSEE : noms, rattachements, population municipale. */
  millesime_geographique: number | null;
  codes: string[];
  noms: string[];
  parents: (string | null)[];
  population_municipale: (number | null)[];
  /** Une ligne par territoire, une colonne par période. `null` = pas de
   *  référence publiée cet exercice-là. */
  population_reference: (number | null)[][];
};

export type Repertoire = {
  niveau: string;
  index: IndexTerritoires;
  noms: Record<string, string>;
};

/**
 * Ouvre l'index d'une maille, ou rend `null` si la publication servie n'en a
 * pas.
 *
 * Le site en ligne lit `derniere.json` : une publication antérieure à ce
 * fichier peut être servie le temps d'un run, et le jeu publié se relit des
 * années plus tard. `null` n'est donc pas une erreur, c'est un cas prévu — à
 * l'appelant de retomber sur les lots départementaux, cent fois plus lourds
 * mais porteurs des mêmes noms et du même dénominateur. Une carte lente vaut
 * mieux qu'une carte vide.
 */
export async function ouvrirRepertoire(
  niveau: string,
  lire: (niveau: string) => Promise<IndexTerritoires>,
): Promise<Repertoire | null> {
  try {
    const index = await lire(niveau);
    return { niveau, index, noms: nomsDuRepertoire(index) };
  } catch {
    return null;
  }
}

/** Les noms de la maille, par code : ce que lisent le tableau, l'infobulle et
 *  les étiquettes de la carte. */
export function nomsDuRepertoire(index: IndexTerritoires): Record<string, string> {
  const noms: Record<string, string> = {};
  index.codes.forEach((code, rang) => {
    const nom = index.noms[rang];
    if (nom) noms[code] = nom;
  });
  return noms;
}

/**
 * Le dénominateur de chaque territoire pour la période affichée.
 *
 * Même règle que `populationDeReference` sur une fiche, et il faut que ce soit
 * la même : la référence de l'exercice quand elle existe — une dépense de 2022
 * se rapporte aux habitants de 2022 —, la population municipale du référentiel
 * sinon. Sans dénominateur, le territoire est absent de la table plutôt que
 * présent avec un zéro : la carte le laisse en gris, elle ne le peint pas en
 * infini.
 */
export function populationsDuRepertoire(
  index: IndexTerritoires,
  periode: string,
): Record<string, number> {
  const colonne = index.periodes.indexOf(periode);
  const populations: Record<string, number> = {};
  index.codes.forEach((code, rang) => {
    const reference = colonne === -1 ? null : index.population_reference[rang]?.[colonne];
    const valeur = reference || index.population_municipale[rang];
    if (valeur) populations[code] = valeur;
  });
  return populations;
}
