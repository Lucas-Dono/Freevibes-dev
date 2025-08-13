package com.freevibes.android.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.freevibes.android.data.api.AuthApiService
import com.freevibes.android.data.model.RefreshTokenRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val authApiService: AuthApiService
) {
    
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
    
    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    suspend fun saveTokens(accessToken: String, refreshToken: String, expiresIn: Long? = null) {
        withContext(Dispatchers.IO) {
            val expirationTime = expiresIn?.let { System.currentTimeMillis() + (it * 1000) }
            
            sharedPreferences.edit()
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, refreshToken)
                .putLong(KEY_TOKEN_EXPIRATION, expirationTime ?: 0L)
                .apply()
        }
    }
    
    suspend fun getAccessToken(): String? {
        return withContext(Dispatchers.IO) {
            sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
        }
    }
    
    suspend fun getAccessTokenWithRefresh(): String? {
        return withContext(Dispatchers.IO) {
            val token = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
            val expiration = sharedPreferences.getLong(KEY_TOKEN_EXPIRATION, 0L)
            
            // Check if token is expired (with 5 minute buffer)
            if (expiration > 0 && System.currentTimeMillis() > (expiration - TOKEN_REFRESH_BUFFER)) {
                if (refreshToken()) {
                    sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
                } else {
                    null
                }
            } else {
                token
            }
        }
    }
    
    suspend fun getRefreshToken(): String? {
        return withContext(Dispatchers.IO) {
            sharedPreferences.getString(KEY_REFRESH_TOKEN, null)
        }
    }
    
    suspend fun refreshToken(): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val refreshToken = getRefreshToken() ?: return@withContext false
                
                val response = authApiService.refreshToken(RefreshTokenRequest(refreshToken))
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val authResponse = response.body()!!
                    val newAccessToken = authResponse.accessToken
                    val newRefreshToken = authResponse.refreshToken ?: refreshToken
                    val expiresIn = authResponse.expiresIn
                    
                    if (newAccessToken != null) {
                        saveTokens(newAccessToken, newRefreshToken, expiresIn)
                        true
                    } else {
                        false
                    }
                } else {
                    clearTokens()
                    false
                }
            } catch (e: Exception) {
                clearTokens()
                false
            }
        }
    }
    
    suspend fun clearTokens() {
        withContext(Dispatchers.IO) {
            sharedPreferences.edit()
                .remove(KEY_ACCESS_TOKEN)
                .remove(KEY_REFRESH_TOKEN)
                .remove(KEY_TOKEN_EXPIRATION)
                .apply()
        }
    }
    
    suspend fun isLoggedIn(): Boolean {
        return withContext(Dispatchers.IO) {
            val token = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)
            !token.isNullOrEmpty()
        }
    }
    
    suspend fun getTokenExpiration(): Long {
        return withContext(Dispatchers.IO) {
            sharedPreferences.getLong(KEY_TOKEN_EXPIRATION, 0L)
        }
    }
    
    suspend fun isTokenExpired(): Boolean {
        return withContext(Dispatchers.IO) {
            val expiration = getTokenExpiration()
            expiration > 0 && System.currentTimeMillis() > expiration
        }
    }
    
    companion object {
        private const val PREFS_NAME = "freevibes_secure_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_TOKEN_EXPIRATION = "token_expiration"
        private const val TOKEN_REFRESH_BUFFER = 5 * 60 * 1000L // 5 minutes
    }
}