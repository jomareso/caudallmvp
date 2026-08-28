/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Inyecta el manejo de notificaciones push (public/push-worker.js) dentro
  // del service worker que Workbox genera — no se edita public/sw.js a
  // mano porque es un artefacto de build (ver comentario en ese archivo).
  importScripts: ['/push-worker.js'],
  // next-pwa (v5.6.0, anterior al App Router) agrega app-build-manifest.json
  // al precache con URL /_next/app-build-manifest.json — un artefacto
  // interno de build (vive en .next/, nunca se sirve como ruta pública en
  // el App Router). Workbox aborta la instalación completa del service
  // worker si CUALQUIER entrada del precache no se puede descargar, así
  // que ese único 404 dejaba el service worker en estado "redundant" para
  // siempre (verificado: sin esto, ni el PWA install prompt ni las
  // notificaciones push llegaban a funcionar, pese a que /sw.js y
  // manifest.json se generaban y servían bien).
  buildExcludes: [/app-build-manifest\.json$/]
});
const withNextIntl = require('next-intl/plugin')('./src/lib/i18n/request.ts');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true
  },
  // La landing empleador se movió de /empresas a / (dominio raíz —
  // decisión de Reynoso, modelo B2B2C). Redirect permanente para no
  // romper el link si alguien ya lo compartió.
  async redirects() {
    return [{ source: '/empresas', destination: '/', permanent: true }];
  }
};

module.exports = withPWA(withNextIntl(nextConfig));
