'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateJobDialogProps {
    onJobCreated?: () => void;
    trigger?: React.ReactNode;
}

export function CreateJobDialog({ onJobCreated, trigger }: CreateJobDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetch('/api/clients')
                .then(res => res.json())
                .then(data => setClients(data.clients || []))
                .catch(err => console.error('Failed to fetch clients:', err));
        }
    }, [open]);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const data = {
            title: formData.get('title'),
            description: formData.get('description'),
            location: formData.get('location'),
            startDate: formData.get('startDate'),
            endDate: formData.get('endDate'),
            equipment: formData.get('equipment'),
            clientId: formData.get('clientId') || null,
            budget: formData.get('budget') ? parseFloat(formData.get('budget') as string) : null,
        };

        try {
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create job');
            }

            toast.success('Job posted successfully! Notification sent to videographers.');
            setOpen(false);
            if (onJobCreated) onJobCreated();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Post a Job
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Post a New Job</DialogTitle>
                    <DialogDescription>
                        Fill in the details for the videography shoot. This will notify all available videographers.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2 sm:col-span-1">
                            <Label htmlFor="title">Job Title</Label>
                            <Input id="title" name="title" placeholder="e.g. Real Estate Shoot" required />
                        </div>
                        <div className="space-y-2 col-span-2 sm:col-span-1">
                            <Label htmlFor="clientId">Linked Client (Optional)</Label>
                            <select
                                id="clientId"
                                name="clientId"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">Select a Client</option>
                                {clients.map(client => (
                                    <option key={client.id} value={client.id}>
                                        {client.companyName || client.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description & Requirements</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Detail the shoot requirements and expectations..."
                            required
                            className="min-h-[80px]"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="equipment">Equipment Required</Label>
                        <Input id="equipment" name="equipment" placeholder="e.g. Sony A7IV, Gimbal, Drone, Lapel Mics" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input id="startDate" name="startDate" type="date" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate">End Date (Optional)</Label>
                            <Input id="endDate" name="endDate" type="date" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input id="location" name="location" placeholder="City, State" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="budget">Budget ($)</Label>
                            <Input id="budget" name="budget" type="number" placeholder="Enter amount" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Post Job
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
