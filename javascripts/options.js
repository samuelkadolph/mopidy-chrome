var optionsCancel = function() {
  close();
};
var optionsOK = function() {
  var options = {
    mock: mockGet(),
    url: urlGet()
  }

  chrome.storage.local.set(options, function() {
    if (chrome.runtime.lastError) {
      console.log("optionsOK() chrome.storage.local.set failed:", chrome.runtime.lastError.message);
    }

    close();
  });
};
var optionsRestore = function() {
  chrome.storage.local.get(null, function(options) {
    mockSet(options.mock);
    urlSet(options.url);
  });
};

var mockGet = function() {
  return document.getElementById("mock").checked;
};
var mockSet = function(value) {
  document.getElementById("mock").checked = value === true;
};

var urlTestTimer = null;
var urlGet = function() {
  return document.getElementById("url").value;
};
var urlOnInput = function() {
  document.getElementById("url-test").className = "";

  if (urlTestTimer !== null) {
    clearTimeout(urlTestTimer);
  }

  var url = urlGet();

  urlTestTimer = setTimeout(function() { urlTest(url) }, 500);
};
var urlSet = function(value) {
  if (value === undefined || value === null) { return };

  document.getElementById("url").value = value;

  urlTest(value);
};
var urlTest = function(url) {
  Mopidy.test(url, function(result) {
    if (urlGet() === url) {
      document.getElementById("url-test").className = result ? "ok" : "fail";
    }
  });

  document.getElementById("url-test").className = "spin";
};

chrome.management.getSelf(function(info) {
  if (info.installType == "development") {
    document.body.className = "development";
  }
});

document.getElementById("cancel").addEventListener("click", optionsCancel);
document.getElementById("ok").addEventListener("click", optionsOK);
document.getElementById("url").addEventListener("input", urlOnInput);

optionsRestore();
