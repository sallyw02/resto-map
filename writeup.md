# CS 448B Assignment 3: Santa Clara County Restaurant Map

Name: Sally Wang

Live site: https://sallyw02.github.io/resto-map/

Source: https://github.com/sallyw02/resto-map

## Running it

There is no build step. The live site runs in the latest Google Chrome. To run it locally, serve the folder over HTTP, since Chrome blocks loading the CSV from a file:// URL.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. The CSV and the base map image are both included in the repo, and D3 v7.9.0 loads from jsDelivr.

## Design decisions

### Dot colors

Matching restaurants are colored by their latest placard. Green placards are a light pastel green, Yellow and Red placards are yellow and red, and the Other group is a light purple dotted ring. Yellow and Red dots are drawn slightly larger and on top of everything else. Restaurants that fail any filter are gray.

Coloring by placard lets the dot match the data directly, so a green dot means a green placard. The placard data is very skewed, though. 9,614 of the 9,709 restaurants have a Green placard, while only 21 are Yellow and 2 are Red. I used a soft pastel for green so that the thousands of green dots stay in the background and the few Yellow and Red restaurants stand out. A Yellow placard is a conditional pass with major violations, and a Red placard means the county closed the restaurant. Those are the cases a diner would want to notice.

Other covers Pass *, Closure *, and N/A. The dataset does not explain these labels, and their scores do not line up with them. A Pass * restaurant can score as low as 6, and a Closure * restaurant can score 100. Rather than present them as passing or as closed, I gave them their own light purple, and drew them as dotted rings instead of solid dots so they read as matches whose inspection status is unclear.

### Filters

Besides the A and B circles, there are two filters: placard checkboxes and a minimum rating slider. The placard filter has four groups, Green, Yellow, Red, and Other, with the count for each shown next to its checkbox. I folded Pass *, Closure *, and N/A into Other because together they are only 72 rows. The rating slider runs from 1.0 to 5.0 and starts at 1.0, so on load only A and B narrow the results.

The circle radii are set with sliders in miles, from 0.25 to 15. I did not add draggable circle edges, because keeping two controls in sync for the same value was more risk than it was worth. A and B are moved by dragging their labeled center markers. The rest of each circle ignores the mouse, so hovering over dots inside a circle still works.

### Missing data

Missing values in the CSV are the string "null". 915 rows have no latitude or longitude and cannot be placed on the map. The match count is therefore out of the 8,794 mapped restaurants, and a note under it says how many were left off. Rating and review count are never null in this data. Latest Score is null in 124 rows. The tooltip hides any null field, and it also hides a placard of N/A.

### Hover

3,843 restaurants share an exact location with at least one other, and one spot in San Jose has 101. A tooltip that showed only the nearest dot would hide all but one of them. I group restaurants by coordinate when the data loads, so hovering a shared spot shows how many are there, how many match, up to five names with matches listed first, and how many more there are. Hover works on gray dots as well, with a note that the restaurant is filtered out.

### Performance

The dots are drawn on a canvas rather than as roughly 8,800 SVG circles, with the A and B circles and their markers in an SVG layer on top. Each update runs one loop over all mapped restaurants that compares squared pixel distances to squared radii, so no square roots are needed. Drag and slider events are batched so that at most one update runs per animation frame. Hover uses a d3.quadtree built once over the 5,968 distinct locations.

I timed filter plus redraw with performance.now() in Chrome over 200 runs, with every filter active. The median was 0.8 ms, the 95th percentile 1.4 ms, and the worst 2.1 ms, well under the 100 ms target. The first update on page load took 12.6 ms. Hover lookups plus tooltip rendering, over 500 random positions, had a worst case of 1.3 ms. The panel shows the time of the latest update.

## Resources and AI assistance

I used Claude Code, Anthropic's coding assistant (model Claude Opus 5.5), at several stages. It profiled the CSV to find the null counts, the placard distribution, and the shared locations.  I then made key implementation decisions, and Claude helped work on the code in index.html, style.css, and script.js following my model. It also tested different steps I identified as checkpoints in a browser and measured the timings. I also manually checked the result after each step to make sure all conditions were met.

The map frame and the d3.geoMercator projection setup come from the snippet in the assignment description. The page uses D3 v7 for CSV loading, the projection, dragging, and the quadtree. The base map image and the dataset are the ones provided for the course.

## Time spent

4 hours. 1.5 hours for exploring the dataset and decision-making, and the rest for implementing the code, testing, and debugging as needed.

## What took the most time

Most of the time went into decisions rather than code. Profiling the data showed problems the plan had not anticipated. Placards were almost all Green, 915 rows had no location, and many restaurants shared a single point. Each of these changed a choice: which filters to keep, how to color the dots, what the match count should count, and how the tooltip should handle overlapping points.

The second largest part was making interaction and hover work together. The A and B markers had to be draggable while the circles around them let hover reach the dots underneath, and a drag had to hide the tooltip.
