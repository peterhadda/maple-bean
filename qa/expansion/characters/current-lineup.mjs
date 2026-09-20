import views from './cast-views.mjs'; export default views.filter(v=>['_setup','lineup'].includes(v.name));
