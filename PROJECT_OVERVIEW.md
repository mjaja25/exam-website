# Project Overview: Dream Centre Proficiency Portal

An exam and practice platform for NSSB CPT (Computer Proficiency Test).

## Technology Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript (No frameworks)
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas
- **Design:** Duolingo-inspired green theme with gamification (XP, streaks, badges)
- **Main CSS:** `public/css/main.css` (modern green theme)
- **Legacy CSS:** `public/css/style.css` (old gold theme)

## Key Features
- **Practice Zones:** Typing, MCQ, Letter writing, Excel
- **Gamification:** XP, streaks, badges, leaderboards
- **Authentication:** Custom login/signup and Google OAuth
- **Admin Panel:** Management of exams and user data
- **Dark Mode:** Implemented via `[data-theme="dark"]` attribute

## UI/UX Improvement Plan

### 1. Auth Flow Redesign
- **Login/Signup/Forgot Password:** Improve visual hierarchy of input fields, make primary buttons more prominent, and refine card layouts.

### 2. Dashboard Polish
- **Hero Card:** Make the "Start Test" call-to-action more impactful.
- **Practice Grid:** Enhance the layout and visual feedback of the practice modules.
- **Gamification:** Polish the XP/streak/badges display for better motivation.

### 3. Results Page
- **CSS Gaps:** Fix missing styles for result components.
- **Data Visualization:** Improve how performance metrics are presented.

### 4. Technical Debt & Consistency
- **CSS Cleanup:** Remove legacy `style.css` conflicts and unify the design system.
- **Dark Mode:** Align with system-level preferences (prefers-color-scheme) alongside manual toggle.
- **Responsiveness:** Ensure consistent mobile experience across all practice modules.
