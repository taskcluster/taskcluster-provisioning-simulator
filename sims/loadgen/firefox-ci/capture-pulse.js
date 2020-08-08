const fs = require('fs');
const debug = require('debug');
const events = require('events');
const amqplib = require('amqplib');
const assert = require('assert');
const slugid = require('slugid');

/**
 * NOTE: this is meant to be run directly!
 *
 * AMQP_URL=amqps://USER:PASS@HOST/VHOST AMQP_NAMESPACE=USER node sims/loadgen/capture-pulse.js WORKERPOOL
 */

/**
 * Shamelessly stolen from taskcluster-lib-pulse, with references to monitor removed.
 */

let clientCounter = 0;

class Client extends events.EventEmitter {
  constructor({namespace, recycleInterval, retirementDelay, minReconnectionInterval, credentials,
    username, password, hostname, vhost, connectionString}) {
    super();

    assert(!username, 'username is deprecated');
    assert(!password, 'password is deprecated');
    assert(!hostname, 'hostname is deprecated');
    assert(!vhost, 'vhost is deprecated');
    assert(!connectionString, 'connectionString is deprecated');

    assert(credentials, 'credentials is required');
    this.credentials = credentials;

    assert(namespace, 'namespace is required');
    this.namespace = namespace;
    this._retirementDelay = retirementDelay || 30 * 1000;
    this._minReconnectionInterval = minReconnectionInterval || 15 * 1000;
    this.running = false;
    this.connections = [];
    this.lastConnectionTime = 0;
    this.id = ++clientCounter;

    // we might have many event listeners in a busy service, each listening for
    // 'connected'
    this.setMaxListeners(Infinity);

    this.running = true;
    this.recycle();

    this._recycleInterval = setInterval(
      () => this.recycle(),
      recycleInterval || 3600 * 1000);
  }

  async stop() {
    assert(this.running, 'Not running');
    this.running = false;
    clearInterval(this._recycleInterval);
    this._recycleInterval = null;

    this.recycle();

    // wait until all existing connections are finished
    const unfinished = this.connections.filter(conn => conn.state !== 'finished');
    if (unfinished.length > 0) {
      await Promise.all(unfinished.map(
        conn => new Promise(resolve => { conn.once('finished', resolve); })));
    }
  }

  /**
   * Create a new connection, retiring any existing connection.  This is a "fire-
   * and-forget" method, that will never throw an exception and need not be
   * awaited.
   */
  recycle() {
    try {
      // Note that errors here are likely to leave the connection in a "hung" state;
      // nothing here should depend on network access or anything else that can
      // fail intermittently.
      if (this.connections.length) {
        const currentConn = this.connections[0];
        currentConn.retire();
      }

      if (this.running) {
        const newConn = this._startConnection();

        newConn.once('connected', () => {
          this.emit('connected', newConn);
        });
        newConn.once('finished', () => {
          this.connections = this.connections.filter(conn => conn !== newConn);
        });
        newConn.once('failed', () => {
          this.recycle();
        });
        this.connections.unshift(newConn);
      }
    } catch (err) {
      console.error(err);
    }
  }

  _startConnection() {
    // This method is part of recycle() and bears the same cautions about failure
    const newConn = new Connection(this._retirementDelay);

    // don't actually start connecting until at least minReconnectionInterval has passed
    const earliestConnectionTime = this.lastConnectionTime + this._minReconnectionInterval;
    const now = new Date().getTime();
    setTimeout(async () => {
      if (newConn.state !== 'waiting') {
        // the connection is no longer waiting, so don't proceed with
        // connecting (this is rare, but can occur if the recycle timer
        // occurs at just the wrong moment)
        return;
      }

      try {
        this.lastConnectionTime = new Date().getTime();
        const {connectionString} = await this.credentials();
        newConn.connect(connectionString);
      } catch (err) {
        newConn.failed();
      }
    }, now < earliestConnectionTime ? earliestConnectionTime - now : 0);

    return newConn;
  }

  /**
   * Get a full object name, following the Pulse security model,
   * `<kind>/<namespace>/<name>`.  This is useful for manipulating these objects
   * directly, for example to modify the bindings of an active queue.
   */
  fullObjectName(kind, name) {
    assert(kind, 'kind is required');
    assert(name, 'name is required');
    return `${kind}/${this.namespace}/${name}`;
  }

