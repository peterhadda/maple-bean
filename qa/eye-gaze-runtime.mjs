export default [{name:'01-eye-gaze-fixed',run:`
const THREE=await import('three');const {createMaya}=await import('/assets/characters/runtime.js');const results=[];let shown;
for(const id of ['maya','claire','mara','jules','noah']){
 const a=createMaya({character:id,male:['noah','jules'].includes(id)});cafe.scene.add(a.group);a.group.position.set(0,0,4);const eyes=[];
 a.body.traverse(m=>{if(!m.isSkinnedMesh||m.material.name!=='Eyes')return;const p=m.geometry.attributes.position,ix=m.geometry.attributes.skinIndex,w=m.geometry.attributes.skinWeight;for(const side of ['L','R']){const box=new THREE.Box3();let index=-1,count=0;for(let i=0;i<p.count;i++){for(let j=0;j<4;j++){const b=m.skeleton.bones[ix.getComponent(i,j)];if(b&&new RegExp('^eye'+side+'$','i').test(b.name)&&w.getComponent(i,j)>.5){box.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));index=i;count++;break;}}}if(count)eyes.push({m,index,center:box.getCenter(new THREE.Vector3()),count});}});
 if(eyes.length!==2)throw Error(id+' eye group count '+eyes.length);
 const centers=target=>{for(let k=0;k<50;k++)a.update(5,.02,{still:true,blink:0,lookTarget:target});a.group.updateMatrixWorld(true);const inv=a.head.matrixWorld.clone().invert();return eyes.map(e=>e.m.applyBoneTransform(e.index,e.center.clone()).applyMatrix4(e.m.matrixWorld).applyMatrix4(inv));};
 const base=centers(new THREE.Vector3(0,1.5,12));let max=0;for(const t of [new THREE.Vector3(-20,1.5,5),new THREE.Vector3(20,1.5,5),new THREE.Vector3(0,20,5),new THREE.Vector3(0,-20,5)]){const p=centers(t);for(let i=0;i<2;i++)max=Math.max(max,p[i].distanceTo(base[i]));}
 if(max>.001)throw Error(JSON.stringify({id,max}));results.push({id,max,eyeVertices:eyes.map(e=>e.count)});a.group.visible=false;if(id==='maya')shown=a;
}
cafe.maya.group.visible=false;shown.group.visible=true;shown.update(5,.02,{still:true,blink:0,lookTarget:new THREE.Vector3(20,1.5,5)});shown.group.updateMatrixWorld(true);cafe.controls.dispatchEvent({type:'start'});cafe.controls.minDistance=.5;cafe.controls.target.set(0,1.47,4);cafe.camera.position.set(.2,1.54,5.1);cafe.controls.update();cafe.renderer.render(cafe.scene,cafe.camera);return results;
`}];
