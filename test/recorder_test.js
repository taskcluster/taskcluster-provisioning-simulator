const assert = require('assert');
const { EventEmitter } = require('events');
const { Core } = require('../src/core');
const { Recorder } = require('../src/recorder');

suite('Recorder', function() {
  let core, queue, provisioner, recorder;

  setup('create core', function() {
    core = new Core({logging: false});
    queue = new EventEmitter();
    provisioner = new EventEmitter();
    const simulator = { core, queue, provisioner };
    recorder = new Recorder(simulator);
  });

  test('gathers events', function() {
    const at = (t, fn) => core.setTimeout(fn, t);
    at(0, () => provisioner.emit('requested', 'wkr1'));
    at(100, () => queue.emit('created', 't1'));
    at(150, () => provisioner.emit('started', 'wkr1'));
    at(200, () => queue.emit('started', 't1', 'wkr1'));
    at(300, () => recorder.start());
    at(400, () => queue.emit('resolved', 't1'));
    at(500, () => recorder.stop());
    at(600, () => provisioner.emit('shutdown', 'wkr1'));
    core.run(1000);

    assert.equal(recorder.startTime, 300);
    assert.equal(recorder.stopTime, 500);
    assert.deepEqual(recorder.events, [
      [0, 'worker-requested', 'wkr1'],
      [100, 'task-created', 't1'],
      [150, 'worker-started', 'wkr1'],
      [200, 'task-started', 't1', 'wkr1'],
      [400, 'task-resolved', 't1'],
      [600, 'worker-shutdown', 'wkr1'],
    ]);
  });
});
