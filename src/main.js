const {Core} = require('./core');
const {TickTockTaskGen} = require('./taskgen');
const {Queue} = require('./queue');
const {Worker} = require('./worker');
const {SimpleEstimateProvisioner} = require('./provisioner');

const main = () => {
  const core = new Core({logging: true});

  const queue = new Queue({core});
  new TickTockTaskGen({core, queue, taskEvery: 900, taskDuration: 5000});
  new SimpleEstimateProvisioner({
    core, queue,
    minCapacity: 0,
    maxCapacity: 5,
    workerFactory: () => new Worker({core, queue, startupDelay: 2000, idleTimeout: 10000}),
  });

  core.run(100000);
};

main();
