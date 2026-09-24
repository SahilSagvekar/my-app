'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PageHeader } from '../ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  User,
  Settings,
  CheckSquare,
  Image as ImageIcon,
  Send,
  Calendar,
  Ellipsis,
  Loader2,
  TriangleAlert,
} from 'lucide-react';

interface Profile {
  id: string;
  fullLegalName: string | null;
  phone: string | null;
  email: string | null;
  mailingAddress: string | null;
  payoutMethod: string | null;
  payoutAccount: string | null;
  standardRate: string | null;
  verificationStatus: string;
  pendingPayoutMethod: string | null;
  pendingPayoutAccount: string | null;
}

interface DocRow {
  id: string;
  formType: string;
  taxYear: number;
  status: 'on-file' | 'missing' | 'expired' | 'submitted';
  fileName: string | null;
  updatedAt: string;
}

interface LeaveRow {
  id: number;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

const FORM_LABELS: Record<string, { name: string; description: string }> = {
  W9: { name: 'Form W-9', description: 'Tax identification for 1099 reporting.' },
  DIRECT_DEPOSIT: { name: 'Direct deposit authorization', description: 'Confirms where E8 sends your pay.' },
  PHOTO_ID: { name: 'Photo ID', description: 'A government-issued photo ID on file.' },
  TALENT_RELEASE: { name: 'Talent release and agreement', description: 'Grants E8 rights to use footage you appear in.' },
};

const STATUS_META: Record<string, { label: string; action: string; primary: boolean }> = {
  'on-file': { label: 'On file', action: 'View', primary: false },
  missing: { label: 'Action needed', action: 'Upload', primary: true },
  expired: { label: 'Expired', action: 'Re-upload', primary: true },
  submitted: { label: 'Under review', action: 'Replace', primary: false },
};

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function HostEmploymentInfo() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contractor, setContractor] = useState<{ employeeStatus?: string } | null>(null);
  const [forms, setForms] = useState<DocRow[]>([]);
  const [form1099s, setForm1099s] = useState<DocRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [stats, setStats] = useState<{ shootsWorked: number; paidThisYear: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [uploadFormType, setUploadFormType] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [profileRes, docsRes, leavesRes, paymentsRes] = await Promise.all([
        fetch('/api/host/payout-profile', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/host/documents', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/leave', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/host/payments', { credentials: 'include' }).then((r) => r.json()),
      ]);
      if (profileRes.ok) {
        setProfile(profileRes.profile);
        setContractor(profileRes.contractor);
        setEditForm(profileRes.profile);
      }
      if (docsRes.ok) {
        setForms(docsRes.forms || []);
        setForm1099s(docsRes.form1099s || []);
      }
      if (leavesRes.ok) setLeaves(leavesRes.leaves || []);
      if (paymentsRes.ok) setStats(paymentsRes.stats);
    } catch (err) {
      console.error('Failed to load employment info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleFieldChange = (field: keyof Profile, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/host/payout-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullLegalName: editForm.fullLegalName,
          phone: editForm.phone,
          email: editForm.email,
          mailingAddress: editForm.mailingAddress,
          payoutMethod: editForm.payoutMethod,
          payoutAccount: editForm.payoutAccount,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setProfile(json.profile);
        setSaved(true);
      }
    } catch (err) {
      console.error('Failed to save payout profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFormType || !pickedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('formType', uploadFormType);
      fd.append('file', pickedFile);
      const res = await fetch('/api/host/documents', { method: 'POST', credentials: 'include', body: fd });
      const json = await res.json();
      if (json.ok) {
        setForms((prev) => prev.map((f) => (f.formType === uploadFormType ? json.document : f)));
        setUploadFormType(null);
        setPickedFile(null);
      }
    } catch (err) {
      console.error('Failed to upload document:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleRequestLeave = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) return;
    setSubmittingLeave(true);
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveForm),
      });
      const json = await res.json();
      if (json.ok) {
        setLeaves((prev) => [json.leave, ...prev]);
        setLeaveOpen(false);
        setLeaveForm({ startDate: '', endDate: '', reason: '' });
      }
    } catch (err) {
      console.error('Failed to submit time-off request:', err);
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleCancelLeave = async (id: number) => {
    try {
      const res = await fetch(`/api/leave/${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (json.ok) setLeaves((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.error('Failed to cancel time-off request:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading employment information...</p>
      </div>
    );
  }

  const formsComplete = forms.filter((f) => f.status === 'on-file').length;
  const formsTotal = forms.length || 4;
  const pendingReview = profile?.verificationStatus === 'pending_review';

  return (
    <div className="space-y-6">
      <PageHeader title="Employment Information" description="View your employment details, tax forms and leave requests" />

      {/* Contractor Profile */}
      <SectionCard icon={<User className="h-4 w-4 opacity-75" />} title="Contractor Profile">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gray-900 text-white flex items-center justify-center text-lg font-bold shrink-0">
            {(user?.name || 'H').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-base">{user?.name || 'Host'}</p>
            <p className="text-sm text-muted-foreground">Host</p>
          </div>
        </div>
        <FieldGrid
          fields={[
            { label: 'Email', value: profile?.email || user?.email || '—' },
            { label: 'Phone', value: profile?.phone || '—' },
            { label: 'Status', value: contractor?.employeeStatus || 'Active' },
            { label: 'Mailing address', value: profile?.mailingAddress || '—' },
          ]}
        />
      </SectionCard>

      {/* Engagement Details */}
      <SectionCard icon={<Settings className="h-4 w-4 opacity-75" />} title="Engagement Details">
        <FieldGrid
          fields={[
            { label: 'Classification', value: 'Independent contractor (1099)' },
            { label: 'Standard rate', value: profile?.standardRate ? `$${Number(profile.standardRate).toFixed(0)}/shoot` : 'Set per booking' },
            { label: 'Shoots this year', value: String(stats?.shootsWorked ?? 0) },
            { label: 'Paid this year', value: `$${(stats?.paidThisYear ?? 0).toFixed(2)}` },
          ]}
        />
      </SectionCard>

      {/* Tax Forms & Paperwork */}
      <SectionCard icon={<CheckSquare className="h-4 w-4 opacity-75" />} title="Tax Forms & Paperwork">
        <div className="border rounded-lg p-3 flex items-center gap-3 mb-3">
          {formsComplete === formsTotal ? (
            <CheckSquare className="h-4 w-4 shrink-0" />
          ) : (
            <TriangleAlert className="h-4 w-4 shrink-0" />
          )}
          <p className="text-sm flex-1">
            {formsComplete === formsTotal
              ? 'All your paperwork is on file.'
              : 'A few forms still need your attention before your next payout.'}
          </p>
          <span className="text-xs font-semibold text-muted-foreground shrink-0">{formsComplete} of {formsTotal} complete</span>
        </div>
        <div className="space-y-2">
          {forms.map((f) => {
            const meta = STATUS_META[f.status] || STATUS_META.missing;
            const labels = FORM_LABELS[f.formType] || { name: f.formType, description: '' };
            return (
              <div key={f.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{labels.name}</span>
                    <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {labels.description} · Updated {fmtDate(f.updatedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={meta.primary ? 'default' : 'outline'}
                  onClick={() => setUploadFormType(f.formType)}
                  className="shrink-0"
                >
                  {meta.action}
                </Button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* My Documents (1099s) */}
      <SectionCard icon={<ImageIcon className="h-4 w-4 opacity-75" />} title="My Documents">
        {form1099s.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your year-end 1099s will appear here once issued.
          </p>
        ) : (
          <div className="space-y-2">
            {form1099s.map((doc) => (
              <div key={doc.id} className="border rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium">1099-NEC — {doc.taxYear}</span>
                {doc.fileS3Key ? (
                  <Badge variant="outline" className="text-[10px]">Downloadable</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Not available yet</span>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Payout Method */}
      <SectionCard icon={<Send className="h-4 w-4 opacity-75" />} title="Payout Method">
        {pendingReview && (
          <div className="border rounded-lg p-3 mb-4 flex items-center gap-2 text-sm">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            A payout method change is pending E8's review — your current method stays active until it's approved.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledInput label="Full legal name" value={editForm.fullLegalName || ''} onChange={(v) => handleFieldChange('fullLegalName', v)} />
          <LabeledInput label="Phone" value={editForm.phone || ''} onChange={(v) => handleFieldChange('phone', v)} />
          <LabeledInput label="Email" value={editForm.email || ''} onChange={(v) => handleFieldChange('email', v)} />
          <LabeledInput label="Mailing address" value={editForm.mailingAddress || ''} onChange={(v) => handleFieldChange('mailingAddress', v)} />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Payout method</p>
            <Select value={editForm.payoutMethod || undefined} onValueChange={(v) => handleFieldChange('payoutMethod', v)}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ZELLE">Zelle</SelectItem>
                <SelectItem value="ACH">ACH direct deposit</SelectItem>
                <SelectItem value="CHECK">Check</SelectItem>
                <SelectItem value="CASH_APP">Cash App</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LabeledInput label="Payout account" value={editForm.payoutAccount || ''} onChange={(v) => handleFieldChange('payoutAccount', v)} />
        </div>
        <div className="border rounded-lg p-3 mt-4 text-sm text-muted-foreground">
          Standard rate: {profile?.standardRate ? `$${Number(profile.standardRate).toFixed(0)}/shoot` : 'Set by E8'}. Per-shoot rates are shown on each booking.
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
          {saved && <span className="text-sm text-muted-foreground">Saved</span>}
        </div>
      </SectionCard>

      {/* Unavailability */}
      <SectionCard icon={<Calendar className="h-4 w-4 opacity-75" />} title="Unavailability">
        <p className="text-sm text-muted-foreground mb-3">
          Let E8 know about dates you can't shoot — E8 won't offer you shoots on these dates. Requests covering an already-confirmed booking need approval.
        </p>
        <Button onClick={() => setLeaveOpen(true)}>Request time off →</Button>
      </SectionCard>

      {/* Time Off Requests */}
      <SectionCard icon={<Ellipsis className="h-4 w-4 opacity-75" />} title="Time Off Requests">
        <p className="text-sm text-muted-foreground mb-3">
          {leaves.filter((l) => l.status === 'PENDING').length} pending, {leaves.filter((l) => l.status === 'APPROVED').length} approved
        </p>
        {leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time-off requests yet.</p>
        ) : (
          <div className="space-y-2">
            {leaves.map((l) => (
              <div key={l.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {l.status === 'APPROVED' ? 'Approved' : l.status === 'REJECTED' ? 'Not approved' : 'Awaiting approval'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.reason || 'No reason given'} · Submitted {fmtDate(l.createdAt)}</p>
                </div>
                {l.status === 'PENDING' && (
                  <button onClick={() => handleCancelLeave(l.id)} className="text-xs underline text-muted-foreground shrink-0">
                    Cancel request
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Upload Form modal */}
      <Dialog
        open={!!uploadFormType}
        onOpenChange={(open) => {
          if (!open) {
            setUploadFormType(null);
            setPickedFile(null);
          }
        }}
      >
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{uploadFormType ? FORM_LABELS[uploadFormType]?.name : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {uploadFormType ? FORM_LABELS[uploadFormType]?.description : ''} E8 reviews submissions within one business day.
            </p>
            <label className="border-2 border-dashed rounded-xl p-7 flex flex-col items-center justify-center gap-2 cursor-pointer text-center">
              <span className="text-sm">Drop a PDF or photo here</span>
              <Button type="button" variant="outline" size="sm" asChild>
                <span>Choose file</span>
              </Button>
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => setPickedFile(e.target.files?.[0] || null)}
              />
            </label>
            {pickedFile && <p className="text-xs text-muted-foreground">{pickedFile.name}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadFormType(null); setPickedFile(null); }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!pickedFile || uploading}>
              {uploading ? 'Submitting...' : 'Submit form'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Time Off modal */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Request time off</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              E8 will not offer you shoots on these dates. Requests covering a confirmed booking need approval.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput type="date" label="From" value={leaveForm.startDate} onChange={(v) => setLeaveForm((p) => ({ ...p, startDate: v }))} />
              <LabeledInput type="date" label="To" value={leaveForm.endDate} onChange={(v) => setLeaveForm((p) => ({ ...p, endDate: v }))} />
            </div>
            <LabeledInput label="Reason" value={leaveForm.reason} onChange={(v) => setLeaveForm((p) => ({ ...p, reason: v }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>Cancel</Button>
            <Button onClick={handleRequestLeave} disabled={submittingLeave}>
              {submittingLeave ? 'Submitting...' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function FieldGrid({ fields }: { fields: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {fields.map((f) => (
        <div key={f.label}>
          <p className="text-xs text-muted-foreground">{f.label}</p>
          <p className="text-sm font-semibold mt-0.5">{f.value}</p>
        </div>
      ))}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-10" />
    </div>
  );
}
