/**
 * A data store records the main part of a simulation run as a sequence of
 * events, including events from the ramp-up and ramp-down periods as context.
 * These events are available in `ds.events`.
 *
 * The events are
 *   [timestamp, 'task-created', taskId]
 *   [timestamp, 'task-started', taskId, workerId]
 *   [timestamp, 'task-resolved', taskId]
 *   [timestamp, 'worker-requested', workerId]
 *   [timestamp, 'worker-started', workerId]
 *   [timestamp, 'worker-shutdown', workerId]
 *
 * The simulation always begins at time 0, and its duration is given by
 * `ds.duration`.  The events from the ramp-up period will have negative
 * timestamps, and events from the ramp-down period will have timestamps
 * greater than `ds.duration`.
 */
class DataStore {
  /**
   * Construct a data store from a Recorder, applying normalizations
   */
  static fromRecorder({events, startTime, stopTime}) {
    const ignoreWorkers = new Set();
    const ignoreTasks = new Set();

    for (let [time, name, id] of events) {
      if (time < startTime) {
        switch (name) {
          case 'task-resolved':
            ignoreTasks.add(id);
            break;
          case 'worker-shutdown':
            ignoreWorkers.add(id);
            break;
        }
      } else if (time > stopTime) {
        switch (name) {
          case 'task-created':
            ignoreTasks.add(id);
            break;
          case 'worker-requested':
            ignoreWorkers.add(id);
            break;
        }
      }
    }

    const ds = new DataStore();
    ds.duration = stopTime - startTime;
    ds.events = events
      .filter(([_, name, id]) =>
        !((name.startsWith('task-') && ignoreTasks.has(id)) ||
        (name.startsWith('worker-') && ignoreWorkers.has(id))))
      .map(([t, ...rest]) => ([t - startTime, ...rest]));

    return ds;
  }

  /**
   * Convert to a JSON-serializable format
   */
  asSerializable() {
    return {
      duration: this.duration,
      events: this.events,
    };
  }

  /**
   * Create from a JSON serializable format.
   */
  static fromSerializable(ser) {
    return Object.assign(new DataStore(), ser);
  }
}

module.exports = {DataStore};
