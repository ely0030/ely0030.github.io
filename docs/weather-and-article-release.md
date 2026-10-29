# Homepage weather and placeholder article

Homepage weather approved for publication by Chris on 2026-10-29. The article is an unpublished prototype; its earlier publication was a scope mistake.

## Homepage weather

`src/components/IndexWeather.astro` mounts `/scripts/index-weather.js` on the index only. `weather-boids.js` supplies local separation/alignment/cohesion and the dither renderer. The original index styling and existing entries remain intact.

Auto follows the viewer's northern-hemisphere calendar. The selector offers all seasons; explicit selections and pause state persist. Fronts evolve automatically; summer includes the accepted dithered boid swarm, lasting 90 seconds. Spring has petals and rain, winter snow/flurries, autumn leaves/gusts/rain. Fireflies and the eschaton are excluded at Chris's request.

The canvas ignores pointer input and clears text rectangles. Reduced motion starts paused; hidden tabs stop animation. Counts and pixel ratio are bounded. No remote weather requests, tracking or location access.

## Article prototype (not deployed)

The screenshot-inspired “On Looking Longer” article remains a Cluster artifact, ID `16335da1-3af2-47b8-907a-80727b039c6e`, revision 2. Its route, public image, and index link have been removed. Do not republish it without Chris’s approval.

The artifact preserves the compiled layout and prose, embeds a compressed 1280px copy of Paul Strand’s *Wall Street* (1915), and points navigation to the homepage. Original image source: https://commons.wikimedia.org/wiki/File:Wall_Street_by_Paul_Strand,_1915.jpg

Weather was published in `7990ee2`. The article was subsequently withdrawn at Chris’s request and retained only as an artifact prototype.
