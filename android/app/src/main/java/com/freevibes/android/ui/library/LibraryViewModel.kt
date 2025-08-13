package com.freevibes.android.ui.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freevibes.android.data.model.Playlist
import com.freevibes.android.data.model.Track
import com.freevibes.android.data.repository.MusicRepository
// import com.freevibes.android.data.repository.PlaylistRepository // TODO: Create PlaylistRepository
import com.freevibes.android.utils.Result
// import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
// import javax.inject.Inject

data class LibraryUiState(
    val isLoading: Boolean = false,
    val playlists: List<Playlist> = emptyList(),
    val likedTracks: List<Track> = emptyList(),
    val recentlyPlayed: List<Track> = emptyList(),
    val errorMessage: String? = null,
    val selectedTab: LibraryTab = LibraryTab.PLAYLISTS
)

enum class LibraryTab {
    PLAYLISTS,
    LIKED_TRACKS,
    RECENTLY_PLAYED
}

sealed class LibraryNavigationEvent {
    data class NavigateToPlaylist(val playlist: Playlist) : LibraryNavigationEvent()
    data class NavigateToPlayer(val track: Track) : LibraryNavigationEvent()
    data class PlayTrack(val track: Track) : LibraryNavigationEvent()
    object NavigateToCreatePlaylist : LibraryNavigationEvent()
}

// @HiltViewModel
class LibraryViewModel constructor(
    // private val playlistRepository: PlaylistRepository, // TODO: Add when PlaylistRepository is created
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LibraryUiState())
    val uiState: StateFlow<LibraryUiState> = _uiState.asStateFlow()

    private val _navigationEvent = MutableStateFlow<LibraryNavigationEvent?>(null)
    val navigationEvent: StateFlow<LibraryNavigationEvent?> = _navigationEvent.asStateFlow()

    init {
        loadLibraryData()
    }

    fun onTabSelected(tab: LibraryTab) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
        
        // Load data for the selected tab if not already loaded
        when (tab) {
            LibraryTab.PLAYLISTS -> {
                if (_uiState.value.playlists.isEmpty()) {
                    loadPlaylists()
                }
            }
            LibraryTab.LIKED_TRACKS -> {
                if (_uiState.value.likedTracks.isEmpty()) {
                    loadLikedTracks()
                }
            }
            LibraryTab.RECENTLY_PLAYED -> {
                if (_uiState.value.recentlyPlayed.isEmpty()) {
                    loadRecentlyPlayed()
                }
            }
        }
    }

    fun loadLibraryData() {
        loadPlaylists()
        loadLikedTracks()
        loadRecentlyPlayed()
    }

    fun refreshCurrentTab() {
        when (_uiState.value.selectedTab) {
            LibraryTab.PLAYLISTS -> loadPlaylists()
            LibraryTab.LIKED_TRACKS -> loadLikedTracks()
            LibraryTab.RECENTLY_PLAYED -> loadRecentlyPlayed()
        }
    }

    private fun loadPlaylists() {
        // TODO: Implement loadPlaylists when PlaylistRepository is available
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                playlists = emptyList(),
                errorMessage = null
            )
        }
    }

    private fun loadLikedTracks() {
        // TODO: Implement getLikedTracks when available in MusicRepository
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                likedTracks = emptyList(),
                errorMessage = null
            )
        }
    }

    private fun loadRecentlyPlayed() {
        // TODO: Implement getRecentlyPlayed when available in MusicRepository
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                recentlyPlayed = emptyList(),
                errorMessage = null
            )
        }
    }

    fun onPlaylistClick(playlist: Playlist) {
        _navigationEvent.value = LibraryNavigationEvent.NavigateToPlaylist(playlist)
    }

    fun onTrackClick(track: Track) {
        _navigationEvent.value = LibraryNavigationEvent.NavigateToPlayer(track)
    }

    fun onPlayTrack(track: Track) {
        _navigationEvent.value = LibraryNavigationEvent.PlayTrack(track)
    }

    fun onLikeTrack(track: Track) {
        // TODO: Implement toggleLike functionality when available in MusicRepository
        viewModelScope.launch {
            // Temporarily update UI without API call
            val updatedTrack = track.copy(isLiked = !track.isLiked)
            updateTrackInLists(updatedTrack)
        }
    }

    fun onCreatePlaylistClick() {
        _navigationEvent.value = LibraryNavigationEvent.NavigateToCreatePlaylist
    }

    fun deletePlaylist(playlist: Playlist) {
        // TODO: Implement deletePlaylist when PlaylistRepository is available
        viewModelScope.launch {
            // Temporarily remove from UI without API call
            val updatedPlaylists = _uiState.value.playlists.filter { it.id != playlist.id }
            _uiState.value = _uiState.value.copy(playlists = updatedPlaylists)
        }
    }

    private fun updateTrackInLists(updatedTrack: Track) {
        val currentState = _uiState.value
        
        // Update liked tracks list
        val updatedLikedTracks = currentState.likedTracks.map { track ->
            if (track.id == updatedTrack.id) updatedTrack else track
        }
        
        // Update recently played list
        val updatedRecentlyPlayed = currentState.recentlyPlayed.map { track ->
            if (track.id == updatedTrack.id) updatedTrack else track
        }
        
        _uiState.value = currentState.copy(
            likedTracks = updatedLikedTracks,
            recentlyPlayed = updatedRecentlyPlayed
        )
    }

    fun clearNavigationEvent() {
        _navigationEvent.value = null
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }
}