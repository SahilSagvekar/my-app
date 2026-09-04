'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { FileText, MapPin, Clock, Loader } from 'lucide-react';

interface ScriptEntry {
  taskId: string;
  taskTitle: string | null;
  shootDate: string | null;
  location: string | null;
  scriptContent: string | null;
  scriptSentAt: string | null;
}

export function ClientShootScriptsPage() {
  const [scripts, setScripts] = useState<ScriptEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScripts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/client/shoot-scripts');
      if (res.ok) {
        const data = await res.json();
        setScripts(data.scripts || []);
      }
    } catch (err) {
      console.error('Failed to load scripts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <Loader className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading scripts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Scripts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Always shows the latest version — no need to check back for updates
        </p>
      </div>

      {scripts.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No scripts shared yet</p>
          <p className="text-sm text-slate-400 mt-1">Scripts for your upcoming shoots will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scripts.map(script => (
            <Card key={script.taskId}>
              <CardContent className="p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-bold text-lg">{script.taskTitle || 'Shoot'}</h3>
                  {script.shootDate && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(script.shootDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                  {script.location && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" />
                      {script.location}
                    </span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap font-mono text-sm bg-slate-50 border border-slate-100 rounded-lg p-4 text-slate-800">
                  {script.scriptContent || '(empty)'}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}