/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@repo/shared'],
    images: {
    remotePatterns: [ {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    {
        protocol: "http",
        hostname: "localhost",
        port: "3001",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
