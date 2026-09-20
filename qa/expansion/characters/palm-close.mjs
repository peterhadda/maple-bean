import v from './cast-views.mjs';
export default [v[0],{name:'palm-open-close',run:`for(const a of Object.values(qaCast))a.group.visible=false;qaShow('maya',-2,1,0,{wave:true});qaRender(-2.28,1.48,1.75,-2.29,1.46,1.08,21);`}];
