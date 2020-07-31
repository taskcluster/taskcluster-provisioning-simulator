const {Component} = require('./component');
const slugid = require('slugid');

class TickTockLoadGenerator extends Component {
  constructor({core, queue, taskEvery, taskDuration}) {
    super({core});
    this.queue = queue;
    this.taskEvery = taskEvery;
    this.taskDuration = taskDuration;

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
