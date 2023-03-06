const {Simulator} = require('..');
const {Worker} = require('..');
const {FirefoxCILoadGenerator} = require('./loadgen/firefox-ci');
const {SimpleEstimateProvisioner} = require('./prov/simple');

class FirefoxSimulator extends Simulator {
  constructor({commandOptions, ...options}) {
    super(options);

    this.workerPoolId = commandOptions.workerPoolId || 'gecko-t/t-linux-large';

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
    return new SimpleEstimateProvisioner({
      core: this.core,
      queue: this.queue,
      minCapacity: 0,
      maxCapacity: 1000,
      scalingRatio: 1.0,
      workerFactory: () => new Worker({
        core: this.core,
        queue: this.queue,
        startupDelay: 20000,
        idleTimeout: 1000 * 60 * 15,
        stoppingDelay: 200000,
      }),
    });
  }
}

module.exports = {
  setup(command) {
    command
      .description('simulation based on real Firefox-CI load and "simple estimate" provisioner')
      .option(
        '-w, --worker-pool-id <wpid>',
        'worker-pool to simulate (see options in sims/loadgen/firefox-ci)',
      );
  },
  Simulator: FirefoxSimulator,
};
