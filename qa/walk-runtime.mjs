export default [{name:'03-walk-player',run:`
const {createMaya}=await import('/assets/characters/runtime.js');const v=createMaya({character:'maya'});cafe.scene.add(v.group);v.group.position.set(0,0,6);cafe.maya.group.visible=false;let feet=[];v.body.traverse(o=>{if(o.isBone&&/foot/i.test(o.name))feet.push(o)});const reports=[];
for(const speed of [.95,1.75]){
 v.group.position.set(0,0,6);for(let i=0;i<150;i++)v.update(i*.01,.01,{walking:true,walkDistance:0});
 let previous=null,planted=0,maxDrift=0;for(let i=0;i<120;i++){v.group.position.z=6+speed*i*.01;v.update(2+i*.01,.01,{walking:true});v.group.updateMatrixWorld(true);const p=feet.map(b=>b.getWorldPosition(v.group.position.clone()));if(previous)for(let j=0;j<p.length;j++){if(Math.abs(p[j].y-previous[j].y)<.00001){planted++;maxDrift=Math.max(maxDrift,Math.hypot(p[j].x-previous[j].x,p[j].z-previous[j].z));}}previous=p;}
 if(planted<20||maxDrift>.002)throw Error(JSON.stringify({speed,planted,maxDrift}));reports.push({speed,planted,maxDrift});}
cafe.controls.dispatchEvent({type:'start'});cafe.controls.target.set(0,.9,v.group.position.z);cafe.camera.position.set(2.4,1.8,v.group.position.z+3);cafe.controls.update();cafe.renderer.render(cafe.scene,cafe.camera);return reports;
`}];
