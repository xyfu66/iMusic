/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // 开发环境配置
  ...(process.env.NODE_ENV === 'development' && {
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'Access-Control-Allow-Origin',
              value: '*',
            },
          ],
        },
      ];
    },
  }),
};

module.exports = nextConfig;