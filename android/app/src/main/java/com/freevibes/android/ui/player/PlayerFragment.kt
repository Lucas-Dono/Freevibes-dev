package com.freevibes.android.ui.player

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.SeekBar
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.bumptech.glide.Glide
import com.freevibes.android.R
import com.freevibes.android.data.model.Track
import com.freevibes.android.databinding.FragmentPlayerBinding
import com.freevibes.android.ui.player.RepeatMode
// import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// @AndroidEntryPoint
class PlayerFragment : Fragment() {

    private var _binding: FragmentPlayerBinding? = null
    private val binding get() = _binding!!

    private val viewModel: PlayerViewModel by activityViewModels()
    private var isUserSeeking = false
    private var updatePositionJob: kotlinx.coroutines.Job? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPlayerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
        observeViewModel()
        startPositionUpdater()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        updatePositionJob?.cancel()
        _binding = null
    }

    private fun setupUI() {
        binding.apply {
            // Back button
            btnBack.setOnClickListener {
                findNavController().navigateUp()
            }

            // Play/Pause button
            fabPlayPause.setOnClickListener {
                viewModel.playPause()
            }

            // Previous button
            btnPrevious.setOnClickListener {
                viewModel.skipToPrevious()
            }

            // Next button
            btnNext.setOnClickListener {
                viewModel.skipToNext()
            }

            // Shuffle button
            btnShuffle.setOnClickListener {
                viewModel.toggleShuffle()
            }

            // Repeat button
            btnRepeat.setOnClickListener {
                viewModel.toggleRepeatMode()
            }

            // Favorite button
            btnFavorite.setOnClickListener {
                // TODO: Implement favorite functionality
            }

            // More options button
            btnMore.setOnClickListener {
                // TODO: Implement more options menu
            }

            // Seek bar
            seekBarProgress.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    if (fromUser) {
                        val position = (progress.toLong() * viewModel.duration.value) / 100
                        binding.tvCurrentTime.text = viewModel.formatTime(position)
                    }
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) {
                    isUserSeeking = true
                }

                override fun onStopTrackingTouch(seekBar: SeekBar?) {
                    isUserSeeking = false
                    seekBar?.let {
                        val position = (it.progress.toLong() * viewModel.duration.value) / 100
                        viewModel.seekTo(position)
                    }
                }
            })
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.currentTrack.collect { track ->
                updateTrackInfo(track)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isPlaying.collect { isPlaying ->
                updatePlayPauseButton(isPlaying)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.duration.collect { duration ->
                binding.tvDuration.text = viewModel.formatTime(duration)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.currentPosition.collect { position ->
                if (!isUserSeeking) {
                    updateProgress(position)
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.shuffleEnabled.collect { enabled ->
                updateShuffleButton(enabled)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.repeatMode.collect { mode ->
                updateRepeatButton(mode)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isLoading.collect { isLoading ->
                binding.progressBarLoading.visibility = if (isLoading) View.VISIBLE else View.GONE
            }
        }
    }

    private fun updateTrackInfo(track: Track?) {
        binding.apply {
            if (track != null) {
                tvTrackName.text = track.title
                tvArtistName.text = track.artist
                tvPlayingFrom.text = getString(R.string.playing_from)

                // Load album art
                Glide.with(requireContext())
                    .load(track.thumbnail)
                    .placeholder(R.drawable.placeholder_album)
                    .error(R.drawable.placeholder_album)
                    .into(ivAlbumArt)
            } else {
                tvTrackName.text = getString(R.string.track_name)
                tvArtistName.text = getString(R.string.artist_name)
                tvPlayingFrom.text = ""
                ivAlbumArt.setImageResource(R.drawable.placeholder_album)
            }
        }
    }

    private fun updatePlayPauseButton(isPlaying: Boolean) {
        val iconRes = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
        binding.fabPlayPause.setImageResource(iconRes)
    }

    private fun updateProgress(position: Long) {
        val duration = viewModel.duration.value
        if (duration > 0) {
            val progress = ((position * 100) / duration).toInt()
            binding.seekBarProgress.progress = progress
        }
        binding.tvCurrentTime.text = viewModel.formatTime(position)
    }

    private fun updateShuffleButton(enabled: Boolean) {
        val tint = if (enabled) {
            requireContext().getColor(R.color.primary)
        } else {
            requireContext().getColor(R.color.text_secondary)
        }
        binding.btnShuffle.imageTintList = android.content.res.ColorStateList.valueOf(tint)
    }

    private fun updateRepeatButton(mode: RepeatMode) {
        val (iconRes, tint) = when (mode) {
            RepeatMode.OFF -> {
                R.drawable.ic_repeat to requireContext().getColor(R.color.text_secondary)
            }
            RepeatMode.ALL -> {
                R.drawable.ic_repeat to requireContext().getColor(R.color.primary)
            }
            RepeatMode.ONE -> {
                R.drawable.ic_repeat_one to requireContext().getColor(R.color.primary)
            }
        }
        
        binding.btnRepeat.setImageResource(iconRes)
        binding.btnRepeat.imageTintList = android.content.res.ColorStateList.valueOf(tint)
    }

    private fun startPositionUpdater() {
        updatePositionJob = viewLifecycleOwner.lifecycleScope.launch {
            while (true) {
                if (!isUserSeeking && viewModel.isPlaying.value) {
                    // Update position every second
                    delay(1000)
                }
                delay(100) // Check more frequently for state changes
            }
        }
    }

    companion object {
        fun newInstance() = PlayerFragment()
    }
}