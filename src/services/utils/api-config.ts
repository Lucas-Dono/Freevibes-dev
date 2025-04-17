/**
 * Utilidades para la configuración de APIs
 */

/**
 * Obtiene la URL base de la API
 * @returns URL base de la API
 */
export function getApiBaseUrl() {
  // Usar la variable de entorno definida en el archivo .env de la raíz
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api`;
  }
  
  // Si no está definida la variable de entorno, usar el puerto actual del navegador
  if (typeof window !== 'undefined' && window.location) {
    // Obtener el puerto actual del navegador
    const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    // Construir la URL base con el puerto actual
    return `${window.location.protocol}//${window.location.hostname}:${currentPort}/api`;
  }
  
  // Valor por defecto
  return '/api';
} 