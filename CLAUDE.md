# CS 448B Assignment 3: Interactive Visualization Software

## Overview

This is Assignment 3 for CS 448B (Data Visualization, Stanford, Fall 2026). The goal is to build an interactive map of about 9,700 Santa Clara County restaurants using the dynamic queries technique, first explored in the HomeFinder application. Users change filter controls and the map updates immediately to show only the matching restaurants.

- Due: Monday, Oct 26, 2026 by 10:30am (Pacific time)
- Submit on Canvas: https://canvas.stanford.edu/courses/233542/assignments/828621
- Work alone or with one partner. Groups of three or more are not allowed.
- Must run in the latest stable Google Chrome.

## Data

CSV: https://magrawala.github.io/cs448b-fa26/assets/a3/sccRestaurantsSynth2026.csv

Just over 9,700 rows, one per restaurant. Some rows have null values (including location), and several restaurants can share the same location.

Fields:

- Name: restaurant name (string)
- Address: restaurant address (string)
- Latest placard color: usually red, yellow, or green, based on the inspection score
- Latest Score: inspection compliance score. 100 is perfect, points are deducted for violations
- Distance: distance from Stanford (assumed at lat/lon 37.42766 / -122.17006)
- Latitude, Longitude: restaurant location
- Rating: synthetic rating between 1 and 5
- Number of reviews: synthetic review count. If a restaurant has a rating, this is greater than 0

Rating and review count are fictitious. Treat them as if they were Yelp data. No need to worry about how they were synthesized.

## Required Features

1. **Map and points.** Show every restaurant as a data point on a map of Santa Clara County. Handle rows with missing locations.
2. **Two draggable locations, A and B.** Each has a circle with an adjustable radius. The radius can be set with a slider or a draggable circle edge. Implementing both is allowed but they must stay in sync, which is tricky. Filter to restaurants inside the intersection of both circles. All other points should be grayed out. The circles should already be visible on page load.
3. **Hover details.** Hovering over a point shows the restaurant name and other relevant fields (rating, reviews, latest score, placard color, when not null). This info must not be visible otherwise.
4. **At least two additional filters.** Examples from the spec are an address keyword (such as Stanford or El Camino Real), placard color, and rating range.
5. **Interactive speed.** Updates must happen at interactive rates, about 0.1 seconds. Making the filters fast is explicitly part of the assignment.

## Map Resources

Base map image: https://magrawala.github.io/cs448b-fa26/assets/a3/sccRestaurantsMap2026.png

Another mapping strategy is allowed, but it must show geographic detail comparable to the provided map.

Starter Observable notebook (optional): https://observablehq.com/d/acffc27512286e98

Spec snippet for the projection (D3 v7):

```js
const mapScale = 2;
const mapWidth = 1664 / mapScale;
const mapHeight = 1393 / mapScale;
const longitudeRange = [-122.20085766666666, -121.27442433333333];
const latitudeRange = [36.91311264279123, 37.53067882428926];
const mapFrameGeoJSON = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [longitudeRange[0], latitudeRange[0]],
      [longitudeRange[1], latitudeRange[1]]
    ]
  }
};
const projection = d3.geoMercator()
  .fitExtent([[0, 0], [mapWidth, mapHeight]], mapFrameGeoJSON);

// Place the base map image in an SVG
svg.append("image")
  .attr("width", mapWidth)
  .attr("height", mapHeight)
  .attr("href", "http://magrawala.github.io/cs448b-fa26/assets/a3/sccRestaurantsMap2026.png");

// Project a restaurant to pixel coordinates
const [x, y] = projection([restaurant_longitude, restaurant_latitude]);
```

Loading data in D3 v7 uses promises:

```js
d3.csv("file.csv").then(function(data) { console.log(data); });
```

Chrome may block CSV loading from `file://`, so run a local server during development with `python -m http.server`.

## Technical Notes

- JavaScript with D3 is strongly recommended. Staff support is only for D3 in Observable. Other languages and toolkits are allowed but unsupported.
- Code must be written from scratch. Any outside resource (Stack Overflow, GitHub code, ChatGPT, Claude, and so on) must be listed in the submission with an explanation of how it was used. Cite any external snippet that was adapted or that inspired an approach.
- The design choices and implementation should be original.

## Planned Approach

These decisions were settled in a grilling session on 2026-10-19, after profiling the CSV.

### Data facts (from profiling the CSV)

- 9,709 rows. Missing values are the literal string "null", not empty cells.
- 915 rows have null lat/lon, leaving 8,794 mappable. All mappable rows fall inside the map extent.
- Rating (1.0 to 5.0, step 0.1) and Number of reviews (1 to 5,349) are never null.
- Latest Score is null in 124 rows. Range 6 to 100, median 93.
- Placard values are skewed: Green 9,614, Pass * 34, N/A 31, Yellow 21, Closure * 7, Red 2.
- 3,843 restaurants share 1,017 coordinates. The busiest coordinate holds 101 restaurants.

