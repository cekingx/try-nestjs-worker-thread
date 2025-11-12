import { parentPort } from "worker_threads";
import { Message } from './app.service'
import { ethers } from "ethers";

if (parentPort) {
  parentPort.on('message', (data: Message) => {
    for(let i = data.offset; i < data.max; i += data.workerNumber) {
      let hash = ethers.keccak256(
        ethers.concat([
          '0xff',
          '0xD9885e86fc2ce715D6Bd63E34e73bae13c328EA3',
          ethers.zeroPadValue(ethers.toBeHex(i), 32),
          '0xf758a73f4b555b68e0615db1367203ef789c977e4b40c411e8e55150beceb363'
        ])
      );

      const address = '0x' + hash.slice(-40);
      if (address.toLowerCase().endsWith('d3ad')) {
        console.log(`✓ Found salt: ${i}`);
        console.log(`✓ Address: ${address}`);
        parentPort?.postMessage({ salt: i })
      }
    }
    console.log(`doing ${data.max / data.workerNumber} loop from offset ${data.offset}`)
    parentPort?.postMessage(new Error('Not Found'))
  })
}
