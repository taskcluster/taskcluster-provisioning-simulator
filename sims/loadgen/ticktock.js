const {LoadGenerator} = require('../..');
const slugid = require('slugid');

class TickTockLoadGenerator extends LoadGenerator {
  constructor({core, queue, taskEvery, taskDuration}) {
    super({core, queue});
    this.taskEvery = taskEvery;
    this.taskDuration = taskDuration;
  }

  start() {
    // start a task every second
    this.runIntervalId = this.core.setInterval(() => this.startTask(), this.taskEvery);
  }

  startTask() {
    const taskId = slugid.v4();
    this.log(`creating task ${taskId}`);
    this.queue.createTask(taskId, {duration: this.taskDuration});
  }

  stop() {
    this.core.clearInterval(this.runIntervalId);
  }
}

exports.TickTockLoadGenerator = TickTockLoadGenerator;
