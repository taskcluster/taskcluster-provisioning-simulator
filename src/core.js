const PriorityQueue = require('priorityqueuejs');
const chalk = require('chalk');

class Core {
  constructor({logging} = {}) {
    if (!logging) {
      this.log = () => {};
    }

    this.now = new Date(2020, 0, 0).getTime();
    this.queue = new PriorityQueue((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : 0));
  }

  nextTick(cb) {
    this.queue.enq([this.now, cb]);
  }

  setTimeout(cb, after) {
    const thunk = {cancelled: false};
    this.queue.enq([this.now + after, () => thunk.cancelled || cb()]);
    return thunk
  }

  cancelTimeout(thunk) {
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
      this.queue.enq([this.now + interval, run]);
    }
    schedule();
    return thunk;
  }

  cancelInterval(thunk) {
    thunk.cancelled = true;
  }

  logger(prefix) {
    return message => this.log(chalk`{cyan ${prefix} - }${message}`);
  }

  log(message) {
    console.log(chalk`{yellow ${new Date(this.now).toJSON()} - }${message}`);
  }

  run(runFor) {
    const stopAt = this.now + runFor;
    while (this.now < stopAt && this.queue.size() > 0) {
      const [when, what] = this.queue.deq();
      this.now = when;
      what();
    }
  }
}

exports.Core = Core;
