const {Component} = require('./component');
const assert = require('assert');

/**
 * Simulator for the TC Queue.
 *
 * Simplifying assumptions:
 *  - tasks are only ever pending, running, or completed; no multiple runs, no dependencies, no "scheduled"
 *  - no task priorities
 *  - only one unnamed task queue (=worker pool)
 *
 * This emits:
 *   'created', taskId -- when a task becomes pending
 *   'claimWork', workerId -- when a worker calls claimWork (whether it gets work or not)
 *   'started', taskId, workerId -- when a task is claimed
 *   'resolved', taskId -- when a task is resolved
 */
class Queue extends Component {
  constructor({core}) {
    super({core});
    this.setMaxListeners(100); // potentially lots of workers..
    this._pendingTasks = [];
    this._runningTasks = new Map();
    this._pendingCallbacks = [];
  }

  /**
   * Create a new task with the given ID and payload.  The taskId should
   * be unique, and the payload should have {duration}.
   */
  createTask(taskId, payload) {
    this._pendingTasks.push({taskId, payload});
    this.emit('created', taskId);

    // call pending callbacks trying to get this task claimed until there
    // are no more pending callbacks or pending tasks.  This is more efficient
    // than having workers listen to the `created` event, as EventEmitter always
    // calls *all* listeners, even though only one will actually claim the task.
    while (this._pendingCallbacks.length > 0 && this._pendingTasks.length > 0) {
      this._pendingCallbacks.shift()();
    }
  }

  /**
   * Return a pending task, or nothing.  If nothing, then wait for a
   * 'created' event from this object and try again.
   */
  claimWork(workerId, numTasks) {
    this.emit('claimWork', workerId);
    // returns [] if numTasks > # of pending tasks
    const tasks = this._pendingTasks.splice(0, numTasks);
    tasks.forEach(task => {
      this.emit('started', task.taskId, workerId);
      this._runningTasks.set(task.taskId, task);
    });
    return tasks;
  }

  /**
   * Schedule a callback to be made when there is work that can be
   * claimed.  This will result in *one* call to the callback, after
   * which another must be scheduled.
   */
  onPending(cb) {
    this._pendingCallbacks.push(cb);
  }

  /**
   * Get the count of pending tasks
   */
  pendingTasks() {
    return this._pendingTasks.length;
  }

  /**
   * Indicate that a task is finished
   */
  resolveTask(taskId) {
    this.emit('resolved', taskId);
    this._runningTasks.delete(taskId);
  }

  /**
   * Stop the queue, checking that all tasks are resolved
   */
  stop() {
    assert.deepEqual([...this._pendingTasks.keys()], []);
    assert.deepEqual([...this._runningTasks.keys()], []);
  }
}

exports.Queue = Queue;
