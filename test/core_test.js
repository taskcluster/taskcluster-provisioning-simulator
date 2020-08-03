const assert = require('assert');
const { Core } = require('../src/core');

suite('Core', function() {
  let core;

  setup('create core', function() {
    core = new Core({logging: false});
  });

  test('nextTick', function() {
    const now = core.now();
    core.nextTick(() => {
      assert.equal(core.now(), now);
    });
    core.run(10);
  });

  test('setTimeout', function() {
    const now = core.now();

    core.setTimeout(() => {
      assert.equal(core.now(), now + 100);
    }, 100);

    core.run(200);
  });

  test('setTimeout / clearTimeout', function() {
    let called = false;

    const id = core.setTimeout(() => {
      called = true;
    }, 100);

    core.nextTick(() => {
      core.clearTimeout(id);
    });

    core.run(200);

    assert(!called);
  });

  test('setInterval / clearInterval', function() {
    const now = core.now();
    const calls = [];

    const id = core.setInterval(() => {
      calls.push(core.now());
      if (core.now() >= now + 1000) {
        core.clearTimeout(id);
      }
    }, 100);

    core.run(2000);

    assert.deepEqual(calls, [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map(t => now + t));
  });
});
