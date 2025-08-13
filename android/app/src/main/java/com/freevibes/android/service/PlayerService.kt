package com.freevibes.android.service

import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.ui.PlayerNotificationManager
import com.freevibes.android.data.model.Track
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PlayerService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "music_playback_channel"
        private const val MEDIA_SESSION_TAG = "FreevibesPlayer"
    }

    private val binder = PlayerBinder()
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var exoPlayer: ExoPlayer
    private lateinit var mediaSession: MediaSession
    private var playerNotificationManager: PlayerNotificationManager? = null

    private val _currentTrack = MutableStateFlow<Track?>(null)
    val currentTrack: StateFlow<Track?> = _currentTrack.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _currentPosition = MutableStateFlow(0L)
    val currentPosition: StateFlow<Long> = _currentPosition.asStateFlow()

    private val _duration = MutableStateFlow(0L)
    val duration: StateFlow<Long> = _duration.asStateFlow()

    private val _playbackState = MutableStateFlow(0)
    val playbackState: StateFlow<Int> = _playbackState.asStateFlow()

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _isPlaying.value = isPlaying
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            _playbackState.value = playbackState
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int
        ) {
            _currentPosition.value = newPosition.positionMs
        }
    }

    override fun onCreate() {
        super.onCreate()
        initializePlayer()
        createNotificationChannel()
        initializeMediaSession()
        setupPlayerNotificationManager()
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        playerNotificationManager?.setPlayer(null)
        mediaSession.release()
        exoPlayer.removeListener(playerListener)
        exoPlayer.release()
    }

    private fun initializePlayer() {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

        exoPlayer = ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .build()

        exoPlayer.addListener(playerListener)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Controls for music playback"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun initializeMediaSession() {
        mediaSession = MediaSession.Builder(this, exoPlayer)
            .setId(MEDIA_SESSION_TAG)
            .build()
    }
    
    private fun setupPlayerNotificationManager() {
        playerNotificationManager = PlayerNotificationManager.Builder(
            this,
            NOTIFICATION_ID,
            CHANNEL_ID
        )
            .setMediaDescriptionAdapter(DescriptionAdapter())
            .setNotificationListener(NotificationListener())
            .build()
            .apply {
                setPlayer(exoPlayer)
                setUseRewindAction(false)
                setUseFastForwardAction(false)
            }
    }

    fun playTrack(track: Track) {
        _currentTrack.value = track
        val mediaItem = MediaItem.fromUri(track.streamUrl ?: "")
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        exoPlayer.play()
        // Media session metadata will be updated when implemented
    }

    fun play() {
        exoPlayer.play()
    }

    fun pause() {
        exoPlayer.pause()
    }

    fun stop() {
        exoPlayer.stop()
        _currentTrack.value = null
    }

    fun seekTo(position: Long) {
        exoPlayer.seekTo(position)
        _currentPosition.value = position
    }

    fun getCurrentPosition(): Long = exoPlayer.currentPosition

    fun getDuration(): Long = exoPlayer.duration.takeIf { it != -1L } ?: 0L

    fun setRepeatMode(repeatMode: Int) {
        exoPlayer.repeatMode = repeatMode
    }

    fun setShuffleMode(shuffleMode: Boolean) {
        exoPlayer.shuffleModeEnabled = shuffleMode
    }

    fun skipToNext() {
        if (exoPlayer.hasNextMediaItem()) {
            exoPlayer.seekToNextMediaItem()
        }
    }

    fun skipToPrevious() {
        if (exoPlayer.hasPreviousMediaItem()) {
            exoPlayer.seekToPreviousMediaItem()
        }
    }

    fun getRepeatMode(): Int = exoPlayer.repeatMode

    fun getShuffleMode(): Boolean = exoPlayer.shuffleModeEnabled

    // Playback state and metadata management will be implemented later

    inner class PlayerBinder : Binder() {
        fun getService(): PlayerService = this@PlayerService
    }

    private inner class DescriptionAdapter : PlayerNotificationManager.MediaDescriptionAdapter {
        override fun getCurrentContentTitle(player: Player): CharSequence {
            return _currentTrack.value?.title ?: "Unknown Track"
        }
        
        override fun getCurrentContentText(player: Player): CharSequence {
            return _currentTrack.value?.artist ?: "Unknown Artist"
        }
        
        override fun getCurrentLargeIcon(
            player: Player,
            callback: PlayerNotificationManager.BitmapCallback
        ): android.graphics.Bitmap? {
            // TODO: Load album art from URL
            return null
        }
        
        override fun createCurrentContentIntent(player: Player): android.app.PendingIntent? {
            // TODO: Create intent to open main activity
            return null
        }
    }
    
    private inner class NotificationListener : PlayerNotificationManager.NotificationListener {
        override fun onNotificationCancelled(notificationId: Int, dismissedByUser: Boolean) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        }
        
        override fun onNotificationPosted(
            notificationId: Int,
            notification: android.app.Notification,
            ongoing: Boolean
        ) {
            if (ongoing) {
                startForeground(notificationId, notification)
            }
        }
    }
}