---
name: PDFKit esbuild resolution
description: PDFKit standard-font imports can fail when inlined into the API server bundle.
---

When using PDFKit 0.20.x in the API server, externalize the package from esbuild. PDFKit's standard font loaders use package-private `#standard-fonts/*` imports; bundling moves those calls into the API bundle's package context, where the imports mapping is absent. The failure can stay hidden when a host font is present and appear only when PDFKit falls back to Helvetica.

**Why:** production poster generation returned 503 on hosts without the configured DejaVu fonts, while local generation worked.

**How to apply:** keep `pdfkit` in the esbuild external list and smoke-test PDF generation with both configured system font paths unavailable.
