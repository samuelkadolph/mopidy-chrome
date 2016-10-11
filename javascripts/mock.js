var tracks = [
  { name: "Same Ol' Situation (SOS)", artist: "Motley Crue", album: "Dr. Feelgood (20th Anniversary Edition)", length: 18000 },
  { name: "Turn up the Radio", artist: "Autograph", album: "Sign In Please", length: 22000 },
  { name: "Fantasy", artist: "Aldo Nova", album: "Aldo Nova", length: 26000 },
  { name: "Sweet Dreams (Are Made of This) (Remastered)", artist: "Eurythmics", album: "Sweet Dreams (Are Made Of This)", length: 28000 }
];

MopidyMockConnection = function() {
  var muted = false;
  var state = "paused";
  var time = 5000;
  var track = 0;
  var volume = 0;
};
