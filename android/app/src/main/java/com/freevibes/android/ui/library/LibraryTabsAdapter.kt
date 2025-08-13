package com.freevibes.android.ui.library

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter

class LibraryTabsAdapter(
    fragmentActivity: FragmentActivity
) : FragmentStateAdapter(fragmentActivity) {

    override fun getItemCount(): Int = 3

    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> LibraryPlaylistsFragment()
            1 -> LibraryTracksFragment.newInstance(LibraryTab.LIKED_TRACKS)
            2 -> LibraryTracksFragment.newInstance(LibraryTab.RECENTLY_PLAYED)
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}