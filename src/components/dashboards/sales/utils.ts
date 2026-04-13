import { Lead } from './types';

export function tempId() {
    return '__tmp_' + Math.random().toString(36).slice(2, 10);
}

export function emptyDraftLead(status = 'NEW'): Lead {
    return {
        id: tempId(),
        name: '', company: '', email: '', phone: '', socials: '',
        instagram: false, facebook: false, linkedin: false, twitter: false, tiktok: false,
        status, source: '', value: null, priority: '',
        meetingBooked: false, emailed: false,
        called: false, texted: false, notes: '', emailTemplate: '',
        dmAt: undefined, meetingAt: undefined, emailedAt: undefined,
        calledAt: undefined, textedAt: undefined,
        _saved: false, _dirty: false, _committing: false,
    };
}

export function dbLeadToLocal(l: any): Lead {
    return {
        id: l.id, name: l.name, company: l.company || '', email: l.email,
        phone: l.phone || '', socials: l.socials || '',
        instagram: !!l.instagram, facebook: !!l.facebook,
        linkedin: !!l.linkedin, twitter: !!l.twitter, tiktok: !!l.tiktok,
        status: l.status || 'NEW',
        source: l.source || '', value: l.value || null, priority: l.priority || '',
        meetingBooked: l.meetingBooked, emailed: l.emailed,
        called: l.called, texted: l.texted,
        notes: l.notes, emailTemplate: l.emailTemplate,
        dmAt: l.dmAt, meetingAt: l.meetingAt, emailedAt: l.emailedAt,
        calledAt: l.calledAt, textedAt: l.textedAt,
        createdAt: l.createdAt, updatedAt: l.updatedAt,
        metadata: l.metadata || {},
        _saved: true, _dirty: false, _committing: false,
    };
}

export function formatToEST(iso: string) {
    try {
        return new Date(iso).toLocaleString('en-US', {
            timeZone: 'America/New_York', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
        });
    } catch { return iso; }
}

export function parseSocials(raw: string): Array<{ platform: string; url: string }> {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
    } catch { }
    return raw.trim() ? [{ platform: 'other', url: raw.trim() }] : [];
}

export function parseActivities(raw?: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
    } catch { }
    return [];
}
