import React from 'react';
import { motion } from 'framer-motion';

interface MobileSectionProps {
  title: string;
  children: React.ReactNode;
  showViewAll?: boolean;
  onViewAll?: () => void;
  layout?: 'grid' | 'carousel';
  gridCols?: 2 | 3;
}

const MobileSection: React.FC<MobileSectionProps> = ({ 
  title, 
  children, 
  showViewAll = true,
  onViewAll,
  layout = 'grid',
  gridCols = 2
}) => {
  return (
    <motion.section 
      className="mt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header de la sección */}
      <div className="flex justify-between items-center px-4 mb-3">
        <h2 className="text-lg font-bold text-white bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          {title}
        </h2>
        {showViewAll && (
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={onViewAll}
            className="text-sm text-purple-400 font-medium hover:text-purple-300 transition-colors"
          >
            Ver todo
          </motion.button>
        )}
      </div>
      
      {/* Contenido */}
      {layout === 'grid' ? (
        <div className={`grid grid-cols-${gridCols} gap-3 px-4`}>
          {children}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex space-x-3 px-4 pb-2">
            {children}
          </div>
        </div>
      )}
    </motion.section>
  );
};

// Componente de tarjeta mobile optimizada
interface MobileCardProps {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  type?: 'artist' | 'album' | 'playlist' | 'track';
}

export const MobileCard: React.FC<MobileCardProps> = ({
  title,
  subtitle,
  imageUrl,
  onClick,
  size = 'medium',
  type = 'album'
}) => {
  const sizeClasses = {
    small: 'w-24 h-24',
    medium: 'w-32 h-32',
    large: 'w-40 h-40'
  };

  const getPlaceholderIcon = () => {
    switch (type) {
      case 'artist':
        return (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>
        );
      case 'playlist':
        return (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        );
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      {/* Imagen/Artwork */}
      <div className={`${sizeClasses[size]} relative mb-2 mx-auto`}>
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Contenedor de imagen */}
        <div className={`relative ${type === 'artist' ? 'rounded-full' : 'rounded-xl'} overflow-hidden bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm border border-white/10 ${sizeClasses[size]}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title || 'Imagen'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
              {getPlaceholderIcon()}
            </div>
          )}
          
          {/* Overlay de hover */}
          <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              whileHover={{ scale: 1 }}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Información */}
      <div className="text-center px-1">
        <h3 className="text-sm font-semibold text-white line-clamp-2 mb-1 leading-tight min-h-[2.5rem]">
          {title && title.length > 25 ? `${title.substring(0, 25)}...` : (title || 'Sin título')}
        </h3>
        {subtitle && (
          <p className="text-xs text-gray-400 line-clamp-1 leading-tight">
            {subtitle.length > 20 ? `${subtitle.substring(0, 20)}...` : subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default MobileSection; 