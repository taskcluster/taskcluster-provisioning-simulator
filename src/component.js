const {EventEmitter} = require('events');

class Component extends EventEmitter {
  constructor({core, name}) {
    super();
    this.core = core;
    this.name = name;
    this.log = core.logger(name || this.constructor.name);
  }
}

exports.Component = Component;
