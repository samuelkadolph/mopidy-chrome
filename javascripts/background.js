var mopidy;

var attemptReconnect = function() {
  if (mopidy) {
    mopidy.attemptReconnect();
  }
};

var init = function() {
  chrome.storage.local.get(null, function(options) {
    var url = options.url;

    mopidy = new Mopidy(url, { mock: options.mock });
    mopidy.onStateChanged = sendState;
  });
};

var sendCommand = function(args) {
  if (mopidy && args) {
    mopidy[args.shift()](...args);
  }
};

var sendState = function() {
  var state = {};

  if (mopidy) {
    state.error = mopidy.error;
    state.muted = mopidy.muted;
    state.state = mopidy.state;
    state.status = mopidy.status;
    state.time = mopidy.time;
    state.track = mopidy.track;
    state.volume = mopidy.volume;
  } else {
    state.status = "offline";
  }

  chrome.extension.sendMessage({ event: "state", state: state });
};

chrome.commands.onCommand.addListener(function(command) {
  command = command.slice(2); // Remove ordering hack (N_ prefix)

  console.log("chrome.commands.onCommand", command);

  if (mopidy) {
    mopidy[command]();
  }
});

chrome.extension.onMessage.addListener(function(message) {
  console.log("chrome.extension.onMessage", message)

  switch(message.method) {
    case "attemptReconnect":
      attemptReconnect();
      break;
    case "sendCommand":
      sendCommand(message.args);
      break;
    case "getState":
      sendState();
      break;
  }
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
  console.log("chrome.storge.onChanged");

  mopidy = null;

  init();
});

init();