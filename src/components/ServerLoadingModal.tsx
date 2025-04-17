import React, { useState, useEffect } from 'react';
// import { useServerStatus } from '@/context/ServerContext'; // Eliminado - Ya no usamos el contexto
import { isNodeServerAvailable, isPythonApiAvailable } from '@/lib/server-utils'; // Importamos las funciones directas

interface ServerLoadingModalProps {
  isOpen: boolean;
  onClose: () => void; // Añadimos prop para cerrar el modal
  initialSeconds?: number;
  serverType?: 'node' | 'python' | 'both';
}

const ServerLoadingModal: React.FC<ServerLoadingModalProps> = ({ 
  isOpen, 
  onClose, // Usamos la nueva prop
  initialSeconds = 40,
  serverType = 'both'
}) => {
  // const { checkServerStatus, setServerLoading, serverStatus, hasBeenActive } = useServerStatus(); // Eliminado
  
  // Estado local para los servidores dentro del modal
  const [localNodeStatus, setLocalNodeStatus] = useState<boolean | null>(null);
  const [localPythonStatus, setLocalPythonStatus] = useState<boolean | null>(null);
  
  const [seconds, setSeconds] = useState(initialSeconds);
  const [showTip, setShowTip] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  // Calcular qué mensaje mostrar sobre servidores basado en estado local
  const nodeActive = localNodeStatus === true;
  const pythonActive = localPythonStatus === true;
  const allActive = nodeActive && pythonActive;
  const anyActive = nodeActive || pythonActive; // Reintroducido para claridad

  // Función para verificar servidores y actualizar estado local
  const performServerCheck = async (): Promise<{ nodeOk: boolean; pythonOk: boolean }> => {
    if (isChecking) return { nodeOk: localNodeStatus ?? false, pythonOk: localPythonStatus ?? false }; // Evitar checks simultáneos
    setIsChecking(true);
    console.log('[ServerLoadingModal] Iniciando verificación de servidores...');
    try {
      const [nodeOk, pythonOk] = await Promise.all([
        isNodeServerAvailable(),
        isPythonApiAvailable()
      ]);
      setLocalNodeStatus(nodeOk);
      setLocalPythonStatus(pythonOk);
      console.log(`[ServerLoadingModal] Resultado verificación: Node=${nodeOk}, Python=${pythonOk}`);
      return { nodeOk, pythonOk }; // Devolver resultados
    } catch (error) {
      console.error('[ServerLoadingModal] Error verificando servidores:', error);
      setLocalNodeStatus(false);
      setLocalPythonStatus(false);
      return { nodeOk: false, pythonOk: false }; // Devolver fallo
    } finally {
      setIsChecking(false);
    }
  };
  
  // Cambiar el consejo mostrado cada 10 segundos
  useEffect(() => {
    if (!isOpen) return;
    
    const tipInterval = setInterval(() => {
      setShowTip(prev => !prev);
    }, 10000);
    
    return () => clearInterval(tipInterval);
  }, [isOpen]);
  
  useEffect(() => {
    if (!isOpen) return;
    
    // Reiniciar contador si se abre de nuevo el modal
    setSeconds(initialSeconds);
    
    // Iniciar temporizador
    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Limpiar temporizador al desmontar
    return () => clearInterval(timer);
  }, [isOpen, initialSeconds]);
  
  // Efecto para cerrar el modal automáticamente cuando ambos servidores están activos
  useEffect(() => {
    if (!isOpen) return;
    // Si ambos servidores locales están activos, cerrar
    if (localNodeStatus === true && localPythonStatus === true) {
      console.log('[ServerLoadingModal] Ambos servidores locales activos, cerrando automáticamente');
      onClose(); // Usar prop onClose
    }
  }, [isOpen, localNodeStatus, localPythonStatus, onClose]);
  
  // Verificar periódicamente mientras está abierto
  useEffect(() => {
    if (!isOpen) return;
    // Verificar al abrir y luego cada 5 segundos
    performServerCheck(); 
    const intervalId = setInterval(performServerCheck, 5000);
    return () => clearInterval(intervalId);
  }, [isOpen]); // Dependencia solo de isOpen para iniciar/detener intervalo
  
  // Cerrar forzosamente si el tiempo es 0
  useEffect(() => {
    if (seconds === 0 && isOpen) { // Asegurar que esté abierto
      console.log('[ServerLoadingModal] Tiempo agotado, cerrando modal');
      onClose(); // Usar prop onClose
    }
  }, [seconds, isOpen, onClose]);
  
  // Función para verificar manualmente el estado del servidor
  const handleCheckServer = async () => {
    const checkResult = await performServerCheck();
    
    // Asegurar que checkResult no sea undefined si performServerCheck retorna temprano
    const nodeOk = checkResult?.nodeOk ?? false;
    const pythonOk = checkResult?.pythonOk ?? false;

    if (nodeOk && pythonOk) {
      // Si ambos están activos, cerrar el modal
      console.log('[ServerLoadingModal] Verificación manual: servidores activos');
      onClose();
    } else if (seconds <= 10) { 
      // Si el tiempo está por agotarse y aún no están activos, loguear
      console.log('[ServerLoadingModal] Verificación manual: tiempo casi agotado, servidores no listos.');
      // Opcional: alert('Los servidores aún no responden completamente...')
    }
  };
  
  // Función para continuar con funcionalidad limitada (cerrar modal)
  const handleContinueLimited = () => {
    console.log('[ServerLoadingModal] Usuario eligió continuar con funcionalidad limitada.');
    onClose();
  };
  
  // Si no está abierto, no mostrar
  if (!isOpen) return null;
  
  // Calcular el progreso para la barra de progreso (de 0 a 100%)
  const progressPercentage = 100 - Math.floor((seconds / initialSeconds) * 100);
  
  // Consejos que se mostrarán durante la espera
  const tips = [
    "Los servidores gratuitos se apagan automáticamente después de un período de inactividad para ahorrar recursos.",
    "Estamos utilizando servicios gratuitos para este proyecto, por lo que necesitan un tiempo para activarse.",
    "¡Pronto podrás disfrutar de la música! Solo estamos esperando a que los servidores se inicien.",
    "Este tiempo de espera solo ocurre cuando los servidores han estado inactivos por un tiempo.",
    "Una vez que los servidores estén activos, la aplicación funcionará normalmente sin retrasos."
  ];
  
  const currentTip = tips[Math.floor(seconds / 10) % tips.length];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="bg-card-bg rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center mb-6">
          <div className="animate-spin mr-4 h-10 w-10 text-primary">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">Iniciando servidores</h2>
        </div>
        
        <div className="mb-6 text-white/90">
          <p className="mb-4 text-lg">
            Los servidores se están iniciando después de un período de inactividad.
          </p>
          <p>
            Este proceso puede tardar hasta <span className="font-semibold">{initialSeconds} segundos</span>. Por favor, espera mientras se activan los servicios.
          </p>
        </div>
        
        {/* Estado de los servidores */}
        <div className="mb-6 bg-gray-900/50 rounded-lg p-4">
          <h3 className="font-medium text-white mb-3">Estado de los servidores:</h3>
          
          <div className="flex items-center justify-between mb-2">
            <span>Servidor Node.js:</span>
            {isChecking && localNodeStatus === null ? (
              <span className="text-xs text-gray-400">Comprobando...</span>
            ) : nodeActive ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Activo
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Iniciando...
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span>Servidor Python:</span>
             {isChecking && localPythonStatus === null ? (
              <span className="text-xs text-gray-400">Comprobando...</span>
            ) : pythonActive ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Activo
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Iniciando...
              </span>
            )}
          </div>
        </div>
        
        <div className="mb-4 flex justify-between items-center">
          <span className="text-sm text-primary font-medium">Activando servicios...</span>
          <span className="text-lg font-bold text-white bg-primary/20 px-3 py-1 rounded-md">
            {seconds}s
          </span>
        </div>
        
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-6">
          <div 
            className="h-full bg-gradient-to-r from-blue-600 to-primary-light transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        
        <div className="bg-gray-900/50 rounded-lg p-4 mb-6 min-h-[80px] flex items-center">
          <div className="text-yellow-300 mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white/80 text-sm">{currentTip}</p>
        </div>
        
        <div className="flex space-x-3 mb-6">
          {/* Botón para verificar manualmente */}
          <button
            onClick={handleCheckServer}
            disabled={isChecking}
            className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary-dark transition-colors 
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white font-medium"
          >
            {isChecking ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4">
                  <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                Verificando...
              </>
            ) : (
              <>Verificar ahora</>
            )}
          </button>
          
          {/* Botón para continuar si algún servidor está activo */}
          {anyActive && !allActive && (
            <button
              onClick={handleContinueLimited}
              className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 transition-colors"
            >
              Continuar con limitaciones
            </button>
          )}
          
          {/* Botón para continuar aunque no haya servidores activos (disponible después de 30 segundos) */}
          {!anyActive && seconds <= 10 && (
            <button
              onClick={handleContinueLimited}
              className="flex-1 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 transition-colors"
            >
              Continuar sin servidores
            </button>
          )}
        </div>
        
        <div className="text-xs text-gray-400 border-t border-gray-700 pt-4">
          <p>
            Este proyecto utiliza servidores gratuitos que se apagan después de un período de inactividad. 
            Una vez iniciados, funcionarán normalmente hasta que vuelvan a quedar inactivos.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServerLoadingModal; 