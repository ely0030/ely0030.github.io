// Service Worker: Download Proxy + Audio Cache + Offline Support
// 1. Intercepts download requests and adds Content-Disposition headers
// 2. Caches audio files from Catbox for offline/instant playback
// 3. Caches music page assets for true offline support

const CACHE_VERSION = 1;
const AUDIO_CACHE = `audio-cache-v${CACHE_VERSION}`;
const PAGE_CACHE = `page-cache-v${CACHE_VERSION}`;

// Assets to precache for offline music page
const PAGE_ASSETS = [
	'/music',
	'/music/',
];

// Caching preference (synced from page on load)
// Note: This resets when SW restarts, but page syncs preference on load
let cachingEnabled = true;

// Install event - precache page assets
self.addEventListener('install', (event) => {
	console.log('[SW] Installing...');
	event.waitUntil(
		caches.open(PAGE_CACHE).then(cache => {
			console.log('[SW] Precaching page assets');
			return cache.addAll(PAGE_ASSETS);
		})
	);
	self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
	console.log('[SW] Activated');
	event.waitUntil(
		Promise.all([
			clients.claim(),
			// Clean up old cache versions
			caches.keys().then(cacheNames => {
				return Promise.all(
					cacheNames.map(cacheName => {
						// Delete caches that don't match current version
						if (cacheName.startsWith('audio-cache-') && cacheName !== AUDIO_CACHE) {
							console.log('[SW] Deleting old cache:', cacheName);
							return caches.delete(cacheName);
						}
						if (cacheName.startsWith('page-cache-') && cacheName !== PAGE_CACHE) {
							console.log('[SW] Deleting old cache:', cacheName);
							return caches.delete(cacheName);
						}
						// Clean up legacy download-proxy cache
						if (cacheName === 'download-proxy-v2') {
							console.log('[SW] Deleting legacy cache:', cacheName);
							return caches.delete(cacheName);
						}
						return null;
					})
				);
			})
		])
	);
});

// Fetch event - intercept requests
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Only handle GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// Handle download proxy requests
	if (url.pathname.startsWith('/download-proxy/')) {
		event.respondWith(handleDownload(event.request));
		return;
	}

	// Handle Catbox audio files - cache on fetch
	if (url.hostname === 'files.catbox.moe' && isAudioFile(url.pathname)) {
		event.respondWith(handleAudioFetch(event.request));
		return;
	}

	// Handle music page - network first, fallback to cache
	if (url.pathname === '/music' || url.pathname === '/music/') {
		event.respondWith(handlePageFetch(event.request));
		return;
	}

	// Cache same-origin CSS/JS for offline page support
	if (url.origin === self.location.origin && isPageAsset(url.pathname)) {
		event.respondWith(handleAssetFetch(event.request));
		return;
	}

	// Let browser handle everything else normally
});

// Check if URL is a page asset (CSS/JS)
function isPageAsset(pathname) {
	return pathname.endsWith('.css') || pathname.endsWith('.js');
}

// Handle asset fetch - cache first, then network (for CSS/JS)
async function handleAssetFetch(request) {
	const cache = await caches.open(PAGE_CACHE);

	// Try cache first for fast loading
	const cachedResponse = await cache.match(request);
	if (cachedResponse) {
		// Update cache in background
		fetch(request).then(response => {
			if (response.ok) {
				cache.put(request, response);
			}
		}).catch(() => {});
		return cachedResponse;
	}

	// Not in cache, fetch from network
	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		// Asset not available offline
		return new Response('', { status: 404 });
	}
}

// Check if URL is an audio file
function isAudioFile(pathname) {
	const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac'];
	return audioExtensions.some(ext => pathname.toLowerCase().endsWith(ext));
}

// Handle page fetch - network first with cache fallback
async function handlePageFetch(request) {
	try {
		const networkResponse = await fetch(request);
		// Update cache with fresh version
		if (networkResponse.ok) {
			const cache = await caches.open(PAGE_CACHE);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		// Network failed, try cache
		console.log('[SW] Network failed, serving page from cache');
		const cachedResponse = await caches.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}
		// No cache either - return offline message
		return new Response(
			'<!DOCTYPE html><html><head><title>Offline</title></head><body style="font-family:system-ui;padding:40px;text-align:center;"><h1>Music page unavailable</h1><p>You are offline and this page is not cached.</p></body></html>',
			{
				status: 503,
				headers: { 'Content-Type': 'text/html' }
			}
		);
	}
}

