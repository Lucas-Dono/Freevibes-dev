package com.freevibes.android.ui.player

import com.freevibes.android.data.model.Track

data class PlayerUiState(
    val currentTrack: Track? = null,
    val isPlaying: Boolean = false,
    val isLoading: Boolean = false,
    val currentPosition: Long = 0L,
    val duration: Long = 0L,
    val isShuffleEnabled: Boolean = false,
    val repeatMode: RepeatMode = RepeatMode.OFF,
    val playlist: List<Track> = emptyList(),
    val currentIndex: Int = -1,
    val errorMessage: String? = null
)

enum class RepeatMode {
    OFF, ONE, ALL
}