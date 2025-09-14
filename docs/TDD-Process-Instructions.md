# TDD Process Instructions for Claude Code

This document provides detailed Test-Driven Development (TDD) process instructions that Claude Code should follow when implementing new features or fixing bugs. These instructions replace the need for a separate TDD methodology guide agent.

## Core TDD Principles

### Red-Green-Refactor Cycle
1. **RED**: Write a failing test that describes the desired behavior
2. **GREEN**: Write the minimal code to make the test pass
3. **REFACTOR**: Improve the code while keeping tests green

### Test-First Mindset
- **Never write production code without a failing test**
- Tests should describe behavior, not implementation
- Write the simplest test that could possibly fail
- Let tests drive the design of your code

## TDD Workflow for New Features

### Step 1: Understand the Requirement
- Break down the feature into small, testable behaviors
- Identify the public interface that needs to be tested
- Consider edge cases and error conditions
- Plan the test structure before writing any code

### Step 2: Write the First Failing Test
```typescript
// Example structure:
describe('Feature Name', () => {
  describe('Core Behavior', () => {
    it('should do X when Y happens', () => {
      // Arrange: Set up test data
      // Act: Call the method/function
      // Assert: Verify the expected outcome
    });
  });
});
```

### Step 3: Run the Test (Should Fail)
- Verify the test fails for the right reason
- If test passes unexpectedly, the test is wrong
- Red phase: Test should fail with a clear error message

### Step 4: Write Minimal Production Code
- Write only enough code to make the test pass
- Avoid over-engineering or adding extra features
- Focus on the simplest solution that works

### Step 5: Run Tests (Should Pass)
- All tests should pass
- If tests still fail, debug and fix the implementation
- Green phase: All tests passing

### Step 6: Refactor
- Improve code quality while keeping tests green
- Run tests after each refactoring step
- Consider: readability, performance, design patterns

## TDD Workflow for Bug Fixes

### Step 1: Reproduce the Bug
- Write a failing test that demonstrates the bug
- Test should fail with the current broken code
- Test describes the correct behavior that's currently missing

### Step 2: Verify Test Failure
- Run the test and confirm it fails
- Ensure it fails for the expected reason
- If test passes, bug may already be fixed or test is wrong

### Step 3: Fix the Bug
- Implement the minimal fix to make the test pass
- Avoid fixing other issues in the same change
- Focus on the specific bug being addressed

### Step 4: Verify Fix
- Run the failing test - should now pass
- Run all related tests to check for regressions
- Ensure no other functionality is broken

### Step 5: Refactor if Needed
- Clean up the fix if necessary
- Ensure code quality standards are maintained
- Keep tests green throughout refactoring

## Test Structure Guidelines

