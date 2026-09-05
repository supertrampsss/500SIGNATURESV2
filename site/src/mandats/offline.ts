/** Installation is optional and user initiated. The worker only caches the game. */
export async function prepareOffline(): Promise<{ update: boolean }> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) throw new Error('Le mode hors connexion nécessite un navigateur compatible et une connexion HTTPS.');
  const registration = await navigator.serviceWorker.register('/mandats/sw.js', { scope:'/mandats/', updateViaCache:'none' });
  if (registration.active) await registration.update();
  if (registration.waiting) return { update:true };
  const worker = registration.installing;
  if (!worker && registration.active) return { update:false };
  if (!worker) throw new Error('Préparation indisponible. Réessayez avec une connexion stable.');
  const updating = Boolean(registration.active);
  await new Promise<void>((resolve,reject)=>{
    const timer = setTimeout(()=>{cleanup(); reject(new Error('La préparation prend trop de temps. Réessayez avec une connexion stable.'));},45000);
    function cleanup() { clearTimeout(timer); worker!.removeEventListener('statechange', change); }
    function change() {
      if (worker!.state === 'activated' || (updating && worker!.state === 'installed')) { cleanup(); resolve(); }
      else if (worker!.state === 'redundant') { cleanup(); reject(new Error('Le téléchargement du jeu a échoué. Votre sauvegarde est conservée.')); }
    }
    worker.addEventListener('statechange', change); change();
  });
  return { update:updating };
}
export async function updateOffline() {
  const registration = await navigator.serviceWorker.getRegistration('/mandats/');
  if (registration && !registration.waiting) await registration.update();
  if (!registration?.waiting) throw new Error(registration?.installing ? 'La mise à jour est encore en cours de téléchargement. Réessayez dans un instant.' : 'Aucune mise à jour prête. Utilisez Préparer le jeu hors connexion pour vérifier la version disponible.');
  navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
  registration.waiting.postMessage({ type:'ACTIVATE_UPDATE' });
}
export async function removeOffline() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/mandats/');
    if (registration?.scope === new URL('/mandats/',location.origin).href) await registration.unregister();
  }
  if ('caches' in window) for (const key of await caches.keys()) if (key.startsWith('mandats-offline-')) await caches.delete(key);
}
