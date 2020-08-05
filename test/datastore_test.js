const assert = require('assert');
const { DataStore } = require('../src/datastore');

suite('DataStore', function() {
  test('create from Recorder', function() {
    const recorder = {
      startTime: 500,
      stopTime: 800,
      events: [
        // wkr1 / t1 are completed before t=500
        // wkr2 / t2 are running at simulation start
        //        t3 is pending at simulation start
        // wkr3      is starting at simulation start
        //        t4 is entirely within the simulation
        // wkr5 / t5 is running when the simulation stops
        //        t6 is pending when simulation stops
        // wkr6      is starting when the simulation stops
        // wkr7 / t7 is entirely after the simulation
        [0, 'worker-requested', 'wkr1'],
        [10, 'worker-requested', 'wkr2'],
        [100, 'task-created', 't1'],
        [130, 'worker-started', 'wkr1'],
        [140, 'task-created', 't2'],
        [150, 'worker-started', 'wkr2'],
        [190, 'task-started', 't1', 'wkr1'],
        [200, 'task-started', 't2', 'wkr2'],
        [400, 'task-resolved', 't1'],
        [430, 'worker-shutdown', 'wkr1'],
        [440, 'task-created', 't3'],
        [460, 'worker-requested', 'wkr3'],
        // simulation starts
        [505, 'worker-started', 'wkr3'],
        [510, 'task-resolved', 't2'],
        [515, 'worker-started', 'wkr3'],
        [530, 'task-started', 't3', 'wkr3'],
        [540, 'task-resolved', 't3'],
        [550, 'worker-shutdown', 'wkr3'],
        [560, 'worker-requested', 'wkr5'],
        [570, 'worker-started', 'wkr5'],
        [580, 'worker-requested', 'wkr6'],
        [590, 'task-created', 't4'],
        [600, 'task-started', 't4', 'wkr5'],
        [610, 'task-resolved', 't4'],
        [620, 'task-created', 't5'],
        [630, 'task-started', 't5', 'wkr5'],
        [640, 'task-created', 't6'],
        // simulation ends
        [810, 'worker-shutdown', 'wkr5'],
        [820, 'task-resolved', 't5'],
        [840, 'task-resolved', 't6'],
        [850, 'worker-started', 'wkr6'],
        [830, 'task-started', 't6', 'wkr5'],
        [860, 'worker-requested', 'wkr7'],
        [870, 'task-created', 't7'],
        [880, 'task-started', 't7', 'wkr7'],
        [890, 'worker-shutdown', 'wkr6'],
        [900, 'worker-started', 'wkr7'],
        [910, 'worker-shutdown', 'wkr7'],
        [920, 'task-resolved', 't7'],
      ],
    };

    const ds = DataStore.fromRecorder(recorder);
    assert.equal(ds.duration, 300);
    assert.deepEqual(ds.events, [
      [-490, 'worker-requested', 'wkr2'],
      [-360, 'task-created', 't2'],
      [-350, 'worker-started', 'wkr2'],
      [-300, 'task-started', 't2', 'wkr2'],
      [-60, 'task-created', 't3'],
      [-40, 'worker-requested', 'wkr3'],
      // simulation starts
      [5, 'worker-started', 'wkr3'],
      [10, 'task-resolved', 't2'],
      [15, 'worker-started', 'wkr3'],
      [30, 'task-started', 't3', 'wkr3'],
      [40, 'task-resolved', 't3'],
      [50, 'worker-shutdown', 'wkr3'],
      [60, 'worker-requested', 'wkr5'],
      [70, 'worker-started', 'wkr5'],
      [80, 'worker-requested', 'wkr6'],
      [90, 'task-created', 't4'],
      [100, 'task-started', 't4', 'wkr5'],
      [110, 'task-resolved', 't4'],
      [120, 'task-created', 't5'],
      [130, 'task-started', 't5', 'wkr5'],
      [140, 'task-created', 't6'],
      // simulation ends
      [310, 'worker-shutdown', 'wkr5'],
      [320, 'task-resolved', 't5'],
      [340, 'task-resolved', 't6'],
      [350, 'worker-started', 'wkr6'],
      [330, 'task-started', 't6', 'wkr5'],
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
});
