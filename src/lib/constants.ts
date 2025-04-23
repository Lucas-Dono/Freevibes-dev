/**
 * Constantes globales para la aplicación
 */

// Timeouts para diferentes tipos de peticiones a APIs (en milisegundos)
export const API_TIMEOUTS = {
  DEFAULT: 15000,        // Timeout general (15 segundos)
  SEARCH: 20000,         // Búsquedas (20 segundos)
  RECOMMENDATIONS: 25000, // Recomendaciones (25 segundos)
  DETAILS: 10000         // Detalles de un elemento específico (10 segundos)
};
