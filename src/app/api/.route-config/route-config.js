// Configuración global para todas las rutas API en el directorio app/api
// Forzar renderizado en el servidor y dynamic para todas las rutas

export const dynamic = 'force-dynamic';
export const revalidate = 0; // No guardar en caché
export const fetchCache = 'force-no-store';

export const runtime = 'nodejs'; // Usar Node.js runtime 