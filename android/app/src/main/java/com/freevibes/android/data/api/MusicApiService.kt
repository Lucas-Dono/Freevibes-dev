package com.freevibes.android.data.api

import com.freevibes.android.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface MusicApiService {
    
    // Search endpoints
    @GET("search")
    suspend fun search(
        @Query("q") query: String,
        @Query("type") type: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0
    ): Response<ApiResponse<SearchResponse>>
    
    @GET("search/tracks")
    suspend fun searchTracks(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0
    ): Response<ApiResponse<List<Track>>>
    
    @GET("search/playlists")
    suspend fun searchPlaylists(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0
    ): Response<ApiResponse<List<Playlist>>>
    
    // Track endpoints
    @GET("track/{id}")
    suspend fun getTrack(@Path("id") trackId: String): Response<ApiResponse<Track>>
    
    @GET("track/{id}/stream")
    suspend fun getStreamUrl(@Path("id") trackId: String): Response<ApiResponse<String>>
    
    @POST("track/{id}/like")
    suspend fun likeTrack(@Path("id") trackId: String): Response<ApiResponse<Unit>>
    
    @DELETE("track/{id}/like")
    suspend fun unlikeTrack(@Path("id") trackId: String): Response<ApiResponse<Unit>>
    
    // Playlist endpoints
    @GET("playlists")
    suspend fun getPlaylists(
        @Query("category") category: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("offset") offset: Int = 0
    ): Response<ApiResponse<List<Playlist>>>
    
    @GET("playlist/{id}")
    suspend fun getPlaylist(@Path("id") playlistId: String): Response<ApiResponse<Playlist>>
    
    @GET("playlist/{id}/tracks")
    suspend fun getPlaylistTracks(
        @Path("id") playlistId: String,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0
    ): Response<ApiResponse<List<Track>>>
    
    // User playlist endpoints
    @GET("user/playlists")
    suspend fun getUserPlaylists(): Response<ApiResponse<List<Playlist>>>
    
    @POST("user/playlists")
    suspend fun createPlaylist(@Body playlist: CreatePlaylistRequest): Response<ApiResponse<Playlist>>
    
    @PUT("user/playlists/{id}")
    suspend fun updatePlaylist(
        @Path("id") playlistId: String,
        @Body playlist: UpdatePlaylistRequest
    ): Response<ApiResponse<Playlist>>
    
    @DELETE("user/playlists/{id}")
    suspend fun deletePlaylist(@Path("id") playlistId: String): Response<ApiResponse<Unit>>
    
    @POST("user/playlists/{id}/tracks")
    suspend fun addTrackToPlaylist(
        @Path("id") playlistId: String,
        @Body request: AddTrackRequest
    ): Response<ApiResponse<Unit>>
    
    @DELETE("user/playlists/{playlistId}/tracks/{trackId}")
    suspend fun removeTrackFromPlaylist(
        @Path("playlistId") playlistId: String,
        @Path("trackId") trackId: String
    ): Response<ApiResponse<Unit>>
    
    // Recommendations
    @GET("recommendations")
    suspend fun getRecommendations(
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<Track>>>
    
    @GET("trending")
    suspend fun getTrending(
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<Track>>>
    
    @GET("charts")
    suspend fun getCharts(
        @Query("country") country: String? = null,
        @Query("limit") limit: Int = 50
    ): Response<ApiResponse<List<Track>>>

    @GET("trending")
    suspend fun getTrendingTracks(
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<Track>>>

    @GET("recommended")
    suspend fun getRecommendedTracks(
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<Track>>>
    
    // Categories and genres
    @GET("categories")
    suspend fun getCategories(): Response<ApiResponse<List<Category>>>
    
    @GET("genres")
    suspend fun getGenres(): Response<ApiResponse<List<Genre>>>
    
    @GET("category/{id}/playlists")
    suspend fun getCategoryPlaylists(
        @Path("id") categoryId: String,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<Playlist>>>
    
    // User stats
    @GET("user/stats")
    suspend fun getUserStats(): Response<ApiResponse<UserStats>>
}

data class CreatePlaylistRequest(
    val name: String,
    val description: String? = null,
    val isPublic: Boolean = false
)

data class UpdatePlaylistRequest(
    val name: String? = null,
    val description: String? = null,
    val isPublic: Boolean? = null
)

data class AddTrackRequest(
    val trackId: String
)

data class Category(
    val id: String,
    val name: String,
    val image: String? = null,
    val description: String? = null
)

data class Genre(
    val id: String,
    val name: String,
    val color: String? = null
)