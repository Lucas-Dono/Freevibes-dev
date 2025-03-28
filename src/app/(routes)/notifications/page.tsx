'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCustomNotifications } from '@/hooks/useCustomNotifications';
import { SystemNotification } from '@/contexts/NotificationContext';

export default function NotificationsPage() {
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const { 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    clearNotifications 
  } = useCustomNotifications();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <></>;

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

  // Filtrar notificaciones según el estado
  const filteredNotifications = (): SystemNotification[] => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    if (filter === 'read') return notifications.filter(n => n.read);
    return notifications;
  };

  // Obtener el color del indicador según el tipo de notificación
  const getNotificationColor = (type: string): string => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="min-h-screen py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-6">Centro de notificaciones</h1>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  filter === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-card-bg text-gray-300 hover:bg-card-bg/80'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  filter === 'unread'
                    ? 'bg-primary text-white'
                    : 'bg-card-bg text-gray-300 hover:bg-card-bg/80'
                }`}
              >
                No leídas
              </button>
              <button
                onClick={() => setFilter('read')}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  filter === 'read'
                    ? 'bg-primary text-white'
                    : 'bg-card-bg text-gray-300 hover:bg-card-bg/80'
                }`}
              >
                Leídas
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-card-bg hover:bg-card-bg/80 rounded-lg text-sm transition-colors"
              >
                Marcar todas como leídas
              </button>
              <button
                onClick={clearNotifications}
                className="px-4 py-2 bg-card-bg hover:bg-card-bg/80 rounded-lg text-sm transition-colors"
              >
                Borrar todas
              </button>
            </div>
          </div>
        </div>
        
        {filteredNotifications().length === 0 ? (
          <div className="bg-card-bg rounded-xl p-10 text-center">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
            </svg>
            <h2 className="text-xl font-semibold mb-2">No hay notificaciones</h2>
            <p className="text-gray-400">
              {filter === 'all' 
                ? 'No tienes notificaciones en este momento.' 
                : filter === 'unread' 
                ? 'No tienes notificaciones sin leer.' 
                : 'No tienes notificaciones leídas.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications().map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 bg-card-bg rounded-xl transition-colors hover:bg-opacity-80 ${
                  !notification.read ? 'border-l-4 border-primary' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start">
                  <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${getNotificationColor(notification.type)}`} />
                  <div className="ml-4 flex-grow">
                    <p className="text-white">{notification.message}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {formatNotificationTime(notification.timestamp)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="bg-primary px-2 py-1 rounded-full text-xs font-medium">
                      Nueva
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 