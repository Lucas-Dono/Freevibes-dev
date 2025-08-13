package com.freevibes.android.repository

import com.freevibes.android.data.api.MusicApiService
import com.freevibes.android.data.local.OfflineMusicManager
import com.freevibes.android.data.model.*
import com.freevibes.android.data.repository.MusicRepository
import com.freevibes.android.utils.NetworkStateManager
import com.freevibes.android.utils.Result
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test
import org.junit.Assert.*
import org.mockito.Mock
import org.mockito.Mockito.*
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever
import org.mockito.kotlin.doAnswer
import retrofit2.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import java.io.IOException

class MusicRepositoryTest {

    @Mock
    private lateinit var musicApiService: MusicApiService
    
    @Mock
    private lateinit var offlineMusicManager: OfflineMusicManager
    
    @Mock
    private lateinit var networkStateManager: NetworkStateManager

    private lateinit var musicRepository: MusicRepository

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        musicRepository = MusicRepository(musicApiService, offlineMusicManager, networkStateManager)
    }

    @Test
    fun `searchTracks with successful response should return success result`() = runTest {
        // Given
        val query = "test song"
        val tracks = listOf(
            Track(
                id = "1",
                title = "Test Song",
                artist = "Test Artist",
                album = "Test Album",
                duration = 180000L,
                thumbnail = "https://example.com/art.jpg",
                streamUrl = "https://example.com/stream.mp3",
                youtubeId = "youtube123",
                spotifyId = "spotify123",
                genre = "Pop",
                year = 2024,
                playCount = 85L,
                isLiked = false,
                isDownloaded = false,
                localPath = null,
                addedAt = "2024-01-01"
            )
        )
        val apiResponse = ApiResponse(
            success = true,
            message = "Search successful",
            data = tracks
        )
        val response = Response.success(apiResponse)
        
        whenever(musicApiService.searchTracks(query, 1, 20)).thenReturn(response)

        // When
        val results = mutableListOf<Result<List<Track>>>()
        musicRepository.searchTracks(query, 1, 20).collect { results.add(it) }
        val result = results.last()

        // Then
        assertTrue(result is Result.Success<*>)
        assertEquals(tracks, (result as Result.Success<*>).data)
    }

    @Test
    fun `searchTracks with error response should return error result`() = runTest {
        // Given
        val query = "test song"
        val errorResponse = Response.error<ApiResponse<List<Track>>>(404, "Not found".toResponseBody())
        
        whenever(musicApiService.searchTracks(query, 1, 20)).thenReturn(errorResponse)

        // When
        val results = mutableListOf<Result<List<Track>>>()
        musicRepository.searchTracks(query, 1, 20).collect { results.add(it) }
        val result = results.last()

        // Then
        assertTrue(result is Result.Error)
        assertTrue((result as Result.Error).message.contains("servidor"))
    }

    @Test
    fun `searchTracks with network exception should return error result`() = runTest {
        // Given
        val query = "test song"
        val exception = IOException("Network error")
        
        doAnswer { throw exception }.whenever(musicApiService).searchTracks(query, 1, 20)

        // When
        val results = mutableListOf<Result<List<Track>>>()
        musicRepository.searchTracks(query, 1, 20).collect { results.add(it) }
        val result = results.last()

        // Then
        assertTrue(result is Result.Error)
        assertTrue((result as Result.Error).message.contains("Network error"))
    }

    @Test
    fun `getTrendingTracks with successful response should return success result`() = runTest {
        // Given
        val tracks = listOf(
            Track(
                id = "1",
                title = "Trending Song",
                artist = "Popular Artist",
                album = "Hit Album",
                duration = 200000L,
                thumbnail = "https://example.com/trending.jpg",
                streamUrl = "https://example.com/trending.mp3",
                youtubeId = "youtube456",
                spotifyId = "spotify456",
                genre = "Pop",
                year = 2024,
                playCount = 95L,
                isLiked = false,
                isDownloaded = false,
                localPath = null,
                addedAt = "2024-01-01"
            )
        )
        val apiResponse = ApiResponse(
            success = true,
            message = "Trending tracks retrieved",
            data = tracks
        )
        val response = Response.success(apiResponse)
        
        whenever(musicApiService.getTrendingTracks(20)).thenReturn(response)

        // When
        val results = mutableListOf<Result<List<Track>>>()
        musicRepository.getTrendingTracks(20).collect { results.add(it) }
        val result = results.last()

        // Then
        assertTrue(result is Result.Success<*>)
        assertEquals(tracks, (result as Result.Success<List<Track>>).data)
    }

    @Test
    fun `getUserPlaylists with successful response should return success result`() = runTest {
        // Given
        val playlists = listOf(
            Playlist(
                id = "1",
                name = "My Playlist",
                description = "Test playlist",
                thumbnail = "https://example.com/playlist.jpg",
                isPublic = true,
                ownerId = "1",
                ownerName = "Test User",
                trackCount = 10,
                totalDuration = 1800000L,
                createdAt = "2024-01-01T00:00:00Z",
                updatedAt = "2024-01-01T00:00:00Z",
                tracks = emptyList(),
                isLiked = false,
                isDownloaded = false,
                category = null,
                tags = null
            )
        )
        val apiResponse = ApiResponse(
            success = true,
            message = "Playlists retrieved",
            data = playlists
        )
        val response = Response.success(apiResponse)
        
        whenever(musicApiService.getUserPlaylists()).thenReturn(response)

        // When
        val results = mutableListOf<Result<List<Playlist>>>()
        musicRepository.getUserPlaylists().collect { results.add(it) }
        val result = results.last()

        // Then
        assertTrue(result is Result.Success<*>)
        assertEquals(playlists, (result as Result.Success<*>).data)
    }

    @Test
    fun `getTrack with successful response should return success result`() = runTest {
        // Given
        val trackId = "1"
        val track = Track(
            id = trackId,
            title = "Specific Song",
            artist = "Specific Artist",
            album = "Specific Album",
            duration = 240000L,
            thumbnail = "https://example.com/specific.jpg",
            streamUrl = "https://example.com/specific.mp3",
            youtubeId = "youtube789",
            spotifyId = "spotify789",
            genre = "Rock",
            year = 2024,
            playCount = 75L,
            isLiked = false,
            isDownloaded = false,
            localPath = null,
            addedAt = "2024-01-01"
        )
        val apiResponse = ApiResponse(
            success = true,
            message = "Track retrieved",
            data = track
        )
        val response = Response.success(apiResponse)
        
        whenever(musicApiService.getTrack(trackId)).thenReturn(response)

        // When
        val results = mutableListOf<Result<Track>>()
        musicRepository.getTrack(trackId).collect { results.add(it) }
        val result = results.last()

        // Then
        assertTrue(result is Result.Success<*>)
        assertEquals(track, (result as Result.Success<Track>).data)
    }
}