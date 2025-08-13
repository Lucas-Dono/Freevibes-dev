package com.freevibes.android.ui.profile

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.freevibes.android.R
import com.freevibes.android.databinding.FragmentProfileBinding
import com.freevibes.android.util.showSnackbar
// import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

// @AndroidEntryPoint
class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ProfileViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupUI()
        observeViewModel()
    }

    private fun setupUI() {
        // Swipe to refresh
        binding.swipeRefreshLayout.setOnRefreshListener {
            viewModel.loadUserProfile()
        }

        // Click listeners
        binding.editProfileButton.setOnClickListener {
            viewModel.onEditProfileClick()
        }

        binding.myPlaylistsOption.setOnClickListener {
            viewModel.onPlaylistsClick()
        }

        binding.likedSongsOption.setOnClickListener {
            viewModel.onLikedTracksClick()
        }

        binding.recentlyPlayedOption.setOnClickListener {
            viewModel.onRecentlyPlayedClick()
        }

        binding.settingsOption.setOnClickListener {
            viewModel.onSettingsClick()
        }

        binding.logoutButton.setOnClickListener {
            viewModel.onLogoutClick()
        }

        binding.retryButton.setOnClickListener {
            viewModel.onRetryClick()
        }
    }

    private fun observeViewModel() {
        // Observe UI state
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                updateUI(state)
            }
        }

        // Observe navigation events
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.navigationEvent.collect { event ->
                event?.let {
                    handleNavigationEvent(it)
                    viewModel.clearNavigationEvent()
                }
            }
        }
    }

    private fun updateUI(state: ProfileUiState) {
        // Update loading state
        binding.swipeRefreshLayout.isRefreshing = state.isLoading
        binding.progressBar.visibility = if (state.isLoading && state.user == null) {
            View.VISIBLE
        } else {
            View.GONE
        }

        // Update user info
        state.user?.let { user ->
            binding.userName.text = user.displayName ?: user.username
            binding.userEmail.text = user.email
            
            // Load profile image
            Glide.with(this)
                .load(user.avatar)
                .placeholder(R.drawable.ic_profile)
                .error(R.drawable.ic_profile)
                .into(binding.profileImage)
                
            // Show profile content
            binding.swipeRefreshLayout.visibility = View.VISIBLE
            binding.errorLayout.visibility = View.GONE
        }

        // Update stats
        binding.playlistsCount.text = state.totalPlaylists.toString()
        binding.likedTracksCount.text = state.totalLikedTracks.toString()
        binding.listeningTime.text = state.totalListeningTime

        // Handle error state
        if (state.error != null && state.user == null) {
            binding.swipeRefreshLayout.visibility = View.GONE
            binding.errorLayout.visibility = View.VISIBLE
            binding.errorMessage.text = state.error
        } else if (state.error != null) {
            // Show error as snackbar if user data is available
            binding.root.showSnackbar(state.error)
            viewModel.clearError()
        }
    }

    private fun handleNavigationEvent(event: ProfileNavigationEvent) {
        when (event) {
            is ProfileNavigationEvent.NavigateToEditProfile -> {
                // Navigate to edit profile (placeholder)
                binding.root.showSnackbar(getString(R.string.feature_coming_soon))
            }
            is ProfileNavigationEvent.NavigateToSettings -> {
                // Navigate to settings (placeholder)
                binding.root.showSnackbar(getString(R.string.feature_coming_soon))
            }
            is ProfileNavigationEvent.NavigateToPlaylists -> {
                // Navigate to library with playlists tab selected
                findNavController().navigate(
                    ProfileFragmentDirections.actionProfileToLibrary()
                )
            }
            is ProfileNavigationEvent.NavigateToLikedTracks -> {
                // Navigate to library with liked tracks tab selected
                findNavController().navigate(
                    ProfileFragmentDirections.actionProfileToLibrary()
                )
            }
            is ProfileNavigationEvent.NavigateToRecentlyPlayed -> {
                // Navigate to library with recently played tab selected
                findNavController().navigate(
                    ProfileFragmentDirections.actionProfileToLibrary()
                )
            }
            is ProfileNavigationEvent.NavigateToLogin -> {
                // Navigate to login and clear back stack
                findNavController().navigate(
                    ProfileFragmentDirections.actionProfileToLogin()
                )
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}