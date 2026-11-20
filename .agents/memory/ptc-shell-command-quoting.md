---
name: PTC shell command quoting
description: A reliable approach when composite shell commands inside CodeExecution are difficult to parse.
---

When a composite shell command inside CodeExecution fails to parse, split the work into small steps and use ShellExec for local Git operations. Keep CodeExecution focused on connector calls and simple data transfer.

**Why:** A long command that combined Git merging, shell quoting, and connector writes produced repeated parser errors; separating local merge work from connector requests succeeded.

**How to apply:** Stage remote blob content, merge and inspect it with ShellExec, then pass verified base64 content to a small CodeExecution call for GitHub. Avoid retrying increasingly complex command strings.
