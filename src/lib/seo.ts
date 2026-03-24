import type { Metadata } from "next";

const SITE_TITLE = "E8 Productions";
const SITE_DESCRIPTION =
  "End-to-end social media and content solutions for modern businesses. From strategy and video production to editing, posting, and distribution.";
const PRODUCTION_URL = "https://www.e8productions.com";
const DEFAULT_OG_IMAGE = "/public/image.png"; // Place a 1200x630 image at public/og-image.jpg

function getBaseUrl(): string {
  // In production, always use the production URL
  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_URL;
  }
  // In development, use env vars or fallback to localhost
  return (
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export function buildMetadata({
  title,
  description,
  pathname,
  keywords,
  image,
}: {
  title?: string;
  description?: string;
  pathname?: string;
  keywords?: string[];
  image?: string;
}): Metadata {
  const baseUrl = getBaseUrl();
  
  // Title: "Page Title | E8 Productions" or just "E8 Productions"
  const resolvedTitle = title
    ? title.includes(SITE_TITLE)
      ? title
      : `${title} | ${SITE_TITLE}`
    : SITE_TITLE;
  
  const resolvedDescription = description || SITE_DESCRIPTION;
  
  // Canonical URL
  const canonicalUrl = pathname
    ? new URL(pathname, baseUrl).toString()
    : baseUrl;

  // OG Image - use provided image or default, always as absolute URL
  const imagePath = image || DEFAULT_OG_IMAGE;
  const openGraphImage = imagePath.startsWith("http")
    ? imagePath
    : new URL(imagePath, baseUrl).toString();

  return {
    metadataBase: new URL(baseUrl),
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonicalUrl,
      siteName: SITE_TITLE,
      type: "website",
      locale: "en_US",
      images: [
        {
          url: openGraphImage,
          width: 1200,
          height: 630,
          alt: resolvedTitle,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: [
        {
          url: openGraphImage,
          width: 1200,
          height: 630,
          alt: resolvedTitle,
        },
      ],
      creator: "@e8productions", // Update with actual Twitter handle
      site: "@e8productions",
    },
    keywords: keywords || [
      "video production",
      "social media management",
      "content strategy",
      "video editing",
      "digital marketing",
      "brand growth",
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    authors: [{ name: "E8 Productions", url: PRODUCTION_URL }],
    creator: "E8 Productions",
    publisher: "E8 Productions",
  };
}