const assert = require('assert');
const Debug = require('debug');
const util = require('util');
const { Core } = require('../src/core');
const { Queue } = require('../src/queue');
const { Worker } = require('../src/worker');

const debug = Debug('worker_test');

suite('Worker', function() {
  let core, queue, events, evt;

  setup('create core', function() {
    events = [];
    evt = (...args) => {
      debug('event:', ...args);
      events.push([...args]);
    };

    core = new Core({logging: false});
    queue = new Queue({core});

    queue.on('claimWork', workerId => evt(core.now(), 'claimWork', workerId));
    queue.on('started', (taskId, workerId) => evt(core.now(), 'task-started', taskId, workerId));
    queue.on('resolved', taskId => evt(core.now(), 'task-resolved', taskId));
  });

  const makeWorker = (options) => {
    const worker = new Worker({
      core,
      queue,
      name: 'wkr',
      startupDelay: 0,
      idleTimeout: Infinity,
      capacity: 1,
      utility: 1,
      ...options,
    });
    evt(core.now(), 'worker-requested', worker.name);
    worker.once('started', () => evt(core.now(), 'worker-started', worker.name));
    worker.once('shutdown', () => evt(core.now(), 'worker-shutdown', worker.name));
    return worker;
  };

  const assertEvents = exp => {
    assert.deepEqual(
      events,
      exp,
      `\u001b[0msaw events:\n${util.inspect(events, {colors: true})}`);
  };

  const at = (time, fn) => core.setTimeout(fn, time);

  test('startupDelay', function() {
    at(0, () => makeWorker({startupDelay: 27}));

    core.run(400);

    assertEvents([
      [ 0, 'worker-requested', 'wkr' ],
      [ 27, 'worker-started', 'wkr' ],
      [ 27, 'claimWork', 'wkr' ],
    ]);
  });

  test('idleTimeout after running a task', function() {
    at(0, () => makeWorker({idleTimeout: 100}));
    at(50, () => queue.createTask('t1', {duration: 20}));

    core.run(300);

    assertEvents([
      [ 0, 'worker-requested', 'wkr' ],
      [ 0, 'worker-started', 'wkr' ],
      [ 0, 'claimWork', 'wkr' ],
      [ 50, 'claimWork', 'wkr' ],
      [ 50, 'task-started', 't1', 'wkr' ],
      [ 70, 'task-resolved', 't1' ],
      // idle timeout starts now..
      [ 70, 'claimWork', 'wkr' ],
      [ 170, 'worker-shutdown', 'wkr' ],
    ]);
  });

  test('idleTimeout without running a task', function() {
    at(0, () => makeWorker({idleTimeout: 100}));

    core.run(400);

    assertEvents([
      [ 0, 'worker-requested', 'wkr' ],
      [ 0, 'worker-started', 'wkr' ],
      [ 0, 'claimWork', 'wkr' ],
      [ 100, 'worker-shutdown', 'wkr' ],
    ]);
  });

  test('claim a pending task after finishing a task', function() {
    at(0, () => makeWorker({}));
    at(10, () => queue.createTask('t1', {duration: 20}));
    at(15, () => queue.createTask('t2', {duration: 20}));

    core.run(400);

    assertEvents([
      [ 0, 'worker-requested', 'wkr' ],
      [ 0, 'worker-started', 'wkr' ],
      [ 0, 'claimWork', 'wkr' ],
      [ 10, 'claimWork', 'wkr' ],
      [ 10, 'task-started', 't1', 'wkr' ],
      [ 30, 'task-resolved', 't1' ],
      [ 30, 'claimWork', 'wkr' ],
      [ 30, 'task-started', 't2', 'wkr' ],
      [ 50, 'task-resolved', 't2' ],
      [ 50, 'claimWork', 'wkr' ],
    ]);
  });
});
