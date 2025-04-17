'use client';

import React, { useEffect, useState } from 'react';
import { useServerStatus } from '@/context/ServerContext';
import ServerLoadingModal from '@/components/ServerLoadingModal';
import axios from 'axios';

// Tiempo de espera para considerar que una solicitud está tardando demasiado
const LONG_REQUEST_TIMEOUT = 2000; // 2 segundos para iniciar verificación
// Aumentamos el intervalo de verificación de 1.5 segundos a 5 segundos para reducir la carga
const SERVER_CHECK_INTERVAL = 5000; // Verificar estado del servidor cada 5 segundos (menos frecuente)

const ServerLoadingOverlay: React.FC = () => {
  const { isServerLoading, serverType, checkServerStatus, setServerLoading, serverStatus, hasBeenActive } = useServerStatus();
  const [showModal, setShowModal] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(0);
  
  // Iniciar verificación periódica del estado del servidor al cargar la aplicación
  useEffect(() => {
    // Verificación inicial
    const initialCheck = async () => {
      try {
        // Si el servidor ya ha estado activo antes, no mostrar el modal
        if (hasBeenActive) {
          console.log('[Server Check] Servidor marcado como activo anteriormente, saltando verificación inicial');
          setShowModal(false);
          setServerLoading(false);
          return;
        }
        
        const isServerActive = await checkServerStatus();
        if (!isServerActive) {
          console.log('[Server Check] Detectado servidor inactivo al inicio');
          setShowModal(true);
        }
      } catch (error) {
        console.error('[Server Check] Error en verificación inicial:', error);
      }
    };
    
    // Si estamos en un navegador, verificar al cargar
    if (typeof window !== 'undefined') {
      initialCheck();
    }
    
    // Iniciar verificación periódica
    const intervalId = setInterval(async () => {
      // Verificar solo si el modal está visible o si han pasado al menos 30 segundos desde la última verificación
      if (showModal || Date.now() - lastCheckTime > 30000) {
        try {
          const isAnyServerActive = await checkServerStatus();
          
          // Actualizar el tiempo de la última verificación
          setLastCheckTime(Date.now());
          
          // Si algún servidor está activo y el modal está visible, actualizar la UI
          if (isAnyServerActive && showModal) {
            console.log('[Server Check] Al menos un servidor se ha activado');
            // No cerramos automáticamente para que el usuario pueda ver qué servidor está activo
            // Pero actualizamos el estado para mostrar correctamente qué está disponible
          }
        } catch (error) {
          console.error('[Server Check] Error en verificación periódica:', error);
        }
      }
    }, SERVER_CHECK_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [checkServerStatus, showModal, setServerLoading, hasBeenActive]);
  
  // Si el estado isServerLoading cambia a false, cerrar el modal
  useEffect(() => {
    if (!isServerLoading && showModal) {
      setShowModal(false);
    }
  }, [isServerLoading, showModal]);

  // Interceptor global para detectar solicitudes lentas
  useEffect(() => {
    // Si el servidor ya ha estado activo, no configurar estos interceptores
    if (hasBeenActive) {
      console.log('[Server Check] Servidor ya ha estado activo, no configurando interceptores de solicitudes lentas');
      return;
    }
    
    // Configurar interceptores para detectar solicitudes lentas
    const requestInterceptor = axios.interceptors.request.use(async (config) => {
      // Si es una solicitud a la API, monitorear el tiempo de respuesta
      if (config.url?.includes('/api/')) {
        try {
          // Iniciar un temporizador para verificar si la solicitud tarda demasiado
          const timeoutId = setTimeout(async () => {
            console.log(`[Server Check] Solicitud a ${config.url} está tardando demasiado`);
            // Comprobar estado del servidor
            const isActive = await checkServerStatus();
            
            // Si el servidor no está activo, mostrar el modal
            if (!isActive && !hasBeenActive) {
              console.log('[Server Check] Servidor detectado como inactivo');
              setShowModal(true);
            }
          }, LONG_REQUEST_TIMEOUT);
          
          // Guardar el ID del temporizador en el objeto de configuración
          // @ts-ignore
          config._timeoutId = timeoutId;
        } catch (error) {
          console.error('[Server Check] Error al configurar temporizador:', error);
        }
      }
      return config;
    });

    // Interceptor para limpiar el temporizador cuando la respuesta llega
    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        // Limpiar el temporizador si existe
        // @ts-ignore
        if (response.config._timeoutId) {
          // @ts-ignore
          clearTimeout(response.config._timeoutId);
        }
        
        return response;
      },
      (error) => {
        // En caso de error, también limpiar el temporizador
        // @ts-ignore
        if (error.config?._timeoutId) {
          // @ts-ignore
          clearTimeout(error.config._timeoutId);
        }
        
        // Si el error es por tiempo de espera o no se puede conectar,
        // verificar estado del servidor
        if (
          axios.isAxiosError(error) && 
          (error.code === 'ECONNABORTED' || 
           error.message.includes('timeout') || 
           error.response?.status === 504 || 
           error.response?.status === 502 || 
           error.response?.status === 503 || 
           !error.response) // Sin respuesta también indica posible servidor inactivo
        ) {
          console.log('[Server Check] Error de conexión detectado:', error.message);
          checkServerStatus().then(isActive => {
            if (!isActive) {
              console.log('[Server Check] Confirmado servidor inactivo después de error');
              setShowModal(true);
            }
          });
        }
        
        return Promise.reject(error);
      }
    );

    // Limpiar interceptores al desmontar
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [checkServerStatus, setServerLoading, hasBeenActive]);

  // Mostrar modal cuando el servidor está cargando (pero solo si no ha estado activo)
  useEffect(() => {
    if (isServerLoading && !hasBeenActive) {
      setShowModal(true);
    } else if (hasBeenActive) {
      // Si alguna vez ha estado activo, asegurarnos de que no se muestre el modal
      setShowModal(false);
    }
  }, [isServerLoading, hasBeenActive]);

  // Verificar si los servidores están activos cuando el modal está visible
  useEffect(() => {
    if (!showModal) return;
    
    // Verificar inmediatamente
    const checkAndUpdate = async () => {
      try {
        await checkServerStatus();
        
        // Si ambos servidores están activos, cerrar el modal
        if (serverStatus.node && serverStatus.python) {
          console.log('[ServerLoadingOverlay] Ambos servidores activos, cerrando modal');
          setShowModal(false);
          setServerLoading(false);
        }
      } catch (error) {
        console.error('[ServerLoadingOverlay] Error al verificar estado:', error);
      }
    };
    
    // Verificar inmediatamente
    checkAndUpdate();
    
    // Verificar cada 3 segundos mientras el modal esté visible
    const checkInterval = setInterval(checkAndUpdate, 3000);
    
    return () => clearInterval(checkInterval);
  }, [showModal, serverStatus, checkServerStatus, setServerLoading]);

  // Agregar un efecto para cerrar el modal después de cierto tiempo
  // para evitar bloquear indefinidamente al usuario
  useEffect(() => {
    if (!showModal) return;
    
    // Después de 45 segundos forzar el cierre del modal
    // para evitar bloquear al usuario indefinidamente
    const forceCloseTimer = setTimeout(() => {
      console.log('[ServerLoadingOverlay] Tiempo de espera excedido, cerrando modal');
      setShowModal(false);
      setServerLoading(false);
    }, 45000);
    
    return () => clearTimeout(forceCloseTimer);
  }, [showModal, setServerLoading]);

  return (
    <ServerLoadingModal 
      isOpen={showModal && !hasBeenActive} // No mostrar si ha estado activo
      serverType={serverType}
      initialSeconds={40}
    />
  );
};

export default ServerLoadingOverlay; 