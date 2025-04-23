import "./globals.css";
import { Inter } from "next/font/google";
import ClientLayout from '@/components/ClientLayout';
import { PlayerProvider } from '@/contexts/PlayerContext';
import ClientWrapper from '@/components/ClientWrapper';
import { cookies, headers } from 'next/headers';
import { APP_NAME } from '@/app/config';
// Inicializar las claves API al cargar la aplicación
import '@/lib/api-keys-init';
import Script from 'next/script';
import { NotificationProvider } from '@/contexts/NotificationContext';
// Import ServerProvider
import { ServerProvider } from '@/context/ServerContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: APP_NAME,
  description: 'Reproductor de música integrado con YouTube',
};

/**
 * Detecta el idioma del usuario desde las cookies en el servidor
 * @returns El código de idioma ('es' o 'en')
 */
function detectUserLanguage(): string {
  // Intentar obtener desde la cookie del servidor
  const cookieStore = cookies();
  const userLanguage = cookieStore.get('userLanguage')?.value;

  // Si existe una cookie, usarla
  if (userLanguage === 'es' || userLanguage === 'en') {
    return userLanguage;
  }

  // Si no hay cookie, intentar obtener del header Accept-Language
  const headersList = headers();
  const acceptLanguage = headersList.get('accept-language') || '';

  // Detectar si es español como primera preferencia
  if (acceptLanguage.startsWith('es') || acceptLanguage.includes('es-')) {
    return 'es';
  }

  // Por defecto, usar inglés para cualquier otro idioma
  return 'en';
}

// Obtener claves API para exponerlas al cliente
function getYouTubeApiKeys() {
  const keys: string[] = [];

  // Buscar las claves de YouTube API
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`YOUTUBE_API_KEY_${i}`];
    if (key) keys.push(key);
  }

  // Devolver como string JSON
  return JSON.stringify(keys);
}

// Forzar renderizado dinámico para evitar problemas con contextos
export const dynamicParams = true;
export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Detectar el idioma del usuario para la etiqueta html
  const userLanguage = detectUserLanguage();
  const youtubeApiKeys = getYouTubeApiKeys();

  return (
    <html lang={userLanguage}>
      <head>
        {/* Script para exponer las claves API al cliente */}
        <Script id="youtube-api-keys" strategy="beforeInteractive">
          {`window.YOUTUBE_API_KEYS = ${youtubeApiKeys};
            console.log('[Environment] Cargadas ' + ${youtubeApiKeys}.length + ' claves API YouTube');`}
        </Script>

        {/* No cargar el script de YouTube aquí, ahora lo hace YouTubeInitializer */}
      </head>
      <body className={inter.className}>
        <NotificationProvider>
          <PlayerProvider>
            {/* Wrap ClientWrapper with ServerProvider */}
            <ServerProvider>
              <ClientWrapper>
                {children}
              </ClientWrapper>
            </ServerProvider>
          </PlayerProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}

// Componente para diagnóstico de navegación
function NavigationDebugger() {
  // Solo ejecutar en el cliente
  if (typeof window !== 'undefined') {
    console.log('[Debug] Ruta actual:', window.location.pathname);

    // Modificar los métodos de navegación para registrar cambios
    try {
      const originalPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        console.log('[Debug] Navegación a:', args[2]);
        return originalPushState.apply(window.history, args);
      };

      // Escuchar cambios de ruta
      window.addEventListener('popstate', () => {
        console.log('[Debug] Navegación con popstate a:', window.location.pathname);
      });
    } catch (e) {
      console.error('[Debug] Error al configurar diagnóstico de navegación:', e);
    }
  }

  return null;
}
