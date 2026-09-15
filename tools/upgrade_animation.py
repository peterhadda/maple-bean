from pathlib import Path
p=Path('tools/build_maya.py')
s=p.read_text()
start=s.index('animation = r\'\'\'')
end=s.index("out = ",start)
replacement='''animation = r\'\'\'
  const bound = bindBody(body);
  if (options.male) for (const entry of bound) {
    const p=entry.positions;
    for(let i=0;i<p.length;i+=3) {
      const y=p[i+1],width=y>.98?lerp(1.35,1.58,ss(.98,1.23,y)):y<.72?.85:1.05;
      p[i]*=width;
    }
  }
  const expressions={neutral:{smile:0,wink:0,blinkL:0,blinkR:0},happy:{smile:.85,wink:0,blinkL:0,blinkR:0},wink:{smile:.35,wink:.7,blinkL:1,blinkR:0}};
  let sit=0,walk=0,wave=0,phase=0,lastPose='',nextBlink=2.5,blinkStart=-10;
  function update(t=0,dt=.016,state={}) {
    const ease=state.still?1:1-Math.exp(-dt*9);
    sit+=((state.sitting?1:0)-sit)*ease;
    walk+=((state.walking?1:0)-walk)*ease;
    wave+=((state.wave?1:0)-wave)*ease;
    phase+=dt*10.2*walk;
    const target=expressions[state.expression]||expressions.neutral;
    for(const k in face)face[k]+=(target[k]-face[k])*ease;
    if(t>nextBlink){blinkStart=t;nextBlink=t+3.2+rand()*2;}
    const bt=(t-blinkStart)/.20;
    applyFaceState(state.still?0:bt>=0&&bt<1?Math.sin(Math.PI*bt):0);
    headGroup.rotation.set(0,state.still?0:.018*Math.sin(t*.6),0);
    const seatHeight=state.seatHeight??.54;
    const poseKey=[sit.toFixed(3),walk.toFixed(3),wave.toFixed(3),seatHeight,walk>.002?phase.toFixed(3):'',wave>.002?t.toFixed(3):''].join(':');
    if(poseKey!==lastPose){
      lastPose=poseKey;
      const pose=poseMatrices({sit,walk,wave,phase,time:t,seatHeight,male:options.male});
      applyPose(bound,pose);headGroup.position.y=HEAD_POS.y-pose.drop;
    }
  }
  update(0,0,{still:true});
  maya.name=options.name||'Maya';
  return {group:maya,update,head:headGroup,body,face,hair:hairMesh};
}
\'\'\'
'''
s=s[:start]+replacement+s[end:]
s=s.replace('export function createMaya(options = {}) {\\nconst V3', "import { bindBody, applyPose, poseMatrices } from './animation.js';\\nexport function createMaya(options = {}) {\\nconst V3")
# Tag complete meshes at construction; fingers are arms even below hip height.
tag="""model = model.replace('  const P = (x, y, z) => new V3(sd * x, y, z);', '  const armStart=body.children.length;\\n  const P = (x, y, z) => new V3(sd * x, y, z);')
model = model.replace('  addMesh(mergeGeometries(fg), skinMat);', \"  addMesh(mergeGeometries(fg), skinMat);\\n  for(const mesh of body.children.slice(armStart)){mesh.userData.region='arm';mesh.userData.side=sd;}\")
model = model.replace('  ring(0.975, 0.0035, 0.0022, contactMat);', \"  ring(0.975, 0.0035, 0.0022, contactMat);\\n  grp.traverse(mesh=>{mesh.userData.region='shoe';mesh.userData.side=sd;});\")
"""
s=s.replace("animation = r'''",tag+"\nanimation = r'''",1)
p.write_text(s)
print('Installed separate arm, leg and foot skinning in the shared builder')
