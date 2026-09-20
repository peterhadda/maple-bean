import { findPath, isWalkable } from '../navigation.js';

// Pick a reachable conversation spot, keeping bar visitors on its public side.
export function socialSpot(from, target, layout, staff = false) {
  const station = layout.stations.find(s => s.id === 'mara');
  const angle = Math.atan2(from.x - target.x, from.z - target.z);
  const candidates = staff ? [{ x: target.x, z: station.approach[1] }] :
    [1.05, 1.4].flatMap(radius => Array.from({ length: 12 }, (_, i) => ({
      x: target.x + Math.sin(angle + i * Math.PI / 6) * radius,
      z: target.z + Math.cos(angle + i * Math.PI / 6) * radius,
    })));
  return candidates.find(p => isWalkable(p.x, p.z, layout) &&
    !(layout.people || []).some(q => q !== from && q.visible !== false && Math.hypot(p.x-q.x,p.z-q.z)<.55) &&
    findPath(from, p, layout).length) || null;
}
export function socialArrived(from, target, spot, staff = false) {
  const gap = Math.hypot(from.x-target.x, from.z-target.z);
  return !!spot && Math.hypot(from.x-spot.x,from.z-spot.z)<.2 && gap>=.7 && gap<=(staff?3.5:1.65);
}
