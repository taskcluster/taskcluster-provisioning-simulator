import React from 'react';
import formatDistance from 'date-fns/formatDistance';
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

  get _overProvisioning() {
    const {finalState} = this;
    return React.useMemo(
      () => {
        let count = 0;
        let time = 0;

        // we only need to look at workers that have shut down, as running
        // workers may still yet take a task; and only look at resolved tasks
        // as a task cannot be running on a shut-down worker.
        for (let {startedTime, shutdownTime, resolvedTasks} of finalState.shutdownWorkers.values()) {
          if (resolvedTasks.size === 0) {
            count++;
            time += shutdownTime - startedTime;
          }
        }

        return {count, time};
      },
      [finalState]);
  }

  get overProvisionedWorkers() {
    const {_overProvisioning: overProvisioning} = this;
    return overProvisioning.count;
  }

  get overProvisionedTime() {
    const {_overProvisioning: overProvisioning} = this;
    return overProvisioning.time;
  }

  get waitTimeStats() {
    const {state} = this.analyze({interval: Infinity, metrics: {}});

    const makeStats = sequence => {
      sequence.sort((a, b) => a - b);
      const min = sequence[0];
      const max = sequence[sequence.length - 1];

      const sum = sequence.reduce((a, b) => a + b, 0);
      const mean = sum / sequence.length;
      const median = (sequence.length % 2) === 1 ?
        sequence[Math.floor(sequence.length / 2)] :
        (sequence[sequence.length / 2 - 1] + sequence[sequence.length / 2]) / 2;

      return {min, max, mean, median}; // no mode, sorry
    };

    const {
      min: minWaitTime,
      max: maxWaitTime,
      mean: meanWaitTime,
      median: medianWaitTime,
    } = makeStats([...state.resolvedTasks.values()].map(({createdTime, startedTime}) => startedTime - createdTime));

    return {minWaitTime, maxWaitTime, meanWaitTime, medianWaitTime};
  }

  /**
   * Collect all of the summary statistics, in the form {title, description, value}
   */
  get summaryStatistics() {
    const {
      datastore,
      overProvisionedWorkers,
      overProvisionedTime,
      waitTimeStats,
    } = this;
    const statistics = [];

    const msToHuman = value => {
      if (value === 0) {
        return 'none';
      } else if (value < 2000) {
        return `${value} ms`;
      } else {
        const fmt = formatDistance(
          new Date(0),
          new Date(value),
        );
        return `${fmt} (${value} ms)`;
      }
    };

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
      display: msToHuman,
    });

    statistics.push({
      title: 'Overprovisioned Workers',
      description: 'Number of workers that started up, did no work, and shut down again.',
      value: overProvisionedWorkers,
      display: value => `${value} workers`,
    });

    statistics.push({
      title: 'Overprovisioned Worker Time',
      description: 'Total time overprovisioned workers (those which did no work) ran.',
      value: overProvisionedTime,
      display: msToHuman,
    });

    statistics.push({
      title: 'Minimum wait time',
      description: 'Minimum time between task creation and start',
      value: waitTimeStats.minWaitTime,
      display: msToHuman,
    });

    statistics.push({
      title: 'Maximum wait time',
      description: 'Maximum time between task creation and start',
      value: waitTimeStats.maxWaitTime,
      display: msToHuman,
    });

    statistics.push({
      title: 'Mean wait time',
      description: 'Mean time between task creation and start',
      value: waitTimeStats.meanWaitTime,
      display: msToHuman,
    });

    statistics.push({
      title: 'Median wait time',
      description: 'Median time between task creation and start',
      value: waitTimeStats.medianWaitTime,
      display: msToHuman,
    });

    return statistics;
  }
}

export default new Analysis();
