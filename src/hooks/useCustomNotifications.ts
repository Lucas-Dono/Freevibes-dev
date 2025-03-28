'use client';

import { useNotification } from "@/contexts/NotificationContext";

export const useCustomNotifications = () => {
  const { 
    showNotification, 
    notifications, 
    unreadCount, 
    addSystemNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications
  } = useNotification();

  // Notificaciones para acciones relacionadas con el perfil
  const profileNotifications = {
    onProfileUpdated: () => {
      addSystemNotification('Perfil actualizado con éxito', 'success');
    },
    onProfileUpdateError: (message?: string) => {
      addSystemNotification(`Error al actualizar el perfil${message ? `: ${message}` : ''}`, 'error');
    },
    onFormErrors: () => showNotification('Por favor, corrige los errores en el formulario', 'warning'),
  };

  // Notificaciones para acciones relacionadas con playlists
  const playlistNotifications = {
    onPlaylistCreated: (name: string) => {
      addSystemNotification(`Playlist "${name}" creada exitosamente`, 'success');
    },
    onPlaylistDeleted: (name: string) => {
      addSystemNotification(`Playlist "${name}" eliminada`, 'info');
    },
    onPlaylistUpdated: (name: string) => {
      addSystemNotification(`Playlist "${name}" actualizada`, 'success');
    },
    onTrackAdded: (trackName: string, playlistName: string) => {
      addSystemNotification(`"${trackName}" añadida a ${playlistName}`, 'success');
    },
    onTrackRemoved: (trackName: string, playlistName: string) => {
      addSystemNotification(`"${trackName}" eliminada de ${playlistName}`, 'info');
    },
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

  // Notificaciones para acciones relacionadas con los usuarios
  const userNotifications = {
    onUserFollowed: (userName: string) => {
      addSystemNotification(`Ahora sigues a ${userName}`, 'success');
    },
    onUserUnfollowed: (userName: string) => {
      addSystemNotification(`Has dejado de seguir a ${userName}`, 'info');
    },
  };

  // Notificaciones para errores generales
  const errorNotifications = {
    onNetworkError: () => addSystemNotification('Error de conexión. Verifica tu conexión a internet', 'error'),
    onServerError: () => addSystemNotification('Error del servidor. Intenta más tarde', 'error'),
    onPermissionDenied: () => addSystemNotification('Permiso denegado para realizar esta acción', 'error'),
    onUnexpectedError: (message?: string) => addSystemNotification(`Error inesperado${message ? `: ${message}` : ''}`, 'error'),
  };

  return {
    profileNotifications,
    playlistNotifications,
    libraryNotifications,
    userNotifications,
    errorNotifications,
    // Estado y métodos de notificaciones del sistema
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    // También exportamos las funciones originales para casos personalizados
    showNotification,
    addSystemNotification,
  };
}; 