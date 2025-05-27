import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BackgroundPlaybackInfoProps {
  isVisible?: boolean;
  onClose?: () => void;
}

const BackgroundPlaybackInfo: React.FC<BackgroundPlaybackInfoProps> = ({
  isVisible = false,
  onClose
}) => {
  const [capabilities, setCapabilities] = useState({
    wakeLock: false,
    mediaSession: false,
    visibilityAPI: false,
    serviceWorker: false
  });

  const [showInfo, setShowInfo] = useState(false);

  // Verificar capacidades del navegador
  useEffect(() => {
    setCapabilities({
      wakeLock: 'wakeLock' in navigator,
      mediaSession: 'mediaSession' in navigator,
      visibilityAPI: 'visibilityState' in document,
      serviceWorker: 'serviceWorker' in navigator
    });
  }, []);

  // Auto-mostrar información en dispositivos móviles la primera vez
  useEffect(() => {
    const hasShownInfo = localStorage.getItem('freevibes-background-info-shown');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!hasShownInfo && isMobile) {
      setTimeout(() => {
        setShowInfo(true);
        localStorage.setItem('freevibes-background-info-shown', 'true');
      }, 3000);
    }
  }, []);

  const handleClose = () => {
    setShowInfo(false);
    if (onClose) onClose();
  };

  const getCapabilityIcon = (supported: boolean) => {
    return supported ? '✅' : '❌';
  };

  const getCapabilityText = (supported: boolean) => {
    return supported ? 'Soportado' : 'No soportado';
  };

  return (
    <AnimatePresence>
      {(isVisible || showInfo) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-gray-900/95 backdrop-blur-xl rounded-2xl p-6 max-w-sm w-full border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  🎵
                </div>
                <h3 className="text-lg font-bold text-white">
                  Reproducción en Segundo Plano
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Descripción */}
            <p className="text-gray-300 text-sm mb-4">
              Freevibes puede reproducir música en segundo plano cuando cambias de aplicación o apagas la pantalla.
            </p>

            {/* Capacidades */}
            <div className="space-y-3 mb-6">
              <h4 className="text-white font-semibold text-sm">Funciones disponibles:</h4>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Controles nativos</span>
                  <span className="flex items-center gap-1">
                    {getCapabilityIcon(capabilities.mediaSession)}
                    <span className={capabilities.mediaSession ? 'text-green-400' : 'text-red-400'}>
                      {getCapabilityText(capabilities.mediaSession)}
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Mantener pantalla activa</span>
                  <span className="flex items-center gap-1">
                    {getCapabilityIcon(capabilities.wakeLock)}
                    <span className={capabilities.wakeLock ? 'text-green-400' : 'text-red-400'}>
                      {getCapabilityText(capabilities.wakeLock)}
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Detección de segundo plano</span>
                  <span className="flex items-center gap-1">
                    {getCapabilityIcon(capabilities.visibilityAPI)}
                    <span className={capabilities.visibilityAPI ? 'text-green-400' : 'text-red-400'}>
                      {getCapabilityText(capabilities.visibilityAPI)}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Consejos */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
              <h5 className="text-blue-400 font-semibold text-sm mb-2">💡 Consejos:</h5>
              <ul className="text-blue-300 text-xs space-y-1">
                <li>• Usa los controles de la notificación para cambiar canciones</li>
                <li>• En algunos dispositivos, mantén la app en segundo plano reciente</li>
                <li>• Permite notificaciones para mejor experiencia</li>
              </ul>
            </div>

            {/* Botón de cerrar */}
            <button
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
            >
              ¡Entendido!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BackgroundPlaybackInfo; 