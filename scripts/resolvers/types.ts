export type Host = 'claude' | 'codex';

export interface HostPaths {
  skillRoot: string;
  localSkillRoot: string;
  binDir: string;
  browseDir: string;
}

export const HOST_PATHS: Record<Host, HostPaths> = {
  claude: {
    skillRoot: '~/.claude/skills/adeel',
    localSkillRoot: '.claude/skills/adeel',
    binDir: '${CLAUDE_PLUGIN_ROOT}/bin',
    browseDir: '${CLAUDE_PLUGIN_ROOT}/browse/dist',
  },
  codex: {
    skillRoot: '$ADEEL_ROOT',
    localSkillRoot: '.agents/skills/adeel',
    binDir: '$ADEEL_BIN',
    browseDir: '$ADEEL_BROWSE',
  },
};

export interface TemplateContext {
  skillName: string;
  tmplPath: string;
  benefitsFrom?: string[];
  host: Host;
  paths: HostPaths;
  preambleTier?: number;  // 1-4, controls which preamble sections are included
}
