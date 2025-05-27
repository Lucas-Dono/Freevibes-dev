import React, { useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSession } from 'next-auth/react';
import { useTranslation } from '@/hooks/useTranslation';

const MobileHeader: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { t, language } = useTranslation();
  const { isAuthenticated, isDemo, logout } = useAuth();
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // Usar la sesión real si existe, de lo contrario usar datos demo
  const user = session?.user ? {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
    id: session.user.id
  } : isDemo ? {
    name: language === 'es' ? 'Usuario Demo' : 'Demo User',
    email: 'demo@example.com',
    image: 'https://i.pravatar.cc/150?img=68',
    id: 'demo-user-123'
  } : null;

  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-30">
      {/* Fondo con glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border-b border-white/10" />
      
      {/* Contenido del header */}
      <div className="relative flex items-center justify-between px-4 py-3">
        {/* Logo mejorado */}
        <Link href="/home" className="flex items-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2"
          >
            {/* Icono musical */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            
            {/* Texto del logo */}
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              FreeVibes
            </span>
          </motion.div>
        </Link>

        {/* Información del usuario y avatar */}
        <div className="flex items-center space-x-3">
          {/* Saludo personalizado */}
          {user && (
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-300">
                {language === 'es' ? 'Hola' : 'Hello'}
              </p>
              <p className="text-sm font-medium text-white truncate max-w-24">
                {user.name?.split(' ')[0] || user.email?.split('@')[0]}
              </p>
            </div>
          )}

          {/* Avatar mejorado */}
          <div className="relative" ref={userMenuRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              onClick={toggleUserMenu}
            >
              {/* Ring de estado */}
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-75 blur-sm animate-pulse" />
              
              {/* Avatar */}
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden shadow-lg">
                {user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name || 'User'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-white font-semibold">
                    {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              
              {/* Indicador de estado online */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-gray-900 rounded-full" />
            </motion.button>

            {/* Menú desplegable mejorado */}
            <AnimatePresence>
              {userMenuOpen && (
                <>
                  {/* Overlay para cerrar el menú */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setUserMenuOpen(false)}
                  />
                  
                  {/* Menú */}
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-3 w-56 z-50"
                  >
                    {/* Fondo del menú */}
                    <div className="bg-gray-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                      {/* Header del menú */}
                      {user && (
                        <div className="px-4 py-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-b border-white/10">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium overflow-hidden">
                              {user.image ? (
                                <img
                                  src={user.image}
                                  alt={user.name || 'User'}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {user.name || user.email?.split('@')[0]}
                              </p>
                              <p className="text-xs text-gray-300 truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Opciones del menú */}
                      <div className="py-2">
                        <Link
                          href={`/user/${user?.id}`}
                          className="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <svg className="w-4 h-4 mr-3 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                          </svg>
                          {t('nav.profile')}
                        </Link>

                        <Link
                          href="/profile/edit"
                          className="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <svg className="w-4 h-4 mr-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                          {language === 'es' ? 'Editar Perfil' : 'Edit Profile'}
                        </Link>

                        {/* Separador */}
                        <div className="my-2 border-t border-white/10" />

                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full px-4 py-3 text-sm text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/>
                          </svg>
                          {t('nav.logout')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;