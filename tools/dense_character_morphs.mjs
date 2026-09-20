// Keep Blender's exported morph values while using the project's dense accessor convention.
import fs from 'node:fs';
import path from 'node:path';
const dir=process.argv[2];if(!dir)throw Error('Character directory required');
for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.glb'))){
 const file=path.join(dir,name),buf=fs.readFileSync(file),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n));let bin=Buffer.from(buf.subarray(n+28));
 for(const a of j.accessors){
  if(a.bufferView!==undefined&&!a.sparse)continue;
  const size=({5120:1,5121:1,5122:2,5123:2,5125:4,5126:4})[a.componentType],components=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16})[a.type],stride=size*components;
  if(!stride)throw Error('Unsupported accessor');const dense=Buffer.alloc(a.count*stride);
  if(a.bufferView!==undefined){const v=j.bufferViews[a.bufferView];for(let i=0;i<a.count;i++){const off=(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||stride);bin.copy(dense,i*stride,off,off+stride);}}
  if(a.sparse){const s=a.sparse,iv=j.bufferViews[s.indices.bufferView],vv=j.bufferViews[s.values.bufferView],is=({5121:1,5123:2,5125:4})[s.indices.componentType],read=({1:'readUInt8',2:'readUInt16LE',4:'readUInt32LE'})[is];for(let i=0;i<s.count;i++){const idx=bin[read]((iv.byteOffset||0)+(s.indices.byteOffset||0)+i*is),off=(vv.byteOffset||0)+(s.values.byteOffset||0)+i*stride;bin.copy(dense,idx*stride,off,off+stride);}}
  const pad=(4-bin.length%4)%4,offset=bin.length+pad;bin=Buffer.concat([bin,Buffer.alloc(pad),dense]);a.bufferView=j.bufferViews.length;a.byteOffset=0;delete a.sparse;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:dense.length});
 }
 j.buffers[0].byteLength=bin.length;const raw=Buffer.from(JSON.stringify(j)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);const h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);h.writeUInt32LE(json.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(file,Buffer.concat([h,json,bh,bin]));
}
console.log('Normalized dense character morph accessors without changing values.');
