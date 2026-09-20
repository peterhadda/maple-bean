import fs from 'node:fs';
const ids=['maya','claire','noah','mara','jules'];
for(const id of ids)for(const suffix of ['', '-lod']){
 const file=`assets/characters/${id}${suffix}.glb`,bytes=fs.readFileSync(file);
 const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n));
 const bin=bytes.subarray(28+n),png=fs.readFileSync(`qa/expansion/characters/paint/${id}.png`);
 const skin=doc.materials.find(m=>m.name==='Skin');
 const image=doc.images[doc.textures[skin.pbrMetallicRoughness.baseColorTexture.index].source];
 const offset=(bin.length+3)&~3,combined=Buffer.alloc((offset+png.length+3)&~3);bin.copy(combined);png.copy(combined,offset);
 image.bufferView=doc.bufferViews.length;image.mimeType='image/png';delete image.uri;
 doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:png.length});doc.buffers[0].byteLength=combined.length;
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc((json.length+3)&~3,32);json.copy(padded);
 const out=Buffer.alloc(28+padded.length+combined.length);out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);out.writeUInt32LE(combined.length,20+padded.length);out.writeUInt32LE(0x004e4942,24+padded.length);combined.copy(out,28+padded.length);
 // All existing mesh, skin, animation and expression accessors remain byte-identical.
 for(const a of doc.accessors){if(a.bufferView===undefined)continue;const v=doc.bufferViews[a.bufferView];if(!bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength).equals(combined.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength)))throw Error('Changed geometry');}
 fs.writeFileSync(file,out);console.log(file,png.length);
}