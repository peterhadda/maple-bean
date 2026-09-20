// Coordinated stylized blink: full sphere and catchlights retreat behind closing eyelids.
import fs from 'node:fs';
for(const id of ['maya','claire','mara','jules','noah'])for(const suffix of ['','-lod']){
 const path=`assets/characters/${id}${suffix}.glb`,src=`qa/expansion/characters/sculpt-source/${id}${suffix}.glb`,bytes=fs.readFileSync(src),n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n));let bin=Buffer.from(bytes.subarray(n+28));
 const acc=i=>{const a=doc.accessors[i],v=doc.bufferViews[a.bufferView];return {a,v,off:(v.byteOffset||0)+(a.byteOffset||0)}};
 const names=['smile','happy','curious','surprised','focused','laughing','listening','wink','blink.L','blink.R'];
 const scale=['noah','jules'].includes(id)?1.07:1.14;
 const cy=(1.475-.017*Math.exp(-(((1.475-1.434)/.075)**4))-.020-1.465)*scale+1.465;
 const append=values=>{const payload=Buffer.from(values.buffer),off=bin.length;bin=Buffer.concat([bin,payload]);const view=doc.bufferViews.push({buffer:0,byteOffset:off,byteLength:payload.length})-1;return doc.accessors.push({bufferView:view,componentType:5126,count:values.length/3,type:'VEC3',min:[0,1,2].map(k=>{let m=Infinity;for(let i=k;i<values.length;i+=3)m=Math.min(m,values[i]);return m;}),max:[0,1,2].map(k=>{let m=-Infinity;for(let i=k;i<values.length;i+=3)m=Math.max(m,values[i]);return m;})})-1};
 for(const mesh of doc.meshes)for(const p of mesh.primitives){
  if(doc.materials[p.material]?.name!=='Eyes')continue;
  const {a,v,off}=acc(p.attributes.POSITION),zero=new Float32Array(a.count*3),left=zero.slice(),right=zero.slice();
  for(let i=0;i<a.count;i++){const o=off+i*(v.byteStride||12),x=bin.readFloatLE(o),y=bin.readFloatLE(o+4),z=bin.readFloatLE(o+8);if(y<cy-.065)continue;const out=x<0?left:right;out[i*3+1]=(cy-y)*.96;out[i*3+2]=-.018*scale;}
  const z=append(zero),l=append(left),r=append(right);p.targets=names.map(name=>({POSITION:name==='blink.L'?l:name==='blink.R'||name==='wink'?r:z}));mesh.extras={...mesh.extras,targetNames:names};mesh.weights=names.map(()=>0);
 }
 doc.buffers[0].byteLength=bin.length;
 const json=Buffer.from(JSON.stringify(doc)),j=Buffer.alloc((json.length+3)&~3,32);json.copy(j);const out=Buffer.alloc(28+j.length+bin.length);out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(j.length,12);out.writeUInt32LE(0x4e4f534a,16);j.copy(out,20);out.writeUInt32LE(bin.length,20+j.length);out.writeUInt32LE(0x004e4942,24+j.length);bin.copy(out,28+j.length);fs.writeFileSync(path,out);console.log(id+suffix);
}