const assert = require('assert');
const { DataStore } = require('../src/datastore');

suite('DataStore', function() {
  // a fake recorder with the properties required by fromRecorder
  const recorder = {
    startTime: 500,
    stopTime: 800,
    events: [
      // wkr1 / t1 are completed before t=500
      // wkr2 / t2 are running at simulation start
      //        t3 is pending at simulation start
      // wkr2      is starting at simulation start
      //        t4 is entirely within the simulation
      // wkr5 / t5 is running when the simulation stops
      //        t6 is pending when simulation stops
      // wkr6      is starting when the simulation stops
      // wkr7 / t7 is entirely after the simulation
      [0, 'worker-requested', 'wkr1', {capacity: 1, utility: 1}],
      [10, 'worker-requested', 'wkr2', {capacity: 1, utility: 1}],
      [100, 'task-created', 't1'],
      [130, 'worker-started', 'wkr1'],
      [140, 'task-created', 't2'],
      [150, 'worker-started', 'wkr2'],
      [190, 'task-started', 't1', 'wkr1'],
      [200, 'task-started', 't2', 'wkr2'],
      [400, 'task-resolved', 't1'],
      [430, 'worker-shutdown', 'wkr1'],
      [440, 'task-created', 't3'],
      [460, 'worker-requested', 'wkr3', {capacity: 1, utility: 1}],
      // simulation starts
      [505, 'worker-started', 'wkr3'],
      [510, 'task-resolved', 't2'],
      [530, 'task-started', 't3', 'wkr3'],
      [540, 'task-resolved', 't3'],
      [550, 'worker-shutdown', 'wkr3'],
      [560, 'worker-requested', 'wkr5', {capacity: 8, utility: 1}],
      [570, 'worker-started', 'wkr5'],
      [580, 'worker-requested', 'wkr6', {capacity: 1, utility: 1}],
      [590, 'task-created', 't4'],
      [600, 'task-started', 't4', 'wkr5'],
      [610, 'task-resolved', 't4'],
      [620, 'task-created', 't5'],
      [630, 'task-started', 't5', 'wkr5'],
      [640, 'task-created', 't6'],
      // simulation ends
      [810, 'task-resolved', 't5'],
      [829, 'worker-shutdown', 'wkr5'],
      [840, 'worker-started', 'wkr6'],
      [850, 'task-started', 't6', 'wkr6'],
      [860, 'task-resolved', 't6'],
      [860, 'worker-requested', 'wkr7', {capacity: 1, utility: 1}],
      [870, 'task-created', 't7'],
      [880, 'task-started', 't7', 'wkr7'],
      [890, 'worker-shutdown', 'wkr6'],
      [900, 'worker-started', 'wkr7'],
      [910, 'worker-shutdown', 'wkr7'],
      [920, 'task-resolved', 't7'],
    ],
  };

  test('create from Recorder', function() {
    const ds = DataStore.fromRecorder(recorder);
    assert.equal(ds.duration, 300);
    assert.deepEqual(ds.events, [
      [-490, 'worker-requested', 'wkr2', {capacity: 1, utility: 1}],
      [-360, 'task-created', 't2'],
      [-350, 'worker-started', 'wkr2'],
      [-300, 'task-started', 't2', 'wkr2'],
      [-60, 'task-created', 't3'],
      [-40, 'worker-requested', 'wkr3', {capacity: 1, utility: 1}],
      // simulation starts
      [5, 'worker-started', 'wkr3'],
      [10, 'task-resolved', 't2'],
      [30, 'task-started', 't3', 'wkr3'],
      [40, 'task-resolved', 't3'],
      [50, 'worker-shutdown', 'wkr3'],
      [60, 'worker-requested', 'wkr5', {capacity: 8, utility: 1}],
      [70, 'worker-started', 'wkr5'],
      [80, 'worker-requested', 'wkr6', {capacity: 1, utility: 1}],
      [90, 'task-created', 't4'],
      [100, 'task-started', 't4', 'wkr5'],
      [110, 'task-resolved', 't4'],
      [120, 'task-created', 't5'],
      [130, 'task-started', 't5', 'wkr5'],
      [140, 'task-created', 't6'],
      // simulation ends
      [310, 'task-resolved', 't5'],
      [329, 'worker-shutdown', 'wkr5'],
      [340, 'worker-started', 'wkr6'],
      [350, 'task-started', 't6', 'wkr6'],
      [360, 'task-resolved', 't6'],
      [390, 'worker-shutdown', 'wkr6'],
    ]);
  });

  test('asSerializable / fromSerializable', function() {
    const ds = new DataStore();
    ds.duration = 10;
    ds.events = [[0, 'worker-started', 'wkr1']];

    const ser = ds.asSerializable();
    assert.deepEqual(ser, {
      duration: 10,
      events: [[0, 'worker-started', 'wkr1']],
    });

    const ds2 = DataStore.fromSerializable(ser);
    assert.equal(ds.duration, ds2.duration);
    assert.deepEqual(ds.events, ds2.events);
  });

  suite('analyze', function() {
    let ds;
    suiteSetup(function() {
      ds = DataStore.fromRecorder(recorder);
    });

    test('custom metric at 100ms', function() {
      const {metrics} = ds.analyze({
        interval: 100,
        metrics: {
          totalCapacity(state) {
            let total = 0;
            for (let {capacity} of state.runningWorkers.values()) {
              total += capacity;
            }
            return total;
          },
          runningCapacity(state) {
            let total = 0;
            for (let {runningTasks} of state.runningWorkers.values()) {
              total += runningTasks.size;
            }
            return total;
          },
        },
      });
      assert.deepEqual(metrics, [
        {time: 0, totalCapacity: 1, runningCapacity: 1},
        {time: 100, totalCapacity: 9, runningCapacity: 1},
        {time: 200, totalCapacity: 9, runningCapacity: 1},
        {time: 300, totalCapacity: 9, runningCapacity: 1},
      ]);
    });

    test('pendingTasks at 100ms', function() {
      const {metrics} = ds.analyze({interval: 100, metrics: {pendingTasks: DataStore.pendingTasks}});
      assert.deepEqual(metrics, [
        {time: 0, pendingTasks: 1},
        {time: 100, pendingTasks: 0},
        {time: 200, pendingTasks: 1},
        {time: 300, pendingTasks: 1},
      ]);
    });

    test('pendingTasks at 50ms', function() {
      const {metrics} = ds.analyze({interval: 50, metrics: {pendingTasks: DataStore.pendingTasks}});
      assert.deepEqual(metrics, [
        {time: 0, pendingTasks: 1},
        {time: 50, pendingTasks: 0},
        {time: 100, pendingTasks: 0},
        {time: 150, pendingTasks: 1},
        {time: 200, pendingTasks: 1},
        {time: 250, pendingTasks: 1},
        {time: 300, pendingTasks: 1},
      ]);
    });

    test('resolvedTasks at 100ms', function() {
      const {metrics} = ds.analyze({interval: 100, metrics: {resolvedTasks: DataStore.resolvedTasks}});
      assert.deepEqual(metrics, [
        { time: 0, resolvedTasks: 0 },
        { time: 100, resolvedTasks: 2 },
        { time: 200, resolvedTasks: 3 },
        { time: 300, resolvedTasks: 3 },
      ]);
    });

    test('runningTasks at 100ms', function() {
      const {metrics} = ds.analyze({interval: 100, metrics: {runningTasks: DataStore.runningTasks}});
      assert.deepEqual(metrics, [
        {time: 0, runningTasks: 1},
        {time: 100, runningTasks: 1},
        {time: 200, runningTasks: 1},
        {time: 300, runningTasks: 1},
      ]);
    });

    test('requestedWorkers at 25ms', function() {
      const {metrics} = ds.analyze({interval: 25, metrics: {requestedWorkers: DataStore.requestedWorkers}});
      assert.deepEqual(metrics, [
        { time: 0, requestedWorkers: 1 },
        { time: 25, requestedWorkers: 0 },
        { time: 50, requestedWorkers: 0 },
        { time: 75, requestedWorkers: 0 },
        { time: 100, requestedWorkers: 1 }, // wkr6 takes forever to start..
        { time: 125, requestedWorkers: 1 },
        { time: 150, requestedWorkers: 1 },
        { time: 175, requestedWorkers: 1 },
        { time: 200, requestedWorkers: 1 },
        { time: 225, requestedWorkers: 1 },
        { time: 250, requestedWorkers: 1 },
        { time: 275, requestedWorkers: 1 },
        { time: 300, requestedWorkers: 1 },
      ]);
    });

    test('runningWorkers at 100ms', function() {
      const {metrics} = ds.analyze({interval: 100, metrics: {runningWorkers: DataStore.runningWorkers}});
      assert.deepEqual(metrics, [
        { time: 0, runningWorkers: 1 },
        { time: 100, runningWorkers: 2 },
        { time: 200, runningWorkers: 2 },
        { time: 300, runningWorkers: 2 },
      ]);
    });

    test('shutdownWorkers at 100ms', function() {
      const {metrics} = ds.analyze({interval: 100, metrics: {shutdownWorkers: DataStore.shutdownWorkers}});
      assert.deepEqual(metrics, [
        { time: 0, shutdownWorkers: 0 },
        { time: 100, shutdownWorkers: 1 },
        { time: 200, shutdownWorkers: 1 },
        { time: 300, shutdownWorkers: 1 },
      ]);
    });

    test('custom state function at 10ms', function() {
      const {metrics} = ds.analyze({
        interval: 10,
        metrics: {
          overProvisionedWorkers(state) {
            return state.overProvisionedWorkers.size;
          },
        },
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

      assert.deepEqual(metrics, [
        { time: 0, overProvisionedWorkers: 0 },
        { time: 10, overProvisionedWorkers: 1 },
        { time: 20, overProvisionedWorkers: 1 },
        { time: 30, overProvisionedWorkers: 0 },
        { time: 40, overProvisionedWorkers: 0 },
        { time: 50, overProvisionedWorkers: 0 },
        { time: 60, overProvisionedWorkers: 0 },
        { time: 70, overProvisionedWorkers: 1 },
        { time: 80, overProvisionedWorkers: 1 },
        { time: 90, overProvisionedWorkers: 1 },
        { time: 100, overProvisionedWorkers: 0 },
        { time: 110, overProvisionedWorkers: 0 },
        { time: 120, overProvisionedWorkers: 0 },
        { time: 130, overProvisionedWorkers: 0 },
        { time: 140, overProvisionedWorkers: 0 },
        { time: 150, overProvisionedWorkers: 0 },
        { time: 160, overProvisionedWorkers: 0 },
        { time: 170, overProvisionedWorkers: 0 },
        { time: 180, overProvisionedWorkers: 0 },
        { time: 190, overProvisionedWorkers: 0 },
        { time: 200, overProvisionedWorkers: 0 },
        { time: 210, overProvisionedWorkers: 0 },
        { time: 220, overProvisionedWorkers: 0 },
        { time: 230, overProvisionedWorkers: 0 },
        { time: 240, overProvisionedWorkers: 0 },
        { time: 250, overProvisionedWorkers: 0 },
        { time: 260, overProvisionedWorkers: 0 },
        { time: 270, overProvisionedWorkers: 0 },
        { time: 280, overProvisionedWorkers: 0 },
        { time: 290, overProvisionedWorkers: 0 },
        { time: 300, overProvisionedWorkers: 0 },
      ]);
    });
  });
});
