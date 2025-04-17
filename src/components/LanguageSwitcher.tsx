'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { SupportedLanguage, t } from '@/lib/i18n';

// Opciones de idioma disponibles
const languageOptions: Array<{ code: SupportedLanguage; label: string; flag: string }> = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

// Propiedades del componente LanguageSwitcher
interface LanguageSwitcherProps {
  variant?: 'minimal' | 'compact' | 'full';
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'compact',
  className = '',
}) => {
  const { language, setLanguage } = useLanguage();

  // Función para cambiar el idioma
  const handleLanguageChange = (lang: SupportedLanguage) => {
    if (lang !== language) {
      setLanguage(lang);
    }
  };

  // Renderizar variante mínima (solo íconos de banderas)
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {languageOptions.map((option) => (
          <button
            key={option.code}
            onClick={() => handleLanguageChange(option.code)}
            className={`text-xl ${
              language === option.code 
                ? 'opacity-100 scale-110' 
                : 'opacity-50 hover:opacity-80'
            } transition-all duration-200`}
            title={option.label}
            aria-label={`Cambiar a ${option.label}`}
          >
            {option.flag}
          </button>
        ))}
      </div>
    );
  }

  // Renderizar variante compacta (banderas con el actual seleccionado)
  if (variant === 'compact') {
    const currentOption = languageOptions.find(option => option.code === language);
    
    return (
      <div className={`relative group ${className}`}>
        <button
          className="flex items-center space-x-2 px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
        >
          <span>{currentOption?.flag}</span>
          <span className="text-sm font-medium">{currentOption?.label}</span>
        </button>
        
        {/* Menú desplegable */}
        <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg overflow-hidden z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
          {languageOptions.map((option) => (
            <button
              key={option.code}
              onClick={() => handleLanguageChange(option.code)}
              className={`flex items-center space-x-3 w-full px-3 py-2 text-left text-sm ${
                language === option.code 
                  ? 'bg-gray-100 dark:bg-gray-800' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{option.flag}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Renderizar variante completa (botones de texto completo)
  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('settings.language', language)}
      </h3>
      <div className="flex flex-wrap gap-2">
        {languageOptions.map((option) => (
          <button
            key={option.code}
            onClick={() => handleLanguageChange(option.code)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md border ${
              language === option.code 
                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' 
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
            } transition-all duration-200`}
          >
            <span className="text-xl">{option.flag}</span>
            <span className="text-sm font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher; 