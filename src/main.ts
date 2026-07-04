import './app/dots-app.ts';

// PWA install support. Production only — a service worker caching dev
// bundles makes local iteration miserable.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
