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
const HIGHLIGHT_RADIUS = 3;
const ACTIVE_COLOR = "#2b6cb0";
const INACTIVE_COLOR = "rgba(120, 126, 134, 0.45)";
const YELLOW_COLOR = "#e0a800";
const RED_COLOR = "#d64545";
const HANDLE_RADIUS = 11;
const HOVER_RADIUS = 6;
const TOOLTIP_OFFSET = 14;
const TOOLTIP_MAX_ROWS = 5;

// A starts at Stanford, B in downtown Mountain View. Dragging moves x and y;
// lon and lat stay as the defaults that Reset returns to.
const DEFAULT_RADIUS_MILES = 3;
const DEFAULT_MIN_RATING = 1;
const circles = [
  { id: "A", lon: -122.17006, lat: 37.42766, radiusMiles: DEFAULT_RADIUS_MILES },
  { id: "B", lon: -122.080, lat: 37.394, radiusMiles: DEFAULT_RADIUS_MILES }
];

function placeCirclesAtDefaults() {
  for (const c of circles) {
    [c.x, c.y] = projection([c.lon, c.lat]);
  }
}
placeCirclesAtDefaults();

const canvas = document.getElementById("dots");
const ctx = canvas.getContext("2d");
const overlay = d3.select("#overlay");
const mapElement = document.getElementById("map");
const tooltip = d3.select("#tooltip");
const countLabel = document.getElementById("count");
const timingLabel = document.getElementById("timing");
const format = d3.format(",");

// Placard values are almost all Green. The rare non-color labels
// (Pass *, Closure *, N/A) share one Other group.
const PLACARD_GROUPS = ["Green", "Yellow", "Red", "Other"];

function placardGroup(value) {
  return PLACARD_GROUPS.includes(value) ? value : "Other";
}

const filters = {
  placards: new Set(PLACARD_GROUPS),
  minRating: DEFAULT_MIN_RATING
};

let restaurants = [];
let updateQueued = false;

// Restaurants that share exact coordinates are grouped into one location, and
// the quadtree indexes locations so hover can report everyone at a spot.
let locations = [];
let quadtree = null;
let dragging = false;

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
    placardGroup: placardGroup(d["Latest placard color"]),
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

// Mark each restaurant active if it lies inside both circles and passes the
// placard and rating filters. Compares squared distances so there is no
// square root per row. Rating is never null in this data, but a null rating
// would fail any minimum because null >= n is false for n > 0.
function applyFilters() {
  const [a, b] = circles;
  const ra = a.radiusMiles * PIXELS_PER_MILE;
  const rb = b.radiusMiles * PIXELS_PER_MILE;
  const ra2 = ra * ra;
  const rb2 = rb * rb;
  const { placards, minRating } = filters;
  let activeCount = 0;

  for (const r of restaurants) {
    const dxa = r.x - a.x, dya = r.y - a.y;
    const dxb = r.x - b.x, dyb = r.y - b.y;
    r.active = dxa * dxa + dya * dya <= ra2
      && dxb * dxb + dyb * dyb <= rb2
      && placards.has(r.placardGroup)
      && r.rating >= minRating;
    if (r.active) activeCount++;
  }
  return activeCount;
}

function fillDots(color, radius, include) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const r of restaurants) {
    if (!include(r)) continue;
    ctx.moveTo(r.x + radius, r.y);
    ctx.arc(r.x, r.y, radius, 0, 2 * Math.PI);
  }
  ctx.fill();
}

// Gray inactive dots first, then active dots, then the rare active yellow and
// red placards on top so they are never hidden under the others.
function drawDots() {
  ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  fillDots(INACTIVE_COLOR, DOT_RADIUS, r => !r.active);
  fillDots(ACTIVE_COLOR, DOT_RADIUS,
    r => r.active && r.placardGroup !== "Yellow" && r.placardGroup !== "Red");
  fillDots(YELLOW_COLOR, HIGHLIGHT_RADIUS, r => r.active && r.placardGroup === "Yellow");
  fillDots(RED_COLOR, HIGHLIGHT_RADIUS, r => r.active && r.placardGroup === "Red");
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
    dragging = true;
    hideTooltip();
    d3.select(this).classed("dragging", true).raise();
  })
  .on("drag", (event, c) => {
    c.x = clamp(event.x, 0, MAP_WIDTH);
    c.y = clamp(event.y, 0, MAP_HEIGHT);
    renderCircles();
    requestUpdate();
  })
  .on("end", function () {
    dragging = false;
    d3.select(this).classed("dragging", false);
  });

function buildLocations() {
  const groups = d3.group(restaurants, r => `${r.lat},${r.lon}`);
  locations = Array.from(groups.values(), group => ({
    x: group[0].x,
    y: group[0].y,
    restaurants: group
  }));
  quadtree = d3.quadtree(locations, l => l.x, l => l.y);
}

function reviewText(count) {
  return `${format(count)} ${count === 1 ? "review" : "reviews"}`;
}

// "N/A" is the data's way of saying there is no placard, so it is hidden
// like a null field.
function hasPlacard(r) {
  return r.placard && r.placard !== "N/A";
}

// Built with text nodes rather than innerHTML so names from the CSV are never
// parsed as markup.
function renderSingle(r) {
  tooltip.append("div").attr("class", "name").text(r.name);
  tooltip.append("div").attr("class", "address").text(r.address);

  const fields = [];
  if (r.rating !== null) {
    const reviews = r.reviews !== null ? ` (${reviewText(r.reviews)})` : "";
    fields.push(["Rating", `${r.rating.toFixed(1)} ★${reviews}`]);
  }
  if (r.score !== null) fields.push(["Inspection score", r.score]);
  if (hasPlacard(r)) fields.push(["Placard", r.placard]);

  const list = tooltip.append("dl");
  for (const [label, value] of fields) {
    list.append("dt").text(label);
    list.append("dd").text(value);
  }

  if (!r.active) {
    tooltip.append("div").attr("class", "status").text("Filtered out by the current settings");
  }
}

