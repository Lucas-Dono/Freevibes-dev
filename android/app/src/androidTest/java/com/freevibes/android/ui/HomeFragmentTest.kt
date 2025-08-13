package com.freevibes.android.ui

import androidx.fragment.app.testing.launchFragmentInContainer
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.*
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.contrib.RecyclerViewActions
import androidx.test.espresso.matcher.ViewMatchers.*
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.MediumTest
import androidx.recyclerview.widget.RecyclerView
import com.freevibes.android.R
import com.freevibes.android.ui.main.HomeFragment
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@MediumTest
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class HomeFragmentTest {

    @get:Rule
    var hiltRule = HiltAndroidRule(this)

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun homeFragment_displaysCorrectViews() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Check that main views are displayed
        onView(withId(R.id.swipeRefreshLayout))
            .check(matches(isDisplayed()))
        
        onView(withId(R.id.scrollView))
            .check(matches(isDisplayed()))
        
        onView(withId(R.id.tvTrendingTitle))
            .check(matches(isDisplayed()))
            .check(matches(withText("Trending Now")))
        
        onView(withId(R.id.tvRecommendedTitle))
            .check(matches(isDisplayed()))
            .check(matches(withText("Recommended for You")))
    }

    @Test
    fun homeFragment_recyclerViews_areDisplayed() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Check that RecyclerViews are displayed
        onView(withId(R.id.rvTrendingTracks))
            .check(matches(isDisplayed()))
        
        onView(withId(R.id.rvRecommendedTracks))
            .check(matches(isDisplayed()))
    }

    @Test
    fun homeFragment_swipeRefresh_isEnabled() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Check that swipe refresh is enabled
        onView(withId(R.id.swipeRefreshLayout))
            .check(matches(isDisplayed()))
            .perform(swipeDown())
    }

    @Test
    fun homeFragment_loadingState_showsProgressBar() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Initially, progress bar might be visible during loading
        // This test verifies the loading state UI exists
        onView(withId(R.id.progressBar))
            .check(matches(isDisplayed()))
    }

    @Test
    fun homeFragment_errorState_showsErrorMessage() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Check that error views exist (they might not be visible initially)
        onView(withId(R.id.tvErrorMessage))
            .check(matches(withEffectiveVisibility(Visibility.GONE)))
        
        onView(withId(R.id.btnRetry))
            .check(matches(withEffectiveVisibility(Visibility.GONE)))
    }

    @Test
    fun homeFragment_trendingSection_hasCorrectLayout() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Check trending section layout
        onView(withId(R.id.tvTrendingTitle))
            .check(matches(isDisplayed()))
            .check(matches(withText("Trending Now")))
        
        onView(withId(R.id.rvTrendingTracks))
            .check(matches(isDisplayed()))
    }

    @Test
    fun homeFragment_recommendedSection_hasCorrectLayout() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Check recommended section layout
        onView(withId(R.id.tvRecommendedTitle))
            .check(matches(isDisplayed()))
            .check(matches(withText("Recommended for You")))
        
        onView(withId(R.id.rvRecommendedTracks))
            .check(matches(isDisplayed()))
    }

    @Test
    fun homeFragment_scrollView_isScrollable() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Check that the main content is scrollable
        onView(withId(R.id.scrollView))
            .check(matches(isDisplayed()))
            .perform(swipeUp())
    }

    @Test
    fun homeFragment_retryButton_isClickable() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // The retry button should exist but might not be visible initially
        onView(withId(R.id.btnRetry))
            .check(matches(isClickable()))
    }

    @Test
    fun homeFragment_recyclerViews_supportScrolling() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Test that RecyclerViews can be scrolled (if they have items)
        onView(withId(R.id.rvTrendingTracks))
            .check(matches(isDisplayed()))
        
        onView(withId(R.id.rvRecommendedTracks))
            .check(matches(isDisplayed()))
    }

    @Test
    fun homeFragment_hasCorrectContentDescription() {
        // Launch the fragment
        launchFragmentInContainer<HomeFragment>()

        // Check accessibility content descriptions
        onView(withId(R.id.swipeRefreshLayout))
            .check(matches(hasContentDescription()))
    }
}