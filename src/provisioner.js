const assert = require('assert');
const {Component} = require('./component');

class Provisioner extends Component {
  constructor({core}) {
    super({core});

    // tracks the current set of running workers
    this.workers = new Map();
  }

  registerWorker(worker) {
    const name = worker.name;
    this.workers.set(name, worker);
    worker.once('shutdown', () => {
      this.workers.delete(name);
    });
  }

  stop() {
    // check that all workers have stopped
    const runningWorkers = [...this.workers.keys()];
    assert.deepEqual(runningWorkers, []);
  }
}

exports.Provisioner = Provisioner;
