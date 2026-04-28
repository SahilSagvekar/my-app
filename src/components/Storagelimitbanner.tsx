'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StorageInfo {
  used: number;
  limit: number;
  usedFormatted: string;
  limitFormatted: string;
  percentage: number;
  isAtLimit: boolean;
  isNearLimit: boolean;
  isCritical: boolean;
}

interface StorageLimitBannerProps {
  clientId: string;
  onUpgradeClick?: () => void;
  className?: string;
}

export function StorageLimitBanner({ clientId, onUpgradeClick, className }: StorageLimitBannerProps) {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    
    const fetchStorage = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/storage`);
        if (res.ok) {
          const data = await res.json();
          setStorageInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch storage info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorage();
  }, [clientId]);

  // Don't show if loading or no data
  if (loading || !storageInfo) return null;

  const getProgressColor = () => {
    if (storageInfo.isAtLimit) return 'bg-red-500';
    if (storageInfo.isCritical) return 'bg-orange-500';
    if (storageInfo.isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className={cn(
      'w-full space-y-3 text-sm text-foreground',
      className
    )}>
      <div className="flex items-center gap-3">
        {storageInfo.isAtLimit ? (
          <AlertTriangle className="h-5 w-5 text-red-500" />
        ) : (
          <Cloud className="h-5 w-5 text-muted-foreground" />
        )}
        <span className="font-medium">Storage</span>
      </div>

      <div className="space-y-2">
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', getProgressColor())}
            style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {storageInfo.usedFormatted} of {storageInfo.limitFormatted} used
        </p>
      </div>

      {storageInfo.isAtLimit && (
        <p className="text-xs font-medium text-red-600">Drive locked</p>
      )}

      <Button
        size="sm"
        variant="outline"
        className="h-9 rounded-full px-4 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        onClick={onUpgradeClick}
      >
        Get more storage
      </Button>
    </div>
  );
}

// Compact version for toolbar
export function StorageIndicator({ clientId, onClick }: { clientId: string; onClick?: () => void }) {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  useEffect(() => {
    if (!clientId) return;
    
    const fetchStorage = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/storage`);
        if (res.ok) {
          const data = await res.json();
          setStorageInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch storage info:', error);
      }
    };

    fetchStorage();
  }, [clientId]);

  if (!storageInfo) return null;

  const getColor = () => {
    if (storageInfo.isAtLimit) return 'text-red-500';
    if (storageInfo.isCritical) return 'text-orange-500';
    if (storageInfo.isNearLimit) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary transition-colors',
        getColor()
      )}
    >
      <Cloud className="h-3.5 w-3.5" />
      <span>{storageInfo.percentage.toFixed(0)}%</span>
    </button>
  );
}
