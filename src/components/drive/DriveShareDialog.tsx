'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Copy, Check, X, Loader2, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ShareItemInfo {
  s3Key: string;
  name: string;
  size?: number;
  mimeType?: string | null;
  type: 'file' | 'folder';
}

interface Recipient {
  id: string;
  email: string;
  status: 'invited' | 'verified';
}

interface DriveShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ShareItemInfo | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DriveShareDialog({ open, onOpenChange, item }: DriveShareDialogProps) {
  const [emailDraft, setEmailDraft] = useState('');
  const [pendingEmails, setPendingEmails] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [copied, setCopied] = useState(false);
  const [addingMore, setAddingMore] = useState(false);

  const reset = () => {
    setEmailDraft('');
    setPendingEmails([]);
    setShareToken(null);
    setShareUrl(null);
    setRecipients([]);
    setCopied(false);
  };

  const commitEmailDraft = () => {
    const candidate = emailDraft.trim().toLowerCase().replace(/,$/, '');
    if (!candidate) return;
    if (!EMAIL_RE.test(candidate)) {
      toast.error('That doesn\'t look like a valid email');
      return;
    }
    if (pendingEmails.includes(candidate)) {
      setEmailDraft('');
      return;
    }
    setPendingEmails((prev) => [...prev, candidate]);
    setEmailDraft('');
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      commitEmailDraft();
    } else if (e.key === 'Backspace' && !emailDraft && pendingEmails.length > 0) {
      setPendingEmails((prev) => prev.slice(0, -1));
    }
  };

  const removePendingEmail = (email: string) => {
    setPendingEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleShare = async () => {
    if (!item) return;
    // Catch anything still sitting in the input box that wasn't committed.
    let finalEmails = pendingEmails;
    const stray = emailDraft.trim().toLowerCase();
    if (stray && EMAIL_RE.test(stray) && !finalEmails.includes(stray)) {
      finalEmails = [...finalEmails, stray];
    }
    if (finalEmails.length === 0) {
      toast.error('Add at least one email to share with');
      return;
    }

    setSharing(true);
    try {
      const res = await fetch('/api/drive/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3Key: item.type === 'folder'
            ? (item.s3Key.endsWith('/') ? item.s3Key : item.s3Key + '/')
            : item.s3Key,
          fileName: item.name,
          fileSize: item.size,
          mimeType: item.mimeType,
          type: item.type,
          recipients: finalEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create share');

      setShareToken(data.shareToken);
      setShareUrl(data.shareUrl);
      setRecipients(finalEmails.map((email, i) => ({ id: `pending-${i}`, email, status: 'invited' as const })));
      setEmailDraft('');
      setPendingEmails([]);
      toast.success(`Shared with ${finalEmails.length} ${finalEmails.length === 1 ? 'person' : 'people'}`);

      await navigator.clipboard.writeText(data.shareUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create share');
    } finally {
      setSharing(false);
    }
  };

  const handleAddMore = async () => {
    if (!shareToken) return;
    let finalEmails = pendingEmails;
    const stray = emailDraft.trim().toLowerCase();
    if (stray && EMAIL_RE.test(stray) && !finalEmails.includes(stray)) {
      finalEmails = [...finalEmails, stray];
    }
    if (finalEmails.length === 0) return;

    setAddingMore(true);
    try {
      const res = await fetch(`/api/drive/share/${shareToken}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: finalEmails }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add recipients');

      setRecipients((prev) => [
        ...prev,
        ...finalEmails.map((email, i) => ({ id: `pending-new-${i}-${Date.now()}`, email, status: 'invited' as const })),
      ]);
      setEmailDraft('');
      setPendingEmails([]);
      toast.success('Invite sent');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add recipients');
    } finally {
      setAddingMore(false);
    }
  };

  const handleRemoveRecipient = async (recipient: Recipient) => {
    if (!shareToken) return;
    // Optimistic — this list only exists in this dialog session anyway.
    setRecipients((prev) => prev.filter((r) => r.id !== recipient.id));
    try {
      const res = await fetch(`/api/drive/share/${shareToken}/recipients/${recipient.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success(`Removed ${recipient.email}`);
    } catch {
      toast.error('Failed to remove — they may still have access');
      setRecipients((prev) => [...prev, recipient]);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 3000);
  };

  const hasShared = !!shareToken;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Share {item?.type === 'folder' ? 'Folder' : 'File'}
        </DialogTitle>
        <DialogDescription className="truncate">
          {item?.name}
        </DialogDescription>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {hasShared ? 'Add more people' : 'Add people (required)'}
            </label>
            <div className="border rounded-lg p-2 min-h-[44px] flex flex-wrap gap-1.5 items-center focus-within:ring-1 focus-within:ring-ring">
              {pendingEmails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1 pr-1">
                  {email}
                  <button
                    type="button"
                    onClick={() => removePendingEmail(email)}
                    className="ml-0.5 hover:bg-black/10 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                onBlur={commitEmailDraft}
                placeholder={pendingEmails.length === 0 ? 'name@company.com' : 'Add another…'}
                className="flex-1 min-w-[140px] outline-none text-sm bg-transparent py-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or comma after each email. They'll need to verify this exact address to view it.
            </p>
          </div>

          {!hasShared ? (
            <Button onClick={handleShare} disabled={sharing} className="w-full">
              {sharing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Share
            </Button>
          ) : (
            <Button onClick={handleAddMore} disabled={addingMore} variant="outline" size="sm" className="w-full">
              {addingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invite
            </Button>
          )}

          {hasShared && (
            <>
              <div className="flex items-center gap-2">
                <Input readOnly value={shareUrl || ''} className="flex-1 bg-muted text-xs" />
                <Button type="button" size="sm" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {recipients.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    People with access
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {recipients.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 text-sm"
                      >
                        <span className="truncate">{r.email}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={r.status === 'verified' ? 'default' : 'outline'} className="text-[10px]">
                            {r.status === 'verified' ? 'Verified' : 'Invited'}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(r)}
                            title="Remove access"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-900 dark:text-blue-100">
                  Only the people listed above can open this link — they'll verify their email the first time.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}