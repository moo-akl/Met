---
name: OpenStreetMap attraction discovery fallback
description: Provider reliability and fallback policy for attraction discovery.
---

Keep the live Overpass search when available, but retain the curated OpenStreetMap-backed fallback for the four supported countries. Preserve OSM feature IDs, source links, and attribution. Do not replace country-wide discovery with repeated public Nominatim searches.

**Why:** In this Replit environment, Overpass timed out for both the full country search and a tiny query; one alternate mirror returned a missing area-index error. Nominatim single-place lookups responded, but it is a geocoder rather than a bulk discovery service.

**How to apply:** Before changing providers, test the exact country-scoped query against the proposed endpoint and check its usage policy. Keep fallback results visibly labeled so admins know they are seeing a curated subset rather than live discovery results.
