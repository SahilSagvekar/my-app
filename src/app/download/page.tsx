'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Terminal, MonitorDown } from 'lucide-react';

// 🔥 Replace with your actual R2 public URL once confirmed.
const RELEASES_BASE_URL = 'https://dbc98815b0fb7124d9fc27fb40abd290.r2.cloudflarestorage.com/e8-test/desktop-releases';

const WINDOWS_INSTALLER_URL = `${RELEASES_BASE_URL}/E8Client-Setup.exe`;
const MAC_DMG_URL = `${RELEASES_BASE_URL}/E8Client.dmg`;
const MAC_FIX_COMMAND = 'xattr -cr "/Applications/E8 Client.app"';

type Platform = 'mac' | 'windows' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Mac')) return 'mac';
  if (ua.includes('Win')) return 'windows';
  return 'unknown';
}

export default function DownloadDesktopAppPage() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const copyFixCommand = async () => {
    await navigator.clipboard.writeText(MAC_FIX_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <Card className="max-w-lg w-full p-8">
        <div className="flex items-center gap-3 mb-2">
          <MonitorDown className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold text-zinc-900">E8 Client Desktop App</h1>
        </div>
        <p className="text-sm text-zinc-600 mb-8">
          Download your videos to your own computer and review them faster —
          same login, same dashboard, same review screen you already use.
        </p>

        {/* Windows */}
        <div className={`border rounded-lg p-5 mb-4 ${platform === 'windows' ? 'border-primary bg-primary/5' : 'border-zinc-200'}`}>
          <h2 className="font-semibold text-zinc-900 mb-1">Windows</h2>
          <p className="text-xs text-zinc-500 mb-3">
            Windows may show a &quot;Windows protected your PC&quot; warning since this
            app is new — click <strong>More info</strong>, then <strong>Run anyway</strong>. This is expected.
          </p>
          <Button asChild className="w-full">
            <a href={WINDOWS_INSTALLER_URL} download>
              <Download className="h-4 w-4 mr-2" />
              Download for Windows
            </a>
          </Button>
        </div>

        {/* Mac */}
        <div className={`border rounded-lg p-5 ${platform === 'mac' ? 'border-primary bg-primary/5' : 'border-zinc-200'}`}>
          <h2 className="font-semibold text-zinc-900 mb-1">Mac</h2>
          <p className="text-xs text-zinc-500 mb-3">
            Download and open the file, then drag <strong>E8 Client</strong> into your
            Applications folder.
          </p>
          <Button asChild className="w-full mb-4">
            <a href={MAC_DMG_URL} download>
              <Download className="h-4 w-4 mr-2" />
              Download for Mac
            </a>
          </Button>

          <p className="text-xs text-zinc-500 mb-2">
            First time opening it, macOS may say the app &quot;is damaged&quot; — this is
            expected for a new app and not an actual problem. Open{' '}
            <strong>Terminal</strong> (search for it in Spotlight), paste this command,
            and press Enter:
          </p>
          <div className="bg-zinc-900 text-zinc-100 text-xs font-mono rounded px-3 py-2.5 mb-3 overflow-x-auto">
            {MAC_FIX_COMMAND}
          </div>
          <Button variant="secondary" className="w-full" onClick={copyFixCommand}>
            <Terminal className="h-4 w-4 mr-2" />
            {copied ? 'Copied!' : 'Copy command'}
          </Button>
        </div>
      </Card>
    </div>
  );
}