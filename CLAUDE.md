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

**TDD Process:**
All development must follow Test-Driven Development methodology. See [docs/TDD-Process-Instructions.md](docs/TDD-Process-Instructions.md) for comprehensive process guidelines.

## CRITICAL TEST WRITING PRINCIPLE

**NEVER write tests that pass when bugs exist.** Always write tests that:
- ✅ **PASS** when the application functions correctly
- ❌ **FAIL** when bugs are present

This means:
- Write tests that assert correct behavior
- Let tests fail when bugs exist, then fix the bugs to make tests pass
- NEVER write `expect(bugExists).toBe(true)` or similar assertions
- NEVER write tests designed to "document" bugs by passing when broken

Example:
```typescript
// ❌ WRONG - test passes when bug exists
expect(autoplayTriggeredIncorrectly).toBe(true);

// ✅ CORRECT - test fails when bug exists, passes when fixed
expect(autoplayOnlyTriggersForCorrectPlayer).toBe(true);
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

### TDD Methodology - Mandatory Process
**CRITICAL**: Always use Test-Driven Development for both new features and bug fixes. Implementation should NEVER begin without first creating failing tests.

**Claude Code must follow the comprehensive TDD process documented in [docs/TDD-Process-Instructions.md](docs/TDD-Process-Instructions.md)**

**Core TDD Requirements:**
1. **Write failing tests first** - for both features and bug fixes
2. **Follow Red-Green-Refactor cycle** strictly
3. **Verify tests fail** before implementing solutions
4. **Write minimal code** to make tests pass
5. **Refactor while keeping tests green**

**For New Features:**
- Break down features into small, testable behaviors
- Plan test structure before writing any code
- Implement incrementally, one test at a time
- Focus on public interfaces and behavior, not implementation

**For Bug Fixes:**
- Write failing tests that reproduce the bug
- Verify tests fail with current broken code  
- Fix with minimal changes to pass tests
- Use tests as regression prevention

This ensures:
- Higher code quality through comprehensive testing
- Better design driven by testability requirements
- Faster debugging with immediate feedback
- Regression prevention through automated test suites
- Living documentation that stays current

**Reference the full TDD process guide at [docs/TDD-Process-Instructions.md](docs/TDD-Process-Instructions.md) for detailed workflows, best practices, and examples.**

### Testing Before Commits
**IMPORTANT**: Always ensure all tests pass before committing code. Commits with failing tests make it difficult to use `git bisect` for debugging and can break CI/CD pipelines. Run `npm test` and fix any failures before committing.

### Server Restart Rule
**IMPORTANT**: Always restart the server (`npm run server`) after making changes to `server/server.ts`. The server maintains in-memory state for active game rooms, and old state can interfere with testing new code changes.