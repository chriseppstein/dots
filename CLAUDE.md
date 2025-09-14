# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

**Development:**
```bash
npm run dev          # Start dev server (auto-selects port, usually 3000 or 3001)
npm run server       # Start WebSocket server on port 3002 (for online multiplayer)
npm run build        # Build for production
```

**Important:** For online multiplayer, both servers must be running:
1. `npm run dev` (game client)
2. `npm run server` (WebSocket backend)

**Testing:**
```bash
npm test             # Run all tests
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
vitest [pattern]     # Run specific test files matching pattern
```

## Core Architecture

**Cubes** is a 3D version of Dots and Boxes where players compete to claim cubes by capturing their faces.

### Game Engine (`src/core/GameEngine.ts`)
Central game logic handling:
- Turn management and move validation
- Square completion detection (when 4 lines form a face)
- Cube claiming logic (player needs 4/6 faces to win a cube)
- **Critical**: Uses Set-based unique face tracking to prevent double-counting shared faces between adjacent cubes
- Score tracking: `player.score` (cubes won) vs `player.squareCount` (faces claimed)

### 3D Visualization (`src/core/GameRenderer.ts`)
Three.js-based renderer with:
- Interactive 3D grid with dot-to-dot line drawing
- Mouse controls: left-click draws lines, right-drag rotates view
- Visual feedback: translucent squares for completed faces, spheres for cube ownership
- Configurable square opacity via `setSquareOpacity()`

### Game State Flow

**Mode Selection → Game Setup → Game Start:**
1. `GameSetup` component shows three-step flow:
   - Mode selection (Local/Single Player/Online)
   - Game setup (grid size, player names)
   - Waiting room (online only)
2. `GameSetup` → emits 'gamestart' event with NetworkManager (for online)
3. `GameBoard` orchestrates `GameEngine` + `GameRenderer` + `NetworkManager`
4. `GameEngine.makeMove()` validates lines and updates state
5. `GameRenderer.updateFromGameState()` syncs visuals

**Online Multiplayer Flow:**
1. Player 1 creates room → gets shareable URL (`?room=ROOMID`)
2. Player 2 visits URL → sees invitation with Player 1's name
3. Player 2 joins → both receive 'game-started' event
4. Moves sync via WebSocket through `NetworkManager`
5. Token-based reconnection stored in localStorage

### Component Architecture
Web Components with custom events:
- `<game-setup>` → `<game-board>` via 'gamestart' event
- `<game-board>` manages game lifecycle and UI updates
- Uses Shadow DOM for style isolation

## Key Implementation Details

**Face Sharing Bug Prevention:**
Adjacent cubes share faces. The `countUniqueFacesForPlayer()` method uses corner coordinates as Set keys to ensure each unique face is counted only once per player.

**Mouse Interaction:**
- Left mouse button: line selection/drawing
- Right mouse button: view rotation (prevents accidental moves during rotation)

**Game Modes:**
- `'local'`: Two players on same device
- `'ai'`: vs computer opponent (see `src/ai/AIPlayer.ts`)
- `'online'`: multiplayer via WebSocket (`src/network/NetworkManager.ts`)

**Online Multiplayer Architecture:**
- `NetworkManager`: Handles WebSocket connection and event management
- Room-based system with unique room IDs
- `get-room-info` endpoint for invitation display
- Token-based reconnection stored in localStorage
- Event cleanup via `cleanupNetworkManager()` to prevent duplicates
- Server runs on port 3002, client on 3000/3001

**Testing Strategy:**
- Comprehensive test coverage for game logic, line validation, scoring
- Specific tests for edge cases like the square counting bug
- Tests use Vitest with happy-dom environment
- **Important**: Do not create tests that require WebGL or Three.js rendering context, as these will fail in the test environment. Focus on testing game logic, state management, and non-visual components

## File Organization

```
src/
├── core/              # Game engine, renderer, types
├── components/        # Web Components (GameSetup, GameBoard)
├── ai/               # AI player implementation
├── network/          # WebSocket client for online play
├── tests/            # Vitest test files
└── main.ts           # App initialization

server/
└── server.ts         # Express + Socket.io server
```

Vite serves from `src/` directory, builds to `dist/`. Server runs independently for online multiplayer.

## Development Guidelines

### Client-Server Architecture Principle
**CRITICAL**: The server must remain agnostic of UI design and visual representation details. Game state should be stored abstractly on the server and interpreted by clients for visual display.

**DO:**
- Server stores player IDs (e.g., 'player1', 'player2') and abstract game data
- Client translates player IDs to colors using `PlayerColors.ts`
- Client handles all visual styling, colors, animations, and UI decisions

**DON'T:**
- Send color values from server to client
- Include UI-specific properties in server game state
- Make server dependent on visual representation choices

This separation ensures:
- Server can support multiple client types (web, mobile, CLI)
- UI changes don't require server updates
- Game logic remains independent of presentation layer

### TypeScript Build Requirement
**CRITICAL**: The TypeScript build must always pass after making changes. Similar to tests, TypeScript errors should never be left unresolved. Always run `npx tsc --noEmit` after making changes and fix any type errors before considering the work complete.

This ensures:
- Type safety across the entire codebase
- Early detection of interface mismatches and API changes
- Consistent code quality and developer experience
- Prevention of runtime errors caused by type mismatches

Use `npx tsc --noEmit` to check for type errors without generating JavaScript output.

### TDD Methodology for Bug Fixes
**CRITICAL**: Always use Test-Driven Development for bug fixes. Bug fixes should NEVER be implemented without first creating failing tests that reproduce the problem.

**Required workflow for bug fixes:**
1. **Use the TDD methodology guide agent** to ensure proper TDD workflow
2. **Write failing tests first** that reproduce the bug behavior
3. **Verify tests fail** with the current broken code
4. **Implement the minimal fix** to make tests pass
5. **Refactor if needed** while keeping tests green

This ensures:
- Bugs are properly documented and understood
- Fixes actually solve the root problem
- Regression prevention through comprehensive test coverage
- Code quality improvements through the red-green-refactor cycle

**Never skip TDD for bug fixes** - the test-first approach catches edge cases and prevents incomplete solutions.

### Testing Before Commits
**IMPORTANT**: Always ensure all tests pass before committing code. Commits with failing tests make it difficult to use `git bisect` for debugging and can break CI/CD pipelines. Run `npm test` and fix any failures before committing.

### Server Restart Rule
**IMPORTANT**: Always restart the server (`npm run server`) after making changes to `server/server.ts`. The server maintains in-memory state for active game rooms, and old state can interfere with testing new code changes.