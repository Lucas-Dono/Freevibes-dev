/**
 * Sistema global de throttling para limitar solicitudes API
 *
 * Este módulo implementa un sistema de control de tasa para limitar
 * el número de solicitudes que pueden hacerse a APIs externas desde
 * el cliente, ayudando a prevenir errores 429 (Too Many Requests).
 */

interface RequestTracker {
  lastRequest: number;
  pendingRequests: Set<string>;
  waitQueue: Array<{
    id: string;
    resolve: () => void;
  }>;
}

// Configuración global para diferentes APIs
interface ThrottleConfig {
  minInterval: number;  // Intervalo mínimo entre solicitudes (ms)
  maxParallel: number;  // Máximo número de solicitudes paralelas
  queueTime: number;    // Tiempo máximo en cola antes de cancelar (ms)
}

// Map para tracking de diferentes APIs
const apiTrackers: Record<string, RequestTracker> = {
  // Spotify tiene límites estrictos
  spotify: {
    lastRequest: 0,
    pendingRequests: new Set(),
    waitQueue: []
  },
  // YouTube Music también tiene límites
  youtube: {
    lastRequest: 0,
    pendingRequests: new Set(),
    waitQueue: []
  },
  // API general para otros endpoints
  default: {
    lastRequest: 0,
    pendingRequests: new Set(),
    waitQueue: []
  }
};

// Configuración para diferentes APIs
const apiConfig: Record<string, ThrottleConfig> = {
  spotify: {
    minInterval: 100,    // 100ms entre solicitudes (max 10 por segundo)
    maxParallel: 5,      // máximo 5 solicitudes paralelas
    queueTime: 30000     // 30 segundos máximo en cola
  },
  youtube: {
    minInterval: 200,    // 200ms entre solicitudes (max 5 por segundo)
    maxParallel: 3,      // máximo 3 solicitudes paralelas
    queueTime: 30000     // 30 segundos máximo en cola
  },
  default: {
    minInterval: 50,     // 50ms entre solicitudes
    maxParallel: 10,     // máximo 10 solicitudes paralelas
    queueTime: 15000     // 15 segundos máximo en cola
  }
};

/**
 * Procesa la cola de solicitudes pendientes
 * @param api Nombre de la API
 */
function processQueue(api: string) {
  const tracker = apiTrackers[api] || apiTrackers.default;
  const config = apiConfig[api] || apiConfig.default;

  // Si hay elementos en la cola y espacio para más solicitudes
  if (tracker.waitQueue.length > 0 && tracker.pendingRequests.size < config.maxParallel) {
    const now = Date.now();
    const timeSinceLastRequest = now - tracker.lastRequest;

    // Si ha pasado suficiente tiempo desde la última solicitud
    if (timeSinceLastRequest >= config.minInterval) {
      const next = tracker.waitQueue.shift();
      if (next) {
        tracker.lastRequest = now;
        // Resolver la promesa para permitir que la solicitud continúe
        next.resolve();
      }
    } else {
      // Programar la próxima revisión de la cola
      const waitTime = config.minInterval - timeSinceLastRequest;
      setTimeout(() => processQueue(api), waitTime);
    }
  }
}

/**
 * Espera a que sea seguro realizar una solicitud a la API
 * @param api Nombre de la API ('spotify', 'youtube', o 'default')
 * @param requestId Identificador único para la solicitud
 * @returns Promesa que se resuelve cuando es seguro proceder
 */
export async function waitForTurn(api: string = 'default', requestId: string = `req_${Date.now()}_${Math.random()}`): Promise<void> {
  // Seleccionar el tracker adecuado
  const apiKey = api in apiTrackers ? api : 'default';
  const tracker = apiTrackers[apiKey];
  const config = apiConfig[apiKey];

  // Si no hay muchas solicitudes paralelas actualmente, proceder inmediatamente
  if (tracker.pendingRequests.size < config.maxParallel) {
    const now = Date.now();
    const timeSinceLastRequest = now - tracker.lastRequest;

    if (timeSinceLastRequest >= config.minInterval) {
      // Actualizar el timestamp y registrar esta solicitud
      tracker.lastRequest = now;
      tracker.pendingRequests.add(requestId);
      return;
    }
  }

  // Si necesitamos esperar, agregar a la cola
  return new Promise((resolve, reject) => {
    // Crear una referencia para poder cancelar la solicitud después
    const queuedRequest = {
      id: requestId,
      resolve: () => {
        tracker.pendingRequests.add(requestId);
        resolve();
      }
    };

    // Agregar a la cola
    tracker.waitQueue.push(queuedRequest);

    // Configurar un timeout para evitar esperas demasiado largas
    const timeout = setTimeout(() => {
      // Eliminar de la cola si aún está esperando
      const index = tracker.waitQueue.findIndex(req => req.id === requestId);
      if (index >= 0) {
        tracker.waitQueue.splice(index, 1);
        reject(new Error(`La solicitud ${requestId} ha excedido el tiempo máximo de espera`));
      }
    }, config.queueTime);

    // Iniciar procesamiento de la cola
    processQueue(apiKey);
  });
}

/**
 * Marca una solicitud como completada
 * @param api Nombre de la API
 * @param requestId Identificador de la solicitud
 */
export function releaseRequest(api: string = 'default', requestId: string): void {
  const apiKey = api in apiTrackers ? api : 'default';
  const tracker = apiTrackers[apiKey];

  // Eliminar del conjunto de solicitudes pendientes
  tracker.pendingRequests.delete(requestId);

  // Procesar la siguiente solicitud en la cola
  processQueue(apiKey);
}

/**
 * Envuelve una función para aplicar throttling
 * @param fn Función a envolver
 * @param api Nombre de la API
 * @param options Opciones adicionales de throttling (opcional)
 * @returns Función con throttling aplicado
 */
export function withThrottle<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  api: string = 'default',
  options?: any
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const requestId = `req_${Date.now()}_${Math.random()}`;
    try {
      await waitForTurn(api, requestId);
      const result = await fn(...args);
      return result;
    } finally {
      releaseRequest(api, requestId);
    }
  };
}
