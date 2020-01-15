'use strict';

const {
  MAGIC_BYTES,
  VERSION_NUMBER,
  HEADER_SIZE,
  MAX_MESSAGE_SIZE,
  P2P_IDENT_REQUEST,
  P2P_IDENT_RESPONSE,
  P2P_ROOT,
  P2P_PING,
  P2P_PONG,
  P2P_INSTRUCTION,
  P2P_BASE_MESSAGE,
  P2P_STATE_ROOT,
  P2P_STATE_COMMITTMENT,
  P2P_STATE_CHANGE
} = require('../constants');

const crypto = require('crypto');
const Vector = require('./vector');

/**
 * The {@link Message} type defines the Application Messaging Protocol, or AMP.
 * Each {@link Actor} in the network receives and broadcasts messages,
 * selectively disclosing new routes to peers which may have open circuits.
 * @type {Object}
 */
class Message extends Vector {
  /**
   * The `Message` type is standardized in {@link Fabric} as a {@link Vector}, which can be added to any other vector to compute a resulting state.
   * @param  {Vector} message Message vector.  Will be serialized by {@link Vector#_serialize}.
   * @return {Vector} Instance of the message.
   */
  constructor (input = {}) {
    super(input);

    this.raw = {
      magic: Buffer.alloc(4),
      version: Buffer.alloc(4),
      type: Buffer.alloc(4),
      size: Buffer.alloc(4),
      hash: Buffer.alloc(32),
      data: null
    };

    this.raw.magic.writeUInt32BE(MAGIC_BYTES);
    this.raw.version.writeUInt32BE(VERSION_NUMBER);

    return this;
  }

  /**
   * Returns a {@link Buffer} of the complete message.
   * @return {Buffer} Buffer of the encoded {@link Message}.
   */
  asRaw () {
    return Buffer.concat([this.header, this.raw.data]);
  }

  static fromRaw (input) {
    if (!input) return null;
    // if (input.length < HEADER_SIZE) return null;
    // if (input.length > MAX_MESSAGE_SIZE) return new Error('Input too large.');

    const message = new Message();

    message.raw = {
      magic: input.slice(0, 4),
      version: input.slice(4, 8),
      type: input.slice(8, 12),
      size: input.slice(12, 16),
      hash: input.slice(16, 48)
    };

    if (message.raw.size) {
      let size = message.raw.size.readUInt32BE();
      message.data = input.slice(HEADER_SIZE, HEADER_SIZE + size);
    }

    return message;
  }

  static fromVector (vector) {
    const message = new Message();
    message.type = vector[0];
    message.data = vector[1];
    return message;
  }

  /* get [Symbol.toStringTag] () {
    return `<Message | ${JSON.stringify(this.raw)}>`;
  } */

  get id () {
    return crypto.createHash('sha256').update(this.asRaw()).digest('hex');
  }

  get types () {
    // Message Types
    return {
      'IdentityRequest': P2P_IDENT_REQUEST,
      'IdentityResponse': P2P_IDENT_RESPONSE,
      // TODO: restore this type
      // 'StateRoot': P2P_ROOT,
      'Ping': P2P_PING,
      'Pong': P2P_PONG,
      'PeerInstruction': P2P_INSTRUCTION,
      'PeerMessage': P2P_BASE_MESSAGE,
      // TODO: restore above StateRoot type
      'StateRoot': P2P_STATE_ROOT,
      'StateCommitment': P2P_STATE_COMMITTMENT,
      'StateChange': P2P_STATE_CHANGE
    };
  }

  get magic () {
    return this.raw.magic;
  }

  get size () {
    return this.raw.size.readUInt32BE();
  }

  get version () {
    return this.raw.version.readUInt32BE();
  }

  get header () {
    return Buffer.concat([
      this.raw.magic,
      this.raw.version,
      this.raw.type,
      this.raw.size,
      this.raw.hash
    ]);
  }
}

Object.defineProperty(Message.prototype, 'type', {
  get () {
    const code = this.raw.type.readUInt32BE();
    switch (code) {
      default:
        console.warn('[FABRIC:MESSAGE]', "Unhandled message type:", code);
        return 'GenericMessage';
      case P2P_IDENT_REQUEST:
        return 'IdentityRequest';
      case P2P_IDENT_RESPONSE:
        return 'IdentityResponse';
      case P2P_STATE_ROOT:
        return 'StateRoot';
      case P2P_STATE_CHANGE:
        return 'StateChange';
    }
  },
  set (value) {
    const code = this.types[value];
    if (!code) throw new Error(`Unknown message type: ${value}`);
    this['@type'] = value;
    this.raw.type.writeUInt32BE(code);
  }
});

Object.defineProperty(Message.prototype, 'data', {
  get () {
    if (!this.raw.data) return '';
    return this.raw.data.toString('utf8');
  },
  set (value) {
    if (!value) value = '';
    let hash = crypto.createHash('sha256').update(value.toString('utf8'));
    this.raw.hash = hash.digest();
    this.raw.data = Buffer.from(value);
    this.raw.size.writeUInt32BE(this.raw.data.byteLength);
  }
});

module.exports = Message;
