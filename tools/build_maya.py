"""Extract the user's procedural Maya into one shared, refined character module."""
from pathlib import Path

source = Path('original/maya.html').read_text(encoding='utf-8')
helpers = source[source.index('function mulberry32'):source.index('// ------------------------------------------------------------------ renderer / scene')]
model = source[source.index('const COL ='):source.index('// ------------------------------------------------------------------ lights')]
model = model.replace('};\n\nfunction skinMaterial', ', ...(options.colors || {})\n};\n\nfunction skinMaterial',1)
model = model.replace('const HEAD_SCALE = 1.14', 'const HEAD_SCALE = options.male ? 1.07 : 1.14')
model = model.replace('skinMaterial(null, 0xe4957a)', 'skinMaterial(null, COL.skin)')
model = model.replace('const hairMat = hairMaterial();', "const hairMat = options.character === 'claire' ? new THREE.MeshPhysicalMaterial({color:COL.hair,roughness:.62,vertexColors:true,specularIntensity:.24}) : hairMaterial();")
model = model.replace('const HR = { x: 0.121', 'const HR = { x: options.male ? 0.132 : 0.121')
model = model.replace('[1,0.58]', '[1, options.male ? 0.78 : 0.58]')
model = model.replace('z += 0.020 * nb', 'z += 0.020 * nb')
# Eye, eyebrow and fabric palettes preserve each resident's identity.
model = model.replace("gr.addColorStop(0, '#2e1408');", "gr.addColorStop(0, options.character === 'claire' ? '#15314c' : '#2e1408');")
for old,new in [('#874526','#739fc6'),('#6a3419','#5481ad'),('#4a210d','#355879'),('#1c0b04','#172e48')]:
    model = model.replace("'"+old+"'", "(options.character === 'claire' ? '"+new+"' : '"+old+"')")
