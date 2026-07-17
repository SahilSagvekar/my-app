"use client";

import React, { useState } from 'react';
import { 
    RefreshCw, 
    Check, 
    ArrowUpDown, 
    FileText, 
    Sparkles, 
    Loader2,
    AlertTriangle,
    ArrowLeft,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { FilePreviewModal } from '../../FileViewerModal';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../../ui/dialog";
import { useScheduler } from './useScheduler';
import { FilterBar } from './FilterBar';
import { TaskRow } from './TaskRow';
import { SchedulerTask, PlatformKey } from './types';
import { PLATFORMS } from './icons';
import { formatPostingTime, formatPostingTimes } from './utils';
import { LinkDialog } from './LinkDialog';
import { toast } from 'sonner';

export function SchedulerSpreadsheetView() {
    const {
        tasks,
        loading,
        isInitialLoad,
        searchTerm,
        setSearchTerm,
        dateRange,
        setDateRange,
        statusFilter,
        setStatusFilter,
        clientFilter,
        handleClientFilterChange,
        deliverableFilter,
        handleDeliverableFilterChange,
        setDeliverableFilter,
        tagFilter,
        setTagFilter,
        availableTags,
        sponsoredOnly,
        setSponsoredOnly,
        uniqueClients,
        uniqueDeliverables,
        hasMore,
        totalTasks,
        currentPage,
        expandedRows,
        selectedRows,
        setSelectedRows,
        isPreviewOpen,
        setIsPreviewOpen,
        previewFile,
        setPreviewFile,
        linkDialog,
        setLinkDialog,
        linkUrl,
        setLinkUrl,
        linkPostedAt,
        setLinkPostedAt,
        submittingLink,
        loadTasks,
        handleSort,
        toggleRow,
        markAsScheduled,
        markAsPending,
        bulkMarkAsScheduled,
        toggleTrial,
        downloadFile,
        copyTitle,
        saveLink,
        deleteSocialLink,
        getFileUrl,
        updatePostingDate,
        updateTaskTags,
        sortColumn,
        sortDirection,
        displayTasks
    } = useScheduler();

    // Send back to editor state
    const [showSendBackDialog, setShowSendBackDialog] = useState(false);
    const [sendBackTask, setSendBackTask] = useState<SchedulerTask | null>(null);
    const [sendBackFeedback, setSendBackFeedback] = useState('');
    const [isSendingBack, setIsSendingBack] = useState(false);

    const handleSendBack = async () => {
        if (!sendBackTask || !sendBackFeedback.trim()) return;
        setIsSendingBack(true);
        try {
            const res = await fetch(`/api/tasks/${sendBackTask.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    status: 'REJECTED',
                    schedulerFeedback: sendBackFeedback.trim(),
                    route: 'editor',
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to send back');
            }
            toast.success('Task sent back to editor with feedback');
            setShowSendBackDialog(false);
            setSendBackFeedback('');
            setSendBackTask(null);
            loadTasks();
        } catch (err: any) {
            toast.error(err.message || 'Failed to send task back');
        } finally {
            setIsSendingBack(false);
        }
    };

    if (loading && isInitialLoad) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading tasks...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Scheduling Queue</h1>
                </div>
                <div className="flex items-center gap-2">
                    {selectedRows.size > 0 && (
                        <Button onClick={bulkMarkAsScheduled} size="sm">
                            <Check className="h-4 w-4 mr-2" />
                            Mark Selected ({selectedRows.size})
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => loadTasks()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            <FilterBar 
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                dateRange={dateRange}
                setDateRange={setDateRange}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                clientFilter={clientFilter}
                handleClientFilterChange={handleClientFilterChange}
                deliverableFilter={deliverableFilter}
                handleDeliverableFilterChange={handleDeliverableFilterChange}
                uniqueClients={uniqueClients}
                uniqueDeliverables={uniqueDeliverables}
                sponsoredOnly={sponsoredOnly}
                setSponsoredOnly={setSponsoredOnly}
                tagFilter={tagFilter}
                setTagFilter={setTagFilter}
                availableTags={availableTags}
            />

            {/* Spreadsheet Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        {/* Header */}
                        <thead className="bg-gray-50 border-b sticky top-0 z-10">
                            <tr>
                                <th className="w-10 px-3 py-3 text-left">
                                    <Checkbox
                                        checked={selectedRows.size === tasks.length && tasks.length > 0}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedRows(new Set(tasks.map(t => t.id)));
                                            } else {
                                                setSelectedRows(new Set());
                                            }
                                        }}
                                    />
                                </th>
                                <th className="w-8 px-2"></th>
                                <th
                                    className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('title')}
                                >
                                    <div className="flex items-center gap-1">
                                        Task Title
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('postingDate')}
                                >
                                    <div className="flex items-center gap-1">
                                        Posted
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </th>
                                <th className="w-10 px-2 py-3 text-center font-semibold">
                                    Details
                                </th>
                                <th className="px-3 py-3 text-center font-semibold">
                                    <div className="flex items-center justify-center gap-1">
                                        <Sparkles className="h-4 w-4 text-yellow-500" />
                                        AI Title
                                    </div>
                                </th>
                                {/* Platform columns */}
                                {Object.entries(PLATFORMS).map(([key, platform]) => (
                                    <th key={key} className="px-2 py-3 text-center font-semibold w-12">
                                        <div className="flex justify-center" title={platform.label}>
                                            <platform.icon className={`h-4 w-4 ${platform.color}`} />
                                        </div>
                                    </th>
                                ))}
                                <th
                                    className="px-3 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('status')}
                                >
                                    Status
                                </th>
                            </tr>
                        </thead>

                        {/* Body */}
                        <tbody className={`divide-y ${loading && !isInitialLoad ? 'opacity-50 pointer-events-none' : ''}`}>
                            {tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={14} className="px-6 py-12 text-center text-muted-foreground">
                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mb-4 text-primary" />
                                                <p>Finding tasks...</p>
                                            </div>
                                        ) : (
                                            <>
                                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                                                <p className="font-medium">No tasks found</p>
                                                <p className="text-sm mt-1">Adjust your filters or wait for new tasks</p>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                displayTasks.map((task) => (
                                    <TaskRow 
                                        key={task.id}
                                        task={task}
                                        isExpanded={expandedRows.has(task.id)}
                                        onToggle={() => toggleRow(task.id)}
                                        isSelected={selectedRows.has(task.id)}
                                        onSelect={(checked) => {
                                            const newSet = new Set(selectedRows);
                                            if (checked) newSet.add(task.id);
                                            else newSet.delete(task.id);
                                            setSelectedRows(newSet);
                                        }}
                                        onMarkScheduled={() => markAsScheduled(task.id)}
                                        onMarkPending={() => markAsPending(task.id)}
                                        onTagsChange={(tags) => updateTaskTags(task.id, tags)}
                                        onSendBack={() => {
                                            setSendBackTask(task);
                                            setSendBackFeedback('');
                                            setTimeout(() => setShowSendBackDialog(true), 50);
                                        }}
                                        onAddLink={(platform) => setLinkDialog({ open: true, taskId: task.id, platform, mode: 'add' })}
                                        onEditLink={(platform, url, postedAt) => {
                                            setLinkUrl(url);
                                            if (postedAt) {
                                                const dt = new Date(postedAt);
                                                const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                                setLinkPostedAt(local);
                                            }
                                            setLinkDialog({ open: true, taskId: task.id, platform, mode: 'edit', existingUrl: url, existingPostedAt: postedAt });
                                        }}
                                        onDeleteLink={(platform, url) => deleteSocialLink(task.id, platform)}
                                        onPreviewFile={(file) => {
                                            setPreviewFile({ ...file, url: getFileUrl(file) });
                                            setIsPreviewOpen(true);
                                        }}
                                        onDownloadFile={downloadFile}
                                        onCopyTitle={copyTitle}
                                        onToggleTrial={(isTrial) => toggleTrial(task.id, isTrial)}
                                        onUpdatePostingDate={(date) => updatePostingDate(task.id, date)}
                                        getFileUrl={getFileUrl}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Load More Controls */}
                <div className="mt-6 flex flex-col items-center gap-4 border-t pt-6 px-2">
                    <div className="text-sm text-muted-foreground">
                        Showing <span className="font-medium text-foreground">{tasks.length}</span> of <span className="font-medium text-foreground">{totalTasks}</span> tasks
                    </div>
                    
                    {hasMore && (
                        <Button
                            variant="outline"
                            onClick={() => loadTasks(currentPage + 1, true)}
                            disabled={loading}
                            className="bg-white hover:bg-indigo-50 border-indigo-100 text-indigo-600 font-medium px-8 h-10 shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                "Load More History"
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Modals & Dialogs */}
            <LinkDialog 
                open={linkDialog?.open || false}
                onOpenChange={(open) => {
                    if (!open) {
                        setLinkDialog(null);
                        setLinkUrl('');
                        setLinkPostedAt('');
                    }
                }}
                linkDialog={linkDialog}
                linkUrl={linkUrl}
                setLinkUrl={setLinkUrl}
                linkPostedAt={linkPostedAt}
                setLinkPostedAt={setLinkPostedAt}
                submittingLink={submittingLink}
                onSave={saveLink}
            />

            {previewFile && (
                <FilePreviewModal
                    open={isPreviewOpen}
                    onOpenChange={(open) => {
                        setIsPreviewOpen(open);
                        if (!open) setPreviewFile(null);
                    }}
                    file={previewFile}
                />
            )}

            {/* Send Back to Editor Dialog */}
            <Dialog open={showSendBackDialog} onOpenChange={setShowSendBackDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Send Back to Editor
                        </DialogTitle>
                        <DialogDescription>
                            {sendBackTask && (
                                <span className="block text-xs text-zinc-500 mt-1 truncate">
                                    Task: {sendBackTask.title}
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                            The editor will be notified and the task will be returned to their queue for revision.
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sendback-feedback">
                                Feedback / Reason <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                id="sendback-feedback"
                                placeholder="Describe what needs to be fixed or changed before this can be scheduled…"
                                className="min-h-[120px] resize-none"
                                value={sendBackFeedback}
                                onChange={(e) => setSendBackFeedback(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                {sendBackFeedback.length}/500 characters
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowSendBackDialog(false);
                                setSendBackFeedback('');
                                setSendBackTask(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            disabled={!sendBackFeedback.trim() || isSendingBack}
                            onClick={handleSendBack}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isSendingBack ? 'Sending…' : 'Send Back to Editor'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}