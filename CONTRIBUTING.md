# Contributing to RigBoard

Thanks for your interest in contributing to RigBoard!

## Development Setup

```bash
# Clone the repo
git clone https://github.com/your-username/rigboard.git
cd rigboard

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..

# Run in development mode
# Terminal 1: Backend
cd server && node index.js

# Terminal 2: Frontend (with hot reload)
cd client && npm run dev
```

The Vite dev server runs on http://localhost:5173 and proxies `/api` calls to Express on http://localhost:3000.

## Project Structure

- `server/` -- Express.js backend with SQLite
- `server/routes/` -- API route handlers
- `server/services/` -- Background services (feed fetcher, health checker)
- `server/db/schema.sql` -- Database schema
- `client/src/` -- React frontend
- `client/src/pages/` -- Route-level page components
- `client/src/components/widgets/` -- Dashboard widget components

## Pull Request Guidelines

1. **One feature per PR** -- Keep PRs focused and reviewable
2. **Test your changes** -- Verify the server starts, client builds, and the feature works end-to-end
3. **Follow existing patterns** -- Match the code style of surrounding code
4. **Update the API docs** -- If you add/change endpoints, update `server/swagger.json`
5. **No breaking changes** -- Database migrations should use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN` with try/catch

## Adding a New Widget

1. Create `client/src/components/widgets/YourWidget.jsx`
2. Register it in `WIDGET_TYPES` in `client/src/pages/DashboardPage.jsx`
3. Add default size in `WIDGET_DEFAULTS` in `client/src/hooks/useWidgetLayout.js`
4. If it needs a backend, add routes in `server/routes/` and register in `server/index.js`

## Adding a New API Endpoint

1. Create or edit a route file in `server/routes/`
2. Register the route in `server/index.js`
3. Add the client wrapper in `client/src/api.js`
4. Add the endpoint to `server/swagger.json`

## Reporting Issues

Please open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Docker version
- Server logs if applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
