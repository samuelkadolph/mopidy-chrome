function Mopidy(url, options) {
  this.error = null;
  this.muted = null;
  this.onStateChanged = null;
  this.state = null;
  this.status = null;
  this.time = null;
  this.track = null;
  this.volume = null;

  if (options && options.mock) {
    this._connection = new MopidyMockConnection();
  } else {
    this._connection = new MopidyConnection(normalizeURL(url).replace(/^http(s)?:\/\//, "ws$1://") + "/mopidy/ws");
  }

  this._connection.onConnecting = this._onConnecting.bind(this);
  this._connection.onEvent = this._onEvent.bind(this);
  this._connection.onOnline = this._onOnline.bind(this);
  this._connection.onOffline = this._onOffline.bind(this);

  this._onConnecting();
}

Mopidy.prototype.attemptReconnect = function() {
  this._connection.attemptReconnect();
};

Mopidy.prototype.mute = function() {
  this._connection.rpc("core.mixer.set_mute", { mute: true });
};

Mopidy.prototype.muteUnmute = function() {
  this.muted ? this.unmute() : this.mute();
};

Mopidy.prototype.next = function() {
  this._playThen("core.playback.next");
};

Mopidy.prototype.pause = function() {
  this._connection.rpc("core.playback.pause");
};

Mopidy.prototype.play = function() {
  this._connection.rpc("core.playback.play");
};

Mopidy.prototype.playPause = function() {
  this.state == "playing" ? this.pause() : this.play();
};

Mopidy.prototype.previous = function() {
  this._playThen("core.playback.previous");
};

Mopidy.prototype.seek = function(time) {
  this._connection.rpc("core.playback.seek", { time_position: time });
};

Mopidy.prototype.setVolume = function(volume) {
  this._connection.rpc("core.mixer.set_volume", { volume: volume });
};

Mopidy.prototype.unmute = function() {
  this._connection.rpc("core.mixer.set_mute", { mute: false });
};

Mopidy.prototype.volumeDown = function() {
  if (this.volume >= 2) {
    this.setVolume(this.volume - 2);
  } else if (this.volume == 1) {
    this.setVolume(0);
  }
};

Mopidy.prototype.volumeUp = function() {
  if (this.volume <= 98) {
    this.setVolume(this.volume + 2);
  } else if (this.volume == 99) {
    this.setVolume(100);
  }
  this.setVolume(Math.min(this.volume + 2, 100));
};

Mopidy.prototype._onConnecting = function() {
  this.status = "connecting";
  this._sendStateChanged();
}

Mopidy.prototype._onEvent = function(data) {
  switch (data.event) {
    case "mute_changed":
      this.muted = data.mute;
      break;
    case "playback_state_changed":
      this.state = data.new_state;
      break;
    case "seeked":
      this._updateTime(data.time_position);
      break;
    case "track_playback_paused":
      this.state = "paused";
      this._updateTime(data.time_position);
      this._updateTrack(data.tl_track.track);
      break;
    case "track_playback_resumed":
      this.state = "playing";
      this._updateTime(data.time_position);
      this._updateTrack(data.tl_track.track);
      break;
    case "track_playback_started":
      this.state = "playing";
      this._updateTime(0);
      this._updateTrack(data.tl_track.track);
      break;
    case "volume_changed":
      this.volume = data.volume;
      break;
  }

  sendEvent(this, "StateChanged", this);
};

Mopidy.prototype._onOnline = function() {
  var calls = 5;
  var self = this;

  this.status = "online";

  this._connection.rpc("core.mixer.get_mute", function(muted) {
    self.muted = muted;
    if (--calls == 0) self._sendStateChanged();
  });
  this._connection.rpc("core.mixer.get_volume", function(volume) {
    self.volume = volume;
    if (--calls == 0) self._sendStateChanged();
  });
  this._connection.rpc("core.playback.get_current_track", function(track) {
    self._updateTrack(track);
    if (--calls == 0) self._sendStateChanged();
  });
  this._connection.rpc("core.playback.get_state", function(state) {
    self.state = state;
    if (--calls == 0) self._sendStateChanged();
  });
  this._connection.rpc("core.playback.get_time_position", function(time) {
    self._updateTime(time);
    if (--calls == 0) self._sendStateChanged();
  });
};

Mopidy.prototype._onOffline = function(error) {
  this.error = error;
  this.status = "offline";
  this._sendStateChanged();
};

Mopidy.prototype._playThen = function(method) {
  var connection = this._connection;

  connection.rpc("core.playback.get_state", function(state) {
    if (state != "playing") {
      connection.rpc("core.playback.play", function() {
        connection.rpc(method);
      });
    } else {
      connection.rpc(method);
    }
  });
};

Mopidy.prototype._sendStateChanged = function() {
  sendEvent(this, "StateChanged", this);
};

Mopidy.prototype._updateTrack = function(track) {
  if (track != null) {
    this.track = new MopidyTrack(track);
  }
};

Mopidy.prototype._updateTime = function(time) {
  if (time != null) {
    this.time = { at: new Date().getTime(), milliseconds: time };
  }
};

Mopidy.test = function(url, callback) {
  var req = new XMLHttpRequest();
  var rpc = { id: 0, jsonrpc: "2.0", method: "core.get_version" };

  url = normalizeURL(url) + "/mopidy/rpc";

  req.onreadystatechange = function() {
    if (this.readyState == 4) {
      if (this.status == 200) {
        var response = JSON.parse(this.responseText);

        if (response.result) {
          callback(true);
          return;
        }
      }

      callback(false);
    }
  }

  req.open("POST", url, true);
  req.setRequestHeader("Content-Type", "application/json");
  req.send(JSON.stringify(rpc));
};

function MopidyConnection(url) {
  this.onConnecting = null;
  this.onEvent = null;
  this.onOffline = null;
  this.onOnline = null;
  this.status = null;
  this.url = url;

  this._rpcCount = 0;
  this._rpcCallbacks = {};

  this._connect();

  setInterval(this._keepAlive.bind(this), 10000);
}

MopidyConnection.prototype.attemptReconnect = function() {
  if (this.status == "offline") {
    this._connect();
  }
};

MopidyConnection.prototype.rpc = function(method, params, callback) {
  var payload = {};

  payload.id = this._rpcCount++;
  payload.jsonrpc = "2.0";
  payload.method = method;

  if (typeof(params) == "function") {
    callback = params;
  } else if (params) {
    payload.params = params;
  }

  if (callback) {
    this._rpcCallbacks[payload.id] = callback;
  }

  this._send(payload);
};

MopidyConnection.prototype._connect = function() {
  this.status = "connecting";
  sendEvent(this, "Connecting");

  this._ws = new WebSocket(this.url);
  this._ws.onclose = this._onClose.bind(this);
  this._ws.onerror = this._onError.bind(this);
  this._ws.onmessage = this._onMessage.bind(this);
  this._ws.onopen = this._onOpen.bind(this);
};

MopidyConnection.prototype._keepAlive = function() {
  var self = this;

  this.rpc("core.playback.get_time_position", function(time) {
    // Fake Event to pass updated time
    sendEvent(self, "Event", { event: "seeked", time_position: time });
  });
};

MopidyConnection.prototype._onClose = function(event) {
  console.log("MopidyConnection._onClose", event);

  this.status = "offline";
  sendEvent(this, "Offline");

  this._reconnect();
};

MopidyConnection.prototype._onError = function(event) {
  console.log("MopidyConnection._onError", event);

  // ¯\_(ツ)_/¯
};

MopidyConnection.prototype._onMessage = function(event) {
  var data = JSON.parse(event.data);

  console.log("MopidyConnection._onMessage", data);

  if ("event" in data) {
    sendEvent(this, "Event", data);
  } else if ("id" in data) {
    if (this._rpcCallbacks[data.id]) {
      this._rpcCallbacks[data.id](data.result);
      delete this._rpcCallbacks[data.id];
    }
  }
};

MopidyConnection.prototype._onOpen = function(event) {
  console.log("MopidyConnection._onOpen", event);

  this.status = "online";
  sendEvent(this, "Online");
};

MopidyConnection.prototype._reconnect = function() {
  // TODO: Better logic

  // setTimeout(this._connect.bind(this), 2000);
};

MopidyConnection.prototype._send = function(payload) {
  console.log("MopidyConnection._send", payload);

  this._ws.send(JSON.stringify(payload));
};

function MopidyTrack(attributes) {
  this.album = attributes.album.name;
  this.artist = attributes.album.artists.map(function(album) { return album.name }).join(" & ");
  this.length = attributes.length;
  this.name = attributes.name;
}

var normalizeURL = function(url) {
  if (url.indexOf("http://") != 0 && url.indexOf("https://") != 0) {
    url = "http://" + url;
  }

  if (url.slice(-1) == "/") {
    url = url.slice(0, -1);
  }

  return url;
};

var sendEvent = function(self, event, ...args) {
  console.log("" + self.constructor.name + ".on" + event, ...args);

  if (typeof(self["on" + event]) == "function") {
    self["on" + event](...args);
  }
};
