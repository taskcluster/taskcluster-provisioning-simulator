const chalk = require('chalk');
const {Core} = require('./core');
const {Queue} = require('./queue');
const {program} = require('commander');
const {version} = require('../package.json');
require('./sims/simple');

program.version(version);

program
  .arguments('<simulator>')
  .action(simName => {
    const core = new Core({logging: true});
    const queue = new Queue({core});

    const simulator = require(`./sims/${simName}`);
    simulator(core, queue);

    core.run(100000);
  });

program.parse();
