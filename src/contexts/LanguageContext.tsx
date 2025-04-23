'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage, getUserLanguage, setUserLanguage } from '@/lib/i18n';

// Definir la interfaz para el contexto de idioma
interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  isLoading: boolean;
}

// Crear el contexto con valores predeterminados
const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  setLanguage: () => {},
  isLoading: true,
});

// Hook personalizado para usar el contexto de idioma
export const useLanguage = () => useContext(LanguageContext);

// Proveedor del contexto de idioma
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('es');
  const [isLoading, setIsLoading] = useState(true);

  // Efectuar cambio de idioma
  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    setUserLanguage(lang);
  };

  // Detectar el idioma al cargar el componente
  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window !== 'undefined') {
      const detectedLanguage = getUserLanguage();
      setLanguageState(detectedLanguage);
      setIsLoading(false);

    }
  }, []);

  // Escuchar cambios en las cookies para mantener sincronizado el estado
  useEffect(() => {
    const handleStorageChange = () => {
      const newLang = getUserLanguage();
      if (newLang !== language) {
        setLanguageState(newLang);
      }
    };

    // Añadir listener para eventos de cambio en cookies
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageProvider;
