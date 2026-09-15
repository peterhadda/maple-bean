"""Apply the shared detailed cast to the preview and source layout."""
from pathlib import Path
import json

p=Path('app.js');s=p.read_text()
s=s.replace("import { createMaya } from './maya-character.js';", "import { createMaya } from './maya-character.js';\nimport { cast } from './characters.js';")
start=s.index('// Lightweight stand-ins')
end=s.index('function cameraMode',start)
s=s[:start]+s[end:]
s=s.replace("const avatar=createGuest('#987253')", 'const avatar=createMaya(cast.maya)')
s=s.replace('maya=createMaya();', 'maya=createMaya(cast.maya);')
start=s.index("  const mara=createGuest")
end=s.index('  session=await api',start)
s=s[:start]+'''  const regulars=[];
  for(const [id,x,z,angle] of [['mara',-4.7,-3.3,0],['jules',3,-.2,-.7],['claire',-3.1,1.0,.35]]){
    $('load-message').textContent=`${cast[id].name} is pulling up a chair…`;
    await new Promise(resolve=>setTimeout(resolve,30));
    const actor=createMaya(cast[id]);actor.group.position.set(x,0,z);actor.group.rotation.y=angle;scene.add(actor.group);regulars.push(actor);
  }
''' + s[end:]
s=s.replace('for(const npc of regulars)npc.update(t);', "for(const npc of regulars)npc.update(t,dt,{expression:'happy'});")
s=s.replace('avatar.update(t,!!d.seatId,old.distanceTo(avatar.group.position)>.003);', "avatar.update(t,dt,{sitting:!!d.seatId,seatHeight:layout.stations.find(s=>s.id===d.seatId)?.seatHeight??.54,walking:old.distanceTo(avatar.group.position)>.003});")
s=s.replace('sitting:!!seated,wave:', 'sitting:!!seated,seatHeight:seated?.seatHeight??.54,wave:')
s=s.replace("station.id==='mara'?'Mara':'Jules'", "cast[station.id]?.name||'Guest'")
s=s.replace("const mara=station.id==='mara';", """if(station.id==='claire'){
      openDialog('<div class="eyebrow">CLAIRE · CREATIVE SOUL & COFFEE ENTHUSIAST</div><h2>A good day starts<br>with a little curiosity.</h2><p>“I brought my sketchbook. Something about this place makes ordinary afternoons feel like the start of a story. Want to keep me company?”</p><div class="dialog-actions"><button id="claire-hello">I’d love to</button><a class="secondary" href="/maya.html?character=claire">Meet Claire in the studio ↗</a></div>');
      $('claire-hello').onclick=()=>{waveUntil=performance.now()/1000+2.3;$('dialog').close();toast('Claire: “Perfect. I’ll save you a spot and a page.”');$('activity').textContent='A new friend in Maple Hollow';};return;
    }
    const mara=station.id==='mara';""")
s=s.replace("if(e.code==='KeyE'&&!e.repeat)interact();", "if(e.code==='KeyE'&&!e.repeat)interact();\n  if(e.code==='KeyF'&&!e.repeat)waveUntil=performance.now()/1000+2.5;")
s=s.replace("$('sip').onclick=", "$('wave').onclick=()=>{waveUntil=performance.now()/1000+2.5;toast('A friendly hello!');};\n$('sip').onclick=")
# Leave the user's current live view intact; these changes take effect on refresh.
p.write_text(s)
p=Path('server.mjs');s=p.read_text();s=s.replace("'/navigation.js'", "'/navigation.js','/animation.js','/characters.js'");p.write_text(s)
p=Path('tools/build_cafe.py');s=p.read_text();s=s.replace("'read',-6.8,-2.7,-6.8,-3.55", "'read',-5.9,-2.7,-5.9,-3.5")
s=s.replace("# An outdoor surround", "station('claire','Meet Claire','talk',-3.1,-1,-2.35,-1,0)\n\n# An outdoor surround")
s=s.replace("(ROOT/'assets/layout.json').write_text", "for s in stations:\n    s['seatHeight'] = .585 if s['id'] in ['sofa','reading'] else .44 if s['id'].startswith('original-') else .54\n(ROOT/'assets/layout.json').write_text")
p.write_text(s)
p=Path('assets/layout.json');layout=json.loads(p.read_text())
for s in layout['stations']:
    if s['id']=='reading':s.update(x=-5.9,approach=[-5.9,3.5])
    s['seatHeight']=.585 if s['id'] in ['sofa','reading'] else .44 if s['id'].startswith('original-') else .54
if not any(s['id']=='claire' for s in layout['stations']):layout['stations'].append(dict(id='claire',label='Meet Claire',kind='talk',x=-3.1,z=1,approach=[-2.35,1],angle=0,seatHeight=.54))
p.write_text(json.dumps(layout,indent=2))
p=Path('index.html');s=p.read_text();s=s.replace('<button id="sip" hidden>', '<button id="wave">Wave hello · F</button><button id="sip" hidden>');p.write_text(s)
print('Updated regulars, Claire, navigation and wave controls')
