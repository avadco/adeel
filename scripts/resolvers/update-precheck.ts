import type { TemplateContext } from './types';

export function generateUpdatePrecheck(_ctx: TemplateContext): string {
  return `## Pre-check

Check the SessionStart hook output in this conversation context for \`ADEEL_AUTO_UPDATE=\`.
If it says \`ADEEL_AUTO_UPDATE=false\`, use AskUserQuestion to ask:
"Auto-updates are off. Run /adeel-update to enable?" If yes, invoke
\`/adeel-update\`. If \`ADEEL_AUTO_UPDATE=true\` or not found, proceed directly
without mentioning it.`;
}
