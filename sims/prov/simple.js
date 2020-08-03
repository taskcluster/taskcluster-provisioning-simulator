const {Provisioner} = require('../..');

/**
 * SimpleEstimateProvider duplicates the behavior of the current (as of 36.0.0) worker-manager
 * provisioning algorithm.
 *
 * Constructor args:
 * - core
 * - queue
 * - minCapacity -- minimum running/requested capacity at any time
 * - maxCapacity -- will not create more than this number
 * - workerFactory -- a callable that will create a new worker
 */
class SimpleEstimateProvisioner extends Provisioner {
  constructor({core, queue, minCapacity, maxCapacity, workerFactory}) {
    super({core});
    this.queue = queue;
    this.minCapacity = minCapacity;
    this.maxCapacity = maxCapacity;
    this.workerFactory = workerFactory;

    this.requestedWorkers = new Map();
    this.runningWorkers = new Map();

    this.core.setInterval(() => this.loop(), 1000);
  }

  // taken directly from worker-manager, omitting logging and monitoring stuff
  simple({minCapacity, maxCapacity, workerInfo}) {
    const pendingTasks = this.queue.pendingTasks();
    const {existingCapacity, requestedCapacity = 0} = workerInfo;

    // First we find the amount of capacity we want. This is a very simple approximation
    // We add existingCapacity here to make the min/max stuff work and then remove it to
    // decide how much more to request. In other words, we will ask to spawn
    // enough capacity to cover all pending tasks at any time unless it would
    // create more than maxCapacity instances
    const desiredCapacity = Math.max(minCapacity, Math.min(pendingTasks + existingCapacity, maxCapacity));

    // Workers turn themselves off so we just return a positive number for
    // how many extra we want if we do want any
    const toSpawn = Math.max(0, desiredCapacity - existingCapacity);

    // subtract the instances that are starting up from that number to spawn
    // if the value is <= 0, than we don't need to spawn any new instance
    return Math.max(toSpawn - requestedCapacity, 0);
  }

  loop() {
    const workerInfo = {
      existingCapacity: this.runningWorkers.size,
      requestedCapacity: this.requestedWorkers.size,
    };

    let toSpawn = this.simple({
      minCapacity: this.minCapacity,
      maxCapacity: this.maxCapacity,
      workerInfo,
    });

    while (toSpawn > 0) {
      toSpawn--;

      const worker = this.workerFactory();
      this.registerWorker(worker);
      this.requestedWorkers.set(worker.name, worker);
      worker.once('started', () => {
        this.requestedWorkers.delete(worker.name);
        this.runningWorkers.set(worker.name, worker);
      });
      worker.once('shutdown', () => {
        this.runningWorkers.delete(worker.name);
      });
    }
  }
}

exports.SimpleEstimateProvisioner = SimpleEstimateProvisioner;
