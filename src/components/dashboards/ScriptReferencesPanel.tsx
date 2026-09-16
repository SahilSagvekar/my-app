'use client';

import { useState } from 'react';
import { Link2, Paperclip, X, Loader, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { ShootScriptReferenceFile } from '@/lib/shoot-scripts';

interface Props {
  shootTaskId: string;
  scriptId: string;
  referenceLinks: string[];
  referenceFiles: ShootScriptReferenceFile[];
  clientIdOverride?: string | null; // when an admin/manager is previewing a client's portal
  onUpdate: (next: { referenceLinks?: string[]; referenceFiles?: ShootScriptReferenceFile[] }) => void;
}

const formatSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;

// Reference material for a script — a link to an existing video to
// replicate the style of, plus small reference images/files/logos.
// Shared between the staff (ShootScriptsDialog) and client
// (ClientShootScriptsPage) script editors, since both roles can add these.
export function ScriptReferencesPanel({ shootTaskId, scriptId, referenceLinks, referenceFiles, clientIdOverride, onUpdate }: Props) {
  const [linkInput, setLinkInput] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [uploading, setUploading] = useState(false);

  const query = clientIdOverride ? `?clientId=${clientIdOverride}` : '';
  const headers = clientIdOverride ? { 'x-viewing-as': 'client' } : undefined;

  const addLink = async () => {
    let url = linkInput.trim();
    if (!url) return;

    // Auto-prepend https:// if missing
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      new URL(url); // basic validation — throws if not a real URL
    } catch {
      toast.error('Enter a valid link (e.g. https://youtube.com/...)');
      return;
    }

    if (referenceLinks.includes(url)) {
      toast.info('This link is already added');
      return;
    }

    const next = [...referenceLinks, url];
    setAddingLink(true);
    try {
      const res = await fetch(`/api/shoots/${shootTaskId}/scripts/${scriptId}/references${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify({ referenceLinks: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not add link');
      onUpdate({ referenceLinks: data.referenceLinks || next });
      setLinkInput('');
      toast.success('Link added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add link');
    } finally {
      setAddingLink(false);
    }
  };

  const removeLink = async (url: string) => {
    const next = referenceLinks.filter((l) => l !== url);
    try {
      const res = await fetch(`/api/shoots/${shootTaskId}/scripts/${scriptId}/references${query}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(headers || {}) },
        body: JSON.stringify({ referenceLinks: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove link');
      onUpdate({ referenceLinks: data.referenceLinks || next });
      toast.success('Link removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove link');
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/shoots/${shootTaskId}/scripts/${scriptId}/references${query}`, {
        method: 'POST',
        headers,
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onUpdate({ referenceFiles: data.referenceFiles });
      toast.success('Reference file added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/shoots/${shootTaskId}/scripts/${scriptId}/references?fileId=${fileId}${query ? `&clientId=${clientIdOverride}` : ''}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove file');
      onUpdate({ referenceFiles: data.referenceFiles });
      toast.success('Reference file removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove file');
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
      <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Reference material</div>
      <p className="text-xs text-zinc-500 -mt-2">A video to replicate, product photos, a logo — anything that helps the shoot.</p>

      {referenceLinks.length > 0 && (
        <div className="space-y-1.5">
          {referenceLinks.map((link) => (
            <div key={link} className="flex items-center gap-2 text-sm">
              <Link2 className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
              <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-blue-600 hover:underline">{link}</a>
              <button type="button" onClick={() => removeLink(link)} className="flex-shrink-0 text-zinc-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
          placeholder="Paste a link (Instagram, YouTube...) and press Enter"
          className="flex-1 h-9 rounded-lg border border-zinc-200 px-3 text-sm"
        />
        <button
          type="button"
          onClick={addLink}
          disabled={addingLink || !linkInput.trim()}
          className="h-9 px-3 rounded-lg border border-zinc-200 text-xs font-bold hover:bg-zinc-50 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
        >
          {addingLink && <Loader className="h-3 w-3 animate-spin" />}
          {addingLink ? 'Adding…' : 'Add link'}
        </button>
      </div>

      {referenceFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {referenceFiles.map((f) => (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs hover:bg-zinc-50"
            >
              {f.mimeType?.startsWith('image/') ? (
                <img src={f.url} alt={f.name} className="h-5 w-5 rounded object-cover" />
              ) : (
                <Paperclip className="h-3.5 w-3.5 text-zinc-400" />
              )}
              <span className="max-w-[140px] truncate font-medium text-zinc-700">{f.name}</span>
              <span className="text-zinc-400">{formatSize(f.size)}</span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); removeFile(f.id!); }}
                className="ml-0.5 text-zinc-400 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </a>
          ))}
        </div>
      )}

      <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-200 text-xs font-bold hover:bg-zinc-50 cursor-pointer w-fit">
        {uploading ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
        {uploading ? 'Uploading…' : 'Attach image / file (max 10MB)'}
        <input
          type="file"
          className="hidden"
          disabled={uploading}
          accept="image/*,.pdf,.doc,.docx"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = ''; }}
        />
      </label>
    </div>
  );
}