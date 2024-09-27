const assert = require("assert");
const { Component } = require("./component");

let NEXT_WORKER = 10000;

/**
 * A worker claims work.  Workers have `.name`, the worker name.
 *
 * Workers emit:
 * - 'started' -- when they have started up and are about to start claiming
 * - 'shutdown' -- when they shut down due to being idle
 */
class Worker extends Component {
  constructor({
    core,
    queue,
    name,
    startupDelay,
    interTaskDelay = 0,
    shutdownDelay = 0,
    idleTimeout,
    capacity = 1,
    utility = 1,
    failureRate = 0,
  }) {
    super({ core, name: name || `w-${NEXT_WORKER++}` });
    this.queue = queue;
    this.startupDelay = startupDelay;
    this.interTaskDelay = interTaskDelay;
    this.idleTimeout = idleTimeout;
    this.shutdownDelay = shutdownDelay;
    this.capacity = capacity;
    this.utility = utility;
    // add some randomness to the failure rate where workers start but fail to claim tasks
    this.failToClaimTasks = failureRate > Math.random();

    this.workerRunning = true;

    this.runningTasks = [];

    this.idleTimeout = idleTimeout;
    this.idleTimeoutId = null;

    this.loop = this.loop.bind(this, this.loop);
    this.core.setTimeout(() => this.start(), startupDelay);

    this.log('requested');
  }

  start() {
    this.emit('started');
    this.log('started');
    this.idleSince = this.core.now();
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

    if (this.failToClaimTasks) {
      // just wait to be shut down
      this.startIdleTimeout();
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

    if (this.runningTasks.length !== this.capacity) {
      this.queue.onPending(this.loop);
    }
  }

  startTask(task) {
    // duration scales inversely to utility -- a worker with utility = 2 will finish
    // tasks twice as quickly as "normal"
    const taskDuration = task.payload.duration / this.utility;
    this.core.setTimeout(() => {
      this.finishTask(task);
    }, taskDuration);
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
      assert(idx > -1, `worker ${this.name} could not resolve task ${task.taskId}`);
      this.runningTasks.splice(idx, 1);
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
    this.workerRunning = false;
    this.log('stopping');
    this.emit('stopping');
    this.core.setTimeout(() => {
      this.log('shutdown');
      this.emit('shutdown');
    }, this.shutdownDelay);
  }
}

exports.Worker = Worker;
