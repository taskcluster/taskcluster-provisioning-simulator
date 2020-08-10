const {Simulator} = require('..');
const {Worker} = require('..');
const {TickTockLoadGenerator} = require('./loadgen/ticktock');
const {ManualProvisioner} = require('./prov/manual');

class SimpleSimulator extends Simulator {
  constructor({commandOptions, ...options}) {
    super(options);

    const hour = 1000 * 3600;
    this.rampUpTime = hour;
    this.runTime = 24 * hour;
    this.rampDownTime = hour;

    this.workers = commandOptions.workers;
    this.workload = commandOptions.workload;
  }

  loadGeneratorFactory() {
    // at a workload of 1, we inject 1 minute of work every minute; with higher workloads,
    // inject tasks more frequently, with longer durations.
    const sqrtWorkload = Math.sqrt(this.workload);
    const taskDuration = (60 * 1000) * sqrtWorkload;
    const taskEvery = (60 * 1000) / sqrtWorkload;

    return new TickTockLoadGenerator({
      core: this.core,
      queue: this.queue,
      taskEvery,
      taskDuration,
    });
  }

  provisionerFactory() {
    return new ManualProvisioner({
      core: this.core,
      queue: this.queue,
      capacityFn: now => this.workers,
      workerFactory: () => new Worker({
        core: this.core,
        queue: this.queue,
        startupDelay: 10000,
        idleTimeout: 60000,
      }),
    });
  }
}

module.exports = {
  setup(command) {
    command
      .description('simple simulation with a regular injection of work and a manual provisioner')
      .requiredOption(
        '--workers <count>',
        'number of workers to run',
        parseInt,
      )
      .requiredOption(
        '--workload <factor>',
        'seconds per second of work to inject',
        Number,
      );
  },
  Simulator: SimpleSimulator,
};
