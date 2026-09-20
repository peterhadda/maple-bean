import views from './final-views.mjs';
export default [...views,{name:'lounge-before',run:`ambShot('evening',true);cafe.camera.position.set(4.5,1.65,-1.65);cafe.camera.lookAt(6.7,.74,-5.1);cafe.renderer.render(cafe.scene,cafe.camera);return {draws:cafe.renderer.info.render.calls,triangles:cafe.renderer.info.render.triangles};`}];
