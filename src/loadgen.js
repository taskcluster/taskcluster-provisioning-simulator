const {Component} = require('./component');

class LoadGenerator extends Component {
  constructor({core, queue}) {
    super({core});
    this.queue = queue;
  }

  stop() {}
}

exports.LoadGenerator = LoadGenerator;
