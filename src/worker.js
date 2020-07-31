const {Component} = require('./component');

class Worker extends Component {
  constructor({core, queue, name}) {
    super({core, name});
    this.queue = queue;
    this.runningTask = null;

    this.loop = this.loop.bind(this, this.loop);
    this.core.nextTick(this.loop);
  }

  loop() {
    if (this.runningTask) {
      return;
    }
    
    const task = this.queue.claimWork();
    if (task) {
      this.log(`claimed ${task.taskId}`);
      this.runningTask = task;
      this.core.setTimeout(() => {
        this.log(`finished ${task.taskId}`);
        this.queue.resolveTask(task.taskId);
        this.runningTask = null;
        this.core.nextTick(this.loop);
      }, task.payload.duration);
    } else {
      this.queue.once('pending', this.loop);
    }
  }
}

exports.Worker = Worker;
