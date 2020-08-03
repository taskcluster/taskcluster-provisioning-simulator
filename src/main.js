const chalk = require('chalk');
const {Simulator} = require('.');
const {program} = require('commander');
const {version} = require('../package.json');

program.version(version);

program
  .arguments('<simulation>')
  .action(simName => {
    const {loadGeneratorFactory, provisionerFactory} = require(`./sims/${simName}`);
    const sim = new Simulator({
      logging: true,
      loadGeneratorFactory,
      provisionerFactory,
    });

    sim.run({
      rampUpTime: 10000,
      runTime: 10000,
      rampDownTime: 10000,
    });
  });

program.parse();
