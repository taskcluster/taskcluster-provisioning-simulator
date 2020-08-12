# Simulators

This directory contains simulators (in the root), provisioners (`prov/`) and load generators (`loadgen/`).

## Simulators

For all simulators, see `yarn sim <name> --help` for parameters.

### `simple`

This simulation runs the simple estimate provisioner using a simple tick-tock load generator.

### `firefox`

This simulation runs the simple estimate provisioner using the firefox-ci load generator.

## Provisioners

### SimpleEstimateProvisioner

This provisioner emulates the worker-manager implementation as of v35.0.0.
This treats pending as a signal that more worker capacity is required, and starts workers using a factory.

```javascript
  provisionerFactory() {
    return new SimpleEstimateProvisioner({
      core: this.core,
      queue: this.queue,
      minCapacity: 0,
      maxCapacity: 5,
      workerFactory: () => new Worker({
        core: this.core,
        queue: this.queue,
        startupDelay: 2000,
        idleTimeout: 10000,
      }),
    });
  }
```

## Load Generators

### TickTockLoadGenerator

This load generator creates a task on a regular interval, of a fixed duration.

```javascript
  loadGeneratorFactory() {
    return new TickTockLoadGenerator({
      core: this.core,
      queue: this.queue,
      taskEvery: 900,     // create a task every 900ms
      taskDuration: 5000, // where each task takes 5000ms to complete
    });
  }
```

### FirefoxCILoadGenerator

This load generator replicates tasks observed in Firefox CI, both in time of task creation and in duration.
It reads data from pre-generated `.dat` files sampled from worker pools using `capture-pulse.js`.
These files are binary and formatted as a series of 16-byte records containing a 32-bit big-endian start time (in milliseconds) and duration (in milliseconds).
The start times are relative to the beginning of the capture.

```javascript
  loadGeneratorFactory() {
    return new FirefoxCILoadGenerator({
      core: this.core,
      queue: this.queue,
      workerPoolId: 'mobile-3/decision',
    });
  }
```
