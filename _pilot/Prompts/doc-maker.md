Please update @DOCS/. Read @DOCS/DOCS-MAP.md and deduce which docs you need to update. Also think on whether making a new doc file and consolidating things for some aspects would be a better fit.

use the docs map, read the docs to see what they already contain, and then update accordingly.

Utilize these tips:

"minimal, dense documentation optimized explicitly for CONTEXT AND MEMORY EFFICIENCY to RAPIDLY onboard a newly instantiated LLM with ZERO prior context. document precisely:

* critical insights and non-obvious lessons uncovered in debugging.

* subtle dependencies or coupling between code segments that aren't immediately visible.

* hidden assumptions AND their underlying rationales driving design decisions impacting future changes.

* EXACT LOCATIONS (files/functions/modules) of code segments directly affected by or relevant to these insights.

* explicitly FLAG recurring failure modes, pitfalls, or misunderstandings that arose during interaction and briefly note how to AVOID them next time.

exclude self-evident info; ONLY include details whose absence would FORCE redundant rediscovery in future sessions. brevity and navigability paramount—minimize cognitive overhead aggressively."

also make sure to update the DOCS-MAP ofc
