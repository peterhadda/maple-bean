import views from '../characters/cast-views.mjs';
const steps=[views[0]];
for(const id of ['maya','claire','noah','mara','jules'])for(const [pose,state]of Object.entries({rest:{},wave:{wave:true},cup:{cup:true},sip:{cup:true,sipping:true},type:{sitting:true,activity:'type'},reach:{activity:'reach',reach:{x:-.14,y:.92,z:.30}},dart:{activity:'aim'}}))steps.push({name:id+'-'+pose,run:`for(const a of Object.values(qaCast))a.group.visible=false;qaShow('${id}',-2,1,0,${JSON.stringify(state)});qaRender(-1.65,1.28,2.18,-2,1.08,1.15,38);`});
export default steps;
