package com.freevibes.android.ui.library

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.freevibes.android.data.model.Playlist
import com.freevibes.android.databinding.FragmentLibraryPlaylistsBinding
import com.freevibes.android.ui.adapters.PlaylistAdapter
import com.freevibes.android.utils.showToast
import kotlinx.coroutines.launch

class LibraryPlaylistsFragment : Fragment() {

    private var _binding: FragmentLibraryPlaylistsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: LibraryViewModel by activityViewModels()

    private lateinit var playlistAdapter: PlaylistAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLibraryPlaylistsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupClickListeners()
        observeViewModel()
    }

    private fun setupRecyclerView() {
        playlistAdapter = PlaylistAdapter(
            onPlaylistClick = { playlist -> 
                (parentFragment as? LibraryFragment)?.onPlaylistClick(playlist)
            },
            onPlayClick = { playlist -> playPlaylist(playlist) },
            onMoreOptionsClick = { playlist -> showPlaylistOptions(playlist) }
        )

        binding.recyclerViewPlaylists.apply {
            adapter = playlistAdapter
            layoutManager = LinearLayoutManager(requireContext())
        }
    }

    private fun setupClickListeners() {
        binding.btnCreateFirstPlaylist.setOnClickListener {
            (parentFragment as? LibraryFragment)?.onCreatePlaylistClick()
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
        val playlists = state.playlists
        
        binding.apply {
            // Update RecyclerView
            playlistAdapter.submitList(playlists)
            
            // Show/hide empty state
            if (playlists.isEmpty() && !state.isLoading && state.errorMessage == null) {
                binding.recyclerViewPlaylists.visibility = View.GONE
                binding.layoutEmpty.visibility = View.VISIBLE
            } else {
                binding.recyclerViewPlaylists.visibility = View.VISIBLE
                binding.layoutEmpty.visibility = View.GONE
            }
        }
    }

    private fun playPlaylist(playlist: Playlist) {
        // TODO: Implement playlist playback
        requireContext().showToast("Playing ${playlist.name}")
    }

    private fun showPlaylistOptions(playlist: Playlist) {
        // TODO: Implement bottom sheet with playlist options
        // Options: Edit, Delete, Share, Add to queue, etc.
        requireContext().showToast("Playlist options for ${playlist.name}")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}