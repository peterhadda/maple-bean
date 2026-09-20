// Shared by walking, click-to-walk, the server, and the regression checks.
const peopleNear=(position,layout)=> (layout.people||[]).filter(p=>p!==position&&p.visible!==false);
export function clearOfPeople(position,x,z,layout){
  return peopleNear(position,layout).every(p=>{
    const before=Math.hypot(position.x-p.x,position.z-p.z),after=Math.hypot(x-p.x,z-p.z);
    return after>=.5||after>before+.000001;
  });
}
export function moveOnFloor(position,dx,dz,layout){
  if(!Number.isFinite(dx)||!Number.isFinite(dz))return;
  // Sweep each axis so a delayed frame cannot jump over a counter or thin wall.
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dz))/.08));
  for(let i=0;i<steps;i++){
    if(isWalkable(position.x+dx/steps,position.z,layout)&&clearOfPeople(position,position.x+dx/steps,position.z,layout))position.x+=dx/steps;
    if(isWalkable(position.x,position.z+dz/steps,layout)&&clearOfPeople(position,position.x,position.z+dz/steps,layout))position.z+=dz/steps;
  }
}
export function followRoute(position,route,dt,speed,layout){
  if(!route.length)return;
  const p=route[0],dx=p.x-position.x,dz=p.z-position.z,d=Math.hypot(dx,dz);
  if(d<.04){route.shift();return;}
  const x=position.x,z=position.z,step=Math.min(speed*dt,d);moveOnFloor(position,dx/d*step,dz/d*step,layout);
  route.blockedFor=Math.hypot(position.x-x,position.z-z)<.00001?(route.blockedFor||0)+dt:0;
  if(route.blockedFor>1&&layout.people?.length){
    route.blockedFor=0;
    const blockingPeople=peopleNear(position,layout);
    const detour=findPath(position,route.at(-1),{...layout,blockingPeople});
    if(detour.length)route.splice(0,route.length,...detour);
  }
}

export function isWalkable(x, z, layout, radius = .24) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if(layout.blockingPeople?.some(p=>Math.hypot(x-p.x,z-p.z)<.5))return false;
  const inside=Math.abs(x)<=layout.width/2-.35 && Math.abs(z)<=layout.depth/2-.35;
  const doorway=layout.entrance && Math.abs(x)<=layout.entrance.halfWidth-radius && z>=layout.depth/2-.35 && z<=layout.entrance.endZ-radius;
  // Added wings (rooms) keep the same wall clearance; doorway rects bridge the walls.
  const room=layout.rooms?.some(r=>x>=r.x0+.35&&x<=r.x1-.35&&z>=r.z0+.35&&z<=r.z1-.35);
  const door=layout.doors?.some(d=>x>=d.x0&&x<=d.x1&&z>=d.z0&&z<=d.z1);
  if (!inside && !doorway && !room && !door) return false;
  return !layout.obstacles.some(o => Math.abs(x-o.x) < o.w/2+radius && Math.abs(z-o.z) < o.d/2+radius);
}

// Floor bounds across the main room, its entrance and every added wing.
export function floorBounds(layout){
  let minX=-layout.width/2,maxX=layout.width/2,minZ=-layout.depth/2,maxZ=layout.entrance?.endZ??layout.depth/2;
  for(const r of layout.rooms||[]){minX=Math.min(minX,r.x0);maxX=Math.max(maxX,r.x1);minZ=Math.min(minZ,r.z0);maxZ=Math.max(maxZ,r.z1);}
  return {minX,maxX,minZ,maxZ};
}

// Which named area a point is in (for labels, cameras and the NPC's sense of place).
export function zoneAt(x,z,layout){
  for(const r of layout.rooms||[])if(x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)return r.id;
  return 'main';
}

function segmentClear(a,b,layout){const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.08));for(let i=0;i<=steps;i++){const t=i/steps;if(!isWalkable(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,layout))return false;}return true;}
export function findPath(start, end, layout) {
  const step = .32, b = floorBounds(layout), minX = b.minX, minZ = b.minZ;
  const cols = Math.ceil((b.maxX-minX)/step)+1, rows = Math.ceil((b.maxZ-minZ)/step)+1;
  const cell = p => [Math.round((p.x-minX)/step), Math.round((p.z-minZ)/step)];
  const point = (x,z) => ({x:minX+x*step,z:minZ+z*step});
  if (!isWalkable(start.x,start.z,layout)||!isWalkable(end.x,end.z,layout)) return [];
  const [sx,sz] = cell(start), first = sz*cols+sx;
  // The goal cell can round into a clearance box even when `end` itself is clear;
  // then aim for the nearest clear neighbouring cell and finish with a short step.
  let [ex,ez] = cell(end);
  if(!isWalkable(point(ex,ez).x,point(ex,ez).z,layout)){
    let best=null,bestD=Infinity;
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const p=point(ex+dx,ez+dz),d=Math.hypot(p.x-end.x,p.z-end.z);if(d<bestD&&isWalkable(p.x,p.z,layout)&&segmentClear(p,end,layout)){best=[ex+dx,ez+dz];bestD=d;}}
    if(best)[ex,ez]=best;
  }
  const parents = new Int32Array(cols*rows).fill(-1), queue = [first]; parents[first]=first;
  let goal = -1;
  for (let i=0; i<queue.length; i++) {
    const at=queue[i], x=at%cols,z=Math.floor(at/cols);
    if (x===ex && z===ez) {goal=at;break;}
    for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,nz=z+dz,key=nz*cols+nx;
      if(nx<0||nz<0||nx>=cols||nz>=rows||parents[key]!==-1) continue;
      const p=point(nx,nz);if(!segmentClear(at===first?start:point(x,z),p,layout))continue;
      parents[key]=at;queue.push(key);
    }
  }
  if(goal<0)return [];
  const path=[end];
  for(let k=goal;k!==first;k=parents[k])path.push(point(k%cols,Math.floor(k/cols)));
  return path.reverse();
}
