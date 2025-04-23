import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Rutas públicas accesibles sin autenticación
const publicRoutes = [
  '/',
  '/login',
  '/api/auth/login',
  '/api/auth/callback',
  '/api/health',
  '/favicon.ico',
  '/api/spotify/(.*)',
  '/api/status',
  '/_next/(.*)',
  '/static/(.*)',
];

// Rutas permitidas en modo demo sin autenticación
const demoRoutes = [
  '/api/youtube/search',
  '/api/youtube/search-channels',
  '/api/youtube/find-artist-by-name',
  '/api/youtube-music/find-artist-by-name',
  '/api/youtube-channels',
  '/api/featured-playlists',
  '/api/new-releases',
  '/api/genres',
  '/api/recommendations',
  '/api/youtube-artist',
  '/api/youtube/find-track',
  '/api/youtube/spotify-to-youtube',
  '/explore',
  '/explore/(.*)',
  '/api/playlists',
  '/api/recommendations/(.*)',
  '/api/spotify/(.*)',
  '/api/categories',
  '/api/categories/(.*)',
  '/api/auth/session',
  '/api/charts',
  '/api/user/(.*)',
  '/api/genre/(.*)',
  '/search',
  '/api/youtube-music/(.*)',
  '/api/genres/(.*)',
  '/api/songs/(.*)',
  '/api/artists/(.*)',
  '/api/history/(.*)',
  '/api/youtube/(.*)'
];

// Rutas de autenticación
const authRoutes = ['/api/auth/(.*)'];

/**
 * Detecta el idioma preferido del navegador del usuario
 * @param req Solicitud Next.js
 * @returns Código de idioma ('es', 'en', etc.)
 */
function detectLanguage(req: NextRequest): string {
  // Primero verificar si ya hay un idioma establecido en una cookie
  const savedLang = req.cookies.get('userLanguage')?.value;
  if (savedLang) {
    return savedLang;
  }

  // Obtener el encabezado Accept-Language
  const acceptLanguage = req.headers.get('accept-language') || '';

  // Analizar el encabezado para encontrar los idiomas preferidos
  // El formato típico es: 'es-ES,es;q=0.9,en;q=0.8,de;q=0.7'
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      // Dividir por ';' para separar el código de idioma del valor q
      const [code, weight] = lang.trim().split(';');
      // Tomar solo el código de idioma principal (antes del guión)
      const primaryCode = code.split('-')[0];
      return { code: primaryCode, weight: weight ? parseFloat(weight.split('=')[1]) : 1.0 };
    })
    .sort((a, b) => b.weight - a.weight); // Ordenar por peso descendente

  // Si hay idiomas detectados, tomar el primero (el de mayor preferencia)
  if (languages.length > 0) {
    const userLang = languages[0].code;
    // Si el idioma es español o cualquier variante, devolver 'es'
    if (userLang === 'es') {
      return 'es';
    }
    // Para cualquier otro idioma, devolver 'en' (inglés por defecto)
    return 'en';
  }

  // Si no se puede determinar, usar 'en' por defecto
  return 'en';
}

export async function middleware(req: NextRequest) {
  // Obtener la ruta actual
  const { pathname } = req.nextUrl;

  // Detectar el idioma preferido del usuario
  const userLanguage = detectLanguage(req);

  // Crear una respuesta que podemos modificar
  const response = NextResponse.next();

  // Establecer la cookie de idioma si no existe
  if (!req.cookies.has('userLanguage')) {
    response.cookies.set('userLanguage', userLanguage, {
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: '/'
    });
  }

  // Depuración detallada
  console.log(`[Middleware] Procesando ruta: ${pathname} (Idioma: ${userLanguage})`);

  // Verificar si es una ruta pública o recurso estático
  if (publicRoutes.some(route =>
      pathname.startsWith(route) ||
      new RegExp(`^${route}$`).test(pathname) ||
      pathname.includes('.')
  )) {
    console.log(`[Middleware] Ruta pública permitida: ${pathname}`);
    return response;
  }

  // Verificar si es ruta de autenticación
  if (authRoutes.some(route =>
      new RegExp(`^${route}$`).test(pathname)
  )) {
    console.log(`[Middleware] Ruta de autenticación permitida: ${pathname}`);
    return response;
  }

  // Verificar si estamos en modo demo
  const isDemoMode = req.cookies.get('demo-mode')?.value === 'true' || req.cookies.get('demoMode')?.value === 'true';
  console.log(`[Middleware] Estado de modo demo: ${isDemoMode ? 'Activo' : 'Inactivo'}`);

  // Agregar el idioma detectado a los headers para que esté disponible en la aplicación
  response.headers.set('x-user-language', userLanguage);

  // Si estamos en modo demo y es una ruta permitida, actualizar el idioma si es necesario
  if (isDemoMode) {
    const isDemoRoute = demoRoutes.some(route =>
      pathname.startsWith(route) ||
      new RegExp(`^${route}$`).test(pathname)
    );

    if (isDemoRoute) {
      console.log(`[Middleware] Permitiendo acceso a ${pathname} en modo demo (Idioma: ${userLanguage})`);

      // Actualizar idioma de demo si es diferente al detectado
      const demoLang = req.cookies.get('demoLanguage')?.value;
      if (demoLang !== userLanguage) {
        response.cookies.set('demoLanguage', userLanguage, {
          maxAge: 60 * 60 * 24 * 7, // 7 días
          path: '/'
        });
      }

      return response;
    } else {
      console.log(`[Middleware] BLOQUEANDO acceso en modo demo a ${pathname} - No está en la lista de rutas permitidas`);
    }
  }

  // Para rutas protegidas, verificar token de autenticación
  const token = await getToken({ req });

  // Si no hay token, redirigir a login
  if (!token) {
    console.log(`[Middleware] Redirigiendo a login desde ${pathname} - No hay token`);

    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);

    return NextResponse.redirect(url);
  }

  // Si hay token, permitir acceso
  console.log(`[Middleware] Acceso permitido a ${pathname} con token de autenticación (Idioma: ${userLanguage})`);
  return response;
}

// Configurar el middleware para que se ejecute en todas las rutas excepto las estáticas
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

// Configuración para que el middleware se ejecute solo en estas rutas
export const configHybrid = {
  matcher: [
    '/hybrid',
    '/hybrid-adapter',
  ],
};
