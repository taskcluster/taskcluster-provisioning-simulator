const assert = require('assert');
const {Core} = require('./core');
const {Queue} = require('./queue');

class Simulator {
  constructor({logging} = {}) {
    const core = new Core({logging});
    const queue = new Queue({core});

    this.core = core;
    this.queue = queue;

    this.loadGenerator = this.loadGeneratorFactory();
    this.provisioner = this.provisionerFactory();
  }

  run() {
    assert.notEqual(this.rampUpTime, undefined);
    assert.notEqual(this.runTime, undefined);
    assert.notEqual(this.rampDownTime, undefined);

    this.core.log('ramping up');
    this.core.run(this.rampUpTime);

    this.core.log('running simulation');
    this.core.run(this.runTime);

    this.core.log('ramping down');
    this.loadGenerator.stop();
    this.core.run(this.rampDownTime);
    this.provisioner.stop();
  }
}

exports.Simulator = Simulator;
