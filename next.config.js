/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Empty turbopack config to acknowledge we're using Turbopack in Next.js 16
  turbopack: {},
}

module.exports = nextConfig
