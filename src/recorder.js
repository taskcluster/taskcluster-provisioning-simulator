const { DataStore } = require('./datastore');

/**
 * A recorder records the progress of a simulation and can produce a
 * DataStore at the end.
 */
class Recorder {
  constructor(simulator) {
    this.simulator = simulator;
    this.core = simulator.core;

    this.events = [];
    this.startTime = null;
    this.stopTime = null;

    this.setup();
  }

  /**
   * Set up to record all events for tasks and workers
   */
  setup() {
    const evt = name => (...args) => {
      this.events.push([this.core.now(), name, ...args]);
    };

    this.simulator.queue.on('created', evt('task-created'));
    this.simulator.queue.on('started', evt('task-started'));
    this.simulator.queue.on('resolved', evt('task-resolved'));

    this.simulator.provisioner.on('requested', evt('worker-requested'));
    this.simulator.provisioner.on('started', evt('worker-started'));
    this.simulator.provisioner.on('shutdown', evt('worker-shutdown'));
  }

  /**
   * Start the actual simulation (after the ramp-up period)
   */
  start() {
    this.startTime = this.core.now();
  }

  /**
   * Stop the simulation (and begin ramping down)
   */
  stop() {
    this.stopTime = this.core.now();
  }

  /**
   * Generate a DataStore for this run.
   *
   * This processes the events to:
   *  - shift the beginning of the simulation to timestamp 0
   *  - drop tasks and workers that existed only in the ramp-up
   *    or ramp-down periods
   */
  dataStore() {
    return DataStore.fromRecorder(this);
  }
}

module.exports = {Recorder};
