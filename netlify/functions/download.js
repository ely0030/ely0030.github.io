// Netlify Function: Download Proxy
// Fetches files from external hosts and serves them with download headers

export async function handler(event, context) {
	const { url, filename } = event.queryStringParameters || {};

	// Validate parameters
	if (!url || !filename) {
		return {
			statusCode: 400,
			body: JSON.stringify({ error: 'Missing url or filename parameter' })
		};
	}

	// Security: only allow catbox.moe URLs
	if (!url.startsWith('https://files.catbox.moe/')) {
		return {
			statusCode: 403,
			body: JSON.stringify({ error: 'Only catbox.moe URLs are allowed' })
		};
	}

	try {
		// Fetch the file from Catbox
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${response.status}`);
		}

		// Get the file as a buffer
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Return with download headers
		return {
			statusCode: 200,
			headers: {
				'Content-Type': 'audio/mpeg',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Length': buffer.length.toString(),
			},
			body: buffer.toString('base64'),
			isBase64Encoded: true
		};
	} catch (error) {
		console.error('Download proxy error:', error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: 'Failed to download file', details: error.message })
		};
	}
}
