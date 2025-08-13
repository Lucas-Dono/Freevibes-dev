package com.freevibes.android.ui.player

import android.app.Application
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.freevibes.android.data.model.Track
import com.freevibes.android.service.PlayerService
import com.freevibes.android.ui.player.RepeatMode
// import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.launch
// import javax.inject.Inject

// @HiltViewModel
class PlayerViewModel constructor(
    application: Application
) : AndroidViewModel(application) {

    private var playerService: PlayerService? = null
    private var isBound = false

    private val _currentTrack = MutableStateFlow<Track?>(null)
    val currentTrack: StateFlow<Track?> = _currentTrack.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition: StateFlow<Long> = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration: StateFlow<Long> = _duration.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _playbackState = MutableStateFlow(0)
    val playbackState: StateFlow<Int> = _playbackState.asStateFlow()

    private val _playlist = MutableStateFlow<List<Track>>(emptyList())
    val playlist: StateFlow<List<Track>> = _playlist.asStateFlow()

    private val _currentIndex = MutableStateFlow(0)
    val currentIndex: StateFlow<Int> = _currentIndex.asStateFlow()

    private val _shuffleEnabled = MutableStateFlow(false)
    val shuffleEnabled: StateFlow<Boolean> = _shuffleEnabled.asStateFlow()

    private val _repeatMode = MutableStateFlow(RepeatMode.OFF)
    val repeatMode: StateFlow<RepeatMode> = _repeatMode.asStateFlow()

    // Combined UI State for easier consumption
    val uiState: StateFlow<PlayerUiState> = kotlinx.coroutines.flow.combine(
        _currentTrack,
        _isPlaying,
        _isLoading,
        _currentPosition,
        _duration
    ) { flows ->
        val currentTrack = flows[0] as Track?
        val isPlaying = flows[1] as Boolean
        val isLoading = flows[2] as Boolean
        val currentPosition = flows[3] as Long
        val duration = flows[4] as Long
        
        PlayerUiState(
            currentTrack = currentTrack,
            isPlaying = isPlaying,
            isLoading = isLoading,
            currentPosition = currentPosition,
            duration = duration,
            isShuffleEnabled = _shuffleEnabled.value,
            repeatMode = _repeatMode.value,
            playlist = _playlist.value,
            currentIndex = _currentIndex.value
        )
    }.stateIn(
        scope = viewModelScope,
        started = kotlinx.coroutines.flow.SharingStarted.WhileSubscribed(5000),
        initialValue = PlayerUiState()
    )

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as PlayerService.PlayerBinder
            playerService = binder.getService()
            isBound = true
            observePlayerService()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            playerService = null
            isBound = false
        }
    }

    init {
        // No iniciar el servicio automáticamente
        // Se iniciará cuando el usuario reproduzca música
    }

    override fun onCleared() {
        super.onCleared()
        unbindFromPlayerService()
    }

    private fun bindToPlayerService() {
        val intent = Intent(getApplication(), PlayerService::class.java)
        getApplication<Application>().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        // No iniciar el servicio automáticamente - se iniciará cuando sea necesario
    }

    private fun unbindFromPlayerService() {
        if (isBound) {
            getApplication<Application>().unbindService(serviceConnection)
            isBound = false
        }
    }

    private fun observePlayerService() {
        playerService?.let { service ->
            viewModelScope.launch {
                service.currentTrack.collect { track ->
                    _currentTrack.value = track
                }
            }

            viewModelScope.launch {
                service.isPlaying.collect { playing ->
                    _isPlaying.value = playing
                }
            }

            viewModelScope.launch {
                service.currentPosition.collect { position ->
                    _currentPosition.value = position
                }
            }

            viewModelScope.launch {
                service.duration.collect { duration ->
                    _duration.value = duration
                }
            }

            viewModelScope.launch {
                service.playbackState.collect { state ->
                    _playbackState.value = state
                }
            }
        }
    }

    fun playTrack(track: Track, playlist: List<Track> = emptyList()) {
        _isLoading.value = true
        
        if (playlist.isNotEmpty()) {
            _playlist.value = playlist
            _currentIndex.value = playlist.indexOf(track).takeIf { it >= 0 } ?: 0
        } else {
            _playlist.value = listOf(track)
            _currentIndex.value = 0
        }

        // Iniciar el servicio solo cuando se reproduzca música
        if (!isBound) {
            bindToPlayerService()
        }
        
        playerService?.playTrack(track)
        _isLoading.value = false
    }

    fun play() {
        // Asegurar que el servicio esté iniciado
        if (!isBound) {
            bindToPlayerService()
        }
        playerService?.play()
    }

    fun pause() {
        playerService?.pause()
    }

    fun stop() {
        playerService?.stop()
        _currentTrack.value = null
        _playlist.value = emptyList()
        _currentIndex.value = 0
    }

    fun seekTo(position: Long) {
        playerService?.seekTo(position)
    }

    fun playPause() {
        if (_isPlaying.value) {
            pause()
        } else {
            play()
        }
    }

    fun togglePlayPause() {
        playPause()
    }

    fun skipToNext() {
        val currentPlaylist = _playlist.value
        val currentIdx = _currentIndex.value
        
        if (currentPlaylist.isNotEmpty()) {
            val nextIndex = when {
                _shuffleEnabled.value -> {
                    // Random next track (excluding current)
                    val availableIndices = currentPlaylist.indices.filter { it != currentIdx }
                    if (availableIndices.isNotEmpty()) {
                        availableIndices.random()
                    } else currentIdx
                }
                currentIdx < currentPlaylist.size - 1 -> currentIdx + 1
                _repeatMode.value == RepeatMode.ALL -> 0
                else -> currentIdx // Stay on current if no repeat and at end
            }
            
            if (nextIndex != currentIdx || _repeatMode.value == RepeatMode.ONE) {
                _currentIndex.value = nextIndex
                val nextTrack = currentPlaylist[nextIndex]
                playerService?.playTrack(nextTrack)
            }
        }
    }

    fun skipToPrevious() {
        val currentPlaylist = _playlist.value
        val currentIdx = _currentIndex.value
        
        if (currentPlaylist.isNotEmpty()) {
            val previousIndex = when {
                _shuffleEnabled.value -> {
                    // Random previous track (excluding current)
                    val availableIndices = currentPlaylist.indices.filter { it != currentIdx }
                    if (availableIndices.isNotEmpty()) {
                        availableIndices.random()
                    } else currentIdx
                }
                currentIdx > 0 -> currentIdx - 1
                _repeatMode.value == RepeatMode.ALL -> currentPlaylist.size - 1
                else -> currentIdx // Stay on current if no repeat and at beginning
            }
            
            if (previousIndex != currentIdx || _repeatMode.value == RepeatMode.ONE) {
                _currentIndex.value = previousIndex
                val previousTrack = currentPlaylist[previousIndex]
                playerService?.playTrack(previousTrack)
            }
        }
    }

    fun toggleShuffle() {
        _shuffleEnabled.value = !_shuffleEnabled.value
    }

    fun toggleRepeatMode() {
        _repeatMode.value = when (_repeatMode.value) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
    }

    fun setPlaylist(tracks: List<Track>, startIndex: Int = 0) {
        _playlist.value = tracks
        _currentIndex.value = startIndex.coerceIn(0, tracks.size - 1)
        
        if (tracks.isNotEmpty() && startIndex < tracks.size) {
            playTrack(tracks[startIndex], tracks)
        }
    }

    fun getCurrentTrackIndex(): Int = _currentIndex.value

    fun getPlaylistSize(): Int = _playlist.value.size

    fun hasNext(): Boolean {
        val currentPlaylist = _playlist.value
        val currentIdx = _currentIndex.value
        return when {
            _shuffleEnabled.value -> currentPlaylist.size > 1
            _repeatMode.value == RepeatMode.ALL -> true
            _repeatMode.value == RepeatMode.ONE -> true
            else -> currentIdx < currentPlaylist.size - 1
        }
    }

    fun hasPrevious(): Boolean {
        val currentPlaylist = _playlist.value
        val currentIdx = _currentIndex.value
        return when {
            _shuffleEnabled.value -> currentPlaylist.size > 1
            _repeatMode.value == RepeatMode.ALL -> true
            _repeatMode.value == RepeatMode.ONE -> true
            else -> currentIdx > 0
        }
    }

    fun formatTime(milliseconds: Long): String {
        val seconds = (milliseconds / 1000) % 60
        val minutes = (milliseconds / (1000 * 60)) % 60
        val hours = (milliseconds / (1000 * 60 * 60))
        
        return if (hours > 0) {
            String.format("%d:%02d:%02d", hours, minutes, seconds)
        } else {
            String.format("%d:%02d", minutes, seconds)
        }
    }

}