'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'next-auth/react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { useRouter } from 'next/navigation';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSession } from 'next-auth/react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from '@/hooks/useTranslation';
import { useCustomNotifications } from '@/hooks/useCustomNotifications';

const Navbar = () => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { isAuthenticated, isDemo, logout } = useAuth();
  const { t, language } = useTranslation();
  
  // Obtener la sesión de next-auth directamente
  const { data: session } = useSession();
  
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
  
  useEffect(() => {
    // Log para depuración
    console.log('[Navbar] Estado del usuario:', {
      isAuthenticated,
      isDemo,
      hasSession: !!session,
      userName: session?.user?.name || 'Sin nombre',
      userEmail: session?.user?.email || 'Sin email',
      userImage: session?.user?.image || 'Sin imagen'
    });
  }, [session, isAuthenticated, isDemo]);
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Agregar estado para el menú de notificaciones
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications,
    generateDemoNotifications
  } = useCustomNotifications();
  
  // Función para abrir/cerrar el menú de notificaciones
  const toggleNotificationMenu = (e: React.MouseEvent) => {
    e.stopPropagation(); // Detener la propagación del evento
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target as Node)) {
        setIsNotificationMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const toggleUserMenu = () => {
    setUserMenuOpen(!userMenuOpen);
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  const handleCloseUserMenu = () => {
    setUserMenuAnchor(null);
  };

  // Definir elementos de navegación con traducciones
  const navItems = [
    { 
      key: 'home',
      name: t('nav.home'), 
      href: '/home',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      )
    },
    { 
      key: 'explore',
      name: t('nav.explore'), 
      href: '/explore',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z" />
        </svg>
      )
    },
    { 
      key: 'library',
      name: t('nav.myLibrary'), 
      href: '/library',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z" />
        </svg>
      )
    },
    { 
      key: 'search',
      name: t('nav.search'), 
      href: '/search',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
      )
    },
  ];

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
                className="text-gradient font-bold text-2xl bg-gradient-to-r from-[#1DB954] to-[#9C27B0] bg-clip-text text-transparent"
              >
                FreeVibes
              </motion.div>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-8">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                
                return (
                  <div key={item.key} className="relative">
                    <Link
                      href={item.href}
                      className={`relative flex items-center px-3 py-2 text-sm font-medium transition-colors duration-200`}
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
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#1DB954] to-[#9C27B0]"
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
                  </div>
                );
              })}
            </div>
          </div>

          {/* User menu (con avatar y notificación) */}
          <div className="flex items-center space-x-4">
            {/* Icono de notificaciones */}
            <div className="relative ml-4" ref={notificationMenuRef}>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full hover:bg-white/10 text-white relative"
                onClick={(e) => toggleNotificationMenu(e)}
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
                    className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-[10px] font-bold"
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
                    className="absolute right-0 mt-2 w-80 bg-gray-900 rounded-xl shadow-lg overflow-hidden z-50"
                    style={{ maxHeight: '80vh' }}
                    onClick={(e) => e.stopPropagation()} // Evita que los clics dentro del menú lo cierren
                  >
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                      <h3 className="font-medium">Notificaciones</h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-gray-400 hover:text-white transition-colors p-1"
                        >
                          Marcar leídas
                        </button>
                        <button
                          onClick={clearNotifications}
                          className="text-xs text-gray-400 hover:text-white transition-colors p-1"
                        >
                          Limpiar
                        </button>
                      </div>
                    </div>
                    
                    <div className="overflow-y-auto" style={{ maxHeight: '50vh' }}>
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                          <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
                          </svg>
                          <p>No tienes notificaciones</p>
                          <button 
                            onClick={generateDemoNotifications}
                            className="mt-2 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-full"
                          >
                            Generar notificaciones demo
                          </button>
                        </div>
                      ) : (
                        <div>
                          {notifications.map((notification) => (
                            <div 
                              key={notification.id} 
                              className={`p-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${!notification.read ? 'bg-gray-800/30' : ''}`}
                              onClick={() => markAsRead(notification.id)}
                            >
                              <div className="flex items-start">
                                <div className={`w-2 h-2 mt-1.5 rounded-full mr-2 ${
                                  notification.type === 'success' ? 'bg-green-500' : 
                                  notification.type === 'error' ? 'bg-red-500' : 
                                  notification.type === 'warning' ? 'bg-yellow-500' : 
                                  'bg-blue-500'
                                }`} />
                                <div className="flex-1">
                                  <p className="text-sm">{notification.message}</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {formatNotificationTime(notification.timestamp)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {notifications.length > 0 && (
                      <div className="p-3 text-center border-t border-gray-800">
                        <button 
                          onClick={generateDemoNotifications}
                          className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                        >
                          Agregar más notificaciones
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Selector de idioma */}
            <LanguageSwitcher variant="minimal" />

            <div className="relative" ref={userMenuRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center rounded-full focus:outline-none"
                onClick={toggleUserMenu}
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1DB954] to-[#9C27B0] flex items-center justify-center text-white text-xs font-medium overflow-hidden">
                  {user?.name ? (
                    <img 
                      src={user.image || "https://i.pravatar.cc/150?img=12"} 
                      alt={user.name} 
                      className="h-full w-full object-cover" 
                    />
                  ) : (
                    <span>{user?.email?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
              </motion.button>
              
              {/* Menú desplegable de usuario */}
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 border border-gray-700 ring-1 ring-black ring-opacity-5 z-50"
                  >
                    <div className="py-1">
                      {user && (
                        <div className="px-4 py-2 border-b border-gray-700">
                          <p className="text-sm font-medium text-white truncate">{user.name || user.email}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                        </div>
                      )}
                      
                      <Link
                        href={`/user/${user?.id}`}
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                          </svg>
                          {t('nav.profile')}
                        </div>
                      </Link>
                      
                      <Link
                        href="/profile/edit"
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                          {language === 'es' ? 'Editar Perfil' : 'Edit Profile'}
                        </div>
                      </Link>
                      
                      <Link
                        href="/profile/genres"
                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                          {language === 'es' ? 'Mis Géneros' : 'My Genres'}
                        </div>
                      </Link>
                      
                      <MenuItem onClick={handleLogout}>
                        <ListItemIcon>
                          <LogoutIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={t('nav.logout')} />
                      </MenuItem>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <motion.button
                onClick={toggleMobileMenu}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="text-gray-400 hover:text-white p-2"
              >
                <span className="sr-only">{language === 'es' ? 'Abrir menú' : 'Open menu'}</span>
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
          </div>
        </div>
      </div>

      {/* Mobile menu */}
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
                      className={`flex items-center px-3 py-3 rounded-md text-base font-medium ${
                        isActive
                          ? 'bg-[#1DB954]/20 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <span className="mr-3">{item.icon}</span>
                      {item.name}
                      
                      {isActive && (
                        <motion.div
                          layoutId="mobile-indicator"
                          className="ml-auto w-1 h-5 rounded-full bg-[#1DB954]"
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
               
               {/* Selector de idioma en móvil */}
               <div className="px-3 py-3 mt-2">
                 <div className="text-sm font-medium text-gray-400 mb-2">
                   {language === 'es' ? 'Idioma / Language' : 'Language / Idioma'}
                 </div>
                 <LanguageSwitcher variant="minimal" className="justify-center" />
               </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Menu
        id="user-menu"
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleCloseUserMenu}
      >
        <MenuItem onClick={() => router.push('/profile')}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('nav.profile')} />
        </MenuItem>
        <MenuItem onClick={() => router.push('/settings')}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('settings.title')} />
        </MenuItem>
        <MenuItem onClick={() => router.push('/admin')}>
          <ListItemIcon>
            <AdminPanelSettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={language === 'es' ? 'Modo Demo' : 'Demo Mode'} />
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t('nav.logout')} />
        </MenuItem>
      </Menu>
    </motion.nav>
  );
};

export { Navbar }; 