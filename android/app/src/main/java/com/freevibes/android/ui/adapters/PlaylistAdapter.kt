package com.freevibes.android.ui.adapters

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.RoundedCorners
import com.freevibes.android.R
import com.freevibes.android.data.model.Playlist
import com.freevibes.android.databinding.ItemPlaylistBinding

class PlaylistAdapter(
    private val onPlaylistClick: (Playlist) -> Unit,
    private val onPlayClick: (Playlist) -> Unit,
    private val onMoreOptionsClick: (Playlist) -> Unit
) : ListAdapter<Playlist, PlaylistAdapter.PlaylistViewHolder>(PlaylistDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PlaylistViewHolder {
        val binding = ItemPlaylistBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return PlaylistViewHolder(binding)
    }

    override fun onBindViewHolder(holder: PlaylistViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class PlaylistViewHolder(
        private val binding: ItemPlaylistBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(playlist: Playlist) {
            binding.apply {
                // Set playlist info
                tvPlaylistName.text = playlist.name
                
                // Format playlist info (track count and creator)
                val trackCount = playlist.trackCount
                val creator = playlist.ownerName ?: "Unknown"
                
                val trackText = root.context.resources.getQuantityString(
                    R.plurals.track_count,
                    trackCount,
                    trackCount
                )
                
                tvPlaylistInfo.text = "$trackText • $creator"
                
                // Load playlist cover or show default icon
                if (!playlist.thumbnail.isNullOrBlank()) {
                    ivPlaylistIcon.visibility = android.view.View.GONE
                    Glide.with(root.context)
                        .load(playlist.thumbnail)
                        .transform(RoundedCorners(16))
                        .placeholder(R.drawable.circle_background)
                        .error(R.drawable.circle_background)
                        .into(ivPlaylistCover)
                } else {
                    ivPlaylistIcon.visibility = android.view.View.VISIBLE
                    ivPlaylistCover.setImageResource(R.drawable.circle_background)
                }
                
                // Set click listeners
                root.setOnClickListener {
                    onPlaylistClick(playlist)
                }
                
                // Click on entire item to play playlist
                root.setOnClickListener {
                    onPlayClick(playlist)
                }
                
                ivPlaylistMenu.setOnClickListener {
                    onMoreOptionsClick(playlist)
                }
            }
        }
    }

    private class PlaylistDiffCallback : DiffUtil.ItemCallback<Playlist>() {
        override fun areItemsTheSame(oldItem: Playlist, newItem: Playlist): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Playlist, newItem: Playlist): Boolean {
            return oldItem == newItem
        }
    }
}