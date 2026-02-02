
export interface GeoLocation {
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
    isp?: string;
    query?: string; // The IP address
}

/**
 * Fetches geolocation data for a given IP address using ip-api.com
 * Note: ip-api.com has a rate limit of 45 requests per minute for the free tier.
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation | null> {
    if (!ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1') {
        return null;
    }

    try {
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.status === 'fail') return null;

        return {
            city: data.city,
            region: data.regionName,
            country: data.country,
            countryCode: data.countryCode,
            lat: data.lat,
            lon: data.lon,
            timezone: data.timezone,
            isp: data.isp,
            query: data.query
        };
    } catch (error) {
        console.error('[GeoLocation] Error fetching location:', error);
        return null;
    }
}

/**
 * Formats a GeoLocation object into a readable string
 */
export function formatLocation(geo: GeoLocation | null): string {
    if (!geo) return 'Unknown Location';
    const parts = [];
    if (geo.city) parts.push(geo.city);
    if (geo.region) parts.push(geo.region);
    if (geo.country) parts.push(geo.country);
    return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
}
