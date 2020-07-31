const PriorityQueue = require('priorityqueuejs');
const chalk = require('chalk');

class Core {
  constructor({logging} = {}) {
    if (!logging) {
      this.log = () => {};
    }

    this._now = new Date(2020, 0, 0).getTime();
    this.queue = new PriorityQueue((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : 0));
  }

  nextTick(cb) {
    this.queue.enq([this._now, cb]);
  }

  setTimeout(cb, after) {
    const thunk = {cancelled: false};
    this.queue.enq([this._now + after, () => thunk.cancelled || cb()]);
    return thunk
  }

  clearTimeout(thunk) {
    thunk.cancelled = true;
  }

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
    }
    schedule();
    return thunk;
  }

  clearInterval(thunk) {
    thunk.cancelled = true;
  }

  logger(prefix) {
    return message => this.log(chalk`{cyan ${prefix} - }${message}`);
  }

  log(message) {
    console.log(chalk`{yellow ${new Date(this._now).toJSON()} - }${message}`);
  }

  now() {
    return this._now;
  }

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
