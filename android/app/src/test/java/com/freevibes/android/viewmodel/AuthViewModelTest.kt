package com.freevibes.android.viewmodel

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import com.freevibes.android.data.repository.AuthRepository
import com.freevibes.android.data.model.User
import com.freevibes.android.utils.Result
import com.freevibes.android.ui.auth.AuthViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever
import org.mockito.kotlin.verify
import org.junit.Assert.*
import org.robolectric.annotation.Config
import android.os.Build
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [Build.VERSION_CODES.P])
class AuthViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = UnconfinedTestDispatcher()

    @Mock
    private lateinit var authRepository: AuthRepository

    private lateinit var authViewModel: AuthViewModel

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        Dispatchers.setMain(testDispatcher)
    }
    
    private fun createAuthViewModel(): AuthViewModel {
        return runBlocking {
            // Mock the suspend methods called in AuthViewModel init
            whenever(authRepository.isLoggedIn()).thenReturn(false)
            whenever(authRepository.getCurrentUser()).thenReturn(flowOf(Result.Error("Not authenticated")))
            
            AuthViewModel(authRepository)
        }
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `login with valid credentials should return success`() = runTest {
        // Given
        val authViewModel = createAuthViewModel()
        val email = "test@example.com"
        val password = "password123"
        val user = User(
            id = "1",
            username = "testuser",
            email = email,
            displayName = "Test User",
            avatar = null,
            createdAt = "2024-01-01T00:00:00Z",
            lastLogin = null,
            isVerified = false,
            preferences = null
        )
        
        whenever(authRepository.login(email, password)).thenReturn(flowOf(Result.Success(user)))

        // When
        authViewModel.login(email, password)

        // Then
        verify(authRepository).login(email, password)
        assertTrue(authViewModel.uiState.value.isAuthenticated)
        assertEquals(user, authViewModel.uiState.value.user)
    }

    @Test
    fun `login with invalid credentials should return error`() = runTest {
        // Given
        val authViewModel = createAuthViewModel()
        val email = "test@example.com"
        val password = "wrongpassword"
        val errorMessage = "Invalid credentials"
        
        whenever(authRepository.login(email, password)).thenReturn(flowOf(Result.Error(errorMessage)))

        // When
        authViewModel.login(email, password)

        // Then
        verify(authRepository).login(email, password)
        assertNotNull(authViewModel.uiState.value.error)
        assertEquals(errorMessage, authViewModel.uiState.value.error)
    }

    @Test
    fun `register with valid data should return success`() = runTest {
        // Given
        val authViewModel = createAuthViewModel()
        val email = "newuser@example.com"
        val username = "newuser"
        val password = "password123"
        val firstName = "New"
        val lastName = "User"
        val user = User(
            id = "2",
            username = username,
            email = email,
            displayName = "$firstName $lastName",
            avatar = null,
            createdAt = "2024-01-01T00:00:00Z",
            lastLogin = null,
            isVerified = false,
            preferences = null
        )
        
        whenever(authRepository.register(username, email, password, "$firstName $lastName")).thenReturn(flowOf(Result.Success(user)))

        // When
        authViewModel.register(username, email, password, "$firstName $lastName")

        // Then
        verify(authRepository).register(username, email, password, "$firstName $lastName")
        assertTrue(authViewModel.uiState.value.isAuthenticated)
        assertEquals(user, authViewModel.uiState.value.user)
    }

}