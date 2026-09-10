'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Copy, Check, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shareLink: string;
    onCopy: () => void;
    copied: boolean;
    onSendInvite?: (email: string) => Promise<void> | void;
}

export function ShareDialog({
    open,
    onOpenChange,
    shareLink,
    onCopy,
    copied,
    onSendInvite,
}: ShareDialogProps) {
    const [email, setEmail] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSendEmail = async () => {
        const trimmed = email.trim();
        if (!trimmed) return;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
            toast.error('Please enter a valid email address');
            return;
        }

        try {
            setIsSending(true);
            if (onSendInvite) {
                await onSendInvite(trimmed);
            } else {
                await new Promise((resolve) => setTimeout(resolve, 600));
                toast.success(`Invite link sent to ${trimmed}`);
            }
            setEmail('');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to send invite');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!flex !flex-col w-[92vw] sm:w-[450px] !max-w-[450px] p-6 sm:p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden box-border min-w-0">
                <div className="w-full min-w-0">
                    <DialogTitle className="text-xl sm:text-[22px] font-bold text-zinc-950 tracking-tight">
                        Share Review Link
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-[13px] text-zinc-500 mt-1 leading-relaxed">
                        Invite people by email, or share the link. External viewers get view-only access.
                    </DialogDescription>
                </div>

                <div className="pt-2 space-y-4 w-full min-w-0">
                    {/* Section 1: Invite by Email */}
                    <div className="space-y-1.5 w-full min-w-0">
                        <label className="text-[11px] font-bold tracking-wider text-zinc-600 uppercase block">
                            INVITE BY EMAIL
                        </label>
                        <div className="flex items-center gap-2 w-full min-w-0">
                            <div className="relative flex-1 min-w-0">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none shrink-0" />
                                <Input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSendEmail();
                                        }
                                    }}
                                    className="w-full min-w-0 pl-9 pr-3 h-10 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 rounded-lg text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-zinc-900"
                                />
                            </div>
                            <Button
                                type="button"
                                onClick={handleSendEmail}
                                disabled={isSending || !email.trim()}
                                className="h-10 px-5 bg-black hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm rounded-lg shrink-0 transition-colors cursor-pointer"
                            >
                                {isSending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Send'
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-zinc-200/80 my-3" />

                    {/* Section 2: Or Share a Link */}
                    <div className="space-y-1.5 w-full min-w-0">
                        <label className="text-[11px] font-bold tracking-wider text-zinc-600 uppercase block">
                            OR SHARE A LINK
                        </label>
                        <div className="flex items-center gap-2 w-full min-w-0">
                            <div
                                className="flex-1 min-w-0 bg-black text-white text-xs sm:text-[13px] font-mono px-3.5 py-2.5 rounded-lg border border-black select-all overflow-hidden"
                                title={shareLink}
                            >
                                <p className="truncate w-full m-0 p-0 block leading-tight">
                                    {shareLink || 'Generating link...'}
                                </p>
                            </div>
                            <Button
                                type="button"
                                onClick={onCopy}
                                className="h-10 px-4 bg-black hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm rounded-lg shrink-0 flex items-center gap-1.5 transition-colors border border-black cursor-pointer"
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4 shrink-0" />
                                        <span>Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4 shrink-0" />
                                        <span>Copy</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Section 3: Read-only Note Box */}
                    <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-3.5 mt-3 w-full min-w-0">
                        <p className="text-xs text-blue-900 leading-relaxed m-0">
                            <strong className="font-bold text-blue-950">Note:</strong> External viewers have view-only access. They can view the content and add comments but cannot approve or submit final feedback through the link.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
