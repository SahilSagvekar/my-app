import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Copy, Check } from 'lucide-react';

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shareLink: string;
    onCopy: () => void;
    copied: boolean;
}

export function ShareDialog({ open, onOpenChange, shareLink, onCopy, copied }: ShareDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogTitle>Share Review Link</DialogTitle>
                <DialogDescription>
                    Share this link with clients or stakeholders who need to view this review. This link does not expire.
                </DialogDescription>

                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-2">
                        <Input
                            readOnly
                            value={shareLink}
                            className="flex-1 bg-muted"
                        />
                        <Button
                            type="button"
                            size="sm"
                            onClick={onCopy}
                            className="shrink-0"
                        >
                            {copied ? (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                            <strong>Note:</strong> External viewers will have read-only access. They can view the content and add comments but cannot approve or submit final feedback through the link.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
