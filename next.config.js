/** @type {import('next').NextConfig} */
module.exports = {
  images: {
    domains: ['*'],
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        pathname: '/s/files/**'
      }
    ]
  },
  compilerOptions: {
    resolveJsonModule: true,
    esModuleInterop: true,
  }
};
