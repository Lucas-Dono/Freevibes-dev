/**
 * Determina el código de país del usuario basado en la configuración del navegador
 * o la preferencia almacenada en localStorage
 * @returns Código de país de 2 letras (ISO 3166-1 alpha-2)
 */
export function getCountryCode(): string {
  try {
    // Primero, verificar si hay una región guardada en localStorage
    const savedRegion = typeof window !== 'undefined' ? localStorage.getItem('user_region') : null;
    if (savedRegion && savedRegion.length === 2) {
      return savedRegion.toUpperCase();
    }
    
    // Intentar obtener el código de país del navegador
    // navigator.language devuelve algo como "es-ES", del cual extraemos "ES"
    const locale = navigator.language || 'en-US';
    const parts = locale.split('-');
    
    // Si el formato es correcto (ej: "es-ES"), usa la segunda parte
    if (parts.length > 1 && parts[1].length === 2) {
      return parts[1].toUpperCase();
    }
    
    // Si no hay guión o el formato es diferente, intentar usar algunos códigos conocidos
    const languageToCountry: { [key: string]: string } = {
      'es': 'ES',
      'en': 'US',
      'fr': 'FR',
      'de': 'DE',
      'it': 'IT',
      'pt': 'PT',
      'ja': 'JP',
      'ko': 'KR',
      'zh': 'CN',
      'ru': 'RU'
    };
    
    // Usar el mapeo si está disponible, o por defecto ES
    return languageToCountry[parts[0]] || 'ES';
  } catch (error) {
    console.error('Error al determinar el código de país:', error);
    // Por defecto, usa España
    return 'ES';
  }
}

/**
 * Establece manualmente la región del usuario
 * @param countryCode Código de país de 2 letras (ISO 3166-1 alpha-2)
 */
export function setUserRegion(countryCode: string): void {
  try {
    if (typeof window !== 'undefined' && countryCode && countryCode.length === 2) {
      localStorage.setItem('user_region', countryCode.toUpperCase());
      console.log(`Región establecida manualmente a: ${countryCode.toUpperCase()}`);
    }
  } catch (error) {
    console.error('Error al guardar la región del usuario:', error);
  }
}

/**
 * Obtiene una URL de miniatura de YouTube con sistema de respaldo
 * Si la miniatura de alta resolución no está disponible, intenta con otras resoluciones
 *
 * @param videoId ID del video de YouTube
 * @param defaultQuality Calidad predeterminada a intentar primero
 * @returns URL de la imagen de miniatura
 */
export function getYoutubeThumbnail(videoId: string, defaultQuality: 'max' | 'hq' | 'mq' | 'sd' = 'max'): string {
  // Verificar si el ID es válido (no debe ser "default" ni un placeholder)
  if (!videoId || videoId === 'default' || videoId.length < 5) {
    console.log(`[UTILS-THUMBNAIL] ID de video inválido: "${videoId}"`);
    return 'https://via.placeholder.com/480x360?text=ID+inválido';
  }

  // Almacén de miniaturas fallidas para no volver a intentar cargarlas
  const THUMBNAIL_CACHE_KEY = 'yt_thumbnail_fallbacks';
  let failedThumbnails: Record<string, string[]> = {};
  
  // Recuperar caché de miniaturas fallidas
  if (typeof window !== 'undefined') {
    try {
      const cache = localStorage.getItem(THUMBNAIL_CACHE_KEY);
      if (cache) {
        failedThumbnails = JSON.parse(cache);
      }
    } catch (e) {
      console.warn('Error al cargar caché de miniaturas:', e);
    }
  }

  // Comprobar si ya tenemos una opción de respaldo para este video
  if (failedThumbnails[videoId]) {
    console.log(`[UTILS-THUMBNAIL] Usando URL en caché para ID "${videoId}": ${failedThumbnails[videoId][0]}`);
    return failedThumbnails[videoId][0]; // Usar la mejor opción disponible
  }

  // Lista de formatos de miniaturas de YouTube en orden de calidad
  const qualityFormats = {
    'max': 'maxresdefault.jpg',    // 1280x720
    'hq': 'hqdefault.jpg',         // 480x360
    'mq': 'mqdefault.jpg',         // 320x180
    'sd': 'sddefault.jpg',         // 640x480
    'default': 'default.jpg'       // 120x90
  };

  // Si el cliente detectó que maxresdefault.jpg falló (error 404),
  // agregarlo a la lista de fallidos y almacenar en localStorage
  const addToFailedThumbnails = (videoId: string, quality: string, fallbackUrl: string) => {
    if (typeof window !== 'undefined') {
      if (!failedThumbnails[videoId]) {
        failedThumbnails[videoId] = [];
      }
      failedThumbnails[videoId].unshift(fallbackUrl);
      console.log(`[UTILS-THUMBNAIL] Agregando URL fallback para ID "${videoId}": ${fallbackUrl}`);
      
      try {
        localStorage.setItem(THUMBNAIL_CACHE_KEY, JSON.stringify(failedThumbnails));
      } catch (e) {
        console.warn('Error al guardar caché de miniaturas:', e);
      }
    }
  };

  // Obtener URL base para las miniaturas
  const baseUrl = `https://i.ytimg.com/vi/${videoId}/`;
  const finalUrl = `${baseUrl}${qualityFormats[defaultQuality] || qualityFormats['hq']}`;
  
  console.log(`[UTILS-THUMBNAIL] Construyendo URL para ID "${videoId}": ${finalUrl}`);
  
  // URL con la calidad solicitada
  return finalUrl;
}

