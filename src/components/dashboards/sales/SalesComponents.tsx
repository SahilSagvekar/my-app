import React, { useState } from 'react';
import { Check, Flag, X, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { STATUS_GROUPS, PRIORITY_OPTIONS, SOCIAL_PLATFORMS, ACTIVITY_TYPES } from './constants';
import { parseSocials } from './utils';

/* Status Pill */
export function StatusPill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const current = STATUS_GROUPS.find(s => s.id === value) || STATUS_GROUPS[0];
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className="w-full h-[30px] rounded-[3px] text-[13px] font-medium transition-opacity hover:opacity-90 flex items-center justify-center"
                    style={{ backgroundColor: current.color, color: '#fff' }}
                >
                    {current.label}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[160px] p-1.5 space-y-0.5" align="center" sideOffset={4}>
                {STATUS_GROUPS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => { onChange(s.id); setOpen(false); }}
                        className="w-full h-[30px] rounded-[3px] text-[13px] font-medium text-white transition-opacity hover:opacity-90 flex items-center justify-center"
                        style={{ backgroundColor: s.color }}
                    >
                        {s.label}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}

/* Priority Pill */
export function PriorityPill({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const current = PRIORITY_OPTIONS.find(p => p.id === value) || PRIORITY_OPTIONS[PRIORITY_OPTIONS.length - 1];
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className="w-full h-[30px] rounded-[3px] text-[13px] font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-1"
                    style={{ backgroundColor: current.color, color: '#fff' }}
                >
                    {current.id && <Flag className="h-3 w-3" />}
                    {current.label}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[160px] p-1.5 space-y-0.5" align="center" sideOffset={4}>
                {PRIORITY_OPTIONS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => { onChange(p.id); setOpen(false); }}
                        className="w-full h-[30px] rounded-[3px] text-[13px] font-medium text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-1"
                        style={{ backgroundColor: p.color }}
                    >
                        {p.id && <Flag className="h-3 w-3" />}{p.label}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}

/* Social Cell */
export function SocialCell({ value, onUpdate }: {
    value: string;
    onUpdate: (patch: any) => void;
}) {
    const [open, setOpen] = useState(false);
    const [newPlatform, setNewPlatform] = useState('instagram');
    const [newUrl, setNewUrl] = useState('');

    const entries = parseSocials(value);

    const commit = (newEntries: Array<{ platform: string; url: string }>) => {
        onUpdate({
            socials: JSON.stringify(newEntries),
            instagram: newEntries.some(e => e.platform === 'instagram'),
            facebook: newEntries.some(e => e.platform === 'facebook'),
            linkedin: newEntries.some(e => e.platform === 'linkedin'),
            twitter: newEntries.some(e => e.platform === 'twitter'),
            tiktok: newEntries.some(e => e.platform === 'tiktok'),
        });
    };

    const addEntry = () => {
        if (!newUrl.trim()) return;
        commit([...entries, { platform: newPlatform, url: newUrl.trim() }]);
        setNewUrl('');
    };

    const removeEntry = (idx: number) => {
        commit(entries.filter((_, i) => i !== idx));
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="w-full h-[30px] px-1.5 flex items-center gap-1 bg-transparent hover:bg-[#F5F6F8] rounded text-left overflow-hidden">
                    {entries.length === 0 ? (
                        <span className="text-[11px] text-gray-300">+ Add</span>
                    ) : (
                        <>
                            {entries.slice(0, 4).map((e, i) => {
                                const p = SOCIAL_PLATFORMS.find(p => p.id === e.platform);
                                return (
                                    <span key={i}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                                        style={{ backgroundColor: p?.color || '#6B7280' }}
                                        title={e.url}>
                                        {p?.label || '?'}
                                    </span>
                                );
                            })}
                            {entries.length > 4 && (
                                <span className="text-[10px] text-gray-400 ml-0.5">+{entries.length - 4}</span>
                            )}
                        </>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-3 space-y-2.5" align="start" sideOffset={4}>
                {/* Simplified content for example purposes */}
                {entries.map((e, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-bold">{e.platform}:</span>
                        <span className="text-xs truncate flex-1">{e.url}</span>
                        <button onClick={() => removeEntry(i)} className="text-red-500"><X className="h-3 w-3"/></button>
                    </div>
                ))}
                <div className="flex gap-2">
                    <input value={newUrl} onChange={e => setNewUrl(e.target.value)} className="text-xs border p-1 flex-1"/>
                    <button onClick={addEntry} className="bg-blue-500 text-white p-1 rounded"><Plus className="h-3 w-3"/></button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

/* Monday.com style check mark */
export function MondayTick({ checked, onChange, color = '#00C875' }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className="w-[30px] h-[30px] rounded-[3px] flex items-center justify-center transition-all mx-auto"
            style={{
                backgroundColor: checked ? color : '#F5F6F8',
                border: checked ? 'none' : '1px solid #E6E9EF',
            }}
        >
            {checked && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
        </button>
    );
}
