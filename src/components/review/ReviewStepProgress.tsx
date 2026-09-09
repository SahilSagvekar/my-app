'use client';

/**
 * ReviewStepProgress — "STEP X OF N — LABEL" bar shown at the bottom of the
 * review sidebar while a task is being walked through as a wizard
 * (Comments → Titles → Thumbnails, the last step only when the task has a
 * thumbnail uploaded). Only the current step's indicator is highlighted —
 * this isn't a cumulative fill, just a position marker.
 */
interface ReviewStepProgressProps {
    /** 1-indexed position of the step currently being shown. */
    currentStep: number;
    /** Total steps in this task's flow — 2 (no thumbnail) or 3 (has one). */
    totalSteps: number;
    /** Short label for the current step, e.g. "COMMENTS", "TITLES", "THUMBNAILS". */
    label: string;
}

export function ReviewStepProgress({ currentStep, totalSteps, label }: ReviewStepProgressProps) {
    return (
        <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[10px] font-semibold tracking-wider text-[var(--review-text-muted)] uppercase">
                Step {currentStep} of {totalSteps} — {label}
            </span>
            <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-1 w-4 rounded-full transition-colors ${
                            i === currentStep - 1 ? 'bg-white' : 'bg-white/20'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}