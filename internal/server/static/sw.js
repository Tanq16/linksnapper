// No-op service worker for PWA registration only
// All requests pass through to network (no offline caching)
self.addEventListener('fetch', () => {});
