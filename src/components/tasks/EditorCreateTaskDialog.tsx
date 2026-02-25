'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

interface PermittedClient {
    id: string;
    name: string;
}

interface OneOffDeliverable {
    id: string;
    type: string;
    quantity?: number;
    description?: string;
}

interface EditorCreateTaskDialogProps {
    /** Clients for which this editor is allowed to create tasks.
     *  If empty the button won't render.                               */
    permittedClients: PermittedClient[];
    /** Called after a task is created so the parent can refresh.       */
    onTaskCreated?: (task: any) => void;
}

/**
 * Simplified one-off task creation dialog for editors.
 *
 * Differences from the admin version:
 * - Client dropdown is restricted to `permittedClients`
 * - Only one-off deliverables are shown (no monthly deliverables)
 * - Assigned-to is always the calling editor (server sets it from JWT)
 * - No QC / scheduler / videographer assignment (admin will handle that)
 */
export function EditorCreateTaskDialog({
    permittedClients,
    onTaskCreated,
}: EditorCreateTaskDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const [clientId, setClientId] = useState('');
    const [deliverableId, setDeliverableId] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');

    const [deliverables, setDeliverables] = useState<OneOffDeliverable[]>([]);
    const [deliverablesLoading, setDeliverablesLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Reset form when dialog closes
    useEffect(() => {
        if (!open) {
            setClientId('');
            setDeliverableId('');
            setDescription('');
            setDueDate('');
            setDeliverables([]);
            setErrors({});
        }
    }, [open]);

    // Load one-off deliverables for the selected client
    useEffect(() => {
        if (!clientId) {
            setDeliverables([]);
            setDeliverableId('');
            return;
        }

        async function fetchDeliverables() {
            setDeliverablesLoading(true);
            setDeliverableId('');
            try {
                const res = await fetch(`/api/clients/${clientId}/one-off-deliverables`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                setDeliverables(
                    Array.isArray(data.oneOffDeliverables) ? data.oneOffDeliverables :
                        Array.isArray(data.deliverables) ? data.deliverables : []
                );
            } catch {
                setDeliverables([]);
            } finally {
                setDeliverablesLoading(false);
            }
        }
        fetchDeliverables();
    }, [clientId]);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!clientId) e.clientId = 'Please select a client';
        if (!deliverableId) e.deliverableId = 'Please select a deliverable';
        if (!dueDate) e.dueDate = 'Due date is required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const payload = new FormData();
            payload.append('clientId', clientId);
            payload.append('oneOffDeliverableId', deliverableId);
            payload.append('description', description);
            payload.append('dueDate', dueDate);
            // Signal that this is an editor self-created task
            payload.append('createdByEditor', 'true');

            const res = await fetch('/api/tasks', {
                method: 'POST',
                credentials: 'include',
                body: payload,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to create task');

            toast.success('Task created successfully!');
            onTaskCreated?.(data);
            setOpen(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to create task');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    className="gap-1.5 bg-primary hover:bg-primary/90 shadow-sm"
                    id="editor-create-task-btn"
                >
                    <Plus className="h-4 w-4" />
                    Create Task
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[540px] bg-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Create One-Off Task
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-200">
                            One-Off
                        </Badge>
                    </DialogTitle>
                    <DialogDescription>
                        Create a new one-off task for a client. The task will be assigned to you and visible to admins.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 pt-2">

                    {/* Client */}
                    <div className="space-y-1.5">
                        <Label htmlFor="editor-task-client">Client</Label>
                        <Select value={clientId} onValueChange={setClientId}>
                            <SelectTrigger
                                id="editor-task-client"
                                className={errors.clientId ? 'border-destructive' : ''}
                            >
                                <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                            <SelectContent>
                                {permittedClients.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.clientId && (
                            <p className="text-xs text-destructive">{errors.clientId}</p>
                        )}
                    </div>

                    {/* One-off Deliverable */}
                    <div className="space-y-1.5">
                        <Label htmlFor="editor-task-deliverable">Deliverable / Project</Label>
                        <Select
                            value={deliverableId}
                            onValueChange={setDeliverableId}
                            disabled={!clientId || deliverablesLoading}
                        >
                            <SelectTrigger
                                id="editor-task-deliverable"
                                className={errors.deliverableId ? 'border-destructive' : ''}
                            >
                                {deliverablesLoading ? (
                                    <span className="flex items-center gap-2 text-muted-foreground text-sm">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Loading...
                                    </span>
                                ) : (
                                    <SelectValue
                                        placeholder={
                                            !clientId
                                                ? 'Select a client first'
                                                : deliverables.length === 0
                                                    ? 'No one-off deliverables found'
                                                    : 'Select a deliverable'
                                        }
                                    />
                                )}
                            </SelectTrigger>
                            <SelectContent>
                                {deliverables.length > 0 ? (
                                    deliverables.map(d => (
                                        <SelectItem key={d.id} value={d.id}>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] h-4 px-1 bg-yellow-50 text-yellow-700 border-yellow-200 shrink-0"
                                                >
                                                    One-Off
                                                </Badge>
                                                <span>{d.type}</span>
                                                {d.quantity && (
                                                    <span className="text-muted-foreground text-xs">
                                                        × {d.quantity}
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="__none__" disabled>
                                        {clientId
                                            ? 'No one-off deliverables for this client'
                                            : 'Select a client first'}
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {errors.deliverableId && (
                            <p className="text-xs text-destructive">{errors.deliverableId}</p>
                        )}
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1.5">
                        <Label htmlFor="editor-task-due">Due Date</Label>
                        <Input
                            id="editor-task-due"
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className={errors.dueDate ? 'border-destructive' : ''}
                        />
                        {errors.dueDate && (
                            <p className="text-xs text-destructive">{errors.dueDate}</p>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                        <Label htmlFor="editor-task-notes">
                            Notes{' '}
                            <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            id="editor-task-notes"
                            placeholder="Add any notes or context for this task..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Task'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
