package com.freevibes.android.data.api

import com.freevibes.android.BuildConfig
import com.freevibes.android.data.local.TokenManager
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        // Add common headers
        val requestBuilder = originalRequest.newBuilder()
            .addHeader("User-Agent", BuildConfig.USER_AGENT)
            .addHeader("X-Android-App", "true")
            .addHeader("X-App-Version", BuildConfig.VERSION_NAME)
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")
        
        // Add authorization header if token exists
        runBlocking {
            val token = tokenManager.getAccessToken()
            if (!token.isNullOrEmpty()) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }
        }
        
        val request = requestBuilder.build()
        val response = chain.proceed(request)
        
        // Handle token expiration
        if (response.code == 401) {
            response.close()
            
            // Try to refresh token
            val refreshed = runBlocking {
                try {
                    tokenManager.refreshToken()
                } catch (e: Exception) {
                    false
                }
            }
            
            if (refreshed) {
                // Retry request with new token
                val newToken = runBlocking { tokenManager.getAccessToken() }
                val newRequest = originalRequest.newBuilder()
                    .addHeader("User-Agent", BuildConfig.USER_AGENT)
                    .addHeader("X-Android-App", "true")
                    .addHeader("X-App-Version", BuildConfig.VERSION_NAME)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Accept", "application/json")
                    .addHeader("Authorization", "Bearer $newToken")
                    .build()
                
                return chain.proceed(newRequest)
            } else {
                // Clear tokens and redirect to login
                runBlocking {
                    tokenManager.clearTokens()
                }
            }
        }
        
        return response
    }
}