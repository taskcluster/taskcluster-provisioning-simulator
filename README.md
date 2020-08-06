# Taskcluster Provisioning Simulator

This is a tool for simulating provisioning of workers to complete tasks in Taskcluster.
Its goal is to reproduce the characteristics of provisioning that are important to the performance of proposed provisioning algorithms, and to provide useful summary measurements of the results.

## Scope

This tool simulates the Taskcluster queue service, workers, and the worker-manager service.

Simplifying assumptions:

* There is only one worker pool (equivalently, one task queue).
* Tasks become pending when created, start running, and then finish.  Failures, exceptions, and unscheduled (waiting for depenedncies) tasks are not simulated.

## Components

### Simulator

The `Simulator` class is the top-level coordinator for a simulation, with each simulation implemented as a subclass.

To run a simulator, create it and call its `run` method.
The options to the constructor are:
 * `logging` -- if true (the default), log messages about events to the console

Simulators run in three phases: ramp-up, simulation, and ramp-down.
The intent of these phases is to allow the system to reach equilibrium (ramp-up) and to verify that the system quiesces (ramp-down).
Data is stored only for the simulation phase.

To implement a simulator, extend the `Simulator` class in `sims/mysimulator.js` and implement a constructor which sets:

 * `this.rampUpTime`
 * `this.runTime`
 * `this.rampDownTime` -- times (in ms) for the three phases of this simulation

The simulator should implement two methods, which will be called during construction:

 * `this.loadGeneratorFactory()` -- create the load generator instance
 * `this.provisionerFactory()` -- create the provisioner instance

and export the class from the module.

The parent constructor sets `this.core` and `this.queue` appropriately.

Note that simulations do not do any I/O, and thus run synchronously.
For especially long or complex runs, it may be beneficial to run the simulation in a worker thread.

A simulator has a `dataStore()` method which returns a datastore containing a record of the simulation phase and any other events needed for context.

### Core

The core implements the event loop driving the simulation.
Events are processed as quickly as possible, in chronological order but without actually waiting for time to pass.
The "fake" time begins at the first moment of 2020.
Perhaps this is an inaspicious choice?

The class implements the usual array of JS timer functionality:

* `core.nextTick(cb)`
* `core.setTimeout(cb, after)` / `core.clearTimeout`
* `core.setInterval(cb, interval)` / `core.clearInterval`

as well as some utility functions:

* `core.now()` - current time in ms since epoch
* `core.log(msg)` - log a message
* `core.logger(prefix)` - return a logging function that will prefix messages

### Queue

The queue implements a subset of the Taskcluster queue's functionality.

* `queue.createTask(taskId, payload)` - create a new task, with payload of the form `{duration}` giving the task duration in ms.
* `queue.claimWork()` - return a pending task or nothing
* `queue.resolveTask(taskId)` - mark a task as resolved
* `queue.pendingTasks()` - return the number of pending tasks

The queue instance will emit
* `created`, taskId
* `started`, taskId, workerId
* `resolved`, taskId

To claim work, workers should call `queue.claimWork()` and, if nothing is returned, wait for a `created` event and try again.

### Load Generator

A load generator is responsible for injecting tasks (load) into the simulator.

Load generators should inherit from `LoadGenerator`, and implement a `start()` method to start simulation.
The `stop()` method should stop load generation; this is used at the beginning of the ramp-down period to check that existing tasks are eventually completed.

### Provisioner

A provisioner is responsible for creating workers in response to load (or quantum fluctuations or messages from the beyond).

Provisioner implementations should extend the `Provisioner` class, calling its constructor.
Provisioning should start when the `start()` method is called.
Critically, every worker the provisioner creates muts be passed to `this.registerWorker(worker)`.

To de-couple provisioner and worker implementations, provisioners should take a `workerFactory` argument to create a new worker.
This allows the simulation to define the worker's parameters.
Existing workers (that have not shut down) are stored, by name, in `this.workers`.

The provisioner's `stop()` method is called at the end of the ramp-down period to verify that all workers have shut down.
The default implementation asserts that `this.workers` is empty.
Subclasses may override this method for more complex checks, such as when there is a `minCapacity` configuration.

The provisioner will emit
* `requested`, workerId
* `started`, workerId
* `shutdown`, workerId

### Worker

A worker claims tasks from the queue and resolves them after the `duration` specified in their payload.
The provided `Worker` class is sufficient for most cases, but can be overridden to experiment with the impact of changes to the worker implementation.

The worker constructor takes the following options:

