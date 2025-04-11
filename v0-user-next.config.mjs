/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline';
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: blob: https://*;
              font-src 'self';
              connect-src 'self' https://* wss://*;
              frame-src 'self';
            `.replace(/\s{2,}/g, ' ').trim()
          }
        ]
      }
    ]
  }
}

export default nextConfig
