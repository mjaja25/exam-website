# Plan to Restore WPM Chart & AI Button and Improve Layout

The investigation confirms that the **WPM Chart** and **AI Analysis Button** are completely missing from the HTML structure in `practice-typing.html`, likely due to a recent refactoring that replaced the old canvas-based chart with a placeholder div (`#performance-chart`) and removed the button element entirely. The layout is also cluttered, as noted.

## 1. Restore Missing Elements (HTML & CSS)
**Goal:** Bring back the interactive elements and clean up the visual hierarchy.

*   **Modify `public/practice-typing.html`:**
    *   **Restore WPM Chart:** Replace the empty `<div id="performance-chart"></div>` with a `<canvas id="wpm-chart"></canvas>` element inside the `.breakdown-card`.
    *   **Restore AI Button:** Add the "Get AI Coach" button back into the Results View. It should be prominent but not intrusive. I'll place it in a new "Action Bar" or clearly within the `analysis-card`.
    *   **Structure:**
        *   Reorganize `#results-view` into a CSS Grid layout (`.results-grid`) to handle density.
        *   **Left Column:** Detailed Stats & Charts (WPM Chart, Heatmap).
        *   **Right Column:** Summary, AI Coach Panel (hidden by default), and Recommendations.

*   **Modify `public/css/main.css`:**
    *   Add `.results-grid` styles for a 2-column layout on desktop (stacking on mobile).
    *   Style the new AI Button (`.ai-coach-btn`) to look like a premium feature (e.g., gradient background, icon).
    *   Ensure the chart container has a fixed height (e.g., `300px`) so it renders correctly.

## 2. Redesign Results Layout (De-clutter)
**Goal:** Present data progressively so the user isn't overwhelmed.

*   **Strategy: Tabbed or Accordion Layout (Simplification)**
    *   Instead of showing *everything* (Heatmap, Charts, Finger Stats, Recommendations) at once, I will group them.
    *   **Group 1: "Overview" (Visible immediately):**
        *   Big Score Ring (WPM).
        *   Key Stats (Accuracy, Errors).
        *   WPM Timeline Chart (Restored).
        *   **"Analyze with AI" Button** (Call to Action).
    *   **Group 2: "Deep Dive" (Visible on demand):**
        *   Heatmap (already moved to error-only).
        *   Finger Performance.
        *   Detailed Error Log.

*   **Implementation Details:**
    *   The "Analyze with AI" button will trigger the AI fetch.
    *   **Crucial Change:** When AI results come back, they shouldn't just append to the bottom. They should populate a dedicated **"Coach's Report"** section that slides in or appears prominently at the top of the "Overview".
    *   I will modify the layout to put the **AI Feedback** at the *top* (below the score) once generated, as it's the most high-value information.

## 3. JavaScript Updates (Wiring it up)
*   **Modify `public/js/pages/practice.js`:**
    *   **Chart Logic:** Ensure the `renderProgressChart` (or `renderWpmChart`) targets the new `<canvas id="wpm-chart">` correctly.
    *   **AI Button Logic:** Re-bind the click event listener for the restored AI button.
    *   **UI State:** Handle the "Loading" state of the AI button and the "Success" state (revealing the Coach Panel).

## 4. Execution Steps
1.  **HTML:** Edit `practice-typing.html` to add the canvas and button, and restructure the container div classes.
2.  **CSS:** Add grid styles and button styles in `main.css`.
3.  **JS:** Update `practice.js` to target the correct elements and implement the "Progressive Disclosure" (show/hide) logic for the deep-dive stats.

**User Confirmation Required:**
Does this "Overview vs. Deep Dive" approach sound good to you? It keeps the initial screen clean (just WPM + Chart) and puts the dense data (Heatmap, Finger Stats) below or in a secondary tab/section.
