/**
 * Configuración de rutas dinámicas para Next.js
 * Este archivo permite declarar explícitamente las rutas que deben ser consideradas como dinámicas
 * y no ser incluidas en la exportación estática.
 */

// Lista de rutas del directorio "pages" que deben ser siempre dinámicas
export const DYNAMIC_PAGE_ROUTES = [
  '/hybrid', // Página del reproductor híbrido
];

// Lista de rutas del directorio "app" que deben ser siempre dinámicas
export const DYNAMIC_APP_ROUTES = [
  '/api/spotify',
  '/api/youtube',
  '/api/search',
  '/api/combined',
  '/api/favorite',
  '/api/playlist',
  '/hybrid-adapter',
];

// Función auxiliar para verificar si una ruta debe ser dinámica
export function isDynamicRoute(route: string): boolean {
  // Limpiar la ruta para comparación consistente
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  
  // Verificar rutas exactas
  if (DYNAMIC_PAGE_ROUTES.includes(normalizedRoute) || DYNAMIC_APP_ROUTES.includes(normalizedRoute)) {
    return true;
  }
  
  // Verificar rutas que comienzan con algún prefijo dinámico
  const allDynamicRoutes = [...DYNAMIC_PAGE_ROUTES, ...DYNAMIC_APP_ROUTES];
  return allDynamicRoutes.some(dynamicRoute => 
    normalizedRoute.startsWith(dynamicRoute + '/'));
}

// Exportar configuración por defecto
export default {
  DYNAMIC_PAGE_ROUTES,
  DYNAMIC_APP_ROUTES,
  isDynamicRoute
}; 