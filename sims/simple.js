const {Simulator} = require('..');
const {Worker} = require('..');
const {TickTockLoadGenerator} = require('./loadgen/ticktock');
const {SimpleEstimateProvisioner} = require('./prov/simple');

class SimpleSimulator extends Simulator {
  constructor(options) {
    super(options);

    this.rampUpTime = 10000;
    this.runTime = 10000;
    this.rampDownTime = 20000;
  }

  loadGeneratorFactory() {
    return new TickTockLoadGenerator({
      core: this.core,
      queue: this.queue,
      taskEvery: 900,
      taskDuration: 5000,
    });
  }

  provisionerFactory() {
    return new SimpleEstimateProvisioner({
      core: this.core,
      queue: this.queue,
      minCapacity: 0,
      maxCapacity: 5,
      workerFactory: () => new Worker({
        core: this.core,
        queue: this.queue,
        startupDelay: 2000,
        idleTimeout: 10000,
      }),
    });
  }
};

module.exports = SimpleSimulator;
