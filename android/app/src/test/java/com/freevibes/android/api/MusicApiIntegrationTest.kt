package com.freevibes.android.api

import com.freevibes.android.data.api.MusicApiService
import com.freevibes.android.data.model.*
import com.google.gson.Gson
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import org.junit.Assert.*
import java.util.concurrent.TimeUnit

class MusicApiIntegrationTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var musicApiService: MusicApiService
    private val gson = Gson()

    @Before
    fun setup() {
        mockWebServer = MockWebServer()
        mockWebServer.start()

        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(1, TimeUnit.SECONDS)
            .readTimeout(1, TimeUnit.SECONDS)
            .writeTimeout(1, TimeUnit.SECONDS)
            .build()

        musicApiService = Retrofit.Builder()
            .baseUrl(mockWebServer.url("/"))
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(MusicApiService::class.java)
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `searchTracks returns successful response`() = runTest {
        // Given
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
        
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(gson.toJson(apiResponse))
                .addHeader("Content-Type", "application/json")
        )

        // When
        val response = musicApiService.searchTracks("test", 20, 0)

        // Then
        assertTrue(response.isSuccessful)
        assertNotNull(response.body())
        assertEquals(apiResponse.success, response.body()?.success)
        assertEquals(tracks.size, response.body()?.data?.size)
        assertEquals("Test Song", response.body()?.data?.first()?.title)
        
        // Verify request
        val request = mockWebServer.takeRequest()
        assertEquals("GET", request.method)
        assertTrue(request.path?.contains("/search/tracks") == true)
        assertTrue(request.path?.contains("q=test") == true)
        assertTrue(request.path?.contains("limit=20") == true)
        assertTrue(request.path?.contains("offset=0") == true)
    }

    @Test
    fun `getTrendingTracks returns successful response`() = runTest {
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
        
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(gson.toJson(apiResponse))
                .addHeader("Content-Type", "application/json")
        )

        // When
        val response = musicApiService.getTrendingTracks(20)

        // Then
        assertTrue(response.isSuccessful)
        assertNotNull(response.body())
        assertEquals(apiResponse.success, response.body()?.success)
        assertEquals("Trending Song", (response.body()?.data as List<*>).first().let {
            gson.fromJson(gson.toJson(it), Track::class.java).title
        })
        
        // Verify request
        val request = mockWebServer.takeRequest()
        assertEquals("GET", request.method)
        assertTrue(request.path?.contains("/trending") == true)
        assertTrue(request.path?.contains("limit=20") == true)
    }

    @Test
    fun `getUserPlaylists returns successful response`() = runTest {
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
                category = "user",
                tags = emptyList()
            )
        )
        val apiResponse = ApiResponse(
            success = true,
            message = "Playlists retrieved",
            data = playlists
        )
        
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(gson.toJson(apiResponse))
                .addHeader("Content-Type", "application/json")
        )

        // When
        val response = musicApiService.getUserPlaylists()

        // Then
        assertTrue(response.isSuccessful)
        assertNotNull(response.body())
        assertEquals(apiResponse.success, response.body()?.success)
        
        // Verify request
        val request = mockWebServer.takeRequest()
        assertEquals("GET", request.method)
        assertTrue(request.path?.contains("/playlists") == true)
    }

    @Test
    fun `searchTracks handles error response`() = runTest {
        // Given
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(404)
                .setBody("{\"error\": \"Not found\"}")
                .addHeader("Content-Type", "application/json")
        )

        // When
        val response = musicApiService.searchTracks("nonexistent", 1, 20)

        // Then
        assertFalse(response.isSuccessful)
        assertEquals(404, response.code())
    }

    @Test
    fun `getTrackById returns successful response`() = runTest {
        // Given
        val track = Track(
            id = "1",
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
        
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody(gson.toJson(apiResponse))
                .addHeader("Content-Type", "application/json")
        )

        // When
        val response = musicApiService.getTrack("1")

        // Then
        assertTrue(response.isSuccessful)
        assertNotNull(response.body())
        assertEquals(apiResponse.success, response.body()?.success)
        
        // Verify request
        val request = mockWebServer.takeRequest()
        assertEquals("GET", request.method)
        assertTrue(request.path?.contains("/track/1") == true)
    }
}