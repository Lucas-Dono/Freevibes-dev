package com.freevibes.android.download

import android.content.Context
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.offline.DefaultDownloadIndex
import androidx.media3.exoplayer.offline.DefaultDownloaderFactory
import androidx.media3.exoplayer.offline.Download
import androidx.media3.exoplayer.offline.DownloadManager
import androidx.media3.exoplayer.offline.DownloadRequest
import androidx.media3.exoplayer.offline.DownloadService
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.util.concurrent.Executor
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
@UnstableApi
class MusicDownloadManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val downloadDirectory = File(context.getExternalFilesDir(null), "downloads")
    private val databaseProvider = StandaloneDatabaseProvider(context)
    private val cache: Cache by lazy {
        SimpleCache(
            downloadDirectory,
            NoOpCacheEvictor(),
            databaseProvider
        )
    }
    
    private val downloadIndex = DefaultDownloadIndex(databaseProvider)
    private val downloaderFactory = DefaultDownloaderFactory(
        androidx.media3.datasource.cache.CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(DefaultHttpDataSource.Factory()),
        Executor { it.run() }
    )
    
    val downloadManager: DownloadManager by lazy {
        DownloadManager(
            context,
            downloadIndex,
            downloaderFactory
        ).apply {
            resumeDownloads()
        }
    }
    
    private val _downloadProgress = MutableStateFlow<Map<String, Float>>(emptyMap())
    val downloadProgress: Flow<Map<String, Float>> = _downloadProgress.asStateFlow()
    
    private val _downloadedTracks = MutableStateFlow<Set<String>>(emptySet())
    val downloadedTracks: Flow<Set<String>> = _downloadedTracks.asStateFlow()
    
    init {
        downloadManager.addListener(object : DownloadManager.Listener {
            override fun onDownloadChanged(
                downloadManager: DownloadManager,
                download: Download,
                finalException: Exception?
            ) {
                updateDownloadProgress(download)
                updateDownloadedTracks()
            }
            
            override fun onDownloadRemoved(
                downloadManager: DownloadManager,
                download: Download
            ) {
                updateDownloadedTracks()
            }
        })
    }
    
    fun downloadTrack(trackId: String, trackUrl: String, title: String, artist: String) {
        val mediaItem = MediaItem.Builder()
            .setUri(trackUrl)
            .setMediaId(trackId)
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(title)
                    .setArtist(artist)
                    .build()
            )
            .build()
            
        val downloadRequest = DownloadRequest.Builder(trackId, mediaItem.localConfiguration?.uri!!)
            .setData(trackId.toByteArray())
            .build()
            
        downloadManager.addDownload(downloadRequest)
    }
    
    fun removeDownload(trackId: String) {
        downloadManager.removeDownload(trackId)
    }
    
    fun isTrackDownloaded(trackId: String): Boolean {
        return try {
            val download = downloadManager.downloadIndex.getDownload(trackId)
            download?.state == Download.STATE_COMPLETED
        } catch (e: Exception) {
            false
        }
    }
    
    fun getDownloadProgress(trackId: String): Float {
        return try {
            val download = downloadManager.downloadIndex.getDownload(trackId)
            download?.percentDownloaded ?: 0f
        } catch (e: Exception) {
            0f
        }
    }
    
    private fun updateDownloadProgress(download: Download) {
        val currentProgress = _downloadProgress.value.toMutableMap()
        currentProgress[download.request.id] = download.percentDownloaded
        _downloadProgress.value = currentProgress
    }
    
    private fun updateDownloadedTracks() {
        val downloadedIds = mutableSetOf<String>()
        try {
            val cursor = downloadManager.downloadIndex.getDownloads()
            cursor.use {
                while (cursor.moveToNext()) {
                    val download = cursor.download
                    if (download.state == Download.STATE_COMPLETED) {
                        downloadedIds.add(download.request.id)
                    }
                }
            }
        } catch (e: Exception) {
            // Handle error
        }
        _downloadedTracks.value = downloadedIds
    }
    
    fun getCacheInstance(): Cache = cache
    
    fun release() {
        downloadManager.release()
        cache.release()
    }
}