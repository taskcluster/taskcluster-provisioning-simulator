const chalk = require('chalk');
const {program} = require('commander');
const {version} = require('./package.json');

program.version(version);

program
  .arguments('<simulation>')
  .action(simName => {
    const Simulator = require(`./sims/${simName}`);
    const sim = new Simulator({
      logging: true,
    });

    sim.run();
  });

program.parse();
