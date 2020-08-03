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

### Core

### Queue

### Load Generator

### Provisioner

## Usage

At present, this repository implements a library and contains a runnable command to run simulations.

The library provides the "framework" for running simulations, and support for implementing specific load-generation and provisioner components.
The runnable simulation provides load-generator and provisioner implemnetations and ties them together in specific "simulations" that include parameters specific to the situation to be simulated.

To run a simulation, use

```shell
yarn sim $SIMULATION
```

the available simulations are defined in `.js` files in `src/sims`.
