package com.freevibes.android.ui.offline

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freevibes.android.data.model.Track
import com.freevibes.android.data.repository.MusicRepository
import com.freevibes.android.utils.NetworkStateManager
import com.freevibes.android.utils.Result
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class OfflineUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isConnected: Boolean = false,
    val isServerReachable: Boolean = false,
    val storageUsed: Long = 0L,
    val offlineTracksCount: Int = 0
)

class OfflineViewModel(
    private val musicRepository: MusicRepository,
    private val networkStateManager: NetworkStateManager
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(OfflineUiState())
    val uiState: StateFlow<OfflineUiState> = _uiState.asStateFlow()
    
    private val _offlineTracks = MutableStateFlow<Result<List<Track>>>(Result.Loading)
    val offlineTracks: StateFlow<Result<List<Track>>> = _offlineTracks.asStateFlow()
    
    init {
        observeNetworkState()
    }
    
    private fun observeNetworkState() {
        viewModelScope.launch {
            networkStateManager.isConnected.collect { isConnected ->
                _uiState.value = _uiState.value.copy(isConnected = isConnected)
            }
        }
        
        viewModelScope.launch {
            networkStateManager.isServerReachable.collect { isServerReachable ->
                _uiState.value = _uiState.value.copy(isServerReachable = isServerReachable)
            }
        }
    }
    
    fun loadOfflineTracks() {
        viewModelScope.launch {
            musicRepository.getOfflineTracks().collect { result ->
                _offlineTracks.value = result
                
                when (result) {
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            offlineTracksCount = result.data.size,
                            isLoading = false,
                            error = null
                        )
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = result.message
                        )
                    }
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(isLoading = true)
                    }
                }
            }
        }
    }
    
    fun loadNetworkStatus() {
        _uiState.value = _uiState.value.copy(
            isConnected = networkStateManager.isConnected.value,
            isServerReachable = networkStateManager.isServerReachable.value
        )
    }
    
    fun loadStorageInfo() {
        viewModelScope.launch {
            try {
                val storageUsed = musicRepository.getOfflineStorageSize()
                _uiState.value = _uiState.value.copy(storageUsed = storageUsed)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    error = "Error al cargar información de almacenamiento: ${e.message}"
                )
            }
        }
    }
    
    fun clearOfflineMusic() {
        viewModelScope.launch {
            musicRepository.clearOfflineMusic().collect { result ->
                when (result) {
                    is Result.Success -> {
                        loadOfflineTracks()
                        loadStorageInfo()
                        _uiState.value = _uiState.value.copy(
                            error = null
                        )
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            error = result.message
                        )
                    }
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(isLoading = true)
                    }
                }
            }
        }
    }
    
    fun removeTrackOffline(trackId: String) {
        viewModelScope.launch {
            musicRepository.removeTrackOffline(trackId).collect { result ->
                when (result) {
                    is Result.Success -> {
                        loadOfflineTracks()
                        loadStorageInfo()
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            error = result.message
                        )
                    }
                    is Result.Loading -> {
                        // Handle loading if needed
                    }
                }
            }
        }
    }
    
    fun playTrack(track: Track) {
        // TODO: Integrate with PlayerService to play offline track
        // This would typically send an intent to PlayerService
    }
    
    fun showTrackOptions(track: Track) {
        // TODO: Show bottom sheet or dialog with track options
        // For now, just remove the track
        removeTrackOffline(track.id)
    }
    
    fun downloadTrack(track: Track) {
        viewModelScope.launch {
            // TODO: Implement track download functionality
            // This would typically use a download manager to download the audio file
            // and then save it using musicRepository.saveTrackOffline()
        }
    }
}