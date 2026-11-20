---
name: PTC callback replay recovery
description: Recovery pattern for CodeExecution durable callback replay errors.
---

When CodeExecution reports `Replay terminated before all ledgered callback calls were re-issued`, the durable callback sequence may be incomplete. Repeating a block with fewer callbacks can preserve the mismatch. In the observed case, a no-callback diagnostic still ran; reissuing the expected number of callbacks in one block completed the sequence, after which file validation and asset presentation worked separately.

**Why:** A deliverable was lost when a combined write-and-present block stopped before completing its recorded callback sequence.

**How to apply:** For this exact replay error, avoid repeatedly retrying only the first callback. Reissue the full expected callback count in one block using safe, idempotent operations, verify any file through the regular filesystem tools, then present the asset in a separate step.

## Large source-payload uploads

Keep each shell callback's returned payload below 1 MiB and avoid retaining several large base64 batches in CodeExecution state. The notebook can reset at roughly 32 MiB and discard variables even after remote writes completed.

**Why:** A multi-megabyte GitHub source upload exceeded the durable notebook memory limit after successful blob writes, clearing local progress state.

**How to apply:** Upload in modest batches, record each confirmed batch, and after a reset re-fetch the remote branch and reconstruct remaining work from verified blob paths before continuing.
