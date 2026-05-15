'use client';

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/select';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  ArrowRight, RotateCcw, Download, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  type: 'text' | 'boolean' | 'number' | 'status';
  aliases: string[]; // common Excel column header names to auto-detect
}

const LEAD_FIELDS: FieldDef[] = [
  { key: 'name',       label: 'Name',        required: true,  type: 'text',    aliases: ['name', 'full name', 'contact name', 'lead name', 'person'] },
  { key: 'company',    label: 'Company',      required: false, type: 'text',    aliases: ['company', 'organization', 'org', 'business', 'company name'] },
  { key: 'email',      label: 'Email',        required: false, type: 'text',    aliases: ['email', 'email address', 'e-mail', 'mail'] },
  { key: 'phone',      label: 'Phone',        required: false, type: 'text',    aliases: ['phone', 'phone number', 'mobile', 'cell', 'tel', 'telephone'] },
  { key: 'status',     label: 'Status',       required: false, type: 'status',  aliases: ['status', 'stage', 'pipeline stage', 'lead status'] },
  { key: 'source',     label: 'Source',       required: false, type: 'text',    aliases: ['source', 'lead source', 'origin', 'channel'] },
  { key: 'notes',      label: 'Notes',        required: false, type: 'text',    aliases: ['notes', 'note', 'comments', 'description', 'remarks'] },
  { key: 'value',      label: 'Value ($)',    required: false, type: 'number',  aliases: ['value', 'deal value', 'deal size', 'revenue', 'amount', 'contract value'] },
  { key: 'priority',   label: 'Priority',     required: false, type: 'text',    aliases: ['priority', 'urgency', 'importance'] },
  { key: 'profileUrl', label: 'Profile URL',  required: false, type: 'text',    aliases: ['profile url', 'profile link', 'linkedin url', 'social profile'] },
  { key: 'postUrl',    label: 'Post URL',     required: false, type: 'text',    aliases: ['post url', 'post link', 'content url'] },
  { key: 'instagram',  label: 'Instagram',    required: false, type: 'boolean', aliases: ['instagram', 'ig', 'insta'] },
  { key: 'facebook',   label: 'Facebook',     required: false, type: 'boolean', aliases: ['facebook', 'fb'] },
  { key: 'linkedin',   label: 'LinkedIn',     required: false, type: 'boolean', aliases: ['linkedin', 'li'] },
  { key: 'twitter',    label: 'Twitter / X',  required: false, type: 'boolean', aliases: ['twitter', 'x', 'tw'] },
  { key: 'tiktok',     label: 'TikTok',       required: false, type: 'boolean', aliases: ['tiktok', 'tt', 'tik tok'] },
];

const SKIP = '-- Skip --';

// ─── Auto-detect column mapping ───────────────────────────────────────────────

