/** Installation is optional and user initiated. The worker only caches the game. */
export async function prepareOffline(): Promise<{ update: boolean }> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) throw new Error('Le mode hors connexion nécessite un navigateur compatible et une connexion HTTPS.');
  const registration = await navigator.serviceWorker.register('/mandats/sw.js', { scope:'/mandats/', updateViaCache:'none' });
  if (registration.waiting) return { update:true };
  if (registration.active) return { update:false };
  const worker = registration.installing;
  if (!worker) throw new Error('Préparation indisponible. Réessayez avec une connexion stable.');
  await new Promise<void>((resolve,reject)=>{
    const timer = setTimeout(()=>{cleanup(); reject(new Error('La préparation prend trop de temps. Réessayez avec une connexion stable.'));},45000);
    function cleanup() { clearTimeout(timer); worker!.removeEventListener('statechange', change); }
    function change() {
      if (worker!.state === 'activated') { cleanup(); resolve(); }
      else if (worker!.state === 'redundant') { cleanup(); reject(new Error('Le téléchargement du jeu a échoué. Votre sauvegarde est conservée.')); }
    }
    worker.addEventListener('statechange', change); change();
  });
  return { update:false };
}
export async function updateOffline() {
  const registration = await navigator.serviceWorker.getRegistration('/mandats/');
  if (!registration?.waiting) throw new Error('Le jeu est déjà à jour.');
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
