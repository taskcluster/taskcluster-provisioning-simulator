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

The queue instance will emit `pending`, `starting`, and `resolved` messages, with the taskId, when those events occur.

To claim work, workers should call `queue.claimWork()` and, if nothing is returned, wait for a `pending` message and try again.

### Load Generator

A load generator is responsible for injecting tasks (load) into the simulator.

Load generators should inherit from `LoadGenerator`, and should start immediately on construction.
The `stop` method should stop load generation; this is used at the beginning of the ramp-down period to check that existing tasks are eventually completed.

### Provisioner

A provisioner is responsible for creating workers in response to load (or quantum fluctuations or messages from the beyond).

Provisioner implementations should extend the `Provisioner` class, calling its constructor.
Critically, every worker the provisioner creates muts be passed to `this.registerWorker(worker)`.

To de-couple provisioner and worker implementations, provisioners should take a `workerFactory` argument to create a new worker.
This allows the simulation to define the worker's parameters.
Existing workers (that have not shut down) are stored, by name, in `this.workers`.

The provisioner's `stop()` method is called at the end of the ramp-down period to verify that all workers have shut down.
The default implementation asserts that `this.workers` is empty.
Subclasses may override this method for more complex checks, such as when there is a `minCapacity` configuration.

### Worker

A worker claims tasks from the queue and resolves them after the `duration` specified in their payload.
The provided `Worker` class is sufficient for most cases, but can be overridden to experiment with the impact of changes to the worker implementation.

The worker constructor takes the following options:

* `core`, `queue`
* `startupDelay` -- time, in ms, between creation of the worker and the first call to `queue.claimWork`
* `idleTimeout` -- maximum time the worker will remain idle

A worker has a `name` property giving a unique name for the worker.

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