### Decisions

- **Hosting.** Public GitHub repo named `resto-map` with GitHub Pages. Plain `index.html`, `script.js`, `style.css`, D3 v7 from a pinned CDN URL, no build step. The CSV is copied into the repo.
- **Layout.** Map at native 832x696 with a controls panel on the right: match count, A and B radius sliders, rating slider, placard checkboxes, Reset, a legend, and a timing readout. Desktop Chrome only.
- **Rendering.** Dots on a canvas over the map image (scaled for devicePixelRatio). A and B circles, labels, and handles in an SVG layer on top.
- **Data prep (once at load).** Parse numeric fields, treating "null" as missing. Drop rows without lat/lon from the map and keep the count. Precompute projected x and y.
- **Filtering.** One function loops over all rows and sets an active flag. Circle tests compare squared pixel distance to squared radius. Active means inside both circles and passing every other filter. Filtering and redraw run continuously during drags and slider moves, throttled with `requestAnimationFrame`.
- **A and B.** Defaults: A at Stanford (37.4277, -122.1701), B at downtown Mountain View (about 37.394, -122.080), both with a 3 mi radius. Drag only by a labeled center handle; circle interiors and edges ignore the pointer so hover still works inside them. Centers are clamped to the map.
- **Radius.** Sliders only (edge dragging is a stretch goal). Miles, 0.25 to 15 in steps of 0.25, value shown beside the slider. Converted to pixels with the projection scale at the map center.
- **Extra filters.** Placard checkboxes in four groups: Green, Yellow, Red, and Other (Pass *, Closure *, N/A). Minimum rating slider from 1.0 to 5.0 in steps of 0.1. Defaults are all boxes checked and rating 1.0, so only A and B narrow the set on load. Rating has no nulls, so no null rule is needed.
- **Drawing and color.** Inactive dots in gray first, then active dots in one accent color, with Yellow and Red placard restaurants drawn in their own colors on top so they stand out.
- **Hover.** Works on every dot, active or not. `d3.quadtree` built once; `find` with about a 6 px radius. One restaurant at the spot: name, address, rating with review count, latest score, and placard, hiding null fields, plus a "filtered out" line for inactive dots. Several at the same coordinate: a header like "12 restaurants at this location", up to 5 rows (name, rating, placard) with active ones first, then "+N more".
- **Match count.** Out of mapped restaurants, for example "312 of 8,794 mapped restaurants match", with a note that 915 have no location and are not shown.
- **Reset.** Restores circle positions, radii, rating slider, and checkboxes.
- **Timing.** Measure filter plus redraw with `performance.now()`, show the latest value in the panel, and report numbers in the write-up.
- **Team.** Solo.
- **Write-up.** `writeup.md` in the repo, exported to PDF at the end.

## Suggested Build Order

1. Repo setup with `index.html`, `script.js`, and the CSV. Test locally, then enable GitHub Pages.
2. Map image and dots.
3. Draggable A and B circles with radius controls.
4. Filtering logic and gray-out behavior.
5. Extra filters.
6. Hover tooltip with quadtree.
7. Performance tuning and timing logs.
8. Polish and write-up.

## Deliverables

1. Source code, as a .zip or .tar.gz uploaded to Canvas (GitHub: Code > Download ZIP), or a published Observable notebook link.
2. A link to a live version on the web (for example GitHub Pages). Required if the code runs in a browser.
3. Any special build or run instructions.
4. A write-up as a PDF (or embedded in the Observable notebook) that includes:
   - Resources used, including any AI assistance, and how each was used.
   - For pairs, a breakdown of how work was split. Include both names. Only one person submits.
   - Roughly how much time was spent developing the application.
   - Which aspects took the most time.

## Working Log (fill in as you go)

Keep notes here so the write-up is easy to finish.

- Time spent so far:
- Hardest parts:
- Outside resources and how they were used: Claude Code (Claude Opus 5.5) profiled the CSV, ran a design Q&A to settle open decisions, and wrote the initial scaffold (index.html, style.css, script.js with projection, CSV parsing, and canvas dots). D3 v7 from jsDelivr.
- Timing measurements: 2026-10-19, after A/B circle filtering (steps 3 and 4), local Chrome, 200 runs of filter plus redraw over 8,794 rows: median 0.70 ms, p95 0.80 ms, max 1.70 ms. The first update on page load took 12.6 ms (before JIT warm-up). After adding placard and rating filters (step 5), 200 runs: median 0.80 ms, p95 1.40 ms, max 2.10 ms.
- Rows dropped for missing location: 915 of 9,709 (8,794 mapped)
