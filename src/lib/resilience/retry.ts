export async function fetchConReintentos(url: string, opciones: RequestInit, maxReintentos = 3): Promise<Response> {
  let reintentos = 0;
  let ultimoError: any;
  
  while (reintentos <= maxReintentos) {
    try {
      const response = await fetch(url, opciones);
      
      // Para errores 404, podríamos reintentar ya que Spotify tiene problemas intermitentes
      if (response.status === 404) {
        if (reintentos < maxReintentos) {
          reintentos++;
          
          // Esperar con backoff exponencial: 1s, 2s, 4s...
          await new Promise(r => setTimeout(r, Math.pow(2, reintentos) * 1000));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      ultimoError = error;
      reintentos++;
      
      if (reintentos > maxReintentos) break;
      
      console.warn(`Error en fetchConReintentos (${reintentos}/${maxReintentos}): ${error instanceof Error ? error.message : 'Error desconocido'}`);
      await new Promise(r => setTimeout(r, Math.pow(2, reintentos) * 1000));
    }
  }
  
  throw ultimoError || new Error(`Máximo número de reintentos (${maxReintentos}) alcanzado para ${url}`);
} 