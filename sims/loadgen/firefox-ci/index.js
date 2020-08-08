const fs = require('fs');
const path = require('path');
const {LoadGenerator} = require('../../..');
const slugid = require('slugid');

class FirefoxCILoadGenerator extends LoadGenerator {
  constructor({core, queue, workerPoolId}) {
    super({core, queue});

    this.fd = fs.openSync(path.join(__dirname, workerPoolId.replace('/', '-') + '.dat'));
    this.timeout = null;
  }

  start() {
    this.scheduleNextTask();
  }

  scheduleNextTask() {
    const b = Buffer.alloc(8);
    const bytesRead = fs.readSync(this.fd, b, {length: 8});
    if (!bytesRead) {
      this.log('no more tasks');
      return;
    }

    const time = b.readUInt32BE(0);
    const duration = b.readUInt32BE(4);

    this.timeout = this.core.setTimeout(() => {
      const taskId = slugid.v4();
      this.log(`creating task ${taskId}`);
      this.queue.createTask(taskId, {duration});
      this.scheduleNextTask();
    }, time - this.core.now());
  }

  stop() {
    this.core.clearTimeout(this.timeout);
  }
}

exports.FirefoxCILoadGenerator = FirefoxCILoadGenerator;