  /**
   * Listen for a `connected` event, but call the handler with the existing connection
   * if this client is already connected.  Returns a callable that will stop listening.
   */
  onConnected(handler) {
    this.on('connected', handler);
    const conn = this.activeConnection;
    if (conn) {
      handler(conn);
    }
    return () => this.removeListener('connected', handler);
  }

  /**
   * The active connection, if any.  This is useful when starting to use an already-
   * running client (which is what onConnected does for you):
   *   client.on('connected', setupConnection);
   *   if (client.activeConnection) {
   *     await setupConnection(client.activeConnection);
   *   }
   */
  get activeConnection() {
    if (this.running && this.connections.length && this.connections[0].state === 'connected') {
      return this.connections[0];
    }
    return undefined;
  }

  /**
   * Run the given async function with a connection.  This is similar to
   * client.once('connected', ..), except that it will fire immediately if
   * the client is already connected.  This does *not* automatically re-run
   * the function if the connection fails.
   */
  withConnection(fn) {
    if (this.activeConnection) {
      return fn(this.activeConnection);
    }

    return new Promise((resolve, reject) => {
      this.once('connected', conn => Promise.resolve(fn(conn)).then(resolve, reject));
    });
  }

  /**
   * Run the given async function with an amqplib channel or confirmChannel. This wraps
   * withConnection to handle closing the channel.
   */
  withChannel(fn, {confirmChannel} = {}) {
    return this.withConnection(async conn => {
      const method = confirmChannel ? 'createConfirmChannel' : 'createChannel';
      const channel = await conn.amqp[method]();

      // any errors on this channel will be handled as exceptions thrown within `fn`,
      // so the events can be ignored
      channel.on('error', () => {});

      try {
        return await fn(channel);
      } finally {
        try {
          await channel.close();
        } catch (err) {
          if (!(err instanceof amqplib.IllegalOperationError)) {
            // IllegalOperationError happens when we are closing a broken
            // channel; any other error trying to close the channel suggests
            // the connection is dead, so mark it failed.
            conn.failed();
          }
        }
      }
    });
  }
}

exports.Client = Client;

let nextConnectionId = 1;

/**
 * A single connection to a pulse server.  This is a thin wrapper around a raw
 * AMQP connection, instrumented to inform the parent Client of failures
 * and trigger a reconnection.  It is possible to have multiple Connection
 * objects in the same process at the same time, while one is being "retired" but
 * is lingering around to send ack's for any in-flight message handlers.
 *
 * The instance's `amqp` property is the amqp connection object.  In the event of any
 * issues with the connection, call the instance's `failed` method.  This will initiate
 * a retirement of the connection and creation of a new connection.
 *
 * The instance will emit a `connected` event when it connects to the pulse server.
 * This event occurs before the connection is provided to a user, so it is only
 * of interest to the Client class.
 *
 * This instance will emit a `retiring` event just before it is retired.  Users
 * should cancel consuming from any channels, as a new connection will soon
 * begin consuming.  Errors from such cancellations should be logged and
 * ignored.  This connection will remain open for 30 seconds to allow any
 * in-flight message processing to complete.
 *
 * The instance will emit `finished` when the connection is finally closed.
 *
 * A connection's state can be one of
 *
 *  - waiting -- waiting for a call to connect() (for minReconnectionInterval)
 *  - connecting -- waiting for a connection to complete
 *  - connected -- connection is up and running
 *  - retiring -- in the process of retiring
 *  - finished -- no longer connected
 *
 *  Note that an instance that fails to connect will skip from `connecting` to
 *  `retiring`.
 *
 */
class Connection extends events.EventEmitter {
  constructor(retirementDelay) {
    super();

    this.retirementDelay = retirementDelay;
    this.id = nextConnectionId++;
    this.amqp = null;

    // we might have many event listeners in a busy service, each listening for
    // 'retiring'
    this.setMaxListeners(Infinity);

    this.state = 'waiting';
  }

