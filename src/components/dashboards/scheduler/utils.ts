// Helper: format a posting time to ensure AM/PM is displayed
export const formatPostingTime = (timeStr: string): string => {
    // If already has AM/PM, just return it cleaned up
    const matchAmPm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (matchAmPm) {
        return `${matchAmPm[1]}:${matchAmPm[2]} ${matchAmPm[3].toUpperCase()}`;
    }
    // Handle 24h format (e.g., "14:00" -> "2:00 PM")
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
        let h = parseInt(match24[1], 10);
        const period = h >= 12 ? "PM" : "AM";
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;
        return `${h}:${match24[2]} ${period}`;
    }
    // Fallback: return as-is
    return timeStr;
};

// Helper: format array of posting times
export const formatPostingTimes = (times: string[]): string => {
    if (!times || times.length === 0) return "";
    return times.map(formatPostingTime).join(", ");
};

export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
