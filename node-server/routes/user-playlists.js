const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth-middleware');
const router = express.Router();

// Almacenamiento temporal de playlists (en producción usar base de datos)
const userPlaylists = new Map();
const playlistTracks = new Map();

/**
 * @route GET /api/user/playlists
 * @desc Obtener playlists del usuario autenticado
 * @access Private
 */
router.get('/playlists', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const playlists = userPlaylists.get(userId) || [];
    
    res.status(200).json({
      success: true,
      playlists: playlists.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        trackCount: playlist.trackCount || 0,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        isPublic: playlist.isPublic || false
      }))
    });
  } catch (error) {
    console.error('Error obteniendo playlists:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/user/playlists
 * @desc Crear nueva playlist
 * @access Private
 */
router.post('/playlists', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, isPublic } = req.body;

    // Validación
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la playlist es requerido'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la playlist no puede exceder 100 caracteres'
      });
    }

    // Crear playlist
    const playlistId = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newPlaylist = {
      id: playlistId,
      name: name.trim(),
      description: description?.trim() || '',
      userId,
      trackCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: Boolean(isPublic)
    };

    // Obtener playlists existentes del usuario
    const existingPlaylists = userPlaylists.get(userId) || [];
    
    // Verificar si ya existe una playlist con el mismo nombre
    const duplicateName = existingPlaylists.find(p => 
      p.name.toLowerCase() === newPlaylist.name.toLowerCase()
    );
    
    if (duplicateName) {
      return res.status(400).json({
        success: false,
        message: 'Ya tienes una playlist con ese nombre'
      });
    }

    // Agregar nueva playlist
    existingPlaylists.push(newPlaylist);
    userPlaylists.set(userId, existingPlaylists);

    // Inicializar tracks de la playlist
    playlistTracks.set(playlistId, []);

    res.status(201).json({
      success: true,
      message: 'Playlist creada exitosamente',
      playlist: {
        id: newPlaylist.id,
        name: newPlaylist.name,
        description: newPlaylist.description,
        trackCount: newPlaylist.trackCount,
        createdAt: newPlaylist.createdAt,
        updatedAt: newPlaylist.updatedAt,
        isPublic: newPlaylist.isPublic
      }
    });
  } catch (error) {
    console.error('Error creando playlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route GET /api/user/playlists/:playlistId
 * @desc Obtener detalles de una playlist específica
 * @access Private/Public (dependiendo de isPublic)
 */
router.get('/playlists/:playlistId', optionalAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const currentUserId = req.user?.userId;

    // Buscar la playlist en todas las playlists de usuarios
    let foundPlaylist = null;
    let playlistOwner = null;

    for (const [userId, playlists] of userPlaylists.entries()) {
      const playlist = playlists.find(p => p.id === playlistId);
      if (playlist) {
        foundPlaylist = playlist;
        playlistOwner = userId;
        break;
      }
    }

    if (!foundPlaylist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist no encontrada'
      });
    }

    // Verificar permisos
    const isOwner = currentUserId === playlistOwner;
    const isPublic = foundPlaylist.isPublic;

    if (!isPublic && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta playlist'
      });
    }

    // Obtener tracks de la playlist
    const tracks = playlistTracks.get(playlistId) || [];

    res.status(200).json({
      success: true,
      playlist: {
        id: foundPlaylist.id,
        name: foundPlaylist.name,
        description: foundPlaylist.description,
        trackCount: tracks.length,
        createdAt: foundPlaylist.createdAt,
        updatedAt: foundPlaylist.updatedAt,
        isPublic: foundPlaylist.isPublic,
        isOwner,
        tracks
      }
    });
  } catch (error) {
    console.error('Error obteniendo playlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route PUT /api/user/playlists/:playlistId
 * @desc Actualizar playlist
 * @access Private (solo propietario)
 */
router.put('/playlists/:playlistId', requireAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.user.userId;
    const { name, description, isPublic } = req.body;

    // Obtener playlists del usuario
    const userPlaylistsArray = userPlaylists.get(userId) || [];
    const playlistIndex = userPlaylistsArray.findIndex(p => p.id === playlistId);

    if (playlistIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Playlist no encontrada'
      });
    }

    const playlist = userPlaylistsArray[playlistIndex];

    // Validar nombre si se proporciona
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la playlist es requerido'
        });
      }

      if (name.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la playlist no puede exceder 100 caracteres'
        });
      }

      // Verificar duplicados (excluyendo la playlist actual)
      const duplicateName = userPlaylistsArray.find((p, index) => 
        index !== playlistIndex && p.name.toLowerCase() === name.trim().toLowerCase()
      );
      
      if (duplicateName) {
        return res.status(400).json({
          success: false,
          message: 'Ya tienes una playlist con ese nombre'
        });
      }

      playlist.name = name.trim();
    }

    // Actualizar otros campos
    if (description !== undefined) {
      playlist.description = description?.trim() || '';
    }

    if (isPublic !== undefined) {
      playlist.isPublic = Boolean(isPublic);
    }

    playlist.updatedAt = new Date().toISOString();

    // Guardar cambios
    userPlaylistsArray[playlistIndex] = playlist;
    userPlaylists.set(userId, userPlaylistsArray);

    res.status(200).json({
      success: true,
      message: 'Playlist actualizada exitosamente',
      playlist: {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        trackCount: playlist.trackCount,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        isPublic: playlist.isPublic
      }
    });
  } catch (error) {
    console.error('Error actualizando playlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route DELETE /api/user/playlists/:playlistId
 * @desc Eliminar playlist
 * @access Private (solo propietario)
 */
router.delete('/playlists/:playlistId', requireAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.user.userId;

    // Obtener playlists del usuario
    const userPlaylistsArray = userPlaylists.get(userId) || [];
    const playlistIndex = userPlaylistsArray.findIndex(p => p.id === playlistId);

    if (playlistIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Playlist no encontrada'
      });
    }

    // Eliminar playlist
    userPlaylistsArray.splice(playlistIndex, 1);
    userPlaylists.set(userId, userPlaylistsArray);

    // Eliminar tracks de la playlist
    playlistTracks.delete(playlistId);

    res.status(200).json({
      success: true,
      message: 'Playlist eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando playlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route POST /api/user/playlists/:playlistId/tracks
 * @desc Agregar track a playlist
 * @access Private (solo propietario)
 */
router.post('/playlists/:playlistId/tracks', requireAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const userId = req.user.userId;
    const { trackId, title, artist, duration, thumbnail } = req.body;

    // Verificar que la playlist pertenece al usuario
    const userPlaylistsArray = userPlaylists.get(userId) || [];
    const playlist = userPlaylistsArray.find(p => p.id === playlistId);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist no encontrada'
      });
    }

    // Validar datos del track
    if (!trackId || !title || !artist) {
      return res.status(400).json({
        success: false,
        message: 'trackId, title y artist son requeridos'
      });
    }

    // Obtener tracks actuales
    const tracks = playlistTracks.get(playlistId) || [];

    // Verificar si el track ya existe en la playlist
    const existingTrack = tracks.find(t => t.trackId === trackId);
    if (existingTrack) {
      return res.status(400).json({
        success: false,
        message: 'El track ya está en la playlist'
      });
    }

    // Agregar nuevo track
    const newTrack = {
      trackId,
      title: title.trim(),
      artist: artist.trim(),
      duration: duration || null,
      thumbnail: thumbnail || null,
      addedAt: new Date().toISOString()
    };

    tracks.push(newTrack);
    playlistTracks.set(playlistId, tracks);

    // Actualizar contador de tracks en la playlist
    playlist.trackCount = tracks.length;
    playlist.updatedAt = new Date().toISOString();

    res.status(201).json({
      success: true,
      message: 'Track agregado a la playlist exitosamente',
      track: newTrack
    });
  } catch (error) {
    console.error('Error agregando track a playlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * @route DELETE /api/user/playlists/:playlistId/tracks/:trackId
 * @desc Eliminar track de playlist
 * @access Private (solo propietario)
 */
router.delete('/playlists/:playlistId/tracks/:trackId', requireAuth, async (req, res) => {
  try {
    const { playlistId, trackId } = req.params;
    const userId = req.user.userId;

    // Verificar que la playlist pertenece al usuario
    const userPlaylistsArray = userPlaylists.get(userId) || [];
    const playlist = userPlaylistsArray.find(p => p.id === playlistId);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist no encontrada'
      });
    }

    // Obtener tracks actuales
    const tracks = playlistTracks.get(playlistId) || [];
    const trackIndex = tracks.findIndex(t => t.trackId === trackId);

    if (trackIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Track no encontrado en la playlist'
      });
    }

    // Eliminar track
    tracks.splice(trackIndex, 1);
    playlistTracks.set(playlistId, tracks);

    // Actualizar contador de tracks en la playlist
    playlist.trackCount = tracks.length;
    playlist.updatedAt = new Date().toISOString();

    res.status(200).json({
      success: true,
      message: 'Track eliminado de la playlist exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando track de playlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;