import { Matrix4, Vector3 } from 'three';
export const WALK_STRIDE=.23;
const stepOffset=p=>{p=((p%(Math.PI*2))+Math.PI*2)%(Math.PI*2);return p<=Math.PI?-Math.cos(p):3-2*p/Math.PI;};
export const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const translation=(x,y,z)=>new Matrix4().makeTranslation(x,y,z);
function pivot(rotation,x,y,z){return translation(x,y,z).multiply(rotation).multiply(translation(-x,-y,-z));}

// Bind-space transforms shared by Maya and every cafe resident. Foot targets
// drive a two-segment leg; arms have their own shoulder and elbow pivots.
export function poseMatrices({sit=0,walk=0,wave=0,sip=0,study=0,phase=0,time=0,seatHeight=.54,male=false}={}){
  const stride=WALK_STRIDE*walk*(1-sit);
  // Rise over the planted foot instead of holding a crouch for the whole step.
  const reach=Math.max(Math.abs(stepOffset(phase)),Math.abs(stepOffset(phase+Math.PI)))*stride;
  const drop=(.70-seatHeight)*sit + (.006+.76-Math.sqrt(.76**2-reach**2))*walk*(1-sit);
  const root=translation(0,-drop,0),legs=[],arms=[];
  const gait=walk*(1-sit);
  const pelvis=translation(-.028*Math.sin(phase)*gait,0,0).multiply(pivot(
    new Matrix4().makeRotationY(.10*Math.cos(phase)*gait)
      .multiply(new Matrix4().makeRotationZ(.035*Math.sin(phase)*gait)),
    0,.8-drop,0));
  for(const side of [-1,1]){
    const p=phase+(side<0?Math.PI:0);
    const z=.38*sit + stepOffset(p)*stride;
    const footY=.04+drop+Math.max(0,Math.sin(p))*.055*walk*(1-sit);
    const dy=.8-footY, distance=Math.min(.759999,Math.hypot(dy,z));
    const bend=Math.acos(Math.min(1,distance/.76));
    const hip=-Math.atan2(z,dy)-bend,knee=2*bend;
    const thigh=root.clone().multiply(pivot(new Matrix4().makeRotationX(hip),side*.085,.8,0));
    const shin=thigh.clone().multiply(pivot(new Matrix4().makeRotationX(knee),side*.085,.42,0));
    const foot=shin.clone().multiply(pivot(new Matrix4().makeRotationX(-hip-knee),side*.085,.04,0));
    legs.push({thigh,shin,foot});
    const raised=side>0?wave:0;
    const drinking=side>0?sip:0;
    const shoulderY=1.222,shoulderX=side*.128*(male?1.52:1);
    const swing=-Math.cos(p)*.24*walk*(1-sit)-.10*sit-.35*study*sit+.012*Math.sin(time*3+side)*study;
    const shoulderRotation=new Matrix4().makeRotationZ(side*.65*raised+1.2*drinking).multiply(new Matrix4().makeRotationX(swing*(1-drinking)-.425*drinking));
    const upper=root.clone().multiply(pivot(shoulderRotation,shoulderX,shoulderY,-.02));
    const elbowRotation=new Matrix4().makeRotationZ(side*(2.12+.15*Math.sin(time*7))*raised).multiply(new Matrix4().makeRotationX((-.40*sit-.12*walk*(1-sit))*(1-drinking)-2.225*drinking)).multiply(new Matrix4().makeRotationY(side*1.25*raised));
    const lower=upper.clone().multiply(pivot(elbowRotation,side*.16*(male?1.34:1),1.035,0));
    arms.push({upper,lower});
  }
  return {root,legs,arms,drop,pelvis};
}

export function bindBody(body){
  body.updateMatrixWorld(true);
  const meshes=[];
  body.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.geometry.applyMatrix4(mesh.matrixWorld);
    mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);
    meshes.push({mesh,positions:mesh.geometry.attributes.position.array.slice(),normals:mesh.geometry.attributes.normal.array.slice(),region:mesh.userData.region||'body',side:mesh.userData.side});
  });
  for(const {mesh} of meshes)body.add(mesh);
  for(const child of [...body.children])if(!child.isMesh)body.remove(child);
  return meshes;
}

export function applyPose(meshes,pose){
  const v=new Vector3(),normal=new Vector3(),a=new Vector3(),b=new Vector3(),na=new Vector3(),nb=new Vector3();
  function blend(m1,m2,k){a.copy(v).applyMatrix4(m1);b.copy(v).applyMatrix4(m2);na.copy(normal).transformDirection(m1);nb.copy(normal).transformDirection(m2);a.lerp(b,k);na.lerp(nb,k).normalize();}
  for(const {mesh,positions,normals,region,side} of meshes){
    const pos=mesh.geometry.attributes.position,nor=mesh.geometry.attributes.normal;
    for(let i=0;i<pos.count;i++){
      const k=i*3,x=positions[k],y=positions[k+1];v.set(x,y,positions[k+2]);normal.set(normals[k],normals[k+1],normals[k+2]);
      const index=(side??(x<0?-1:1))<0?0:1;
      if(region==='arm'){
        const arm=pose.arms[index];blend(arm.upper,arm.lower,1-smooth(.985,1.085,y));
        // Sleeve roots stay attached to the torso as the shoulder rotates.
        const rootWeight=(1-smooth(.08,.135,Math.abs(x)))*smooth(1.16,1.23,y);
        a.lerp(b.copy(v).applyMatrix4(pose.root),rootWeight);na.lerp(nb.copy(normal).transformDirection(pose.root),rootWeight).normalize();
      }else if(region==='shoe'){
        a.copy(v).applyMatrix4(pose.legs[index].foot);na.copy(normal).transformDirection(pose.legs[index].foot);
      }else if(y<.88){
        const leg=pose.legs[index];
        if(y>.66){
          // Both pant legs and the hip shell share the same weights at the
          // crotch. No split centre seam when the two thighs move apart.
          blend(pose.legs[0].thigh,pose.legs[1].thigh,smooth(-.048,.048,x));
          const rootWeight=smooth(.77,.88,y);a.lerp(b.copy(v).applyMatrix4(pose.root),rootWeight);na.lerp(nb.copy(normal).transformDirection(pose.root),rootWeight).normalize();
        }else if(y<.14)blend(leg.foot,leg.shin,smooth(.06,.14,y));
        else blend(leg.shin,leg.thigh,smooth(.36,.48,y));
      }else{a.copy(v).applyMatrix4(pose.root);na.copy(normal).transformDirection(pose.root);}
      // Pelvis leads the step; fade through the thighs and waist so feet stay
      // planted and the shoulders/head remain steady.
      const hipWeight=smooth(.30,.72,y)*(1-smooth(.92,1.35,y));
      a.lerp(b.copy(a).applyMatrix4(pose.pelvis),hipWeight);
      pos.setXYZ(i,a.x,a.y,a.z);nor.setXYZ(i,na.x,na.y,na.z);
    }
    pos.needsUpdate=true;mesh.geometry.computeVertexNormals();nor.needsUpdate=true;mesh.geometry.computeBoundingSphere();
  }
}
