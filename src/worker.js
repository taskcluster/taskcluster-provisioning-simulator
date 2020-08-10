const assert = require('assert');
const crypto = require('crypto');
const {Component} = require('./component');

/**
 * A worker claims work.  Workers have `.name`, the worker name.
 *
 * Workers emit:
 * - 'started' -- when they have started up and are about to start claiming
 * - 'shutdown' -- when they shut down due to being idle
 */
class Worker extends Component {
  constructor({core, queue, name, startupDelay, interTaskDelay = 0, idleTimeout, capacity = 1, utility = 1}) {
    super({core, name: name || `w-${crypto.randomBytes(8).toString('hex')}`});
    this.queue = queue;
    this.startupDelay = startupDelay;
    this.interTaskDelay = interTaskDelay;
    this.idleTimeout = idleTimeout;
    this.capacity = capacity;
    this.utility = utility;
    assert.equal(utility, 1, 'wait for #3322');

    this.workerRunning = true;

    this.runningTasks = [];

    this.idleTimeout = idleTimeout;
    this.idleTimeoutId = null;
    this.idleSince = core.now();

    this.loop = this.loop.bind(this, this.loop);
    this.core.setTimeout(() => this.start(), startupDelay);
  }

  start() {
    this.emit('started');
    this.queue.on('created', () => this.core.nextTick(this.loop));
    this.core.nextTick(this.loop);
  }

  /**
   * Try to claim work or, if idle for long enough, shut down, and in any
   * case set up to call loop again as necessary
   */
  loop() {
    if (!this.workerRunning) {
      return;
    }

    if (this.runningTasks.length === this.capacity) {
      return;
    }

    if (this.core.now() - this.idleSince >= this.idleTimeout) {
      this.shutdown();
      return;
    }

    // number of tasks to request from queue
    const toClaim = Math.max(0, this.capacity - this.runningTasks.length);
    const tasks = this.queue.claimWork(this.name, toClaim);
    if (tasks.length > 0) {
      tasks.forEach(task => {
        this.log(`claimed ${task.taskId}`);
        this.runningTasks.push(task);
        this.stopIdleTimeout();
        this.startTask(task);
      });
    } else if (!this.idleTimeoutId) {
      this.startIdleTimeout();
    }
  }

  startTask(task) {
    this.core.setTimeout(() => {
      this.finishTask(task);
    }, task.payload.duration);
  }

  finishTask(task) {
    if (!this.workerRunning) {
      return;
    }

    this.log(`finished ${task.taskId}`);
    this.queue.resolveTask(task.taskId);
    // wait for `interTaskDelay` to actually consider this worker idle..
    this.core.setTimeout(() => {
      const idx = this.runningTasks.indexOf(task);
      if (idx > -1) {
        this.runningTasks.splice(idx, 1);
      } else {
        throw new Error(`worker ${this.name} could not resolve task ${task.taskId}`);
      }
      // go idle if this was the last running task
      if (this.runningTasks.length === 0) {
        this.idleSince = this.core.now();
      }
      this.core.nextTick(this.loop);
    }, this.interTaskDelay);
  }

  startIdleTimeout() {
    if (this.idleTimeout) {
      this.idleTimeoutId = this.core.setTimeout(this.loop, this.idleTimeout);
    }
  }

  stopIdleTimeout() {
    if (this.idleTimeoutId) {
      this.core.clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
  }

  shutdown() {
    this.log('shutting down');
    this.workerRunning = false;
    this.queue.removeListener('started', this.loop);
    this.emit('shutdown');
  }
}

exports.Worker = Worker;
