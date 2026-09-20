import views from '../characters/cast-views.mjs';
const steps=[views[0]];
for(const id of ['maya','jules'])for(const [pose,state]of Object.entries({wave:{wave:true},cup:{cup:true},sip:{cup:true,sipping:true},dart:{activity:'aim'}}))steps.push({name:id+'-'+pose,run:`for(const a of Object.values(qaCast))a.group.visible=false;qaShow('${id}',-2,1,0,${JSON.stringify(state)});qaRender(-1.65,${pose === 'wave' ? '1.40,2.30,-2,1.30' : '1.28,2.18,-2,1.08'},1.15,38);`});
export default steps;

