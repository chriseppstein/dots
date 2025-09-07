# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

**Development:**
```bash
npm run dev          # Start dev server on localhost:3000
npm run server       # Start WebSocket server on port 3001 (for online multiplayer)
npm run build        # Build for production
```

**Testing:**
```bash
npm test             # Run all tests
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
vitest [pattern]     # Run specific test files matching pattern
```

## Core Architecture

**Planes** is a 3D version of Dots and Boxes where players compete to claim cubes by capturing their faces.

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
1. `GameSetup` → emits 'gamestart' event
2. `GameBoard` orchestrates `GameEngine` + `GameRenderer`
3. `GameEngine.makeMove()` validates lines and updates state
4. `GameRenderer.updateFromGameState()` syncs visuals

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

**Testing Strategy:**
- Comprehensive test coverage for game logic, line validation, scoring
- Specific tests for edge cases like the square counting bug
- Tests use Vitest with happy-dom environment

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