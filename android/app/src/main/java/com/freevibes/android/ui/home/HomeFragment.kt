package com.freevibes.android.ui.home

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.freevibes.android.R
import com.freevibes.android.data.model.Track
import com.freevibes.android.databinding.FragmentHomeBinding
import com.freevibes.android.ui.adapters.TrackHorizontalAdapter
import com.freevibes.android.ui.adapters.TrackVerticalAdapter
import com.freevibes.android.ui.ViewModelFactory
import com.freevibes.android.utils.showToast
// import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

// @AndroidEntryPoint
class HomeFragment : Fragment() {

    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    private val viewModel: HomeViewModel by viewModels { 
        ViewModelFactory(requireActivity().application) 
    }

    private lateinit var trendingAdapter: TrackHorizontalAdapter
    private lateinit var recommendedAdapter: TrackVerticalAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerViews()
        setupClickListeners()
        observeViewModel()
    }

    private fun setupRecyclerViews() {
        // Setup trending tracks RecyclerView
        trendingAdapter = TrackHorizontalAdapter(
            onTrackClick = { track -> viewModel.onTrackClick(track) },
            onPlayClick = { track -> viewModel.onPlayTrack(track) },
            onLikeClick = { track -> viewModel.onLikeTrack(track) }
        )

        binding.rvTrendingTracks.apply {
            adapter = trendingAdapter
            layoutManager = LinearLayoutManager(
                requireContext(),
                LinearLayoutManager.HORIZONTAL,
                false
            )
        }

        // Setup recommended tracks RecyclerView
        recommendedAdapter = TrackVerticalAdapter(
            onTrackClick = { track -> viewModel.onTrackClick(track) },
            onPlayClick = { track -> viewModel.onPlayTrack(track) },
            onLikeClick = { track -> viewModel.onLikeTrack(track) },
            onMoreOptionsClick = { track -> showTrackOptions(track) }
        )

        binding.rvRecommendedTracks.apply {
            adapter = recommendedAdapter
            layoutManager = LinearLayoutManager(requireContext())
        }
    }

    private fun setupClickListeners() {
        binding.apply {
            // Swipe to refresh
            swipeRefreshLayout.setOnRefreshListener {
                viewModel.onRefresh()
            }

            // Profile click
            ivProfile.setOnClickListener {
                viewModel.onProfileClick()
            }

            // See all buttons
            tvSeeAllTrending.setOnClickListener {
                // Navigate to trending tracks screen
                // TODO: Implement trending tracks screen
                requireContext().showToast(getString(R.string.feature_coming_soon))
            }

            tvSeeAllRecommended.setOnClickListener {
                // Navigate to recommended tracks screen
                // TODO: Implement recommended tracks screen
                requireContext().showToast(getString(R.string.feature_coming_soon))
            }

            // Retry button
            btnRetry.setOnClickListener {
                viewModel.onRefresh()
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

    private fun updateUI(state: HomeUiState) {
        binding.apply {
            // Update loading states
            swipeRefreshLayout.isRefreshing = state.isLoading
            progressTrending.visibility = if (state.isLoadingTrending) View.VISIBLE else View.GONE
            progressRecommended.visibility = if (state.isLoadingRecommended) View.VISIBLE else View.GONE

            // Update data
            trendingAdapter.submitList(state.trendingTracks)
            recommendedAdapter.submitList(state.recommendedTracks)

            // Show/hide empty state
            val isEmpty = state.trendingTracks.isEmpty() && state.recommendedTracks.isEmpty()
            layoutEmptyState.visibility = if (isEmpty && !state.isLoading) View.VISIBLE else View.GONE

            // Show/hide RecyclerViews
            rvTrendingTracks.visibility = if (state.trendingTracks.isNotEmpty()) View.VISIBLE else View.GONE
            rvRecommendedTracks.visibility = if (state.recommendedTracks.isNotEmpty()) View.VISIBLE else View.GONE

            // Handle errors
            state.errorMessage?.let { message ->
                requireContext().showToast(message)
                viewModel.clearError()
            }
        }
    }

    private fun handleNavigationEvent(event: HomeNavigationEvent) {
        when (event) {
            is HomeNavigationEvent.NavigateToPlayer -> {
                // Navigate to player with track ID
                val action = HomeFragmentDirections.actionHomeToPlayer(event.track.id, null)
                findNavController().navigate(action)
            }
            is HomeNavigationEvent.PlayTrack -> {
                // Start playing track
                // TODO: Implement music service integration
                requireContext().showToast(
                    getString(R.string.now_playing, event.track.title)
                )
            }
            is HomeNavigationEvent.NavigateToProfile -> {
                // Navigate to profile
                val action = HomeFragmentDirections.actionHomeToProfile()
                findNavController().navigate(action)
            }
        }
    }

    @Suppress("UNUSED_PARAMETER")
    private fun showTrackOptions(track: Track) {
        // TODO: Implement bottom sheet with track options
        // Options: Add to playlist, Download, Share, etc.
        // Track: ${track.title} by ${track.artist}
        requireContext().showToast(getString(R.string.feature_coming_soon))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}