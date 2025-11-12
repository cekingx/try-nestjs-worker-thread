# NestJS Worker Threads Demo

A NestJS application demonstrating **parallel computation using Node.js Worker Threads** for CPU-intensive tasks. This project showcases how to efficiently distribute computational work across multiple worker threads and leverage `Promise.race()` for optimal performance.

## Features

- **Multi-threaded Parallel Processing**: Spawns multiple worker threads to distribute CPU-intensive tasks
- **Promise.race() Pattern**: Returns the first successful result from competing workers
- **Salt Mining Algorithm**: Implements Ethereum vanity address mining using Keccak256 hashing
- **Graceful Worker Cleanup**: Properly terminates workers and cleans up resources
- **Performance Benchmarking**: Logs execution time for performance analysis
- **Production-Ready Error Handling**: Try-finally blocks ensure cleanup even on errors

## Use Case

This project demonstrates a **vanity address mining** algorithm that:
- Searches for Ethereum addresses ending with a specific pattern (e.g., "d3ad")
- Uses Keccak256 hashing (via ethers.js) to generate addresses from salt values
- Distributes the search space across 5 worker threads
- Returns as soon as ANY worker finds a matching address

## Installation

```bash
# Install dependencies
yarn install
```

## Running the Application

```bash
# Development mode with hot reload
yarn start:dev

# Production mode
yarn build
yarn start:prod

# Debug mode
yarn start:debug
```

The server will start on `http://localhost:3000`

## API Endpoints

### `GET /`
Health check endpoint

**Response:**
```json
"Hello World!"
```

### `GET /heavy`
Triggers parallel salt mining computation using worker threads

**Response:**
```json
{
  "data": "ok"
}
```

**Console Output:**
```
worker 2 exit
Elapsed time: 1234 ms
```

**Behavior:**
1. Spawns 5 worker threads
2. Each searches through 500,000 salt values
3. Workers search for addresses ending with "d3ad"
4. Returns immediately when first worker finds a match
5. All workers are gracefully terminated after completion

## Project Structure

```
src/
├── main.ts              # Application entry point (bootstrap NestJS)
├── app.module.ts        # Root module
├── app.controller.ts    # HTTP endpoints (/heavy)
├── app.service.ts       # Worker thread management & Promise.race logic
└── salt.worker.ts       # Worker thread implementation (salt mining)
```

## How It Works

### Worker Thread Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Main Thread                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  spawn(msg) - Creates Worker & Promise           │  │
│  │  heavyComputation() - Spawns 5 workers           │  │
│  │  Promise.race() - Returns first result           │  │
│  │  terminate() - Cleanup all workers               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │      │      │      │      │
           ▼      ▼      ▼      ▼      ▼
      ┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
      │ W0  ││ W1  ││ W2  ││ W3  ││ W4  │  Worker Threads
      │ i=0 ││ i=1 ││ i=2 ││ i=3 ││ i=4 │  (offset distribution)
      └─────┘└─────┘└─────┘└─────┘└─────┘
```

### Salt Mining Algorithm

Each worker searches through the space using **offset-based distribution**:

```typescript
// Worker 0: checks salts 0, 5, 10, 15, 20...
// Worker 1: checks salts 1, 6, 11, 16, 21...
// Worker 2: checks salts 2, 7, 12, 17, 22...
// Worker 3: checks salts 3, 8, 13, 18, 23...
// Worker 4: checks salts 4, 9, 14, 19, 24...

for (let i = offset; i < max; i += workerNumber) {
  const hash = keccak256(contractAddress + salt + constructorHash)
  const address = hash.slice(26, 66) // Extract 20 bytes
  if (address.endsWith('d3ad')) {
    return salt  // Found!
  }
}
```

### Worker Lifecycle

```
1. Main thread spawns 5 workers
2. Each worker receives: { workerNumber: 5, offset: 0-4, max: 500000 }
3. Workers compute in parallel (searching for matching address)
4. First worker to find match sends result via parentPort.postMessage()
5. Promise.race() resolves with first result
6. Finally block executes → all workers terminated
7. Worker cleanup: removeAllListeners() + terminate()
```

## Resource Cleanup

The application uses a **try-finally pattern** to ensure workers are always cleaned up:

```typescript
try {
  result = await Promise.race(promises)
} finally {
  await this.terminate(workers)  // Always executes
}
```

This prevents resource leaks even when:
- Workers throw errors
- Promise.race() rejects
- Unexpected exceptions occur

## Development

```bash
# Run in watch mode
yarn start:dev

# Lint and fix
yarn lint

# Format code
yarn format
```

## Testing

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# Test coverage
yarn test:cov

# Watch mode
yarn test:watch
```

## Performance Considerations

### Promise.race() vs Promise.all()

**Promise.race()** (current implementation):
- ✅ Returns as soon as ONE worker finds the result
- ✅ Faster response time (avg 20-50ms computation)
- ⚠️ Cleanup overhead from terminating busy workers (50-100ms)
- **Total time**: ~70-150ms

**Promise.all()** (alternative):
- ⏳ Waits for ALL workers to complete
- ⏳ Slower response time (100-200ms computation)
- ✅ Minimal cleanup overhead (workers already idle)
- **Total time**: ~105-220ms

**Trade-off**: Promise.race() saves computation time but adds cleanup overhead. The net benefit depends on workload distribution.

### Optimization Tips

1. **Adjust worker count** based on CPU cores:
   ```typescript
   const workerNum = os.cpus().length
   ```

2. **Tune search space** (`max` parameter) based on expected difficulty

3. **Use immediate cancellation** for longer computations:
   ```typescript
   promise.then(result => {
     workers.forEach(w => w.terminate())  // Immediate cleanup
     return result
   })
   ```

## Technical Stack

- **Framework**: NestJS 11.x
- **Runtime**: Node.js (Worker Threads API)
- **Crypto**: ethers.js (Keccak256 hashing)
- **Language**: TypeScript 5.7
- **Package Manager**: Yarn

## Key Dependencies

```json
{
  "@nestjs/core": "^11.0.1",
  "ethers": "^6.15.0",
  "rxjs": "^7.8.1"
}
```

## Common Issues

### Workers not terminating
- Ensure `finally` block is present
- Check that `worker.terminate()` is called
- Verify no infinite loops in worker code

### Memory leaks
- Always call `worker.removeAllListeners()` before `terminate()`
- Use `.once()` instead of `.on()` for event listeners
- Check for closure variables holding references

### Timing inconsistencies
- Remember timing includes cleanup overhead
- Measure computation and cleanup separately for accuracy
- Worker termination time varies based on their state (idle vs busy)

## License

UNLICENSED - Private project

## Learn More

- [NestJS Documentation](https://docs.nestjs.com)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [Promise.race() MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)
- [Ethers.js Documentation](https://docs.ethers.org/)

## Support

For questions about this implementation:
1. Review the inline code comments in `app.service.ts` and `salt.worker.ts`
2. Check the [NestJS Discord](https://discord.gg/G7Qnnhy) for general NestJS questions
3. Read the [Worker Threads documentation](https://nodejs.org/api/worker_threads.html) for threading concepts
