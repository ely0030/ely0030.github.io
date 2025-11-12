// Service Worker: Download Proxy
// Intercepts download requests and adds Content-Disposition headers for instant downloads

const CACHE_NAME = 'download-proxy-v1';

// Install event
self.addEventListener('install', (event) => {
	console.log('[Download SW] Installing...');
	self.skipWaiting(); // Activate immediately
});

// Activate event
self.addEventListener('activate', (event) => {
	console.log('[Download SW] Activated');
	event.waitUntil(clients.claim()); // Take control immediately
});

// Fetch event - intercept download requests
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Only handle /download-proxy/ requests
	if (!url.pathname.startsWith('/download-proxy/')) {
		return; // Let browser handle normally
	}

	event.respondWith(handleDownload(event.request));
});

async function handleDownload(request) {
	const url = new URL(request.url);

	// Extract parameters from URL
	// Format: /download-proxy/?url=https://...&filename=...
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
		console.log(`[Download SW] Fetching: ${fileUrl}`);

		// Fetch the file from Catbox
		const response = await fetch(fileUrl);

		if (!response.ok) {
			throw new Error(`Fetch failed: ${response.status}`);
		}

		// Create new response with download headers
		const headers = new Headers(response.headers);
		headers.set('Content-Disposition', `attachment; filename="${filename}"`);
		headers.set('Content-Type', 'audio/mpeg');

		// Return the response with modified headers
		// The body streams through without buffering!
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: headers
		});

	} catch (error) {
		console.error('[Download SW] Error:', error);
		return new Response(`Download failed: ${error.message}`, { status: 500 });
	}
}
