---
name: Expo route typing
description: Handling stale Expo Router route declarations after adding file-based routes.
---

New file-based routes may remain absent from the generated Expo Router type union even after restarting the mobile workflow.

**Why:** In this workspace, the newly added routes were valid at runtime but TypeScript continued to reject their paths after a workflow restart.

**How to apply:** Check the generated route union first. If it is stale, keep any necessary navigation assertion localized to the new route call rather than weakening routing types globally.
