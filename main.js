const chalk = require('chalk');
const {program} = require('commander');
const {version} = require('./package.json');
const fs = require('fs');

program.version(version);

program
  .option('-q, --quiet', 'silence logging')
  .option('-o, --output <output>', 'datastore ouptut')
  .arguments('<simulation>')
  .action((simName, options) => {
    const Simulator = require(`./sims/${simName}`);
    const sim = new Simulator({
      logging: !options.quiet,
    });

    sim.run();
    if (options.output) {
      const ds = sim.dataStore();
      fs.writeFileSync(options.output, JSON.stringify(ds.asSerializable()));
    }
  });

program.parse();
