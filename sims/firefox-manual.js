const {Simulator} = require('..');
const {Worker} = require('..');
const {FirefoxCILoadGenerator} = require('./loadgen/firefox-ci');
const {ManualProvisioner} = require('./prov/manual');

class FirefoxSimulator extends Simulator {
  constructor({commandOptions, ...options}) {
    super(options);

    this.workerPoolId = commandOptions.workerPoolId || 'gecko-t/t-linux-large';
    this.manualCapacity = commandOptions.manualCapacity || 10;

    const day = 1000 * 24 * 3600;
    this.rampUpTime = 1 * day;
    this.runTime = 5 * day;
    this.rampDownTime = 1 * day;
  }

  loadGeneratorFactory() {
    return new FirefoxCILoadGenerator({
      core: this.core,
      queue: this.queue,
      workerPoolId: this.workerPoolId,
    });
  }

  provisionerFactory() {
    return new ManualProvisioner({
      core: this.core,
      queue: this.queue,
      capacityFn: () => this.manualCapacity,
      workerFactory: () => new Worker({
        core: this.core,
        queue: this.queue,
        startupDelay: 20000,
        idleTimeout: 1000 * 60 * 15,
      }),
    });
  }
}

module.exports = {
  setup(command) {
    command
      .description('simulation based on real Firefox-CI load and "manual" provisioner')
      .option(
        '-w, --worker-pool-id <wpid>',
        'worker-pool to simulate (see options in sims/loadgen/firefox-ci)',
      )
      .option(
        '--manual-capacity <cap>',
        'Maintain this much worker capacity at all times',
        parseInt,
      );
  },
  Simulator: FirefoxSimulator,
};
