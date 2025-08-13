package com.freevibes.android.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.freevibes.android.data.model.User
import com.freevibes.android.data.repository.AuthRepository
import com.freevibes.android.utils.Result
// import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
// import javax.inject.Inject

// @HiltViewModel
class AuthViewModel constructor(
    private val authRepository: AuthRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    
    private val _navigationEvent = MutableSharedFlow<AuthNavigationEvent>()
    val navigationEvent: SharedFlow<AuthNavigationEvent> = _navigationEvent.asSharedFlow()
    
    // Debug mode - set to true to skip login
    private val DEBUG_MODE = true
    
    init {
        if (DEBUG_MODE) {
            enableDebugMode()
        } else {
            checkAuthStatusImmediately()
        }
    }
    
    private fun enableDebugMode() {
        viewModelScope.launch {
            // Create a debug user to skip login
            val debugUser = User(
                id = "debug_user_001",
                username = "debug_user",
                email = "debug@freevibes.com",
                displayName = "Usuario Debug"
            )
            
            _uiState.value = _uiState.value.copy(
                user = debugUser,
                isAuthenticated = true,
                isLoading = false,
                error = null
            )
            
            // Don't emit navigation event - MainActivity will handle navigation based on auth state
        }
    }
    
    fun login(email: String, password: String) {
        if (!validateLoginInput(email, password)) return
        
        viewModelScope.launch {
            authRepository.login(email, password).collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = true,
                            error = null
                        )
                    }
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            user = result.data,
                            isAuthenticated = true,
                            error = null
                        )
                        _navigationEvent.emit(AuthNavigationEvent.NavigateToMain)
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = result.message
                        )
                    }
                }
            }
        }
    }
    
    fun register(username: String, email: String, password: String, displayName: String? = null) {
        if (!validateRegisterInput(username, email, password)) return
        
        viewModelScope.launch {
            authRepository.register(username, email, password, displayName).collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = true,
                            error = null
                        )
                    }
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            user = result.data,
                            isAuthenticated = true,
                            error = null
                        )
                        _navigationEvent.emit(AuthNavigationEvent.NavigateToMain)
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = result.message
                        )
                    }
                }
            }
        }
    }
    
    fun logout() {
        viewModelScope.launch {
            authRepository.logout().collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(isLoading = true)
                    }
                    is Result.Success -> {
                        _uiState.value = AuthUiState()
                        _navigationEvent.emit(AuthNavigationEvent.NavigateToLogin)
                    }
                    is Result.Error -> {
                        // Even if logout fails, clear local state
                        _uiState.value = AuthUiState()
                        _navigationEvent.emit(AuthNavigationEvent.NavigateToLogin)
                    }
                }
            }
        }
    }
    
    fun getCurrentUser() {
        viewModelScope.launch {
            authRepository.getCurrentUser().collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(isLoading = true)
                    }
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            user = result.data,
                            isAuthenticated = true,
                            error = null
                        )
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isAuthenticated = false,
                            error = result.message
                        )
                    }
                }
            }
        }
    }
    
    fun changePassword(currentPassword: String, newPassword: String) {
        if (!validatePasswordChange(currentPassword, newPassword)) return
        
        viewModelScope.launch {
            authRepository.changePassword(currentPassword, newPassword).collect { result ->
                when (result) {
                    is Result.Loading -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = true,
                            error = null
                        )
                    }
                    is Result.Success -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = null
                        )
                        _navigationEvent.emit(AuthNavigationEvent.ShowMessage("Contraseña cambiada exitosamente"))
                    }
                    is Result.Error -> {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = result.message
                        )
                    }
                }
            }
        }
    }
    
    private fun checkAuthStatusImmediately() {
        viewModelScope.launch {
            try {
                // Check local authentication status immediately without network calls
                val isLoggedIn = authRepository.isLoggedIn()
                
                if (isLoggedIn) {
                    // Create offline user immediately to allow app to start
                    val offlineUser = User(
                        id = "offline",
                        username = "offline_user",
                        email = "offline@local",
                        displayName = "Usuario"
                    )
                    
                    _uiState.value = _uiState.value.copy(
                        user = offlineUser,
                        isAuthenticated = true,
                        isLoading = false,
                        error = null
                    )
                    
                    // Update user info in background
                    getCurrentUserInBackground()
                } else {
                    _uiState.value = _uiState.value.copy(
                        user = null,
                        isAuthenticated = false,
                        isLoading = false,
                        error = null
                    )
                }
            } catch (e: Exception) {
                // Ensure loading state is always set to false
                _uiState.value = _uiState.value.copy(
                    user = null,
                    isAuthenticated = false,
                    isLoading = false,
                    error = "Error de inicialización: ${e.message}"
                )
            }
        }
    }
    
    private fun getCurrentUserInBackground() {
        viewModelScope.launch {
            try {
                authRepository.getCurrentUser().collect { result ->
                    when (result) {
                        is Result.Success -> {
                            _uiState.value = _uiState.value.copy(
                                user = result.data,
                                error = null
                            )
                        }
                        is Result.Error -> {
                            // Don't update authentication status on network error
                            // Keep user logged in for offline use
                            if (result.message.contains("red", ignoreCase = true) || 
                                result.message.contains("network", ignoreCase = true) ||
                                result.message.contains("conexión", ignoreCase = true)) {
                                // Network error - keep offline mode
                                _uiState.value = _uiState.value.copy(
                                    error = "Modo offline - Funciones de red limitadas"
                                )
                            } else if (result.message.contains("401") || 
                                      result.message.contains("expirada", ignoreCase = true)) {
                                // Token expired - logout
                                _uiState.value = _uiState.value.copy(
                                    isAuthenticated = false,
                                    user = null,
                                    error = "Sesión expirada"
                                )
                            }
                        }
                        is Result.Loading -> {
                            // Don't show loading for background requests
                        }
                    }
                }
            } catch (e: Exception) {
                // Silently handle background errors
                _uiState.value = _uiState.value.copy(
                    error = "Modo offline - Funciones de red limitadas"
                )
            }
        }
    }
    
    private fun checkAuthStatus() {
        viewModelScope.launch {
            val isLoggedIn = authRepository.isLoggedIn()
            if (isLoggedIn) {
                getCurrentUser()
            } else {
                _uiState.value = _uiState.value.copy(isAuthenticated = false)
            }
        }
    }
    
    private fun validateLoginInput(email: String, password: String): Boolean {
        return when {
            email.isBlank() -> {
                _uiState.value = _uiState.value.copy(error = "El email es requerido")
                false
            }
            !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches() -> {
                _uiState.value = _uiState.value.copy(error = "Email inválido")
                false
            }
            password.isBlank() -> {
                _uiState.value = _uiState.value.copy(error = "La contraseña es requerida")
                false
            }
            password.length < 6 -> {
                _uiState.value = _uiState.value.copy(error = "La contraseña debe tener al menos 6 caracteres")
                false
            }
            else -> true
        }
    }
    
    private fun validateRegisterInput(username: String, email: String, password: String): Boolean {
        return when {
            username.isBlank() -> {
                _uiState.value = _uiState.value.copy(error = "El nombre de usuario es requerido")
                false
            }
            username.length < 3 -> {
                _uiState.value = _uiState.value.copy(error = "El nombre de usuario debe tener al menos 3 caracteres")
                false
            }
            email.isBlank() -> {
                _uiState.value = _uiState.value.copy(error = "El email es requerido")
                false
            }
            !android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches() -> {
                _uiState.value = _uiState.value.copy(error = "Email inválido")
                false
            }
            password.isBlank() -> {
                _uiState.value = _uiState.value.copy(error = "La contraseña es requerida")
                false
            }
            password.length < 6 -> {
                _uiState.value = _uiState.value.copy(error = "La contraseña debe tener al menos 6 caracteres")
                false
            }
            else -> true
        }
    }
    
    private fun validatePasswordChange(currentPassword: String, newPassword: String): Boolean {
        return when {
            currentPassword.isBlank() -> {
                _uiState.value = _uiState.value.copy(error = "La contraseña actual es requerida")
                false
            }
            newPassword.isBlank() -> {
                _uiState.value = _uiState.value.copy(error = "La nueva contraseña es requerida")
                false
            }
            newPassword.length < 6 -> {
                _uiState.value = _uiState.value.copy(error = "La nueva contraseña debe tener al menos 6 caracteres")
                false
            }
            currentPassword == newPassword -> {
                _uiState.value = _uiState.value.copy(error = "La nueva contraseña debe ser diferente a la actual")
                false
            }
            else -> true
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

data class AuthUiState(
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val user: User? = null,
    val error: String? = null
)

sealed class AuthNavigationEvent {
    object NavigateToMain : AuthNavigationEvent()
    object NavigateToLogin : AuthNavigationEvent()
    data class ShowMessage(val message: String) : AuthNavigationEvent()
}