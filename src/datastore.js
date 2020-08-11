const assert = require('assert');

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

  /**
   * Calculate metrics with the given interval
   */
  analyze({interval, metrics, updateState, initialState}) {
    const {duration, events} = this;

    // track the current state as we see events..

    // taskId -> {createdTime, startedTime, resolvedTime, workerId}
    const pendingTasks = new Map();
    const runningTasks = new Map();
    const resolvedTasks = new Map();

    // workerId -> {
    //   capacity,
    //   utility,
    //   requestedTime,
    //   startedTime,
    //   shutdownTime,
    //   runningTasks: taskId -> {createdTime, startedTime},
    //   resolvedTasks: taskId -> {createdTime, startedTime, resolvedTime},
    // }
    const requestedWorkers = new Map();
    const runningWorkers = new Map();
    const shutdownWorkers = new Map();

    const state = {
      ...initialState,
      pendingTasks, runningTasks, resolvedTasks,
      requestedWorkers, runningWorkers, shutdownWorkers,
    };

    // move a value from one map to another and return it
    const move = (key, map1, map2) => {
      const val = map1.get(key);
      map1.delete(key);
      map2.set(key, val);
      return val;
    };

    const updateBuiltInState = ([time, name, ...rest]) => {
      switch (name) {
        case 'task-created': {
          const [taskId] = rest;
          pendingTasks.set(taskId, {createdTime: time});
          break;
        }

        case 'task-started': {
          const [taskId, workerId] = rest;

          const task = move(taskId, pendingTasks, runningTasks);
          assert(task, `task ${taskId} started, but it does not exist`);
          task.startedTime = time;
          task.workerId = workerId;

          const worker = runningWorkers.get(workerId);
          assert(worker, `task ${taskId} started on non-running worker ${task.workerId}`);
          worker.runningTasks.set(taskId, task);
          break;
        }

        case 'task-resolved': {
          const [taskId] = rest;
          const task = move(taskId, runningTasks, resolvedTasks);
          assert(task, `task ${taskId} resolved, but it is not running`);
          task.resolvedTime = time;

          const worker = runningWorkers.get(task.workerId);
          assert(worker, `task ${taskId} resolved on non-running worker ${task.workerId}`);
          move(taskId, worker.runningTasks, worker.resolvedTasks);
          break;
        }

        case 'worker-requested': {
          const [workerId, {capacity, utility}] = rest;
          requestedWorkers.set(workerId, {
            capacity,
            utility,
            requestedTime: time,
            runningTasks: new Map(),
            resolvedTasks: new Map(),
          });
          break;
        }

        case 'worker-started': {
          const [workerId] = rest;
          const worker = move(workerId, requestedWorkers, runningWorkers);
          assert(worker, `worker ${workerId} started, but it was not requested`);
          worker.startedTime = time;
          break;
        }

        case 'worker-shutdown': {
          const [workerId] = rest;
          const worker = move(workerId, runningWorkers, shutdownWorkers);
          assert(worker, `worker ${workerId} shut down, but it was not started`);
          worker.shutdownTime = time;
          break;
        }
      }
    };

    // ..and generate metrics based on that current state

    const result = [];
    const generateMetrics = time => {
      const sample = {time};
      for (let [m, fn] of Object.entries(metrics)) {
        sample[m] = fn(state);
      }
      result.push(sample);
    };

    // now loop over events, sampling at the desired time intervals

    let nextTime = 0;
    let n = this.events.length;

    for (let i = 0; i < n; i++) {
      const event = events[i];
      const when = event[0];

      // sample metrics as many times as necessary to get to this timestamp..
      while (when > nextTime) {
        generateMetrics(nextTime);
        nextTime += interval;
        if (nextTime > duration) {
          // stop sampling after duration
          nextTime = Infinity;
        }
      }

      // stop processing events after duration
      if (when > duration) {
        break;
      }

      // update status with this event
      updateBuiltInState(event);
      updateState && updateState(state, event);
    }

    return {metrics: result, state};
  }

  /**
   * Utility metrics for analyze
   */
  static pendingTasks(state) {
    return state.pendingTasks.size;
  }

  static runningTasks(state) {
    return state.runningTasks.size;
  }

  static resolvedTasks(state) {
    return state.resolvedTasks.size;
  }

  static requestedWorkers(state) {
    return state.requestedWorkers.size;
  }

  static runningWorkers(state) {
    return state.runningWorkers.size;
  }

  static shutdownWorkers(state) {
    return state.shutdownWorkers.size;
  }
}

module.exports = {DataStore};
