package com.freevibes.android.ui

import androidx.fragment.app.testing.launchFragmentInContainer
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.*
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import com.freevibes.android.R
import com.freevibes.android.ui.auth.LoginFragment
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@MediumTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class LoginFragmentTest {

    @get:Rule
    var hiltRule = HiltAndroidRule(this)

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun loginFragment_displaysCorrectViews() {
        // Launch the fragment
        launchFragmentInContainer<LoginFragment>()

        // Check that all main views are displayed
        onView(withId(R.id.etEmail))
            .check(matches(isDisplayed()))
        
        onView(withId(R.id.etPassword))
            .check(matches(isDisplayed()))
        
        onView(withId(R.id.btnLogin))
            .check(matches(isDisplayed()))
        
        onView(withId(R.id.tvRegisterLink))
            .check(matches(isDisplayed()))
    }

    @Test
    fun loginFragment_emailValidation_showsError() {
        // Launch the fragment
        launchFragmentInContainer<LoginFragment>()

        // Enter invalid email
        onView(withId(R.id.etEmail))
            .perform(typeText("invalid-email"), closeSoftKeyboard())
        
        onView(withId(R.id.etPassword))
            .perform(typeText("password123"), closeSoftKeyboard())

        // Click login button
        onView(withId(R.id.btnLogin))
            .perform(click())

        // Check that email error is shown
        onView(withId(R.id.tilEmail))
            .check(matches(hasDescendant(withText("Please enter a valid email address"))))
    }

    @Test
    fun loginFragment_passwordValidation_showsError() {
        // Launch the fragment
        launchFragmentInContainer<LoginFragment>()

        // Enter valid email but short password
        onView(withId(R.id.etEmail))
            .perform(typeText("test@example.com"), closeSoftKeyboard())
        
        onView(withId(R.id.etPassword))
            .perform(typeText("123"), closeSoftKeyboard())

        // Click login button
        onView(withId(R.id.btnLogin))
            .perform(click())

        // Check that password error is shown
        onView(withId(R.id.tilPassword))
            .check(matches(hasDescendant(withText("Password must be at least 6 characters"))))
    }

    @Test
    fun loginFragment_emptyFields_showsErrors() {
        // Launch the fragment
        launchFragmentInContainer<LoginFragment>()

        // Click login button without entering data
        onView(withId(R.id.btnLogin))
            .perform(click())

        // Check that both field errors are shown
        onView(withId(R.id.tilEmail))
            .check(matches(hasDescendant(withText("Email is required"))))
        
        onView(withId(R.id.tilPassword))
            .check(matches(hasDescendant(withText("Password is required"))))
    }

    @Test
    fun loginFragment_validInput_enablesLoginButton() {
        // Launch the fragment
        launchFragmentInContainer<LoginFragment>()

        // Enter valid credentials
        onView(withId(R.id.etEmail))
            .perform(typeText("test@example.com"), closeSoftKeyboard())
        
        onView(withId(R.id.etPassword))
            .perform(typeText("password123"), closeSoftKeyboard())

        // Check that login button is enabled
        onView(withId(R.id.btnLogin))
            .check(matches(isEnabled()))
    }

    @Test
    fun loginFragment_registerLink_isClickable() {
        // Launch the fragment
        launchFragmentInContainer<LoginFragment>()

        // Check that register link is clickable
        onView(withId(R.id.tvRegisterLink))
            .check(matches(isClickable()))
            .check(matches(withText("Don't have an account? Register here")))
    }

    @Test
    fun loginFragment_passwordToggle_worksCorrectly() {
        // Launch the fragment
        launchFragmentInContainer<LoginFragment>()

        // Enter password
        onView(withId(R.id.etPassword))
            .perform(typeText("password123"), closeSoftKeyboard())

        // Check that password is initially hidden
        onView(withId(R.id.etPassword))
            .check(matches(hasInputType(129))) // InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD

        // Click password toggle
        onView(withId(R.id.tilPassword))
            .perform(click())
    }

    @Test
    fun loginFragment_logoAndTitle_areDisplayed() {
        // Launch the fragment
        launchFragmentInContainer<LoginFragment>()

        // Check that logo and title are displayed
        onView(withId(R.id.ivLogo))
            .check(matches(isDisplayed()))
        
        onView(withId(R.id.tvTitle))
            .check(matches(isDisplayed()))
            .check(matches(withText("Welcome to FreeVibes")))
        
        onView(withId(R.id.tvSubtitle))
            .check(matches(isDisplayed()))
            .check(matches(withText("Sign in to continue")))
    }
}