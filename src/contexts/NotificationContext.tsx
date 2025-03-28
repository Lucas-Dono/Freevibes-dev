'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { toast, ToastContainer, ToastOptions } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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

  // Toast notifications
  const showNotification = (message: string, type: NotificationType, options?: ToastOptions) => {
    toast[type](message, {
      position: 'top-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      ...options,
    });
  };

  // Actualiza el contador de no leídos cuando cambian las notificaciones
  useEffect(() => {
    const newUnreadCount = notifications.filter(n => !n.read).length;
    setUnreadCount(newUnreadCount);
  }, [notifications]);

  // Sistema de notificaciones persistentes
  const addSystemNotification = (message: string, type: NotificationType) => {
    const newNotification: SystemNotification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);
    // También mostrar un toast para alertar al usuario
    showNotification(message, type);
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

  return (
    <NotificationContext.Provider value={{ 
      showNotification, 
      notifications, 
      unreadCount, 
      addSystemNotification,
      markAsRead,
      markAllAsRead,
      clearNotifications
    }}>
      {children}
      <ToastContainer 
        theme="dark"
        style={{ zIndex: 9999 }}
      />
    </NotificationContext.Provider>
  );
}; 