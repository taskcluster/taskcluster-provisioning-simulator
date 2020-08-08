const commander = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const {version} = require('./package.json');

const sim = new commander.Command('sim')
  .description('run a simulation')
  .option('-o, --output <datastore>', 'write the datastore to <datastore> (default `datastore.json`)')
  .option('-q, --quiet', 'silence logging');

fs.readdirSync(`${__dirname}/sims`).forEach(file => {
  const m = file.match(/^(.*)\.js/);
  if (m) {
    const [_, name] = m;
    const {Simulator, setup} = require(`./sims/${name}`);
    const subcommand = new commander.Command(name);
    setup(subcommand);
    subcommand.action((...args) => {
      const simOptions = sim.opts();

      const simulator = new Simulator({
        logging: !simOptions.quiet,
        commandArgs: args.slice(0, args.length - 1),
        commandOptions: subcommand.opts(),
      });

      console.log(chalk`{red ➤} {bold Running Simulation}`);
      simulator.run();

      const filename = simOptions.output || 'datastore.json';
      console.log(chalk`{red ➤} {bold Writing result to ${filename}}`);
      const ds = simulator.dataStore();
      fs.writeFileSync(filename, JSON.stringify(ds.asSerializable()));
    });
    sim.addCommand(subcommand);
  }
});

const program = new commander.Command()
  .version(version)
  .addCommand(sim);

program.parse();
