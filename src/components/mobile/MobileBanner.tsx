import React from 'react';
import { motion } from 'framer-motion';

interface MobileBannerProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  onAction?: () => void;
  actionText?: string;
  type?: 'welcome' | 'featured' | 'discovery';
}

const MobileBanner: React.FC<MobileBannerProps> = ({
  title = "Descubre Música Increíble",
  subtitle = "Explora millones de canciones gratis",
  backgroundImage,
  onAction,
  actionText = "Explorar Ahora",
  type = 'welcome'
}) => {
  const getBannerContent = () => {
    switch (type) {
      case 'featured':
        return {
          icon: (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          ),
          gradient: 'from-yellow-500 via-orange-500 to-red-500'
        };
      case 'discovery':
        return {
          icon: (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          ),
          gradient: 'from-blue-500 via-purple-500 to-pink-500'
        };
      default:
        return {
          icon: (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          ),
          gradient: 'from-purple-500 via-pink-500 to-purple-600'
        };
    }
  };

  const { icon, gradient } = getBannerContent();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative mx-4 mb-6 mt-2"
    >
      {/* Contenedor principal */}
      <div className="relative h-48 rounded-2xl overflow-hidden">
        {/* Fondo con gradiente */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        
        {/* Imagen de fondo si existe */}
        {backgroundImage && (
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        )}
        
        {/* Overlay con patrón */}
        <div className="absolute inset-0 bg-black/20" />
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
        
        {/* Contenido */}
        <div className="relative h-full flex flex-col justify-center items-center text-center p-6">
          {/* Icono animado */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
            className="mb-4 p-3 bg-white/20 rounded-full backdrop-blur-sm"
          >
            {icon}
          </motion.div>
          
          {/* Título */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-bold text-white mb-2 leading-tight"
          >
            {title}
          </motion.h1>
          
          {/* Subtítulo */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-white/90 text-sm mb-4 leading-relaxed"
          >
            {subtitle}
          </motion.p>
          
          {/* Botón de acción */}
          {onAction && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAction}
              className="px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full text-white font-semibold text-sm border border-white/30 hover:bg-white/30 transition-all duration-200"
            >
              {actionText}
            </motion.button>
          )}
        </div>
        
        {/* Elementos decorativos */}
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            rotate: { duration: 20, repeat: Infinity, ease: "linear" },
            scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute top-4 right-4 w-16 h-16 border-2 border-white/20 rounded-full"
        />
        
        <motion.div
          animate={{ 
            rotate: -360,
            scale: [1, 0.8, 1]
          }}
          transition={{ 
            rotate: { duration: 15, repeat: Infinity, ease: "linear" },
            scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute bottom-4 left-4 w-12 h-12 border-2 border-white/20 rounded-full"
        />
        
        {/* Partículas flotantes */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-white/30 rounded-full"
            style={{
              left: `${20 + i * 12}%`,
              top: `${30 + (i % 2) * 20}%`,
            }}
            animate={{
              y: [-10, 10, -10],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default MobileBanner; 