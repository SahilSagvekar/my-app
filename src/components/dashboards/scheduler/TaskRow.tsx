'use client';
import React, { useState } from 'react';
import { toast } from 'sonner';
import {
    ChevronDown,
    ChevronRight,
    FileText,
    Video,
    Image as ImageIcon,
    Sparkles,
    Copy,
    Check,
    Clock,
    Pencil,
    Trash2,
    ExternalLink,
    Plus,
    X,
    Eye,
    Download,
    Package,
    Calendar,
    RefreshCw,
    ArrowLeft,
    ChevronDown as CD,
    Info,
    AlertTriangle,
    MessageSquare,
    User as UserIcon,
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { SchedulerTask, PlatformKey } from './types';
import { PLATFORMS } from './icons';
import { formatPostingTimes } from './utils';
import { LinkedSfTasks } from '../../tasks/LinkedSfTasks';
import { TagPicker } from '../../workflow/TagPicker';

interface TaskRowProps {
    task: SchedulerTask;
    isExpanded: boolean;
    onToggle: () => void;
    isSelected: boolean;
    onSelect: (checked: boolean) => void;
    onMarkScheduled: () => void;
    onMarkPending: () => void;
    onSendBack: () => void;
    onAddLink: (platform: PlatformKey) => void;
    onEditLink: (platform: PlatformKey, url: string, postedAt: string) => void;
    onDeleteLink: (platform: PlatformKey, url: string) => void;
    onPreviewFile: (file: any) => void;
    onDownloadFile: (file: any) => void;
    onCopyTitle: (title: any) => void;
    onToggleTrial: (isTrial: boolean) => void;
    onUpdatePostingDate: (date: string) => void;
    onTagsChange: (tags: string[]) => void;
    getFileUrl: (file: any) => string;
    canRemoveTags?: boolean;
}

export function TaskRow({
    task,
    isExpanded,
    onToggle,
    isSelected,
    onSelect,
    onMarkScheduled,
    onMarkPending,
    onSendBack,
    onAddLink,
    onEditLink,
    onDeleteLink,
    onPreviewFile,
    onDownloadFile,
    onCopyTitle,
    onToggleTrial,
    onUpdatePostingDate,
    onTagsChange,
    getFileUrl,
    canRemoveTags = false,
}: TaskRowProps) {
    const videoFiles = task.files.filter(f => f.mimeType?.startsWith('video/'));
    const imageFiles = task.files.filter(f => f.mimeType?.startsWith('image/'));

    const hasPlatformLink = (platform: PlatformKey): string | null => {
        const link = task.socialMediaLinks?.find(l => l.platform.toLowerCase() === platform.toLowerCase());
        return link?.url || null;
    };

    const getTitleText = (titleItem: any): string => {
        return typeof titleItem === 'string' ? titleItem : titleItem?.title || '';
    };

    const folderOrder: Record<string, number> = {
        main: 0, covers: 1, tiles: 2, other: 3, Uncategorized: 4, thumbnails: 5, 'music-license': 6,
    };

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dateInput, setDateInput] = useState('');
    const [feedbackVersionFilter, setFeedbackVersionFilter] = useState<number | 'all'>('all');

    const currentPostingDate = task.postingDate
        ? new Date(task.postingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
        : null;

    const handleDateSave = () => {
        if (!dateInput) return;
        // dateInput is YYYY-MM-DD, convert to ISO
        const iso = new Date(dateInput + 'T12:00:00').toISOString();
        onUpdatePostingDate(iso);
        setShowDatePicker(false);
        setDateInput('');
    };

    return (
        <React.Fragment>
            {/* Main Row */}
            <tr className={`border-b transition-colors bg-white hover:bg-gray-50/80 ${isSelected ? 'bg-blue-50' : ''}`}>

                {/* Checkbox */}
                <td className="px-3 py-3">
                    <Checkbox checked={isSelected} onCheckedChange={onSelect} />
                </td>

                {/* Expand */}
                <td className="px-2 py-3">
                    <button onClick={onToggle} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                </td>

                {/* Task Title */}
                <td className="px-3 py-3 max-w-[200px]">
                    <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm truncate text-gray-900" title={task.title}>{task.title}</p>
                        {task.isSponsored && (
                            <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
                                ★ SPONS
                            </span>
                        )}
                        {(task.isTrial || task.deliverable?.isTrial) && (
                            <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-white text-black border border-black rounded">
                                TRIAL
                            </span>
                        )}
                    </div>
                    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                        <TagPicker
                            taskId={task.id}
                            tags={(task.tags || []).map(t => t.name)}
                            onChange={onTagsChange}
                            canRemove={canRemoveTags}
                        />
                    </div>
                </td>

                {/* Editor */}
                <td className="px-3 py-3">
                    <span className="text-sm text-gray-700 truncate block max-w-[140px]" title={task.editor?.name || ''}>
                        {task.editor?.name || <span className="text-gray-300">—</span>}
                    </span>
                </td>

                {/* Posted Date */}
                <td className="px-3 py-3 relative">
                    {showDatePicker ? (
                        <div className="flex items-center gap-1">
                            <input
                                type="date"
                                autoFocus
                                value={dateInput}
                                onChange={e => setDateInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleDateSave();
                                    if (e.key === 'Escape') { setShowDatePicker(false); setDateInput(''); }
                                }}
                                className="text-xs border rounded px-1.5 py-1 w-[130px] focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button onClick={handleDateSave} className="text-[10px] font-semibold px-1.5 py-1 bg-green-600 text-white rounded hover:bg-green-700">✓</button>
                            <button onClick={() => { setShowDatePicker(false); setDateInput(''); }} className="text-[10px] font-semibold px-1.5 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">✕</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                setShowDatePicker(true);
                                if (task.postingDate) setDateInput(new Date(task.postingDate).toISOString().slice(0, 10));
                            }}
                            className="text-sm text-left group flex items-center gap-1"
                            title="Click to edit posting date"
                        >
                            {currentPostingDate ? (
                                <span className="font-bold text-gray-700 group-hover:text-primary transition-colors">{currentPostingDate}</span>
                            ) : (
                                <span className="text-gray-400 group-hover:text-primary transition-colors text-xs">Set date</span>
                            )}
                            <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                        </button>
                    )}
                </td>

                {/* Details dropdown */}
                <td className="px-2 py-3 text-center">
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600" title="Client, editor & files">
                                <Info className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4} className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
                            <div className="px-2 py-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
                                <p className="text-xs mt-0.5">{task.client?.companyName || task.client?.name || task.clientId}</p>
                            </div>
                            <div className="px-2 py-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Editor</p>
                                <p className="text-xs text-blue-600 mt-0.5">{task.editor?.name || '-'}</p>
                            </div>
                            <div className="px-2 py-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Files</p>
                                <div className="flex items-center gap-1 flex-wrap">
                                    {imageFiles.map((file) => {
                                        const url = getFileUrl(file);
                                        return url ? (
                                            <button key={file.id} onClick={(e) => { e.stopPropagation(); onPreviewFile(file); }} className="w-8 h-8 rounded border overflow-hidden hover:ring-2 hover:ring-primary/40 flex-shrink-0">
                                                <img src={url} alt={file.name} className="w-full h-full object-cover" />
                                            </button>
                                        ) : (
                                            <button key={file.id} onClick={(e) => { e.stopPropagation(); onPreviewFile(file); }} className="w-8 h-8 rounded border bg-gray-50 flex items-center justify-center hover:ring-2 hover:ring-primary/40 flex-shrink-0">
                                                <ImageIcon className="h-3 w-3 text-emerald-500" />
                                            </button>
                                        );
                                    })}
                                    {videoFiles.length > 0 && <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black text-white text-xs"><Video className="h-3 w-3" />{videoFiles.length}</div>}
                                    {task.files.length === 0 && <span className="text-muted-foreground text-xs">-</span>}
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </td>

                {/* Cover */}
                <td className="px-2 py-3 text-center">
                    {(task.deliverableType || '').toLowerCase().includes('short form') && task.client?.requiresCoverImage ? (
                        task.files.some((f) => f.folderType === 'covers') ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-400 mx-auto" />
                        )
                    ) : null}
                </td>

                {/* Posting Titles */}
                <td className="px-3 py-3 max-w-[200px]">
                    {task.postingTitles && task.postingTitles.length > 0 ? (
                        <div className="space-y-1 min-w-0">
                            {task.postingTitles.map((t, i) => (
                                <div key={t.id} className="flex items-center gap-1 min-w-0">
                                    <span className="text-xs text-gray-700 truncate" title={t.text}>{t.text}</span>
                                    <button onClick={() => onCopyTitle(t.text)} className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100 cursor-pointer">
                                        <Copy className="h-2.5 w-2.5 text-gray-400" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (task.titleSetByQC || task.titleSetByClient) && task.postingTitle ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${task.titleSetByClient ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-violet-100 text-violet-700 border-violet-300'}`}>
                                {task.titleSetByClient ? 'CLIENT' : 'QC'}
                            </span>
                            <span className="text-xs text-gray-700 truncate" title={task.postingTitle}>{task.postingTitle}</span>
                        </div>
                    ) : task.titlingStatus === 'COMPLETED' && task.suggestedTitles?.length ? (
                        <button onClick={() => onCopyTitle(task.suggestedTitles![0])} className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 hover:bg-yellow-100 rounded text-xs font-medium text-yellow-800 border border-yellow-200">
                            <Copy className="h-3 w-3" />Copy
                        </button>
                    ) : task.titlingStatus === 'PROCESSING' ? (
                        <Badge variant="outline" className="text-xs"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>
                    ) : (
                        <span className="text-gray-300 text-xs">—</span>
                    )}
                </td>

                {/* Platform columns */}
                {Object.entries(PLATFORMS).map(([key, platform]) => {
                    const linkUrl = hasPlatformLink(key as PlatformKey);
                    const Icon = platform.icon;
                    const deliverablePlatforms = task.deliverable?.platforms?.map((p: string) => p.toLowerCase()) || [];
                    const isPlatformInDeliverable = deliverablePlatforms.length === 0 || deliverablePlatforms.includes(key.toLowerCase());

                    return (
                        <td key={key} className="px-2 py-3 text-center">
                            {linkUrl ? (
                                <button
                                    onClick={() => window.open(linkUrl, '_blank')}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black text-white border border-black hover:opacity-90 transition-opacity"
                                    title={`View ${key} post`}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            ) : isPlatformInDeliverable ? (
                                <button
                                    onClick={() => onAddLink(key as PlatformKey)}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-black text-black hover:bg-gray-100 transition-colors"
                                    title={`Add ${key} link`}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            ) : null /* platform not in this deliverable — render nothing (cell kept so columns stay aligned) */}
                        </td>
                    );
                })}

                {/* Status */}
                <td className="px-3 py-3 text-right">
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            {task.status === 'SCHEDULED' ? (
                                <button className="inline-flex items-center gap-1 text-sm text-green-700 font-medium hover:text-green-800 transition-colors border border-green-200 px-2 py-1 rounded">
                                    Scheduled <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                                </button>
                            ) : (
                                <button className="inline-flex items-center gap-1 text-sm text-gray-600 font-medium hover:text-gray-800 transition-colors border border-gray-200 px-2 py-1 rounded">
                                    Pending <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                                </button>
                            )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4} onCloseAutoFocus={(e) => e.preventDefault()}>
                            {task.status !== 'SCHEDULED' ? (
                                <DropdownMenuItem onClick={onMarkScheduled} className="text-green-600 font-medium">
                                    <Check className="h-4 w-4 mr-2" />Mark as Scheduled
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={onMarkPending} className="text-amber-600 font-medium">
                                    <Clock className="h-4 w-4 mr-2" />Revert to Pending
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={onSendBack} className="text-red-600 font-medium">
                                <ArrowLeft className="h-4 w-4 mr-2" />Send Back to Editor
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </td>
            </tr>

            {/* Expanded Row */}
            {isExpanded && (
                <tr className="bg-gray-50">
                    <td colSpan={16} className="px-6 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Files Section */}
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-500">
                                    {/* <FileText className="h-4 w-4" /> */}
                                    TASK FILES ({task.files.length})
                                </h4>
                                {task.files.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No files attached</p>
                                ) : (
                                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                        {Object.entries(
                                            task.files.reduce((acc, file) => {
                                                const ft = file.folderType || 'Uncategorized';
                                                if (!acc[ft]) acc[ft] = [];
                                                acc[ft].push(file);
                                                return acc;
                                            }, {} as Record<string, typeof task.files>)
                                        )
                                            .sort(([a], [b]) => (folderOrder[a] ?? 3) - (folderOrder[b] ?? 3))
                                            .map(([folderType, folderFiles]) => (
                                                <div key={folderType} className="space-y-2">
                                                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-gray-100 px-2 py-1 rounded inline-flex items-center gap-1.5">
                                                        {folderType === 'thumbnails' && (
                                                            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                                                                <ImageIcon className="h-3 w-3 text-white" />
                                                            </div>
                                                        )}
                                                        {folderType === 'music-license' && (
                                                            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                                                                <FileText className="h-3 w-3 text-white" />
                                                            </div>
                                                        )}
                                                        {folderType === 'main' && (
                                                            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                                                                <Video className="h-3 w-3 text-white" />
                                                            </div>
                                                        )}
                                                        {folderType === 'covers' && (
                                                            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                                                                <ImageIcon className="h-3 w-3 text-white" />
                                                            </div>
                                                        )}
                                                        {folderType === 'tiles' && (
                                                            <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center">
                                                                <ImageIcon className="h-3 w-3 text-white" />
                                                            </div>
                                                        )}
                                                        {!['thumbnails', 'music-license', 'main', 'covers', 'tiles'].includes(folderType) && (
                                                            <div className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center">
                                                                <span className="text-black text-lg font-bold">+</span>
                                                            </div>
                                                        )}
                                                        {folderType.replace(/_/g, ' ')}
                                                    </h5>
                                                    <div className="space-y-2">
                                                        {folderFiles.map((file) => (
                                                            <div key={file.id} className="flex items-center justify-between p-2 bg-white rounded-lg border hover:border-primary/30 transition-colors">
                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                    {file.mimeType?.startsWith('video/') ? (
                                                                        <Video className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                                    ) : file.mimeType?.startsWith('image/') ? (
                                                                        <ImageIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                                    ) : (
                                                                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <p className="font-medium text-[13px] truncate">{file.name}</p>
                                                                        <p className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Button size="sm" variant="ghost" onClick={() => onPreviewFile(file)} className="h-7 w-7 p-0">
                                                                        <Eye className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button size="sm" variant="ghost" onClick={() => onDownloadFile(file)} className="h-7 w-7 p-0">
                                                                        <Download className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Posting Content: Titles, Descriptions, Tags */}
                            <div className="space-y-4">
                                {/* Titles */}
                                <div>
                                    <h4 className="font-bold mb-2 flex items-center gap-2 text-sm text-gray-500">
                                        {/* <Sparkles className="h-4 w-4 text-violet-500" /> */}
                                        TITLE
                                    </h4>
                                    {task.postingTitles && task.postingTitles.length > 0 ? (
                                        <div className="space-y-2">
                                            {task.postingTitles.map((t, i) => (
                                                <div key={t.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                                                        <p className="text-sm font-medium text-black truncate">{t.text}</p>
                                                    </div>
                                                    <Button size="sm" variant="ghost" onClick={() => onCopyTitle(t.text)} className="h-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100 shrink-0">
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (task.titleSetByQC || task.titleSetByClient) && task.postingTitle ? (
                                        <div className={`flex items-center justify-between p-3 rounded-lg border bg-white border-gray-200`}>
                                            <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                                                <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${task.titleSetByClient ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-violet-100 text-violet-700 border-violet-300'}`}>
                                                    {task.titleSetByClient ? 'CLIENT' : 'QC'}
                                                </span>
                                                <p className="text-sm font-medium truncate text-black">{task.postingTitle}</p>
                                            </div>
                                            <Button size="sm" variant="ghost" onClick={() => onCopyTitle(task.postingTitle!)} className="h-8 shrink-0">
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : task.suggestedTitles && task.suggestedTitles.length > 0 ? (
                                        <div className="space-y-2">
                                            {task.suggestedTitles.slice(0, 5).map((title, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border hover:bg-gray-100 transition-colors">
                                                    <p className="text-sm flex-1 mr-2">{getTitleText(title)}</p>
                                                    <Button size="sm" variant="ghost" onClick={() => onCopyTitle(title)} className="h-8">
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-3 bg-white rounded-lg border text-center">No titles set</p>
                                    )}
                                </div>

                                {/* Descriptions */}
                                {task.postingDescriptions && task.postingDescriptions.length > 0 && (
                                    <div>
                                        <h4 className="font-bold mb-2 text-sm text-gray-700">Descriptions</h4>
                                        <div className="space-y-2">
                                            {task.postingDescriptions.map((d, i) => (
                                                <div key={d.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border">
                                                    <div className="flex gap-2 flex-1 min-w-0 mr-2">
                                                        <p className="text-sm text-gray-800 break-words">{d.text}</p>
                                                    </div>
                                                    <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(d.text)} className="h-8 shrink-0">
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tags */}
                                {task.postingTags && task.postingTags.length > 0 && (
                                    <div>
                                        <h4 className="font-bold mb-2 text-sm text-gray-500">TAGS</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {task.postingTags.map(t => (
                                                <button key={t.id} onClick={() => {
                                                    navigator.clipboard.writeText(`#${t.text.replace(/^#+/, '').trim()}`);
                                                    toast.success('Copied to clipboard');
                                                }}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-sm font-semibold text-black bg-white hover:bg-gray-100 rounded-[0.625rem] border border-gray-200 transition-colors">
                                                    #{t.text.replace(/^#+/, '').trim()}
                                                    <Copy className="h-2.5 w-2.5 opacity-50" />
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(task.postingTags.map(t => `#${t.text.replace(/^#+/, '').trim()}`).join(' '));
                                                toast.success('Copied to clipboard');
                                            }}
                                            className="mt-2 text-sm font-bold text-black underline cursor-pointer"
                                        >
                                            Copy all
                                        </button>
                                    </div>
                                )}

                                {/* AI Suggested Titles (reference — separate from curated posting titles) */}
                                {task.suggestedTitles && task.suggestedTitles.length > 0 && (
                                    <div>
                                        <h4 className="font-bold mb-2 flex items-center gap-2 text-sm text-gray-500">
                                            <Sparkles className="h-4 w-4 text-yellow-400" />AI Suggested Titles
                                        </h4>
                                        <div className="space-y-1.5">
                                            {task.suggestedTitles.slice(0, 5).map((title, i) => (
                                                <div key={i} className="flex items-center justify-between p-2.5 bg-yellow-50 rounded-lg border border-yellow-100">
                                                    <p className="text-xs flex-1 mr-2 text-yellow-900">{getTitleText(title)}</p>
                                                    <Button size="sm" variant="ghost" onClick={() => onCopyTitle(title)} className="h-7 text-yellow-700">
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {task.socialMediaLinks && task.socialMediaLinks.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-bold mb-2 text-sm text-gray-700">Posted Links</h4>
                                        <div className="space-y-2">
                                            {task.socialMediaLinks.map((link, i) => {
                                                const platformKey = link.platform.toLowerCase() as PlatformKey;
                                                const pl = PLATFORMS[platformKey];
                                                const PIcon = pl?.icon || ExternalLink;
                                                return (
                                                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group border border-gray-100 shadow-sm">
                                                        <div className="p-1 rounded-full bg-black">
                                                            <PIcon className="h-3.5 w-3.5 text-white" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-black hover:underline truncate block">
                                                                {link.url}
                                                            </a>
                                                            {link.postedAt && (
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                                                                    <Clock className="h-2.5 w-2.5" />
                                                                    {new Date(link.postedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onEditLink(platformKey, link.url, link.postedAt); }}>
                                                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDeleteLink(platformKey, link.url); }}>
                                                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>{/* end space-y-4 posting content */}
                        </div>

                        {/* Revision Comments — version-tracked, shows who left each comment */}
                        {task.taskFeedback && task.taskFeedback.length > 0 && (() => {
                            const allVersions = [...new Set(task.taskFeedback!.map(fb => fb.fileVersion || 1))].sort((a, b) => b - a);
                            const visibleComments = feedbackVersionFilter === 'all'
                                ? task.taskFeedback!
                                : task.taskFeedback!.filter(fb => (fb.fileVersion || 1) === feedbackVersionFilter);

                            return (
                                <div className="mt-4 pt-4 border-t">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-bold flex items-center gap-2 text-sm text-gray-500">
                                            <MessageSquare className="h-4 w-4" />
                                            REVISION COMMENTS ({visibleComments.length})
                                        </h4>
                                        {allVersions.length > 1 && (
                                            <select
                                                className="text-xs border rounded px-2 py-1 bg-white text-gray-700"
                                                value={feedbackVersionFilter}
                                                onChange={e => setFeedbackVersionFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value="all">All versions</option>
                                                {allVersions.map(v => (
                                                    <option key={v} value={v}>V{v}{v === allVersions[0] ? ' (current)' : ''}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {visibleComments.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No comments on this version.</p>
                                    ) : (
                                        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                            {visibleComments.map((fb) => (
                                                <div key={fb.id} className="p-3 bg-white border rounded-lg">
                                                    {/* Time badge and comment text inline */}
                                                    <div className="flex items-start gap-2 mb-2">
                                                        {fb.timestamp && (
                                                            <Badge variant="outline" className="font-bold text-[10px] px-1.5 py-0 h-5 bg-gray-100 shrink-0">
                                                                <Clock className="h-2.5 w-2.5 mr-0.5" />
                                                                {fb.timestamp}
                                                            </Badge>
                                                        )}
                                                        <p className="text-sm font-medium text-black leading-relaxed whitespace-pre-wrap break-words">
                                                            {fb.feedback}
                                                        </p>
                                                    </div>
                                                    {/* Version, folder type, category and author info on same line */}
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <span className="font-medium">V{fb.fileVersion || 1}</span>
                                                        <span>·</span>
                                                        <span className="capitalize">{fb.folderType}</span>
                                                        {fb.category && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="capitalize">{fb.category}</span>
                                                            </>
                                                        )}
                                                        <span className="ml-2 flex items-center gap-1">
                                                            <UserIcon className="h-3 w-3" />
                                                            <span className="font-medium">{fb.authorName}</span>
                                                            {fb.authorRole && <span className="capitalize">· {fb.authorRole}</span>}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Deliverable Info */}
                        {task.clientId && task.deliverable && (
                            <div className="mt-4 pt-4 border-t">
                                <h4 className="font-bold mb-3 flex items-center gap-2 text-sm text-gray-500">
                                    {/* <Package className="h-4 w-4 text-indigo-500" /> */}
                                    DELIVERABLE INFO
                                    <span className="text-xs font-bold text-muted-foreground">— {task.client?.companyName || task.client?.name || 'Client'}</span>
                                </h4>
                                <div className="p-3 rounded-lg border border-black bg-white">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="font-bold text-sm">{task.deliverable.type}</span>
                                                {task.deliverable.isOneOff && (
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-300">One-Off</Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                {task.deliverable.postingSchedule && (
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        <span className="capitalize">{task.deliverable.postingSchedule}</span>
                                                    </div>
                                                )}
                                                {task.deliverable.postingDays && task.deliverable.postingDays.length > 0 && (
                                                    <span className="text-gray-500 font-medium">{task.deliverable.postingDays.join(', ')}</span>
                                                )}
                                                {task.deliverable.postingTimes && task.deliverable.postingTimes.length > 0 && (
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        <span className="font-medium">{formatPostingTimes(task.deliverable.postingTimes)}</span>
                                                    </div>
                                                )}
                                                {task.deliverable.videosPerDay && (
                                                    <span className="font-medium">{task.deliverable.videosPerDay} video{task.deliverable.videosPerDay > 1 ? 's' : ''}/day</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-row items-center gap-2 ml-4">
                                            {task.deliverable.platforms && task.deliverable.platforms.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap justify-center">
                                                    {task.deliverable.platforms.map((p) => {
                                                        const pKey = p.toLowerCase() as PlatformKey;
                                                        const pInfo = PLATFORMS[pKey];
                                                        if (!pInfo) return <Badge key={p} variant="outline" className="text-[10px] h-5 px-1.5">{p}</Badge>;
                                                        const PIcon = pInfo.icon;
                                                        return (
                                                            <div key={p} className="inline-flex items-center justify-center w-8 h-8 rounded-[0.625rem] bg-gray-200 text-black" title={p}>
                                                                <PIcon className="h-4.5 w-4.5" />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {task.deliverable.quantity && (
                                                <div className="inline-flex items-center justify-center px-2 py-1 rounded bg-black text-white text-md font-bold  ">
                                                    ×{task.deliverable.quantity}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {task.deliverable.description && (
                                        <p className="text-xs text-muted-foreground mt-2 italic">{task.deliverable.description}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Linked SF Tasks — read-only, shown for LF tasks */}
                        {[task.deliverableType, task.deliverable?.type, task.title].some(
                            v => typeof v === 'string' && (
                                v.toUpperCase().includes('LF') ||
                                v.toLowerCase().includes('long form') ||
                                v.toLowerCase().includes('longform')
                            )
                        ) && (
                            <div className="mt-4 pt-4 border-t">
                                <LinkedSfTasks
                                    lfTaskId={task.id}
                                    clientId={task.clientId}
                                    canEdit={false}
                                />
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}