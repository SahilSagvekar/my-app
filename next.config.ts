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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;