/* eslint-env worker */

// Listens for messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, urls } = event.data;

  if (type === 'PRELOAD' && Array.isArray(urls)) {
    try {
      const cache = await caches.open('gamereel-preload-cache');
      
      const promises = urls.map(async (url) => {
        if (!url) return;
        const response = await cache.match(url);
        if (!response) {
          // Fetch and store in cache automatically
          await cache.add(url);
          console.log(`[Worker] Preloaded > ${url}`);
        }
      });

      await Promise.allSettled(promises);
      self.postMessage({ status: 'done', urls });
    } catch (err) {
      console.error('[Worker] Preload failed', err);
      // We can't pass error object directly, MUST stringify message
      self.postMessage({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }
});
