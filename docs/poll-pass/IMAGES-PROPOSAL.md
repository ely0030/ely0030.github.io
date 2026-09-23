# Proposal: images in the date-poll chat (PARKED)

**Status: not built. Cameo, 23 Sept: a NO for this launch** (the first night is 24 Sept). This is a written proposal only,
to pick up after the launch if Chris still wants it. Chris asked for it via Capsule: a photo through the chat's + button.

## Why parked

- It would be the site's **first user-uploaded binary content**: new storage, new serving path, new failure modes.
- **Privacy**: phone photos carry EXIF (GPS location, device, time). They must be stripped before anyone else sees them.
- **Moderation**: the organiser's hide covers it after the fact, but an image is seen before anyone can hide it.
- **Cost**: blob storage plus serving every image through an authenticated function (no public CDN caching for private
  content) costs compute per view.
- **Re-encoding needs an image library in the function**, which costs cold starts and bundle size. `sharp` is already a
  dependency (`filmmaand-server/images.mjs` uses it for avatars), but loading it on the chat path grows the date-poll
  function's cold start. Measure that before building.

## Proposed shape

- **Upload**: `POST /filmmaand/api/plans/<planId>/date-poll-image` (pass or session, `Idempotency-Key`), raw body
  `image/jpeg` or `image/webp`, **≤ 200 KB**, rejected above that before buffering further (the api already streams with
  a limit).
- **Server-side checks**: decode with the image library; ≤ 1024 × 1024 px (refuse otherwise); **re-encode** to WebP (or
  JPEG) at a fixed quality, which drops EXIF/GPS and any payload hidden in the file. Store the re-encoded bytes in the
  blob store keyed by their sha256.
- **Message**: a chat message `kind:'image'` with `image:{id, w, h}` (the page adds `url`), same stream and cursor as
  text/drawings; author and time server-stamped.
- **Serving**: `GET /filmmaand/api/plans/<planId>/date-poll-image/<id>` with the same pass/session auth as the poll GET,
  `Cache-Control: private, no-store`, `Content-Type` from the re-encode, `X-Content-Type-Options: nosniff`. Never a public
  URL. A hidden image returns 404 to everyone but the organiser.
- **Limits**: 5 per 10 minutes and 20 per hour per person; at most **60 images per poll**; blobs of a replaced poll are
  deleted when it is archived (or after N days).
- **Never mail**, private/no-store, organiser `hide-message` works on it like any message.
- **Client** (Capsule): `filmmaandChat.sendImage(blob)`; the client downsizes to ≤ 1024 px JPEG ≤ 150 KB before upload
  (the server still re-checks and re-encodes); the paperclip/+ only shows when `sendImage` exists.

## Before building, decide

1. Is private serving through the function acceptable cost-wise (every view = one invocation)? Or signed short-lived URLs
   to the blob store?
2. Consent: friends posting photos of each other. Is organiser hide enough, or is an explicit "wie mag dit zien" needed?
3. Retention: how long do images live after the night?
