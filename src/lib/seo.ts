import type { Metadata } from "next";

const SITE_TITLE = "E8 Productions";
const SITE_DESCRIPTION = "Video production, social media content and digital marketing that helps brands grow.";

function getBaseUrl() {
  // Use the explicit BASE_URL (server-side) if set, otherwise fall back to the public app URL.
  // On Vercel, you can set BASE_URL in your environment variables to your production domain.
  return (
    process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
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
  const resolvedTitle = title ? `${title} | ${SITE_TITLE}` : SITE_TITLE;
  const resolvedDescription = description || SITE_DESCRIPTION;
  const canonicalUrl = pathname
    ? new URL(pathname, baseUrl).toString()
    : baseUrl;

  const openGraphImage = image ? new URL(image, baseUrl).toString() : undefined;

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
      images: openGraphImage ? [{ url: openGraphImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: openGraphImage ? [openGraphImage] : undefined,
    },
    keywords,
    robots: {
      index: true,
      follow: true,
    },
  };
}
