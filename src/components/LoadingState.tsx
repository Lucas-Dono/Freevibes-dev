import React from 'react';
import { motion } from 'framer-motion';

interface LoadingStateProps {
  type: 'card' | 'list' | 'grid' | 'artist' | 'playlist' | 'album';
  count?: number;
  message?: string;
  withText?: boolean;
  aspectRatio?: 'square' | 'portrait' | 'landscape';
  className?: string;
}

/**
 * Componente que muestra un estado de carga con esqueletos animados
 */
const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'card',
  count = 5,
  message = 'Cargando...',
  withText = true,
  aspectRatio = 'square',
  className = ''
}) => {
  // Definir las dimensiones y apariencia según el tipo
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'portrait': return 'aspect-[3/4]';
      case 'landscape': return 'aspect-[16/9]';
      case 'square':
      default: return 'aspect-square';
    }
  };

  const getSkeletonByType = () => {
    switch (type) {
      case 'artist':
        return (
          <div className={`bg-zinc-800/70 rounded-xl overflow-hidden shadow-xl h-full`}>
            <div className={`${getAspectRatioClass()} bg-zinc-700/50 animate-pulse`}></div>
            <div className="p-3">
              <div className="h-4 bg-zinc-700/50 rounded-full w-2/3 mb-2 animate-pulse"></div>
              <div className="h-3 bg-zinc-700/50 rounded-full w-1/2 animate-pulse"></div>
            </div>
          </div>
        );
      
      case 'playlist':
      case 'album':
        return (
          <div className={`bg-zinc-800/70 rounded-xl overflow-hidden shadow-xl h-full`}>
            <div className={`${getAspectRatioClass()} bg-zinc-700/50 animate-pulse`}></div>
            <div className="p-3">
              <div className="h-4 bg-zinc-700/50 rounded-full w-3/4 mb-2 animate-pulse"></div>
              <div className="h-3 bg-zinc-700/50 rounded-full w-1/2 mb-1 animate-pulse"></div>
              <div className="h-3 bg-zinc-700/50 rounded-full w-1/3 animate-pulse"></div>
            </div>
          </div>
        );
      
      case 'list':
        return (
          <div className={`bg-zinc-800/70 rounded-xl overflow-hidden shadow-xl p-3 flex items-center`}>
            <div className="w-12 h-12 bg-zinc-700/50 rounded-md animate-pulse mr-3"></div>
            <div className="flex-1">
              <div className="h-4 bg-zinc-700/50 rounded-full w-3/4 mb-2 animate-pulse"></div>
              <div className="h-3 bg-zinc-700/50 rounded-full w-1/2 animate-pulse"></div>
            </div>
            <div className="w-8 h-8 bg-zinc-700/50 rounded-full animate-pulse"></div>
          </div>
        );
      
      case 'grid':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className={`bg-zinc-800/70 rounded-xl overflow-hidden shadow-xl h-full`}>
                <div className="aspect-square bg-zinc-700/50 animate-pulse"></div>
                <div className="p-3">
                  <div className="h-4 bg-zinc-700/50 rounded-full w-3/4 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-zinc-700/50 rounded-full w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'card':
      default:
        return (
          <div className={`bg-zinc-800/70 rounded-xl overflow-hidden shadow-xl h-full`}>
            <div className={`${getAspectRatioClass()} bg-zinc-700/50 animate-pulse`}></div>
            <div className="p-3">
              <div className="h-4 bg-zinc-700/50 rounded-full w-3/4 mb-2 animate-pulse"></div>
              <div className="h-3 bg-zinc-700/50 rounded-full w-1/2 animate-pulse"></div>
            </div>
          </div>
        );
    }
  };

  // Si es una cuadrícula, retornar directamente el skeleton de grid
  if (type === 'grid') {
    return (
      <div className={`w-full ${className}`}>
        {withText && (
          <div className="flex justify-center mb-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center"
            >
              <div className="w-6 h-6 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mr-3"></div>
              <span className="text-zinc-400">{message}</span>
            </motion.div>
          </div>
        )}
        {getSkeletonByType()}
      </div>
    );
  }

  // Para otros tipos, generar múltiples elementos
  return (
    <div className={`w-full ${className}`}>
      {withText && (
        <div className="flex justify-center mb-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center"
          >
            <div className="w-6 h-6 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mr-3"></div>
            <span className="text-zinc-400">{message}</span>
          </motion.div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            {getSkeletonByType()}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default LoadingState; 