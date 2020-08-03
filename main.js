const chalk = require('chalk');
const {program} = require('commander');
const {version} = require('./package.json');

program.version(version);

program
  .option('-q, --quiet', 'silence logging')
  .arguments('<simulation>')
  .action((simName, options) => {
    const Simulator = require(`./sims/${simName}`);
    const sim = new Simulator({
      logging: !options.quiet,
    });

    sim.run();
  });

program.parse();
