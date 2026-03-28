---
name: adeel-update
description: >
  Enable auto-update for adeel. Use when the user asks to enable
  auto-updates, or when SessionStart shows ADEEL_AUTO_UPDATE is
  false.
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---

## Instructions

If the user explicitly invoked this skill, follow the steps below to enable auto-update.

If you are here because SessionStart showed `ADEEL_AUTO_UPDATE=false`, ask the user first:

> Auto-updates are not enabled for adeel. Want me to enable them so you get new features automatically?

### If the user agrees (or explicitly invoked this skill)

Run these steps. Skip any step that's already done:

1. In `~/.claude/settings.json`, under `"extraKnownMarketplaces"`, set:
   ```json
   "avadco-adeel": {
     "source": { "source": "github", "repo": "avadco/adeel" },
     "autoUpdate": true
   }
   ```

2. In `~/.claude/plugins/known_marketplaces.json`, set `"autoUpdate": true` under `"avadco-adeel"`.

3. Confirm to the user that auto-update is now enabled.

### If the user declines

Say "No problem. You can enable it later with `/adeel-update`."
