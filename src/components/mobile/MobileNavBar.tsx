import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

const MobileNavBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname() || '';
  
  const navItems = [
    {
      name: 'Inicio',
      path: '/home',
      icon: (isActive: boolean) => (
        <svg className={`w-6 h-6 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      )
    },
    {
      name: 'Explorar',
      path: '/explore',
      icon: (isActive: boolean) => (
        <svg className={`w-6 h-6 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      )
    },
    {
      name: 'Biblioteca',
      path: '/library',
      icon: (isActive: boolean) => (
        <svg className={`w-6 h-6 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5c.22 0 .42.05.6.13V7c0-.55.45-1 1-1h3c.55 0 1 .45 1 1s-.45 1-1 1z"/>
        </svg>
      )
    },
    {
      name: 'Buscar',
      path: '/search',
      icon: (isActive: boolean) => (
        <svg className={`w-6 h-6 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
      )
    }
  ];

  const [activeIndex, setActiveIndex] = useState<number>(0);

  useEffect(() => {
    const currentIndex = navItems.findIndex(item => pathname.startsWith(item.path));
    if (currentIndex >= 0) {
      setActiveIndex(currentIndex);
    }
  }, [pathname]);

  const handleNavigation = (index: number, path: string) => {
    setActiveIndex(index);
    router.push(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Fondo con glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-800/95 to-slate-900/90 backdrop-blur-xl border-t border-white/10" />
      
      {/* Contenido de la navegación */}
      <div className="relative flex items-center justify-around px-2 py-2">
        {navItems.map((item, index) => {
          const isActive = activeIndex === index;
          
          return (
            <motion.button
              key={item.name}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNavigation(index, item.path)}
              className="relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200"
            >
              {/* Fondo activo */}
              {isActive && (
                <motion.div
                  layoutId="activeBackground"
                  className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              {/* Contenido del botón */}
              <div className="relative z-10 flex flex-col items-center space-y-1">
                {/* Icono con efecto de glow */}
                <div className="relative">
                  {isActive && (
                    <div className="absolute inset-0 bg-purple-400 rounded-full blur-md opacity-50" />
                  )}
                  <div className="relative">
                    {item.icon(isActive)}
                  </div>
                </div>
                
                {/* Texto */}
                <span 
                  className={`text-xs font-medium transition-colors duration-200 ${
                    isActive 
                      ? 'text-purple-400' 
                      : 'text-gray-400'
                  }`}
                >
                  {item.name}
                </span>
              </div>
              
              {/* Indicador superior */}
              {isActive && (
                <motion.div
                  className="absolute -top-0.5 left-1/2 w-8 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  initial={{ scale: 0, x: '-50%' }}
                  animate={{ scale: 1, x: '-50%' }}
                  transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
      
      {/* Indicador de swipe */}
      <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gray-600 rounded-full opacity-50" />
    </nav>
  );
};

export default MobileNavBar; 