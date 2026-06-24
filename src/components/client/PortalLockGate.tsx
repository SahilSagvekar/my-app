'use client';

import { useEffect, useState, useCallback } from 'react';
import { CreditCard, FileText, Lock } from 'lucide-react';

interface PortalAccess {
  status: string;
  fullAccess: boolean;
  locked: boolean;
  forcePage: string | null;
  message: string | null;
  nextBillingDate: string | null;
  lockedAt: string | null;
}

interface Props {
  currentPage: string;
  onPageChange: (page: string) => void;
  children: React.ReactNode;
}

// Pages that are always accessible regardless of lock status
const ALWAYS_ALLOWED = ['contracts'];

export function PortalLockGate({ currentPage, onPageChange, children }: Props) {
  const [access, setAccess] = useState<PortalAccess | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/access', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAccess(data);
      }
    } catch {
      // If check fails, allow access (fail open)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  // Force redirect to contracts page if locked
  useEffect(() => {
    if (!access) return;
    if (access.fullAccess) return;
    if (!ALWAYS_ALLOWED.includes(currentPage)) {
      onPageChange('contracts');
    }
  }, [access, currentPage, onPageChange]);

  if (loading) return null;

  // Full access — render normally
  if (!access || access.fullAccess) {
    return <>{children}</>;
  }

  // Locked — if they somehow got to a non-contracts page, show lock screen
  if (!ALWAYS_ALLOWED.includes(currentPage)) {
    return <LockScreen access={access} onGoToContracts={() => onPageChange('contracts')} />;
  }

  // On contracts page while locked — show the page with a lock banner on top
  return (
    <div className="space-y-4">
      <LockBanner access={access} />
      {children}
    </div>
  );
}

function LockBanner({ access }: { access: PortalAccess }) {
  const isLocked = access.status === 'LOCKED';
  const isContractPending = access.status === 'CONTRACT_PENDING';
  const isPaymentPending = access.status === 'PAYMENT_PENDING';

  return (
    <div className={`rounded-xl px-5 py-4 flex items-center gap-4 border ${
      isLocked
        ? 'bg-red-50 border-red-200'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
        isLocked ? 'bg-red-100' : 'bg-blue-100'
      }`}>
        {isLocked
          ? <Lock className="w-4 h-4 text-red-600" />
          : isContractPending
          ? <FileText className="w-4 h-4 text-blue-600" />
          : <CreditCard className="w-4 h-4 text-blue-600" />
        }
      </div>
      <div>
        <p className={`font-semibold text-sm ${isLocked ? 'text-red-800' : 'text-blue-800'}`}>
          {isLocked
            ? 'Your portal is locked — payment required'
            : isContractPending
            ? 'Please sign your contract to continue'
            : 'Please complete your first payment to unlock your portal'}
        </p>
        {access.message && (
          <p className={`text-xs mt-0.5 ${isLocked ? 'text-red-600' : 'text-blue-600'}`}>
            {access.message}
          </p>
        )}
      </div>
    </div>
  );
}

function LockScreen({ access, onGoToContracts }: { access: PortalAccess; onGoToContracts: () => void }) {
  // Auto-redirect to contracts
  useEffect(() => {
    onGoToContracts();
  }, [onGoToContracts]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-gray-600 text-sm">Redirecting to contracts & billing...</p>
      </div>
    </div>
  );
}