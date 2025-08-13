package com.freevibes.android.data.model

import android.os.Parcelable
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
@Entity(tableName = "users")
data class User(
    @PrimaryKey
    @SerializedName("id")
    val id: String,
    
    @SerializedName("username")
    val username: String,
    
    @SerializedName("email")
    val email: String,
    
    @SerializedName("displayName")
    val displayName: String? = null,
    
    @SerializedName("avatar")
    val avatar: String? = null,
    
    @SerializedName("createdAt")
    val createdAt: String? = null,
    
    @SerializedName("lastLogin")
    val lastLogin: String? = null,
    
    @SerializedName("isVerified")
    val isVerified: Boolean = false,
    
    @SerializedName("preferences")
    val preferences: UserPreferences? = null
) : Parcelable

@Parcelize
data class UserPreferences(
    @SerializedName("theme")
    val theme: String = "dark",
    
    @SerializedName("audioQuality")
    val audioQuality: String = "high",
    
    @SerializedName("autoPlay")
    val autoPlay: Boolean = true,
    
    @SerializedName("downloadOnWifi")
    val downloadOnWifi: Boolean = true,
    
    @SerializedName("notifications")
    val notifications: Boolean = true
) : Parcelable