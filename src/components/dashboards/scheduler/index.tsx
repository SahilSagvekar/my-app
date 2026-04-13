"use client";

import React from 'react';
import { 
    RefreshCw, 
    Check, 
    ArrowUpDown, 
    FileText, 
    Sparkles, 
    Loader2 
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
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
        setDeliverableFilter,
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
        sortColumn,
        sortDirection,
        displayTasks
    } = useScheduler();

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
                setDeliverableFilter={setDeliverableFilter}
                uniqueClients={uniqueClients}
                uniqueDeliverables={uniqueDeliverables}
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
                                    onClick={() => handleSort('client')}
                                >
                                    <div className="flex items-center gap-1">
                                        Client
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-left font-semibold">
                                    Editor
                                </th>
                                <th className="px-3 py-3 text-center font-semibold">
                                    Trial
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('dueDate')}
                                >
                                    <div className="flex items-center gap-1">
                                        Due
                                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                </th>
                                <th className="px-3 py-3 text-center font-semibold">
                                    <div className="flex items-center justify-center gap-1">
                                        <FileText className="h-4 w-4" />
                                        Files
                                    </div>
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
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    file={previewFile}
                />
            )}
        </div>
    );
}
