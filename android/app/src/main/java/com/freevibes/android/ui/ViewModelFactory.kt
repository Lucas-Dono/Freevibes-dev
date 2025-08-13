package com.freevibes.android.ui

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.freevibes.android.data.api.AuthApiService
import com.freevibes.android.data.api.MusicApiService
import com.freevibes.android.data.local.TokenManager
import com.freevibes.android.data.local.OfflineMusicManager
import com.freevibes.android.data.network.AuthInterceptor
import com.freevibes.android.data.repository.AuthRepository
import com.freevibes.android.data.repository.MusicRepository
import com.freevibes.android.utils.NetworkStateManager
import com.freevibes.android.ui.auth.AuthViewModel
import com.freevibes.android.ui.home.HomeViewModel
import com.freevibes.android.ui.library.LibraryViewModel
import com.freevibes.android.ui.offline.OfflineViewModel
import com.freevibes.android.ui.player.PlayerViewModel
import com.freevibes.android.ui.profile.ProfileViewModel
import com.freevibes.android.ui.search.SearchViewModel
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ViewModelFactory(private val application: Application) : ViewModelProvider.Factory {
    
    private val networkStateManager by lazy {
        NetworkStateManager(application)
    }
    
    private val offlineMusicManager by lazy {
        OfflineMusicManager(application)
    }
    
    private val tokenManager by lazy {
        TokenManager(application, createAuthApiService())
    }
    
    private val authInterceptor by lazy {
        AuthInterceptor(tokenManager)
    }
    
    private val okHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build()
    }
    
    private val retrofit by lazy {
        Retrofit.Builder()
            .baseUrl("http://192.168.0.14:3001/api/") // Physical device - local IP, port 3001
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
    
    private fun createAuthApiService(): AuthApiService {
        // Create a simple retrofit instance for TokenManager initialization
        val simpleRetrofit = Retrofit.Builder()
            .baseUrl("http://192.168.0.14:3001/api/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        return simpleRetrofit.create(AuthApiService::class.java)
    }
    
    private val authApiService by lazy {
        retrofit.create(AuthApiService::class.java)
    }
    
    private val musicApiService by lazy {
        retrofit.create(MusicApiService::class.java)
    }
    
    // tokenManager is now initialized above
    
    private val authRepository by lazy {
        AuthRepository(authApiService, tokenManager, networkStateManager)
    }
    
    private val musicRepository by lazy {
        MusicRepository(musicApiService, offlineMusicManager, networkStateManager)
    }
    
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when (modelClass) {
            AuthViewModel::class.java -> AuthViewModel(authRepository) as T
            HomeViewModel::class.java -> HomeViewModel(musicRepository) as T
            SearchViewModel::class.java -> SearchViewModel(musicRepository) as T
            LibraryViewModel::class.java -> LibraryViewModel(musicRepository) as T
            ProfileViewModel::class.java -> ProfileViewModel(authRepository, musicRepository) as T
            PlayerViewModel::class.java -> PlayerViewModel(application) as T
            OfflineViewModel::class.java -> OfflineViewModel(musicRepository, networkStateManager) as T
            else -> throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        }
    }
}