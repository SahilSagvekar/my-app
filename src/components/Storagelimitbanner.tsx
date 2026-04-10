'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, HardDrive, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  const [dismissed, setDismissed] = useState(false);

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
  // Allow dismiss only if not at critical level
  if (dismissed && !storageInfo.isCritical && !storageInfo.isAtLimit) return null;

  const getBannerStyle = () => {
    if (storageInfo.isAtLimit) {
      return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200';
    }
    if (storageInfo.isCritical) {
      return 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-200';
    }
    if (storageInfo.isNearLimit) {
      return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200';
    }
    // Default style for normal usage (< 90%)
    return 'bg-secondary/50 border-border text-foreground';
  };

  const getProgressColor = () => {
    if (storageInfo.isAtLimit) return 'bg-red-500';
    if (storageInfo.isCritical) return 'bg-orange-500';
    if (storageInfo.isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getMessage = () => {
    if (storageInfo.isAtLimit) {
      return 'Storage limit reached. Uploads are disabled until you upgrade.';
    }
    if (storageInfo.isCritical) {
      return 'Critical: You\'re almost out of storage space!';
    }
    if (storageInfo.isNearLimit) {
      return 'Warning: Your storage is filling up.';
    }
    // Normal usage - just show storage info
    return 'Raw Footage Storage';
  };

  // Only show upgrade button when near limit
  const showUpgradeButton = storageInfo.isNearLimit || storageInfo.isCritical || storageInfo.isAtLimit;

  return (
    <div className={cn(
      'flex items-center gap-4 p-3 border rounded-lg',
      getBannerStyle(),
      className
    )}>
      <div className="shrink-0">
        {storageInfo.isAtLimit || storageInfo.isCritical ? (
          <AlertTriangle className="h-5 w-5" />
        ) : (
          <HardDrive className="h-5 w-5" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{getMessage()}</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={cn('h-full rounded-full transition-all', getProgressColor())}
              style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium whitespace-nowrap">
            {storageInfo.usedFormatted} / {storageInfo.limitFormatted}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Only show upgrade button when storage is getting full */}
        {showUpgradeButton && onUpgradeClick && (
          <Button 
            size="sm" 
            variant={storageInfo.isAtLimit ? "destructive" : "default"}
            onClick={onUpgradeClick}
          >
            Upgrade
          </Button>
        )}
        {/* Only allow dismiss when not at limit and usage is high (90%+) */}
        {showUpgradeButton && !storageInfo.isAtLimit && (
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
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
      <HardDrive className="h-3.5 w-3.5" />
      <span>{storageInfo.percentage.toFixed(0)}%</span>
    </button>
  );
}