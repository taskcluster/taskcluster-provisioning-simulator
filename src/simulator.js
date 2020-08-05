const assert = require('assert');
const {Core} = require('./core');
const {Queue} = require('./queue');
const {Recorder} = require('./recorder');

class Simulator {
  constructor({logging} = {}) {
    const core = new Core({logging});
    const queue = new Queue({core});

    this.core = core;
    this.queue = queue;

    this.loadGenerator = this.loadGeneratorFactory();
    this.provisioner = this.provisionerFactory();

    this.recorder = new Recorder(this);
  }

  run() {
    assert.notEqual(this.rampUpTime, undefined);
    assert.notEqual(this.runTime, undefined);
    assert.notEqual(this.rampDownTime, undefined);

    this.core.log('ramping up');
    this.loadGenerator.start();
    this.provisioner.start();
    this.core.run(this.rampUpTime);

    this.core.log('running simulation');
    this.recorder.start();
    this.core.run(this.runTime);

    this.core.log('ramping down');
    this.recorder.stop();
    this.loadGenerator.stop();
    this.core.run(this.rampDownTime);
    this.provisioner.stop();
    this.queue.stop();
  }

  dataStore() {
    return this.recorder.dataStore();
  }
}

exports.Simulator = Simulator;
