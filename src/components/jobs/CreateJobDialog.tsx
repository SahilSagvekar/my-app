'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, Camera, Link, Settings, XCircle, MapPin, DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface CreateJobDialogProps {
    onJobCreated?: () => void;
    trigger?: React.ReactNode;
}

export function CreateJobDialog({ onJobCreated, trigger }: CreateJobDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        quality: '',
        frameRate: '',
    });

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

        const form = new FormData(e.currentTarget);
        const data = {
            title: form.get('title'),
            description: form.get('description'),
            location: form.get('location'),
            startDate: form.get('startDate'),
            endDate: form.get('endDate'),
            equipment: form.get('equipment'),
            camera: form.get('camera'),
            quality: formData.quality,
            frameRate: formData.frameRate,
            lighting: form.get('lighting'),
            exclusions: form.get('exclusions'),
            referenceLinks: form.get('referenceLinks') ? (form.get('referenceLinks') as string).split(',').map(l => l.trim()) : [],
            clientId: form.get('clientId') || null,
            budget: form.get('budget') ? parseFloat(form.get('budget') as string) : null,
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
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 border-none rounded-2xl shadow-2xl">
                <div className="bg-primary p-6 text-primary-foreground rounded-t-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Post a New Job Opportunity</DialogTitle>
                        <DialogDescription className="text-primary-foreground/80 font-medium">
                            Fill in the details for the videography shoot. This will notify all available videographers.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <form onSubmit={onSubmit} className="space-y-6 p-8">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 col-span-2 sm:col-span-1">
                            <Label htmlFor="title" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Job Title</Label>
                            <Input id="title" name="title" placeholder="e.g. Real Estate Shoot" required className="rounded-xl border-gray-200" />
                        </div>
                        <div className="space-y-2 col-span-2 sm:col-span-1">
                            <Label htmlFor="clientId" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Linked Client (Optional)</Label>
                            <select
                                id="clientId"
                                name="clientId"
                                className="flex h-10 w-full rounded-xl border border-gray-200 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
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
                        <Label htmlFor="description" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Description & Requirements</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Detail the shoot requirements and expectations..."
                            required
                            className="min-h-[100px] rounded-xl border-gray-200"
                        />
                    </div>

                    {/* Technical Specs Briefing */}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2 uppercase text-xs tracking-widest">
                            <Settings className="h-4 w-4 text-primary" /> Technical Specifications Brief
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="camera" className="text-xs font-bold text-slate-600">Camera Model Preference</Label>
                                <div className="relative">
                                    <Camera className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input id="camera" name="camera" placeholder="e.g. Sony A7SIII, FX3" className="pl-10 rounded-xl border-slate-200" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="equipment" className="text-xs font-bold text-slate-600">Other Equipment Required</Label>
                                <Input id="equipment" name="equipment" placeholder="e.g. Gimbal, Drone, Lapel Mics" className="rounded-xl border-slate-200" />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-600">Video Quality</Label>
                                <Select value={formData.quality} onValueChange={(v) => setFormData(p => ({ ...p, quality: v }))}>
                                    <SelectTrigger className="rounded-xl border-slate-200">
                                        <SelectValue placeholder="Select Quality" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="4K">4K</SelectItem>
                                        <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                                        <SelectItem value="8K">8K</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-slate-600">Target Frame Rate</Label>
                                <Select value={formData.frameRate} onValueChange={(v) => setFormData(p => ({ ...p, frameRate: v }))}>
                                    <SelectTrigger className="rounded-xl border-slate-200">
                                        <SelectValue placeholder="Select Frame Rate" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="24fps">24 fps (Cinematic)</SelectItem>
                                        <SelectItem value="30fps">30 fps (Standard)</SelectItem>
                                        <SelectItem value="60fps">60 fps (Slow Motion)</SelectItem>
                                        <SelectItem value="120fps">120 fps (Super Slow Mo)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lighting" className="text-xs font-bold text-slate-600">Lighting Setup</Label>
                                <Input id="lighting" name="lighting" placeholder="e.g. Natural Light, 3-point LED" className="rounded-xl border-slate-200" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="referenceLinks" className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                    <Link className="h-3 w-3" /> Reference Links
                                </Label>
                                <Input id="referenceLinks" name="referenceLinks" placeholder="Comma separated URLs..." className="rounded-xl border-slate-200" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="exclusions" className="text-xs font-bold text-red-600 flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Exclusions (What NOT to shoot)
                            </Label>
                            <Textarea
                                id="exclusions"
                                name="exclusions"
                                placeholder="Mention anything the videographer should avoid capturing..."
                                className="rounded-xl border-red-100 bg-red-50/20 focus:bg-white transition-colors"
                            />
                        </div>
                    </div>

                    {/* Logistics */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="startDate" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                            <Input id="startDate" name="startDate" type="date" required className="rounded-xl border-gray-200" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="endDate" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">End Date (Optional)</Label>
                            <Input id="endDate" name="endDate" type="date" className="rounded-xl border-gray-200" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="location" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Location</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input id="location" name="location" placeholder="City, State" required className="pl-10 rounded-xl border-gray-200" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="budget" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Budget ($)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input id="budget" name="budget" type="number" placeholder="Enter amount" className="pl-10 rounded-xl border-gray-200" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl px-6">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="rounded-xl px-8 font-bold shadow-lg shadow-primary/20">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Post Job Opportunity
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
