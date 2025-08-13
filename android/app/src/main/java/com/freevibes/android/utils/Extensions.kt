package com.freevibes.android.utils

import android.content.Context
import android.widget.Toast
import java.util.concurrent.TimeUnit

/**
 * Format duration from seconds to MM:SS format
 */
fun formatDuration(durationInSeconds: Int): String {
    val minutes = TimeUnit.SECONDS.toMinutes(durationInSeconds.toLong())
    val seconds = durationInSeconds - TimeUnit.MINUTES.toSeconds(minutes)
    return String.format("%d:%02d", minutes, seconds)
}

/**
 * Format duration from milliseconds to MM:SS format
 */
fun formatDurationFromMillis(durationInMillis: Long): String {
    val totalSeconds = TimeUnit.MILLISECONDS.toSeconds(durationInMillis)
    return formatDuration(totalSeconds.toInt())
}

/**
 * Show a short toast message
 */
fun Context.showToast(message: String) {
    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
}

/**
 * Show a long toast message
 */
fun Context.showLongToast(message: String) {
    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
}

/**
 * Check if string is a valid email
 */
fun String.isValidEmail(): Boolean {
    return android.util.Patterns.EMAIL_ADDRESS.matcher(this).matches()
}

/**
 * Check if string is a valid password (at least 6 characters)
 */
fun String.isValidPassword(): Boolean {
    return this.length >= 6
}

/**
 * Check if string is a valid username (at least 3 characters, alphanumeric)
 */
fun String.isValidUsername(): Boolean {
    return this.length >= 3 && this.matches(Regex("^[a-zA-Z0-9_]+$"))
}

/**
 * Capitalize first letter of each word
 */
fun String.toTitleCase(): String {
    return this.split(" ").joinToString(" ") { word ->
        word.lowercase().replaceFirstChar { it.uppercase() }
    }
}