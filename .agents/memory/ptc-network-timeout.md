---
name: PTC network timeout limitation
description: CodeExecution may not provide AbortSignal for impure network requests.
---

Do not assume `AbortSignal` is available in CodeExecution network helpers. A `Promise.race` with a timer can bound how long the agent waits, but it does not cancel the underlying fetch.

**Why:** a direct website-check attempt failed before sending requests because `AbortSignal` was undefined in the sandbox.

**How to apply:** For impure network work in CodeExecution, omit AbortSignal unless availability has been confirmed. Use a shell process when actual request cancellation is necessary.
