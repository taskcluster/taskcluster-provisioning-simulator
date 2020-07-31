const {TickTockTaskGen} = require('../taskgen');
const {Worker} = require('../worker');
const {SimpleEstimateProvisioner} = require('../provisioner');

module.exports = (core, queue) => {
  new TickTockTaskGen({core, queue, taskEvery: 900, taskDuration: 5000});
  new SimpleEstimateProvisioner({
    core, queue,
    minCapacity: 0,
    maxCapacity: 5,
    workerFactory: () => new Worker({core, queue, startupDelay: 2000, idleTimeout: 10000}),
  });
};
