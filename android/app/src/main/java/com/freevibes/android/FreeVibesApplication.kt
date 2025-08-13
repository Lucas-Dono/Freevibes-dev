package com.freevibes.android

import android.app.Application
// import dagger.hilt.android.HiltAndroidApp

// @HiltAndroidApp
class FreeVibesApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        instance = this
    }
    
    companion object {
        lateinit var instance: FreeVibesApplication
            private set
    }
}