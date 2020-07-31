const {Core} = require('./core');
const {Queue} = require('./queue');

class Simulator {
  constructor({logging, loadGeneratorFactory, provisionerFactory} = {}) {
    const core = new Core({logging});
    const queue = new Queue({core});

    this.loadGenerator = loadGeneratorFactory(core, queue);
    this.provisioner = provisionerFactory(core, queue);

    this.core = core;
    this.queue = queue;
  }

  run({rampUpTime, runTime, rampDownTime}) {
    // until we actually collect metrics, the three time segments look the same..
    this.core.log('ramping up');
    this.core.run(rampUpTime);
    this.core.log('running simulation');
    this.core.run(runTime);
    this.core.log('ramping down');
    this.loadGenerator.stop();
    this.core.run(rampDownTime);
  }
}

exports.Simulator = Simulator;
