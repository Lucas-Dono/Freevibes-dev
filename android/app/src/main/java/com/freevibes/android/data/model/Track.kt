package com.freevibes.android.data.model

import android.os.Parcelable
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
@Entity(tableName = "tracks")
data class Track(
    @PrimaryKey
    @SerializedName("id")
    val id: String,
    
    @SerializedName("title")
    val title: String,
    
    @SerializedName("artist")
    val artist: String,
    
    @SerializedName("album")
    val album: String? = null,
    
    @SerializedName("duration")
    val duration: Long = 0, // in milliseconds
    
    @SerializedName("thumbnail")
    val thumbnail: String? = null,
    
    @SerializedName("streamUrl")
    val streamUrl: String? = null,
    
    @SerializedName("youtubeId")
    val youtubeId: String? = null,
    
    @SerializedName("spotifyId")
    val spotifyId: String? = null,
    
    @SerializedName("genre")
    val genre: String? = null,
    
    @SerializedName("year")
    val year: Int? = null,
    
    @SerializedName("playCount")
    val playCount: Long = 0,
    
    @SerializedName("isLiked")
    val isLiked: Boolean = false,
    
    @SerializedName("isDownloaded")
    val isDownloaded: Boolean = false,
    
    @SerializedName("localPath")
    val localPath: String? = null,
    
    @SerializedName("addedAt")
    val addedAt: String? = null,
    
    @SerializedName("isOfflineAvailable")
    val isOfflineAvailable: Boolean = false,
    
    @SerializedName("audioUrl")
    val audioUrl: String = streamUrl ?: ""
) : Parcelable {
    
    fun getDurationFormatted(): String {
        val minutes = (duration / 1000) / 60
        val seconds = (duration / 1000) % 60
        return String.format("%d:%02d", minutes, seconds)
    }
    
    fun getArtistAlbum(): String {
        return if (album.isNullOrEmpty()) artist else "$artist • $album"
    }
}