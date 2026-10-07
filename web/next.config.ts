import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // Each language has its own root layout, so a 404 for any address needs its own page.
  experimental: { globalNotFound: true },
}

export default nextConfig
