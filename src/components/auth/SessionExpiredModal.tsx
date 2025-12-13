// components/auth/SessionExpiredModal.tsx
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LogOut, Clock } from 'lucide-react';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionExpiredModal({ isOpen, onClose }: SessionExpiredModalProps) {
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (isOpen) {
      setCountdown(10); // Reset countdown when modal opens
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isOpen && countdown === 0) {
      onClose();
    }
  }, [isOpen, countdown, onClose]);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4">
              <LogOut className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Session Expired
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-3">
            <p>Your session has expired due to inactivity.</p>
            <p className="text-sm">Please log in again to continue working.</p>
            <div className="flex items-center justify-center gap-2 mt-4 p-3 bg-muted rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Redirecting in <span className="font-semibold text-foreground">{countdown}</span> seconds
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction 
            onClick={onClose} 
            className="w-full sm:w-auto px-8"
          >
            Log In Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}