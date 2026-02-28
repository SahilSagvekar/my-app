/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Add these configurations
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',           // Local development
        '127.0.0.1:3000',          // Alternative localhost
        'e8productions.com/',         // Your production domain
        'www.e8productions.com/',     // With www
        // Add more domains if needed (staging, etc.)
      ],
    },
  },
  // Disable static optimization for pages that use cookies/context
  // async headers() {
  //   return [
  //     {
  //       source: '/:path*',
  //       headers: [
  //         {
  //           key: 'Cache-Control',
  //           value: 'no-store, must-revalidate',
  //         },
  //       ],
  //     },
  //   ];
  // },

  async headers() {
    return [
      // 1. API routes — never cache
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0, must-revalidate',
          },
        ],
      },
      // 2. Next.js static assets (JS, CSS, images) — immutable, cached forever
      //    These are fingerprinted by Next.js so they bust cache automatically on deploy
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // 3. Pages — allow browser caching with background revalidation
      //    stale-while-revalidate lets users see cached pages instantly while
      //    the browser re-fetches in the background
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, max-age=0, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.s3.amazonaws.com https://*.amazonaws.com https://ui-avatars.com https://res.cloudinary.com",
              "media-src 'self' blob: https://*.s3.amazonaws.com https://*.amazonaws.com https://res.cloudinary.com",
              "connect-src 'self' https://*.s3.amazonaws.com https://*.amazonaws.com https://res.cloudinary.com",
              "frame-src 'self' https://drive.google.com https://www.youtube.com https://*.s3.amazonaws.com",
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;