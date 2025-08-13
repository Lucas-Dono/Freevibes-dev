package com.freevibes.android.data.model

import android.os.Parcelable
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
@Entity(tableName = "playlists")
data class Playlist(
    @PrimaryKey
    @SerializedName("id")
    val id: String,
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("description")
    val description: String? = null,
    
    @SerializedName("thumbnail")
    val thumbnail: String? = null,
    
    @SerializedName("isPublic")
    val isPublic: Boolean = false,
    
    @SerializedName("ownerId")
    val ownerId: String? = null,
    
    @SerializedName("ownerName")
    val ownerName: String? = null,
    
    @SerializedName("trackCount")
    val trackCount: Int = 0,
    
    @SerializedName("totalDuration")
    val totalDuration: Long = 0, // in milliseconds
    
    @SerializedName("createdAt")
    val createdAt: String? = null,
    
    @SerializedName("updatedAt")
    val updatedAt: String? = null,
    
    @SerializedName("tracks")
    val tracks: List<Track>? = null,
    
    @SerializedName("isLiked")
    val isLiked: Boolean = false,
    
    @SerializedName("isDownloaded")
    val isDownloaded: Boolean = false,
    
    @SerializedName("category")
    val category: String? = null,
    
    @SerializedName("tags")
    val tags: List<String>? = null
) : Parcelable {
    
    fun getTotalDurationFormatted(): String {
        val hours = (totalDuration / 1000) / 3600
        val minutes = ((totalDuration / 1000) % 3600) / 60
        
        return when {
            hours > 0 -> String.format("%dh %dm", hours, minutes)
            minutes > 0 -> String.format("%dm", minutes)
            else -> "< 1m"
        }
    }
    
    fun getTrackCountText(): String {
        return when (trackCount) {
            0 -> "Sin canciones"
            1 -> "1 canción"
            else -> "$trackCount canciones"
        }
    }
    
    fun isOwnedBy(userId: String?): Boolean {
        return ownerId == userId
    }
}