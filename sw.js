/*
 * Service worker — เก็บไฟล์ของแอปไว้ในเครื่อง เพื่อให้เปิดได้แม้ไม่มีอินเทอร์เน็ต
 * (ข้อมูลรถของคุณอยู่ใน localStorage ไม่ได้อยู่ที่นี่)
 * เมื่อแก้ไฟล์แอป ให้เปลี่ยนเลข VERSION เพื่อให้เครื่องผู้ใช้โหลดไฟล์ใหม่
 */
const VERSION = 'carinfo-v1.1.1';
const FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/calc.js',
  './js/store.js',
  './js/charts.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ใช้ไฟล์ในเครื่องก่อน (เร็ว + ออฟไลน์ได้) แล้วแอบโหลดของใหม่มาเก็บไว้ใช้ครั้งหน้า
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((cached) => {
        const network = fetch(req)
          .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
        return cached || network;
      })
    )
  );
});
