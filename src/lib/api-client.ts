/**
 * Cliente API centralizado
 * Proporciona funciones para realizar solicitudes HTTP con soporte para modo demo
 */

/**
 * Verifica si el modo demo está activo
 * @returns {Object} - Información sobre el modo demo
 */
function getDemoMode() {
  if (typeof window === 'undefined') {
    return { active: false, language: null };
  }
  
  const demoMode = sessionStorage.getItem('demoMode') === 'true';
  const demoLang = sessionStorage.getItem('demoLang') || 'es';
  
  if (demoMode) {
    console.log('[API Client] Modo demo activado con idioma:', demoLang);
  }
  
  return {
    active: demoMode,
    language: demoMode ? demoLang : null
  };
}

/**
 * Realiza una solicitud fetch con soporte para modo demo
 * @param {string} url - URL de la solicitud
 * @param {Object} options - Opciones de fetch
 * @returns {Promise<Response>} - Promesa con la respuesta
 */
async function fetchWithDemoSupport(url: string, options: RequestInit = {}): Promise<Response> {
  const { active, language } = getDemoMode();
  
  // Clonar las opciones para no modificar el objeto original
  const newOptions = { ...options };
  
  // Inicializar headers si no existen
  if (!newOptions.headers) {
    newOptions.headers = {};
  }
  
  // Convertir headers a objeto para manipulación
  const headers = newOptions.headers as Record<string, string>;
  
  // Si es modo demo, añadir headers correspondientes
  if (active) {
    // Añadir headers de modo demo
    headers['x-demo-mode'] = 'true';
    
    if (language) {
      headers['x-demo-lang'] = language;
    }
    
    console.log(`[API Client] Solicitud en modo demo a: ${url}`);
    console.log(`[API Client] Headers demo: x-demo-mode=true, x-demo-lang=${language}`);
  }
  
  // Actualizar headers en las opciones
  newOptions.headers = headers;
  
  // Añadir Content-Type si no está definido y el método no es GET
  if (newOptions.method && newOptions.method !== 'GET' && newOptions.body && 
      !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  return fetch(url, newOptions);
}

/**
 * Cliente API con métodos HTTP comunes
 */
const apiClient = {
  /**
   * Realiza una solicitud GET
   * @param {string} url - URL de la solicitud
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  async get<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetchWithDemoSupport(url, {
      ...options,
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`Error en solicitud GET a ${url}: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  },
  
  /**
   * Realiza una solicitud POST
   * @param {string} url - URL de la solicitud
   * @param {any} data - Datos a enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  async post<T = any>(url: string, data: any, options: RequestInit = {}): Promise<T> {
    const response = await fetchWithDemoSupport(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Error en solicitud POST a ${url}: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  },
  
  /**
   * Realiza una solicitud PUT
   * @param {string} url - URL de la solicitud
   * @param {any} data - Datos a enviar
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  async put<T = any>(url: string, data: any, options: RequestInit = {}): Promise<T> {
    const response = await fetchWithDemoSupport(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Error en solicitud PUT a ${url}: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  },
  
  /**
   * Realiza una solicitud DELETE
   * @param {string} url - URL de la solicitud
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<any>} - Datos de la respuesta
   */
  async delete<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetchWithDemoSupport(url, {
      ...options,
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`Error en solicitud DELETE a ${url}: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
};

export default apiClient;
export { fetchWithDemoSupport }; 