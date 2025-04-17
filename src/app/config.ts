// Asegura que todas las rutas se generen de forma dinámica en tiempo de ejecución
// en lugar de ser pre-renderizadas estáticamente durante la construcción.
// Esto evita los errores de "Cannot read properties of null (reading 'useContext')"
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

// Exportar cualquier otra configuración global necesaria
export const APP_NAME = 'FreeVibes';
export const APP_VERSION = '1.0.0'; 