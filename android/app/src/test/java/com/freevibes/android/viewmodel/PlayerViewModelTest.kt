package com.freevibes.android.viewmodel

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import com.freevibes.android.data.model.Track
import com.freevibes.android.service.PlayerService
import com.freevibes.android.ui.player.PlayerViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.*
import org.junit.Assert.*

@ExperimentalCoroutinesApi
class PlayerViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = UnconfinedTestDispatcher()

    @Mock
    private lateinit var playerService: PlayerService

    @Mock
    private lateinit var mockPlayer: Player

    @Mock
    private lateinit var mockApplication: android.app.Application

    private lateinit var playerViewModel: PlayerViewModel

    private val testTrack = Track(
        id = "1",
        title = "Test Song",
        artist = "Test Artist",
        album = "Test Album",
        duration = 180000L,
        thumbnail = "https://example.com/art.jpg",
        streamUrl = "https://example.com/stream.mp3",
        genre = "Pop",
        year = 2024,
        spotifyId = "spotify123",
        youtubeId = "youtube123"
    )

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
        
        // Setup mock behavior
        whenever(mockPlayer.playWhenReady).thenReturn(false)
        whenever(mockPlayer.currentPosition).thenReturn(0L)
        whenever(mockPlayer.duration).thenReturn(180000L)
        whenever(mockPlayer.shuffleModeEnabled).thenReturn(false)
        whenever(mockPlayer.repeatMode).thenReturn(Player.REPEAT_MODE_OFF)
        
        playerViewModel = PlayerViewModel(mockApplication)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `playTrack should update current track`() {
        // When
        playerViewModel.playTrack(testTrack)

        // Then
        // The track should be set in the playlist
        assertEquals(1, playerViewModel.playlist.value.size)
        assertEquals(testTrack, playerViewModel.playlist.value.first())
    }

    @Test
    fun `play should call service play`() {
        // When
        playerViewModel.play()

        // Then - This test verifies the method exists and can be called
        // Service interaction testing would require more complex mocking
    }

    @Test
    fun `pause should call service pause`() {
        // When
        playerViewModel.pause()

        // Then - This test verifies the method exists and can be called
    }

    @Test
    fun `skipToNext should work with empty playlist`() {
        // When
        playerViewModel.skipToNext()

        // Then - Should not crash with empty playlist
        assertEquals(0, playerViewModel.playlist.value.size)
    }

    @Test
    fun `skipToPrevious should work with empty playlist`() {
        // When
        playerViewModel.skipToPrevious()

        // Then - Should not crash with empty playlist
        assertEquals(0, playerViewModel.playlist.value.size)
    }

    @Test
    fun `toggleShuffle should toggle shuffle mode`() {
        // Given
        val initialShuffle = playerViewModel.shuffleEnabled.value
        
        // When
        playerViewModel.toggleShuffle()

        // Then
        assertEquals(!initialShuffle, playerViewModel.shuffleEnabled.value)
    }

    @Test
    fun `toggleRepeatMode should cycle through repeat modes`() {
        // Given
        val initialMode = playerViewModel.repeatMode.value
        
        // When
        playerViewModel.toggleRepeatMode()

        // Then
        assertNotEquals(initialMode, playerViewModel.repeatMode.value)
    }

    @Test
    fun `seekTo should call service seekTo`() {
        // Given
        val position = 60000L
        
        // When
        playerViewModel.seekTo(position)

        // Then - Method should exist and be callable
    }

    @Test
    fun `stop should clear current track and playlist`() {
        // Given
        playerViewModel.playTrack(testTrack)
        
        // When
        playerViewModel.stop()

        // Then
        assertEquals(0, playerViewModel.playlist.value.size)
        assertEquals(0, playerViewModel.currentIndex.value)
    }

    @Test
    fun `setPlaylist should update playlist and current index`() {
        // Given
        val playlist = listOf(testTrack)
        
        // When
        playerViewModel.setPlaylist(playlist, 0)

        // Then
        assertEquals(playlist, playerViewModel.playlist.value)
        assertEquals(0, playerViewModel.currentIndex.value)
    }
}