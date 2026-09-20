import views from '../characters/cast-views.mjs';
export default [views[0],...['maya','jules'].map(id=>({name:id+'-sip-side',run:`for(const a of Object.values(qaCast))a.group.visible=false;qaShow('${id}',-2,1,0,{cup:true,sipping:true});qaRender(-1.32,1.43,1.82,-2,1.36,1.12,30);`}))];
