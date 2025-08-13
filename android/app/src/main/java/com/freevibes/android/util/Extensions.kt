package com.freevibes.android.util

import android.view.View
import com.google.android.material.snackbar.Snackbar

/**
 * Extension function to show a Snackbar on any View
 */
fun View.showSnackbar(message: String, duration: Int = Snackbar.LENGTH_LONG) {
    Snackbar.make(this, message, duration).show()
}

/**
 * Extension function to show a Snackbar with action
 */
fun View.showSnackbar(
    message: String,
    actionText: String,
    action: () -> Unit,
    duration: Int = Snackbar.LENGTH_LONG
) {
    Snackbar.make(this, message, duration)
        .setAction(actionText) { action() }
        .show()
}