'use client';

import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_CONFIG } from '@/config/api-config';
import { isNodeServerAvailable, isPythonApiAvailable } from '@/lib/server-utils';

// Definir tipos
type ServerType = 'node' | 'python' | 'both';

interface ServerStatus {
  node: boolean;
  python: boolean;
}

interface ServerContextType {
  isServerLoading: boolean;
  serverType: ServerType;
  serverStatus: ServerStatus;
  checkServerStatus: () => Promise<boolean>;
  setServerLoading: (isLoading: boolean, type?: ServerType) => void;
  hasBeenActive: boolean;
}

// Tiempo mínimo entre verificaciones (5 segundos)
const MIN_CHECK_INTERVAL = 5000;

export const ServerContext = createContext<ServerContextType>({
  serverStatus: {
    node: false,
    python: false
  },
  serverType: 'both',
  isServerLoading: true,
  checkServerStatus: async () => false,
  setServerLoading: () => {},
  hasBeenActive: false,
});

// Hook personalizado para usar el contexto
export const useServerStatus = () => useContext(ServerContext);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    node: false,
    python: false
  });
  const [isServerLoading, setIsServerLoading] = useState<boolean>(true);
  const [serverType, setServerType] = useState<ServerType>('both');
  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const [hasBeenActive, setHasBeenActive] = useState<boolean>(false);

  // Mostrar información sobre las URLs configuradas
  useEffect(() => {
    console.log('[Server Context] URLs configuradas:');
    console.log(' - FRONTEND_URL:', API_CONFIG.FRONTEND_URL);
    console.log(' - NODE_API_URL:', API_CONFIG.NODE_API_URL);
    console.log(' - PYTHON_API_URL:', API_CONFIG.PYTHON_API_URL);
    console.log(' - Variables directas:');
    console.log('   * NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
    console.log('   * NEXT_PUBLIC_NODE_API_URL:', process.env.NEXT_PUBLIC_NODE_API_URL);
    console.log('   * NEXT_PUBLIC_PYTHON_API_URL:', process.env.NEXT_PUBLIC_PYTHON_API_URL);
  }, []);

  // Función para verificar el estado del servidor con throttling
  const checkServerStatus = async (): Promise<boolean> => {
    const now = Date.now();

    // Si alguna vez estuvo activo y no estamos en modo de carga,
    // no es necesario verificar de nuevo
    if (hasBeenActive && !isServerLoading) {
      console.log('[Server Context] Servidores previamente activos, omitiendo verificación');
      return true;
    }

    // Implementar throttling para evitar verificaciones excesivas
    if (now - lastCheckTime < MIN_CHECK_INTERVAL) {
      console.log('[Server Context] Verificación reciente, usando estado en caché');
      return serverStatus.node || serverStatus.python;
    }

    setLastCheckTime(now);

    try {
      console.log('[Server Context] Verificando estado de servidores con server-utils...');

      // Usar las funciones de server-utils
      const nodeActive = await isNodeServerAvailable();
      const pythonActive = await isPythonApiAvailable();

      console.log('[Server Context] Estado de servidores - Node:', nodeActive, 'Python:', pythonActive);

      setServerStatus({
        node: nodeActive,
        python: pythonActive
      });

      // Si al menos uno de los servidores está activo, marcarlo como activo permanentemente
      if (nodeActive || pythonActive) {
        setHasBeenActive(true);
        // Si al menos un servidor está activo y el usuario ya pasó por la pantalla de carga,
        // desactivar la pantalla de carga
        if (!isServerLoading) {
          console.log('[Server Context] Servidor activo después de inactividad, saltando pantalla de carga');
        }
      }

      return nodeActive || pythonActive;
    } catch (error) {
      // Aquí podrías manejar errores generales si las funciones isNodeServerAvailable/isPythonApiAvailable lanzan excepciones
      // Por ahora, asumimos que devuelven false en caso de error interno y ya lo logean.
      console.error('[Server Context] Error inesperado durante checkServerStatus:', error);
      setServerStatus({ node: false, python: false }); // Asegurarse de marcar como inactivos en error
      return false;
    }
  };

  // Función para actualizar estado de carga
  const setServerLoading = (isLoading: boolean) => {
    setIsServerLoading(isLoading);
  };

  // Actualizar el tipo de servidor basado en el estado
  useEffect(() => {
    // Si alguna vez ha estado activo, no mostrar pantalla de carga por fluctuaciones
    if (hasBeenActive) {
      console.log('[Server Context] Servidores marcados como previamente activos, ignorando cambios de estado');
      setIsServerLoading(false);
      return;
    }

    // Determinar qué servidor está inactivo para establecer el tipo
    if (!serverStatus.node && !serverStatus.python) {
      setServerType('both');
      // Solo activamos el loading si antes no estaba activo
      setIsServerLoading(true);
    } else if (!serverStatus.node) {
      setServerType('node');
      // Mantener loading activo para servidores incompletos
      setIsServerLoading(true);
    } else if (!serverStatus.python) {
      setServerType('python');
      // Mantener loading activo para servidores incompletos
      setIsServerLoading(true);
    } else {
      // Si ambos están activos, no hay necesidad de cargar
      console.log('[Server Context] Ambos servidores activos, desactivando pantalla de carga');
      setIsServerLoading(false);
      setHasBeenActive(true); // Marcar como activo permanentemente
    }
  }, [serverStatus, hasBeenActive]);

  // Realizar verificación inicial al cargar el contexto
  useEffect(() => {
    // Verificación inmediata al cargar
    const immediateCheck = async () => {
      try {
        const isActive = await checkServerStatus();
        console.log('[Server Context] Verificación inmediata:',
          isActive ? 'Al menos un servidor activo' : 'Servidores inactivos',
          'Node:', serverStatus.node, 'Python:', serverStatus.python);
      } catch (error) {
        console.error('[Server Context] Error en verificación inmediata:', error);
      }
    };

    // Primera verificación inmediata
    immediateCheck();

    // Segunda verificación después de 2 segundos (para dar tiempo a los servidores)
    const initialCheckTimeout = setTimeout(async () => {
      try {
        const isActive = await checkServerStatus();
        console.log('[Server Context] Verificación secundaria:',
          isActive ? 'Al menos un servidor activo' : 'Servidores inactivos',
          'Node:', serverStatus.node, 'Python:', serverStatus.python);
      } catch (error) {
        console.error('[Server Context] Error en verificación secundaria:', error);
      }
    }, 2000);

    return () => clearTimeout(initialCheckTimeout);
  }, []);

  return (
    <ServerContext.Provider value={{
      isServerLoading,
      serverType,
      serverStatus,
      checkServerStatus,
      setServerLoading,
      hasBeenActive,
    }}>
      {children}
    </ServerContext.Provider>
  );
};

export default ServerContext;
