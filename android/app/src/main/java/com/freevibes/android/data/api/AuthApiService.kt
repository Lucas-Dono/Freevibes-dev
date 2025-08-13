package com.freevibes.android.data.api

import com.freevibes.android.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface AuthApiService {
    
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>
    
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>
    
    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<AuthResponse>
    
    @POST("auth/logout")
    suspend fun logout(@Body request: LogoutRequest): Response<ApiResponse<Unit>>
    
    @GET("auth/me")
    suspend fun getCurrentUser(): Response<ApiResponse<User>>
    
    @POST("auth/validate")
    suspend fun validateToken(): Response<TokenValidationResponse>
    
    @POST("auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): Response<ApiResponse<Unit>>
    
    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): Response<ApiResponse<Unit>>
    
    @POST("auth/reset-password")
    suspend fun resetPassword(@Body request: ResetPasswordRequest): Response<ApiResponse<Unit>>
}