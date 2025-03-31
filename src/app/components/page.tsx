import dynamic from 'next/dynamic';

// Importar YouTubePlayer de forma dinámica para evitar errores de SSR
const YouTubePlayer = dynamic(() => import('@/app/components/YouTubePlayer'), {
  ssr: false,
  loading: () => <div className="h-16 bg-gray-800 rounded-md animate-pulse"></div>
});

// El resto del código de la página... 