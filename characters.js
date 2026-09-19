// Café cast identities; all use Maya's shared detailed character construction.
export const cast = {
  maya: {name:'Maya', character:'maya', male:false, colors:{skin:0xeeb092,hair:0x22140e,top:0xf4e6d9,denim:0x6179a0}},
  mara: {name:'Mara', character:'mara', male:false, colors:{skin:0xd6a07d,hair:0x4c2b1c,top:0x506b50,denim:0x45596b}},
  jules: {name:'Jules', character:'jules', male:true, colors:{skin:0x895d43,hair:0x28221f,top:0xb4845c,denim:0x48525a}},
  claire: {name:'Claire', character:'claire', male:false, colors:{skin:0xeaaf8e,hair:0xbba075,top:0xede2d9,denim:0x536d93}},
  noah: {name:'Noah',character:'noah',male:true,phaseOffset:3.4,
    colors:{skin:0xe3a17a,hair:0x302019,top:0xe8ddc9,denim:0x393630},
    hair:{style:'tousled',shader:'kk'},face:{iris:'brown',paint:'auto',liner:'thin',freckles:0},
    top:{neckline:'crew',sleeves:'knit'},layers:['noah-jacket'],accessories:['backpack']}
};
