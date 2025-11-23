import { Injectable } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { join } from 'path';
import { WorkerResp } from './class/worker-message';

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
      result = await Promise.any(promises)
    } catch (error) {
      console.log('promise error', error)
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
      worker.once('message', (msg: WorkerResp) => {
        if (msg.isSuccess) {
          resolve(msg)
        } else {
          reject(msg)
        }
      })
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
    await Promise.all(
      workers.map(async (worker) => {
        worker.removeAllListeners()
        await worker.terminate()
      })
    )
  }
}
