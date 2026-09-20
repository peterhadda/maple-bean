// Preserved male outfit, straighter relaxed trousers and less rounded front shirt profile.
import fs from 'node:fs';const smooth=(a,b,v)=>{let t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
fs.mkdirSync('qa/expansion/characters/male-straight-source',{recursive:true});
for(const id of ['jules','noah'])for(const suffix of ['','-lod']){
 const file=`assets/characters/${id}${suffix}.glb`,src=`qa/expansion/characters/male-straight-source/${id}${suffix}.glb`;if(!fs.existsSync(src))fs.copyFileSync(file,src);const bytes=fs.readFileSync(src),n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(n+28),seen=new Set();let count=0;
 const acc=i=>{let a=j.accessors[i],v=j.bufferViews[a.bufferView];return{a,v,o:(v.byteOffset||0)+(a.byteOffset||0)}};
 for(const mesh of j.meshes)for(const p of mesh.primitives){const mat=j.materials[p.material]?.name;if(!['Skin','Wardrobe','Accessories'].includes(mat)||seen.has(p.attributes.POSITION))continue;seen.add(p.attributes.POSITION);const pa=acc(p.attributes.POSITION),na=acc(p.attributes.NORMAL),positions=Array.from({length:pa.a.count},(_,i)=>[0,4,8].map(k=>bin.readFloatLE(pa.o+i*(pa.v.byteStride||12)+k))),parents=positions.map((_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]),same=new Map();
 for(let i=0;i<positions.length;i++){let key=positions[i].map(x=>x.toFixed(5)).join();if(same.has(key))parents[find(i)]=find(same.get(key));else same.set(key,i)}
 const ia=acc(p.indices),isz=ia.a.componentType===5125?4:2,read=isz===4?'readUInt32LE':'readUInt16LE';for(let i=0;i<ia.a.count;i+=3){const a=bin[read](ia.o+i*isz),b=bin[read](ia.o+(i+1)*isz),c=bin[read](ia.o+(i+2)*isz);parents[find(b)]=find(a);parents[find(c)]=find(a)}
 const groups=new Map();for(let i=0;i<positions.length;i++){let root=find(i);if(!groups.has(root))groups.set(root,{min:Infinity,max:-Infinity});const g=groups.get(root);g.min=Math.min(g.min,positions[i][1]);g.max=Math.max(g.max,positions[i][1])}
 
 for(let i=0;i<positions.length;i++){const g=groups.get(find(i)),pants=mat==='Wardrobe'&&((g.min<.08&&g.max>.70&&g.max<1.01)||(g.min>.045&&g.max<.085));
 const deform=([x,y,z])=>{let xx=x,zz=z;if(pants&&y<.65){const band=1-smooth(.1,.65,y),cx=Math.sign(x)*.88*(.131-(y-.066)*.0633);xx=cx+(x-cx)*(1-.28*band);zz=z*(1-(z<0?.37:.12)*band)}const chest=smooth(1.04,1.10,y)*(1-smooth(1.19,1.26,y))*(1-smooth(.105,.16,Math.abs(x)));if(z>0)zz-=.12*chest*z;return[xx,y,zz]};
 const pos=positions[i],out=deform(pos);if(out.every((v,k)=>v===pos[k]))continue;const eps=.00001,deriv=k=>{const a=[...pos],b=[...pos];a[k]+=eps;b[k]-=eps;const da=deform(a),db=deform(b);return da.map((v,c)=>(v-db[c])/(2*eps))},dx=deriv(0),dy=deriv(1),dz=deriv(2),no=na.o+i*(na.v.byteStride||12),nz=bin.readFloatLE(no+8)/dz[2],nx=(bin.readFloatLE(no)-dx[2]*nz)/dx[0],ny=bin.readFloatLE(no+4)-dy[0]*nx-dy[2]*nz,len=Math.hypot(nx,ny,nz),o=pa.o+i*(pa.v.byteStride||12);out.forEach((v,k)=>bin.writeFloatLE(v,o+k*4));[nx,ny,nz].forEach((v,k)=>bin.writeFloatLE(v/len,no+k*4));count++;
 }
 }fs.writeFileSync(file,bytes);console.log(id+suffix,count);
}
