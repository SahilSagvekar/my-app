'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Camera,
    Loader2,
    User,
    Calendar,
    Search,
    UserPlus,
    Briefcase,
    CheckCircle2,
    MapPin,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { JobManagementSection } from '../jobs/JobManagementSection';

// ─────────────────────────────────────────
// Direct Assignment Section
// ─────────────────────────────────────────

function DirectAssignmentSection() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [videographers, setVideographers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
    const [selectedVideographer, setSelectedVideographer] = useState<Record<string, string>>({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Fetch tasks that could use a videographer + all employees (filter to videographers)
            const [tasksRes, usersRes] = await Promise.all([
                fetch('/api/tasks'),
                fetch('/api/employee/list?status=ACTIVE')
            ]);

            if (tasksRes.ok) {
                const data = await tasksRes.json();
                const taskList = Array.isArray(data) ? data : (data.tasks || []);
                setTasks(taskList);
            }

            if (usersRes.ok) {
                const data = await usersRes.json();
                const allEmployees = Array.isArray(data) ? data : (data.employees || data || []);
                // Filter to only videographer role
                const videographerUsers = allEmployees.filter(
                    (u: any) => u.role?.toLowerCase() === 'videographer'
                );
                setVideographers(videographerUsers);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (taskId: string) => {
        const videographerId = selectedVideographer[taskId];
        if (!videographerId) {
            toast.error('Please select a videographer first');
            return;
        }

        setAssigningTaskId(taskId);
        try {
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videographer: parseInt(videographerId),
                    status: 'VIDEOGRAPHER_ASSIGNED'
                })
            });

            if (res.ok) {
                toast.success('Videographer assigned successfully');
                loadData();
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || 'Failed to assign videographer');
            }
        } catch (error) {
            toast.error('Failed to assign videographer');
        } finally {
            setAssigningTaskId(null);
        }
    };

    // Tasks that need a videographer (no videographer assigned yet, or shoot tasks)
    const unassignedTasks = tasks.filter(t => {
        // If it has a shootDetail or the client requiresVideographer, show it
        const hasShoot = !!t.shootDetail;
        const noVideographer = !t.videographer;
        const matchesSearch = !search || (t.title || '').toLowerCase().includes(search.toLowerCase());
        return (hasShoot || t.taskType === 'shoot') && noVideographer && matchesSearch;
    });

    const assignedTasks = tasks.filter(t => {
        const hasVideographer = !!t.videographer;
        const matchesSearch = !search || (t.title || '').toLowerCase().includes(search.toLowerCase());
        return hasVideographer && matchesSearch;
    });

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search tasks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Unassigned Tasks */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-orange-500" />
                                Tasks Needing Videographer
                            </CardTitle>
                            <CardDescription>Assign a videographer directly to these tasks</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-sm">
                            {unassignedTasks.length} task{unassignedTasks.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {unassignedTasks.length === 0 ? (
                        <div className="text-center py-10 bg-muted/30 rounded-lg border-2 border-dashed">
                            <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                            <p className="text-muted-foreground text-sm">No tasks need a videographer right now</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {unassignedTasks.map((task) => (
                                <div key={task.id} className="border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-sm">{task.title || 'Untitled Task'}</h4>
                                                <Badge className="bg-orange-100 text-orange-800 text-[10px]">
                                                    {task.status?.replace(/_/g, ' ') || 'PENDING'}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {task.client?.companyName || task.client?.name || 'No Client'}
                                                </div>
                                                {task.dueDate && (
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(task.dueDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {task.shootDetail?.location && (
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {task.shootDetail.location}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Select
                                                value={selectedVideographer[task.id] || ''}
                                                onValueChange={(val) => setSelectedVideographer(prev => ({ ...prev, [task.id]: val }))}
                                            >
                                                <SelectTrigger className="w-48 h-9 text-xs">
                                                    <SelectValue placeholder="Select videographer" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {videographers.map((v) => (
                                                        <SelectItem key={v.id} value={v.id.toString()}>
                                                            {v.name || v.email}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                size="sm"
                                                className="h-9"
                                                disabled={!selectedVideographer[task.id] || assigningTaskId === task.id}
                                                onClick={() => handleAssign(task.id)}
                                            >
                                                {assigningTaskId === task.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <UserPlus className="h-4 w-4 mr-1" />
                                                        Assign
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Already Assigned */}
            {assignedTasks.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    Assigned Tasks
                                </CardTitle>
                                <CardDescription>Tasks that already have a videographer assigned</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-sm bg-green-50 text-green-700 border-green-200">
                                {assignedTasks.length} assigned
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {assignedTasks.map((task) => (
                                <div key={task.id} className="border rounded-lg p-3 flex items-center justify-between gap-4 bg-green-50/30">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-sm truncate">{task.title || 'Untitled'}</h4>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            <span>{task.client?.companyName || task.client?.name || 'No Client'}</span>
                                            <Badge className="bg-green-100 text-green-800 text-[10px]">
                                                {task.status?.replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                        <User className="h-3 w-3" />
                                        Videographer #{task.videographer}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ─────────────────────────────────────────
// Main Videographer Management Tab
// ─────────────────────────────────────────

export function VideographerManagementTab() {
    return (
        <Tabs defaultValue="jobs" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="jobs" className="gap-2">
                    <Briefcase className="h-4 w-4" />
                    Job Board & Bids
                </TabsTrigger>
                <TabsTrigger value="assign" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Direct Assignment
                </TabsTrigger>
            </TabsList>

            <TabsContent value="jobs">
                <JobManagementSection />
            </TabsContent>

            <TabsContent value="assign">
                <DirectAssignmentSection />
            </TabsContent>
        </Tabs>
    );
}
