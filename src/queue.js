const {Component} = require('./component');

/**
 * Simulator for the TC Queue.
 *
 * Simplifying assumptions:
 *  - tasks are only ever pending, running, or completed; no multiple runs, no dependencies, no "scheduled"
 *  - no task priorities
 *  - only one unnamed task queue (=worker pool)
 */
class Queue extends Component {
  constructor({core}) {
    super({core});
    this.pendingTasks = [];
    this.runningTasks = new Map();
  }

  /**
   * Create a new task with the given ID and payload.  The taskId should
   * be unique, and the payload should have {duration}.
   */
  createTask(taskId, payload) {
    this.pendingTasks.push({taskId, payload});
    this.emit('pending', taskId);
  }

  /**
   * Return a pending task, or nothing.  If nothing, then wait for a
   * 'pending' event from this object and try again.
   */
  claimWork() {
    if (this.pendingTasks.length > 0) {
      const task = this.pendingTasks.shift()
      this.emit('starting', task.taskId);
      this.runningTasks.set(task.taskId, task);
      return task;
    }
  }

  /**
   * Indicate that a task is finished
   */
  resolveTask(taskId) {
    this.emit('resolved', taskId);
    this.runningTasks.delete(taskId);
  }
}

exports.Queue = Queue;
