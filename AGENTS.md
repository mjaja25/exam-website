# AI Agent Guidelines (AGENTS.md)

Welcome, AI coding agents! This document outlines the commands, rules, and code style guidelines for the Dream Centre Proficiency Portal repository. Please read this file carefully and adhere to these guidelines to ensure consistency and correctness across the project.

## 1. Project Architecture Overview
- **Backend**: Node.js, Express, MongoDB Atlas (Mongoose).
- **Frontend**: Vanilla HTML, CSS, JavaScript (No React, Vue, etc.).
- **Theme**: Green Duolingo-inspired theme with Dark Mode support (`[data-theme="dark"]`).
- **Core Features**: Gamification (XP, streaks, badges), Practice Zones (Typing, MCQ, Letter writing, Excel), and Admin Panel.

## 2. Build, Lint & Test Commands

This project uses `jest` for testing and a standard `package.json` setup. There is currently no pre-configured linter like ESLint, so rely on the codebase conventions below.

### 🏃‍♂️ Running the Server
- **Start server**: `npm start` (Runs `node server.js`)
- **Note**: Ensure `MONGO_URI` and other environment variables are present in the `.env` file before starting.

### 🧪 Running Tests
We use Jest for backend testing.
- **Run all tests**: `npm test`
- **Run tests with coverage**: `npm run test:coverage`
- **Run tests in watch mode**: `npm run test:watch`
- **Run a single test file**: `npx jest <path_to_test_file>` or `npm test -- <filename>`
  *(e.g., `npx jest tests/auth.test.js`)*
- **Run a specific test case within a file**: `npx jest -t "name of test"`

## 3. Code Style & Conventions

### 📦 Imports & Exports
- **Format**: We strictly use **CommonJS** (`require` and `module.exports`) in the backend. Do NOT use ES Modules (`import`/`export`) for Node.js backend files.
- **Organization**: Group external modules first (e.g., `express`, `mongoose`), followed by internal files (e.g., `./models/User`, `./controllers/authController`).

### 🏷️ Naming Conventions
- **Files/Directories**: 
  - Routes: `lowercase.js` (e.g., `auth.js`, `exam.js`)
  - Controllers: `camelCase` ending in `Controller.js` (e.g., `authController.js`)
  - Models: `PascalCase.js` (e.g., `User.js`, `TestResult.js`)
- **Variables/Functions**: `camelCase` (e.g., `getUserProfile`, `totalScore`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `PORT`, `MAX_RETRIES`)
- **Classes/Constructors**: `PascalCase`

### 🔧 Architecture & Structure
- **Separation of Concerns**: 
  - `server.js` is the entry point (DB connection and listening).
  - `app.js` contains Express configuration, middleware, and route mounting (separated for testability).
  - `routes/`: Define API endpoints and map them to controller functions.
  - `controllers/`: Handle business logic, request validation, and responses.
  - `models/`: Mongoose schemas and database interactions.
  - `public/`: Static files (HTML, CSS, vanilla JS).

### 🚨 Error Handling
- **Global Error Handler**: `app.js` contains a global error handler for centralized error management. 
- **In Controllers**: Always use `try...catch` blocks for asynchronous code. 
- **Passing Errors**: Pass errors to the global handler using `next(error)`. Alternatively, respond directly with `res.status(HTTP_STATUS).json({ message: '...' })`.
- **Consistency**: Return standard JSON error objects with at least a `message` property. Do not leak stack traces in production.

Example:
```javascript
exports.getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        next(error); // Passes to global error handler
    }
};
```

### 🔒 Security Practices
- Use `helmet` for HTTP headers (already configured in `app.js`).
- Obey the API rate limiting configurations in `app.js` (e.g., `authLimiter`, `apiLimiter`).
- Ensure sensitive logic (like password hashing) is handled via `bcryptjs`.
- Never commit `.env` or hardcoded secrets.

### 💄 Frontend Rules
- **No Frameworks**: Stick strictly to Vanilla JS (ES6+) and modern CSS.
- **CSS Architecture**: Modify `public/css/main.css`. Avoid touching legacy stylesheets (`style.css`) unless specifically removing conflicts. Use standard CSS variables for theme support (`--bg-primary`, `--text-main`, etc.).
- **Responsiveness**: Always verify code behaves correctly across breakpoints (`360px`, `480px`, `768px`, `1024px`).
- **Animations**: Use CSS transitions/animations where feasible, applying `will-change` for complex transformations to improve performance.

## 4. Operational Directives for AI Agents

- **Documentation Retrieval**: Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
- **Read Before Write**: Always read related `models`, `routes`, and `controllers` before creating new ones to fully understand the project's layout and established patterns.
- **Testing**: Whenever implementing a new backend feature, try to write corresponding `jest` tests. When fixing a bug, verify if an existing test needs modification.
- **Minimal Changes**: Avoid modifying parts of the codebase unrelated to the user's specific request. Focus on scoped, minimal, and idiomatic fixes.
- **Relative vs Absolute Paths**: Always use absolute paths within the Agent environment when reading/writing files, constructed from the repository root `E:\work\exam-website`.

---
*Created automatically to ensure consistent code quality and standard practices within the Dream Centre Proficiency Portal.*