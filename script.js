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

// Mercator is conformal, so one scale works in both directions. Measure it
// at the map center by projecting a point one mile north.
const EARTH_RADIUS_MILES = 3958.8;
const PIXELS_PER_MILE = (() => {
  const centerLat = (LATITUDE_RANGE[0] + LATITUDE_RANGE[1]) / 2;
  const centerLon = (LONGITUDE_RANGE[0] + LONGITUDE_RANGE[1]) / 2;
  const oneMileLat = (1 / EARTH_RADIUS_MILES) * (180 / Math.PI);
  const [, y0] = projection([centerLon, centerLat]);
  const [, y1] = projection([centerLon, centerLat + oneMileLat]);
  return Math.abs(y1 - y0);
})();

const DOT_RADIUS = 2;
const ACTIVE_COLOR = "#2b6cb0";
const INACTIVE_COLOR = "rgba(120, 126, 134, 0.45)";
const HANDLE_RADIUS = 11;

// A starts at Stanford, B in downtown Mountain View.
const circles = [
  { id: "A", lon: -122.17006, lat: 37.42766, radiusMiles: 3 },
  { id: "B", lon: -122.080, lat: 37.394, radiusMiles: 3 }
];
for (const c of circles) {
  [c.x, c.y] = projection([c.lon, c.lat]);
}

const canvas = document.getElementById("dots");
const ctx = canvas.getContext("2d");
const overlay = d3.select("#overlay");
const countLabel = document.getElementById("count");
const timingLabel = document.getElementById("timing");
const format = d3.format(",");

let restaurants = [];
let updateQueued = false;

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
    reviews: parseNumber(d["Number of reviews"]),
    active: true
  };
}

// Size the canvas backing store for the screen's pixel ratio so dots stay sharp.
function setupCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = MAP_WIDTH * ratio;
  canvas.height = MAP_HEIGHT * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

// Mark each restaurant active if it lies inside both circles. Compares squared
// distances so there is no square root per row.
function applyFilters() {
  const [a, b] = circles;
  const ra = a.radiusMiles * PIXELS_PER_MILE;
  const rb = b.radiusMiles * PIXELS_PER_MILE;
  const ra2 = ra * ra;
  const rb2 = rb * rb;
  let activeCount = 0;

  for (const r of restaurants) {
    const dxa = r.x - a.x, dya = r.y - a.y;
    const dxb = r.x - b.x, dyb = r.y - b.y;
    r.active = dxa * dxa + dya * dya <= ra2 && dxb * dxb + dyb * dyb <= rb2;
    if (r.active) activeCount++;
  }
  return activeCount;
}

function fillDots(color, wantActive) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const r of restaurants) {
    if (r.active !== wantActive) continue;
    ctx.moveTo(r.x + DOT_RADIUS, r.y);
    ctx.arc(r.x, r.y, DOT_RADIUS, 0, 2 * Math.PI);
  }
  ctx.fill();
}

// Gray inactive dots first, then active dots on top so matches are never hidden.
function drawDots() {
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  fillDots(INACTIVE_COLOR, false);
  fillDots(ACTIVE_COLOR, true);
}

function update() {
  updateQueued = false;
  const start = performance.now();
  const activeCount = applyFilters();
  drawDots();
  const elapsed = performance.now() - start;

  countLabel.textContent =
    `${format(activeCount)} of ${format(restaurants.length)} mapped restaurants match`;
  timingLabel.textContent = `Last update: ${elapsed.toFixed(1)} ms (filter + draw)`;
}

// Coalesce bursts of drag and slider events into one update per frame.
function requestUpdate() {
  if (updateQueued) return;
  updateQueued = true;
  requestAnimationFrame(update);
}

function renderCircles() {
  overlay.selectAll(".zone")
    .data(circles, c => c.id)
    .join("circle")
    .attr("class", "zone")
    .attr("cx", c => c.x)
    .attr("cy", c => c.y)
    .attr("r", c => c.radiusMiles * PIXELS_PER_MILE);

  // Handles are joined after the zones so they sit on top.
  overlay.selectAll(".handle")
    .data(circles, c => c.id)
    .join(enter => {
      const g = enter.append("g").attr("class", "handle");
      g.append("circle").attr("r", HANDLE_RADIUS);
      g.append("text").text(c => c.id);
      return g;
    })
    .attr("transform", c => `translate(${c.x},${c.y})`);
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const drag = d3.drag()
  .on("start", function () {
    d3.select(this).classed("dragging", true).raise();
  })
  .on("drag", (event, c) => {
    c.x = clamp(event.x, 0, MAP_WIDTH);
    c.y = clamp(event.y, 0, MAP_HEIGHT);
    renderCircles();
    requestUpdate();
  })
  .on("end", function () {
    d3.select(this).classed("dragging", false);
  });

function setupRadiusSlider(circle) {
  const key = circle.id.toLowerCase();
  const input = document.getElementById(`radius-${key}`);
  const output = document.getElementById(`radius-${key}-value`);
  const show = () => { output.textContent = `${circle.radiusMiles} mi`; };

  input.value = circle.radiusMiles;
  show();
  input.addEventListener("input", () => {
    circle.radiusMiles = +input.value;
    show();
    renderCircles();
    requestUpdate();
  });
}

d3.csv("sccRestaurantsSynth2026.csv", parseRow).then(rows => {
  restaurants = rows.filter(r => r.lat !== null && r.lon !== null);
  for (const r of restaurants) {
    [r.x, r.y] = projection([r.lon, r.lat]);
  }

  document.getElementById("missing").textContent =
    `${format(rows.length - restaurants.length)} of ${format(rows.length)} have no location and are not shown.`;

  setupCanvas();
  renderCircles();
  overlay.selectAll(".handle").call(drag);
  circles.forEach(setupRadiusSlider);
  update();
});
