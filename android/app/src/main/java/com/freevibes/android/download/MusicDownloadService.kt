package com.freevibes.android.download

import android.app.Notification
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.exoplayer.offline.DownloadNotificationHelper
import androidx.media3.exoplayer.scheduler.PlatformScheduler
import com.freevibes.android.R
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
@UnstableApi
class MusicDownloadService : DownloadService(
    FOREGROUND_NOTIFICATION_ID,
    DEFAULT_FOREGROUND_NOTIFICATION_UPDATE_INTERVAL,
    CHANNEL_ID,
    R.string.app_name,
    0
) {
    
    @Inject
    lateinit var musicDownloadManager: MusicDownloadManager
    
    override fun getDownloadManager(): DownloadManager {
        return musicDownloadManager.downloadManager
    }
    
    override fun getScheduler(): PlatformScheduler? {
        return PlatformScheduler(this, JOB_ID)
    }
    
    override fun getForegroundNotification(
        downloads: MutableList<Download>,
        notMetRequirements: Int
    ): Notification {
        return DownloadNotificationHelper(
            this,
            CHANNEL_ID
        ).buildProgressNotification(
            this,
            android.R.drawable.stat_sys_download,
            null,
            null,
            downloads,
            notMetRequirements
        )
    }
    
    companion object {
        private const val FOREGROUND_NOTIFICATION_ID = 2
        private const val JOB_ID = 1000
        private const val CHANNEL_ID = "download_channel"
    }
}