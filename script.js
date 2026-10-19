// Map frame and projection from the assignment spec.
const MAP_SCALE = 2;
const MAP_WIDTH = 1664 / MAP_SCALE;
const MAP_HEIGHT = 1393 / MAP_SCALE;
const LONGITUDE_RANGE = [-122.20085766666666, -121.27442433333333];
const LATITUDE_RANGE = [36.91311264279123, 37.53067882428926];

const mapFrame = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [LONGITUDE_RANGE[0], LATITUDE_RANGE[0]],
      [LONGITUDE_RANGE[1], LATITUDE_RANGE[1]]
    ]
  }
};

const projection = d3.geoMercator()
  .fitExtent([[0, 0], [MAP_WIDTH, MAP_HEIGHT]], mapFrame);

const DOT_RADIUS = 2;
const ACTIVE_COLOR = "#2b6cb0";

const canvas = document.getElementById("dots");
const ctx = canvas.getContext("2d");

// The CSV stores missing values as the string "null".
function parseNumber(value) {
  if (value === undefined || value === "" || value === "null") return null;
  const number = +value;
  return Number.isNaN(number) ? null : number;
}

function parseRow(d) {
  return {
    name: d["Facility Name"],
    address: d["Address"],
    placard: d["Latest placard color"],
    score: parseNumber(d["Latest Score"]),
    distance: parseNumber(d["Distance"]),
    lat: parseNumber(d["Latitude"]),
    lon: parseNumber(d["Longitude"]),
    rating: parseNumber(d["Rating"]),
    reviews: parseNumber(d["Number of reviews"])
  };
}

// Size the canvas backing store for the screen's pixel ratio so dots stay sharp.
function setupCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = MAP_WIDTH * ratio;
  canvas.height = MAP_HEIGHT * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawDots(restaurants) {
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  ctx.fillStyle = ACTIVE_COLOR;
  ctx.beginPath();
  for (const r of restaurants) {
    ctx.moveTo(r.x + DOT_RADIUS, r.y);
    ctx.arc(r.x, r.y, DOT_RADIUS, 0, 2 * Math.PI);
  }
  ctx.fill();
}

d3.csv("sccRestaurantsSynth2026.csv", parseRow).then(rows => {
  const mapped = rows.filter(r => r.lat !== null && r.lon !== null);
  for (const r of mapped) {
    [r.x, r.y] = projection([r.lon, r.lat]);
  }

  setupCanvas();
  drawDots(mapped);

  const format = d3.format(",");
  document.getElementById("count").textContent =
    `${format(mapped.length)} mapped restaurants`;
  document.getElementById("missing").textContent =
    `${format(rows.length - mapped.length)} of ${format(rows.length)} have no location and are not shown.`;
});
