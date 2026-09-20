// Modest relaxed male torso fit, preserving all topology, UVs, morphs and rig weights.
import fs from 'node:fs';
const smooth=(a,b,v)=>{let t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
const factor=(x,y)=>1+.18*smooth(.89,.99,y)*(1-smooth(1.06,1.18,y))*(1-smooth(.125,.195,Math.abs(x)));
fs.mkdirSync('qa/expansion/characters/male-fit-source',{recursive:true});
for(const id of ['jules','noah'])for(const suffix of ['','-lod']){
const file=`assets/characters/${id}${suffix}.glb`,source=`qa/expansion/characters/male-fit-source/${id}${suffix}.glb`;if(!fs.existsSync(source))fs.copyFileSync(file,source);
const bytes=fs.readFileSync(source),n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(n+28),seen=new Set();let changed=0;
const acc=i=>{let a=j.accessors[i],v=j.bufferViews[a.bufferView];return{a,v,o:(v.byteOffset||0)+(a.byteOffset||0)}};
for(const mesh of j.meshes)for(const p of mesh.primitives){if(!['Skin','Wardrobe','Accessories'].includes(j.materials[p.material]?.name)||seen.has(p.attributes.POSITION))continue;seen.add(p.attributes.POSITION);const pa=acc(p.attributes.POSITION),na=acc(p.attributes.NORMAL);
for(let i=0;i<pa.a.count;i++){const o=pa.o+i*(pa.v.byteStride||12),no=na.o+i*(na.v.byteStride||12),x=bin.readFloatLE(o),y=bin.readFloatLE(o+4),f=factor(x,y);if(f===1)continue;
const eps=.00001,dx=f+x*(factor(x+eps,y)-factor(x-eps,y))/(2*eps),dy=x*(factor(x,y+eps)-factor(x,y-eps))/(2*eps),nx=bin.readFloatLE(no)/dx,ny=bin.readFloatLE(no+4)-dy*nx,nz=bin.readFloatLE(no+8),len=Math.hypot(nx,ny,nz);bin.writeFloatLE(x*f,o);[nx,ny,nz].forEach((v,k)=>bin.writeFloatLE(v/len,no+k*4));changed++;
}}
fs.writeFileSync(file,bytes);console.log(id+suffix,changed);
}
