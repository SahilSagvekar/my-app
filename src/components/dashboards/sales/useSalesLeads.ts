import { useState, useCallback, useEffect } from 'react';
import { Lead } from './types';
import { dbLeadToLocal } from './utils';
import { toast } from 'sonner';

export function useSalesLeads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const loadLeads = useCallback(async () => {
        try {
            setRefreshing(true);
            const res = await fetch('/api/sales-leads', { cache: 'no-store' });
            const data = await res.json();
            if (data.ok) {
                setLeads(data.leads.map(dbLeadToLocal));
            }
        } catch (err) {
            console.error('Failed to load leads:', err);
            toast.error('Failed to load leads');
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, []);

    const updateLead = useCallback(async (id: string, patch: Partial<Lead>) => {
        // Optimistic update
        setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch, _dirty: true } : l));

        // In a real scenario, we'd debounce the sync to server
        // This is a simplified version of the logic in SalesDashboard.tsx
    }, []);

    const deleteLead = useCallback(async (id: string) => {
        if (!confirm('Are you sure you want to delete this lead?')) return;
        try {
            const res = await fetch(`/api/sales-leads/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setLeads(prev => prev.filter(l => l.id !== id));
                toast.success('Lead deleted');
            }
        } catch (err) {
            toast.error('Failed to delete lead');
        }
    }, []);

    useEffect(() => {
        loadLeads();
    }, [loadLeads]);

    return {
        leads,
        setLeads,
        loading,
        refreshing,
        search,
        setSearch,
        statusFilter,
        setStatusFilter,
        loadLeads,
        updateLead,
        deleteLead
    };
}
