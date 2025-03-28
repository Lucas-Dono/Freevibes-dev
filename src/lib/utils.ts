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