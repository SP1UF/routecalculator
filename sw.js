const CACHE_NAME = 'trasa-calc-v2'; // Zmieniłem wersję, żeby wymusić aktualizację
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.png'  // Tutaj dodaliśmy Twoją ikonę do pamięci offline
];

// Instalacja i zapisywanie plików w pamięci telefonu
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Obsługa żądań (Działanie offline)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // Jeśli plik jest w pamięci (np. ikona), weź go z pamięci.
      // Jeśli nie, pobierz z internetu.
      return response || fetch(e.request);
    })
  );
});

// Czyszczenie starej pamięci (gdy zmieniasz wersję aplikacji)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
});