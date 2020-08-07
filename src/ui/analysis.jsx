import React from 'react';
import moment from 'moment';
import DataStoreContext from './datastore';

/**
 * A singleton class for calculating analysis of a run.
 *
 * This is full of `get` methods, which use React hooks to ensure that long calculations are
 * re-done only when necessary.  All of these functions should only be called within a
 * render function.
 *
 * When writing new functions, follow the pattern of destructuring `this` to get any
 * other analyses, then performing additional analysis inside of `useMemo`, including
 * all of the consumed values in the second argument to `useMemo`.
 */
class Analysis {
  /**
   * Get the DataStore object itself
   */
  get datastore() {
    return React.useContext(DataStoreContext);
  }

  /**
   * Get the completed analysis from the DataStore object, with the given
   * options.
   */
  analyze(options) {
    const {datastore} = this;
    return React.useMemo(
      () => datastore.analyze(options),
      [datastore, options]);
  }

  /**
   * Get the final state from datastore.analyze
   */
  get finalState() {
    const {state} = this.analyze({interval: Infinity, metrics: {}});
    return state;
  }

  get overProvisionedWorkers() {
    const {finalState} = this;
    return React.useMemo(
      () => {
        let count = 0;
        
        // we only need to look at workers that have shut down, as running
        // workers may still yet take a task; and only look at resolved tasks
        // as a task cannot be running on a shut-down worker.
        for (let {resolvedTasks} of finalState.shutdownWorkers.values()) {
          console.log(resolvedTasks.size);
          if (resolvedTasks.size === 0) {
            count++;
          }
        }

        return count;
      },
      [finalState]);
  }

  /**
   * Collect all of the summary statistics, in the form {title, description, value}
   */
  get summaryStatistics() {
    const {datastore, overProvisionedWorkers} = this;
    const statistics = [];

    statistics.push({
      title: 'Number of Events',
      description: 'Total number of simulation events during the simulation phase, including contextual events.',
      value: datastore.events.length,
      display: value => `${value}`,
    });

    statistics.push({
      title: 'Simulation Duration',
      description: 'Total duration of the simulation phase.',
      value: datastore.duration,
      display: value => moment.duration(value).humanize({minutes: 120, hours: 48}),
    });

    statistics.push({
      title: 'Overprovisioned Workers',
      description: 'Number of workers that started up, did no work, and shut down again.',
      value: overProvisionedWorkers,
      display: value => `${value} workers`,
    });

    return statistics;
  }
}

export default new Analysis();
