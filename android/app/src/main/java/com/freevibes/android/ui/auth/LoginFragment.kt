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
import com.freevibes.android.databinding.FragmentLoginBinding
import com.freevibes.android.utils.Result
// import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

// @AndroidEntryPoint
class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!
    
    private val authViewModel: AuthViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupClickListeners()
        observeViewModel()
    }

    private fun setupClickListeners() {
        binding.btnLogin.setOnClickListener {
            val email = binding.etEmail.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()
            
            if (validateInput(email, password)) {
                authViewModel.login(email, password)
            }
        }

        binding.tvRegister.setOnClickListener {
            findNavController().navigate(R.id.action_login_to_register)
        }

        binding.tvForgotPassword.setOnClickListener {
            // TODO: Implement forgot password functionality
            Toast.makeText(context, "Funcionalidad próximamente", Toast.LENGTH_SHORT).show()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            authViewModel.uiState.collect { state ->
                setLoadingState(state.isLoading)
                
                if (state.isAuthenticated && state.user != null) {
                    Toast.makeText(context, getString(R.string.success_login), Toast.LENGTH_SHORT).show()
                    // MainActivity will handle navigation based on auth state
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
                        // MainActivity will handle navigation based on auth state
                        // No navigation from LoginFragment to avoid conflicts
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

    private fun validateInput(email: String, password: String): Boolean {
        var isValid = true

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
            binding.tilPassword.error = "La contraseña debe tener al menos 6 caracteres"
            isValid = false
        } else {
            binding.tilPassword.error = null
        }

        return isValid
    }

    private fun setLoadingState(isLoading: Boolean) {
        binding.progressBar.isVisible = isLoading
        binding.btnLogin.isEnabled = !isLoading
        binding.btnLogin.text = if (isLoading) "" else getString(R.string.auth_sign_in)
    }

    private fun showError(message: String) {
        val errorMessage = when {
            message.contains("invalid", ignoreCase = true) -> getString(R.string.error_invalid_credentials)
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