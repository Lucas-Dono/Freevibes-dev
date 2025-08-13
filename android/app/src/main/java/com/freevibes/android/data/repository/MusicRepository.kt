package com.freevibes.android.data.repository

import com.freevibes.android.data.api.MusicApiService
import com.freevibes.android.data.api.AddTrackRequest
import com.freevibes.android.data.api.CreatePlaylistRequest
import com.freevibes.android.data.local.OfflineMusicManager
import com.freevibes.android.data.model.*
import com.freevibes.android.utils.NetworkStateManager
import com.freevibes.android.utils.Result
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.net.UnknownHostException
import java.net.SocketTimeoutException
import java.io.IOException
// import javax.inject.Inject
// import javax.inject.Singleton

// @Singleton
class MusicRepository constructor(
    private val musicApiService: MusicApiService,
    private val offlineMusicManager: OfflineMusicManager,
    private val networkStateManager: NetworkStateManager
) {
    
    suspend fun search(
        query: String,
        type: String? = null,
        limit: Int = 20,
        offset: Int = 0
    ): Flow<Result<SearchResponse>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.search(query, type, limit, offset)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error en la búsqueda"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun searchTracks(
        query: String,
        limit: Int = 20,
        offset: Int = 0
    ): Flow<Result<List<Track>>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.searchTracks(query, limit, offset)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error en la búsqueda"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getTrack(trackId: String): Flow<Result<Track>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getTrack(trackId)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Track no encontrado"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getStreamUrl(trackId: String): Flow<Result<String>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getStreamUrl(trackId)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "URL de stream no disponible"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getPlaylists(
        category: String? = null,
        limit: Int = 20,
        offset: Int = 0
    ): Flow<Result<List<Playlist>>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getPlaylists(category, limit, offset)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al cargar playlists"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getPlaylist(playlistId: String): Flow<Result<Playlist>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getPlaylist(playlistId)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Playlist no encontrada"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getPlaylistTracks(
        playlistId: String,
        limit: Int = 50,
        offset: Int = 0
    ): Flow<Result<List<Track>>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getPlaylistTracks(playlistId, limit, offset)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al cargar tracks"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getUserPlaylists(): Flow<Result<List<Playlist>>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getUserPlaylists()
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al cargar playlists"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun createPlaylist(
        name: String,
        description: String? = null,
        isPublic: Boolean = false
    ): Flow<Result<Playlist>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.createPlaylist(
                CreatePlaylistRequest(name, description, isPublic)
            )
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al crear playlist"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun addTrackToPlaylist(
        playlistId: String,
        trackId: String
    ): Flow<Result<Unit>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.addTrackToPlaylist(
                playlistId,
                AddTrackRequest(trackId)
            )
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true) {
                    emit(Result.Success(Unit))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al agregar track"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun removeTrackFromPlaylist(
        playlistId: String,
        trackId: String
    ): Flow<Result<Unit>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.removeTrackFromPlaylist(playlistId, trackId)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true) {
                    emit(Result.Success(Unit))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al eliminar track"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun likeTrack(trackId: String): Flow<Result<Unit>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.likeTrack(trackId)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true) {
                    emit(Result.Success(Unit))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al dar like"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getRecommendations(limit: Int = 20): Flow<Result<List<Track>>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getRecommendations(limit)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al cargar recomendaciones"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getTrending(limit: Int = 20): Flow<Result<List<Track>>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getTrending(limit)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al cargar trending"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getUserStats(): Result<UserStats> {
        return try {
            val response = musicApiService.getUserStats()
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    Result.Success(apiResponse.data)
                } else {
                    Result.Error(apiResponse?.message ?: "Error al cargar estadísticas")
                }
            } else {
                Result.Error("Error del servidor")
            }
        } catch (e: Exception) {
            Result.Error("Error de red: ${e.message}")
        }
    }

    suspend fun getTrendingTracks(limit: Int = 20): Flow<Result<List<Track>>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getTrendingTracks(limit)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al cargar trending tracks"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)

    suspend fun getRecommendedTracks(limit: Int = 20): Flow<Result<List<Track>>> = flow {
        try {
            emit(Result.Loading)
            
            val response = musicApiService.getRecommendedTracks(limit)
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al cargar recommended tracks"))
                }
            } else {
                emit(Result.Error("Error del servidor"))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    // Offline methods
    suspend fun getOfflineTracks(): Flow<Result<List<Track>>> = flow {
        try {
            emit(Result.Loading)
            val tracks = offlineMusicManager.getOfflineTracks()
            emit(Result.Success(tracks))
        } catch (e: Exception) {
            emit(Result.Error("Error al cargar música offline: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun saveTrackOffline(track: Track, audioFilePath: String): Flow<Result<Boolean>> = flow {
        try {
            emit(Result.Loading)
            offlineMusicManager.saveOfflineTrack(track, audioFilePath)
            emit(Result.Success(true))
        } catch (e: Exception) {
            emit(Result.Error("Error al guardar música offline: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun removeTrackOffline(trackId: String): Flow<Result<Boolean>> = flow {
        try {
            emit(Result.Loading)
            offlineMusicManager.removeOfflineTrack(trackId)
            emit(Result.Success(true))
        } catch (e: Exception) {
            emit(Result.Error("Error al eliminar música offline: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun isTrackOfflineAvailable(trackId: String): Boolean {
        return offlineMusicManager.isTrackOfflineAvailable(trackId)
    }
    
    suspend fun getOfflineStorageSize(): Long {
        return offlineMusicManager.getOfflineStorageSize()
    }
    
    suspend fun clearOfflineMusic(): Flow<Result<Boolean>> = flow {
        try {
            emit(Result.Loading)
            offlineMusicManager.clearOfflineMusic()
            emit(Result.Success(true))
        } catch (e: Exception) {
            emit(Result.Error("Error al limpiar música offline: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    // Enhanced search with offline fallback
    suspend fun searchWithOfflineFallback(
        query: String,
        type: String? = null,
        limit: Int = 20,
        offset: Int = 0
    ): Flow<Result<SearchResponse>> = flow {
        try {
            emit(Result.Loading)
            
            // Try online search first if network is available
            if (networkStateManager.canMakeNetworkRequests()) {
                try {
                    val response = musicApiService.search(query, type, limit, offset)
                    if (response.isSuccessful) {
                        val apiResponse = response.body()
                        if (apiResponse?.success == true && apiResponse.data != null) {
                            networkStateManager.setServerReachable(true)
                            emit(Result.Success(apiResponse.data))
                            return@flow
                        }
                    }
                } catch (e: UnknownHostException) {
                    networkStateManager.setServerReachable(false)
                } catch (e: SocketTimeoutException) {
                    networkStateManager.setServerReachable(false)
                } catch (e: IOException) {
                    networkStateManager.setServerReachable(false)
                }
            }
            
            // Fallback to offline search
            val offlineTracks = offlineMusicManager.getOfflineTracks()
            val filteredTracks = offlineTracks.filter { track ->
                track.title.contains(query, ignoreCase = true) ||
                track.artist.contains(query, ignoreCase = true) ||
                track.album?.contains(query, ignoreCase = true) == true
            }
            
            val searchResponse = SearchResponse(
                tracks = filteredTracks,
                playlists = emptyList(),
                artists = emptyList(),
                albums = emptyList()
            )
            
            emit(Result.Success(searchResponse))
            
        } catch (e: Exception) {
            emit(Result.Error("Error en búsqueda: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
}