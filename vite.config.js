import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: './',
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 2000 },
  plugins: [VitePWA({
    registerType: 'autoUpdate', injectRegister: 'auto',
    includeAssets: ['basis/*', 'assets/**/*'],
    manifest: { name: 'Regresso do Pistoleiro', short_name: 'Pistoleiro', description: 'FPS de rondas num estádio — offline', theme_color: '#0a0c10', background_color: '#0a0c10', display: 'fullscreen', orientation: 'landscape', start_url: './', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,wasm,glb,ktx2,hdr,png,webmanifest,wav,mp3,json}'], maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, navigateFallback: 'index.html', skipWaiting: true, clientsClaim: true, cleanupOutdatedCaches: true, importScripts: ['sw-cleanup.js'] }
  })]
});
