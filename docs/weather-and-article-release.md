# Homepage weather and placeholder article

Approved for publication by Chris on 2026-10-29 after the ASCII weather studies.

## Homepage weather

`src/components/IndexWeather.astro` mounts `/scripts/index-weather.js` on the index only. `weather-boids.js` supplies local separation/alignment/cohesion and the dither renderer. The original index styling and existing entries remain intact.

Auto follows the viewer's northern-hemisphere calendar. The selector offers all seasons; explicit selections and pause state persist. Fronts evolve automatically; summer includes the accepted dithered boid swarm, lasting 90 seconds. Spring has petals and rain, winter snow/flurries, autumn leaves/gusts/rain. Fireflies and the eschaton are excluded at Chris's request.

The canvas ignores pointer input and clears text rectangles. Reduced motion starts paused; hidden tabs stop animation. Counts and pixel ratio are bounded. No remote weather requests, tracking or location access.

## Article

`/article-placeholder/` is an original placeholder essay in the layout supplied as a screenshot: Times serif, top navigation, split title/date and image opening, thin rules, wide prose column and red links. Responsive layout stacks the opening below 760px. The article is linked under writing on the index; Blog returns to that section. It is marked noindex while placeholder content remains.

Image: Paul Strand, *Wall Street*, 1915, Wikimedia Commons, public-domain-in-US source: https://commons.wikimedia.org/wiki/File:Wall_Street_by_Paul_Strand,_1915.jpg

Original downloaded file is kept at `public/article-placeholder/wall-street-paul-strand-1915.jpg`. The detail crop is CSS `object-fit: cover; object-position: center bottom`, not a changed source image. Article prose is original placeholder copy, not the text in the reference screenshot.

## Checks and scope

Run `node tests/weather-boids.test.mjs`, `node check-metadata.js`, and `npm run build`. Browser checks cover seasonal switching, reduced motion, mobile overflow, image loading and article navigation. This release starts from current remote main; unrelated local Filmmaand/editor changes and experimental artifacts are not included.
