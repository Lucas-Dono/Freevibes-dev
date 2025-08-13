package com.freevibes.android.ui.search

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import androidx.core.widget.addTextChangedListener
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.freevibes.android.R
import com.freevibes.android.data.model.Track
import com.freevibes.android.databinding.FragmentSearchBinding
import com.freevibes.android.ui.adapters.TrackVerticalAdapter
import com.freevibes.android.utils.showToast
// import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

// @AndroidEntryPoint
class SearchFragment : Fragment() {

    private var _binding: FragmentSearchBinding? = null
    private val binding get() = _binding!!

    private val viewModel: SearchViewModel by activityViewModels()

    private lateinit var searchAdapter: TrackVerticalAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSearchBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupSearchInput()
        setupClickListeners()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        searchAdapter = TrackVerticalAdapter(
            onTrackClick = { track -> viewModel.onTrackClick(track) },
            onPlayClick = { track -> viewModel.onPlayTrack(track) },
            onLikeClick = { track -> viewModel.onLikeTrack(track) },
            onMoreOptionsClick = { track -> showTrackOptions(track) }
        )

        binding.rvSearchResults.apply {
            adapter = searchAdapter
            layoutManager = LinearLayoutManager(requireContext())
        }
    }

    private fun setupSearchInput() {
        binding.etSearch.apply {
            // Listen for text changes
            addTextChangedListener { text ->
                viewModel.onSearchQueryChanged(text?.toString() ?: "")
            }

            // Handle search action
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                    clearFocus()
                    true
                } else {
                    false
                }
            }
        }
    }

    private fun setupClickListeners() {
        binding.apply {
            btnRetrySearch.setOnClickListener {
                viewModel.retrySearch()
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

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.searchQuery.collect { query ->
                // Update search input if needed (for programmatic changes)
                if (binding.etSearch.text?.toString() != query) {
                    binding.etSearch.setText(query)
                    binding.etSearch.setSelection(query.length)
                }
            }
        }
    }

    private fun updateUI(state: SearchUiState) {
        binding.apply {
            // Update visibility based on state
            layoutLoading.visibility = if (state.isSearching) View.VISIBLE else View.GONE
            rvSearchResults.visibility = if (state.searchResults.isNotEmpty()) View.VISIBLE else View.GONE
            
            // Show appropriate empty state
            when {
                !state.hasSearched -> {
                    layoutEmptySearch.visibility = View.VISIBLE
                    layoutNoResults.visibility = View.GONE
                    layoutError.visibility = View.GONE
                }
                state.errorMessage != null -> {
                    layoutEmptySearch.visibility = View.GONE
                    layoutNoResults.visibility = View.GONE
                    layoutError.visibility = View.VISIBLE
                    tvErrorMessage.text = state.errorMessage
                }
                state.hasSearched && state.searchResults.isEmpty() && !state.isSearching -> {
                    layoutEmptySearch.visibility = View.GONE
                    layoutNoResults.visibility = View.VISIBLE
                    layoutError.visibility = View.GONE
                    
                    // Update no results message with current query
                    val currentQuery = etSearch.text?.toString() ?: ""
                    if (currentQuery.isNotBlank()) {
                        tvNoResultsQuery.text = getString(R.string.no_results_for_query, currentQuery)
                    }
                }
                else -> {
                    layoutEmptySearch.visibility = View.GONE
                    layoutNoResults.visibility = View.GONE
                    layoutError.visibility = View.GONE
                }
            }

            // Update search results
            searchAdapter.submitList(state.searchResults)

            // Handle errors with toast
            state.errorMessage?.let { message ->
                if (state.searchResults.isNotEmpty()) {
                    // Show toast for errors when we have results (like like/play errors)
                    requireContext().showToast(message)
                    viewModel.clearError()
                }
            }
        }
    }

    private fun handleNavigationEvent(event: SearchNavigationEvent) {
        when (event) {
            is SearchNavigationEvent.NavigateToPlayer -> {
                // Navigate to player with track ID
                val action = SearchFragmentDirections.actionSearchToPlayer(event.track.id, null)
                findNavController().navigate(action)
            }
            is SearchNavigationEvent.PlayTrack -> {
                // Start playing track
                // TODO: Implement music service integration
                requireContext().showToast(
                    getString(R.string.now_playing, event.track.title)
                )
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