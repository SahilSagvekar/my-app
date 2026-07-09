// YouTube avatar URLs carry a "=s900-..." size param — the page only
// renders these at ~80px, so requesting 900px wastes bandwidth and is
// what makes them feel slow to load.
export function downsizeAvatarUrl(url: string, size = 160): string {
    return url.replace(/=s\d+-/, `=s${size}-`);
}

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

// Pulls channel name + avatar from a public YouTube channel page's
// og:title / og:image meta tags — no API key needed.
export async function scrapeYoutubeChannelInfo(
    url: string
): Promise<{ name: string | null; avatarUrl: string | null }> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; E8PortfolioBot/1.0)' },
        });
        if (!res.ok) return { name: null, avatarUrl: null };

        const html = await res.text();
        const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/);
        const imageMatch = html.match(/<meta property="og:image" content="([^"]*)"/);

        return {
            name: titleMatch ? decodeHtmlEntities(titleMatch[1]) : null,
            avatarUrl: imageMatch ? downsizeAvatarUrl(imageMatch[1]) : null,
        };
    } catch {
        return { name: null, avatarUrl: null };
    }
}
