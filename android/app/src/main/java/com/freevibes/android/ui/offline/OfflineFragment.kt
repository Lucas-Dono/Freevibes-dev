package com.freevibes.android.ui.offline

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.freevibes.android.databinding.FragmentOfflineBinding
import com.freevibes.android.ui.ViewModelFactory
import com.freevibes.android.ui.adapters.TrackVerticalAdapter
import com.freevibes.android.utils.Result
import kotlinx.coroutines.launch

class OfflineFragment : Fragment() {
    
    private var _binding: FragmentOfflineBinding? = null
    private val binding get() = _binding!!
    
    private val viewModel: OfflineViewModel by viewModels {
        ViewModelFactory(requireActivity().application)
    }
    
    private lateinit var trackAdapter: TrackVerticalAdapter
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentOfflineBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupRecyclerView()
        setupObservers()
        setupClickListeners()
        
        viewModel.loadOfflineTracks()
        viewModel.loadNetworkStatus()
        viewModel.loadStorageInfo()
    }
    
    private fun setupRecyclerView() {
        trackAdapter = TrackVerticalAdapter(
            onTrackClick = { track ->
                // Play offline track
                // TODO: Implement play functionality
            },
            onPlayClick = { track ->
                // Play offline track
                // TODO: Implement play functionality
            },
            onLikeClick = { track ->
                // Toggle like for offline track
                // TODO: Implement like functionality
            },
            onMoreOptionsClick = { track ->
                 // Show options for offline track
                 viewModel.removeTrackOffline(track.id)
             }
        )
        
        binding.recyclerViewOfflineTracks.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = trackAdapter
        }
    }
    
    private fun setupObservers() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                updateUI(state)
            }
        }
        
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.offlineTracks.collect { result ->
                when (result) {
                    is Result.Success -> {
                        trackAdapter.submitList(result.data)
                        binding.textEmptyState.visibility = if (result.data.isEmpty()) {
                            View.VISIBLE
                        } else {
                            View.GONE
                        }
                    }
                    is Result.Error -> {
                        binding.textEmptyState.visibility = View.VISIBLE
                        binding.textEmptyState.text = "Error: ${result.message}"
                    }
                    is Result.Loading -> {
                        // Show loading state
                    }
                }
            }
        }
    }
    
    private fun setupClickListeners() {
        binding.buttonClearOfflineMusic.setOnClickListener {
            viewModel.clearOfflineMusic()
        }
        
        binding.buttonRefreshNetworkStatus.setOnClickListener {
            viewModel.loadNetworkStatus()
        }
    }
    
    private fun updateUI(state: OfflineUiState) {
        // Network status
        binding.textNetworkStatus.text = when {
            state.isConnected && state.isServerReachable -> "Conectado"
            state.isConnected && !state.isServerReachable -> "Red disponible, servidor no alcanzable"
            !state.isConnected -> "Sin conexión"
            else -> "Verificando..."
        }
        
        binding.iconNetworkStatus.setImageResource(
            when {
                state.isConnected && state.isServerReachable -> android.R.drawable.presence_online
                state.isConnected && !state.isServerReachable -> android.R.drawable.presence_away
                else -> android.R.drawable.presence_offline
            }
        )
        
        // Storage info
        binding.textStorageUsed.text = "Almacenamiento usado: ${formatBytes(state.storageUsed)}"
        binding.textTracksCount.text = "Canciones offline: ${state.offlineTracksCount}"
        
        // Loading state
        binding.progressBar.visibility = if (state.isLoading) View.VISIBLE else View.GONE
        
        // Error state
        if (state.error != null) {
            binding.textEmptyState.visibility = View.VISIBLE
            binding.textEmptyState.text = state.error
        }
    }
    
    private fun formatBytes(bytes: Long): String {
        val kb = bytes / 1024.0
        val mb = kb / 1024.0
        val gb = mb / 1024.0
        
        return when {
            gb >= 1 -> String.format("%.2f GB", gb)
            mb >= 1 -> String.format("%.2f MB", mb)
            kb >= 1 -> String.format("%.2f KB", kb)
            else -> "$bytes B"
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}