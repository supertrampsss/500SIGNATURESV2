export type EquationFrance = {
  recettesPour100: 100;
  depensesPour100: number;
  deficitPour100: number;
  phrase: string;
};

function arrondirDeuxDecimales(valeur: number): number {
  return Number(valeur.toFixed(2));
}

export function equationFrance(recettes: number, depenses: number): EquationFrance {
  if (recettes <= 0) {
    throw new RangeError("Les recettes doivent être strictement positives");
  }

  const depensesPour100 = arrondirDeuxDecimales((depenses / recettes) * 100);
  const deficitPour100 = arrondirDeuxDecimales(depensesPour100 - 100);
  const depensesFormatees = depensesPour100.toFixed(2).replace(".", ",");

  return {
    recettesPour100: 100,
    depensesPour100,
    deficitPour100,
    phrase: `Pour 100 € encaissés, la France en dépense ${depensesFormatees}.`,
  };
}