// Handle audio fetch with caching
async function handleAudioFetch(request) {
	const cache = await caches.open(AUDIO_CACHE);

	// Check cache first (always serve from cache if available)
	const cachedResponse = await cache.match(request);
	if (cachedResponse) {
		console.log('[SW] Serving from cache:', request.url);
		return cachedResponse;
	}

	// Not in cache - fetch from network
	console.log('[SW] Fetching from network:', request.url);
	try {
		const networkResponse = await fetch(request);

		// Only cache if enabled and response is successful
		if (cachingEnabled && networkResponse.ok) {
			const responseToCache = networkResponse.clone();

			cache.put(request, responseToCache).then(() => {
				console.log('[SW] Cached:', request.url);
				// Notify all clients that a new track was cached
				notifyClients({
					type: 'AUDIO_CACHED',
					url: request.url
				});
			});
		}

		return networkResponse;
	} catch (error) {
		console.error('[SW] Network fetch failed:', error);
		throw error;
	}
}

// Helper to notify all clients
async function notifyClients(message) {
	const clients = await self.clients.matchAll();
	clients.forEach(client => {
		client.postMessage(message);
	});
}

// Handle messages from the page
self.addEventListener('message', async (event) => {
	const { type, url, enabled } = event.data || {};

	if (type === 'GET_CACHE_STATUS') {
		try {
			const cache = await caches.open(AUDIO_CACHE);
			const keys = await cache.keys();
			const cachedUrls = keys.map(req => req.url);

			event.source.postMessage({
				type: 'CACHE_STATUS',
				cachedUrls: cachedUrls
			});
		} catch (error) {
			console.error('[SW] Error getting cache status:', error);
			event.source.postMessage({
				type: 'CACHE_STATUS',
				cachedUrls: []
			});
		}
	}

	if (type === 'SET_CACHE_ENABLED') {
		cachingEnabled = enabled;
		console.log('[SW] Caching', enabled ? 'enabled' : 'disabled');
	}

	if (type === 'CLEAR_AUDIO_CACHE') {
		await caches.delete(AUDIO_CACHE);
		console.log('[SW] Audio cache cleared');

		event.source.postMessage({
			type: 'CACHE_CLEARED'
		});
	}

	if (type === 'REMOVE_FROM_CACHE' && url) {
		const cache = await caches.open(AUDIO_CACHE);
		await cache.delete(url);
		console.log('[SW] Removed from cache:', url);

		event.source.postMessage({
			type: 'CACHE_UPDATED',
			removedUrl: url
		});
	}
});

// Download proxy functionality
async function handleDownload(request) {
	const url = new URL(request.url);
	const params = url.searchParams;
	const fileUrl = params.get('url');
	const filename = params.get('filename');

	if (!fileUrl || !filename) {
		return new Response('Missing url or filename parameter', { status: 400 });
	}

	// Security: only allow catbox.moe
	if (!fileUrl.startsWith('https://files.catbox.moe/')) {
		return new Response('Only catbox.moe URLs allowed', { status: 403 });
	}

	try {
		console.log(`[SW] Downloading: ${fileUrl}`);

		// Check if we have it cached already
		const cache = await caches.open(AUDIO_CACHE);
		let response = await cache.match(fileUrl);

		if (!response) {
			response = await fetch(fileUrl, {
				mode: 'cors',
				credentials: 'omit'
			});

			if (!response.ok) {
				throw new Error(`Fetch failed: ${response.status}`);
			}
		} else {
			console.log(`[SW] Download using cached version`);
		}

		const headers = new Headers(response.headers);
		headers.set('Content-Disposition', `attachment; filename="${filename}"`);
		headers.set('Content-Type', 'audio/mpeg');

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: headers
		});

	} catch (error) {
		console.error('[SW] Download error:', error);
		return new Response(`Download failed: ${error.message}`, { status: 500 });
	}
}