  async connect(connectionString) {
    if (this.state !== 'waiting') {
      return;
    }

    this.state = 'connecting';

    const amqp = await amqplib.connect(connectionString, {
      heartbeat: 120,
      noDelay: true,
      timeout: 30 * 1000,
    }).catch(err => {
      console.error(err);
      this.failed();
    });

    if (amqp) {
      if (this.state !== 'connecting') {
        // we may have been retired already, in which case we do not need this
        // connection
        amqp.close();
        return;
      }
      this.amqp = amqp;

      amqp.on('error', err => {
        console.error(err);
        if (this.state === 'connected') {
          this.failed();
        }
      });

      amqp.on('close', err => {
        if (this.state === 'connected') {
          this.failed();
        }
      });

      // pass on blocked/unblocked messages; see
      // https://www.rabbitmq.com/connection-blocked.html#capabilities. Amqplib
      // includes 'connection.blocked' in the client properties for us
      amqp.on('blocked', () => { this.emit('blocked'); });
      amqp.on('unblocked', () => { this.emit('unblocked'); });

      this.state = 'connected';
      this.emit('connected');
    }
  }

  failed() {
    if (this.state === 'retired' || this.state === 'finished') {
      // failure doesn't matter at this point
      return;
    }
    this.emit('failed');
  }

  retire() {
    if (this.state === 'retiring' || this.state === 'finished') {
      return;
    }

    this.state = 'retiring';
    this.emit('retiring');

    // actually close this connection 30 seconds later
    setTimeout(() => {
      if (this.amqp) {
        // ignore errors in close
        this.amqp.close().catch(err => {});
      }
      this.amqp = null;
      this.state = 'finished';
      this.emit('finished');
    }, this.retirementDelay);
  }
}

/**
 * Recognize some "expected", ignorable errors due to normal network failures.
 */
const isExpectedError = err => {
  // IllegalOperationError happens when we are draining a broken channel; ignore
  if (err instanceof amqplib.IllegalOperationError) {
    return true;
  }

  // similarly, an error with this text is sent in some failure modes.  See
  // https://github.com/streadway/amqp/issues/409 for a request for a better
  // way to recognize this
  if (err.message.match(/no reply will be forthcoming/)) {
    return true;
  }
};

/**
 * A PulseConsumer declares a queue and listens for messages on that
 * queue, invoking a callback for each message.
 *
 * If ephemeral is true, then this consumer will use ephemeral queues
 * that are deleted on disconnection.  This may lead to loss of messages,
 * and the caller must handle this via the onConnected handler.
 */
class PulseConsumer {
  constructor({client, bindings, queueName, ephemeral, prefetch, onConnected, handleMessage, ...queueOptions}) {
    assert(handleMessage, 'Must provide a message handler function');

    this.client = client;
    this.bindings = bindings;
    this.handleMessage = handleMessage;
    this.prefetch = typeof prefetch !== 'undefined' ? prefetch : 5;
    this.queueOptions = queueOptions;

    if (ephemeral) {
      assert(!queueName, 'Must not pass a queueName for ephemeral consumers');
      assert(onConnected, 'Must pass onConnected for ephemeral consumers');
    } else {
      assert(queueName, 'Must pass a queueName');
      this.queueName = queueName;
    }
    this.ephemeral = ephemeral;
    this.onConnected = onConnected || (() => {});

    this._handleConnection = this._handleConnection.bind(this);

    // false once stop() has been called
    this.running = true;

    // the current channel and consumerTag, if any
    this.channel = null;
    this.consumerTag = null;

    // number of messages being processed right now, and a function to call
    // when that number goes to zero
    this.processingMessages = 0;
    this.idleCallback = null;

    this.debug = debug('pulse-consumer');
  }

  /**
   * Create and bind the queue, then start listening.  When this method has
   * returned, the queue is established and bound to the exchanges given in
   * the consumer.
   *
   * In the public API, this is called automatically by `consume`
   */
  async _start() {
    // first make sure the queue is bound
    await this.client.withChannel(channel => this._createAndBindQueue(channel));

    // then set up to call _handleConnection on all connections
    this.stopHandlingConnections = this.client.onConnected(this._handleConnection);
  }

  /**
   * Stop listening.  After this call, no further messages will be consumed
   * from the queue.  The queue and any bindings will remain configured on the
   * server.  This method will return after any pending consumers have
   * completed (ack or nack).
   */
  async stop() {
    if (!this.running) {
      return;
    }
    this.running = false;

    // stop listening for new Connections
    this.stopHandlingConnections();

    // and drain the channel..
    await this._drainChannel();

    // (for testing)
    if (this._stoppedCallback) {
      this._stoppedCallback();
    }
  }