### Test Organization
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    describe('when condition X', () => {
      it('should produce outcome Y', () => {
        // Test implementation
      });
    });
    
    describe('error cases', () => {
      it('should throw error when invalid input', () => {
        // Error test
      });
    });
  });
});
```

### Test Naming Conventions
- Use descriptive names that explain behavior
- Follow "should [expected behavior] when [condition]" pattern
- Avoid implementation details in test names
- Make failing tests easy to understand

### Test Data Setup
```typescript
describe('Feature', () => {
  let testSubject: ClassName;
  let mockDependency: jest.Mock;
  
  beforeEach(() => {
    mockDependency = jest.fn();
    testSubject = new ClassName(mockDependency);
  });
  
  it('should behave correctly', () => {
    // Test implementation using setup
  });
});
```

## Testing Best Practices

### Arrange-Act-Assert Pattern
```typescript
it('should calculate total correctly', () => {
  // Arrange: Set up test data
  const items = [{ price: 10 }, { price: 20 }];
  const calculator = new PriceCalculator();
  
  // Act: Execute the behavior
  const result = calculator.calculateTotal(items);
  
  // Assert: Verify the outcome
  expect(result).toBe(30);
});
```

### Test Independence
- Each test should be independent and isolated
- Tests should not depend on the order of execution
- Use setup/teardown methods for common initialization
- Avoid shared mutable state between tests

### Mock External Dependencies
```typescript
it('should save data through repository', () => {
  const mockRepository = jest.fn();
  const service = new DataService(mockRepository);
  const testData = { id: 1, name: 'test' };
  
  service.saveData(testData);
  
  expect(mockRepository).toHaveBeenCalledWith(testData);
});
```

### Test Edge Cases
- Test boundary conditions (0, 1, max values)
- Test error conditions and exception handling
- Test null/undefined inputs where applicable
- Test empty collections and edge states

## Performance Testing in TDD

### When to Add Performance Tests
- For algorithms with complexity requirements
- For operations that must complete within time limits
- For memory-sensitive operations
- When performance is a functional requirement

### Performance Test Structure
```typescript
it('should complete operation within time limit', () => {
  const startTime = performance.now();
  const largeDataSet = generateTestData(10000);
  
  const result = systemUnderTest.processData(largeDataSet);
  
  const duration = performance.now() - startTime;
  expect(duration).toBeLessThan(100); // 100ms limit
  expect(result).toBeDefined();
});
```

## Integration Testing

### When to Write Integration Tests
- When testing interactions between components
- When testing external API integrations
- When testing database operations
- When testing end-to-end workflows

### Integration Test Guidelines
- Focus on component interactions
- Use real implementations where possible
- Mock only external systems (APIs, databases)
- Test realistic scenarios and data flows

## Common TDD Mistakes to Avoid

### Writing Tests After Code
- **Wrong**: Code first, tests second
- **Right**: Tests first, minimal code second
- Tests written after code often miss edge cases
- Code-first approach leads to hard-to-test designs

### Testing Implementation Details
- **Wrong**: Testing internal methods and private state
- **Right**: Testing public behavior and outcomes
- Focus on what the code does, not how it does it
- Implementation details can change without breaking behavior

### Writing Too Much Code at Once
- **Wrong**: Implementing entire features before testing
- **Right**: Small increments, constant feedback
- Write minimal code to pass each test
- Add functionality one test at a time

### Ignoring Failing Tests
- **Wrong**: Commenting out or skipping failing tests
- **Right**: Fix failing tests immediately
- Failing tests indicate broken functionality
- Accumulating technical debt hurts long-term productivity

## TDD for Complex Features

### Breaking Down Large Features
1. Identify the core functionality
2. List all required behaviors
3. Prioritize behaviors by importance
4. Implement one behavior at a time
5. Build incrementally with continuous testing

### Example: Implementing Game Chain Reactions
```typescript
// Step 1: Test basic chain detection
it('should detect when a move creates a chain opportunity', () => {
  // Test setup and assertion
});

// Step 2: Test single chain execution
it('should automatically complete one additional square in a chain', () => {
  // Test implementation
});

// Step 3: Test multiple chain handling
it('should continue chain until no more moves possible', () => {
  // Test implementation
});

// Step 4: Test turn management during chains
it('should return control to player after chain completes', () => {
  // Test implementation
});
```

## Debugging TDD Issues

### When Tests Are Hard to Write
- Code may be tightly coupled
- Dependencies may not be properly injected
- Methods may be doing too many things
- Consider refactoring before continuing

### When Tests Pass But Feature Doesn't Work
- Tests may not be testing the right behavior
- Test doubles may not match real implementations
- Integration points may not be tested
- Add higher-level tests to catch gaps

### When Tests Are Flaky or Slow
- Tests may have hidden dependencies
- Async operations may not be properly handled
- External systems may be affecting tests
- Consider test isolation and mocking strategies

## TDD Metrics and Success Indicators

### Code Coverage
- Aim for high test coverage (>90%)
- Focus on meaningful coverage, not just percentage
- Ensure all critical paths are tested
- Use coverage reports to find untested code

### Test Quality Indicators
- Tests run fast (unit tests < 1ms each)
- Tests are reliable and don't flake
- Test failures provide clear error messages
- Tests serve as living documentation

### Development Flow Indicators
- Features are delivered incrementally
- Bugs are caught early in development
- Refactoring is done with confidence
- Code reviews focus on design, not correctness

## Conclusion

Following these TDD process instructions ensures:
- **Higher code quality** through comprehensive testing
- **Better design** driven by testability requirements
- **Faster debugging** with immediate feedback
- **Regression prevention** through automated test suites
- **Living documentation** that stays up-to-date

Remember: TDD is not about testing, it's about design. The tests are a byproduct of good design practices that lead to maintainable, reliable software.