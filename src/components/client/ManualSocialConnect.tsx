'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Youtube, Facebook, Music2, Instagram } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onConnected: () => void;
}

const PLATFORMS = [
  { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000', tokenLabel: 'Refresh Token', tokenPlaceholder: 'Paste your YouTube OAuth refresh token' },
  { id: 'facebook', label: 'Facebook + Instagram', icon: Facebook, color: '#1877F2', tokenLabel: 'Access Token', tokenPlaceholder: 'Paste your Facebook Page access token' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F', tokenLabel: 'Access Token', tokenPlaceholder: 'Paste your Instagram access token' },
  { id: 'tiktok', label: 'TikTok', icon: Music2, color: '#000000', tokenLabel: 'Access Token', tokenPlaceholder: 'Paste your TikTok access token' },
];

export function ManualSocialConnect({ open, onOpenChange, clientId, onConnected }: Props) {
  const [platform, setPlatform] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedPlatform = PLATFORMS.find(p => p.id === platform);

  const handleSubmit = async () => {
    if (!platform || !token.trim()) {
      toast.error('Please select a platform and enter a token');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/social/connect-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, token: token.trim(), clientId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect account');
      }

      toast.success(`Successfully connected ${selectedPlatform?.label || platform}!`);
      setToken('');
      setPlatform('');
      onConnected();
    } catch (err: any) {
      toast.error(err.message || 'Connection failed. Please check your token and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (val: boolean) => {
    if (!loading) {
      setToken('');
      setPlatform('');
      onOpenChange(val);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Social Account</DialogTitle>
          <DialogDescription>
            Paste your platform access token to connect an account manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <p.icon className="h-4 w-4" style={{ color: p.color }} />
                      {p.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPlatform && (
            <div className="space-y-1.5">
              <Label>{selectedPlatform.tokenLabel}</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={selectedPlatform.tokenPlaceholder}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                The token will be validated against the platform API before saving.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !platform || !token.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}