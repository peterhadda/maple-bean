// Settle only the folded hood's forward tips onto the shirt neckline; keep its open front.
import fs from 'node:fs';
for(const suffix of ['','-lod']){
 const file=`assets/characters/noah${suffix}.glb`,bytes=fs.readFileSync(file),n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(n+28);const acc=i=>{let a=j.accessors[i],v=j.bufferViews[a.bufferView];return {a,v,o:(v.byteOffset||0)+(a.byteOffset||0)}};let adjusted=0;
 for(const mesh of j.meshes)for(const p of mesh.primitives){if(j.materials[p.material]?.name!=='Wardrobe')continue;const pa=acc(p.attributes.POSITION),ia=acc(p.indices),sz=ia.a.componentType===5125?4:2,read=sz===4?'readUInt32LE':'readUInt16LE',parents=Array.from({length:pa.a.count},(_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]),points=[],same=new Map();
 for(let i=0;i<pa.a.count;i++){let o=pa.o+i*(pa.v.byteStride||12),v=[0,4,8].map(k=>bin.readFloatLE(o+k));points.push(v);let key=v.map(x=>x.toFixed(5)).join();if(same.has(key))parents[find(i)]=find(same.get(key));else same.set(key,i);}
 for(let i=0;i<ia.a.count;i+=3){let a=bin[read](ia.o+i*sz),b=bin[read](ia.o+(i+1)*sz),c=bin[read](ia.o+(i+2)*sz);parents[find(b)]=find(a);parents[find(c)]=find(a);}
 const groups=new Map();for(let i=0;i<pa.a.count;i++){let key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}let hood=0;
 for(const ids of groups.values()){const min=[0,1,2].map(k=>Math.min(...ids.map(i=>points[i][k]))),max=[0,1,2].map(k=>Math.max(...ids.map(i=>points[i][k])));if(!(min[1]>1.19&&max[1]<1.29&&min[2]<-.13&&max[2]>.05&&Math.max(-min[0],max[0])<.115))continue;hood++;
 for(const i of ids){const [x,y,z]=points[i],t=Math.max(0,Math.min(1,(z-.005)/.06));if(!t)continue;const o=pa.o+i*(pa.v.byteStride||12);bin.writeFloatLE(y-.022*t,o+4);bin.writeFloatLE(z-.018*t,o+8);adjusted++;}
 }if(hood!==1)throw Error('Expected exactly one folded hood: '+hood);
 }fs.writeFileSync(file,bytes);console.log('noah'+suffix,adjusted);
}