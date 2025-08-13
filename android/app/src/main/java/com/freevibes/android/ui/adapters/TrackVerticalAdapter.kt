package com.freevibes.android.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.RoundedCorners
import com.freevibes.android.R
import com.freevibes.android.data.model.Track
import com.freevibes.android.databinding.ItemTrackVerticalBinding
import com.freevibes.android.utils.formatDuration

class TrackVerticalAdapter(
    private val onTrackClick: (Track) -> Unit,
    private val onPlayClick: (Track) -> Unit,
    private val onLikeClick: (Track) -> Unit,
    private val onMoreOptionsClick: (Track) -> Unit,
    private val onDownloadClick: ((Track) -> Unit)? = null,
    private val isTrackDownloaded: ((String) -> Boolean)? = null,
    private val getDownloadProgress: ((String) -> Float)? = null
) : ListAdapter<Track, TrackVerticalAdapter.TrackViewHolder>(TrackDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TrackViewHolder {
        val binding = ItemTrackVerticalBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return TrackViewHolder(binding)
    }

    override fun onBindViewHolder(holder: TrackViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class TrackViewHolder(
        private val binding: ItemTrackVerticalBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(track: Track) {
            with(binding) {
                tvTrackTitle.text = track.title
                tvArtistName.text = track.artist
                tvAlbumName.text = track.album ?: "Unknown Album"
                tvDuration.text = formatDuration(track.duration.toInt())

                // Load album art
                Glide.with(itemView.context)
                    .load(track.thumbnail)
                    .placeholder(R.drawable.ic_logo)
                    .error(R.drawable.ic_logo)
                    .transform(RoundedCorners(8))
                    .into(ivAlbumArt)

                // Update like button state
                ivLike.setImageResource(
                    if (track.isLiked) R.drawable.ic_heart_filled
                    else R.drawable.ic_heart_outline
                )

                // Set click listeners
                root.setOnClickListener {
                    onTrackClick(track)
                }

                ivPlayButton.setOnClickListener {
                    onPlayClick(track)
                }

                ivLike.setOnClickListener {
                    onLikeClick(track)
                }

                ivMoreOptions.setOnClickListener {
                    onMoreOptionsClick(track)
                }
                
                // Download button functionality
                onDownloadClick?.let { downloadCallback ->
                    ivDownload.setOnClickListener {
                        downloadCallback(track)
                    }
                    
                    // Update download state
                    val isDownloaded = isTrackDownloaded?.invoke(track.id) ?: false
                    val progress = getDownloadProgress?.invoke(track.id) ?: 0f
                    
                    when {
                        isDownloaded -> {
                            ivDownload.setImageResource(android.R.drawable.stat_sys_download_done)
                            progressDownload.visibility = android.view.View.GONE
                            ivDownload.visibility = android.view.View.VISIBLE
                        }
                        progress > 0f && progress < 1f -> {
                            ivDownload.visibility = android.view.View.GONE
                            progressDownload.visibility = android.view.View.VISIBLE
                        }
                        else -> {
                            ivDownload.setImageResource(com.freevibes.android.R.drawable.ic_download)
                            progressDownload.visibility = android.view.View.GONE
                            ivDownload.visibility = android.view.View.VISIBLE
                        }
                    }
                } ?: run {
                    // Hide download button if no callback provided
                    ivDownload.visibility = android.view.View.GONE
                    progressDownload.visibility = android.view.View.GONE
                }
            }
        }
    }

    private class TrackDiffCallback : DiffUtil.ItemCallback<Track>() {
        override fun areItemsTheSame(oldItem: Track, newItem: Track): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Track, newItem: Track): Boolean {
            return oldItem == newItem
        }
    }
}