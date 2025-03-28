/**
 * Sistema de throttling adaptativo para llamadas a APIs
 * 
 * Este módulo implementa un sistema de throttling que se adapta
 * dinámicamente basado en los resultados de las llamadas a la API,
 * ralentizando automáticamente cuando se detectan errores de rate limiting
 * y acelerando gradualmente cuando las llamadas son exitosas.
 */

// Mapa para rastrear el estado de throttling para cada API
interface ThrottleState {
  lastCallTime: number;
  currentDelay: number;
  consecutiveErrors: number;
  consecutiveSuccesses: number;
}

// Opciones de configuración para el throttling
export interface ThrottleOptions {
  initialDelay: number;  // Retraso inicial entre llamadas (ms)
  maxDelay: number;      // Retraso máximo entre llamadas (ms)
  adaptiveMode?: boolean; // Si se debe ajustar dinámicamente el retraso
  errorMultiplier?: number; // Factor de multiplicación del retraso en caso de error
  successDivisor?: number;  // Factor de división del retraso en caso de éxito
  maxRetries?: number;     // Número máximo de reintentos por llamada
  retryDelay?: number;     // Tiempo entre reintentos (ms)
}

// Estado global de throttling por API
const throttleStates: Record<string, ThrottleState> = {};

// Función auxiliar para esperar
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Aplica throttling adaptativo a una función de API
 * @param fn Función a la que aplicar throttling
 * @param options Opciones de configuración
 * @param apiName Nombre de la API (opcional, para distinguir diferentes APIs)
 * @returns Función con throttling aplicado
 */
export function throttleApiCalls<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: ThrottleOptions,
  apiName: string = 'default'
): T {
  // Valores por defecto
  const {
    initialDelay,
    maxDelay,
    adaptiveMode = true,
    errorMultiplier = 1.5, 
    successDivisor = 1.2,
    maxRetries = 2,
    retryDelay = 1000
  } = options;
  
  // Inicializar estado si no existe
  if (!throttleStates[apiName]) {
    throttleStates[apiName] = {
      lastCallTime: 0,
      currentDelay: initialDelay,
      consecutiveErrors: 0,
      consecutiveSuccesses: 0
    };
  }
  
  // Función wrapper con throttling
  const throttledFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const state = throttleStates[apiName];
    const now = Date.now();
    
    // Calcular tiempo a esperar
    const timeSinceLastCall = now - state.lastCallTime;
    const timeToWait = Math.max(0, state.currentDelay - timeSinceLastCall);
    
    // Esperar si es necesario
    if (timeToWait > 0) {
      await sleep(timeToWait);
    }
    
    // Actualizar tiempo de última llamada
    state.lastCallTime = Date.now();
    
    // Implementar reintentos
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Si no es el primer intento, esperar antes de reintentar
        if (attempt > 0) {
          console.log(`[ThrottleAPI:${apiName}] Reintentando (${attempt}/${maxRetries})...`);
          await sleep(retryDelay * attempt); // Aumentar el tiempo entre reintentos
        }
        
        // Realizar la llamada
        const result = await fn(...args);
        
        // Ajustar el delay en modo adaptativo
        if (adaptiveMode) {
          state.consecutiveSuccesses++;
          state.consecutiveErrors = 0;
          
          // Reducir el delay gradualmente con cada éxito consecutivo
          if (state.consecutiveSuccesses > 5) {
            state.currentDelay = Math.max(
              initialDelay,
              state.currentDelay / successDivisor
            );
          }
        }
        
        return result as ReturnType<T>;
      } catch (error) {
        lastError = error;
        
        // Ajustar el delay en modo adaptativo
        if (adaptiveMode) {
          state.consecutiveErrors++;
          state.consecutiveSuccesses = 0;
          
          // Aumentar el delay con cada error consecutivo
          state.currentDelay = Math.min(
            maxDelay,
            state.currentDelay * errorMultiplier
          );
          
          console.warn(
            `[ThrottleAPI:${apiName}] Error detectado. Aumentando delay a ${state.currentDelay}ms`
          );
        }
      }
    }
    
    // Si llegamos aquí, se agotaron los reintentos
    throw lastError;
  };
  
  return throttledFn as T;
}

export default throttleApiCalls; 