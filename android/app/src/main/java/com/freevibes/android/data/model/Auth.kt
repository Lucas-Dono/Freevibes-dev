package com.freevibes.android.data.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    @SerializedName("email")
    val email: String,
    
    @SerializedName("password")
    val password: String
)

data class RegisterRequest(
    @SerializedName("username")
    val username: String,
    
    @SerializedName("email")
    val email: String,
    
    @SerializedName("password")
    val password: String,
    
    @SerializedName("displayName")
    val displayName: String? = null
)

data class AuthResponse(
    @SerializedName("success")
    val success: Boolean,
    
    @SerializedName("message")
    val message: String? = null,
    
    @SerializedName("user")
    val user: User? = null,
    
    @SerializedName("accessToken")
    val accessToken: String? = null,
    
    @SerializedName("refreshToken")
    val refreshToken: String? = null,
    
    @SerializedName("expiresIn")
    val expiresIn: Long? = null
)

data class RefreshTokenRequest(
    @SerializedName("refreshToken")
    val refreshToken: String
)

data class TokenValidationResponse(
    @SerializedName("valid")
    val valid: Boolean,
    
    @SerializedName("user")
    val user: User? = null,
    
    @SerializedName("expiresAt")
    val expiresAt: Long? = null
)

data class LogoutRequest(
    @SerializedName("refreshToken")
    val refreshToken: String? = null
)

data class ChangePasswordRequest(
    @SerializedName("currentPassword")
    val currentPassword: String,
    
    @SerializedName("newPassword")
    val newPassword: String
)

data class ForgotPasswordRequest(
    @SerializedName("email")
    val email: String
)

data class ResetPasswordRequest(
    @SerializedName("token")
    val token: String,
    
    @SerializedName("newPassword")
    val newPassword: String
)