  /**
   * Stop listening on this channel, but don't actually stop the consumer. This is
   * done when the connection is recycling, when hopefully at the same time a new
   * connection is coming up.
   */
  async _drainChannel() {
    const {channel, consumerTag} = this;

    if (channel && consumerTag) {
      this.consumerTag = null;
      try {
        await channel.cancel(consumerTag);
      } catch (err) {
        if (!isExpectedError(err)) {
          throw err;
        }
      }
    }

    // if messages are being processed, arrange to continue when they
    // are all handled
    if (this.processingMessages > 0) {
      await new Promise(resolved => {
        this.idleCallback = resolved;
      });
    }

    if (channel) {
      this.channel = null;
      try {
        await channel.close();
      } catch (err) {
        if (!isExpectedError(err)) {
          throw err;
        }
      }
    }
  }

  async _createAndBindQueue(channel) {
    const queueName = this.client.fullObjectName(
      'queue',
      // for ephemeral queues, generate a new queueName on every connection,
      // as autodelete is not an immediate operation
      this.ephemeral ? slugid.nice() : this.queueName);
    await channel.assertQueue(queueName, {
      exclusive: this.ephemeral,
      durable: true,
      autoDelete: this.ephemeral,
      ...this.queueOptions,
    });

    for (let {exchange, routingKeyPattern} of this.bindings) {
      await channel.bindQueue(queueName, exchange, routingKeyPattern);
    }

    return queueName;
  }

  /**
   * Handle a new connection to the pulse server, re-declaring everything
   * and setting up the consumer.
   */
  async _handleConnection(conn) {
    try {
      if (!this.running) {
        return;
      }

      const amqp = conn.amqp;
      const channel = await amqp.createChannel();
      await channel.prefetch(this.prefetch);
      const queueName = await this._createAndBindQueue(channel);
      this.channel = channel;

      // consider any errors on the channel to be potentially fatal to the
      // connection (better safe than sorry)
      channel.on('error', () => conn.failed());

      // NOTE: channel.consume is not async!  In fact, await'ing it can
      // result in a message arriving before the onConnected callback is
      // invoked.
      const consumer = channel.consume(queueName, async (msg) => {
        // If the consumer is cancelled by RabbitMQ, the message callback will
        // be invoked with null.  This might happen if the queue is deleted, in
        // which case we probably want to reconnect and redeclare everything.
        if (msg === null) {
          this.debug(`${queueName} consumer was deleted by rabbitmq`);
          conn.failed();
          return;
        }

        try {
          this.processingMessages++;
          try {
            await this._handleMessage(msg);
          } catch (err) {
            if (msg.fields.redelivered) {
              // if this was already delivered, we're going to give up and report it
              channel.nack(msg, false, false);
              console.error(err);
            } else {
              channel.nack(msg, false, true);
            }
            return;
          }
          channel.ack(msg);
        } catch (err) {
          // the error handling in the inner try block went badly, so this
          // channel is probably sick; but if this is an expected error,
          // there's no need to report it (that is basically saying the channel
          // has closed, so we'll re-connect)
          if (!isExpectedError(err)) {
            console.error(err);
          }
          conn.failed();
        } finally {
          this.processingMessages--;
          if (this.processingMessages === 0 && this.idleCallback) {
            this.idleCallback();
          }
        }
      });
      this.consumerTag = consumer.consumerTag;

      // now that we're listening for messages, inform the user that we were
      // reconnected and might have lost messages
      await this.onConnected();

      // when retirement of this connection begins, stop consuming on this
      // channel and close the channel as soon sa all messages are handled.
      conn.on('retiring', async () => {
        try {
          await this._drainChannel();
        } catch (err) {
          console.error(err);
        }
      });
    } catch (err) {
      console.error(err);
      conn.failed();
    }
  }

