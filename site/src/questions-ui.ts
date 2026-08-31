import { resoudreQuestion } from "./questions.ts";

export function brancherQuestions(): void {
  const form = document.getElementById("questions-form");
  const saisie = document.getElementById("questions-saisie");
  const resultat = document.getElementById("questions-resultat");
  if (!(form instanceof HTMLFormElement) || !(saisie instanceof HTMLInputElement) || !resultat) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    resultat.replaceChildren();
    const resolution = resoudreQuestion(saisie.value);
    if (resolution.statut === "unsupported") {
      resultat.textContent = "Cette question n'est pas encore documentée. Consultez les questions disponibles ci-dessous.";
      return;
    }
    if (resolution.statut === "ambiguous") {
      const texte = document.createElement("p");
      texte.textContent = "Votre question peut désigner plusieurs dossiers :";
      const liste = document.createElement("ul");
      for (const reponse of resolution.reponses) {
        const lien = document.createElement("a");
        lien.href = `/questions/${reponse.slug}/`;
        lien.textContent = reponse.question;
        const ligne = document.createElement("li");
        ligne.append(lien);
        liste.append(ligne);
      }
      resultat.append(texte, liste);
      return;
    }
    if (resolution.statut === "matched") {
      const suggestion = resolution.reponse;
      const rapprochement = document.createElement("p");
      rapprochement.textContent = "Une question proche est documentée :";
      const lien = document.createElement("a");
      lien.href = `/questions/${suggestion.slug}/`;
      lien.textContent = suggestion.question;
      resultat.append(rapprochement, lien);
      return;
    }
    const reponse = resolution.reponse;
    const texte = document.createElement("p");
    texte.textContent = reponse.reponse;
    const lien = document.createElement("a");
    lien.href = `/questions/${reponse.slug}/`;
    lien.textContent = "Lire la réponse sourcée";
    resultat.append(texte, lien);
  });
}
