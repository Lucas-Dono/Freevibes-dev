'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
// Ya no necesitamos react-toastify
import type { ToastOptions } from 'react-toastify';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

// Definición de la estructura de una notificación
export interface SystemNotification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType, options?: ToastOptions) => void;
  // Estado de las notificaciones del sistema
  notifications: SystemNotification[];
  unreadCount: number;
  addSystemNotification: (message: string, type: NotificationType) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification debe ser usado dentro de un NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Ya no necesitamos limpiar toasts porque no los usaremos

  // Esta función quedará como no-op (sin operación) para mantener compatibilidad
  // con el código existente, pero no mostrará toasts
  const showNotification = (message: string, type: NotificationType, options?: ToastOptions) => {
    // No hacer nada - ya no mostramos toasts
    console.log("Toast deshabilitado:", message);
  };

  // Actualiza el contador de no leídos cuando cambian las notificaciones
  useEffect(() => {
    const newUnreadCount = notifications.filter(n => !n.read).length;
    setUnreadCount(newUnreadCount);
  }, [notifications]);

  // Sistema de notificaciones persistentes - ahora es el único que usamos
  const addSystemNotification = (message: string, type: NotificationType) => {
    // Verificar si ya existe una notificación con el mismo mensaje para evitar duplicados
    const isDuplicate = notifications.some(existingNotification =>
      existingNotification.message === message &&
      // Opcional: también verificar que no sea muy antigua (menos de 5 minutos)
      (new Date().getTime() - existingNotification.timestamp.getTime() < 5 * 60 * 1000)
    );

    // Si es un duplicado, no agregar
    if (isDuplicate) {
      console.log(`Notificación duplicada evitada: ${message}`);
      return;
    }

    const newNotification: SystemNotification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date(),
      read: false
    };

    // Solo guardar en el panel de notificaciones persistente
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Función para eliminar una notificación específica por ID
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  return (
    <NotificationContext.Provider value={{
      showNotification,
      notifications,
      unreadCount,
      addSystemNotification,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      removeNotification
    }}>
      {children}
      {/* Eliminamos el ToastContainer completamente */}
    </NotificationContext.Provider>
  );
};
