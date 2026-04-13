/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Ignore errors from cloned repository lib directories during build
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.json',
  },
  // Empty turbopack config to acknowledge we're using Turbopack in Next.js 16
  turbopack: {},
  // Exclude cloned repository directories from build
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'lib/replit-auth-web',
        'lib/integrations-openai-ai-server',
        'lib/integrations-openai-ai-react',
        'lib/api-client-react',
        'lib/api-zod',
        'lib/db',
        'lib/object-storage-web',
        'artifacts',
        '_backup_repo',
        '_original_repo_lib',
      ],
    },
  },
}

module.exports = nextConfig
