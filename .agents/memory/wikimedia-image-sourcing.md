---
name: Wikimedia Commons image sourcing
description: Free photo lookup, local assets, and attribution for Met articles.
---

Wikimedia Commons metadata endpoints may return 429 after several consecutive search or multi-file requests even when direct thumbnail URLs still work. Keep lookups small; if the API rate-limits, stop repeated metadata requests, use already identified file and thumbnail URLs, and retain the creator, license, license URL, and source page. Download chosen images locally before publication.

**Why:** During Met travel article sourcing, the metadata API returned 429 while a direct Commons thumbnail returned 200; repeated retries would waste time and risk further throttling.

**How to apply:** Use this when adding public photos to Met web articles. Avoid hotlinking thumbnails, and include creator, source page, and license credits in article and index-card captions.
