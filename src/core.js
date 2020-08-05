const PriorityQueue = require('priorityqueuejs');
const chalk = require('chalk');

class Core {
  constructor({logging} = {}) {
    this.logging = logging;
    if (!logging) {
      this.log = () => {};
    }

    this._now = new Date(2020, 0, 0).getTime();
    this.queue = new PriorityQueue((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : 0));
  }

  /**
   * Run `cb` on the next run of the event loop.
   */
  nextTick(cb) {
    this.queue.enq([this._now, cb]);
  }

  /**
   * Run `cb` after `after` ms, and return an id that can be used with clearTimeout
   */
  setTimeout(cb, after) {
    const thunk = {cancelled: false};
    this.queue.enq([this._now + after, () => thunk.cancelled || cb()]);
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
      this.queue.enq([this._now + interval, run]);
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
    while (this._now < stopAt && this.queue.size() > 0) {
      const [when, what] = this.queue.deq();
      this._now = when;
      what();
    }
  }
}

exports.Core = Core;
