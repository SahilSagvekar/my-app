'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface TextPostReviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskId: string;
    taskTitle: string;
    textContent: string;
    onApprove: () => void | Promise<void>;
    onRequestRevisions: (feedbackItems: { feedback: string }[]) => void | Promise<void>;
}

export function TextPostReviewModal({
    open,
    onOpenChange,
    taskId,
    taskTitle,
    textContent,
    onApprove,
    onRequestRevisions,
}: TextPostReviewModalProps) {
    const [revisionNote, setRevisionNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) setRevisionNote('');
    }, [open]);

    const handleApproveClick = async () => {
        setSubmitting(true);
        try {
            await onApprove();
            onOpenChange(false);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRequestRevisionsClick = async () => {
        if (!revisionNote.trim()) {
            toast.error('Add a note describing what needs to change');
            return;
        }
        setSubmitting(true);
        try {
            await onRequestRevisions([{ feedback: revisionNote.trim() }]);
            onOpenChange(false);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-500" />
                    Text Post — <span className="font-normal text-muted-foreground">{taskTitle}</span>
                </DialogTitle>
                <DialogDescription className="sr-only">Review the text post copy</DialogDescription>

                <Card>
                    <CardContent className="p-4">
                        <p className="whitespace-pre-wrap text-sm text-gray-800">
                            {textContent || '(No text submitted yet)'}
                        </p>
                    </CardContent>
                </Card>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                        Revision note (required to request changes)
                    </label>
                    <Textarea
                        value={revisionNote}
                        onChange={(e) => setRevisionNote(e.target.value)}
                        placeholder="What needs to change?"
                        rows={3}
                        className="text-sm"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        variant="outline"
                        disabled={submitting}
                        onClick={handleRequestRevisionsClick}
                    >
                        Request Revisions
                    </Button>
                    <Button disabled={submitting} onClick={handleApproveClick}>
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Approve
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
