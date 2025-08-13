package com.freevibes.android.ui.download

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freevibes.android.data.model.Track
import com.freevibes.android.download.MusicDownloadManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DownloadViewModel @Inject constructor(
    private val downloadManager: MusicDownloadManager
) : ViewModel() {
    
    private val _downloadState = MutableStateFlow<DownloadState>(DownloadState.Idle)
    val downloadState: StateFlow<DownloadState> = _downloadState.asStateFlow()
    
    val downloadProgress: Flow<Map<String, Float>> = downloadManager.downloadProgress
    val downloadedTracks: Flow<Set<String>> = downloadManager.downloadedTracks
    
    // Combine download progress and downloaded tracks for UI
    val downloadInfo = combine(
        downloadProgress,
        downloadedTracks
    ) { progress, downloaded ->
        DownloadInfo(progress, downloaded)
    }
    
    fun downloadTrack(track: Track) {
        viewModelScope.launch {
            try {
                _downloadState.value = DownloadState.Downloading(track.id)
                downloadManager.downloadTrack(
                    trackId = track.id,
                    trackUrl = track.streamUrl ?: "",
                    title = track.title,
                    artist = track.artist
                )
                _downloadState.value = DownloadState.Success(track.id)
            } catch (e: Exception) {
                _downloadState.value = DownloadState.Error(e.message ?: "Error desconocido")
            }
        }
    }
    
    fun removeDownload(trackId: String) {
        viewModelScope.launch {
            try {
                downloadManager.removeDownload(trackId)
                _downloadState.value = DownloadState.Removed(trackId)
            } catch (e: Exception) {
                _downloadState.value = DownloadState.Error(e.message ?: "Error al eliminar descarga")
            }
        }
    }
    
    fun isTrackDownloaded(trackId: String): Boolean {
        return downloadManager.isTrackDownloaded(trackId)
    }
    
    fun getDownloadProgress(trackId: String): Float {
        return downloadManager.getDownloadProgress(trackId)
    }
    
    fun clearDownloadState() {
        _downloadState.value = DownloadState.Idle
    }
}

sealed class DownloadState {
    object Idle : DownloadState()
    data class Downloading(val trackId: String) : DownloadState()
    data class Success(val trackId: String) : DownloadState()
    data class Error(val message: String) : DownloadState()
    data class Removed(val trackId: String) : DownloadState()
}

data class DownloadInfo(
    val progress: Map<String, Float>,
    val downloadedTracks: Set<String>
)