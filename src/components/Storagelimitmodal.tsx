'use client';

import { useState } from 'react';
import { AlertTriangle, HardDrive, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface StorageLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storageInfo: StorageInfo;
  onUpgrade?: () => void;
  onContactSupport?: () => void;
}

const UPGRADE_PLANS = [
  {
    name: 'Additional 1 TB',
    price: '$49',
    period: '/month',
    storage: '1 TB',
    features: ['1 TB additional storage', 'Same upload speed', 'No other changes'],
    popular: false,
  },
  {
    name: 'Additional 3 TB',
    price: '$99',
    period: '/month',
    storage: '3 TB',
    features: ['3 TB additional storage', 'Priority upload speed', 'Email support'],
    popular: true,
  },
  {
    name: 'Unlimited',
    price: '$199',
    period: '/month',
    storage: 'Unlimited',
    features: ['Unlimited storage', 'Fastest upload speed', 'Priority support', 'Custom retention'],
    popular: false,
  },
];

export function StorageLimitModal({ 
  open, 
  onOpenChange, 
  storageInfo,
  onUpgrade,
  onContactSupport 
}: StorageLimitModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<number | null>(1);

  const handleUpgrade = () => {
    if (selectedPlan !== null) {
      if (onUpgrade) {
        onUpgrade();
      } else {
        window.open('/settings/billing', '_blank');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 text-red-600">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl">Storage Limit Reached</DialogTitle>
              <DialogDescription className="text-red-600/80 dark:text-red-400/80">
                You have used {storageInfo?.usedFormatted ?? '0 B'} of your {storageInfo?.limitFormatted ?? '3 TB'} storage limit
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Storage Used</span>
            <span className="font-medium">{(storageInfo?.percentage ?? 0).toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-red-500 rounded-full transition-all"
              style={{ width: `${Math.min(storageInfo?.percentage ?? 0, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Uploads are disabled</strong> until you upgrade your storage plan or free up space by deleting files.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-4">
          {UPGRADE_PLANS.map((plan, index) => (
            <button
              key={plan.name}
              onClick={() => setSelectedPlan(index)}
              className={cn(
                'relative p-4 border-2 rounded-xl text-left transition-all',
                selectedPlan === index 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300',
                plan.popular && 'ring-2 ring-primary ring-offset-2'
              )}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  Most Popular
                </span>
              )}
              
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{plan.storage}</span>
              </div>
              
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </div>
              
              <ul className="space-y-1.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              {selectedPlan === index && (
                <div className="absolute top-3 right-3">
                  <div className="h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onContactSupport?.() || window.open('mailto:support@e8productions.com', '_blank')}
            className="w-full sm:w-auto"
          >
            Contact Support
          </Button>
          <Button 
            onClick={handleUpgrade}
            disabled={selectedPlan === null}
            className="w-full sm:w-auto"
          >
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}