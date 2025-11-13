# Worker Thread Best Practices

## Lessons Learned from Salt Search Implementation

This document outlines key best practices for working with Node.js Worker Threads, based on real-world experience implementing parallel salt search functionality.

---

## Key Principle: Workers Should Communicate, Not Crash

### The Problem We Encountered

Initially, our worker implementation threw errors when it couldn't find a matching salt:

```typescript
// ❌ BAD: Worker crashes on "not found"
if (result instanceof WorkerResponse) {
  parentPort.postMessage(result)
} else {
  throw result  // Worker process crashes!
}
```

**What went wrong:**
- Workers crashed instead of gracefully handling the "not found" scenario
- `Promise.any()` received `AggregateError` even when some workers succeeded
- Mixed success/error states in the errors array
- Difficult to distinguish between actual crashes and normal "not found" outcomes

### The Solution: Send Errors as Messages

Workers should **always communicate outcomes via messages**, reserving crashes for truly unexpected errors:

```typescript
// ✅ GOOD: Worker sends result and exits cleanly
if (result instanceof WorkerResponse) {
  parentPort.postMessage(result)
} else {
  parentPort.postMessage(result)  // Send error as message
}
```

---

## Best Practices

### 1. Design a Clear Message Protocol

Use a structured response type that handles both success and failure:

```typescript
interface WorkerResponse {
  isSuccess: boolean;
  data?: {
    salt: number;
    address: string;
  };
  error?: {
    message: string;
  };
}
```

**Benefits:**
- Clear distinction between success and failure
- Type-safe response handling
- No ambiguity about worker state

### 2. Handle Worker Responses Correctly in Main Thread

Set up promise handling to distinguish between messages and actual crashes:

```typescript
const promise = new Promise((resolve, reject) => {
  worker.once('message', (msg) => {
    if (msg.isSuccess) {
      resolve(msg)  // Success case
    } else {
      reject(msg)   // Controlled failure (sent as message)
    }
  })

  // Only for actual worker crashes
  worker.once('error', reject)

  // Only for unexpected termination
  worker.once('exit', (code) => {
    if (code !== 0) {
      reject(new Error(`Worker stopped with exitcode ${code}`))
    }
  })
})
```

**Key distinctions:**
- `'message'` event: Normal communication (success or expected failure)
- `'error'` event: Uncaught exceptions in worker (unexpected)
- `'exit'` event with non-zero code: Abnormal termination (unexpected)

### 3. Use Promise.any() for First-Success Scenarios

When you need the first successful result from parallel workers:

```typescript
try {
  const result = await Promise.any(workerPromises)
  // result is the first successful WorkerResponse
} catch (error) {
  // All workers reported failure via messages
  return new Error('All workers failed')
}
```

**Why Promise.any() works well:**
- Resolves with first successful result
- Ignores rejected promises (workers that found nothing)
- Only throws AggregateError if **all** promises reject
- Perfect for race-to-success scenarios

### 4. Distinguish Between Expected and Unexpected Failures

**Expected failures** (normal operation):
- No match found within search space
- Resource not available
- Validation failure

→ **Send as message**, reject the promise gracefully

**Unexpected failures** (bugs/crashes):
- Uncaught exceptions
- Out of memory
- Syntax errors

→ **Let worker crash**, handle via 'error' or 'exit' events

### 5. Clean Worker Termination

Always terminate workers properly after use:

```typescript
async terminateWorker(workers: Worker[]): Promise<void> {
  await Promise.all(
    workers.map(async (worker) => {
      worker.removeAllListeners()
      await worker.terminate()
    })
  )
}
```

Call this in a `finally` block to ensure cleanup:

```typescript
try {
  result = await Promise.any(promises)
} catch (error) {
  this.logger.debug(error)
  return new Error('All workers failed')
} finally {
  await this.terminateWorker(workers)
}
```

---

## Testing Considerations

### Update Tests to Match New Behavior

When changing from throw-based to message-based error handling:

**Worker unit tests:**
```typescript
// ✅ Check response structure
expect(result.isSuccess).toBe(false)
expect(result.error?.message).toBe('Not found')

// ❌ Don't expect thrown errors
// expect(() => searchSalt(params)).toThrow()
```

**Integration tests with mocked workers:**
```typescript
// ✅ Mock 'message' event with error response
worker.once('message', (callback) => {
  setTimeout(() => callback({
    isSuccess: false,
    error: { message: 'Not found' }
  }), 10)
})

// ❌ Don't mock 'error' event for normal failures
// worker.once('error', (callback) => {
//   setTimeout(() => callback(new Error('Not Found')), 10)
// })
```

---

## Performance Benefits

This approach provides several performance advantages:

1. **Faster cleanup**: Workers exit gracefully without crash handling overhead
2. **Better resource management**: No leaked worker processes from crashes
3. **Clearer debugging**: Error logs show actual errors, not expected outcomes
4. **Predictable behavior**: No race conditions between error/exit/message events

---

## Related Implementation Files

- `src/modules/token/worker/salt-search.worker.ts` - Worker implementation
- `src/modules/token/services/address-suffix.service.ts` - Main thread service
- `src/modules/token/spec/salt-search.worker.spec.ts` - Worker unit tests
- `src/modules/token/spec/address-suffix.service.spec.ts` - Integration tests

---

## Summary

**Golden Rule**: Workers should communicate all outcomes (success and expected failures) via messages. Reserve crashes for truly unexpected errors.

This pattern:
- ✅ Makes `Promise.any()` work correctly
- ✅ Distinguishes expected failures from bugs
- ✅ Enables clean worker termination
- ✅ Simplifies debugging and testing
- ✅ Improves code maintainability

**Remember**: If a worker crashes, something went wrong. If a worker sends an error message, it's just reporting that it couldn't complete its task - and that's okay!
