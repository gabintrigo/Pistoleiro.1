/* apaga as caches da versão antiga (ficheiro único, 'rdp-…') quando a versão em ficheiros separados entra */
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('rdp-')).map(k=>caches.delete(k)))));});
