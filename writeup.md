# CS 448B Assignment 3: Santa Clara County Restaurant Map

Name: TODO

Live site: https://sallyw02.github.io/resto-map/

Source: https://github.com/sallyw02/resto-map

## Running it

TODO

## Design decisions

### Dot colors

Matching restaurants are drawn in blue. Only matches whose latest placard is Yellow or Red get their own color, and those dots are drawn slightly larger on top of the rest. Restaurants that fail any filter are gray.

I chose this because the placard data is very skewed. 9,614 of the 9,709 restaurants have a Green placard, while only 21 are Yellow and 2 are Red. Coloring every match by its placard would have turned almost the whole matching set green, so green would mean little more than "matches" and the few problem restaurants would be easy to miss. A Yellow placard is a conditional pass with major violations, and a Red placard means the county closed the restaurant. Those are the cases a diner would want to notice, so they are the ones that stand out.

Green and Other matches share the blue, and the legend says so. Other covers Pass *, Closure *, and N/A. I did not use green as the match color, because then the Other group would also look green and suggest it had passed inspection when it may not have.

## Resources and AI assistance

TODO

## Time spent

TODO

## What took the most time

TODO
