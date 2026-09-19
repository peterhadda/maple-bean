import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Built in the shared bind space so jacket, pockets and straps follow the same rig.
export function addNoahOutfit({THREE,body,addMesh,gridSurface,taperedTube,V3,lerp}){
 const existing=new Set(body.children);
 const olive=new THREE.MeshStandardMaterial({color:0x535d45,roughness:.93,side:THREE.DoubleSide});
 const cream=new THREE.MeshStandardMaterial({color:0xe8ddc9,roughness:1});
 const canvas=new THREE.MeshStandardMaterial({color:0x302b25,roughness:.96});
 const leather=new THREE.MeshStandardMaterial({color:0x956746,roughness:.82});
 const metal=new THREE.MeshStandardMaterial({color:0xbe975d,metalness:.65,roughness:.38});
 const tube=(pts,r,mat,region,side)=>{const m=addMesh(taperedTube(pts.map(p=>new V3(...p)),{segments:24,radial:8,radius:typeof r==='function'?r:()=>r}),mat);if(region)m.userData={region,side};return m;};
 const box=(name,size,pos,mat)=>{const m=addMesh(new THREE.BoxGeometry(...size),mat);m.name=name;m.position.set(...pos);return m;};
 const jacket=addMesh(gridSurface(32,56,(t,u,v)=>{const a=lerp(.35,Math.PI*2-.35,u),side=Math.abs(Math.sin(a)),y=lerp(.92,1.29-.073*side,t),fold=.0035*Math.sin(a*9+t*8)*Math.sin(Math.PI*t)+.003*Math.sin(t*28)*Math.pow(1-t,3);return v.set(Math.sin(a)*(lerp(.128,.066+.079*side,t)+fold),y,Math.cos(a)*(lerp(.107,.064+.035*side,t)+fold)-.012);}),olive);jacket.name='Noah olive jacket';
 for(const sd of [-1,1]){
  tube([[sd*.136,1.226,-.012],[sd*.156,1.08,0],[sd*.179,.95,.02],[sd*.185,.835,.028]],t=>.040+.009*Math.sin(Math.PI*t)+.002*Math.sin(t*37)*Math.sin(Math.PI*t),olive,'arm',sd);
  const shoulder=addMesh(new THREE.SphereGeometry(.045,16,12),olive);shoulder.position.set(sd*.133,1.219,-.014);shoulder.scale.set(1, .72,1.1);shoulder.userData={region:'arm',side:sd};
  tube([[sd*.185,.845,.027],[sd*.186,.819,.028]],.036,olive,'arm',sd);
  tube([[sd*.046,1.25,.093],[sd*.047,1.13,.11],[sd*.044,.94,.115]],.005,leather);
  tube([[sd*.042,1.265,.085],[sd*.052,1.19,.124],[sd*.048,1.12,.127]],.0026,cream);
  box('Jacket welt pocket',[.044,.008,.009],[sd*.089,1.02,.074],leather);
  box('Cargo pocket',[.074,.095,.025],[sd*.122,.65,.055],canvas);
  box('Cargo pocket flap',[.079,.018,.029],[sd*.122,.69,.058],canvas);
  tube([[sd*.081,.94,-.154],[sd*.089,1.17,-.15],[sd*.09,1.278,-.015],[sd*.106,1.17,.08],[sd*.095,.98,.09]],.008,canvas);
 }
 // A soft folded hood behind the neck, open at the face.
 const hood=addMesh(gridSurface(18,48,(t,u,v)=>{const a=lerp(.40,Math.PI*2-.40,u),back=(1-Math.cos(a))*.5,r=.062+.043*Math.sin(t*Math.PI*.7);return v.set(Math.sin(a)*r,1.273-.095*t*back+.012*Math.sin(t*Math.PI),Math.cos(a)*r-.022-.025*back*t);}),cream);hood.material=cream;cream.side=THREE.DoubleSide;hood.name='Cream folded hood';
 const hem=[];for(let i=0;i<=40;i++){const a=.4+(Math.PI*2-.8)*i/40,b=(1-Math.cos(a))*.5;hem.push([Math.sin(a)*.097,1.273-.095*b,Math.cos(a)*.097-.022-.025*b]);}tube(hem,.004,cream);
 const bag=addMesh(new THREE.SphereGeometry(1,20,16),canvas);bag.position.set(0,1.09,-.195);bag.scale.set(.115,.17,.07);bag.name='Noah canvas backpack';
 box('Backpack front pocket',[.155,.092,.025],[0,1.01,-.262],canvas);
 for(const sd of [-1,1]){box('Leather backpack tab',[.018,.14,.01],[sd*.052,1.09,-.261],leather);box('Backpack buckle',[.024,.02,.012],[sd*.052,1.085,-.269],metal);}
 tube([[-.035,1.22,-.185],[-.035,1.275,-.19],[.035,1.275,-.19],[.035,1.22,-.185]],.007,canvas);
 // Batch garment details by material and animation region before binding.
 const batches=new Map();
 for(const mesh of [...body.children]){
  if(existing.has(mesh))continue;
  mesh.updateMatrix();let g=mesh.geometry.clone().applyMatrix4(mesh.matrix);
  for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
  if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
  const key=mesh.material.uuid+mesh.userData.region+mesh.userData.side;
  if(!batches.has(key))batches.set(key,{parts:[],material:mesh.material,data:mesh.userData});
  batches.get(key).parts.push(g);body.remove(mesh);mesh.geometry.dispose();
 }
 for(const {parts,material,data}of batches.values()){const m=addMesh(mergeGeometries(parts),material);m.name='Noah garment details';m.userData=data;parts.forEach(g=>g.dispose());}
}
