# Plan to Improve Heatmap and Integrate with AI

The goal is to refine the heatmap feature by removing the "usage" view, enhancing the "error" view, ensuring data is stored correctly (filtering out drills if requested), and feeding this data into the AI Coach for better personalized feedback.

## 1. Heatmap Refinement (Frontend: `public/practice-typing.js`)
**Issue:** The user wants to remove the "Usage" (times pressed) heatmap and focus only on errors.
**Plan:**
-   **Remove Toggle:** Remove the "Errors / Usage" toggle buttons from the UI.
-   **Force Error Mode:** Hardcode the heatmap rendering logic to always display the "Error" intensity.
-   **Visual Improvements:**
    -   Use a more distinct color gradient for errors (e.g., from light yellow to deep red).
    -   Add a tooltip or legend explaining that darker colors = more frequent errors.
    -   *Idea:* Highlight "problem keys" with a specific border or glow effect.

## 2. Data Storage & Retrieval (Backend: `controllers/practiceController.js`)
**Issue:** User wants heatmap data to come from *Practice Sessions*, excluding *Drill Sessions*, to track genuine improvement context.
**Plan:**
-   **Modify `getUserHeatmapData`:**
    -   Update the aggregation pipeline `$match` stage.
    -   Change `category: { $in: [...] }` to `category: 'typing'`. This ensures the global heatmap only reflects actual practice tests, not repetitive drills.

## 3. AI Integration (Backend: `services/aiGradingService.js` & `controllers/practiceController.js`)
**Issue:** The heatmap data (aggregated error history) is not currently sent to the AI.
**Plan:**
-   **Controller Update (`analyzeTypingPractice` in `practiceController.js`):**
    -   Fetch the user's *aggregated* heatmap data (top 5-10 worst keys) *before* calling the AI service.
    -   Pass this "historical error context" to the `analyzePerformance` function.
-   **AI Service Update (`analyzePerformance` in `aiGradingService.js`):**
    -   Update the prompt to include "Historical Problem Keys".
    -   Instruct the AI to compare *current* session errors with *historical* patterns (e.g., "You're still struggling with 'P', but you've improved on 'Q'").
    -   Ask AI to generate specific drills for these persistent problem keys.

## 4. Execution Steps
1.  **Modify Backend Controller:** Update `getUserHeatmapData` to filter only `category: 'typing'`.
2.  **Modify Frontend:** Remove heatmap toggle, enforce error view, and improve visual styles.
3.  **Enhance AI Flow:**
    -   In `practiceController.js`, inside `analyzeTypingPractice`, fetch top error keys using a helper function (similar to `getUserHeatmapData` logic).
    -   Pass this data to `aiGradingService.js`.
    -   Update the AI prompt to use this historical data for deeper insights.

## 5. Further Improvements (Suggestions)
-   **"Hot Key" Drill:** Create a button next to the heatmap that instantly generates a custom drill using ONLY the top 5 red keys from the heatmap.
-   **Trend Analysis:** Show a mini sparkline chart for the top 3 error keys to show if they are getting better or worse over time.
