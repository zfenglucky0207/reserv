/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Server Actions body size limit configuration
  // Note: In Next.js 16+, bodySizeLimit is handled differently
  // Using experimental.serverActions for backward compatibility
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increase limit for cover image uploads (base64 data URLs can be large)
    },
  },
}

export default nextConfig