function renderGroup(group) {
  const matching = group.filter(r => r.active).length;
  tooltip.append("div").attr("class", "name")
    .text(`${group.length} restaurants at this location`);
  tooltip.append("div").attr("class", "address")
    .text(`${matching} match the current filters`);

  const sorted = group.slice().sort((a, b) =>
    (b.active - a.active) || d3.ascending(a.name, b.name));
  const rows = tooltip.append("ul")
    .selectAll("li")
    .data(sorted.slice(0, TOOLTIP_MAX_ROWS))
    .join("li")
    .classed("filtered-out", r => !r.active);
  rows.append("span").text(r => r.name);
  rows.append("span").text(r => {
    const parts = [];
    if (r.rating !== null) parts.push(`${r.rating.toFixed(1)} ★`);
    if (hasPlacard(r)) parts.push(r.placard);
    return parts.join(" · ");
  });

  if (group.length > TOOLTIP_MAX_ROWS) {
    tooltip.append("div").attr("class", "more")
      .text(`+${group.length - TOOLTIP_MAX_ROWS} more`);
  }
}

// Place the tooltip beside the cursor, flipping to the other side near the
// right or bottom edge so it stays inside the map.
function positionTooltip(mx, my) {
  const node = tooltip.node();
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  let left = mx + TOOLTIP_OFFSET;
  let top = my + TOOLTIP_OFFSET;
  if (left + width > MAP_WIDTH) left = mx - TOOLTIP_OFFSET - width;
  if (top + height > MAP_HEIGHT) top = my - TOOLTIP_OFFSET - height;
  tooltip.style("left", `${Math.max(0, left)}px`).style("top", `${Math.max(0, top)}px`);
}

function showTooltip(location, mx, my) {
  tooltip.html("");
  if (location.restaurants.length === 1) renderSingle(location.restaurants[0]);
  else renderGroup(location.restaurants);
  tooltip.property("hidden", false);
  positionTooltip(mx, my);

  overlay.select(".hover-ring")
    .attr("cx", location.x)
    .attr("cy", location.y)
    .attr("r", HIGHLIGHT_RADIUS + 3)
    .attr("visibility", "visible");
}

function hideTooltip() {
  tooltip.property("hidden", true);
  overlay.select(".hover-ring").attr("visibility", "hidden");
}

function handleHover(event) {
  if (dragging || !quadtree || event.target.closest(".handle")) {
    hideTooltip();
    return;
  }
  const [mx, my] = d3.pointer(event, canvas);
  const location = quadtree.find(mx, my, HOVER_RADIUS);
  if (location) showTooltip(location, mx, my);
  else hideTooltip();
}

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

function setupPlacardFilter() {
  const totals = d3.rollup(restaurants, rows => rows.length, r => r.placardGroup);
  const labels = d3.select("#placards")
    .selectAll("label")
    .data(PLACARD_GROUPS)
    .join("label");

  labels.append("input")
    .attr("type", "checkbox")
    .property("checked", group => filters.placards.has(group))
    .on("change", function (event, group) {
      if (this.checked) filters.placards.add(group);
      else filters.placards.delete(group);
      requestUpdate();
    });
  labels.append("span").text(group => group);
  labels.append("span")
    .attr("class", "tally")
    .text(group => format(totals.get(group) || 0));
}

function setupRatingFilter() {
  const input = document.getElementById("min-rating");
  const output = document.getElementById("min-rating-value");
  const show = () => {
    output.textContent = filters.minRating <= 1 ? "Any" : `${filters.minRating.toFixed(1)}+`;
  };

  input.value = filters.minRating;
  show();
  input.addEventListener("input", () => {
    filters.minRating = +input.value;
    show();
    requestUpdate();
  });
}

// Reset moves the circles back, then sets each control and fires its own
// event, so the existing handlers update filter state and labels.
function setControl(input, value, eventType) {
  if (input.type === "checkbox") input.checked = value;
  else input.value = value;
  input.dispatchEvent(new Event(eventType));
}

function resetAll() {
  placeCirclesAtDefaults();
  for (const c of circles) {
    const input = document.getElementById(`radius-${c.id.toLowerCase()}`);
    setControl(input, DEFAULT_RADIUS_MILES, "input");
  }
  document.querySelectorAll("#placards input").forEach(box => setControl(box, true, "change"));
  setControl(document.getElementById("min-rating"), DEFAULT_MIN_RATING, "input");
  hideTooltip();
  renderCircles();
  requestUpdate();
}

d3.csv("sccRestaurantsSynth2026.csv", parseRow).then(rows => {
  restaurants = rows.filter(r => r.lat !== null && r.lon !== null);
  for (const r of restaurants) {
    [r.x, r.y] = projection([r.lon, r.lat]);
  }

  document.getElementById("missing").textContent =
    `${format(rows.length - restaurants.length)} of ${format(rows.length)} have no location and are not shown.`;

  setupCanvas();
  buildLocations();
  overlay.append("circle").attr("class", "hover-ring").attr("visibility", "hidden");
  renderCircles();
  overlay.selectAll(".handle").call(drag);
  circles.forEach(setupRadiusSlider);
  setupPlacardFilter();
  setupRatingFilter();
  mapElement.addEventListener("mousemove", handleHover);
  mapElement.addEventListener("mouseleave", hideTooltip);
  document.getElementById("reset").addEventListener("click", resetAll);
  update();
});
