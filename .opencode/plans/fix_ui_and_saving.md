# Plan to Fix UI, Saving, and Enhance Visuals

## 1. Fix "Jagged Edges" on Tabs (CSS)
**Issue:** The `.tab-btn` uses `border-bottom-width: 4px` which causes layout shifts when toggled, creating a "jagged" effect.
**Fix:**
- Use `box-shadow` or `transform` for the 3D effect instead of changing border width.
- Ensure consistent height and padding.
- Add `overflow: hidden` to rounded corners if necessary.

## 2. Fix Data Saving (JavaScript)
**Issue:** The backend Zod schema expects `keystrokes` to be an **Array**, but the frontend sends an **Object** (map). This causes validation failure.
**Fix:**
- Modify `public/js/pages/practice.js` in `submitPracticeData`:
  - Convert `state.engine.keystrokes` object to an array before sending.
  - Format: `Object.entries(keystrokes).map(([key, data]) => ({ key, ...data }))`.
  - Also ensure `errors` array matches the schema structure.

## 3. Enhance "Detailed Error Analysis" (Visuals)
**Goal:** Make it "more pictorial".
**Plan:**
- **Finger Performance:** Replace simple bars with a **visual hand map** or a **radar chart** (using Chart.js if available, or CSS-based visualization). Since I don't want to add heavy dependencies if not needed, I'll create a **CSS-based Hand Heatmap**.
  - Draw a simple CSS/SVG hand representation where each finger lights up based on error rate.
  - Or, improve the existing bar chart to look more like a "Finger Strength" equalizer. Let's go with the **"Finger Strength Equalizer"** look – vertical bars for each finger, colored by accuracy.
- **Top Errors:** Replace the list with a **"Bubble Chart"** style or **"Key Cards"**.
  - **Key Cards:** Each mistyped key is a card showing the key, error count, and a visual "health bar" of accuracy.

## 4. Fix AI Analysis Rendering
**Issue:** User says "ai analysis is not getting rendered".
**Investigation:** The `renderCoachReport` function seems correct, but maybe the API response isn't matching what it expects.
**Fix:**
- Add robust error handling and logging in `practice.js` to see exactly what the API returns.
- Ensure the `coach-panel` removes the `hidden` class correctly.
- Check if `coach-content` element exists at the time of rendering.

## Execution Steps
1.  **CSS:** Update `.tab-btn` styles in `main.css`.
2.  **JS:** Fix `submitPracticeData` payload formatting in `practice.js`.
3.  **JS/CSS:** Refactor `ErrorAnalyzer.js` to generate the new "Key Cards" HTML for top errors and "Equalizer" HTML for fingers. Add corresponding CSS.
4.  **JS:** Verify AI rendering logic and add fallback if fields are missing.
