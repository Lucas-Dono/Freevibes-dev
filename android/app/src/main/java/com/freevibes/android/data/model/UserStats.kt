package com.freevibes.android.data.model

import com.google.gson.annotations.SerializedName

data class UserStats(
    @SerializedName("total_playlists")
    val totalPlaylists: Int = 0,
    
    @SerializedName("total_liked_tracks")
    val totalLikedTracks: Int = 0,
    
    @SerializedName("total_listening_time")
    val totalListeningTime: String = "0h 0m",
    
    @SerializedName("total_tracks_played")
    val totalTracksPlayed: Int = 0,
    
    @SerializedName("favorite_genre")
    val favoriteGenre: String? = null,
    
    @SerializedName("favorite_artist")
    val favoriteArtist: String? = null
)