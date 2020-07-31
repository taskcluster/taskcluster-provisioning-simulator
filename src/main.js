const {Core} = require('./core');
const {TaskGen} = require('./taskgen');
const {Worker} = require('./worker');
const {Queue} = require('./queue');

const main = () => {
  const core = new Core({logging: true});

  const queue = new Queue({core});
  const worker = new Worker({core, queue, name: 'worker-1'});
  const taskgen = new TaskGen({core, queue, taskEvery: 1000, taskDuration: 5000});

  core.run(10000);
};

main();
