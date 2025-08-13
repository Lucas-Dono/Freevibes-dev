package com.freevibes.android.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freevibes.android.data.model.User
import com.freevibes.android.data.repository.AuthRepository
import com.freevibes.android.data.repository.MusicRepository
import com.freevibes.android.utils.Result
// import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
// import javax.inject.Inject

// @HiltViewModel
class ProfileViewModel constructor(
    private val authRepository: AuthRepository,
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val _navigationEvent = MutableStateFlow<ProfileNavigationEvent?>(null)
    val navigationEvent: StateFlow<ProfileNavigationEvent?> = _navigationEvent.asStateFlow()

    init {
        loadUserProfile()
        loadUserStats()
    }

    fun loadUserProfile() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            authRepository.getCurrentUser().collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(isLoading = true)
                    }
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            user = result.data,
                            error = null
                        )
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = result.message
                        )
                    }
                }
            }
        }
    }

    private fun loadUserStats() {
        viewModelScope.launch {
            when (val result = musicRepository.getUserStats()) {
                is Result.Success -> {
                    _uiState.value = _uiState.value.copy(
                        totalPlaylists = result.data.totalPlaylists,
                        totalLikedTracks = result.data.totalLikedTracks,
                        totalListeningTime = result.data.totalListeningTime
                    )
                }
                is Result.Error -> {
                    // Stats are optional, don't show error for this
                }
                is Result.Loading -> {
                    // Handle loading if needed
                }
            }
        }
    }

    fun onEditProfileClick() {
        _navigationEvent.value = ProfileNavigationEvent.NavigateToEditProfile
    }

    fun onSettingsClick() {
        _navigationEvent.value = ProfileNavigationEvent.NavigateToSettings
    }

    fun onPlaylistsClick() {
        _navigationEvent.value = ProfileNavigationEvent.NavigateToPlaylists
    }

    fun onLikedTracksClick() {
        _navigationEvent.value = ProfileNavigationEvent.NavigateToLikedTracks
    }

    fun onRecentlyPlayedClick() {
        _navigationEvent.value = ProfileNavigationEvent.NavigateToRecentlyPlayed
    }

    fun onLogoutClick() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            authRepository.logout().collect { result ->
                when (result) {
                    is Result.Success -> {
                        _navigationEvent.value = ProfileNavigationEvent.NavigateToLogin
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

    fun onRetryClick() {
        loadUserProfile()
        loadUserStats()
    }

    fun clearNavigationEvent() {
        _navigationEvent.value = null
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

data class ProfileUiState(
    val isLoading: Boolean = false,
    val user: User? = null,
    val totalPlaylists: Int = 0,
    val totalLikedTracks: Int = 0,
    val totalListeningTime: String = "0h 0m",
    val error: String? = null
)

sealed class ProfileNavigationEvent {
    object NavigateToEditProfile : ProfileNavigationEvent()
    object NavigateToSettings : ProfileNavigationEvent()
    object NavigateToPlaylists : ProfileNavigationEvent()
    object NavigateToLikedTracks : ProfileNavigationEvent()
    object NavigateToRecentlyPlayed : ProfileNavigationEvent()
    object NavigateToLogin : ProfileNavigationEvent()
}