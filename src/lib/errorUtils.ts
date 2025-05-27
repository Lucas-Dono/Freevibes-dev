import React, { Component, ErrorInfo, ReactNode } from 'react';

// Original console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Variable para modo debug
let debugMode = false;

// Lista de mensajes de error a ignorar
const ignoredMessages = [
  'validateDOMNesting',
  'cannot appear as a descendant of',
  'Warning: Each child in a list',
  'Warning: React does not recognize the',
  'Warning: Failed prop type'
];

// Patrones de log a ignorar
const ignoredLogPatterns = [
  '[Debug]',
  'PlayerBar rendering',
  'PlayerBar: togglePlay',
  'YouTube player is',
  'togglePlay llamado',
  'rendering with currentTrack',
  'Toggling expanded view',
  'Seeking to:',
  'duration: undefined',
];

// Función para suprimir mensajes de error específicos
export const suppressConsoleMessages = () => {
  // Sobrescribir console.error
  console.error = (...args: any[]) => {
    // Si el mensaje contiene alguna de las palabras clave a ignorar, no mostrarlo
    if (args.length > 0 && typeof args[0] === 'string') {
      const message = args[0];
      if (ignoredMessages.some(ignored => message.includes(ignored))) {
        return;
      }
    }
    originalConsoleError.apply(console, args);
  };

  // Sobrescribir console.warn
  console.warn = (...args: any[]) => {
    // Igual lógica para advertencias
    if (args.length > 0 && typeof args[0] === 'string') {
      const message = args[0];
      if (ignoredMessages.some(ignored => message.includes(ignored))) {
        return;
      }
    }
    originalConsoleWarn.apply(console, args);
  };
};

// Función para restaurar los métodos originales de la consola
export const restoreConsoleMessages = () => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
};

// Función para habilitar/deshabilitar el modo debug
export const setDebugMode = (enabled: boolean) => {
  debugMode = enabled;
  if (enabled) {
    // En modo debug, mostramos todos los mensajes
    restoreConsoleMessages();
  } else {
    // En modo normal, suprimimos los mensajes de debug
    suppressConsoleMessages();
    originalConsoleLog('Modo debug DESACTIVADO - Se ocultarán mensajes de diagnóstico');
  }
};

// Componente ErrorBoundary para capturar errores de React
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Solo registramos el error si estamos en modo debug
    if (debugMode) {
      originalConsoleLog('Componente con error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Puedes mostrar una UI de fallback o simplemente el children para ocultar el error
      return this.props.fallback || this.props.children;
    }

    return this.props.children;
  }
}
