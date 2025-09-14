# TDD Guide: Line Analysis Bug Prevention

## Overview

This document outlines the Test-Driven Development (TDD) methodology used to prevent and fix critical bugs in the GameRenderer's line consequence analysis system. It serves as a reference for applying TDD to similar complex algorithmic bugs.

## The Bugs That Were Fixed

### Bug 1: Incorrect Line Classification
**Problem**: All line previews were showing red (dangerous) because `analyzeLineConsequences` was only checking cubes from `this.lastState.cubes` instead of analyzing all possible squares that could be affected by the line.

**Root Cause**: The method was looking at existing completed cubes rather than potential squares that could be formed.

### Bug 2: Inefficient Square Detection  
**Problem**: Square completion detection was checking ALL possible squares in the grid (162 squares in a 4x4 grid) instead of only squares adjacent to the line being drawn.

**Root Cause**: Brute force O(n³) algorithm checking every possible square instead of using spatial optimization.

## TDD Methodology Applied

### 1. Red Phase: Write Failing Tests

#### Test Categories Created:

**Bug 1 Tests - Incorrect Classification:**
```typescript
// Test that should expose the bug
it('should classify a safe first line as safe, not dangerous', () => {
  // ARRANGE: Empty board
  const gameState = createBasicGameState(4);
  
  // ACT: Analyze a line that should be safe
  const result = renderer.analyzeLineConsequences(safeLine);
  
  // ASSERT: This would FAIL before bug fix (showing 'dangerous-third-line' instead of 'safe')
  expect(result.type).toBe('safe');
});
```

**Bug 2 Tests - Performance Issues:**
```typescript
// Test that should expose inefficiency
it('should only check squares adjacent to the line, not all possible squares', () => {
  // ARRANGE: Large grid to make inefficiency apparent
  const gameState = createBasicGameState(6); // 6x6x6 = many squares
  
  // ACT: Analyze line and spy on method calls
  const adjacentSquares = renderer.getSquaresAdjacentToLine(cornerLine, 6);
  
  // ASSERT: Should check far fewer than all possible squares (efficient)
  expect(adjacentSquares.length).toBeLessThan(20); // Not 1296!
});
```

### 2. Green Phase: Implement Fixes

The fixes were already implemented:

1. **Bug 1 Fix**: Modified `analyzeLineConsequences` to use `getSquaresAdjacentToLine()` instead of only checking `this.lastState.cubes`

2. **Bug 2 Fix**: Implemented efficient `getSquaresAdjacentToLine()` method that only checks squares spatially adjacent to the line being drawn

### 3. Refactor Phase: Test Helper Methods

Created comprehensive tests for supporting methods:

```typescript
describe('Helper Method Correctness', () => {
  // Test getSquaresAdjacentToLine
  // Test squareContainsLine  
  // Test getLineOrientation
});
```

## Key TDD Principles Applied

### 1. Test the Behavior, Not the Implementation
- Tests focus on expected outcomes (safe vs dangerous classifications)
- Tests verify performance characteristics without coupling to specific algorithms

### 2. Edge Case Coverage
```typescript
it('should handle edge cases at grid boundaries', () => {
  const edgeLine = createTestLine([0, 0, 0], [1, 0, 0]);
  const result = renderer.getSquaresAdjacentToLine(edgeLine, 4);
  expect(result).toBeInstanceOf(Array);
  expect(result.length).toBeGreaterThan(0);
});
```

### 3. Performance as a First-Class Concern
```typescript
it('should efficiently handle line analysis in large grids', () => {
  const startTime = performance.now();
  const result = renderer.analyzeLineConsequences(testLine);
  const duration = performance.now() - startTime;
  
  expect(duration).toBeLessThan(5); // Should complete quickly
});
```

### 4. Integration Testing
```typescript
it('should handle complex game state with multiple lines and partial squares', () => {
  // Test realistic scenarios with multiple partial squares
  // Verify all analysis types work correctly together
});
```

## Test Structure Best Practices

### 1. Descriptive Test Organization
```
describe('TDD Bug 1: analyzeLineConsequences Incorrect Danger Classification')
describe('TDD Bug 2: Inefficient Square Detection') 
describe('Helper Method Correctness')
describe('Integration Tests')
```

### 2. Clear Test Naming
- `should classify a safe first line as safe, not dangerous`
- `should only check squares adjacent to the line, not all possible squares`
- `should maintain performance with realistic game scenarios`

### 3. Arrange-Act-Assert Pattern
```typescript
// ARRANGE: Set up test conditions
const gameState = createBasicGameState(4);
const testLine = createTestLine([0, 0, 0], [1, 0, 0]);

// ACT: Execute the behavior being tested  
const result = renderer.analyzeLineConsequences(testLine);

// ASSERT: Verify expected outcomes
expect(result.type).toBe('safe');
```

## Lessons Learned

### 1. Mock Strategy
- Used comprehensive Three.js mocking to isolate business logic
- Avoided testing visual rendering, focused on algorithmic correctness
- Made private methods testable through TypeScript casting: `(renderer as any).methodName()`

### 2. Test Data Factories
```typescript
const createTestPlayer = (id: string, color: string): Player => ({...});
const createTestLine = (start: [number, number, number], end: [number, number, number]): Line => ({...});
const createBasicGameState = (gridSize: number = 4): GameState => ({...});
```

### 3. Performance Testing
- Used `performance.now()` to verify algorithmic improvements
- Set reasonable expectations (under 5ms for line analysis)
- Tested with realistic data sizes (large grids, many lines)

## Future TDD Applications

### When to Apply This Approach:

1. **Complex Algorithmic Logic**: When implementing systems with multiple interacting rules
2. **Performance-Critical Code**: When optimization is essential and regressions are costly  
3. **Visual/UI Logic**: When separating business logic from presentation concerns
4. **Bug-Prone Areas**: When historical data shows frequent issues

### Recommended Test Categories:

1. **Core Logic Tests**: Basic happy path scenarios
2. **Edge Case Tests**: Boundary conditions and error cases
3. **Performance Tests**: Speed and efficiency requirements
4. **Integration Tests**: Complex realistic scenarios
5. **Helper Method Tests**: Building block verification

## Running the Tests

```bash
# Run all line analysis tests
npm test -- LineConsequenceAnalysis

# Run with coverage
npm run test:coverage

# Run specific test patterns
vitest LineConsequence
```

## File Locations

- **Test File**: `/src/tests/LineConsequenceAnalysis.test.ts`
- **Implementation**: `/src/core/GameRenderer.ts` (methods: `analyzeLineConsequences`, `getSquaresAdjacentToLine`, `squareContainsLine`)
- **Documentation**: `/docs/TDD-Line-Analysis-Guide.md`

This TDD approach successfully caught both bugs and ensured the fixes work correctly while maintaining performance requirements.