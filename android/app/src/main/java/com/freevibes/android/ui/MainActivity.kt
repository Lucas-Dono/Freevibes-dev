package com.freevibes.android.ui

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.bumptech.glide.Glide
import com.freevibes.android.R
import com.freevibes.android.databinding.ActivityMainBinding

import com.freevibes.android.ui.auth.AuthNavigationEvent
import com.freevibes.android.ui.auth.AuthViewModel
import com.freevibes.android.ui.player.PlayerViewModel
import com.google.android.material.snackbar.Snackbar
// import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

// @AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMainBinding
    private lateinit var navController: NavController
    private lateinit var viewModelFactory: ViewModelFactory
    private lateinit var authViewModel: AuthViewModel
    private lateinit var playerViewModel: PlayerViewModel
    
    // PlayerViewModel handles its own service connection
    
    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // Initialize ViewModelFactory and ViewModels
        viewModelFactory = ViewModelFactory(application)
        authViewModel = ViewModelProvider(this, viewModelFactory)[AuthViewModel::class.java]
        playerViewModel = ViewModelProvider(this, viewModelFactory)[PlayerViewModel::class.java]
        
        setupNavigation()
        setupPlayerBar()
        observeAuthState()
        observeNavigationEvents()
        observePlayerState()
        
        // Keep splash screen until auth state is determined
        splashScreen.setKeepOnScreenCondition {
            authViewModel.uiState.value.isLoading
        }
        
        // PlayerViewModel handles service connection automatically
    }
    
    private fun setupNavigation() {
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHostFragment.navController
        
        // Setup bottom navigation
        binding.bottomNavigation.setupWithNavController(navController)
        
        // Hide bottom navigation on auth screens
        navController.addOnDestinationChangedListener { _, destination, _ ->
            when (destination.id) {
                R.id.loginFragment,
                R.id.registerFragment -> {
                    binding.bottomNavigation.visibility = android.view.View.GONE
                }
                else -> {
                    binding.bottomNavigation.visibility = android.view.View.VISIBLE
                }
            }
        }
    }
    
    private fun observeAuthState() {
        lifecycleScope.launch {
            authViewModel.uiState.collect { state ->
                when {
                    state.isAuthenticated && state.user != null -> {
                        // User is authenticated, navigate to main content if not already there
                        if (navController.currentDestination?.id == R.id.loginFragment ||
                            navController.currentDestination?.id == R.id.registerFragment) {
                            navController.navigate(R.id.action_global_homeFragment)
                        }
                    }
                    !state.isAuthenticated && !state.isLoading -> {
                        // User is not authenticated, navigate to login if not already there
                        if (navController.currentDestination?.id != R.id.loginFragment &&
                            navController.currentDestination?.id != R.id.registerFragment) {
                            navController.navigate(R.id.action_global_loginFragment)
                        }
                    }
                }
            }
        }
    }
    
    private fun observeNavigationEvents() {
        lifecycleScope.launch {
            authViewModel.navigationEvent.collect { event ->
                when (event) {
                    is AuthNavigationEvent.NavigateToMain -> {
                        navController.navigate(R.id.action_global_homeFragment)
                    }
                    is AuthNavigationEvent.NavigateToLogin -> {
                        navController.navigate(R.id.action_global_loginFragment)
                    }
                    is AuthNavigationEvent.ShowMessage -> {
                        showMessage(event.message)
                    }
                }
            }
        }
    }
    
    private fun showMessage(message: String) {
        Snackbar.make(binding.root, message, Snackbar.LENGTH_LONG).show()
    }
    

    
    private fun setupPlayerBar() {
        // Set up click listeners for player bar
        binding.playerBar.root.setOnClickListener {
            // Navigate to full player
            navController.navigate(R.id.playerFragment)
        }
        
        binding.playerBar.btnMiniPlayPause.setOnClickListener {
            playerViewModel.togglePlayPause()
        }
        
        binding.playerBar.btnMiniNext.setOnClickListener {
            playerViewModel.skipToNext()
        }
    }
    
    private fun observePlayerState() {
        lifecycleScope.launch {
            playerViewModel.uiState.collect { state ->
                updatePlayerBar(state)
            }
        }
    }

    private fun updatePlayerBar(state: com.freevibes.android.ui.player.PlayerUiState) {
        if (state.currentTrack != null) {
            binding.playerBar.root.visibility = View.VISIBLE
            
            // Update track info
            binding.playerBar.tvMiniTrackName.text = state.currentTrack.title
            binding.playerBar.tvMiniArtistName.text = state.currentTrack.artist
            
            // Update album art
            Glide.with(this)
                .load(state.currentTrack.thumbnail)
                .placeholder(R.drawable.placeholder_album)
                .into(binding.playerBar.ivMiniAlbumArt)
            
            // Update play/pause button
            val playPauseIcon = if (state.isPlaying) {
                R.drawable.ic_pause
            } else {
                R.drawable.ic_play
            }
            binding.playerBar.btnMiniPlayPause.setImageResource(playPauseIcon)
            
            // Update progress
            if (state.duration > 0) {
                val progress = ((state.currentPosition.toFloat() / state.duration) * 100).toInt()
                binding.playerBar.progressBarMini.progress = progress
            }
        } else {
            binding.playerBar.root.visibility = View.GONE
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // PlayerViewModel handles service cleanup automatically
    }
    
    override fun onSupportNavigateUp(): Boolean {
        return navController.navigateUp() || super.onSupportNavigateUp()
    }
}