* `core`, `queue`
* `startupDelay` -- time, in ms, between creation of the worker and the first call to `queue.claimWork`
* `interTaskDelay` -- time, in ms, after a task during which the worker is unavailable for a new task (idle timeout starts after the delay is complete)
* `idleTimeout` -- maximum time the worker will remain idle
* `capacity` -- number of tasks this worker can execute in parallel (must be 1 right now)
* `utility` -- speedup factor of this worker (the worker's time to complete a task is duration ÷ utility) (must be 1 right now)

A worker has a `name` property giving a unique name for the worker.

## Data and Analysis

A DataStore instance represents the simulation phsae of a simulation run as a sequence of events
It includes events from the ramp-up and ramp-down phase to provide context (for example, the time a worker or task was created before the simulation began, or the time a task was resolved or a worker shut down after the simulation ended).
Given a datastore ds, these events are available in `ds.events`.

The events are:
 * `[timestamp, 'task-created', taskId]`
 * `[timestamp, 'task-started', taskId, workerId]`
 * `[timestamp, 'task-resolved', taskId]`
 * `[timestamp, 'worker-requested', workerId, {capacity, utility}]`
 * `[timestamp, 'worker-started', workerId]`
 * `[timestamp, 'worker-shutdown', workerId]`

Times are in ms.
The simulation always begins at time 0, and its duration is given by `ds.duration`.
The events from the ramp-up period will have negative timestamps, and events from the ramp-down period will have timestamps greater than `ds.duration`.

The DataStore for a simulation run is available from the simulator's `sim.dataStore()` method.
DataStores can be serialized by JSON-encoding the result of `ds.asSeriazliable()`, and re-created with `DataStore.fromSerializable(serializable)`.

### CalculateMetrics

While it's perfectly OK to analyze the event stream directly, in many cases the interesting information takes the form of analyses of the state at regular intervals, such as every minute.
The `ds.calculateMetrics({interval, metrics: { ... }, updateState})` method automates this analysis for you.
The `interval` parameter gives the interval on which to measure, and the `metrics` parameter gives the metrics that should be calculated at each interval.
The result is an array of objects of the form

```js
[
  {time: <ms>, metric1: .., metric2: ..},
  ...
]
```
for every time during the simulation phase.

The metrics are functions called with a state, described below.
There are a few static methods on the DataStore class to calculate some basic things:

 * `DataStore.pendingTasks` -- number of pending tasks
 * `DataStore.runningTasks` -- number of running tasks
 * `DataStore.resolvedTasks` -- number of resolved tasks
 * `DataStore.requestedWorkers` -- number of requested workers (that have not yet started)
 * `DataStore.runningWorkers` -- number of running workers (including idle workers)
 * `DataStore.shutdownWorkers` -- number of former workers no longer running

A simple analysis might graph the following

```javascript
ds.calculateMetrics({
  interval: 30000, // 30 seconds
  metrics: {
    pendingTasks: DataStore.pendingTasks,
    runningTasks: DataStore.runningTasks,
    runningWorkers; DataStore.runningWorkers
  },
});
```

It's also possible to write your own metric functions, accepting a state object.
The `calculateMetrics` method supplies the following state properties:

* `pendingTasks`, `runningTasks`, and `resolvedTasks` -- each a map from taskId to `{createdTime, startedTime, resolvedTime, workerId}`, with properties available as apporpriate.
* `requestedWorkers`, `runningWorkers`, and `shutdownWorkers` -- each a map from workerId to `{requestedTime, startedTime, shutdownTime, runningTasks, resolvedTasks}`.
  The `runningTasks` and `resolvedTasks` properties of each worker are similar to the state properties of the same name, but contain only tasks claimed by that worker.

For example a metric function to count idleWorkers might be defined as
```javascript
const idleWorkers = state => {
  let count = 0;
  for (let {runningTasks} of state.runningWorkers.values()) {
    if (runningTasks.size === 0) {
      count++;
    }
  }
  return count;
};
```

There's one more level of complexity before completely rolling your own analysis: updating state on each event.
If `updateState` is passed to `calculateMetrics`, it is called for each event and can update the state as it sees fit.
It is called after the built-in state is updated.
The `initialState` parameter is used to initialize the state.
This function *must not* update any of the predefined state properties.

For example, it might be useful to track workers that have started but never claimed a task:
```javascript
ds.calculateMetrics({
  ...,
  initialState: {overProvisionedWorkers: new Map()},
  updateState: (state, [time, name, ...rest]) => {
    switch (name) {
      case 'worker-started': {
        const [workerId] = rest;
        const worker = state.runningWorkers.get(workerId);
        state.overProvisionedWorkers.set(workerId, worker);
        break;
      }

      case 'task-started': {
        const [_, workerId] = rest;
        state.overProvisionedWorkers.delete(workerId);
        break;
      }
    }
  },
});
```

## Usage

At present, this repository implements a library and contains a runnable command to run simulations.

The library provides the "framework" for running simulations, and support for implementing specific load-generation and provisioner components.
The runnable simulation provides load-generator and provisioner implemnetations and ties them together in specific "simulations" that include parameters specific to the situation to be simulated.

To run a simulation, use

```shell
yarn sim $SIMULATION
```

the available simulations are defined in `.js` files in `sims`.

Add `-q` to quiet down the logging.
Add `-o <output>` to output the simulation data to `<output>`.
