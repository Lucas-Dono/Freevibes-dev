package com.freevibes.android.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freevibes.android.data.model.Track
import com.freevibes.android.data.repository.MusicRepository
import com.freevibes.android.utils.Result
// import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
// import javax.inject.Inject

// @HiltViewModel
class HomeViewModel constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private val _navigationEvent = MutableStateFlow<HomeNavigationEvent?>(null)
    val navigationEvent: StateFlow<HomeNavigationEvent?> = _navigationEvent.asStateFlow()

    init {
        loadHomeData()
    }

    fun loadHomeData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            viewModelScope.launch {
            musicRepository.getTrendingTracks().collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(isLoadingTrending = true)
                    }
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            trendingTracks = result.data,
                            isLoadingTrending = false
                        )
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isLoadingTrending = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
        }
        
        viewModelScope.launch {
            // Load recommended tracks
            musicRepository.getRecommendedTracks().collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(isLoadingRecommended = true)
                    }
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            recommendedTracks = result.data,
                            isLoadingRecommended = false,
                            isLoading = false
                        )
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isLoadingRecommended = false,
                            isLoading = false,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }

    fun onTrackClick(track: Track) {
        _navigationEvent.value = HomeNavigationEvent.NavigateToPlayer(track)
    }

    fun onProfileClick() {
        _navigationEvent.value = HomeNavigationEvent.NavigateToProfile
    }

    fun onPlayTrack(track: Track) {
        viewModelScope.launch {
            musicRepository.getStreamUrl(track.id).collect { result ->
                when (result) {
                    is Result.Success -> {
                        _navigationEvent.value = HomeNavigationEvent.PlayTrack(track, result.data)
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            errorMessage = result.message
                        )
                    }
                    is Result.Loading -> {
                        // Handle loading
                    }
                }
            }
        }
    }

    fun onLikeTrack(track: Track) {
        viewModelScope.launch {
            musicRepository.likeTrack(track.id).collect { result ->
                when (result) {
                    is Result.Success -> {
                        // Update track in the lists
                        updateTrackInLists(track.copy(isLiked = !track.isLiked))
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            errorMessage = result.message
                        )
                    }
                    is Result.Loading -> {
                        // Show loading indicator if needed
                    }
                }
            }
        }
    }

    fun onRefresh() {
        loadHomeData()
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    fun clearNavigationEvent() {
        _navigationEvent.value = null
    }

    private fun updateTrackInLists(updatedTrack: Track) {
        val currentState = _uiState.value
        
        val updatedTrending = currentState.trendingTracks.map { track: Track ->
            if (track.id == updatedTrack.id) updatedTrack else track
        }
        
        val updatedRecommended = currentState.recommendedTracks.map { track: Track ->
            if (track.id == updatedTrack.id) updatedTrack else track
        }
        
        _uiState.value = currentState.copy(
            trendingTracks = updatedTrending,
            recommendedTracks = updatedRecommended
        )
    }
}

data class HomeUiState(
    val isLoading: Boolean = false,
    val isLoadingTrending: Boolean = false,
    val isLoadingRecommended: Boolean = false,
    val trendingTracks: List<Track> = emptyList(),
    val recommendedTracks: List<Track> = emptyList(),
    val errorMessage: String? = null
)

sealed class HomeNavigationEvent {
    data class NavigateToPlayer(val track: Track) : HomeNavigationEvent()
    data class PlayTrack(val track: Track, val streamingUrl: String) : HomeNavigationEvent()
    object NavigateToProfile : HomeNavigationEvent()
}