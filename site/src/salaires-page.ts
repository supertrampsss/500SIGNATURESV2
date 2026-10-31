/** Page Salaires : même socle que le récit (en-tête, polices), contenu de lecture sur ivoire. */
import "./recit/recit.css";
import "./styles/budget-flow.css";
import "./styles/budget-comparison.css";
import "./styles/stacked-percent.css";
import "./styles/data-studio.css";
import "./styles/reclassement-bercy.css";
import "./styles/salaires.css";
import "./styles/salaires-page.css";
import { bindChartControls } from "./chart-controls.ts";
import { brancherSalaires, renduSalaires } from "./salaires.ts";

const contenu = document.getElementById("contenu");
if (contenu && !document.getElementById("salaires-contenu")) contenu.innerHTML = renduSalaires();
const salaires = document.getElementById("salaires-contenu");
if (salaires) brancherSalaires(salaires);
bindChartControls(document);