  async _handleMessage(msg) {
    // Construct message
    let message = {
      payload: JSON.parse(msg.content.toString('utf8')),
      exchange: msg.fields.exchange,
      routingKey: msg.fields.routingKey,
      redelivered: msg.fields.redelivered,
      routes: [],
    };

    // Find CC'ed routes
    if (msg.properties && msg.properties.headers &&
        msg.properties.headers.CC instanceof Array) {
      message.routes = msg.properties.headers.CC.filter(function(route) {
        // Only return the CC'ed routes that starts with "route."
        return /^route\.(.*)$/.test(route);
      }).map(function(route) {
        // Remove the "route."
        return /^route\.(.*)$/.exec(route)[1];
      });
    }

    // Find routing key reference for this exchange, if any is available to us
    let routingKeyReference = null;
    this.bindings.forEach(binding => {
      if (binding.exchange === message.exchange && binding.routingKeyReference) {
        routingKeyReference = binding.routingKeyReference;
      }
    });

    // If we have a routing key reference we can parse the routing key
    if (routingKeyReference) {
      let i, j;
      let routing = {};
      let keys = message.routingKey.split('.');
      // first handle non-multi keys from the beginning
      for (i = 0; i < routingKeyReference.length; i++) {
        let ref = routingKeyReference[i];
        if (ref.multipleWords) {
          break;
        }
        routing[ref.name] = keys.shift();
      }
      // If we reached a multi key
      if (i < routingKeyReference.length) {
        // then handle non-multi keys from the end
        for (j = routingKeyReference.length - 1; j > i; j--) {
          let ref = routingKeyReference[j];
          if (ref.multipleWords) {
            break;
          }
          routing[ref.name] = keys.pop();
        }
        // Check that we only have one multiWord routing key
        assert(i === j, 'i != j really shouldn\'t be the case');
        routing[routingKeyReference[i].name] = keys.join('.');
      }

      // Provide parsed routing key
      message.routing = routing;
    }

    await this.handleMessage(message);
  }
}

const consume = async (options, handleMessage, onConnected) => {
  if (handleMessage) {
    options.handleMessage = handleMessage;
  }
  if (onConnected) {
    options.onConnected = onConnected;
  }
  if (options.client.isFakeClient) {
    return options.client.makeFakeConsumer(options);
  }

  const pq = new PulseConsumer(options);
  await pq._start();
  return pq;
};

const main = async () => {
  const workerPool = process.argv[2];
  const [provisionerId, workerType] = workerPool.split('/');

  const filename = workerPool.replace('/', '-') + '.csv';
  const output = fs.createWriteStream(filename);

  const credentials = () => ({connectionString: process.env.AMQP_URL});
  const client = new Client({
    namespace: process.env.AMQP_NAMESPACE,
    credentials,
  });

  const events = {
    'exchange/taskcluster-queue/v1/task-pending': 'pending',
    'exchange/taskcluster-queue/v1/task-running': 'running',
    'exchange/taskcluster-queue/v1/task-completed': 'completed',
    'exchange/taskcluster-queue/v1/task-failed': 'completed',
    'exchange/taskcluster-queue/v1/task-exception': 'completed',
  };

  const tasks = new Map();
  const start = Date.now();

  let pc = await consume({
    client,
    bindings: Object.keys(events).map(exchange => ({
      exchange,
      routingKeyPattern: `*.*.*.*.*.${provisionerId}.${workerType}.#`,
    })),
    queueName: workerPool,
    prefetch: 100,
    maxLength: 1000,
  }, async ({payload, exchange, routingKey, redelivered, routes, routing}) => {
    const event = events[exchange];
    const key = `${payload.status.taskId}-${payload.runId}`;
    const now = Date.now() - start;

    switch (event) {
      case 'pending': {
        tasks.set(key, [now]);
        break;
      }

      case 'running': {
        const t = tasks.get(key);
        if (t && t.length === 1) {
          t.push(now);
        } else {
          tasks.delete(t);
        }
        break;
      }

      case 'completed': {
        const t = tasks.get(key);
        if (t && t.length === 2) {
          t.push(now);
          console.log(`${key} finished`);
          // encode this as a pair (created-time, duration) of uint32's
          const b = Buffer.alloc(8);
          b.writeBigUInt32BE(t[0], 0);
          b.writeBigUInt32BE(t[2] - t[1], 4);
          output.write(b);
        } else {
          tasks.delete(t);
        }
        break;
      }
    }
  });
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
