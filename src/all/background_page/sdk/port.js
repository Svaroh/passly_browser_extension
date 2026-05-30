/**
 * Port Chrome Wrapper
 *
 * @copyright (c) 2017 Passbolt SARL
 * @licence GNU Affero General Public License http://www.gnu.org/licenses/agpl-3.0.en.html
 */
import Log from "../model/log";
import { v4 as uuidv4 } from "uuid";

class Port {
  /**
   * Constructor
   * @param {port} port
   */
  constructor(port) {
    if (!port) {
      throw Error("A port is required.");
    }
    this._listeners = {};
    this._disconnectListeners = {};
    this._port = port;
    this._connected = true;
    this._port.onMessage.addListener((msg) => {
      this._onMessage(msg);
    });
    this._port.onDisconnect.addListener(() => this._onDisconnect());
  }

  /**
   * When the port is disconnected, reject all waiting promises and delete listener
   * @private
   */
  _onDisconnect() {
    this._connected = false;
    const applyAndDeleteDisconnectListener = (requestId) => {
      this._disconnectListeners[requestId]?.();
      delete this._disconnectListeners[requestId];
    };
    Object.keys(this._disconnectListeners).forEach(applyAndDeleteDisconnectListener);
  }

  /**
   * When a message is received on the port
   * Triggers all the callback associated with that message name
   *
   * @param json
   * @private
   */
  _onMessage(json) {
    const msg = JSON.parse(json);
    const eventName = msg[0];
    if (Array.isArray(this._listeners[eventName])) {
      const listeners = this._listeners[eventName];
      for (let i = 0; i < listeners.length; i++) {
        const listener = listeners[i];
        const args = Array.prototype.slice.call(msg, 1);
        listener.callback.apply(this, args);
        if (listener.once) {
          this._listeners[eventName].splice(i, 1);
          // delete the listener if empty array
          if (this._listeners[eventName].length === 0) {
            delete this._listeners[eventName];
          }
          i--; // jump back since i++ is the new i
        }
      }
    }
  }

  /**
   * Add listener for a message name on the current port
   *
   * @param name string
   * @param callback function
   * @param once bool
   * @private
   */
  _addListener(name, callback, once) {
    if (!Array.isArray(this._listeners[name])) {
      this._listeners[name] = [];
    }
    this._listeners[name].push({
      name: name,
      callback: callback,
      once: once,
    });
  }

  /**
   * On message name triggers a callback
   *
   * @param name
   * @param callback
   */
  on(name, callback) {
    this._addListener(name, callback, false);
  }

  /**
   * On message name triggers a callback only once,
   * e.g. remove the listener once the message has been received
   *
   * @param name
   * @param callback
   */
  once(name, callback) {
    this._addListener(name, callback, true);
  }

  /**
   * Emit a message to the content code
   * @param requestArgs the arguments
   */
  emit(...requestArgs) {
    const message = JSON.stringify(requestArgs);
    Log.write({ level: "debug", message: `Port emit @ message: ${message}` });
    this.tryPostMessage(message);
  }

  /**
   * Emit a message quiet to the content code
   * @param requestArgs the arguments
   */
  async emitQuiet(...requestArgs) {
    const message = JSON.stringify(requestArgs);
    this.tryPostMessage(message);
  }

  /**
   * Try to post a message to the content code without failing the caller when
   * the tab has already navigated and disconnected the runtime port.
   * @param {string} message The serialized message.
   * @returns {boolean}
   */
  tryPostMessage(message) {
    try {
      this.postMessage(message);
      return true;
    } catch {
      this._connected = false;
      return false;
    }
  }

  /**
   * Post a message to the content code.
   * @param {string} message The serialized message.
   * @returns {void}
   */
  postMessage(message) {
    if (!this.isConnected()) {
      throw new Error("Attempt to postMessage on disconnected port");
    }

    try {
      this._port.postMessage(message);
    } catch (error) {
      this._connected = false;
      throw error;
    }
  }

  /**
   * Whether the wrapped browser runtime port is still connected.
   * @returns {boolean}
   */
  isConnected() {
    return this._connected;
  }

  /**
   * Emit a request to the content code and expect a response.
   * @param message the message
   * @param args the arguments
   * @return Promise
   */
  request(message, ...args) {
    // Generate a request id that will be used by the addon to answer this request.
    const requestId = uuidv4();
    // Add the requestId to the request parameters.
    const requestArgs = [message, requestId].concat(args);

    // The promise that is return when you call passbolt.request.
    return new Promise((resolve, reject) => {
      /*
       * Observe when the request has been completed.
       * Or if a progress notification is sent.
       */
      this.once(requestId, (status, ...callbackArgs) => {
        if (status === "SUCCESS") {
          resolve.apply(null, callbackArgs);
        } else if (status === "ERROR") {
          reject(this.normalizeErrorResponse(callbackArgs));
        }
        delete this._disconnectListeners[requestId];
      });
      // Add reject to the disconnect listener
      this._disconnectListeners[requestId] = () =>
        reject(new Error("The port disconnected before the request completed."));
      try {
        const message = JSON.stringify(requestArgs);
        Log.write({ level: "debug", message: `Port request @ message: ${message}` });
        this.postMessage(message);
      } catch (error) {
        delete this._listeners[requestId];
        delete this._disconnectListeners[requestId];
        reject(error);
      }
    });
  }

  /**
   * Disconnect the port
   *
   * @return {void}
   */
  disconnect() {
    this._connected = false;
    this._port.disconnect();
  }

  /**
   * Normalize request error response payloads.
   * @param {Array} callbackArgs The response callback arguments.
   * @returns {*} The error value.
   */
  normalizeErrorResponse(callbackArgs) {
    if (callbackArgs.length > 0 && typeof callbackArgs[0] !== "undefined" && callbackArgs[0] !== null) {
      return callbackArgs[0];
    }
    return new Error("The request failed without error details.");
  }
}

export default Port;
