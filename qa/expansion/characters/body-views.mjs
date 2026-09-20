import views from './cast-views.mjs';
const steps=[views[0]];
for(const id of ['maya','jules'])for(const [pose,state]of Object.entries({stand:{},wave:{wave:true},cup:{cup:true},sit:{sitting:true},type:{sitting:true,activity:'type'}}))steps.push({name:id+'-'+pose,run:`for(const a of Object.values(qaCast))a.group.visible=false;qaShow('${id}',-2,1,0,${JSON.stringify(state)});qaRender(-1.65,1.05,3.1,-2,.95,1,45);`});
export default steps;