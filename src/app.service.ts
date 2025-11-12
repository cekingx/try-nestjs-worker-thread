import { Injectable } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { join } from 'path';

export class Message {
  workerNumber: number;
  offset: number;
  max: number;
}

export class SpawnWorker {
  worker: Worker;
  promise: Promise<any>
}

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async heavyComputation() {
    const start = Date.now()
    const workerNum = 5;
    let workers: Worker[] = []
    let promises: Promise<any>[] = []
    let result: any = undefined
    try {
      for (let i = 0; i < workerNum; i++) {
        const { worker, promise } = this.spawn({
          workerNumber: workerNum,
          offset: i,
          max: 500_000
        })
        workers.push(worker)
        promises.push(promise)
      }
      result = await Promise.race(promises)
    } finally {
      await this.terminate(workers)
    }
    const end = Date.now()
    console.log(`Elapsed time: ${end - start} ms`)
    return result
  }

  spawn(msg: Message): SpawnWorker {
    const worker = new Worker(join(process.cwd(), 'dist', 'salt.worker.js'))
    const promise =  new Promise((resolve, reject) => {
      worker.once('message', resolve)
      worker.once('error', reject)
      worker.once('exit', (code) => {
        console.log(`worker ${msg.offset} exit`)
        if (code != 0) {
          reject(new Error(`Worker stopped with exitcode ${code}`))
        }
      })

      worker.postMessage(msg)
    })

    return { worker, promise }
  }

  async terminate(workers: Worker[]) {
    for (const worker of workers) {
      worker.removeAllListeners()
      await worker.terminate()
    }
  }
}
