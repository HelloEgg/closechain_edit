/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    // Ignore the cloned repository directories during build
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules',
        '**/artifacts/**',
        '**/scripts/**',
        '**/_original_repo_lib/**',
      ],
    }
    return config
  },
}

module.exports = nextConfig
