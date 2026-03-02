"use client";

import React from "react";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    DRAFT: { label: "Draft", bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400" },
    SENT: { label: "Sent", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    PARTIALLY_SIGNED: { label: "Partially Signed", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    COMPLETED: { label: "Completed", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    CANCELLED: { label: "Cancelled", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
    EXPIRED: { label: "Expired", bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

const SIGNER_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    PENDING: { label: "Pending", bg: "bg-gray-100", text: "text-gray-600" },
    VIEWED: { label: "Viewed", bg: "bg-blue-50", text: "text-blue-700" },
    SIGNED: { label: "Signed", bg: "bg-green-50", text: "text-green-700" },
    DECLINED: { label: "Declined", bg: "bg-red-50", text: "text-red-700" },
};

export function ContractStatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status] || { label: status, bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    );
}

export function SignerStatusBadge({ status }: { status: string }) {
    const config = SIGNER_STATUS_CONFIG[status] || { label: status, bg: "bg-gray-100", text: "text-gray-600" };

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    );
}
