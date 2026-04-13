import { ColumnDef } from './types';

export const STATUS_GROUPS = [
    { id: 'NEW', label: 'New', color: '#579BFC', bg: 'bg-[#579BFC]', text: 'text-white' },
    { id: 'CONTACTED', label: 'Contacted', color: '#FDAB3D', bg: 'bg-[#FDAB3D]', text: 'text-white' },
    { id: 'WORKING', label: 'Working', color: '#A25DDC', bg: 'bg-[#A25DDC]', text: 'text-white' },
    { id: 'QUALIFIED', label: 'Qualified', color: '#00C875', bg: 'bg-[#00C875]', text: 'text-white' },
    { id: 'WON', label: 'Won', color: '#037F4C', bg: 'bg-[#037F4C]', text: 'text-white' },
    { id: 'LOST', label: 'Lost', color: '#E2445C', bg: 'bg-[#E2445C]', text: 'text-white' },
];

export const PRIORITY_OPTIONS = [
    { id: 'critical', label: 'Critical ⚡', color: '#333333', bg: 'bg-[#333333]', text: 'text-white' },
    { id: 'high', label: 'High', color: '#E2445C', bg: 'bg-[#E2445C]', text: 'text-white' },
    { id: 'medium', label: 'Medium', color: '#FDAB3D', bg: 'bg-[#FDAB3D]', text: 'text-white' },
    { id: 'low', label: 'Low', color: '#579BFC', bg: 'bg-[#579BFC]', text: 'text-white' },
    { id: '', label: '—', color: '#C4C4C4', bg: 'bg-[#C4C4C4]', text: 'text-white' },
];

export const DM_PLATFORMS = [
    { id: 'instagram', label: 'Instagram', color: '#E1306C' },
    { id: 'facebook', label: 'Facebook', color: '#1877F2' },
    { id: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
    { id: 'twitter', label: 'Twitter', color: '#1DA1F2' },
    { id: 'tiktok', label: 'TikTok', color: '#000000' },
    { id: 'other', label: 'Other', color: '#6B7280' },
];

export const CORE_COLUMNS: ColumnDef[] = [
    { id: 'name', label: 'Lead', width: 'min-w-[220px] w-[220px]', sticky: true, minPx: 220 },
    { id: 'company', label: 'Company', width: 'min-w-[220px] w-[220px]', minPx: 220 },
    { id: 'status', label: 'Status', width: 'min-w-[130px] w-[130px]', align: 'center', minPx: 130 },
    { id: 'priority', label: 'Priority', width: 'min-w-[120px] w-[120px]', align: 'center', minPx: 120 },
    { id: 'email', label: 'Email', width: 'min-w-[180px] w-[180px]', minPx: 180 },
    { id: 'phone', label: 'Phone', width: 'min-w-[140px] w-[140px]', minPx: 140 },
    { id: 'socials', label: 'Socials', width: 'min-w-[160px] w-[160px]', minPx: 160 },
    { id: 'value', label: 'Deal Value', width: 'min-w-[110px] w-[110px]', align: 'center', minPx: 110 },
    { id: 'source', label: 'Source', width: 'min-w-[120px] w-[120px]', minPx: 120 },
    { id: 'activity', label: 'Activity', width: 'min-w-[160px] w-[160px]', minPx: 160 },
    { id: 'notes', label: 'Notes', width: 'min-w-[120px] w-[120px]', align: 'center', minPx: 120 },
];

export const DEFAULT_EMAIL_TEMPLATES = [
    {
        name: 'Introduction',
        body: `Hi {name},\n\nI wanted to reach out from E8 Productions. We specialize in creating premium content for brands looking to level up their social media presence.\n\nWould love to chat about how we can help your brand grow.\n\nBest,\n[Your Name]`,
    },
    {
        name: 'Follow-up',
        body: `Hi {name},\n\nJust following up on my previous message. I'd love to schedule a quick call to discuss how E8 Productions can help with your content needs.\n\nLet me know if you have 15 minutes this week!\n\nBest,\n[Your Name]`,
    },
];

export const SOCIAL_PLATFORMS = [
    { id: 'instagram', label: 'IG', fullLabel: 'Instagram', color: '#E1306C' },
    { id: 'facebook', label: 'FB', fullLabel: 'Facebook', color: '#1877F2' },
    { id: 'linkedin', label: 'LI', fullLabel: 'LinkedIn', color: '#0A66C2' },
    { id: 'twitter', label: 'X', fullLabel: 'Twitter / X', color: '#1DA1F2' },
    { id: 'tiktok', label: 'TT', fullLabel: 'TikTok', color: '#010101' },
    { id: 'youtube', label: 'YT', fullLabel: 'YouTube', color: '#FF0000' },
    { id: 'other', label: '•••', fullLabel: 'Other', color: '#6B7280' },
];

export const ACTIVITY_TYPES = [
    { id: 'meeting', label: 'Mtg', fullLabel: 'Meeting', color: '#00C875', icon: '🤝' },
    { id: 'email',   label: 'Email', fullLabel: 'Email',   color: '#579BFC', icon: '✉️' },
    { id: 'call',    label: 'Call', fullLabel: 'Call',    color: '#FDAB3D', icon: '📞' },
    { id: 'text',    label: 'Text', fullLabel: 'Text',    color: '#A25DDC', icon: '💬' },
];
