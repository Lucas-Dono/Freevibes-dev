package com.freevibes.android.ui.library

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.freevibes.android.R
import com.freevibes.android.data.model.Playlist
import com.freevibes.android.data.model.Track
import com.freevibes.android.databinding.FragmentLibraryBinding
import com.freevibes.android.utils.showToast
import com.google.android.material.tabs.TabLayoutMediator
// import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

// @AndroidEntryPoint
class LibraryFragment : Fragment() {

    private var _binding: FragmentLibraryBinding? = null
    private val binding get() = _binding!!

    private val viewModel: LibraryViewModel by activityViewModels()

    private lateinit var tabsAdapter: LibraryTabsAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLibraryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViewPager()
        setupClickListeners()
        observeViewModel()
    }

    private fun setupViewPager() {
        tabsAdapter = LibraryTabsAdapter(requireActivity())
        binding.viewPager.adapter = tabsAdapter

        // Setup TabLayout with ViewPager2
        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> getString(R.string.playlists)
                1 -> getString(R.string.liked_songs)
                2 -> getString(R.string.recently_played)
                else -> ""
            }
        }.attach()

        // Listen for tab selection
        binding.tabLayout.addOnTabSelectedListener(
            object : com.google.android.material.tabs.TabLayout.OnTabSelectedListener {
                override fun onTabSelected(tab: com.google.android.material.tabs.TabLayout.Tab?) {
                    tab?.position?.let { position ->
                        val libraryTab = when (position) {
                            0 -> LibraryTab.PLAYLISTS
                            1 -> LibraryTab.LIKED_TRACKS
                            2 -> LibraryTab.RECENTLY_PLAYED
                            else -> LibraryTab.PLAYLISTS
                        }
                        viewModel.onTabSelected(libraryTab)
                    }
                }

                override fun onTabUnselected(tab: com.google.android.material.tabs.TabLayout.Tab?) {}
                override fun onTabReselected(tab: com.google.android.material.tabs.TabLayout.Tab?) {}
            }
        )
    }

    private fun setupClickListeners() {
        binding.apply {
            // Create playlist button
            btnCreatePlaylist.setOnClickListener {
                viewModel.onCreatePlaylistClick()
            }

            // Swipe refresh
            swipeRefresh.setOnRefreshListener {
                viewModel.refreshCurrentTab()
            }

            // TODO: Add retry button to error layout when implemented
            // btnRetryLibrary.setOnClickListener {
            //     viewModel.loadLibraryData()
            // }

            // Empty state explore button
            binding.btnExploreMusic.setOnClickListener {
                // Navigate to home/search
                findNavController().navigate(R.id.homeFragment)
            }
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                updateUI(state)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.navigationEvent.collect { event ->
                event?.let {
                    handleNavigationEvent(it)
                    viewModel.clearNavigationEvent()
                }
            }
        }
    }

    private fun updateUI(state: LibraryUiState) {
        binding.apply {
            // Update loading state
            swipeRefresh.isRefreshing = state.isLoading
            layoutLoading.visibility = if (state.isLoading && !swipeRefresh.isRefreshing) {
                View.VISIBLE
            } else {
                View.GONE
            }

            // Check if library is empty
            val isEmpty = state.playlists.isEmpty() && 
                         state.likedTracks.isEmpty() && 
                         state.recentlyPlayed.isEmpty()

            // Update visibility based on state
            when {
                state.errorMessage != null -> {
                    // TODO: Add proper error layout to fragment_library.xml
                    binding.viewPager.visibility = View.GONE
                    binding.layoutEmpty.visibility = View.VISIBLE
                    // Show error as toast for now
                    requireContext().showToast(state.errorMessage)
                }
                isEmpty && !state.isLoading -> {
                    binding.viewPager.visibility = View.GONE
                    binding.layoutEmpty.visibility = View.VISIBLE
                }
                else -> {
                    binding.viewPager.visibility = View.VISIBLE
                    binding.layoutEmpty.visibility = View.GONE
                }
            }

            // Handle errors with toast for non-critical errors
            state.errorMessage?.let { message ->
                if (!isEmpty) {
                    // Show toast for errors when we have content
                    requireContext().showToast(message)
                    viewModel.clearError()
                }
            }
        }
    }

    private fun handleNavigationEvent(event: LibraryNavigationEvent) {
        when (event) {
            is LibraryNavigationEvent.NavigateToPlaylist -> {
                // TODO: Navigate to playlist detail when PlaylistDetailFragment is implemented
                // val action = LibraryFragmentDirections.actionLibraryToPlaylistDetail(event.playlist)
                // findNavController().navigate(action)
            }
            is LibraryNavigationEvent.NavigateToPlayer -> {
                // Navigate to player with track ID
                val action = LibraryFragmentDirections.actionLibraryToPlayer(event.track.id, null)
                findNavController().navigate(action)
            }
            is LibraryNavigationEvent.PlayTrack -> {
                // Start playing track
                // TODO: Implement music service integration
                requireContext().showToast(
                    getString(R.string.now_playing, event.track.title)
                )
            }
            is LibraryNavigationEvent.NavigateToCreatePlaylist -> {
                // TODO: Navigate to create playlist when CreatePlaylistFragment is implemented
                // val action = LibraryFragmentDirections.actionLibraryToCreatePlaylist()
                // findNavController().navigate(action)
            }
        }
    }

    // Method to handle playlist click from child fragments
    fun onPlaylistClick(playlist: Playlist) {
        viewModel.onPlaylistClick(playlist)
    }

    // Method to handle track click from child fragments
    fun onTrackClick(track: Track) {
        viewModel.onTrackClick(track)
    }

    // Method to handle play track from child fragments
    fun onPlayTrack(track: Track) {
        viewModel.onPlayTrack(track)
    }

    // Method to handle like track from child fragments
    fun onLikeTrack(track: Track) {
        viewModel.onLikeTrack(track)
    }

    // Method to handle create playlist from child fragments
    fun onCreatePlaylistClick() {
        viewModel.onCreatePlaylistClick()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}