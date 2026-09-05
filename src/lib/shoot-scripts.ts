export type ScriptStatus = 'draft' | 'sent' | 'approved' | 'changes_requested';

export interface ShootScript {
  id: string;
  title: string;
  content: string;
  template: 'overall' | 'detailed' | 'bulleted';
  status: ScriptStatus;
  createdAt: string;
  updatedAt: string;
  clientFeedback?: string;
}

export interface ShootScriptDocument {
  version: 1;
  videosPlanned: number;
  scripts: ShootScript[];
}

export const SCRIPT_TEMPLATES = {
  overall: {
    label: 'Overall brief',
    content: 'Objective:\n\nKey message:\n\nTone and style:\n\nMust-have shots:\n\nCall to action:\n',
  },
  detailed: {
    label: 'Detailed script',
    content: 'HOOK\n\nSCENE 1\nVisual:\nDialogue / voiceover:\n\nSCENE 2\nVisual:\nDialogue / voiceover:\n\nCALL TO ACTION\n',
  },
  bulleted: {
    label: 'Bulleted outline',
    content: '• Opening shot\n• Main talking point\n• Supporting visual\n• Closing shot / call to action\n',
  },
} as const;

function isDocument(value: unknown): value is ShootScriptDocument {
  return !!value && typeof value === 'object' && (value as { version?: unknown }).version === 1
    && Array.isArray((value as { scripts?: unknown }).scripts);
}

export function readShootScriptDocument(raw: string | null | undefined): ShootScriptDocument {
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isDocument(parsed)) {
        return {
          version: 1,
          videosPlanned: Math.max(1, Number(parsed.videosPlanned) || 1),
          scripts: parsed.scripts.map((script) => ({
            ...script,
            status: script.status || 'draft',
            template: script.template || 'overall',
          })),
        };
      }
    } catch {
      // A legacy plain-text script is converted below.
    }

    const now = new Date().toISOString();
    return {
      version: 1,
      videosPlanned: 1,
      scripts: [{ id: 'legacy-script', title: 'Video 1', content: raw, template: 'overall', status: 'draft', createdAt: now, updatedAt: now }],
    };
  }

  return { version: 1, videosPlanned: 1, scripts: [] };
}

export function writeShootScriptDocument(document: ShootScriptDocument): string {
  return JSON.stringify({
    version: 1,
    videosPlanned: Math.max(1, Math.floor(document.videosPlanned || 1)),
    scripts: document.scripts,
  });
}

export function createShootScript(template: keyof typeof SCRIPT_TEMPLATES, position: number): ShootScript {
  const now = new Date().toISOString();
  return {
    id: `script-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `Video ${position}`,
    content: SCRIPT_TEMPLATES[template].content,
    template,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}
