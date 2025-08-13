package com.freevibes.android.ui.library

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.freevibes.android.R
import com.freevibes.android.data.model.Track
import com.freevibes.android.databinding.FragmentLibraryTracksBinding
import com.freevibes.android.ui.adapters.TrackVerticalAdapter
import com.freevibes.android.utils.showToast
import kotlinx.coroutines.launch

class LibraryTracksFragment : Fragment() {

    private var _binding: FragmentLibraryTracksBinding? = null
    private val binding get() = _binding!!

    private val viewModel: LibraryViewModel by activityViewModels()

    private lateinit var trackAdapter: TrackVerticalAdapter
    private lateinit var tabType: LibraryTab

    companion object {
        private const val ARG_TAB_TYPE = "tab_type"

        fun newInstance(tabType: LibraryTab): LibraryTracksFragment {
            return LibraryTracksFragment().apply {
                arguments = Bundle().apply {
                    putSerializable(ARG_TAB_TYPE, tabType)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tabType = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            arguments?.getSerializable(ARG_TAB_TYPE, LibraryTab::class.java) ?: LibraryTab.LIKED_TRACKS
        } else {
            @Suppress("DEPRECATION")
            arguments?.getSerializable(ARG_TAB_TYPE) as? LibraryTab ?: LibraryTab.LIKED_TRACKS
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLibraryTracksBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupClickListeners()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        trackAdapter = TrackVerticalAdapter(
            onTrackClick = { track -> 
                (parentFragment as? LibraryFragment)?.onTrackClick(track)
            },
            onPlayClick = { track -> 
                (parentFragment as? LibraryFragment)?.onPlayTrack(track)
            },
            onLikeClick = { track -> 
                (parentFragment as? LibraryFragment)?.onLikeTrack(track)
            },
            onMoreOptionsClick = { track -> showTrackOptions(track) }
        )

        binding.recyclerViewTracks.apply {
            adapter = trackAdapter
            layoutManager = LinearLayoutManager(requireContext())
        }
    }

    private fun setupClickListeners() {
        binding.apply {
            btnExploreMusic.setOnClickListener {
                // Navigate to search
                findNavController().navigate(R.id.action_library_to_search)
            }
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                updateUI(state)
            }
        }
    }

    private fun updateUI(state: LibraryUiState) {
        val tracks = when (tabType) {
            LibraryTab.LIKED_TRACKS -> state.likedTracks
            LibraryTab.RECENTLY_PLAYED -> state.recentlyPlayed
            else -> emptyList()
        }
        
        binding.apply {
            // Update RecyclerView
            trackAdapter.submitList(tracks)
            
            // Show/hide appropriate empty state
            val isEmpty = tracks.isEmpty() && !state.isLoading && state.errorMessage == null
            
            binding.recyclerViewTracks.visibility = if (isEmpty) View.GONE else View.VISIBLE
            
            // Show generic empty layout for all tabs
            binding.layoutEmpty.visibility = if (isEmpty) View.VISIBLE else View.GONE
        }
    }

    @Suppress("UNUSED_PARAMETER")
    private fun showTrackOptions(track: Track) {
        // TODO: Implement bottom sheet with track options
        // Options: Add to playlist, Download, Share, Remove from liked, etc.
        // Track: ${track.title} by ${track.artist}
        requireContext().showToast(getString(R.string.feature_coming_soon))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}