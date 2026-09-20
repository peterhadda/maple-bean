import fs from 'node:fs';
fs.mkdirSync('qa/expansion/characters/yoke-source',{recursive:true});
for(const id of ['maya','claire','mara','jules','noah'])for(const suffix of ['','-lod']){
 const file=`assets/characters/${id}${suffix}.glb`,source=`qa/expansion/characters/yoke-source/${id}${suffix}.glb`;
 if(!fs.existsSync(source))fs.copyFileSync(file,source);
 const bytes=fs.readFileSync(source),n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(n+28);
 const acc=i=>{let a=j.accessors[i],v=j.bufferViews[a.bufferView];return {a,v,o:(v.byteOffset||0)+(a.byteOffset||0)}};let changed=0;
 for(const mesh of j.meshes)for(const p of mesh.primitives){if(j.materials[p.material]?.name!=='Wardrobe')continue;
 const pa=acc(p.attributes.POSITION),na=acc(p.attributes.NORMAL),points=[];
 for(let i=0;i<pa.a.count;i++){const o=pa.o+i*(pa.v.byteStride||12),pos=[0,4,8].map(k=>bin.readFloatLE(o+k)),no=na.o+i*(na.v.byteStride||12);if(Math.abs(pos[1]-.760)>.0002)continue;points.push({pos,no,normal:[0,4,8].map(k=>bin.readFloatLE(no+k))});}
 // Only the matching split hip/leg ring: leave all non-boundary normals untouched.
 for(const a of points){const near=points.filter(b=>Math.hypot(a.pos[0]-b.pos[0],a.pos[2]-b.pos[2])<.012&&a.normal.reduce((s,v,k)=>s+v*b.normal[k],0)>.6);if(near.length<2)continue;const v=[0,1,2].map(k=>near.reduce((s,b)=>s+b.normal[k],0)),len=Math.hypot(...v);for(let k=0;k<3;k++)bin.writeFloatLE(v[k]/len,a.no+k*4);changed++;}
 }fs.writeFileSync(file,bytes);console.log(id+suffix,changed);
}
