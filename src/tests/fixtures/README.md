# Game State Test Fixtures

This directory contains utilities for loading game state files as test fixtures, allowing you to test specific game scenarios without needing to play through entire games.

## Directory Structure

```
src/tests/fixtures/
├── README.md                    # This file
├── types.ts                     # TypeScript type definitions for fixtures
├── GameStateFixtures.ts         # Main utility class
├── GameStateFixtures.test.ts    # Example tests showing usage
└── data/                        # Directory containing fixture JSON files
    └── autoplay-chain-state.json # Example fixture (copied from root)
```

## Basic Usage

### Loading a Fixture

```typescript
import { GameStateFixtures } from './fixtures/GameStateFixtures';

// Load a fixture file
const fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');

// Access the game state
const gameState = fixture.gameState;
console.log(`Grid size: ${gameState.gridSize}`);
console.log(`Current player: ${gameState.currentPlayer.name}`);
```

### Creating Game Components from Fixtures

```typescript
// Create a GameEngine with the loaded state
const engine = GameStateFixtures.createEngineFromFixture(fixture);

// Create a GameController with the loaded state
const controller = GameStateFixtures.createControllerFromFixture(fixture);

// Apply fixture to existing engine
const existingEngine = new GameEngine(3, 'local');
GameStateFixtures.applyFixtureToEngine(existingEngine, fixture);
```

### Using in Tests

```typescript
import { describe, it, expect } from 'vitest';
import { GameStateFixtures } from './fixtures/GameStateFixtures';

describe('Specific Game Scenario', () => {
  it('should handle autoplay chain reactions correctly', () => {
    const fixture = GameStateFixtures.loadFixture('autoplay-chain-state.json');
    const engine = GameStateFixtures.createEngineFromFixture(fixture);
    
    // Test behavior in this specific state
    const validMoves = engine.getPossibleMoves();
    expect(validMoves.length).toBeGreaterThan(0);
    
    // Make a move and verify the result
    if (validMoves.length > 0) {
      const success = engine.makeMove(validMoves[0].start, validMoves[0].end);
      expect(success).toBe(true);
    }
  });
});
```

## Fixture File Format

Fixture files are JSON files with the following structure:

```typescript
{
  "timestamp": "2025-09-14T16:26:06.799Z",  // Optional
  "metadata": {                             // Optional
    "name": "Test Scenario Name",
    "description": "What this fixture tests",
    "scenario": "mid_game",
    "expectedBehavior": "Should trigger chain reaction",
    "tags": ["chain-reaction", "autoplay"]
  },
  "gameState": {
    // Complete GameState object with all required properties
    "gridSize": 4,
    "currentPlayer": { ... },
    "players": [...],
    "lines": [...],
    "cubes": [...],
    "gameMode": "local",
    "winner": null,
    "turn": 42,
    "autoplayChainReactions": true
  }
}
```

## Utility Methods

### GameStateFixtures Class Methods

- `loadFixture(fileName, fixturesDir?)`: Load and validate a fixture file
- `createEngineFromFixture(fixture)`: Create GameEngine instance from fixture
- `createControllerFromFixture(fixture)`: Create GameController instance from fixture
- `applyFixtureToEngine(engine, fixture)`: Apply fixture state to existing engine
- `validateFixture(fixture)`: Validate fixture format and content
- `listAvailableFixtures(fixturesDir?)`: List all available fixture files
- `createBasicFixture(gridSize?, gameMode?, autoplay?)`: Generate a basic fixture programmatically

### Validation

The fixture loader automatically validates:
- Required GameState properties exist
- Players array has exactly 2 players
- Grid size is valid (3, 4, 5, or 6)
- Game mode is valid ('local', 'online', 'ai')
- Player IDs are unique and consistent

## Adding New Fixtures

1. **From Game Session**: Save a game state using the existing save functionality, then copy the JSON file to `src/tests/fixtures/data/`

2. **Programmatically**: Use `createBasicFixture()` and modify as needed:

```typescript
const basicFixture = GameStateFixtures.createBasicFixture(4, 'ai', true);
// Modify basicFixture.gameState as needed for your test scenario
```

3. **Manual Creation**: Create a JSON file following the format above

## Best Practices

1. **Descriptive Names**: Use descriptive file names like `mid-game-chain-opportunity.json`
2. **Add Metadata**: Include metadata to document what the fixture tests
3. **Validate**: Always validate fixtures with `validateFixture()` 
4. **Small States**: Keep fixtures focused on specific scenarios
5. **Version Control**: Check fixture files into git for reproducible tests

## Example Use Cases

- **Bug Reproduction**: Save problematic game states for debugging
- **Edge Case Testing**: Test specific game situations (near-win, chain reactions, etc.)
- **Performance Testing**: Load complex game states for performance benchmarks
- **Regression Testing**: Preserve problematic states to prevent regression
- **Feature Testing**: Test new features against various game states

## Troubleshooting

**Fixture fails to load**: Check that the file exists in `src/tests/fixtures/data/` and has valid JSON format.

**Validation errors**: Use `validateFixture()` to see specific validation issues.

**Path issues**: Use the optional `fixturesDir` parameter to specify custom fixture directory.

**State inconsistency**: Make sure the loaded state matches the expected game rules and constraints.