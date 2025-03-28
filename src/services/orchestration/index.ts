/**
 * Índice de servicios de orquestación
 * 
 * Este módulo exporta los servicios de orquestación de carga
 * para gestionar la priorización de contenido y optimización de API.
 */

import { loadOrchestrator, LoadOrchestrator, SectionType, PageType } from './load-orchestrator';

// Exportamos el orquestador de carga para uso en la aplicación
export { loadOrchestrator, LoadOrchestrator };
export type { SectionType, PageType };

// Exportar por defecto para facilitar la importación
export default loadOrchestrator; 