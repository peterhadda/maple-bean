import test from 'node:test';import assert from 'node:assert/strict';
import {Vector3,Matrix4} from 'three';
import {createBodyPoser} from '../assets/characters/body-pose.js';
test('typing fingertips stay above a desk through the tap cycle',()=>{
 const fingers={};for(const side of [-1,1])for(let i=0;i<4;i++){const tag=side<0?'L':'R',x=side*.191,z=.03+(1.5-i)*.0098*1.12,top=.761-.030*1.12,len=[.053,.059,.056,.045][i]*1.12;fingers['finger'+i+tag]=new Vector3(x,top,z);fingers['finger'+i+tag+'Tip']=new Vector3(x-side*.0035,top-len*.54,z+.0006*(1.5-i));}
 const poser=createBodyPoser({rand:()=>.5,fingerRest:fingers});
 for(let t=0;t<2;t+=.03){const p=poser.solve({t,dt:.03,still:true,root:new Matrix4().makeTranslation(0,-.16,0),sit:1,walk:0,phase:0,state:{activity:'type',deskHeight:.78}});for(const side of [-1,1])for(let i=0;i<4;i++){const tag=side<0?'L':'R',len=[.053,.059,.056,.045][i]*1.12,end=new Vector3(side*.191-side*.0095,.761-.030*1.12-len,.03+(1.5-i)*.0098*1.12+.0012*(1.5-i)).applyMatrix4(p.fingers['finger'+i+tag+'Tip']);assert.ok(end.y>=.78,`finger penetrated desk: ${end.y}`);}}
});