  export interface City {
  id: number;
  x: number;
  y: number;
  name: string;
}

export interface TSPResult {
  route: number[];
  totalDistance: number;
  iters: number;
  nnDistance: number;
  improvement: number;
}

export interface StepFrame {
  route: number[];
  swappedEdge: [number, number] | null;
  phase: "nearest-neighbor" | "2-opt" | "done";
  distance: number;
}

function dist(a: City, b: City): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function totalDistance(cities: City[], route: number[]): number {
  let d = 0;
  for (let i = 0; i < route.length; i++) {
    d += dist(cities[route[i]], cities[route[(i + 1) % route.length]]);
  }
  return d;
}

function nearestNeighbor(cities: City[]): number[] {
  const n = cities.length;
  const visited = new Array(n).fill(false);
  const route = [0];
  visited[0] = true;

  for (let s = 1; s < n; s++) {
    const last = route[route.length - 1];
    let best = -1;
    let bestDist = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited[j]) {
        const d = dist(cities[last], cities[j]);
        if (d < bestDist) {
          bestDist = d;
          best = j;
        }
      }
    }

    route.push(best);
    visited[best] = true;
  }

  return route;
}

function twoOpt(
  cities: City[],
  initialRoute: number[],
  collectFrames = false
): { route: number[]; iters: number; frames: StepFrame[] } {
  let route = [...initialRoute];
  const n = route.length;
  let improved = true;
  let iters = 0;
  const frames: StepFrame[] = [];

  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;

        const a = route[i];
        const b = route[i + 1];
        const c = route[j];
        const d = route[(j + 1) % n];

        const before = dist(cities[a], cities[b]) + dist(cities[c], cities[d]);
        const after = dist(cities[a], cities[c]) + dist(cities[b], cities[d]);

        if (after < before - 0.001) {
          const newRoute = [...route];
          let lo = i + 1;
          let hi = j;
          while (lo < hi) {
            [newRoute[lo], newRoute[hi]] = [newRoute[hi], newRoute[lo]];
            lo++;
            hi--;
          }
          route = newRoute;
          iters++;
          improved = true;

          if (collectFrames) {
            frames.push({
              route: [...route],
              swappedEdge: [a, c],
              phase: "2-opt",
              distance: totalDistance(cities, route),
            });
          }
        }
      }
    }
  }

  return { route, iters, frames };
}

export function heuristicTSP(cities: City[]): TSPResult {
  if (cities.length < 2) {
    return { route: cities.map((_, i) => i), totalDistance: 0, iters: 0, nnDistance: 0, improvement: 0 };
  }

  const nnRoute = nearestNeighbor(cities);
  const nnDist = totalDistance(cities, nnRoute);

  const { route, iters } = twoOpt(cities, nnRoute);
  const optDist = totalDistance(cities, route);

  return {
    route,
    totalDistance: optDist,
    iters,
    nnDistance: nnDist,
    improvement: nnDist > 0 ? ((nnDist - optDist) / nnDist) * 100 : 0,
  };
}

export function heuristicTSPWithSteps(cities: City[]): StepFrame[] {
  const nnRoute = nearestNeighbor(cities);

  const frames: StepFrame[] = [
    {
      route: [...nnRoute],
      swappedEdge: null,
      phase: "nearest-neighbor",
      distance: totalDistance(cities, nnRoute),
    },
  ];

  const { route, frames: optFrames } = twoOpt(cities, nnRoute, true);
  frames.push(...optFrames);

  frames.push({
    route: [...route],
    swappedEdge: null,
    phase: "done",
    distance: totalDistance(cities, route),
  });

  return frames;
}
