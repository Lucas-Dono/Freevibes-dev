package com.freevibes.android.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.freevibes.android.R
import com.freevibes.android.databinding.FragmentRegisterBinding
import com.freevibes.android.utils.Result
// import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

// @AndroidEntryPoint
class RegisterFragment : Fragment() {

    private var _binding: FragmentRegisterBinding? = null
    private val binding get() = _binding!!
    
    private val authViewModel: AuthViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRegisterBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupClickListeners()
        observeViewModel()
    }

    private fun setupClickListeners() {
        binding.btnRegister.setOnClickListener {
            val username = binding.etUsername.text.toString().trim()
            val displayName = binding.etDisplayName.text.toString().trim()
            val email = binding.etEmail.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()
            val confirmPassword = binding.etConfirmPassword.text.toString().trim()
            
            if (validateInput(username, displayName, email, password, confirmPassword)) {
                authViewModel.register(username, displayName, email, password)
            }
        }

        binding.tvLogin.setOnClickListener {
            findNavController().navigate(R.id.action_register_to_login)
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            authViewModel.uiState.collect { state ->
                setLoadingState(state.isLoading)
                
                if (state.isAuthenticated && state.user != null) {
                    Toast.makeText(context, getString(R.string.success_register), Toast.LENGTH_SHORT).show()
                    findNavController().navigate(R.id.action_register_to_home)
                }
                
                state.error?.let { error ->
                    showError(error)
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            authViewModel.navigationEvent.collect { event ->
                when (event) {
                    is AuthNavigationEvent.NavigateToMain -> {
                        findNavController().navigate(R.id.action_register_to_home)
                    }
                    is AuthNavigationEvent.ShowMessage -> {
                        Toast.makeText(context, event.message, Toast.LENGTH_SHORT).show()
                    }
                    is AuthNavigationEvent.NavigateToLogin -> {
                        // Handle if needed
                    }
                }
            }
        }
    }

    private fun validateInput(
        username: String,
        displayName: String,
        email: String,
        password: String,
        confirmPassword: String
    ): Boolean {
        var isValid = true

        if (username.isEmpty()) {
            binding.tilUsername.error = "El nombre de usuario es requerido"
            isValid = false
        } else if (username.length < 3) {
            binding.tilUsername.error = "El nombre de usuario debe tener al menos 3 caracteres"
            isValid = false
        } else if (!username.matches(Regex("^[a-zA-Z0-9_]+$"))) {
            binding.tilUsername.error = "Solo se permiten letras, números y guiones bajos"
            isValid = false
        } else {
            binding.tilUsername.error = null
        }

        if (displayName.isEmpty()) {
            binding.tilDisplayName.error = "El nombre completo es requerido"
            isValid = false
        } else if (displayName.length < 2) {
            binding.tilDisplayName.error = "El nombre debe tener al menos 2 caracteres"
            isValid = false
        } else {
            binding.tilDisplayName.error = null
        }

        if (email.isEmpty()) {
            binding.tilEmail.error = "El email es requerido"
            isValid = false
        } else if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            binding.tilEmail.error = getString(R.string.error_invalid_email)
            isValid = false
        } else {
            binding.tilEmail.error = null
        }

        if (password.isEmpty()) {
            binding.tilPassword.error = "La contraseña es requerida"
            isValid = false
        } else if (password.length < 6) {
            binding.tilPassword.error = getString(R.string.error_weak_password)
            isValid = false
        } else {
            binding.tilPassword.error = null
        }

        if (confirmPassword.isEmpty()) {
            binding.tilConfirmPassword.error = "Confirma tu contraseña"
            isValid = false
        } else if (password != confirmPassword) {
            binding.tilConfirmPassword.error = "Las contraseñas no coinciden"
            isValid = false
        } else {
            binding.tilConfirmPassword.error = null
        }

        return isValid
    }

    private fun setLoadingState(isLoading: Boolean) {
        binding.progressBar.isVisible = isLoading
        binding.btnRegister.isEnabled = !isLoading
        binding.btnRegister.text = if (isLoading) "" else getString(R.string.auth_create_account)
    }

    private fun showError(message: String) {
        val errorMessage = when {
            message.contains("exists", ignoreCase = true) -> getString(R.string.error_user_exists)
            message.contains("email", ignoreCase = true) -> getString(R.string.error_invalid_email)
            message.contains("password", ignoreCase = true) -> getString(R.string.error_weak_password)
            message.contains("network", ignoreCase = true) -> getString(R.string.error_network)
            message.contains("timeout", ignoreCase = true) -> getString(R.string.error_timeout)
            else -> message
        }
        Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}