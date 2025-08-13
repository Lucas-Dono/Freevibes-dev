package com.freevibes.android.data.network

import com.freevibes.android.data.local.TokenManager
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        try {
            // Add auth token if available
            val token = runBlocking { tokenManager.getAccessToken() }
            val requestBuilder = originalRequest.newBuilder()
            
            if (!token.isNullOrEmpty()) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }
            
            val request = requestBuilder.build()
            
            // Try to make the request
            return try {
                chain.proceed(request)
            } catch (e: Exception) {
                when (e) {
                    is UnknownHostException,
                    is SocketTimeoutException,
                    is IOException -> {
                        // Create a fake response for network errors
                        // This allows the app to continue working offline
                        createOfflineResponse(originalRequest)
                    }
                    else -> throw e
                }
            }
            
        } catch (e: Exception) {
            // If token retrieval fails, continue without auth
            return try {
                chain.proceed(originalRequest)
            } catch (networkError: Exception) {
                createOfflineResponse(originalRequest)
            }
        }
    }
    
    private fun createOfflineResponse(request: okhttp3.Request): Response {
        return Response.Builder()
            .request(request)
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .code(503) // Service Unavailable
            .message("Offline Mode")
            .body(okhttp3.ResponseBody.create(
                "application/json".toMediaTypeOrNull(),
                "{\"error\": \"Network unavailable - offline mode\"}"
            ))
            .build()
    }
}