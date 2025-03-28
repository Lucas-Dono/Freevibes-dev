'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useCustomNotifications } from '@/hooks/useCustomNotifications';
import RegionSelector from '@/components/RegionSelector';

const navItems = [
  { 
    name: 'Inicio', 
    href: '/home',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    )
  },
  { 
    name: 'Explorar', 
    href: '/explore',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z" />
      </svg>
    )
  },
  { 
    name: 'Biblioteca', 
    href: '/library',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z" />
      </svg>
    )
  },
  { 
    name: 'Búsqueda', 
    href: '/search',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      </svg>
    )
  },
];

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const { 
    unreadCount, 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications 
  } = useCustomNotifications();

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Función para abrir el menú de notificaciones
  const toggleNotificationMenu = () => {
    // Si estamos abriendo el menú, marcamos todas como leídas
    if (!isNotificationMenuOpen) {
      setTimeout(() => {
        markAllAsRead();
      }, 2000); // Marcamos como leídas después de 2 segundos
    }
    setIsNotificationMenuOpen(!isNotificationMenuOpen);
  };

  // Función para formatear la fecha de las notificaciones
  const formatNotificationTime = (date: Date): string => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Ahora mismo';
    if (diffInMinutes < 60) return `Hace ${diffInMinutes} minutos`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Hace ${diffInHours} horas`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Ayer';
    if (diffInDays < 7) return `Hace ${diffInDays} días`;
    
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // No mostrar la barra de navegación en las páginas de login
  if (pathname === '/login') {
    return null;
  }

  return (
    <motion.nav 
      className={`bg-gray-900/70 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-opacity-20 shadow-lg' : 'border-opacity-10'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/home" className="flex items-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="text-gradient font-bold text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
              >
                MusicVerse
              </motion.div>
            </Link>
          </div>

          {/* Desktop navigation - Solo mostrar si está autenticado */}
          {isAuthenticated && (
            <div className="hidden md:block">
              <div className="ml-10 flex items-center space-x-8">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`relative group flex items-center px-3 py-2 text-sm font-medium transition-colors duration-200`}
                    >
                      <motion.div
                        initial={false}
                        animate={isActive ? { 
                          color: '#ffffff',
                          scale: 1.1
                        } : {
                          color: '#94a3b8',
                          scale: 1
                        }}
                        whileHover={!isActive ? { color: '#cbd5e1', scale: 1.05 } : {}}
                        className="flex items-center"
                      >
                        <span className="mr-2">{item.icon}</span>
                        {item.name}
                      </motion.div>
                      
                      {/* Indicador activo */}
                      {isActive && (
                        <motion.div
                          layoutId="navbar-indicator"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                      
                      {/* Hover indicator */}
                      {!isActive && (
                        <motion.div
                          initial={{ opacity: 0, width: '0%' }}
                          whileHover={{ opacity: 1, width: '70%' }}
                          className="absolute bottom-0 left-[15%] h-0.5 bg-white/30"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* User menu o botones de autenticación */}
          <div className="flex items-center space-x-4">
            {/* Selector de región */}
            <RegionSelector />
            
            {isAuthenticated ? (
              <>
                {/* Notificación - Solo para usuarios autenticados */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-full hover:bg-white/10 text-white relative"
                    onClick={toggleNotificationMenu}
                    aria-label="Notificaciones"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
                    </svg>
                    
                    {/* Contador de notificaciones no leídas */}
                    {unreadCount > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 15
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold"
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.div>
                    )}
                  </motion.button>

                  {/* Menú de notificaciones */}
                  <AnimatePresence>
                    {isNotificationMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-80 bg-card-bg rounded-xl shadow-lg overflow-hidden z-50"
                        style={{ maxHeight: '80vh' }}
                      >
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                          <h3 className="font-medium">Notificaciones</h3>
                          <div className="flex space-x-2">
                            <button
                              onClick={markAllAsRead}
                              className="text-xs text-gray-400 hover:text-white transition-colors p-1"
                            >
                              Marcar como leídas
                            </button>
                            <button
                              onClick={clearNotifications}
                              className="text-xs text-gray-400 hover:text-white transition-colors p-1"
                            >
                              Limpiar todo
                            </button>
                          </div>
                        </div>
                        
                        <div className="max-h-[calc(80vh-60px)] overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-gray-400">
                              <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
                              </svg>
                              <p>No tienes notificaciones</p>
                            </div>
                          ) : (
                            <div>
                              {notifications.map((notification) => (
                                <motion.div
                                  key={notification.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className={`p-4 border-b border-gray-800 hover:bg-white/5 transition-colors 
                                    ${!notification.read ? 'bg-white/5' : ''}`}
                                  onClick={() => markAsRead(notification.id)}
                                >
                                  <div className="flex items-start">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 
                                      ${notification.type === 'success' ? 'bg-green-500' : 
                                        notification.type === 'error' ? 'bg-red-500' : 
                                        notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                    />
                                    <div className="ml-3 flex-grow">
                                      <p className="text-sm">{notification.message}</p>
                                      <p className="text-xs text-gray-400 mt-1">
                                        {formatNotificationTime(notification.timestamp)}
                                      </p>
                                    </div>
                                    {!notification.read && (
                                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                        {notifications.length > 0 && (
                          <div className="p-3 text-center border-t border-gray-800">
                            <Link 
                              href="/notifications"
                              className="text-primary hover:text-primary-light text-sm font-medium transition-colors"
                              onClick={() => setIsNotificationMenuOpen(false)}
                            >
                              Ver todas las notificaciones
                            </Link>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Avatar y menú de usuario */}
                <div className="relative group">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center rounded-full focus:outline-none"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-xs font-medium overflow-hidden">
                      {user?.images && user.images.length > 0 ? (
                        <img 
                          src={user.images[0].url} 
                          alt={user.name || 'Usuario'} 
                          className="h-full w-full object-cover" 
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-[#1DB954] to-[#1ed760]">
                          {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                  </motion.button>
                  
                  {/* Menú desplegable */}
                  <div className="absolute right-0 mt-2 w-48 py-2 bg-gray-800 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                    <div className="px-4 py-2 text-sm text-gray-300">
                      Hola, {user?.name || 'Usuario de Spotify'}
                    </div>
                    <div className="border-t border-gray-700 my-1"></div>
                    <Link href="/user/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                      Mi perfil
                    </Link>
                    <Link href="/user/settings" className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                      Configuración
                    </Link>
                    <div className="border-t border-gray-700 my-1"></div>
                    <button 
                      onClick={logout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Botones de autenticación para usuarios no autenticados */}
                <Link href="/login">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-2 text-sm bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-md transition-colors"
                  >
                    Iniciar con Spotify
                  </motion.button>
                </Link>
              </>
            )}

            {/* Mobile menu button - Solo para usuarios autenticados */}
            {isAuthenticated && (
              <div className="md:hidden">
                <motion.button
                  onClick={toggleMobileMenu}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="text-gray-400 hover:text-white p-2"
                >
                  <span className="sr-only">Abrir menú</span>
                  {isMobileMenuOpen ? (
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu - Solo para usuarios autenticados */}
      {isAuthenticated && (
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ 
                duration: 0.3,
                opacity: { duration: 0.2 }
              }}
              className="md:hidden overflow-hidden bg-gray-800/90 backdrop-blur-lg border-t border-white/5"
            >
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                {navItems.map((item, index) => {
                  const isActive = pathname === item.href;
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={item.href}
                        className={`block px-3 py-2 rounded-md text-base font-medium ${
                          isActive 
                            ? 'bg-gray-700 text-white' 
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        } flex items-center`}
                      >
                        <span className="mr-3">{item.icon}</span>
                        {item.name}
                      </Link>
                    </motion.div>
                  );
                })}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navItems.length * 0.05 }}
                >
                  <button 
                    onClick={logout}
                    className="block w-full text-left mt-4 px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white flex items-center"
                  >
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                    </svg>
                    Cerrar sesión
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.nav>
  );
}; 