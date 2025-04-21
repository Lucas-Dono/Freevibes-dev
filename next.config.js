console.log('=============== VARIABLES DE ENTORNO ===============');
console.log('NEXT_PUBLIC_NODE_API_URL:', process.env.NEXT_PUBLIC_NODE_API_URL);
console.log('NEXT_PUBLIC_PYTHON_API_URL:', process.env.NEXT_PUBLIC_PYTHON_API_URL);
console.log('====================================================');

const hybridConfig = require('./src/hybrid-config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Configurar para desarrollo y producción
  output: 'standalone',
  
  // Configuración para evitar pre-renderizado estático de páginas específicas
  experimental: {
    serverComponentsExternalPackages: ['next-auth'],
    // Permitir pre-generación parcial
    isrMemoryCacheSize: 0, // Deshabilitar ISR cache para forzar renderizado dinámico
    // Especificar rutas dinámicas para el App Router
    instrumentationHook: true,
  },
  
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
      
      // YouTube - Ampliado con más dominios y subdominios
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'i1.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'i2.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'i3.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'i4.ytimg.com',
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
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  
  excludeDefaultMomentLocales: true,
  
  typescript: {
    ignoreBuildErrors: true,
  },
  
  swcMinify: true,
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Configurar reescrituras para las rutas
  async rewrites() {
    return [
      // Redirigir a nuestro adaptador para mantener compatibilidad
      {
        source: '/hybrid',
        destination: '/hybrid-adapter',
      },
    ];
  },
  
  // Configuración específica para el directorio pages
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  
  // Configuración para mejorar el rendimiento durante el desarrollo
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Ignorar errores de exportación estática para rutas específicas
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Usar la configuración de hybrid-config
  ...hybridConfig.nextConfig,
};

module.exports = nextConfig; 