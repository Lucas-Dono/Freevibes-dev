'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle } from '@mui/material';
import Link from 'next/link';
import { SpotifyIcon } from '@/components/icons/MusicIcons';
import { useAuth } from '@/components/providers/AuthProvider';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const { isAuthenticated, isDemo, isLoading, toggleDemoMode } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [demoLang, setDemoLang] = useState<string>('es');
  const [isDemoReady, setIsDemoReady] = useState<boolean>(false);

  useEffect(() => {
    // Marcar que el componente está montado
    setIsMounted(true);

    // Establecer la URL actual (seguro solo en el cliente)
    setCurrentUrl(window.location.href);

    // Verificar si hay un error en la URL
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get('error');
    if (error) {
      setAuthError(decodeURIComponent(error));
    }

    // Si el usuario ya está autenticado, redirigir a home
    if (!isLoading && (isAuthenticated || isDemo)) {
      console.log('[LoginPage] Usuario ya autenticado, redirigiendo a home');

      // Evitar redirecciones múltiples
      const lastRedirect = sessionStorage.getItem('lastLoginRedirect');
      const now = Date.now();

      if (lastRedirect && now - parseInt(lastRedirect) < 2000) {
        console.log('[LoginPage] Redirección reciente, omitiendo');
        return;
      }

      sessionStorage.setItem('lastLoginRedirect', now.toString());
      router.push('/home');
    }
  }, [isAuthenticated, isDemo, isLoading, router]);

  // Efecto para habilitar el modo demo automáticamente
  useEffect(() => {
    // Forzar que el modo demo esté siempre disponible
    setIsDemoReady(true);
    console.log('[Login] Modo demo habilitado automáticamente');
  }, []);

  const handleSpotifyLogin = () => {
    signIn('spotify', { callbackUrl: '/home' });
  };

  const handleDemoLogin = () => {
    // Activar modo demo
    toggleDemoMode();
    sessionStorage.setItem('demoLang', demoLang);

    // Establecer también la cookie como respaldo
    document.cookie = `demoMode=true; path=/; max-age=${60 * 60 * 24}`;

    // Establecer el header x-demo-mode para todas las solicitudes fetch como respaldo
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = function(input, init) {
        init = init || {};
        init.headers = init.headers || {};

        // Añadir headers de modo demo
        if (init.headers instanceof Headers) {
          init.headers.set('x-demo-mode', 'true');
          init.headers.set('x-demo-lang', demoLang);
        } else {
          init.headers = {
            ...init.headers,
            'x-demo-mode': 'true',
            'x-demo-lang': demoLang
          };
        }

        return originalFetch(input, init);
      };
      console.log('[LoginPage] Fetch modificado para incluir headers de modo demo');
    }

    // Registrar para evitar redirecciones múltiples
    sessionStorage.setItem('lastLoginRedirect', Date.now().toString());

    // Mostrar mensaje de éxito
    console.log('[LoginPage] Modo demo activado, redirigiendo a home');
    console.log('[LoginPage] Se debe ver el header x-demo-mode: true en las solicitudes');

    // Redireccionar a home
    router.push('/home');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-black p-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">freevibes</h1>
        <p className="text-lg text-gray-300 max-w-md mx-auto">
          Descubre y disfruta de música sin límites
        </p>
      </div>

      {authError && (
        <Alert severity="error" className="mb-6 max-w-md w-full">
          <AlertTitle>Error de autenticación</AlertTitle>
          {authError}
        </Alert>
      )}

      {isAuthenticated && (
        <Alert severity="info" className="mb-6 max-w-md w-full">
          <AlertTitle>Sesión activa</AlertTitle>
          Sesión detectada. Redirigiendo...
        </Alert>
      )}

      <div className="grid gap-4 w-full max-w-md">
        <button
          onClick={handleSpotifyLogin}
          className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-full transition-colors font-medium text-lg"
        >
          <SpotifyIcon className="w-6 h-6" />
          Iniciar sesión con Spotify
        </button>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-black text-gray-400 text-sm">o</span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <select
            value={demoLang}
            onChange={(e) => setDemoLang(e.target.value)}
            className="bg-gray-800 text-white rounded-md px-3 py-2 mb-3 w-full max-w-[150px] border border-gray-700"
            aria-label="Seleccionar idioma para demo"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="it">Italiano</option>
          </select>

          <button
            onClick={handleDemoLogin}
            disabled={!isDemoReady}
            className={`flex items-center justify-center gap-2 w-full bg-purple-700 hover:bg-purple-800 text-white py-3 px-6 rounded-full transition-colors font-medium ${!isDemoReady ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Probar Demo
          </button>
          {!isDemoReady && (
            <p className="text-xs text-red-400 mt-1">El servicio demo no está disponible</p>
          )}
        </div>

        <div className="mt-4 text-center text-sm text-gray-400">
          Al iniciar sesión, aceptas nuestros{' '}
          <Link href="/terms" className="text-blue-400 hover:underline">
            Términos de Servicio
          </Link>{' '}
          y{' '}
          <Link href="/privacy" className="text-blue-400 hover:underline">
            Política de Privacidad
          </Link>
        </div>
      </div>

      {/* Información de diagnóstico - solo renderizar en el cliente */}
      {isMounted && (
        <div className="mt-10 text-xs text-gray-500 w-full max-w-md">
          <details>
            <summary className="cursor-pointer">Información de diagnóstico</summary>
            <pre className="mt-2 p-3 bg-gray-900 rounded overflow-auto">
              {JSON.stringify({
                isAuthenticated,
                isDemo,
                isLoading,
                demo: {
                  ready: isDemoReady,
                  language: demoLang
                }
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
