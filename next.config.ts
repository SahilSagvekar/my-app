/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Whitelist Cloudinary for Next.js Image component
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.us-east-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
      },
    ],
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
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://res.cloudinary.com https://*.s3.us-east-1.amazonaws.com https://*.amazonaws.com",
              "media-src 'self' blob: https://res.cloudinary.com https://*.s3.us-east-1.amazonaws.com https://*.amazonaws.com", // 🔥 This allows S3 videos + Cloudinary
              "connect-src 'self' https://res.cloudinary.com https://*.s3.us-east-1.amazonaws.com https://*.amazonaws.com", // 🔥 This allows S3 API calls + Cloudinary
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