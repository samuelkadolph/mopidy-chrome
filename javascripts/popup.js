var controlOnClick = function() {
  this.blur();

  chrome.extension.sendMessage({ method: "sendCommand", args: [this.id] });
};

var seekOnInput = function() {
  chrome.extension.sendMessage({ method: "sendCommand", args: ["seek", parseInt(document.getElementById("seek").value)] });
};

var timeTick = function() {
  var element = document.getElementById("time");

  if (!element.time) {
    return;
  }

  if (document.body.className.indexOf("playing") != -1) {
    var time = Math.min(new Date().getTime() - element.time.at + element.time.milliseconds, element.max);
  } else {
    var time = element.time.milliseconds;
  }

  element.innerText = timeToString(time);

  updateRange("seek", time);
};

var timeToString = function(milliseconds) {
  if (milliseconds === null) {
    return "";
  }

  var minutes = Math.floor(milliseconds / 1000 / 60);
  var seconds = Math.floor(milliseconds / 1000 % 60);

  return "" + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
};

var updateRange = function(id, value) {
  var element = document.getElementById(id);

  if (element !== document.activeElement) {
    element.value = value;
  }
};

var volumeOnInput = function() {
  chrome.extension.sendMessage({ method: "sendCommand", args: ["setVolume", parseInt(document.getElementById("volume").value)] });
};

chrome.extension.onMessage.addListener(function(message) {
  console.log("chrome.extension.onMessage", message);

  if (message.event != "state")
    return;

  var state = message.state;

  if ("track" in state) {
    document.getElementById("album").innerText = state.track.album;
    document.getElementById("artist").innerText = state.track.artist;
    document.getElementById("length").innerText = timeToString(state.track.length);
    document.getElementById("seek").max = state.track.length;
    document.getElementById("song").innerText = state.track.name;
    document.getElementById("time").max = state.track.length;
  } else {
    document.getElementById("album").innerText = "";
    document.getElementById("artist").innerText = "";
    document.getElementById("length").innerText = "";
    document.getElementById("song").innerText = "";
    document.getElementById("time").max = 36000;
  }

  // Update time after track because seek.max will truncate seek.value
  // TODO: better time code
  if ("time" in state) {
    document.getElementById("time").time = state.time;

    timeTick();
  } else {
    document.getElementById("time").innerText = "";
  }

  if ("time" in state && "track" in state) {
    document.getElementById("seek").disabled = false;
  } else {
    document.getElementById("seek").disabled = true;
  }

  if ("volume" in state) {
    updateRange("volume", state.volume);

    document.getElementById("volume").disabled = false;
  } else {
    document.getElementById("volume").disabled = true;
  }

  if (state.status == "online") {
    document.body.className = "online " + state.state + " " + (state.muted ? "muted" : "unmuted")
  } else {
    document.body.className = state.status + " stopped unmuted";
  }

  if (state.status == "offline" && "error" in state) {
    document.getElementById("error").innerText = state.error;
  }
});

document.getElementById("mute").addEventListener("click", controlOnClick);
document.getElementById("next").addEventListener("click", controlOnClick);
document.getElementById("pause").addEventListener("click", controlOnClick);
document.getElementById("play").addEventListener("click", controlOnClick);
document.getElementById("previous").addEventListener("click", controlOnClick);
document.getElementById("seek").addEventListener("change", seekOnInput);
document.getElementById("unmute").addEventListener("click", controlOnClick);
document.getElementById("volume").addEventListener("input", volumeOnInput);

chrome.extension.sendMessage({ method: "attemptReconnect" });
chrome.extension.sendMessage({ method: "getState" });

setInterval(timeTick, 50);
