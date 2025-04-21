import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Obtener la ruta solicitada
  const path = request.nextUrl.pathname;
  
  // Lista de rutas especiales que deben tratarse como dinámicas
  const dynamicRoutes = [
    '/hybrid',
    '/hybrid-adapter'
  ];
  
  // Marcar rutas específicas como no cacheables
  if (dynamicRoutes.includes(path)) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return response;
  }
  
  return NextResponse.next();
}

// Configurar para que el middleware se ejecute solo en rutas específicas
export const config = {
  matcher: [
    '/hybrid',
    '/hybrid-adapter',
    '/api/:path*'
  ],
}; 