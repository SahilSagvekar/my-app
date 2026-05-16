'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, UserCheck, ArrowRight, Building2, Mail, Phone, AlertTriangle } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  value?: number | null;
  convertedToClientId?: string | null;
}

interface ConvertLeadDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted?: (clientId: string) => void;
}

export function ConvertLeadDialog({ lead, open, onOpenChange, onConverted }: ConvertLeadDialogProps) {
  const [form, setForm] = useState({ name: '', email: '', companyName: '', phone: '' });
  const [converting, setConverting] = useState(false);

  // Prefill from lead when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o && lead) {
      setForm({
        name: lead.name || '',
        email: lead.email || '',
        companyName: lead.company || lead.name || '',
        phone: lead.phone || '',
      });
    }
    onOpenChange(o);
  };

  const handleConvert = async () => {
    if (!lead) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setConverting(true);
    try {
      const res = await fetch(`/api/sales-leads/${lead.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          companyName: form.companyName.trim() || form.name.trim(),
          phone: form.phone.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Conversion failed');
        return;
      }

      toast.success(`🎉 ${form.companyName || form.name} converted to client!`, {
        description: 'Slack channel created & welcome email sent.',
        duration: 5000,
      });

      onOpenChange(false);
      onConverted?.(data.clientId);
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setConverting(false);
    }
  };

  if (!lead) return null;

  const alreadyConverted = !!lead.convertedToClientId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-600" />
            Convert Lead to Client
          </DialogTitle>
          <DialogDescription>
            This will create a full client account, R2 folders, Slack channel, and send a welcome email.
          </DialogDescription>
        </DialogHeader>

        {alreadyConverted ? (
          <div className="py-4 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-medium text-gray-800">Already converted</p>
            <p className="text-sm text-muted-foreground">
              This lead has already been converted to a client.
            </p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : (
          <>
            {/* Lead summary */}
            <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-3 border">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{lead.name}</p>
                <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs shrink-0">Client</Badge>
            </div>

            {/* Editable fields */}
            <div className="space-y-3 py-1">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Contact Name <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="client@company.com"
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Company Name
                </Label>
                <Input
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="Company / brand name"
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Used for R2 folder name and Slack channel</p>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 ..."
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>Deliverables and billing can be configured in Client Management after conversion. The lead status will be set to <strong>Won</strong>.</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={converting}>
                Cancel
              </Button>
              <Button
                onClick={handleConvert}
                disabled={converting || !form.name.trim() || !form.email.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {converting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Converting...</>
                ) : (
                  <><UserCheck className="h-4 w-4 mr-2" />Convert to Client</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}