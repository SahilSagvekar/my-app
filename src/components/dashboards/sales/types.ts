export interface Lead {
    id: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    socials: string;
    instagram: boolean;
    facebook: boolean;
    linkedin: boolean;
    twitter: boolean;
    tiktok: boolean;
    status: string;
    source: string;
    value: number | null;
    priority: string;
    meetingBooked: boolean;
    emailed: boolean;
    called: boolean;
    texted: boolean;
    notes: string;
    emailTemplate: string;
    metadata?: Record<string, any>;
    dmAt?: string;
    meetingAt?: string;
    emailedAt?: string;
    calledAt?: string;
    textedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    // Local UI-only fields
    _saved?: boolean;
    _dirty?: boolean;
    _committing?: boolean;
}

export interface SalesColumn {
    id: string;
    name: string;
    label: string;
    type: string;
    width?: string;
    order: number;
    isVisible: boolean;
    isCustom: boolean;
}

export interface ColumnDef {
    id: string;
    label: string;
    width: string;
    align?: 'left' | 'center' | 'right';
    sticky?: boolean;
    minPx?: number;
}

export interface ActivityEntry {
    type: string;
    time: string;   // ISO string
    location: string;
}
