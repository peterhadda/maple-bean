import views from './views.mjs';
export default [views[0], ...views.filter(v => /cast|faces/.test(v.name))];
