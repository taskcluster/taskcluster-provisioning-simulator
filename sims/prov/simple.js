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
  constructor({
    core,
    queue,
    minCapacity,
    maxCapacity,
    scalingRatio,
    workerFactory,
  }) {
    super({ core });
    this.queue = queue;
    this.minCapacity = minCapacity;
    this.maxCapacity = maxCapacity;
    this.scalingRatio = scalingRatio;
    this.workerFactory = workerFactory;

    this.requestedWorkers = new Map();
    this.runningWorkers = new Map();
    this.stoppingWorkers = new Map();
  }

  start() {
    this.core.setInterval(() => this.loop(), 1000);
  }

  // taken directly from worker-manager, omitting logging and monitoring stuff
  simple({
    workerPoolId,
    minCapacity,
    maxCapacity,
    scalingRatio = 1,
    workerInfo: {
      existingCapacity,
      stoppingCapacity = 0,
      requestedCapacity = 0,
    },
  }) {
    const pendingTasks = this.queue.pendingTasks(workerPoolId);
    const claimedTasks = this.queue.claimedTasks(workerPoolId);

    // find out how many of the existing capacity are idle
    const totalIdleCapacity = existingCapacity - claimedTasks;

    // we assume that idle workers are going to pick up tasks soon
    const adjustedPendingTasks = Math.max(0, pendingTasks - totalIdleCapacity);

    // Due to the fact that workers could fail to start on azure, deprovisioning will take significant amount of time
    // and on the next provision loop, those workers wouldn't be considered as requested or existing capacity
    // so worker manager would try to provision for this pool again
    // workers in stopping state would keep growing, and deprovisioning takes many calls, even though it wasn't created
    // to avoid this situation we would take into account stopping capacity and don't allow worker pool
    // to have existing + stopping capacity > max capacity to prevent affected pool start extra instances
    const totalNonStopped = existingCapacity + stoppingCapacity;

    // First we find the amount of capacity we want. This is a very simple approximation
    // We add totalNonStopped here to represent existing workers and subtract it later.
    // We scale up based on the scaling ratio and number of pending tasks.
    // We ask to spawn as much capacity as the scaling ratio dictates to cover all
    // pending tasks at any time unless it would create more than maxCapacity instances
    const desiredCapacity = Math.max(
      minCapacity,
      // only scale as high as maxCapacity
      Math.min(
        adjustedPendingTasks * scalingRatio + totalNonStopped,
        maxCapacity,
      ),
    );

    // Workers turn themselves off so we just return a positive number for
    // how many extra we want if we do want any
    const toSpawn = Math.max(0, desiredCapacity - totalNonStopped);

    // subtract the instances that are starting up from that number to spawn
    // if the value is <= 0, than we don't need to spawn any new instance
    return Math.max(toSpawn - requestedCapacity, 0);
  }

  loop() {
    const workerInfo = {
      existingCapacity: this.runningWorkers.size,
      requestedCapacity: this.requestedWorkers.size,
      stoppingCapacity: this.stoppingWorkers.size,
    };

    let toSpawn = this.simple({
      minCapacity: this.minCapacity,
      maxCapacity: this.maxCapacity,
      scalingRatio: this.scalingRatio,
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
      worker.once('stopping', () => {
        this.stoppingWorkers.set(worker.name, worker);
        this.runningWorkers.delete(worker.name);
      });
      worker.once('shutdown', () => {
        this.stoppingWorkers.delete(worker.name);
      });
    }
  }
}

exports.SimpleEstimateProvisioner = SimpleEstimateProvisioner;
