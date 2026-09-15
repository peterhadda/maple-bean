// Shared by walking, click-to-walk, the server, and the regression checks.
export function isWalkable(x, z, layout, radius = .24) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const inside=Math.abs(x)<=layout.width/2-.35 && Math.abs(z)<=layout.depth/2-.35;
  const doorway=layout.entrance && Math.abs(x)<=layout.entrance.halfWidth-radius && z>=layout.depth/2-.35 && z<=layout.entrance.endZ-radius;
  if (!inside && !doorway) return false;
  return !layout.obstacles.some(o => Math.abs(x-o.x) < o.w/2+radius && Math.abs(z-o.z) < o.d/2+radius);
}

export function findPath(start, end, layout) {
  const step = .32, minX = -layout.width/2, minZ = -layout.depth/2;
  const cols = Math.ceil(layout.width/step)+1, rows = Math.ceil(((layout.entrance?.endZ??layout.depth/2)-minZ)/step)+1;
  const cell = p => [Math.round((p.x-minX)/step), Math.round((p.z-minZ)/step)];
  const point = (x,z) => ({x:minX+x*step,z:minZ+z*step});
  if (!isWalkable(end.x,end.z,layout)) return [];
  const [sx,sz] = cell(start), [ex,ez] = cell(end), first = sz*cols+sx;
  const parents = new Int32Array(cols*rows).fill(-1), queue = [first]; parents[first]=first;
  let goal = -1;
  for (let i=0; i<queue.length; i++) {
    const at=queue[i], x=at%cols,z=Math.floor(at/cols);
    if (x===ex && z===ez) {goal=at;break;}
    for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,nz=z+dz,key=nz*cols+nx;
      if(nx<0||nz<0||nx>=cols||nz>=rows||parents[key]!==-1) continue;
      const p=point(nx,nz);if(!isWalkable(p.x,p.z,layout))continue;
      parents[key]=at;queue.push(key);
    }
  }
  if(goal<0)return [];
  const path=[end];
  for(let k=goal;k!==first;k=parents[k])path.push(point(k%cols,Math.floor(k/cols)));
  return path.reverse();
}
