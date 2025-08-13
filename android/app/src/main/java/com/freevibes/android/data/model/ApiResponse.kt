package com.freevibes.android.data.model

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("message")
    val message: String? = null,
    
    @SerializedName("data")
    val data: T? = null,
    
    @SerializedName("error")
    val error: String? = null,
    
    @SerializedName("code")
    val code: Int? = null,
    
    @SerializedName("timestamp")
    val timestamp: String? = null,
    
    @SerializedName("pagination")
    val pagination: PaginationInfo? = null
)

data class PaginationInfo(
    @SerializedName("page")
    val page: Int,
    
    @SerializedName("limit")
    val limit: Int,
    
    @SerializedName("total")
    val total: Int,
    
    @SerializedName("totalPages")
    val totalPages: Int,
    
    @SerializedName("hasNext")
    val hasNext: Boolean,
    
    @SerializedName("hasPrev")
    val hasPrev: Boolean
)

data class SearchResponse(
    @SerializedName("tracks")
    val tracks: List<Track>? = null,
    
    @SerializedName("playlists")
    val playlists: List<Playlist>? = null,
    
    @SerializedName("artists")
    val artists: List<Artist>? = null,
    
    @SerializedName("albums")
    val albums: List<Album>? = null,
    
    @SerializedName("query")
    val query: String? = null,
    
    @SerializedName("totalResults")
    val totalResults: Int = 0
)

data class Artist(
    @SerializedName("id")
    val id: String,
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("image")
    val image: String? = null,
    
    @SerializedName("followers")
    val followers: Int = 0,
    
    @SerializedName("genres")
    val genres: List<String>? = null
)

data class Album(
    @SerializedName("id")
    val id: String,
    
    @SerializedName("title")
    val title: String,
    
    @SerializedName("artist")
    val artist: String,
    
    @SerializedName("image")
    val image: String? = null,
    
    @SerializedName("year")
    val year: Int? = null,
    
    @SerializedName("trackCount")
    val trackCount: Int = 0
)