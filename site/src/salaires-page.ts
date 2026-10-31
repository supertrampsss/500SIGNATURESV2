/** Page Salaires : même récit défilant que l'accueil (en-tête, scène, cartes, pied de sources). */
import "./recit/recit.css";
import { brancherRecit } from "./recit/runtime.ts";
import { renduSalaires } from "./salaires.ts";

const contenu = document.getElementById("contenu");
if (contenu && !document.getElementById("salaires-contenu")) contenu.innerHTML = renduSalaires();
brancherRecit();
