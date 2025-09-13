# Incremental Performance Optimization Plan

## Lessons Learned from Performance Regression

**Problem**: Applied multiple performance optimizations simultaneously, causing severe performance regression (60fps → 1fps).

**Root Cause Analysis**: 
- Likely the `rebuildLineIndex()` call on every state update created O(n) overhead instead of reducing it
- GeometryCache may have added overhead for simple geometries
- Dirty flag system may have bugs preventing necessary renders
- Throttling may have made interactions feel unresponsive

**Solution**: Apply optimizations one at a time with rigorous testing.

## Testing Strategy

### 1. Manual Performance Testing Protocol

Since WebGL tests fail in headless environments, we need a manual testing protocol:

**Baseline Test (before each optimization):**
1. Start dev server: `npm run dev`
2. Create 4x4x4 game
3. Use browser DevTools Performance tab to record:
   - **Idle FPS**: Let game sit idle for 10 seconds, measure average FPS
   - **Interaction FPS**: Move mouse around for 10 seconds, measure FPS drops
   - **State Update Time**: Make 10 moves, measure time per state update
4. Record results in spreadsheet/doc
5. Take screenshots of DevTools Performance timeline

**Performance Regression Detection:**
- If any metric drops by >10%, investigate immediately
- If FPS drops below 30fps, revert optimization
- If state updates take >16ms, revert optimization

### 2. Computational Performance Testing

For headless testing, focus on computational hot paths:

```bash
# Run computational performance tests
npm run test:performance

# Measure specific hot path performance
npm run test -- src/tests/HotPath.performance.test.ts
```

### 3. Memory Testing

```bash
# Monitor memory usage patterns
npm run test:performance | grep "Memory"
```

## Incremental Optimization Plan

### Phase 1: Measurement Infrastructure ✅
- [x] Performance monitoring tools (PerformanceMonitor, BrowserPerformanceTracker)
- [x] Benchmark test suites
- [x] Integration test framework (even if headless-limited)
- [x] Manual testing protocol documented

### Phase 2: Hot Path Analysis & Optimization

#### 2.1 Mouse Hover Performance (Priority: CRITICAL)
**Current Issue**: O(n³) iteration on every mouse move (375 iterations on 5x5x5)

**Test Before**:
```bash
npm run test -- src/tests/MouseHover.performance.test.ts
```

**Manual Test**: Move mouse around 4x4x4 grid, measure FPS in DevTools

**Optimization**: Replace nested loops with pre-computed lookup table
- Create `possibleLines` array once during initialization
- Use spatial hashing or bounding box filtering
- Target: <1ms per hover detection

**Implementation**:
1. Add `private possibleLines: Line[]` to GameRenderer
2. Populate in `createGrid()` 
3. Replace `getHoveredLine()` with lookup approach
4. Test: Should see dramatic improvement in mouse responsiveness

#### 2.2 Line Creation Optimization (Priority: HIGH)
**Current Issue**: New geometry/material per line

**Test Before**: Time `createLineMesh` calls in isolation

**Optimization**: Basic geometry reuse (not full cache)
- Create shared geometries for common line lengths (1.0, √2, √3)
- Reuse materials by color (limited palette)
- Target: 50% reduction in mesh creation time

**Implementation**:
1. Add simple geometry/material maps to GameRenderer
2. Modify `createLineMesh` to use shared resources
3. Test: Measure mesh creation performance

#### 2.3 State Update Batching (Priority: MEDIUM)
**Current Issue**: Multiple DOM updates per state change

**Test Before**: Measure `updateFromGameState` time with multiple moves

**Optimization**: Batch visual updates
- Collect all changes before applying to scene
- Use `requestAnimationFrame` for update timing
- Target: <5ms per state update

### Phase 3: Advanced Optimizations

#### 3.1 Smart Rendering (Priority: LOW)
**Optimization**: Only render when scene changes
- Add dirty flags for scene changes
- Skip render calls when nothing changed
- Maintain 1fps minimum for animations

#### 3.2 Event Throttling (Priority: LOW)
**Optimization**: Throttle expensive mouse events
- Throttle hover detection to 20fps
- Use `requestAnimationFrame` for updates
- Maintain responsive feel

#### 3.3 Memory Optimization (Priority: LOW)
**Optimization**: Better resource disposal
- Standardize disposal patterns
- Monitor for memory leaks
- Optimize garbage collection timing

## Testing Each Optimization

### Before Implementing
1. Run baseline performance tests
2. Record current metrics
3. Take DevTools performance screenshot

### During Implementation
1. Write focused test for the specific optimization
2. Test the optimization in isolation
3. Ensure backwards compatibility

### After Implementation
1. Run full performance test suite
2. Manual testing with DevTools
3. Compare metrics to baseline
4. If regression > 10%, investigate or revert
5. Commit only if performance improves or stays same

### Performance Test Commands

```bash
# Computational tests (headless-safe)
npm run test:performance

# Manual testing checklist
npm run dev
# Then: Open DevTools → Performance → Record
# Test: Mouse movement, state updates, idle performance

# Hot path specific tests  
npm run test -- src/tests/MouseHover.performance.test.ts
npm run test -- src/tests/LineCreation.performance.test.ts
npm run test -- src/tests/StateUpdate.performance.test.ts
```

## Success Criteria

### Performance Targets
- **4x4x4 Grid**: 60fps idle, 45fps+ interactive, <5ms state updates
- **5x5x5 Grid**: 45fps idle, 30fps+ interactive, <10ms state updates  
- **Memory**: <50MB base usage, <10MB increase per game
- **Mouse Responsiveness**: <1ms hover detection

### Regression Prevention
- Never commit code that reduces FPS by >10%
- Never commit code that increases state update time by >5ms
- Always test on largest supported grid size (5x5x5)
- Always test with extended gameplay (100+ moves)

## Implementation Timeline

**Week 1**: Mouse hover optimization
- Write hot path tests
- Implement lookup table approach  
- Manual testing and verification

**Week 2**: Line creation optimization
- Implement basic geometry reuse
- Measure improvement
- Test memory impact

**Week 3**: State update optimization
- Implement batching approach
- Test with complex game states
- Verify no visual glitches

**Week 4**: Advanced optimizations (if needed)
- Smart rendering
- Event throttling
- Memory optimization

## Emergency Revert Plan

If any optimization causes performance regression:

1. **Immediate**: `git revert HEAD` (if committed) or `git checkout -- file` 
2. **Analyze**: Use DevTools to identify bottleneck
3. **Document**: Record findings in this file
4. **Re-approach**: Design smaller, safer optimization
5. **Test**: Apply more rigorous testing before retry

## Performance Monitoring Integration

For each optimization, integrate optional performance monitoring:

```typescript
// Example integration
private performanceMonitor?: PerformanceMonitor;

private getHoveredLineOptimized(): Line | null {
  const startTime = this.performanceMonitor?.startMeasurement('hover-detection');
  
  // Optimized logic here
  const result = this.findLineWithLookup();
  
  this.performanceMonitor?.endMeasurement('hover-detection', startTime);
  return result;
}
```

This allows developers to enable monitoring and verify optimizations are working:

```typescript
const renderer = new GameRenderer(container, gridSize, true); // Enable monitoring
const metrics = renderer.getPerformanceMetrics();
console.log('Hover detection time:', metrics?.customMetrics['hover-detection']);
```