function autoDetect(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalised = headers.map(h => h.toLowerCase().trim());

  for (const field of LEAD_FIELDS) {
    for (const alias of field.aliases) {
      const idx = normalised.findIndex(h => h === alias || h.includes(alias));
      if (idx !== -1 && !Object.values(mapping).includes(headers[idx])) {
        mapping[field.key] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'map' | 'preview' | 'done';

interface ParsedFile {
  headers: string[];
  rows: Record<string, any>[];
  fileName: string;
  sheetName: string;
}

interface ImportResult { created: number; skipped: number; failed: number; }

// ─── Template download ─────────────────────────────────────────────────────────

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = ['Name *', 'Company', 'Email', 'Phone', 'Status', 'Source', 'Notes', 'Value', 'Priority', 'Profile URL'];
  const example = ['John Smith', 'Acme Corp', 'john@acme.com', '+1-555-0100', 'NEW', 'LinkedIn', 'Met at conference', '5000', 'HIGH', 'https://linkedin.com/in/jsmith'];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, 'leads-import-template.xlsx');
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

export function ImportLeadsDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsed(null);
    setMapping({});
    setResult(null);
    setImporting(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // ── Parse Excel / CSV ───────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        if (raw.length === 0) {
          toast.error('The file appears to be empty.');
          return;
        }

        const headers = Object.keys(raw[0]);
        const detected = autoDetect(headers);

        setParsed({ headers, rows: raw.slice(0, 2000), fileName: file.name, sheetName });
        setMapping(detected);
        setStep('map');
      } catch (err) {
        toast.error('Could not parse the file. Make sure it is a valid .xlsx or .csv file.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  // ── Map rows using current mapping ─────────────────────────────────────────

  const mappedRows = parsed ? parsed.rows.map(row => {
    const lead: Record<string, any> = {};
    for (const field of LEAD_FIELDS) {
      const col = mapping[field.key];
      if (col && col !== SKIP) {
        lead[field.key] = row[col] ?? '';
      }
    }
    return lead;
  }) : [];

  const hasName = mappedRows.some(r => r.name?.toString().trim());

  // ── Run import ──────────────────────────────────────────────────────────────

  const runImport = async () => {
    setImporting(true);
    try {
      const res = await fetch('/api/sales-leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: mappedRows }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || 'Import failed');
      setResult({ created: data.created, skipped: data.skipped, failed: data.failed });
      setStep('done');
      onImported();
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Import Leads from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an .xlsx or .csv file to bulk-import leads into your pipeline.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 text-xs">
          {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              <span className={cn(
                'px-2 py-0.5 rounded-full font-medium',
                step === s ? 'bg-[#0073EA] text-white' : 'bg-muted text-muted-foreground'
              )}>
                {s === 'upload' ? '1. Upload' : s === 'map' ? '2. Map columns' : s === 'preview' ? '3. Preview' : '4. Done'}
              </span>
            </div>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="flex-1 flex flex-col gap-4 py-2">
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors',
                isDragging ? 'border-[#0073EA] bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="p-4 bg-green-50 rounded-full">
                <FileSpreadsheet className="h-10 w-10 text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700">Drop your Excel or CSV file here</p>
                <p className="text-sm text-muted-foreground mt-1">Supports .xlsx, .xls, .csv — up to 2,000 rows per import</p>
              </div>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" /> Browse files
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Duplicate emails (already in your pipeline) will be skipped automatically.</span>
            </div>

            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-xs text-[#0073EA] hover:underline w-fit"
            >
              <Download className="h-3.5 w-3.5" />
              Download example template
            </button>
          </div>
        )}

        {/* ── Step 2: Column mapping ── */}
        {step === 'map' && parsed && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                <strong className="text-foreground">{parsed.fileName}</strong> — {parsed.rows.length} rows detected
              </span>
              <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Change file
              </button>
            </div>

            <div className="overflow-y-auto flex-1 rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground w-1/3">Lead field</th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground w-1/3">Excel column</th>
                    <th className="text-left p-3 font-medium text-xs text-muted-foreground">Sample value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {LEAD_FIELDS.map(field => {
                    const selectedCol = mapping[field.key] || SKIP;
                    const sample = selectedCol !== SKIP
                      ? String(parsed.rows[0]?.[selectedCol] ?? '—').slice(0, 60)
                      : '—';
                    return (
                      <tr key={field.key} className="hover:bg-muted/20">
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{field.label}</span>
                            {field.required && <Badge variant="destructive" className="text-[9px] px-1 py-0">required</Badge>}
                          </div>
                        </td>
                        <td className="p-3">
                          <Select
                            value={selectedCol}
                            onValueChange={v => setMapping(m => ({ ...m, [field.key]: v === SKIP ? '' : v }))}
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SKIP} className="text-xs text-muted-foreground">{SKIP}</SelectItem>
                              {parsed.headers.map(h => (
                                <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground truncate max-w-[200px]">
                          {sample}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              Columns were auto-detected where possible. Adjust any that are wrong before continuing.
            </p>
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 'preview' && (
          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="flex-1 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <strong>{mappedRows.length}</strong> leads ready to import.
                Duplicates (same email already in your pipeline) will be skipped automatically.
              </div>
            </div>

            <div className="overflow-auto flex-1 rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-muted-foreground">#</th>
                    {LEAD_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).map(f => (
                      <th key={f.key} className="text-left p-2 font-medium text-muted-foreground whitespace-nowrap">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mappedRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className={cn('hover:bg-muted/20', !row.name?.toString().trim() && 'opacity-40')}>
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      {LEAD_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).map(f => (
                        <td key={f.key} className="p-2 max-w-[150px] truncate">{String(row[f.key] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {mappedRows.length > 20 && (
                <p className="text-xs text-center text-muted-foreground py-2 border-t">
                  Showing 20 of {mappedRows.length} rows
                </p>
              )}
            </div>

            {!hasName && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                The "Name" field has no data. Go back and map the Name column correctly.
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 'done' && result && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
            <div className="p-4 bg-green-50 rounded-full">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">Import complete</h3>
              <p className="text-muted-foreground mt-1">Your leads have been added to the pipeline.</p>
            </div>
            <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
              {[
                { label: 'Created', value: result.created, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                { label: 'Skipped', value: result.skipped, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                { label: 'Failed',  value: result.failed,  color: 'text-red-700',   bg: 'bg-red-50 border-red-200' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-xl border p-4 text-center', s.bg)}>
                  <p className="text-2xl font-black mt-0.5" style={{ color: s.color.replace('text-', '') }}>{s.value}</p>
                  <p className={cn('text-xs font-semibold mt-1', s.color)}>{s.label}</p>
                </div>
              ))}
            </div>
            {result.skipped > 0 && (
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                {result.skipped} lead{result.skipped !== 1 ? 's were' : ' was'} skipped because the email already exists in your pipeline.
              </p>
            )}
          </div>
        )}

        {/* Footer actions */}
        <DialogFooter className="gap-2">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          )}

          {step === 'map' && (
            <>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button
                onClick={() => setStep('preview')}
                disabled={!Object.values(mapping).some(v => v && v !== SKIP)}
                className="bg-[#0073EA] hover:bg-[#0060C0] text-white"
              >
                Preview <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              <Button
                onClick={runImport}
                disabled={importing || !hasName}
                className="bg-[#0073EA] hover:bg-[#0060C0] text-white gap-2"
              >
                {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : `Import ${mappedRows.length} leads`}
              </Button>
            </>
          )}

          {step === 'done' && (
            <>
              <Button variant="outline" onClick={reset}>Import another file</Button>
              <Button onClick={() => handleClose(false)} className="bg-[#0073EA] hover:bg-[#0060C0] text-white">
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}