// deterministic pseudo-random, so generated terrain/positions are stable frame
// to frame instead of crawling around, but still look irregular
export function hashRand(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}
