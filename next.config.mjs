/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Last.fm
      {
        protocol: 'https',
        hostname: 'lastfm.freetls.fastly.net',
      },
      {
        protocol: 'https',
        hostname: 'lastfm-img2.akamaized.net',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Spotify
      {
        protocol: 'https',
        hostname: 'i.scdn.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn-images.dzcdn.net',
      },
      {
        protocol: 'https',
        hostname: 't.scdn.co',
      },
      {
        protocol: 'https',
        hostname: 'charts-images.scdn.co',
      },
      {
        protocol: 'https',
        hostname: 'mosaic.scdn.co',
      },
      {
        protocol: 'https',
        hostname: 'image-cdn-ak.spotifycdn.com',
      },
      {
        protocol: 'https',
        hostname: 'image-cdn-fa.spotifycdn.com',
      },
      {
        protocol: 'https',
        hostname: 'seeded-session-images.scdn.co',
      },
      
      // Deezer
      {
        protocol: 'https',
        hostname: 'e-cdns-images.dzcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'cdns-images.dzcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'api.deezer.com',
      },
      
      // YouTube
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      // YouTube Music
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      
      // Discord (imágenes para desarrollo)
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      
      // Placeholders
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
  // Eliminar console.logs en producción, pero mantener console.error y console.warn
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },
  // Excluir la carpeta musicverse-backend del linting y la compilación
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['src']
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
};

export default nextConfig; 