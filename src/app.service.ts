import { Injectable } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { join } from 'path';

export class Message {
  workerNumber: number;
  offset: number;
  max: number;
}

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async heavyComputation() {
    const start = Date.now()
    const workerNum = 5;
    const workers: any[] = []
    for (let i = 0; i < workerNum; i++) {
      workers.push(this.spawn({
        workerNumber: workerNum,
        offset: i,
        max: 500_000
      }))
    }
    const result = await Promise.all(workers)
    const end = Date.now()
    console.log(`Elapsed time: ${end - start} ms`)
    return result
  }

  async spawn(msg: Message): Promise<number | Error> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(join(process.cwd(), 'dist', 'salt.worker.js'))

      worker.on('message', resolve)
      worker.on('error', reject)
      worker.on('exit', (code) => {
        if (code != 0) {
          reject(new Error(`Worker stopped with exitcode ${code}`))
        }
      })

      worker.postMessage(msg)
    })
  }
}
