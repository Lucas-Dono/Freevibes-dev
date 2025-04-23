'use client';

import { useNotification } from "@/contexts/NotificationContext";


type NotificationType = 'success' | 'error' | 'info' | 'warning';

export const useCustomNotifications = () => {
  const {
    showNotification,
    notifications,
    unreadCount,
    addSystemNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    removeNotification
  } = useNotification();

  // Notificaciones para acciones relacionadas con la reproducción de música
  const musicNotifications = {
    onTrackPlay: (trackName: string, artistName: string) => {
      // Solo agregar al panel de notificaciones persistente
      addSystemNotification(`Reproduciendo "${trackName}" de ${artistName}`, 'info');
    },
    onTrackAdded: (trackName: string) => {
      // Solo agregar al panel de notificaciones persistente
      addSystemNotification(`"${trackName}" añadida a la cola`, 'success');
    },
    onPlaylistStart: (playlistName: string) => {
      // Solo agregar al panel de notificaciones persistente
      addSystemNotification(`Reproduciendo playlist "${playlistName}"`, 'info');
    },
    onRadioStart: (trackName: string) => {
      // Solo agregar al panel de notificaciones persistente
      addSystemNotification(`Radio iniciada basada en "${trackName}"`, 'success');
    }
  };

  // Notificaciones para acciones relacionadas con la biblioteca
  const libraryNotifications = {
    onTrackLiked: (trackName: string) => {
      addSystemNotification(`"${trackName}" añadida a tus favoritos`, 'success');
    },
    onTrackUnliked: (trackName: string) => {
      addSystemNotification(`"${trackName}" eliminada de tus favoritos`, 'info');
    },
    onArtistFollowed: (artistName: string) => {
      addSystemNotification(`Ahora sigues a ${artistName}`, 'success');
    },
    onArtistUnfollowed: (artistName: string) => {
      addSystemNotification(`Has dejado de seguir a ${artistName}`, 'info');
    },
  };

  // Notificaciones genéricas del sistema
  const systemNotifications = {
    onNewUpdate: () => {
      addSystemNotification('¡Nueva actualización disponible!', 'info');
    },
    onRecommendation: (recommendation: string) => {
      addSystemNotification(`Recomendación: ${recommendation}`, 'info');
    },
    onNewRelease: (artist: string, albumName: string) => {
      addSystemNotification(`Nuevo lanzamiento: "${albumName}" de ${artist}`, 'info');
    }
  };

  // Notificaciones para errores generales
  const errorNotifications = {
    onNetworkError: () => {
      addSystemNotification('Error de conexión. Verifica tu conexión a internet', 'error');
    },
    onServerError: () => {
      addSystemNotification('Error del servidor. Intenta más tarde', 'error');
    },
    onPlaybackError: () => {
      addSystemNotification('Error al reproducir la pista', 'error');
    },
    onUnexpectedError: (message?: string) => {
      const errorMsg = `Error inesperado${message ? `: ${message}` : ''}`;
      addSystemNotification(errorMsg, 'error');
    },
  };

  // Función para generar notificaciones demo (para probar el sistema)
  const generateDemoNotifications = () => {
    const demoNotifications = [
      { message: "Nuevo álbum de tu artista favorito", type: 'info' as NotificationType },
      { message: "La canción se ha añadido a tu playlist", type: 'success' as NotificationType },
      { message: "Actualización de la aplicación disponible", type: 'info' as NotificationType },
      { message: "Error al cargar algunas canciones", type: 'error' as NotificationType },
      { message: "Descubre música nueva en la sección 'Para ti'", type: 'info' as NotificationType },
    ];

    // Primero, borrar notificaciones existentes si hay demasiadas (para evitar acumulación)
    if (notifications.length > 5) {
      // Opcional: limpiar todas antes de agregar nuevas
      clearNotifications();
    }

    // Seleccionar 3 notificaciones aleatorias sin repetición
    const selectedNotifications = [...demoNotifications]
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    // Verificar si ya existen notificaciones con el mismo mensaje
    // Para evitar duplicados en el panel
    const existingMessages = new Set(notifications.map(n => n.message));
    const uniqueNotifications = selectedNotifications.filter(
      notification => !existingMessages.has(notification.message)
    );

    // Solo generar notificaciones únicas que no existan ya en el panel
    uniqueNotifications.forEach((notification, index) => {
      setTimeout(() => {
        // Solo agregar al panel de notificaciones persistente
        addSystemNotification(notification.message, notification.type);
      }, index * 1000);          // Mayor retraso entre notificaciones (1 segundo)
    });
  };

  return {
    musicNotifications,
    libraryNotifications,
    systemNotifications,
    errorNotifications,
    // Estado y métodos de notificaciones del sistema
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    removeNotification,
    // También exportamos las funciones originales para casos personalizados
    showNotification,
    addSystemNotification,
    // Función demo
    generateDemoNotifications
  };
};
