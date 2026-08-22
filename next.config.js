/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});
const withNextIntl = require('next-intl/plugin')('./src/lib/i18n/request.ts');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true
  }
};

module.exports = withPWA(withNextIntl(nextConfig));
