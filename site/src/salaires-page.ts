import { brancherSalaires, renduSalaires } from './salaires.ts';
import { renduNavigation } from './navigation.ts';
import { brancherTheme } from './theme.ts';
import './style.css';
import './styles/fondations.css';
import './styles/navigation.css';
import './styles/salaires.css';
import './styles/editorial-identity.css';

const contenu = document.getElementById('contenu');
if (contenu && !document.getElementById('salaires-contenu')) contenu.innerHTML = renduSalaires();
document.body.dataset.vue = 'salaires';
const navigation = document.getElementById('navigation-principale');
if (navigation) navigation.innerHTML = renduNavigation('/salaires', true).replace(/ data-vue="[^"]*"/g, '');
const salaires = document.getElementById('salaires-contenu');
if (salaires) brancherSalaires(salaires);
brancherTheme();
