import React from 'react';
import { 
    ChevronDown, 
    ChevronRight, 
    ArrowUpDown, 
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
    RefreshCw
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
import { formatPostingTime, formatPostingTimes } from './utils';

interface TaskRowProps {
    task: SchedulerTask;
    isExpanded: boolean;
    onToggle: () => void;
    isSelected: boolean;
    onSelect: (checked: boolean) => void;
    onMarkScheduled: () => void;
    onMarkPending: () => void;
    onAddLink: (platform: PlatformKey) => void;
    onEditLink: (platform: PlatformKey, url: string, postedAt: string) => void;
    onDeleteLink: (platform: PlatformKey, url: string) => void;
    onPreviewFile: (file: any) => void;
    onDownloadFile: (file: any) => void;
    onCopyTitle: (title: any) => void;
    onToggleTrial: (isTrial: boolean) => void;
    getFileUrl: (file: any) => string;
}

export function TaskRow({
    task,
    isExpanded,
    onToggle,
    isSelected,
    onSelect,
    onMarkScheduled,
    onMarkPending,
    onAddLink,
    onEditLink,
    onDeleteLink,
    onPreviewFile,
    onDownloadFile,
    onCopyTitle,
    onToggleTrial,
    getFileUrl
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

    return (
        <React.Fragment>
            {/* Main Row */}
            <tr
                className={`hover:bg-gray-50 transition-colors ${task.status === 'SCHEDULED' ? 'bg-green-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}
            >
                {/* Checkbox */}
                <td className="px-3 py-3">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={onSelect}
                    />
                </td>

                {/* Expand */}
                <td className="px-2 py-3">
                    <button
                        onClick={onToggle}
                        className="p-1 hover:bg-gray-200 rounded"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                </td>

                {/* Title */}
                <td className="px-3 py-3 max-w-[200px]">
                    <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate" title={task.title}>
                            {task.title}
                        </p>
                        {task.isTrial && (
                            <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded">
                                TRIAL
                            </span>
                        )}
                        {task.deliverable?.isTrial && (
                                <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded">
                                  TRIAL
                                </span>
                              )}
                    </div>
                </td>

                {/* Client */}
                <td className="px-3 py-3">
                    <span className="text-muted-foreground text-xs">
                        {task.client?.companyName || task.client?.name || task.clientId}
                    </span>
                </td>

                {/* Editor */}
                <td className="px-3 py-3">
                    <span className="text-xs text-blue-600">
                        {task.editor?.name || "-"}
                    </span>
                </td>

                {/* Trial Toggle */}
                {/* <td className="px-3 py-3 text-center">
                    <Checkbox
                        checked={task.isTrial || false}
                        onCheckedChange={(checked) => onToggleTrial(!!checked)}
                    />
                </td> */}

                {/* Due Date */}
                <td className="px-3 py-3">
                    <span className="text-xs">
                        {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '-'
                        }
                    </span>
                </td>

                {/* Files */}
                <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                        {imageFiles.length > 0 && (
                            <div className="flex items-center gap-1">
                                {imageFiles.map((file) => {
                                    const url = getFileUrl(file);
                                    return url ? (
                                        <button
                                            key={file.id}
                                            onClick={(e) => { e.stopPropagation(); onPreviewFile(file); }}
                                            className="w-8 h-8 rounded border border-gray-200 overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all flex-shrink-0"
                                            title={file.name}
                                        >
                                            <img
                                                src={url}
                                                alt={file.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ) : (
                                        <button
                                            key={file.id}
                                            onClick={(e) => { e.stopPropagation(); onPreviewFile(file); }}
                                            className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition-all flex-shrink-0"
                                            title={file.name}
                                        >
                                            <ImageIcon className="h-3 w-3 text-emerald-500" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {videoFiles.length > 0 && (
                            <Badge variant="outline" className="text-xs px-1.5">
                                <Video className="h-3 w-3 mr-1" />
                                {videoFiles.length}
                            </Badge>
                        )}
                        {task.files.length === 0 && (
                            <span className="text-muted-foreground text-xs">-</span>
                        )}
                    </div>
                </td>

                {/* AI Title */}
                <td className="px-3 py-3 text-center">
                    {task.titlingStatus === 'COMPLETED' && task.suggestedTitles?.length ? (
                        <button
                            onClick={() => onCopyTitle(task.suggestedTitles![0])}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 hover:bg-yellow-100 rounded text-xs font-medium text-yellow-800 border border-yellow-200"
                            title={getTitleText(task.suggestedTitles[0])}
                        >
                            <Copy className="h-3 w-3" />
                            Copy
                        </button>
                    ) : task.titlingStatus === 'PROCESSING' ? (
                        <Badge variant="outline" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Processing
                        </Badge>
                    ) : (
                        <span className="text-muted-foreground text-xs">-</span>
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
                                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${platform.bgColor} ${platform.color} border border-current opacity-80 hover:opacity-100 transition-opacity`}
                                    title={`View ${key} post`}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            ) : isPlatformInDeliverable ? (
                                <button
                                    onClick={() => onAddLink(key as PlatformKey)}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-50 text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors border border-dashed border-gray-300"
                                    title={`Add ${key} link`}
                                >
                                    <Plus className="h-3 w-3" />
                                </button>
                            ) : (
                                <span 
                                    className="inline-flex items-center justify-center w-7 h-7 text-gray-200"
                                    title={`${key} not configured for this deliverable`}
                                >
                                    <X className="h-3 w-3" />
                                </span>
                            )}
                        </td>
                    );
                })}

                {/* Status */}
                <td className="px-3 py-3 text-center">
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            {task.status === 'SCHEDULED' ? (
                                <Button variant="ghost" className="h-7 text-xs bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 gap-1 px-2">
                                    ✓ Scheduled
                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                </Button>
                            ) : (
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                    Pending
                                    <ChevronDown className="h-3 w-3 opacity-50" />
                                </Button>
                            )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                            align="end" 
                            sideOffset={4}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                            {task.status !== 'SCHEDULED' ? (
                                <DropdownMenuItem
                                    onClick={onMarkScheduled}
                                    className="text-green-600 font-medium"
                                >
                                    <Check className="h-4 w-4 mr-2" />
                                    Mark as Scheduled
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onClick={onMarkPending}
                                    className="text-amber-600 font-medium"
                                >
                                    <Clock className="h-4 w-4 mr-2" />
                                    Revert to Pending
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </td>
            </tr>

            {/* Expanded Row */}
            {isExpanded && (
                <tr className="bg-gray-50">
                    <td colSpan={14} className="px-6 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Files Section */}
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-700">
                                    <FileText className="h-4 w-4" />
                                    Task Files ({task.files.length})
                                </h4>
                                {task.files.length === 0 ? (
                                    <p className="text-muted-foreground text-sm">No files attached</p>
                                ) : (
                                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                        {(() => {
                                            const grouped = task.files.reduce((acc, file) => {
                                                const folderType = file.folderType || 'Uncategorized';
                                                if (!acc[folderType]) acc[folderType] = [];
                                                acc[folderType].push(file);
                                                return acc;
                                            }, {} as Record<string, typeof task.files>);

                                            const folderOrder: Record<string, number> = {
                                                'main': 0,
                                                'covers': 1,
                                                'tiles': 2,
                                                'other': 3,
                                                'Uncategorized': 4,
                                                'thumbnails': 5,
                                                'music-license': 6,
                                            };

                                            return Object.entries(grouped)
                                                .sort(([a], [b]) => (folderOrder[a] ?? 3) - (folderOrder[b] ?? 3));
                                        })().map(([folderType, folderFiles]) => (
                                            <div key={folderType} className="space-y-2">
                                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-gray-100 px-2 py-1 rounded inline-block">
                                                    {folderType.replace(/_/g, ' ')}
                                                </h5>
                                                <div className="space-y-2">
                                                    {folderFiles.map((file) => {
                                                        const isVideo = file.mimeType?.startsWith('video/');
                                                        const isImage = file.mimeType?.startsWith('image/');

                                                        return (
                                                            <div
                                                                key={file.id}
                                                                className="flex items-center justify-between p-2 bg-white rounded-lg border hover:border-primary/30 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                    {isVideo ? (
                                                                        <Video className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                                                    ) : isImage ? (
                                                                        <ImageIcon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                                    ) : (
                                                                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                                                    )}
                                                                    <div className="min-w-0">
                                                                        <p className="font-medium text-[13px] truncate">{file.name}</p>
                                                                        <p className="text-[10px] text-muted-foreground">
                                                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => onPreviewFile(file)}
                                                                        className="h-7 w-7 p-0"
                                                                    >
                                                                        <Eye className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        onClick={() => onDownloadFile(file)}
                                                                        className="h-7 w-7 p-0"
                                                                    >
                                                                        <Download className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* AI Titles & Details */}
                            <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-700">
                                    <Sparkles className="h-4 w-4 text-yellow-500" />
                                    AI Suggested Titles
                                </h4>
                                {task.suggestedTitles && task.suggestedTitles.length > 0 ? (
                                    <div className="space-y-2">
                                        {task.suggestedTitles.slice(0, 5).map((title, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between p-3 bg-white rounded-lg border hover:bg-gray-100 transition-colors"
                                            >
                                                <p className="text-sm flex-1 mr-2">{getTitleText(title)}</p>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => onCopyTitle(title)}
                                                    className="h-8"
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-white rounded-lg border text-center">
                                        <p className="text-muted-foreground text-sm">
                                            {task.titlingStatus === 'PROCESSING'
                                                ? 'AI titles are being generated...'
                                                : 'No AI titles generated yet'
                                            }
                                        </p>
                                    </div>
                                )}

                                {/* Social Links Summary */}
                                {task.socialMediaLinks && task.socialMediaLinks.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-semibold mb-2 text-sm text-gray-700">Posted Links</h4>
                                        <div className="space-y-2">
                                            {task.socialMediaLinks.map((link, i) => {
                                                const platformKey = link.platform.toLowerCase() as PlatformKey;
                                                const platform = PLATFORMS[platformKey];
                                                const PIcon = platform?.icon || ExternalLink;
                                                
                                                return (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group border border-gray-100 shadow-sm"
                                                    >
                                                        <div className={`p-1 rounded ${platform?.bgColor || 'bg-gray-100'}`}>
                                                            <PIcon className={`h-3.5 w-3.5 ${platform?.color || 'text-gray-600'}`} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <a
                                                                href={link.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-blue-600 hover:underline truncate block"
                                                            >
                                                                {link.url}
                                                            </a>
                                                            {link.postedAt && (
                                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-medium">
                                                                    <Clock className="h-2.5 w-2.5" />
                                                                    {new Date(link.postedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEditLink(platformKey, link.url, link.postedAt);
                                                                }}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 hover:bg-red-50"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDeleteLink(platformKey, link.url);
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Task Deliverable Info */}
                        {task.clientId && task.deliverable && (
                            <div className="mt-4 pt-4 border-t">
                                <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm text-gray-700">
                                    <Package className="h-4 w-4 text-indigo-500" />
                                    Deliverable Info
                                    <span className="text-xs font-normal text-muted-foreground">
                                        — {task.client?.companyName || task.client?.name || 'Client'}
                                    </span>
                                </h4>

                                <div className="p-3 rounded-lg border-2 border-indigo-200 bg-indigo-50">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm">{task.deliverable.type}</span>
                                            {task.deliverable.isOneOff && (
                                                <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-100 text-amber-700 border-amber-300">
                                                    One-Off
                                                </Badge>
                                            )}
                                        </div>
                                        {task.deliverable.quantity && (
                                            <Badge variant="secondary" className="text-xs font-bold">
                                                ×{task.deliverable.quantity}
                                            </Badge>
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
                                            <span className="text-gray-500 font-medium">
                                                {task.deliverable.postingDays.join(', ')}
                                            </span>
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
                                    {task.deliverable.platforms && task.deliverable.platforms.length > 0 && (
                                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                                            {task.deliverable.platforms.map((p) => {
                                                const pKey = p.toLowerCase() as PlatformKey;
                                                const pInfo = PLATFORMS[pKey];
                                                if (!pInfo) return (
                                                    <Badge key={p} variant="outline" className="text-[10px] h-5 px-1.5">{p}</Badge>
                                                );
                                                const PIcon = pInfo.icon;
                                                return (
                                                    <div key={p} className={`inline-flex items-center justify-center w-6 h-6 rounded ${pInfo.bgColor}`} title={p}>
                                                        <PIcon className={`h-3.5 w-3.5 ${pInfo.color}`} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {task.deliverable.description && (
                                        <p className="text-xs text-muted-foreground mt-2 italic">{task.deliverable.description}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
}