# Restore AI Coach and WPM Chart Plan

The investigation revealed a JSON structure mismatch between the frontend and backend for the AI Coach, causing the feature to disappear. The WPM chart may also be affected by data handling for short sessions.

## 1. Backend: AI Coach Fix (services/aiGradingService.js)
**Issue:** `public/practice-typing.js` expects a specific JSON structure (`level`, `summary`, `speedTip`, `accuracyTip`, `drills`, `warmup`, `goalWpm`, `goalAccuracy`) from the API. However, `services/aiGradingService.js` currently returns a generic structure (`strengths`, `improvements`, `tips`) for typing analysis.

**Plan:**
- Modify `services/aiGradingService.js`:
  - Update the `analyzePerformance` function for `type === 'typing'`.
  - Change the prompt to explicitly request the JSON structure required by the frontend.
  - Ensure the response includes: `level`, `summary`, `speedTip`, `accuracyTip`, `drills` (array of objects), `warmup` (array of strings), `goalWpm`, and `goalAccuracy`.

## 2. Frontend: WPM Chart Verification (public/practice-typing.js)
**Issue:** The chart logic in `public/practice-typing.js` returns early if there are fewer than 2 data points. For very short tests, this might prevent the chart from rendering.

**Plan:**
- Review `public/practice-typing.js`:
  - Check the `drawWpmChart` function.
  - Ensure `wpmTimeline` always has at least 2 points (e.g., ensure start (0,0) and end (finalTime, finalWpm) are always present even for short tests).
  - The current code does push a final sample in `endPractice`, so for any test > 0s, we should have at least 2 points (0 and final).
  - I will add a safeguard to ensure the chart attempts to draw even with minimal data if possible, or at least explain why it's empty. But primarily, the fix in `endPractice` (which already exists: `wpmTimeline.push({ time: secs, wpm: finalWpm });`) should be sufficient unless `secs` is 0.

## 3. Execution Steps
1.  **Edit `services/aiGradingService.js`**: Update the prompt for typing analysis.
2.  **Verify**: I cannot run the frontend interactively, but I will verify the backend code changes match the frontend's expected keys.
