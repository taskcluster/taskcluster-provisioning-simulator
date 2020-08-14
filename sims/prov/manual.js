const {Provisioner} = require('../..');

/**
 * ManualProvider duplicates the behavior of the current (as of 36.0.0) worker-manager
 * provisioning algorithm.
 *
 * Constructor args:
 * - core
 * - queue
 * - capacityFn -- a callable given the current time that returns the number of workers that should exist.
 * - workerFactory -- a callable that will create a new worker
 */
class ManualProvisioner extends Provisioner {
  constructor({core, queue, capacityFn, workerFactory}) {
    super({core});
    this.queue = queue;
    this.capacityFn = capacityFn;
    this.workerFactory = workerFactory;

    this.requestedWorkers = new Map();
    this.runningWorkers = new Map();
  }

  start() {
    this.core.setInterval(() => this.loop(), 10000);
  }

  stop() {
    // don't check for extra, idle workers, as we expect to find them!
  }

  loop() {
    const desiredCapacity = this.capacityFn(this.core.now());
    const totalCurrentCapacity = this.runningWorkers.size + this.requestedWorkers.size;

    let toSpawn = Math.max(0, desiredCapacity - totalCurrentCapacity);

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

exports.ManualProvisioner = ManualProvisioner;
