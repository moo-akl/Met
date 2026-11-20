---
name: Expo API codegen and Metro
description: Metro can briefly observe missing generated API files while Orval cleans and rewrites its output.
---

If the Expo bundler reports that the generated API entry point cannot be resolved during API code generation, wait for code generation to finish and restart the Expo workflow. Confirm that Metro bundles without the missing-module error afterward.

**Why:** Orval cleans the generated output directory before rewriting it, so a running Metro process can observe the temporary empty state and retain a failed resolution.

**How to apply:** Restart only when the workflow logs show the missing generated module; ordinary app-code edits remain hot-reloadable.
