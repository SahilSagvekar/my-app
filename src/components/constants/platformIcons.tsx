import type { IconType } from "react-icons";
import {
  FaInstagram,
  FaTiktok,
  FaFacebook,
  FaYoutube,
  FaTwitter,
  FaLinkedin,
  FaSnapchat,
} from "react-icons/fa";

// Single source of truth for social platform branding.
//
// The app had these spread across three places with different answers:
// Sociallogins.tsx used react-icons brand glyphs, dashboards/scheduler/icons.tsx
// had its own lucide-based map, and Postedcontentsidebar.tsx imported lucide
// directly. The react-icons set wins because they're the real brand marks and
// because lucide ships no TikTok or Snapchat icon at all.
//
// Colors are kept identical to Sociallogins.tsx so nothing shifts where those
// icons already appear.

export interface PlatformMeta {
  /** Display name, e.g. for tooltips and aria labels. */
  label: string;
  /** Short form used where space is tight. */
  abbrev: string;
  Icon: IconType;
  /** Tailwind text color class carrying the brand color. */
  color: string;
}

const PLATFORM_META: Record<string, PlatformMeta> = {
  instagram: { label: "Instagram", abbrev: "IG", Icon: FaInstagram, color: "text-pink-500" },
  tiktok: { label: "TikTok", abbrev: "TT", Icon: FaTiktok, color: "text-gray-900" },
  facebook: { label: "Facebook", abbrev: "FB", Icon: FaFacebook, color: "text-blue-600" },
  youtube: { label: "YouTube", abbrev: "YT", Icon: FaYoutube, color: "text-red-600" },
  twitter: { label: "X", abbrev: "X", Icon: FaTwitter, color: "text-sky-500" },
  x: { label: "X", abbrev: "X", Icon: FaTwitter, color: "text-sky-500" },
  linkedin: { label: "LinkedIn", abbrev: "LI", Icon: FaLinkedin, color: "text-blue-700" },
  snapchat: { label: "Snapchat", abbrev: "SC", Icon: FaSnapchat, color: "text-yellow-400" },
};

/**
 * Look up branding for a platform name. Tolerates the casing variations the API
 * returns ("TikTok" / "Tiktok", "YouTube" / "Youtube"). Returns null for
 * anything unrecognized so callers can fall back to plain text.
 */
export function getPlatformMeta(platform: string): PlatformMeta | null {
  if (!platform) return null;
  return PLATFORM_META[platform.trim().toLowerCase()] ?? null;
}
