// Small corrective sculpt on existing skinned meshes; preserves topology and identities.
import fs from 'node:fs';

for(const id of ['maya','claire','mara','jules','noah'])for(const suffix of ['','-lod']){
 const path=`assets/characters/${id}${suffix}.glb`,bytes=fs.readFileSync(`qa/expansion/characters/sculpt-source/${id}${suffix}.glb`),n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n),male=['jules','noah'].includes(id),scale=male?1.07:1.14;
 fs.mkdirSync('qa/expansion/characters/sculpt-source',{recursive:true});fs.writeFileSync(`qa/expansion/characters/sculpt-source/${id}${suffix}.glb`,bytes);
 const acc=i=>{const a=doc.accessors[i],v=doc.bufferViews[a.bufferView];return {a,v,offset:(v.byteOffset||0)+(a.byteOffset||0)}};
 const seen=new Set();let face=0,body=0;
 for(const mesh of doc.meshes)for(const p of mesh.primitives){
  if(seen.has(p.attributes.POSITION))continue;seen.add(p.attributes.POSITION);
  const mat=doc.materials[p.material]?.name,pa=acc(p.attributes.POSITION),uv=p.attributes.TEXCOORD_0===undefined?null:acc(p.attributes.TEXCOORD_0),positions=new Float32Array(pa.a.count*3);let changed=false;
  for(let i=0;i<pa.a.count;i++){
   const off=pa.offset+i*(pa.v.byteStride||12),x=bin.readFloatLE(off),y=bin.readFloatLE(off+4),z=bin.readFloatLE(off+8);let nx=x,nz=z;
   if(mat==='Skin'&&uv){
    const uoff=uv.offset+i*(uv.v.byteStride||8),u=bin.readFloatLE(uoff),v=bin.readFloatLE(uoff+4),fx=u*.30-.15,fy=v*.34+1.31;
    const d=(Math.abs(fx)-.056)**2+(fy-1.476)**2;
    if(fy>1.427&&fy<1.469&&d<.041**2&&z>.06){
     // Lower the swollen orbital shell to the eyeball surface plus skin clearance.
     const rawZ=(z-.03)/scale,eye=.065+Math.sqrt(Math.max(0,.038**2-d))+.0012;
     const fall=Math.exp(-(((fy-1.452)/.017)**4));nz=z-Math.max(0,Math.min(.006,rawZ-eye))*scale*fall;face++;changed=true;
    }
   }
   if(mat==='Wardrobe'&&y>.60&&y<1.25&&Math.abs(x)<.25){
    const hip=Math.exp(-(((y-.81)/.11)**2)),shoulder=Math.exp(-(((y-1.19)/.085)**2));
    nx=x*(1-(male?.045:.09)*hip+.04*shoulder);body++;changed=true;
   }
   positions.set([nx,y,nz],i*3);
  }
  if(!changed)continue;
  for(let i=0;i<pa.a.count;i++){for(let j=0;j<3;j++){bin.writeFloatLE(positions[i*3+j],pa.offset+i*(pa.v.byteStride||12)+j*4);}}
 }
 fs.writeFileSync(path,bytes);console.log(id+suffix,{face,body});
}