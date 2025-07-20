# HTTPS Proxy Header Error - Invalid Value "undefined"

**Created**: 2025-01-20
**Status**: OPEN
**Issue**: HTTPS proxy crashes with TypeError when trying to set header to undefined

## Error Details

```
TypeError [ERR_HTTP_INVALID_HEADER_VALUE]: Invalid value "undefined" for header "accept-encoding"
    at ClientRequest.setHeader (node:_http_outgoing:702:3)
    at new ClientRequest (node:_http_client:302:14)
    at Object.request (node:http:102:10)
    at Server.<anonymous> (C:\Users\Chris\Desktop\Coding Projects\ely0030.github.io\https-proxy.cjs:46:25)
```

## Root Cause

In `https-proxy.cjs`, the code attempts to remove headers by setting them to `undefined`:

```javascript
headers: {
  ...req.headers,
  host: `127.0.0.1:${targetPort}`,
  'accept-encoding': undefined,  // This causes the error
  'connection': 'close'
}
```

Node.js doesn't interpret `undefined` as "remove this header". Instead, it tries to set the header value to the string "undefined", which is invalid.

## Impact

- HTTPS proxy crashes immediately on first request
- Site becomes inaccessible via HTTPS
- Must restart proxy after each request attempt

## Solution

Properly delete headers using the `delete` operator:

```javascript
// Copy headers and remove problematic ones
const proxyHeaders = { ...req.headers };
proxyHeaders.host = `127.0.0.1:${targetPort}`;
delete proxyHeaders['accept-encoding'];  // Properly remove
proxyHeaders.connection = 'close';

// Then use in options:
headers: proxyHeaders
```

## Testing

After fix:
1. Restart HTTPS proxy
2. Access https://localhost:4320/notepad
3. Verify no crashes occur
4. Check that requests are properly proxied to Astro server