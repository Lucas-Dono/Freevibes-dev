package com.freevibes.android.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freevibes.android.data.model.Track
import com.freevibes.android.data.repository.MusicRepository
import com.freevibes.android.utils.Result
// import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
// import javax.inject.Inject

@OptIn(FlowPreview::class)
// @HiltViewModel
class SearchViewModel constructor(
    private val musicRepository: MusicRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private val _navigationEvent = MutableStateFlow<SearchNavigationEvent?>(null)
    val navigationEvent: StateFlow<SearchNavigationEvent?> = _navigationEvent.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    init {
        setupSearchFlow()
    }

    private fun setupSearchFlow() {
        viewModelScope.launch {
            _searchQuery
                .debounce(300) // Wait 300ms after user stops typing
                .distinctUntilChanged()
                .filter { it.isNotBlank() && it.length >= 2 }
                .collect { query ->
                    performSearch(query)
                }
        }
    }

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
        if (query.isBlank()) {
            _uiState.value = _uiState.value.copy(
                searchResults = emptyList(),
                isSearching = false,
                hasSearched = false
            )
        }
    }

    private fun performSearch(query: String) {
        viewModelScope.launch {
            musicRepository.searchTracks(query).collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(
                            isSearching = true,
                            errorMessage = null
                        )
                    }
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            searchResults = result.data,
                            isSearching = false,
                            hasSearched = true,
                            errorMessage = null
                        )
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isSearching = false,
                            hasSearched = true,
                            errorMessage = result.message
                        )
                    }
                }
            }
        }
    }

    fun onTrackClick(track: Track) {
        _navigationEvent.value = SearchNavigationEvent.NavigateToPlayer(track)
    }

    fun onPlayTrack(track: Track) {
        viewModelScope.launch {
            musicRepository.getStreamUrl(track.id).collect { result ->
                when (result) {
                    is Result.Success -> {
                        _navigationEvent.value = SearchNavigationEvent.PlayTrack(track, result.data)
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

    fun onLikeTrack(track: Track) {
        viewModelScope.launch {
            musicRepository.likeTrack(track.id).collect { result ->
                when (result) {
                    is Result.Success -> {
                        // Update track in the search results
                        updateTrackInResults(track.copy(isLiked = !track.isLiked))
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

    fun onClearSearch() {
        _searchQuery.value = ""
        _uiState.value = SearchUiState()
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    fun clearNavigationEvent() {
        _navigationEvent.value = null
    }

    private fun updateTrackInResults(updatedTrack: Track) {
        val currentResults = _uiState.value.searchResults
        val updatedResults = currentResults.map { track ->
            if (track.id == updatedTrack.id) updatedTrack else track
        }
        _uiState.value = _uiState.value.copy(searchResults = updatedResults)
    }

    fun retrySearch() {
        val currentQuery = _searchQuery.value
        if (currentQuery.isNotBlank()) {
            performSearch(currentQuery)
        }
    }
}

data class SearchUiState(
    val searchResults: List<Track> = emptyList(),
    val isSearching: Boolean = false,
    val hasSearched: Boolean = false,
    val errorMessage: String? = null
)

sealed class SearchNavigationEvent {
    data class NavigateToPlayer(val track: Track) : SearchNavigationEvent()
    data class PlayTrack(val track: Track, val streamingUrl: String) : SearchNavigationEvent()
}