---
name: Venue QR poster safety
description: Preserve check-in behavior while customizing printable venue QR posters.
---

Keep every visible poster text layer editable independently of the venue profile and separate from the encoded check-in URL. Restyling or exporting the poster must never regenerate or rewrite its QR payload. Maintain a clear white quiet zone and a high-contrast QR foreground; keep logos and decorative images outside the code.

**Why:** The user wants every poster text layer to be editable while keeping the venue's existing check-in flow unchanged.

**How to apply:** Allow poster-only overrides for venue and brand copy without changing profile details; when changing previews, QR rendering, persisted designs, or exports, pass the server-provided QR URL unchanged and retain its quiet zone and contrast.