model = model.replace('rgba(210,130,70,${0.30 * dn})', "rgba(${options.character === 'claire' ? '160,201,232' : '210,130,70'},${0.30 * dn})")
model = model.replace("g.fillStyle = 'rgba(50,30,22,0.96)'", "g.fillStyle = options.character === 'claire' ? 'rgba(128,85,52,.96)' : 'rgba(50,30,22,.96)'")
model = model.replace('const spikes = [[', 'const spikes = options.male ? [] : [[')
model = model.replace('0.0011 + 0.0024 * Math.pow(t, 0.9)', '(options.male ? 0.0006 : 0.0011) + (options.male ? 0.0008 : 0.0024) * Math.pow(t, 0.9)')
model = model.replace('const TOP = { y0: 1.030, y1: 1.262 };', "const TOP = { y0: options.male ? 0.97 : 1.030, y1: options.character === 'claire' ? 1.215 : 1.262 };")
model = model.replace("g.fillStyle = '#f4e6d9';", "g.fillStyle = '#' + COL.top.toString(16).padStart(6, '0');")
model = model.replace('g.fillStyle = \'#ef5a52\'; g.fill(); g.lineWidth = 3; g.strokeStyle = \'rgba(190,50,45,0.6)\'; g.stroke();', "if (!options.character || options.character === 'maya') {g.fillStyle = '#ef5a52'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(190,50,45,0.6)'; g.stroke();}")
model = model.replace('base = [0x62, 0x7b, 0xa3]', 'base = [(COL.denim >> 16)&255, (COL.denim >> 8)&255, COL.denim&255]')
# Keep the men's chest flatter and shoulders broader. Their shirt covers the
# waist, and their jeans have a straighter, less flared silhouette.
model = model.replace('z += 0.024 * cs * gauss', 'z += (options.male ? 0.002 : 0.024) * cs * gauss')
model = model.replace('const w = topW(yn) + grow', 'const w = topW(yn) + grow')
model = model.replace('// face-framing tendrils (wavy, curl outward) and nape wisps', "if (!options.male && options.character !== 'claire') {\n// face-framing tendrils (wavy, curl outward) and nape wisps")
model = model.replace('const hairMesh = new THREE.Mesh', '''}
if (options.character === 'claire') {
  // Claire's reference: full, honey-blonde S-waves to the lower back.
  for (let k = 0; k < 24; k++) {
    const psi = 0.72 + (Math.PI * 2 - 1.44) * k / 23;
    const pts = [];
    for (let j = 0; j <= 14; j++) {
      const t = j/14, start = shellPoint(psi, .60, .002);
      const spread = .139 + .024*Math.sin(t*Math.PI);
      const sway = .015*Math.sin(t*12+k*.5)*ss(0,.25,t);
      pts.push(new V3(lerp(start.x, Math.sin(psi)*spread+sway, ss(0,.3,t)), lerp(start.y,-.47+.033*Math.sin(k*1.9),t), lerp(start.z, Math.cos(psi)*.146-.023+.012*Math.sin(t*12+k*.5),ss(0,.3,t))));
    }
    hairParts.push(prepHair(taperedTube(pts,{segments:52,radial:7,flatten:.70,radius:t=>.022*(.7+.3*Math.sin(Math.PI*t))*Math.pow(1-t,.32)}),.9+(k%3)*.07));
  }
  for (const sd of [-1,1]) for (let k=0;k<3;k++) {
    const p=shellPoint(sd*(.7+k*.15),.53,.006);
    const pts=[p,new V3(sd*.142,-.015,.074),new V3(sd*(.132+k*.009),-.115,.109),new V3(sd*(.155+k*.008),-.24,.115),new V3(sd*.128,-.36,.126),new V3(sd*.153,-.43,.11)];
    hairParts.push(prepHair(taperedTube(pts,{segments:60,radial:7,flatten:.72,radius:t=>.013*Math.pow(1-t,.4)}),1.03+k*.04));
  }
}
const hairMesh = new THREE.Mesh''')
model = model.replace('headGroup.add(tie);', "headGroup.add(tie); tie.visible = !options.male && options.character !== 'claire';")
model = model.replace('}), sleeveMat);\n  addMesh(taperedTube([P(0.176', "}), options.character === 'claire' ? skinMat : sleeveMat);\n  addMesh(taperedTube([P(0.176")
model += r'''
if (options.character === 'mara') {
  const apronMat = new THREE.MeshStandardMaterial({color:0xe6d9bc,roughness:.96,side:THREE.DoubleSide});
  addMesh(gridSurface(16,20,(t,u,v)=>{
    const y=lerp(.72,1.18,t),w=lerp(.14,.072,ss(.84,1.18,y)),x=(u-.5)*2*w;
    return v.set(x,y,.106+.01*Math.sin(u*Math.PI));
  }),apronMat);
  const strap=[];for(let i=0;i<=30;i++){const a=i/30*Math.PI;strap.push(new V3(Math.cos(a)*.071,1.18+Math.sin(a)*.08,.079));}
  addMesh(taperedTube(strap,{segments:30,radial:6,radius:()=>.007}),apronMat);
  const pocket=addMesh(new THREE.BoxGeometry(.11,.075,.004),apronMat);pocket.position.set(0,.89,.121);
}
if (options.character === 'claire') {
  const cardigan = new THREE.MeshPhysicalMaterial({color:0xdcb69e,normalMap:topRib,normalScale:new THREE.Vector2(.6,.6),roughness:1,sheen:.7,sheenColor:new THREE.Color(0xf5dfca),side:THREE.DoubleSide});
  const gold=new THREE.MeshStandardMaterial({color:0xd9b56b,metalness:.7,roughness:.4});
  for(const sd of [-1,1]) {
    const sleeve=addMesh(taperedTube([new V3(sd*.15,1.105,-.004),new V3(sd*.16,1.02,.01),new V3(sd*.18,.94,.02),new V3(sd*.184,.865,.03)],{segments:38,radial:16,radius:t=>.042+.008*Math.sin(t*23)}),cardigan);sleeve.userData={region:'arm',side:sd};
    addMesh(taperedTube([new V3(sd*.072,1.193,.052),new V3(sd*.079,1.246,-.014),new V3(sd*.076,1.202,-.077)],{segments:25,radial:8,radius:()=>.006}),topMat);
  }
  addMesh(gridSurface(18,40,(t,u,v)=>{const s=u*2-1;return v.set(s*.18,lerp(.80+.14*Math.abs(s),1.01+.08*Math.abs(s),t),-.13-.022*(1-s*s)-.006*Math.cos(u*40));}),cardigan);
  for(let i=0;i<4;i++){const button=addMesh(new THREE.SphereGeometry(.0038,12,8),gold);button.position.set(0,1.08+i*.033,.086);}
  const chain=[];for(let i=0;i<=30;i++){const s=i/30*2-1;chain.push(new V3(s*.045,1.237+Math.abs(s)*.067,.065-.017*Math.abs(s)));}
  addMesh(taperedTube(chain,{segments:36,radial:5,radius:()=>.0013}),gold);
  const medallion=addMesh(new THREE.CylinderGeometry(.011,.011,.003,24).rotateX(Math.PI/2),gold);medallion.position.set(0,1.229,.069);
}
'''
model = model.replace('const maya = new THREE.Group(); scene.add(maya);', "const maya = new THREE.Group(); maya.name = 'Maya';")
model = model.replace("if (Q.get('nohair') === '1')", 'if (options.nohair)')
model = model.replace("hairMesh.castShadow = true; hairMesh.receiveShadow = true;", "hairMesh.name = 'Maya hair'; hairMesh.castShadow = true; hairMesh.receiveShadow = false;")
model = model.replace('headMesh.castShadow = true; headMesh.receiveShadow = true;', "headMesh.name = 'Maya face'; headMesh.castShadow = true; headMesh.receiveShadow = false;")
# The old scalp was a complete shell, including behind the eye sockets. Start
# each longitude at the real hairline, rather than cutting a jagged triangle edge.
model = model.replace('// scalp shell: grooves converge on the bun', '''function hairlineElevation(psi) {
  const p = new V3(); let lo = -1.2, hi = 1.45;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    headBase(dirOf(psi, mid), p);
    if (hairness(p) > 0.08) hi = mid; else lo = mid;
  }
  return hi;
}
// scalp shell: grooves converge on the bun''')
model = model.replace('psi = Math.PI * s, el = lerp(-1.2, Math.PI / 2, t);', 'psi = Math.PI * s, el = lerp(hairlineElevation(psi), Math.PI / 2, t);')
needle = "  const p = g.attributes.position, T = new V3(), n = new V3(), v = new V3();"
# Avoid leaked temporary geometry on each blink / expression update.
model = model.replace('e.lash.geometry.dispose(); e.lash.geometry = mergeGeometries(parts);', 'e.lash.geometry.dispose(); e.lash.geometry = mergeGeometries(parts); parts.forEach(g => g.dispose());')
model = model.replace('const hairMesh = new THREE.Mesh(mergeGeometries(hairParts), hairMat);', 'const hairMesh = new THREE.Mesh(mergeGeometries(hairParts), hairMat); hairParts.forEach(g => g.dispose());')
model = model.replace('Math.abs(e.blink - blink) < 1e-4 && Math.abs(e.squint - squint) < 1e-4', 'Math.abs(e.blink - blink) < 0.008 && Math.abs(e.squint - squint) < 0.008')
# Both inward-folding pant sections used to meet on the same centre plane.
# Cull the hidden coincident triangles; keep the visible hip boundary untouched.
model = model.replace('  if (sd < 0) { const uv = legGeo.attributes.uv;', '''  const lp = legGeo.attributes.position, visible = [];
  for (let i = 0; i < legGeo.index.count; i += 3) {
    const ids = [legGeo.index.getX(i), legGeo.index.getX(i+1), legGeo.index.getX(i+2)];
    if (!ids.every(id => Math.abs(lp.getX(id)) < 0.00001)) visible.push(...ids);
  }
  legGeo.setIndex(visible);
  if (sd < 0) { const uv = legGeo.attributes.uv;''')

