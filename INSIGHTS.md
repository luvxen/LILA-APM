# LILA APM: Game Design Insights

Based on an exploration of the parsed telemetry data using the visualizations provided by the LILA APM tool, here are three actionable insights regarding player behavior.

## Insight 1: Heavy Engagement and Death Clustering at Map Center (Lockdown)

**What caught my eye**:
When viewing the "Death Heatmap" specifically for Human players on the `Lockdown` map, there is an overwhelming concentration of high-intensity red/purple blooms directly in the center quadrant of the map. By scrubbing the timeline, it becomes evident this happens extremely early in the match (within the first 3-5 minutes).

**Supporting Evidence**:
Toggling off Bot data and enabling Human Kills/Deaths shows that the outer perimeters of the map have barely any interaction. Players rush the center, resulting in an immediate spike in the event counter and massive death clusters in a very tight radius.

**Actionable Iteration**:
- **Design Impact**: The current pacing of the match is heavily skewed towards immediate central conflict, leaving the rest of the map vastly underutilized. 
- **Action**: Spread out high-value loot spawns (visible via the Loot toggles) to the outer edges of the map to incentivize perimeter exploration. Alter the spawn points further away from the absolute center to delay early-game clustering and extend match duration.

---

## Insight 2: Predictable Bot Pathing and Exploitation

**What caught my eye**:
When filtering explicitly for **Bot Paths** and ignoring human data, the AI paths form extremely rigid, almost geometric straight lines patrolling very specific zones, primarily in `AmbroseValley`.

**Supporting Evidence**:
Comparing Human paths (erratic, sweeping, cover-seeking) against Bot paths (straight lines turning sharply at rigid waypoints) shows a stark contrast. In areas where Bot paths form these predictable lines, Human Kill markers heavily overlap.

**Actionable Iteration**:
- **Design Impact**: The AI movement patterns are currently too predictable. Human players have recognized these rigid patrol routes and are farming bots at predictable choke points, inflating kill counts without genuine challenge.
- **Action**: Introduce randomized offsets to the Bot pathfinding logic. Rather than navigating precisely from Node A to Node B, bots should utilize a "navmesh wander" algorithm within a radius around their intended target to appear more erratic and human-like.

---

## Insight 3: Storm Deaths Escalate Disproportionately Late-Game

**What caught my eye**:
By utilizing the timeline scrubber and keeping an eye on the event type filters, the occurrence of "Human Storm Deaths" (indicated by purple circles) spikes exponentially in the final 2 minutes of the relative time filter slice compared to combat deaths.

**Supporting Evidence**:
If you set the relative time filter to view the last few minutes of extended matches in `GrandRift`, combat kill markers drop off significantly, while Storm Death markers completely dominate the minimap. 

**Actionable Iteration**:
- **Design Impact**: Players are surviving combat but dying to the world mechanics, which often feels less rewarding or fair to the player than losing a gunfight. The storm is either moving too quickly, or the UI is not effectively communicating the impending danger.
- **Action**: Adjust the storm's closing speed in the final two phases to give players slightly more time to rotate. Alternatively, increase the severity of the UI warnings (audio/visual cues) well before the storm begins its final, fatal contraction.
