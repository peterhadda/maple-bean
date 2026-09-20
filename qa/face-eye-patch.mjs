// Apply only after the body asset handoff. Writes a separate trial directory.
// The same continuous deformation covers sockets, lashes, eyeballs and morphs.
import fs from 'node:fs';
import path from 'node:path';
import {Matrix3, Vector3} from 'three';
const [input, output] = process.argv.slice(2);
if (!input || !output || path.resolve(input) === path.resolve(output)) throw Error('Supply distinct input and trial output directories.');
fs.mkdirSync(output, {recursive:true});
const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
for (const id of (process.argv[4] ? [process.argv[4]] : ['maya','claire','mara','jules','noah'])) for (const suffix of (process.argv[5] === 'high' ? [''] : ['', '-lod'])) {
  const filename=id+suffix+'.glb', bytes=fs.readFileSync(path.join(input,filename)), length=bytes.readUInt32LE(12);
  const j=JSON.parse(bytes.subarray(20,20+length)); let original=Buffer.from(bytes.subarray(length+28)), bin=Buffer.from(original);
    const accessor=i=>{
    const a=j.accessors[i];let v=j.bufferViews[a.bufferView];
    if(!v||a.sparse){
      if(a.componentType!==5126||a.type!=='VEC3')throw Error('Unsupported sparse accessor');
      const dense=Buffer.alloc(a.count*12);
      if(v)for(let row=0;row<a.count;row++)original.copy(dense,row*12,(v.byteOffset||0)+(a.byteOffset||0)+row*(v.byteStride||12),(v.byteOffset||0)+(a.byteOffset||0)+row*(v.byteStride||12)+12);
      if(a.sparse){const sp=a.sparse,iv=j.bufferViews[sp.indices.bufferView],vv=j.bufferViews[sp.values.bufferView],sz={5121:1,5123:2,5125:4}[sp.indices.componentType],method={1:'readUInt8',2:'readUInt16LE',4:'readUInt32LE'}[sz];for(let row=0;row<sp.count;row++){const index=original[method]((iv.byteOffset||0)+(sp.indices.byteOffset||0)+row*sz),off=(vv.byteOffset||0)+(sp.values.byteOffset||0)+row*12;original.copy(dense,index*12,off,off+12);}}
      const padding=(4-original.length%4)%4,offset=original.length+padding;
      original=Buffer.concat([original,Buffer.alloc(padding),dense]);bin=Buffer.concat([bin,Buffer.alloc(padding),dense]);
      a.bufferView=j.bufferViews.length;a.byteOffset=0;delete a.sparse;v={buffer:0,byteOffset:offset,byteLength:dense.length};j.bufferViews.push(v);j.buffers[0].byteLength=bin.length;
    }
    return {...a,ref:a,stride:v.byteStride,offset:(v.byteOffset||0)+(a.byteOffset||0)};
  };
  const read3=(a,i)=>new Vector3(...[0,1,2].map(k=>original.readFloatLE(a.offset+i*(a.stride||12)+k*4)));
  const write3=(a,i,v)=>{for(let k=0;k<3;k++)bin.writeFloatLE(v.getComponent(k),a.offset+i*(a.stride||12)+k*4);};
  const centers=[];
  for(const node of j.nodes){
    if(node.mesh===undefined||node.skin===undefined)continue;
    const names=j.skins[node.skin].joints.map(i=>j.nodes[i].name.replaceAll('.',''));
    for(const p of j.meshes[node.mesh].primitives){
      if(j.materials[p.material].name!=='Eyes')continue;
      const pos=accessor(p.attributes.POSITION),ix=accessor(p.attributes.JOINTS_0),w=accessor(p.attributes.WEIGHTS_0),size=ix.componentType===5121?1:2;
      for(const eye of ['eyeL','eyeR']){
        const lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity);let count=0;
        for(let i=0;i<pos.count;i++){
          let belongs=false;
          for(let k=0;k<4;k++){
            const index=original[size===1?'readUInt8':'readUInt16LE'](ix.offset+i*(ix.stride||size*4)+k*size);
            if(names[index]===eye&&original.readFloatLE(w.offset+i*(w.stride||16)+k*4)>.5)belongs=true;
          }
          if(belongs){const v=read3(pos,i);lo.min(v);hi.max(v);count++;}
        }
        if(count)centers.push(lo.add(hi).multiplyScalar(.5));
      }
    }
  }
  if(centers.length!==2)throw Error(filename+': expected two eye centers');
  const indicesOf=p=>{const a=accessor(p.indices),size={5121:1,5123:2,5125:4}[a.componentType],method={1:'readUInt8',2:'readUInt16LE',4:'readUInt32LE'}[size];return Array.from({length:a.count},(_,i)=>original[method](a.offset+i*(a.stride||size)));};
  const lids=centers.map(c=>({eye:c,points:[]}));
  for(const mesh of j.meshes)for(const p of mesh.primitives){
    if(j.materials[p.material].name!=='Skin'||p.indices===undefined)continue;
    const pos=accessor(p.attributes.POSITION),indices=indicesOf(p),edges=new Map();
    for(let i=0;i<indices.length;i+=3)for(let k=0;k<3;k++){const a=indices[i+k],b=indices[i+(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');edges.set(key,(edges.get(key)||0)+1);}
    const boundary=new Set([...edges].filter(([,n])=>n===1).flatMap(([s])=>s.split(',').map(Number)));
    for(const index of boundary){const v=read3(pos,index);for(const lid of lids)if(v.z>.075&&Math.abs(v.x-lid.eye.x)<.050&&Math.abs(v.y-lid.eye.y)<.039)lid.points.push(v);}
  }
  for(const lid of lids){
    if(lid.points.length<10)throw Error(filename+': missing actual eyelid boundary');
    const lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity);for(const p of lid.points){lo.min(p);hi.max(p);}
    lid.center=lo.clone().add(hi).multiplyScalar(.5);lid.rx=(hi.x-lo.x)/2;lid.ry=(hi.y-lo.y)/2;
    lid.left=lid.points.reduce((a,b)=>a.x<b.x?a:b);lid.right=lid.points.reduce((a,b)=>a.x>b.x?a:b);
  }
  function closeLid(p,name){
    const side=name==='blink.L'?0:1,lid=lids[side],dx=(p.x-lid.center.x)/lid.rx,dy=(p.y-lid.center.y)/lid.ry;
    if(p.z<.065)return p.clone();
    const angle=Math.atan2(dy,dx); const radial=lid.points.map(q=>{const qx=(q.x-lid.center.x)/lid.rx,qy=(q.y-lid.center.y)/lid.ry;let difference=Math.abs(Math.atan2(qy,qx)-angle);difference=Math.min(difference,Math.PI*2-difference);return {difference,r:Math.hypot(qx,qy)};}).sort((a,b)=>a.difference-b.difference); const boundaryRadius=radial.slice(0,2).reduce((sum,q)=>sum+q.r,0)/2; const influence=1-smooth(1.12,1.95,Math.hypot(dx,dy)/boundaryRadius);if(!influence)return p.clone();
    const t=Math.max(0,Math.min(1,(p.x-lid.left.x)/(lid.right.x-lid.left.x)));
    const y=lid.left.y+(lid.right.y-lid.left.y)*t+.001*Math.sin(t*Math.PI);
    let z=0,total=0;for(const q of lid.points){const w=Math.exp(-(((q.x-p.x)/.008)**2));z+=q.z*w;total+=w;}z/=total;
    return p.clone().lerp(new Vector3(p.x,y,z),influence);
  }
  function lashOffsets(p,pos){
    const offsets=new Map();if(p.indices===undefined)return offsets;
    const indices=indicesOf(p),parents=Array.from({length:pos.count},(_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
    for(let i=0;i<indices.length;i+=3){parents[find(indices[i])]=find(indices[i+1]);parents[find(indices[i])]=find(indices[i+2]);}
    const groups=new Map();for(const i of new Set(indices)){const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i);}
    const components=[...groups.values()].map(ids=>{const points=ids.map(i=>read3(pos,i)),lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity);for(const v of points){lo.min(v);hi.max(v);}return {ids,points,lo,hi};});
    const outlines=components.filter(c=>c.hi.x-c.lo.x>.045&&c.hi.y<1.485&&c.lo.y>1.40&&c.lo.z>.10);
    for(const tip of components.filter(c=>c.hi.x-c.lo.x<.020&&c.hi.y-c.lo.y<.020&&c.lo.y>1.42&&c.hi.y<1.48&&c.lo.z>.13)){
      const inner=Math.min(...tip.points.map(v=>Math.abs(v.x))),rootPoints=tip.points.filter(v=>Math.abs(v.x)<inner+.0015),root=rootPoints.reduce((v,p)=>v.add(p),new Vector3()).multiplyScalar(1/rootPoints.length);
      const candidates=outlines.flatMap(c=>c.points).filter(v=>v.x*root.x>0);if(!candidates.length)continue;
      const nearest=candidates.reduce((a,b)=>a.distanceToSquared(root)<b.distanceToSquared(root)?a:b),shift=nearest.clone().sub(root);shift.z+=.0003;
      for(const i of tip.ids)offsets.set(i,shift);
    }
    return offsets;
  }
  function warp(p){
    let weight=0;const displacement=new Vector3();
    for(const c of centers){
      const d=p.clone().sub(c);
      const a=(1-smooth(.043,.083,Math.abs(d.x)))*(1-smooth(.037,.074,Math.abs(d.y)))*(1-smooth(.065,.11,Math.abs(d.z)));
      if(a<=0)continue;
      // Modest first pass: aperture reduction and less protrusion, not a new face.
      displacement.addScaledVector(new Vector3(-.10*d.x,-.16*d.y,-.15*d.z-.003),a);weight+=a;
    }
    return p.clone().addScaledVector(displacement,1/Math.max(1,weight));
  }
  function normalAt(p,n){
    const epsilon=.00001,cols=[];
    for(let k=0;k<3;k++){
      const plus=p.clone(),minus=p.clone();plus.setComponent(k,plus.getComponent(k)+epsilon);minus.setComponent(k,minus.getComponent(k)-epsilon);
      cols.push(warp(plus).sub(warp(minus)).multiplyScalar(1/(2*epsilon)));
    }
    const m=new Matrix3().set(cols[0].x,cols[1].x,cols[2].x,cols[0].y,cols[1].y,cols[2].y,cols[0].z,cols[1].z,cols[2].z).invert().transpose();
    return n.clone().applyMatrix3(m).normalize();
  }
  const touched=new Set();let changed=0;
  for(const mesh of j.meshes)for(const p of mesh.primitives){
    const material=j.materials[p.material].name;
    if((!['Skin','Eyes','Accessories'].includes(material)&&!(material==='Hair'&&p.targets))||touched.has(p.attributes.POSITION))continue;
    touched.add(p.attributes.POSITION);
    const pos=accessor(p.attributes.POSITION),normal=p.attributes.NORMAL===undefined?null:accessor(p.attributes.NORMAL);
    const offsets=material==='Hair'?lashOffsets(p,pos):new Map();
    const morphs=(p.targets||[]).map((t,index)=>({name:mesh.extras?.targetNames?.[index],position:t.POSITION===undefined?null:accessor(t.POSITION),normal:t.NORMAL===undefined?null:accessor(t.NORMAL)}));
    for(let i=0;i<pos.count;i++){
      const base=read3(pos,i).add(offsets.get(i)||new Vector3()),next=warp(base);if(!offsets.has(i)&&!(['Skin','Hair'].includes(material)&&morphs.some(m=>m.position&&(m.name?.startsWith('blink.')||m.name==='wink')&&read3(m.position,i).lengthSq()>1e-18))&&base.distanceToSquared(next)<1e-18&&!morphs.some(m=>{if(!m.position)return false;const p=base.clone().add(read3(m.position,i));return p.distanceToSquared(warp(p))>1e-18;}))continue;
      changed++;write3(pos,i,next);
      const oldNormal=normal?read3(normal,i):null,newNormal=oldNormal?normalAt(base,oldNormal):null;
      if(normal)write3(normal,i,newNormal);
      for(const morph of morphs){
        const delta=morph.position?read3(morph.position,i):new Vector3();
        const blink=morph.name?.startsWith('blink.')||morph.name==='wink';
        const absolute=blink&&['Skin','Hair'].includes(material)?closeLid(base,morph.name):base.clone().add(delta);
        if(morph.position)write3(morph.position,i,warp(absolute).sub(next));
        if(morph.normal&&oldNormal)write3(morph.normal,i,normalAt(absolute,oldNormal.clone().add(read3(morph.normal,i))).sub(newNormal));
      }
    }
    if(normal&&['Skin','Hair'].includes(material)&&p.indices!==undefined){
      const indices=indicesOf(p),readOut=(a,i)=>new Vector3(...[0,1,2].map(k=>bin.readFloatLE(a.offset+i*(a.stride||12)+k*4)));
      for(const morph of morphs.filter(m=>m.position&&m.normal&&(m.name?.startsWith('blink.')||m.name==='wink'))){
        const points=Array.from({length:pos.count},(_,i)=>readOut(pos,i).add(readOut(morph.position,i)));
        const normals=points.map(()=>new Vector3());
        for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3),face=new Vector3().subVectors(points[b],points[a]).cross(new Vector3().subVectors(points[c],points[a]));normals[a].add(face);normals[b].add(face);normals[c].add(face);}
        // Welding coincident UV split vertices keeps the eyelid surface smooth.
        const weld=new Map(),keys=points.map(v=>[v.x,v.y,v.z].map(n=>Math.round(n*1e6)).join(','));
        for(let i=0;i<points.length;i++){if(!weld.has(keys[i]))weld.set(keys[i],new Vector3());weld.get(keys[i]).add(normals[i]);}
        for(let i=0;i<points.length;i++){
          const baseNormal=readOut(normal,i),closedNormal=weld.get(keys[i]).clone();
          if(closedNormal.lengthSq()<1e-16)closedNormal.copy(baseNormal);else closedNormal.normalize();
          const base=read3(pos,i);if(base.y<1.36||base.y>1.54||base.z<.025)continue;
          write3(morph.normal,i,closedNormal.sub(baseNormal));
        }
      }
    }
    for(const a of [pos,...morphs.map(m=>m.position)].filter(Boolean)){
      const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const v=bin.readFloatLE(a.offset+i*(a.stride||12)+k*4);lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v);}
      a.ref.min=lo;a.ref.max=hi;
    }
  }
  const json=Buffer.from(JSON.stringify(j)),pad=(4-json.length%4)%4,jsonData=Buffer.concat([json,Buffer.alloc(pad,32)]),header=Buffer.alloc(20),binaryHeader=Buffer.alloc(8);
  header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+jsonData.length+bin.length,8);header.writeUInt32LE(jsonData.length,12);header.writeUInt32LE(0x4e4f534a,16);binaryHeader.writeUInt32LE(bin.length);binaryHeader.writeUInt32LE(0x004e4942,4);
  fs.writeFileSync(path.join(output,filename),Buffer.concat([header,jsonData,binaryHeader,bin]));
  console.log(JSON.stringify({filename,changed,centers:centers.map(c=>c.toArray())}));
}