model = model.replace('  const P = (x, y, z) => new V3(sd * x, y, z);', '  const armStart=body.children.length;\n  const P = (x, y, z) => new V3(sd * x, y, z);')
model = model.replace('  addMesh(mergeGeometries(fg), skinMat);', "  addMesh(mergeGeometries(fg), skinMat);\n  for(const mesh of body.children.slice(armStart)){mesh.userData.region='arm';mesh.userData.side=sd;}")
model = model.replace('  ring(0.975, 0.0035, 0.0022, contactMat);', "  ring(0.975, 0.0035, 0.0022, contactMat);\n  grp.traverse(mesh=>{mesh.userData.region='shoe';mesh.userData.side=sd;});")

animation = r'''
  const bound = bindBody(body);
  if (options.male) for (const entry of bound) {
    const p=entry.positions;
    for(let i=0;i<p.length;i+=3) {
      const y=p[i+1],width=lerp(.88,1.52,ss(.72,1.20,y));
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
    const posePhase=state.still?1.2:phase;
    const target=expressions[state.expression]||expressions.neutral;
    for(const k in face)face[k]+=(target[k]-face[k])*ease;
    if(t>nextBlink){blinkStart=t;nextBlink=t+3.2+rand()*2;}
    const bt=(t-blinkStart)/.20;
    applyFaceState(state.still?0:bt>=0&&bt<1?Math.sin(Math.PI*bt):0);
    headGroup.rotation.set(0,state.still?0:.018*Math.sin(t*.6),0);
    const seatHeight=state.seatHeight??.54;
    const poseKey=[sit.toFixed(3),walk.toFixed(3),wave.toFixed(3),seatHeight,walk>.002?posePhase.toFixed(3):'',wave>.002?t.toFixed(3):''].join(':');
    if(poseKey!==lastPose){
      lastPose=poseKey;
      const pose=poseMatrices({sit,walk,wave,phase:posePhase,time:t,seatHeight,male:options.male});
      applyPose(bound,pose);headGroup.position.y=HEAD_POS.y-pose.drop;
    }
  }
  update(0,0,{still:true});
  maya.name=options.name||'Maya';
  return {group:maya,update,head:headGroup,body,face,hair:hairMesh};
}
'''
out = "import * as THREE from 'three';\nimport { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';\nimport { bindBody, applyPose, poseMatrices } from './animation.js';\nexport function createMaya(options = {}) {\nconst V3 = THREE.Vector3;\nconst mark = () => {};\n" + helpers + model + animation
Path('maya-character.js').write_text(out, encoding='utf-8')
# Retain the original character studio UI, but share the refined character with
# the cafe so an eye fix cannot diverge between preview and game.
studio = source[:source.index('<script type="module">')]
studio = studio.replace('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js', '/node_modules/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/', '/node_modules/three/examples/jsm/')
studio = studio.replace('<div class="quote">', '<a href="/" style="color:#1f3354">← Back to the café</a><div class="quote">')
Path('maya.html').write_text(studio + '<script type="module" src="/studio.js"></script>\n</body></html>', encoding='utf-8')
print('Built shared Maya character and studio shell')
