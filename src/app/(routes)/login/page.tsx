'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Cookies from 'js-cookie';
import { getSpotifyAuthUrl } from '@/lib/auth-config';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Verificar si hay un error en los parámetros de búsqueda
  useEffect(() => {
    if (searchParams) {
      const errorMsg = searchParams.get('error');
      if (errorMsg) {
        setError(errorMsg);
      }
    }
  }, [searchParams]);

  const handleSpotifyLogin = () => {
    setIsLoading(true);
    
    // Generar un estado aleatorio para proteger contra ataques CSRF
    const state = Math.random().toString(36).substring(2, 15);
    
    // Guardar el estado en una cookie
    Cookies.set('spotify_auth_state', state, { 
      expires: 1/24, // 1 hora
      path: '/',
      sameSite: 'lax'
    });
    
    // Obtener el client_id de las variables de entorno
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    
    // Verificar que tenemos un client_id válido
    if (!clientId || clientId === 'tu-id-de-cliente-real') {
      setError('Error de configuración: Client ID de Spotify no configurado correctamente. Por favor, actualiza tu archivo .env.local con credenciales válidas.');
      setIsLoading(false);
      return;
    }
    
    // Usar la nueva función para obtener la URL de autenticación
    const authUrl = getSpotifyAuthUrl(state);
    
    // Log para debugging
    console.log('Iniciando autenticación con Spotify', { 
      clientId, 
      state,
      authUrl 
    });
    
    // Redirigir al usuario a la página de autenticación de Spotify
    window.location.href = authUrl;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-900 to-black p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-black/40 p-8 shadow-2xl backdrop-blur-lg">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">MusicVerse</h1>
          <p className="mt-2 text-gray-300">Descubre y disfruta de música sin límites</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-900/60 p-3 text-sm text-white">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          <button
            onClick={handleSpotifyLogin}
            disabled={isLoading}
            className="group relative flex w-full items-center justify-center rounded-md bg-[#1DB954] px-4 py-3 text-sm font-medium text-white hover:bg-[#1ed760] focus:outline-none focus:ring-2 focus:ring-[#1DB954] focus:ring-offset-2 disabled:opacity-70"
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="mr-2 h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Conectando...
              </span>
            ) : (
              <span className="flex items-center">
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Iniciar sesión con Spotify
              </span>
            )}
          </button>
          
          <div className="mt-6 text-center text-sm text-gray-300">
            Al iniciar sesión, aceptas nuestros{' '}
            <Link href="/terms" className="font-medium text-blue-400 hover:text-blue-300">
              Términos de Servicio
            </Link>{' '}
            y{' '}
            <Link href="/privacy" className="font-medium text-blue-400 hover:text-blue-300">
              Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 