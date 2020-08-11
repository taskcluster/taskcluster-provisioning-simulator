const assert = require('assert');
const PriorityQueue = require('priorityqueuejs');
const chalk = require('chalk');

class Core {
  constructor({logging} = {}) {
    this.logging = logging;
    if (!logging) {
      this.log = () => {};
    }

    // A priority queue of [when, what], sorted by when.  The when is the time
    // an event should happen, while the what is a function to call at that
    // time.  "Time" is entirely simulated here, without reference to the JS
    // engine's notions of time.
    this.pqueue = new PriorityQueue((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : 0));

    // The time is now January 1, 1970.
    this._now = 0;
  }

  _enq(when, what) {
    assert.equal(typeof when, 'number');
    assert.equal(typeof what, 'function');
    this.pqueue.enq([when, what]);
  }

  /**
   * Run `cb` on the next run of the event loop.
   */
  nextTick(cb) {
    this._enq(this._now, cb);
  }

  /**
   * Run `cb` after `after` ms, and return an id that can be used with clearTimeout
   */
  setTimeout(cb, after) {
    const thunk = {cancelled: false};
    this._enq(this._now + after, () => thunk.cancelled || cb());
    return thunk;
  }

  /**
   * Clear the timeout identified by the parameter.  If the callback has not already
   * been called, it will not be called.  Otherwise, nothing happens.
   */
  clearTimeout(thunk) {
    thunk.cancelled = true;
  }

  /**
   * Run `cb` every `interval` ms, starting `interval` ms from now.  Returns an id
   * that can be used with `clearInterval`.
   */
  setInterval(cb, interval) {
    const thunk = {cancelled: false};
    const run = () => {
      if (thunk.cancelled) {
        return;
      }
      schedule();
      cb();
    };
    const schedule = () => {
      this._enq(this._now + interval, run);
    };
    schedule();
    return thunk;
  }

  /**
   * Clear the interval identified by the parameter.  No further calls of the callback
   * will occur.
   */
  clearInterval(thunk) {
    thunk.cancelled = true;
  }

  /**
   * Create a callable that will log with the given prefix.
   */
  logger(prefix) {
    if (!this.logging) {
      return () => {};
    }

    return message => this.log(chalk`{cyan ${prefix} - }${message}`);
  }

  /**
   * Log the given message with a timestamp
   */
  log(message) {
    console.log(chalk`{yellow ${new Date(this._now).toJSON()} - }${message}`);
  }

  /**
   * Return the current time in ms
   */
  now() {
    return this._now;
  }

  /**
   * Run the event loop for the given duration (in ms)
   */
  run(runFor) {
    const stopAt = this._now + runFor;
    while (this.pqueue.size() > 0) {
      // pop the next item from the priority queue
      const [when, what] = this.pqueue.deq();
      if (when > stopAt) {
        // for efficiency, restore this only in the unusual case where we need
        // to stop, rather than peeking and then deq'ing in the common case
        this._enq(when, what);
        break;
      }
      // update the current time to when this event occurs
      this._now = when;
      // ..and run the event
      what();
    }
  }
}

exports.Core = Core;