/**
 * Maneja el error de carga de una imagen de YouTube y cambia a una versión de menor calidad
 * 
 * @param event Evento de error de la imagen
 * @param videoId ID del video de YouTube
 * @returns URL de imagen alternativa o null si no hay más opciones
 */
export function handleYoutubeThumbnailError(event: React.SyntheticEvent<HTMLImageElement, Event>, videoId: string): string | null {
  const img = event.currentTarget;
  const currentSrc = img.src;
  
  // Detectar qué calidad falló
  const quality = currentSrc.includes('maxresdefault.jpg') ? 'max' : 
                 currentSrc.includes('sddefault.jpg') ? 'sd' : 
                 currentSrc.includes('hqdefault.jpg') ? 'hq' : 
                 currentSrc.includes('mqdefault.jpg') ? 'mq' : 'default';
  
  console.log(`[UTILS-THUMBNAIL] Error al cargar miniatura para ID "${videoId}" con calidad "${quality}": ${currentSrc}`);
  
  // Determinar la siguiente calidad a probar
  let nextQuality;
  switch(quality) {
    case 'max': nextQuality = 'sd'; break;
    case 'sd': nextQuality = 'hq'; break;
    case 'hq': nextQuality = 'mq'; break;
    case 'mq': nextQuality = 'default'; break;
    default: nextQuality = 'default';
  }
  
  // Si ya estamos en la calidad más baja, usar un placeholder
  if (quality === 'default') {
    console.log(`[UTILS-THUMBNAIL] No hay más calidades para probar. Usando placeholder para ID "${videoId}"`);
    img.src = 'https://via.placeholder.com/480x360?text=No+disponible';
    return null;
  }
  
  // Construir la nueva URL
  const newSrc = `https://i.ytimg.com/vi/${videoId}/${nextQuality === 'default' ? 'default.jpg' : 
             nextQuality === 'mq' ? 'mqdefault.jpg' : 
             nextQuality === 'hq' ? 'hqdefault.jpg' : 'sddefault.jpg'}`;
  
  console.log(`[UTILS-THUMBNAIL] Intentando con calidad "${nextQuality}" para ID "${videoId}": ${newSrc}`);
  
  // Cambiar a la siguiente calidad
  img.src = newSrc;
  return newSrc;
}

/**
 * Formatea un número para mostrar de manera legible con separadores de miles
 * @param number El número a formatear
 * @returns El número formateado como string
 */
export const formatNumber = (number: number): string => {
  // Si es menor a mil, devolver tal cual
  if (number < 1000) {
    return number.toString();
  }
  
  // Para números grandes, usar el formateador de internacionalización
  const formatter = new Intl.NumberFormat('es-ES', {
    notation: number >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  });
  
  return formatter.format(number);
}; 