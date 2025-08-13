package com.freevibes.android.data.repository

import com.freevibes.android.data.api.AuthApiService
import com.freevibes.android.data.local.TokenManager
import com.freevibes.android.data.model.*
import com.freevibes.android.utils.NetworkStateManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import com.freevibes.android.utils.Result
import java.net.UnknownHostException
import java.net.SocketTimeoutException
import java.io.IOException
// import javax.inject.Inject
// import javax.inject.Singleton

// @Singleton
class AuthRepository constructor(
    private val authApiService: AuthApiService,
    private val tokenManager: TokenManager,
    private val networkStateManager: NetworkStateManager
) {
    
    suspend fun login(email: String, password: String): Flow<Result<User>> = flow {
        try {
            emit(Result.Loading)
            
            val response = authApiService.login(LoginRequest(email, password))
            
            if (response.isSuccessful) {
                val authResponse = response.body()
                if (authResponse?.success == true && authResponse.user != null) {
                    // Save tokens
                    authResponse.accessToken?.let { accessToken ->
                        authResponse.refreshToken?.let { refreshToken ->
                            tokenManager.saveTokens(
                                accessToken = accessToken,
                                refreshToken = refreshToken,
                                expiresIn = authResponse.expiresIn
                            )
                        }
                    }
                    
                    emit(Result.Success(authResponse.user))
                } else {
                    emit(Result.Error(authResponse?.message ?: "Error de autenticación"))
                }
            } else {
                val errorMessage = when (response.code()) {
                    401 -> "Credenciales incorrectas"
                    429 -> "Demasiados intentos. Intenta más tarde"
                    500 -> "Error del servidor"
                    else -> "Error de conexión"
                }
                emit(Result.Error(errorMessage))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun register(
        username: String,
        email: String,
        password: String,
        displayName: String? = null
    ): Flow<Result<User>> = flow {
        try {
            emit(Result.Loading)
            
            val response = authApiService.register(
                RegisterRequest(username, email, password, displayName)
            )
            
            if (response.isSuccessful) {
                val authResponse = response.body()
                if (authResponse?.success == true && authResponse.user != null) {
                    // Save tokens
                    authResponse.accessToken?.let { accessToken ->
                        authResponse.refreshToken?.let { refreshToken ->
                            tokenManager.saveTokens(
                                accessToken = accessToken,
                                refreshToken = refreshToken,
                                expiresIn = authResponse.expiresIn
                            )
                        }
                    }
                    
                    emit(Result.Success(authResponse.user))
                } else {
                    emit(Result.Error(authResponse?.message ?: "Error en el registro"))
                }
            } else {
                val errorMessage = when (response.code()) {
                    400 -> "Datos inválidos"
                    409 -> "El usuario ya existe"
                    429 -> "Demasiados intentos. Intenta más tarde"
                    500 -> "Error del servidor"
                    else -> "Error de conexión"
                }
                emit(Result.Error(errorMessage))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun logout(): Flow<Result<Unit>> = flow {
        try {
            emit(Result.Loading)
            
            val refreshToken = tokenManager.getRefreshToken()
            if (refreshToken != null) {
                authApiService.logout(LogoutRequest(refreshToken))
            }
            
            tokenManager.clearTokens()
            emit(Result.Success(Unit))
        } catch (e: Exception) {
            // Even if logout fails on server, clear local tokens
            tokenManager.clearTokens()
            emit(Result.Success(Unit))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun getCurrentUser(): Flow<Result<User>> = flow {
        try {
            emit(Result.Loading)
            
            if (!tokenManager.isLoggedIn()) {
                emit(Result.Error("No hay sesión activa"))
                return@flow
            }
            
            val response = authApiService.getCurrentUser()
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true && apiResponse.data != null) {
                    emit(Result.Success(apiResponse.data))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al obtener usuario"))
                }
            } else {
                if (response.code() == 401) {
                    tokenManager.clearTokens()
                    emit(Result.Error("Sesión expirada"))
                } else {
                    emit(Result.Error("Error del servidor"))
                }
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun validateToken(): Flow<Result<Boolean>> = flow {
        try {
            emit(Result.Loading)
            
            if (!tokenManager.isLoggedIn()) {
                emit(Result.Success(false))
                return@flow
            }
            
            val response = authApiService.validateToken()
            
            if (response.isSuccessful) {
                val validationResponse = response.body()
                emit(Result.Success(validationResponse?.valid == true))
            } else {
                if (response.code() == 401) {
                    tokenManager.clearTokens()
                }
                emit(Result.Success(false))
            }
        } catch (e: Exception) {
            emit(Result.Success(false))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun changePassword(
        currentPassword: String,
        newPassword: String
    ): Flow<Result<Unit>> = flow {
        try {
            emit(Result.Loading)
            
            val response = authApiService.changePassword(
                ChangePasswordRequest(currentPassword, newPassword)
            )
            
            if (response.isSuccessful) {
                val apiResponse = response.body()
                if (apiResponse?.success == true) {
                    emit(Result.Success(Unit))
                } else {
                    emit(Result.Error(apiResponse?.message ?: "Error al cambiar contraseña"))
                }
            } else {
                val errorMessage = when (response.code()) {
                    400 -> "Contraseña actual incorrecta"
                    401 -> "Sesión expirada"
                    else -> "Error del servidor"
                }
                emit(Result.Error(errorMessage))
            }
        } catch (e: Exception) {
            emit(Result.Error("Error de red: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun isLoggedIn(): Boolean {
        return tokenManager.isLoggedIn()
    }
    
    suspend fun checkAuthStatusOffline(): Flow<Result<User?>> = flow {
        try {
            emit(Result.Loading)
            
            // First check if we have local tokens
            if (!tokenManager.isLoggedIn()) {
                emit(Result.Success(null))
                return@flow
            }
            
            // If we're offline, try to get cached user info
            if (!networkStateManager.canMakeNetworkRequests()) {
                // Return a basic user object from token if available
                val token = tokenManager.getAccessToken()
                if (!token.isNullOrEmpty()) {
                    // Create a basic user object for offline mode
                    val offlineUser = User(
                        id = "offline",
                        username = "offline_user",
                        email = "offline@local",
                        displayName = "Usuario Offline"
                    )
                    emit(Result.Success(offlineUser))
                } else {
                    emit(Result.Success(null))
                }
                return@flow
            }
            
            // If online, try to get current user
            try {
                val response = authApiService.getCurrentUser()
                if (response.isSuccessful) {
                    val userResponse = response.body()
                    if (userResponse?.success == true) {
                        networkStateManager.setServerReachable(true)
                        emit(Result.Success(userResponse.data))
                    } else {
                        emit(Result.Success(null))
                    }
                } else if (response.code() == 401) {
                    // Token expired, try to refresh
                    val refreshResult = tokenManager.getAccessTokenWithRefresh()
                    if (!refreshResult.isNullOrEmpty()) {
                        // Retry with new token
                        val retryResponse = authApiService.getCurrentUser()
                        if (retryResponse.isSuccessful) {
                            val retryUserResponse = retryResponse.body()
                            networkStateManager.setServerReachable(true)
                            emit(Result.Success(retryUserResponse?.data))
                        } else {
                            emit(Result.Success(null))
                        }
                    } else {
                        emit(Result.Success(null))
                    }
                } else {
                    networkStateManager.setServerReachable(false)
                    emit(Result.Success(null))
                }
            } catch (e: UnknownHostException) {
                networkStateManager.setServerReachable(false)
                // Server unreachable, but we have tokens - use offline mode
                val token = tokenManager.getAccessToken()
                if (!token.isNullOrEmpty()) {
                    val offlineUser = User(
                        id = "offline",
                        username = "offline_user",
                        email = "offline@local",
                        displayName = "Usuario Offline"
                    )
                    emit(Result.Success(offlineUser))
                } else {
                    emit(Result.Success(null))
                }
            } catch (e: SocketTimeoutException) {
                networkStateManager.setServerReachable(false)
                // Timeout - use offline mode if we have tokens
                val token = tokenManager.getAccessToken()
                if (!token.isNullOrEmpty()) {
                    val offlineUser = User(
                        id = "offline",
                        username = "offline_user",
                        email = "offline@local",
                        displayName = "Usuario Offline"
                    )
                    emit(Result.Success(offlineUser))
                } else {
                    emit(Result.Success(null))
                }
            } catch (e: IOException) {
                networkStateManager.setServerReachable(false)
                // Network error - use offline mode if we have tokens
                val token = tokenManager.getAccessToken()
                if (!token.isNullOrEmpty()) {
                    val offlineUser = User(
                        id = "offline",
                        username = "offline_user",
                        email = "offline@local",
                        displayName = "Usuario Offline"
                    )
                    emit(Result.Success(offlineUser))
                } else {
                    emit(Result.Success(null))
                }
            } catch (e: Exception) {
                // Any other error - check if we have tokens for offline mode
                val token = tokenManager.getAccessToken()
                if (!token.isNullOrEmpty()) {
                    val offlineUser = User(
                        id = "offline",
                        username = "offline_user",
                        email = "offline@local",
                        displayName = "Usuario Offline"
                    )
                    emit(Result.Success(offlineUser))
                } else {
                    emit(Result.Error("Error de autenticación: ${e.message}"))
                }
            }
        } catch (e: Exception) {
            // Outer catch for any unexpected errors
            emit(Result.Error("Error inesperado: ${e.message}"))
        }
    }.flowOn(Dispatchers.IO)
    
    suspend fun refreshToken(): Boolean {
        return tokenManager.refreshToken()
    }
}