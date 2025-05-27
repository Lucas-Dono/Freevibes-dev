'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { t, SupportedLanguage } from '@/lib/i18n';

/**
 * Hook personalizado para obtener traducciones según el idioma actual
 * @returns Objeto con funciones para traducir textos
 */
export function useTranslation() {
  const { language } = useLanguage();

  /**
   * Traduce una clave al idioma actual
   * @param key Clave de traducción en formato 'categoria.subcategoria.texto'
   * @returns Texto traducido
   */
  const translate = (key: string): string => {
    return t(key, language);
  };

  /**
   * Traduce texto con variables
   * @param key Clave de traducción
   * @param params Objeto con variables a reemplazar en el texto
   * @returns Texto traducido con variables reemplazadas
   */
  const translateWithVars = (key: string, params: Record<string, string | number>): string => {
    let translatedText = translate(key);

    // Reemplazar variables en el formato {{variable}}
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      translatedText = translatedText.replace(
        new RegExp(`{{${paramKey}}}`, 'g'),
        String(paramValue)
      );
    });

    return translatedText;
  };

  /**
   * Obtiene el código de idioma actual
   * @returns Código de idioma ('es', 'en')
   */
  const getCurrentLanguage = (): SupportedLanguage => {
    return language;
  };

  return {
    t: translate,
    tVars: translateWithVars,
    language: getCurrentLanguage(),
  };
}
