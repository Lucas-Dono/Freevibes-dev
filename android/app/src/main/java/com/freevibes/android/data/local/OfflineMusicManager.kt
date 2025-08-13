package com.freevibes.android.data.local

import android.content.Context
import android.content.SharedPreferences
import com.freevibes.android.data.model.Track
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OfflineMusicManager @Inject constructor(
    private val context: Context
) {
    private val sharedPreferences: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME, Context.MODE_PRIVATE
    )
    private val gson = Gson()
    
    suspend fun saveOfflineTrack(track: Track, audioFilePath: String) {
        withContext(Dispatchers.IO) {
            val offlineTracks = getOfflineTracks().toMutableList()
            
            // Remove existing track if present
            offlineTracks.removeAll { it.id == track.id }
            
            // Add updated track with local file path
            val offlineTrack = track.copy(
                audioUrl = audioFilePath,
                isOfflineAvailable = true
            )
            offlineTracks.add(offlineTrack)
            
            // Save to preferences
            val json = gson.toJson(offlineTracks)
            sharedPreferences.edit()
                .putString(KEY_OFFLINE_TRACKS, json)
                .apply()
        }
    }
    
    suspend fun getOfflineTracks(): List<Track> {
        return withContext(Dispatchers.IO) {
            val json = sharedPreferences.getString(KEY_OFFLINE_TRACKS, null)
            if (json != null) {
                val type = object : TypeToken<List<Track>>() {}.type
                gson.fromJson(json, type) ?: emptyList()
            } else {
                emptyList()
            }
        }
    }
    
    suspend fun getOfflineTrack(trackId: String): Track? {
        return withContext(Dispatchers.IO) {
            getOfflineTracks().find { it.id == trackId }
        }
    }
    
    suspend fun isTrackOfflineAvailable(trackId: String): Boolean {
        return withContext(Dispatchers.IO) {
            val track = getOfflineTrack(trackId)
            track != null && File(track.audioUrl).exists()
        }
    }
    
    suspend fun removeOfflineTrack(trackId: String) {
        withContext(Dispatchers.IO) {
            val offlineTracks = getOfflineTracks().toMutableList()
            val trackToRemove = offlineTracks.find { it.id == trackId }
            
            if (trackToRemove != null) {
                // Delete audio file
                try {
                    File(trackToRemove.audioUrl).delete()
                } catch (e: Exception) {
                    // Ignore file deletion errors
                }
                
                // Remove from list
                offlineTracks.removeAll { it.id == trackId }
                
                // Save updated list
                val json = gson.toJson(offlineTracks)
                sharedPreferences.edit()
                    .putString(KEY_OFFLINE_TRACKS, json)
                    .apply()
            }
        }
    }
    
    suspend fun getOfflineStorageSize(): Long {
        return withContext(Dispatchers.IO) {
            val offlineTracks = getOfflineTracks()
            var totalSize = 0L
            
            offlineTracks.forEach { track ->
                try {
                    val file = File(track.audioUrl)
                    if (file.exists()) {
                        totalSize += file.length()
                    }
                } catch (e: Exception) {
                    // Ignore errors
                }
            }
            
            totalSize
        }
    }
    
    suspend fun clearOfflineMusic() {
        withContext(Dispatchers.IO) {
            val offlineTracks = getOfflineTracks()
            
            // Delete all audio files
            offlineTracks.forEach { track ->
                try {
                    File(track.audioUrl).delete()
                } catch (e: Exception) {
                    // Ignore file deletion errors
                }
            }
            
            // Clear preferences
            sharedPreferences.edit()
                .remove(KEY_OFFLINE_TRACKS)
                .apply()
        }
    }
    
    suspend fun saveOfflinePlaylist(playlistId: String, tracks: List<Track>) {
        withContext(Dispatchers.IO) {
            val json = gson.toJson(tracks)
            sharedPreferences.edit()
                .putString("${KEY_OFFLINE_PLAYLISTS}_$playlistId", json)
                .apply()
        }
    }
    
    suspend fun getOfflinePlaylist(playlistId: String): List<Track> {
        return withContext(Dispatchers.IO) {
            val json = sharedPreferences.getString("${KEY_OFFLINE_PLAYLISTS}_$playlistId", null)
            if (json != null) {
                val type = object : TypeToken<List<Track>>() {}.type
                gson.fromJson(json, type) ?: emptyList()
            } else {
                emptyList()
            }
        }
    }
    
    companion object {
        private const val PREFS_NAME = "offline_music_prefs"
        private const val KEY_OFFLINE_TRACKS = "offline_tracks"
        private const val KEY_OFFLINE_PLAYLISTS = "offline_playlists"
    }
}