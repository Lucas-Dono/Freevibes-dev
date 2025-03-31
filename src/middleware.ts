import { NextRequest, NextResponse } from 'next/server';

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login', '/register'];
const apiRoutes = ['/api/auth/spotify'];
// Rutas especiales que no deberían ser redirigidas por el middleware
const specialRoutes = ['/explore', '/search', '/library', '/home', '/artist', '/album', '/playlist', '/profile', '/user'];

export default function middleware(req: NextRequest) {
  const hasSpotifyToken = req.cookies.has('spotify_access_token');
  const { pathname } = req.nextUrl;
  
  // Obtener y mostrar todas las cookies para depuración
  const cookieString = req.headers.get('cookie') || '';
  const cookieNames = cookieString.split(';').map(c => c.trim().split('=')[0]);
  
  console.log(`[Middleware] Procesando: ${pathname}`);
  console.log(`[Middleware] Token: ${hasSpotifyToken ? 'Sí' : 'No'}`);
  console.log(`[Middleware] Cookies disponibles: ${cookieNames.join(', ')}`);
  
  // Permitir todas las solicitudes a la API de autenticación
  if (apiRoutes.some(route => pathname.startsWith(route))) {
    console.log(`[Middleware] Permitiendo acceso a API: ${pathname}`);
    return NextResponse.next();
  }
  
  // Verificar si es una ruta pública
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));
  
  // Verificar si es una ruta especial que no debería ser redirigida
  const isSpecialRoute = specialRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
  
  console.log(`[Middleware] Es ruta pública: ${isPublicRoute}`);
  console.log(`[Middleware] Es ruta especial: ${isSpecialRoute}`);
  
  // OPCIÓN ESPECIAL: Para debugging, permitir todas las rutas temporalmente
  // Esto es útil para diagnosticar si el middleware es el problema
  if (isSpecialRoute) {
    console.log(`[Middleware] Permitiendo acceso a ruta especial: ${pathname} (independiente del token)`);
    return NextResponse.next();
  }
  
  // Si no hay token y no es una ruta pública, redirigir a login
  if (!hasSpotifyToken && !isPublicRoute) {
    console.log(`[Middleware] Sin token, redirigiendo a login desde: ${pathname}`);
    const url = new URL('/login', req.url);
    return NextResponse.redirect(url);
  }
  
  // Si hay token y es una ruta pública, redirigir a home
  if (hasSpotifyToken && isPublicRoute) {
    console.log(`[Middleware] Con token en ruta pública, redirigiendo a home desde: ${pathname}`);
    const url = new URL('/home', req.url);
    return NextResponse.redirect(url);
  }
  
  console.log(`[Middleware] Acceso permitido para: ${pathname}`);
  return NextResponse.next();
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