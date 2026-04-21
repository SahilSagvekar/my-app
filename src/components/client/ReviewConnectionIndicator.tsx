import { Activity, AlertTriangle, CheckCircle2, Wifi } from 'lucide-react';

export interface ReviewConnectionInsight {
    status: 'good' | 'warning' | 'poor' | 'unknown';
    statusLabel: string;
    connectionLabel: string;
    currentSpeedText: string;
    requiredSpeedText: string;
    helperText: string;
}

interface ReviewConnectionIndicatorProps {
    insight: ReviewConnectionInsight;
    compact?: boolean;
    className?: string;
}

const statusStyles: Record<ReviewConnectionInsight['status'], { pill: string; Icon: typeof Wifi }> = {
    good: {
        pill: 'border-green-500/30 bg-green-500/10 text-green-300',
        Icon: CheckCircle2,
    },
    warning: {
        pill: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        Icon: Activity,
    },
    poor: {
        pill: 'border-red-500/30 bg-red-500/10 text-red-300',
        Icon: AlertTriangle,
    },
    unknown: {
        pill: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
        Icon: Wifi,
    },
};

export function ReviewConnectionIndicator({
    insight,
    compact = false,
    className = '',
}: ReviewConnectionIndicatorProps) {
    const tone = statusStyles[insight.status];
    const wrapperClassName = `${compact
        ? 'rounded-xl border border-[var(--review-border)] bg-[var(--review-bg-secondary)] p-3'
        : 'mt-2 flex flex-wrap items-start gap-2'
        } ${className}`.trim();

    if (compact) {
        const CompactIcon = tone.Icon;

        return (
            <div className={wrapperClassName}>
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${tone.pill}`}>
                    <CompactIcon className="h-3.5 w-3.5" />
                    <span>{insight.statusLabel}</span>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-tertiary)] px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--review-text-muted)]">{insight.connectionLabel}</div>
                        <div className="mt-1 text-xs font-semibold text-white">{insight.currentSpeedText}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--review-border)] bg-[var(--review-bg-tertiary)] px-2.5 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-[var(--review-text-muted)]">Needed</div>
                        <div className="mt-1 text-xs font-semibold text-white">{insight.requiredSpeedText}</div>
                    </div>
                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-[var(--review-text-muted)]">
                    {insight.helperText}
                </p>
            </div>
        );
    }

    const InlineIcon = tone.Icon;

    return (
        <div className={wrapperClassName}>
            <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${tone.pill}`}>
                <InlineIcon className="h-3.5 w-3.5" />
                <span>{insight.statusLabel}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--review-border)] bg-[var(--review-bg-tertiary)] px-2.5 py-1 text-xs">
                <span className="text-[var(--review-text-muted)]">{insight.connectionLabel}</span>
                <span className="font-semibold text-white">{insight.currentSpeedText}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--review-border)] bg-[var(--review-bg-tertiary)] px-2.5 py-1 text-xs">
                <span className="text-[var(--review-text-muted)]">Needed</span>
                <span className="font-semibold text-white">{insight.requiredSpeedText}</span>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--review-text-muted)]">
                {insight.helperText}
            </p>
        </div>
    );
}
