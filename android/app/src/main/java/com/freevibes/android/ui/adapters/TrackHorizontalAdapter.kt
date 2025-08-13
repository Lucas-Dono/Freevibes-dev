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
import com.freevibes.android.databinding.ItemTrackHorizontalBinding
import com.freevibes.android.utils.formatDuration

class TrackHorizontalAdapter(
    private val onTrackClick: (Track) -> Unit,
    private val onPlayClick: (Track) -> Unit,
    private val onLikeClick: (Track) -> Unit
) : ListAdapter<Track, TrackHorizontalAdapter.TrackViewHolder>(TrackDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TrackViewHolder {
        val binding = ItemTrackHorizontalBinding.inflate(
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
        private val binding: ItemTrackHorizontalBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(track: Track) {
            with(binding) {
                tvTrackTitle.text = track.title
                tvArtistName.text = track.artist
                tvDuration.text = formatDuration(track.duration.toInt())

                // Load album art
                Glide.with(itemView.context)
                    .load(track.thumbnail)
                    .placeholder(R.drawable.ic_logo)
                    .error(R.drawable.ic_logo)
                    .transform(RoundedCorners(12))
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