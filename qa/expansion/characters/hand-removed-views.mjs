import v from './hip-hand-views.mjs';import cup from './ceramic-cup-views.mjs';export default[v[0],...v.filter(s=>s.name.endsWith('-sit')),cup.find(s=>s.name==='maya-sip-side')];
