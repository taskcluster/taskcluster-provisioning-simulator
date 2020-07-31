const {TickTockLoadGenerator} = require('../loadgen');
const {Worker} = require('../worker');
const {SimpleEstimateProvisioner} = require('../provisioner');

module.exports = {
  loadGeneratorFactory(core, queue) {
    return new TickTockLoadGenerator({core, queue, taskEvery: 900, taskDuration: 5000});
  },

  provisionerFactory(core, queue) {
    return new SimpleEstimateProvisioner({
      core, queue,
      minCapacity: 0,
      maxCapacity: 5,
      workerFactory: () => new Worker({core, queue, startupDelay: 2000, idleTimeout: 10000}),
    });
  }
};
