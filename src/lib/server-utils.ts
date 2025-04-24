/**
 * Utilidades para verificar la disponibilidad de servicios backend
 */
import { env } from '@/env.mjs'; // Importar env

/**
 * Verifica si el servidor Node está disponible
 * @returns Promise<boolean> - true si el servidor está disponible
 */
export async function isNodeServerAvailable(): Promise<boolean> {
  // Usar la URL base de env.mjs
  const url = env.NODE_SERVER_URL;

  // Intentar primero con el endpoint /status
  try {
    console.log(`[Status Check] Verificando Node Server en: ${url}/status`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Llamar directamente al endpoint /status del servidor Node
    const response = await fetch(`${url}/status`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors' // Asegurar CORS para llamadas cross-origin
    });

    clearTimeout(timeoutId);

    console.log(`[Status Check] Respuesta de Node Server: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      // Verificar que la respuesta sea del servidor Node
      if (data?.status === 'OK' || data?.status === 'ok' || data?.server === 'node') {
        return true;
      }
    }
  } catch (error: any) {
    console.warn(`[Status Check] Servidor Node no disponible en ${url}/status:`, error.message || error);
  }

  // Si el primer intento falló, probar con el endpoint raíz
  try {
    console.log(`[Status Check] Verificando Node Server (alternativo) en: ${url}/`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${url}/`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    });

    clearTimeout(timeoutId);

    console.log(`[Status Check] Respuesta alternativa de Node Server: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      return (data?.status === 'OK' || data?.status === 'ok' || data?.message?.includes('running'));
    }
  } catch (error: any) {
    console.warn(`[Status Check] Servidor Node no disponible en ${url}/:`, error.message || error);
  }

  // Como último recurso, intentar con la ruta de API
  try {
    console.log(`[Status Check] Verificando Node Server (última prueba) en: ${url}/api/`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${url}/api/`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    });

    clearTimeout(timeoutId);

    console.log(`[Status Check] Respuesta final de Node Server: ${response.status}`);
    return response.ok;
  } catch (error: any) {
    console.warn(`[Status Check] Servidor Node no disponible en ninguna ruta:`, error.message || error);
    return false;
  }
}

/**
 * Verifica si la API de Python está disponible
 * @returns Promise<boolean> - true si la API está disponible
 */
export async function isPythonApiAvailable(): Promise<boolean> {
  // Usar la URL base de env.mjs
  const url = env.PYTHON_API_URL;

  // Intentar primero con el endpoint /status
  try {
    console.log(`[Status Check] Verificando Python API en: ${url}/status`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Llamar directamente al endpoint /status del servidor Python
    const response = await fetch(`${url}/status`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors' // Asegurar CORS para llamadas cross-origin
    });

    clearTimeout(timeoutId);

    console.log(`[Status Check] Respuesta de Python API: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      // Verificar la respuesta, aceptando cualquiera de los formatos posibles
      // El endpoint real de Python devuelve data.status = 'ok' (minúsculas)
      if ((data?.status === 'OK' || data?.status === 'ok') && 
         (data?.server === 'python' || data?.ytmusic_available === true || data?.service === 'Python API')) {
        return true;
      }
    }
  } catch (error: any) {
    console.warn(`[Status Check] API Python no disponible en ${url}/status:`, error.message || error);
  }

  // Si el primer intento falló, probar con el endpoint /api
  try {
    console.log(`[Status Check] Verificando Python API (alternativo) en: ${url}/api`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${url}/api`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    });

    clearTimeout(timeoutId);

    console.log(`[Status Check] Respuesta alternativa de Python API: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      return (data?.status === 'OK' || data?.status === 'ok' || data?.service === 'Python API');
    }
  } catch (error: any) {
    console.warn(`[Status Check] API Python no disponible en ${url}/api:`, error.message || error);
  }

  // Como último recurso, intentar con una búsqueda simple
  try {
    console.log(`[Status Check] Verificando Python API (última prueba) en: ${url}/api/search?query=test&limit=1`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${url}/api/search?query=test&limit=1`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    });

    clearTimeout(timeoutId);

    console.log(`[Status Check] Respuesta final de Python API: ${response.status}`);
    return response.ok;
  } catch (error: any) {
    console.warn(`[Status Check] API Python no disponible en ninguna ruta:`, error.message || error);
    return false;
  }
}

/**
 * Verifica si el servidor de demo está disponible y cargado
 * @returns Promise<boolean> - true si el servidor de demo está disponible
 */
export async function isDemoAvailable(): Promise<boolean> {
  try {
    console.log(`[Status Check] Verificando Demo Status en: /api/demo/status`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Esta llamada sí va a una API route de Next.js
    const response = await fetch('/api/demo/status', {
        method: 'GET',
        signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log(`[Status Check] Respuesta de Demo Status: ${response.status}`);
    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data?.available === true;
  } catch (error: any) {
    console.warn('[Status Check] Servidor demo no disponible:', error.message || error);
    return false;
  }
}
