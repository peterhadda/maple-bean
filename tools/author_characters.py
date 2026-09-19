"""Author the production cast in Blender from preserved identity/reference meshes.
blender --background --factory-startup --python-exit-code 1 --python tools/author_characters.py
Editable .blend files and skinned GLBs are written to assets/characters/.
"""
import bpy, bmesh, math, json, sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/characters'
OUT.mkdir(exist_ok=True)
sys.path.insert(0,str(ROOT/'tools'))
IDS=['maya','noah','claire','mara','jules']
COLORS={
 'maya':('eeb092','22140e','brown'), 'claire':('eaaf8e','bba075','blue'),
 'mara':('d6a07d','4c2b1c','brown'), 'jules':('895d43','28221f','brown'),
 'noah':('e3a17a','302019','brown')}
def rgb(h): return np.array([int(h[i:i+2],16)/255 for i in (0,2,4)])
def P(v): return Vector((v[0],-v[2],v[1]))
def G(v): return Vector((v[0],v[2],-v[1]))
def clamp(x,a=0,b=1): return max(a,min(b,x))
def smooth(a,b,x):
 t=clamp((x-a)/(b-a));return t*t*(3-2*t)
def image(name,data):
 h,w,_=data.shape;im=bpy.data.images.new(name,width=w,height=h,alpha=True)
 im.pixels.foreach_set(data.astype(np.float32).ravel());im.pack();return im
def material(name,color,rough=.6,metal=0,texture=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
 p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 p.inputs['Specular IOR Level'].default_value=.28
 if texture:
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=texture;m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
 return m
def surface_detail(mat,kind):
 n=512;y,x=np.mgrid[0:n,0:n];u=x/n;v=y/n
 if kind=='hair':nx=.16*np.sin(u*math.tau*12+.12*np.sin(v*math.tau*2));ny=.025*np.cos(v*math.tau*3)
 else:nx=.10*np.sin(u*math.tau*64)*np.cos(v*math.tau*64);ny=.10*np.cos(u*math.tau*64)*np.sin(v*math.tau*64)
 nz=np.sqrt(np.maximum(.01,1-nx*nx-ny*ny));data=np.ones((n,n,4));data[:,:,0]=nx*.5+.5;data[:,:,1]=ny*.5+.5;data[:,:,2]=nz*.5+.5
 im=image(kind+' sculpted surface',data);im.colorspace_settings.name='Non-Color';tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.32 if kind=='hair' else .24
 mat.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);p=mat.node_tree.nodes.get('Principled BSDF');mat.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
 if kind=='cloth':p.inputs['Sheen Weight'].default_value=.18;p.inputs['Sheen Roughness'].default_value=.8

def mesh(name,verts,faces,mat,uv=None):
 data=bpy.data.meshes.new(name);data.from_pydata([P(v) for v in verts],[],faces);data.update()
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(mat)
 for p in data.polygons:p.use_smooth=True
 layer=data.uv_layers.new(name='UVMap')
 for loop in data.loops:layer.data[loop.index].uv=uv[loop.vertex_index] if uv else (.015,.015)
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(data);bm.free()
 return o
def ellipsoid(name,center,scale,mat,segments=24,rings=16):
 vs=[];uv=[];fs=[]
 for i in range(rings+1):
  a=math.pi*i/rings
  for j in range(segments+1):
   b=j/segments*math.tau;vs.append((center[0]+scale[0]*math.sin(a)*math.sin(b),center[1]+scale[1]*math.cos(a),center[2]+scale[2]*math.sin(a)*math.cos(b)));uv.append((.015,.015))
 for i in range(rings):
  for j in range(segments):
   n=i*(segments+1)+j;fs.append((n,n+1,n+segments+2,n+segments+1))
 return mesh(name,vs,fs,mat,uv)
def path_point(points,t):
 s=t*(len(points)-1);i=min(len(points)-2,int(s));u=s-i
 a,b,c,d=[Vector(points[max(0,min(len(points)-1,k))]) for k in (i-1,i,i+1,i+2)]
 return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u)
def lock(name,points,width,depth,mat,steps=22,sides=10,taper=True):
 # A filled sculpted wedge with a broad upper ridge; not a round strand tube.
 vs=[];fs=[];uv=[]
 for i in range(steps+1):
  t=i/steps;c=path_point(points,t);tangent=(path_point(points,min(1,t+.005))-path_point(points,max(0,t-.005))).normalized()
  radial=Vector((c.x,c.y-1.49,c.z)).normalized();across=tangent.cross(radial).normalized()
  if across.length<.1:across=Vector((1,0,0))
  normal=across.cross(tangent).normalized()
  w=width*(.7+.3*math.sin(t*math.pi))*(max(.025,(1-t)**.48) if taper else 1)
  for j in range(sides):
   a=j/sides*math.tau;thick=depth*(.55+.45*math.sin(t*math.pi))*(max(.04,(1-t)**.4) if taper else 1)
   v=c+across*(math.cos(a)*w)+normal*(math.sin(a)*thick);vs.append(tuple(v));uv.append((j/sides,t))
 for i in range(steps):
  for j in range(sides):
   a=i*sides+j;b=i*sides+(j+1)%sides;fs.append((a,b,b+sides,a+sides))
 fs.extend([tuple(reversed(range(sides))),tuple(steps*sides+j for j in range(sides))])
 return mesh(name,vs,fs,mat,uv)

def face_texture(id):
 n=1024;y,x=np.mgrid[0:n,0:n];x=x/(n-1)*.30-.15;y=y/(n-1)*.34+1.31
 color=rgb(COLORS[id][0]);data=np.ones((n,n,4));data[:,:,:3]=color
 def tint(mask,c,amount):data[:,:,:3][:]=data[:,:,:3]*(1-mask[:,:,None]*amount)+np.array(c)*mask[:,:,None]*amount
 deep=id=='jules';blush=rgb('a35b4b' if deep else 'e99789')
 for side in (-1,1):
  tint(np.exp(-((x-side*.07)/.035)**2-((y-1.429)/.023)**2),blush,.19 if deep else .25)
 tint(np.exp(-(x/.014)**2-((y-1.422)/.014)**2),blush,.2)
 lip=rgb('915d51' if deep else 'ba7565' if id=='noah' else 'ca726b')
 seam=1.388+3.5*x*x+.0008*np.clip(x/.034,-1,1)
 shape=np.maximum(0,1-(x/.034)**2)
 upper=seam+.0055*shape**.8-.001*np.exp(-(x/.006)**2);lower=seam-.0072*shape**.6
 def band(lo,hi):return np.clip((y-lo)/.0012+.5,0,1)*np.clip((hi-y)/.0012+.5,0,1)*np.clip((.034-np.abs(x))/.0015,0,1)
 tint(band(seam,upper),lip*.87,.9);tint(band(lower,seam),lip,.86)
 tint(np.exp(-((x-.006)/.013)**4-((y-(seam-.0048))/.0014)**2),rgb('efb6a2' if not deep else 'ac7b64'),.36)
 tint(np.exp(-(x/.033)**8-((y-seam)/.0007)**2),rgb('563c35' if deep else '934a46'),.8)
 for side in (-1,1):tint(np.exp(-((x-side*.008)/.0028)**2-((y-1.410)/.0018)**2),rgb('503c33'),.28)
 # Gentle baked eyelid colour, without photographic pores or dark rings.
 for side in (-1,1):tint(np.exp(-((x-side*.053)/.038)**4-((y-1.495)/.013)**2),color*.8,.18)
 return image(id+' skin paint',data)

def hair_texture(id):
 n=1024;y,x=np.mgrid[0:n,0:n];u=x/(n-1);v=y/(n-1);c=rgb('382218' if id=='maya' else COLORS[id][1]);light=.88+.34*(.5+.5*np.cos(u*math.tau))**6+.035*np.sin(v*19+u*4);data=np.ones((n,n,4));data[:,:,:3]=np.clip(c[None,None,:]*light[:,:,None],0,1)
 data[-16:,-16:,:3]=rgb('30241c');data[-16:,-32:-16,:3]=rgb('826344' if id=='claire' else '462b20' if id=='maya' else COLORS[id][1]);return image(id+' hair paint',data)

def eye_texture(id):
 n=512;y,x=np.mgrid[0:n,0:n];x=(x/(n-1)-.5)*2;y=(y/(n-1)-.5)*2;r=np.sqrt(x*x+y*y);a=np.arctan2(y,x)
 data=np.ones((n,n,4));data[:,:,:3]=[.93,.935,.91]
 iris=r<.58;pupil=r<.245;edge=np.clip((r-.50)/.08,0,1)
 inner=rgb('648eb6' if id=='claire' else '965e38' if id!='jules' else '825836');outer=rgb('263c58' if id=='claire' else '36241a')
 variation=.94+.05*np.sin(a*43+r*17)+.025*np.sin(a*89-r*9)
 t=np.clip((r-.245)/.335,0,1);c=inner[None,None,:]*(1-t[:,:,None])+outer[None,None,:]*t[:,:,None]
 c*=variation[:,:,None];c*=1-edge[:,:,None]*.22
 data[:,:,:3][iris]=c[iris];data[:,:,:3][pupil]=rgb('100e0c');data[-8:,-8:,:3]=rgb('654038' if id!='jules' else '452e2a')
 return image(id+' iris atlas',data)

HC=1.475
def head_point(x,y,id):
 yn=(y-HC)/.170;w=(.126 if id in ('noah','jules') else .122)*(1-.24*smooth(0,1,-yn))
 z=.108*math.sqrt(max(0,1-(x/w)**2-yn*yn))
 front=smooth(.02,.08,z)
 z+=front*(.004*math.exp(-((abs(x)-.064)/.038)**2-((y-1.435)/.03)**2))
 z+=front*(.019*math.exp(-(x/.018)**2-((y-1.423)/.017)**2)+.006*math.exp(-(x/.010)**2-((y-1.449)/.027)**2))
 z+=front*.012*math.exp(-(x/.054)**2-((y-1.369)/.045)**2)
 z+=front*.0035*math.exp(-(x/.033)**6-((y-1.387)/.008)**2)
 z+=front*.0020*math.exp(-((abs(x)-.010)/.017)**2-((y-1.394)/.0045)**2)
 for cx in (-.056,.056):
  distance=(x-cx)**2+(y-1.476)**2
  if distance<.041**2:
   envelope=.065+math.sqrt(.041**2-distance)+.002;blend=max(.006-abs(z-envelope),0);z=max(z,envelope)+blend*blend/.024
 return z

def author_head(id,mats):
 rx=.126 if id in ('noah','jules') else .122;ry=.170;segments=112;rings=80
 vs=[];fs=[];uv=[]
 heights=[HC+ry*math.cos(math.pi*i/rings) for i in range(rings+1)]
 heights=sorted([y for y in heights if not 1.373<y<1.404]+[1.375,1.380,1.384,1.3879,1.3901,1.394,1.398,1.402],reverse=True);rings=len(heights)-1
 for i,base_y in enumerate(heights):
  y=base_y;yn=(y-HC)/ry;a=math.acos(clamp(yn,-1,1))
  for j in range(segments):
   b=j/segments*math.tau;x=rx*math.sin(a)*math.sin(b)*(1-.24*smooth(0,1,-yn));z=.106*math.sin(a)*math.cos(b)
   y=base_y
   if z>0:
    y+=(3.5*x*x+.0008*clamp(x/.034,-1,1))*math.exp(-((base_y-1.389)/.016)**4-(x/.042)**8)
    z=head_point(x,y,id)
   vs.append([x,y,z]);uv.append(((x+.15)/.30,(y-1.31)/.34) if z>0 else (.015,.015))
 holes=[(-.056,1.476,.033,.019,.0155,'eyeL'),(.056,1.476,.033,.019,.0155,'eyeR'),(0,1.389,.034,.0013,.0013,'mouth')]
 def inside(v,h):
  x,y,z=v;cx,cy,w,hu,hl,tag=h;dy=y-cy-(3.5*x*x+.0008*clamp(x/.034,-1,1) if tag=='mouth' else 0)
  return z>.065 and ((x-cx)/w)**2+(dy/(hu if dy>0 else hl))**2<1
 for i in range(rings):
  for j in range(segments):
   n=i*segments+j;next=i*segments+(j+1)%segments;face=(n,next,next+segments,n+segments)
   center=np.mean([vs[k] for k in face],axis=0)
   if not any(inside(center,h) for h in holes):fs.append(face)
 # Fit the actual connected boundary vertices to the eye/mouth contours.
 edges={}
 for f in fs:
  for a,b in zip(f,f[1:]+f[:1]):edges[tuple(sorted((a,b)))]=edges.get(tuple(sorted((a,b))),0)+1
 boundary={i for edge,c in edges.items() if c==1 for i in edge}
 for index in boundary:
  x,y,z=vs[index]
  if z<.06 or abs(x)<.001 and y>1.52:continue
  h=min(holes,key=lambda h:((x-h[0])/h[2])**2+((y-h[1])/.025)**2)
  cx,cy,w,hu,hl,tag=h
  if abs(x-cx)>w*1.4 or abs(y-cy)>.04:continue
  if tag=='mouth':
   # Keep the connected row ordering: angular projection pinched corner quads.
   x=clamp(x,-w,w);seam=cy+3.5*x*x+.0008*clamp(x/.034,-1,1)
   y=seam+(.0002 if y>seam else -.0002)*math.sqrt(max(.02,1-(x/w)**2))
  else:
   a=math.atan2((y-cy)/(hu if y>cy else hl),(x-cx)/w)
   x=cx+w*math.cos(a);y=cy+(hu if math.sin(a)>0 else hl)*math.sin(a)+.002*(x-cx)/w
  z=head_point(x,y,id)
  if tag!='mouth':z=max(z,.065+math.sqrt(max(0,.038**2-(x-cx)**2-(y-cy)**2))+.0008)
  vs[index]=[x,y,z];uv[index]=((x+.15)/.30,(y-1.31)/.34)
 head=mesh('Face',vs,fs,mats['skin'],uv);head['bone']='head';head['face']=True
 pieces=[head]
 for side in (-1,1):
  ear=ellipsoid('Ear', (side*.123,1.461,-.005),(.019,.031,.013),mats['skin'],24,18);ear['bone']='head';pieces.append(ear)
  for v in ear.data.vertices:
   p=G(v.co);u=(p.y-1.461)/.031;w=(p.z+.005)/.013
   if side*(p.x-side*.123)>0:p.x+=side*(-.008*math.exp(-2*(u*u+w*w))+.0015*math.exp(-((math.hypot(u,w)-.84)/.15)**2))
   v.co=P(p)
  for upper in (True,False):
   pts=[]
   for i in range(25):
    t=i/24;s=-1+2*t;x=side*.056+.033*s;y=1.476+(.019 if upper else -.0155)*math.sqrt(max(0,1-s*s))+.002*s
    z=max(head_point(x,y,id),.065+math.sqrt(max(0,.038**2-(x-side*.056)**2-(y-1.476)**2)))+.0012;pts.append((x,y,z))
   if upper:
    lash=lock('Upper lash',pts,.00095 if id in ('noah','jules') else .0015,.00075,mats['hair'],steps=26,sides=6,taper=False);lash['bone']='head';lash['face']=True;pieces.append(lash)
  if id not in ('noah','jules'):
   for j in range(3):
    x=side*(.070+j*.004);y=1.487-j*.002;z=head_point(x,y,id)+.010
    lash=lock('Lash tip',[(x,y,z),(x+side*.004,y+.004,z+.002),(x+side*.006,y+.004,z+.003)],.0011,.0006,mats['hair'],8,6);lash['bone']='head';lash['face']=True;pieces.append(lash)
  pts=[]
  for i in range(8):
   t=i/7;x=side*(.023+.070*t);y=1.516+.008*math.sin(t*math.pi)-.007*t;pts.append((x,y,head_point(x,y,id)+.002))
  brow=lock('Brow',pts,.0050 if id in ('noah','jules') else .0045,.0012,mats['hair'],24,8);brow['bone']='head';brow['face']=True;pieces.append(brow)
  eye=ellipsoid('Eye.L' if side<0 else 'Eye.R',(side*.056,1.476,.065),(.038,.038,.038),mats['eye'],40,28);eye['bone']='eye.L' if side<0 else 'eye.R'
  layer=eye.data.uv_layers.active
  for loop in eye.data.loops:
   v=G(eye.data.vertices[loop.vertex_index].co);layer.data[loop.index].uv=((v.x-side*.056)/.072+.5,(v.y-1.476)/.072+.5)
  # Stylized window glints sit above the iris; the glossy eye still receives room light.
  for dx,dy,r in [(-.007,.008,.0040),(.007,-.006,.0016)]:
   c=ellipsoid('Eye glint',(side*.056+dx,1.476+dy,.065+math.sqrt(.038**2-dx*dx-dy*dy)+.0008),(r,r,.0006),mats['eye'],12,8);c['bone']='head'
 # Mouth interior is revealed by expression morphs, not painted as a dark smile.
 mouth_vs=[];mouth_fs=[]
 for j in range(9):
  for i in range(25):
   x=-.043+i/24*.086;y=1.373+j/8*.032;mouth_vs.append((x,y,head_point(x,y,id)-.005))
 for j in range(8):
  for i in range(24):
   n=j*25+i;mouth_fs.append((n,n+1,n+26,n+25))
 mouth=mesh('Mouth interior',mouth_vs,mouth_fs,mats['eye']);mouth['bone']='head'
 for loop in mouth.data.uv_layers.active.data:loop.uv=(.995,.995)
 for o in pieces:
  if o.data.materials[0]==mats['hair']:
   for loop in o.data.uv_layers.active.data:loop.uv=(.978,.995) if o.name.startswith('Brow') else (.995,.995)
  add_expressions(o,id)
 # A shorter lower face restores young-adult stylization without a pointed chin.
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH' or o.get('body'):continue
  arrays=[key.data for key in o.data.shape_keys.key_blocks] if o.data.shape_keys else [o.data.vertices]
  for vertices in arrays:
   for v in vertices:
    p=G(v.co)
    if p.y<1.455:p.y=1.455+(p.y-1.455)*({'maya':.72,'claire':.76,'mara':.75,'noah':.77,'jules':.80}[id])
    p.y-=.017*math.exp(-((p.y-1.434)/.075)**4)
    v.co=P(p)
  if o.data.shape_keys:
   for v,base in zip(o.data.vertices,o.data.shape_keys.key_blocks[0].data):v.co=base.co.copy()
 return head

def add_expressions(o,id):
 o.shape_key_add(name='Basis');base=[G(v.co) for v in o.data.vertices]
 for name in ['smile','happy','curious','surprised','focused','laughing','listening','wink','blink.L','blink.R']:
  key=o.shape_key_add(name=name)
  for i,p0 in enumerate(base):
   x,y,z=p0;p=Vector(p0)
   if z>.02:
    mouth=math.exp(-((y-1.389)/.019)**2-(x/.047)**4);cheek=math.exp(-((abs(x)-.060)/.028)**2-((y-1.435)/.025)**2)
    if name in ('smile','happy','laughing','listening'):
     k={'smile':.55,'happy':1,'laughing':1,'listening':.2}[name];p.y+=k*(.0055*mouth*(abs(x)/.03)**1.3+.002*cheek);p.z+=k*.001*cheek
     if name=='laughing' and abs(y-1.389)<.02:p.y+=(1 if y>=1.389 else -1)*.007*mouth
    if name=='surprised':
     p.y+=.007*math.exp(-((y-1.516)/.019)**2);p.y+=(1 if y>=1.389 else -1)*.008*mouth;p.x*=1-.18*mouth
    if name=='curious':p.y+=.005*math.exp(-((x+.055)/.04)**2-((y-1.515)/.017)**2)
    if name=='focused':p.y-=.004*math.exp(-((y-1.515)/.016)**2)
    for side,tag in [(-1,'L'),(1,'R')]:
     if name not in ('blink.'+tag,'wink' if side==1 else ''):continue
     dx=x-side*.056;dy=y-1.476
     if abs(dx)<.039 and abs(dy)<.044:
      influence=(1-smooth(.027,.044,abs(dy)))*(1-smooth(.031,.04,abs(dx)))
      target=1.476+.002*dx/.031-.001
      p.y+=((target-y)*influence)
      p.z=max(p.z,.065+math.sqrt(max(0,.038**2-dx*dx-(p.y-1.476)**2))+.001)
   key.data[i].co=P(p)

def author_hair(id,mat):
 parts=[];vs=[];fs=[];uv=[];bun=id in ('maya','mara')
 def scalp(psi,el,extra=0):return ((.133+extra)*math.cos(el)*math.sin(psi),1.485+(.166+extra)*math.sin(el),(.119+extra)*math.cos(el)*math.cos(psi))
 if id=='claire':
  from claire_hair import author_claire_hair
  return author_claire_hair({'mesh':mesh,'scalp':scalp,'mat':mat})
 if id=='noah':
  from noah_hair import author_noah_hair
  return author_noah_hair({'mesh':mesh,'lock':lock,'scalp':scalp,'mat':mat})
 def border(psi):
  if bun:return -.24-.29*max(0,-math.cos(psi))**1.5+1.04*max(0,math.cos(psi))**1.2+.24*math.exp(-((abs(math.atan2(math.sin(psi),math.cos(psi)))-1.63)/.35)**2)
  return (-.20-.25*max(0,-math.cos(psi))**1.5+.65*max(0,math.cos(psi))**.55) if id in ('noah','jules') else (-.30-.48*max(0,-math.cos(psi))**1.5+.75*max(0,math.cos(psi))**.55)
 for i in range(25):
  t=i/24
  for j in range(72):
   psi=j/72*math.tau;el=border(psi)+(math.pi/2-border(psi))*t;vs.append(scalp(psi,el));uv.append((j/72,t))
 for i in range(24):
  for j in range(72):n=i*72+j;next=i*72+(j+1)%72;fs.append((n,next,next+72,n+72))
 parts.append(mesh('Hair primary mass',vs,fs,mat,uv))
 # Broad, overlapping locks follow the scalp surface, keeping their roots connected.
 for side in (-1,1):
  for k in range(8):
   q=k/7;psi=side*(.16+1.48*q);points=[]
   for j in range(7):
    t=j/6;el=1.38-(1.38-border(psi)+.035)*t;angle=psi*(.28+.72*t)-.17*(1-t)
    if bun or id=='claire':angle=psi*(.2+.8*t)+.55*(1-t);el+=.045*math.sin(psi)
    if bun and side<0:el-=.10*math.sin(t*math.pi*.8)
    points.append(scalp(angle,el,.005+.007*math.sin(t*math.pi)))
   if (not bun or q>.65) and (id!='claire' or q>.65):parts.append(lock('Swept sculpted layer',list(reversed(points)) if bun else points,.023+.008*q,.007,mat,28,12))
 if id=='claire':
  for side in (-1,1):
   for k in range(6):
    q=k/5;pts=[]
    for t in np.linspace(0,1,9):
     psi=.32+side*(1.16+.22*q)*t;el=1.18+.055*q-(.87+.04*q)*t;extra=-.004+.016*math.sin(t*math.pi*.75)
     pts.append(scalp(psi,el,extra))
    parts.append(lock('Claire continuous side sweep',pts,.025,.008,mat,32,12))
 # Rear locks preserve a readable nape and crown from every angle.
 for k in range(12):
  psi=1.62+k/11*(math.tau-3.24);pts=[scalp(psi+.08*math.sin(t*math.pi),1.22-(1.22-border(psi))*t,.004+.004*math.sin(t*math.pi)) for t in np.linspace(0,1,7)]
  parts.append(lock('Nape layered mass',list(reversed(pts)) if bun else pts,.028,.007,mat,24,10))
 if id in ('noah','jules'):
  # Tousled crown pieces have broad bases and deliberate pointed ends.
  for k in range(7 if id=='noah' else 5):
   q=k/6;psi=-.80+1.58*q;pts=[]
   for t in np.linspace(0,1,7):
    el=1.37-(.88+.15*math.sin(k))*t;extra=-.012+.023*smooth(0,.3,t)+(.013 if id=='noah' else .005)*math.sin(t*math.pi)
    pts.append(scalp(psi+.38*(1-t),el,extra))
   parts.append(lock('Tousled hero lock',pts,.032,.012,mat,28,12))
  if id=='noah':
   for k in range(5):
    pts=[]
    for t in np.linspace(0,1,9):
     psi=-.67+k*.30+.46*(1-t)+.15*math.sin(t*math.pi*2+k*.3);el=1.16+.075*math.sin(k*1.7)-(.88+.075*math.sin(k*.9))*t
     pts.append(scalp(psi,el,-.014+.026*smooth(0,.3,t)+.010*math.sin(t*math.pi)))
    parts.append(lock('Noah loose front curl',pts,.026,.009,mat,32,12))
 if bun:
  # Curtain masses preserve the original part, with roots buried in the crown.
  for side in (-1,1):
   for k in range(7):
    q=k/6;pts=[]
    for t in np.linspace(0,1,11):
     psi=.09+(side*(.85+.65*q)-.09)*t**1.15;el=.84+.38*q-(.69+.31*q)*t**1.5
     pts.append(scalp(psi,el,-.003+.014*math.sin(t*math.pi*.9)))
    parts.append(lock('Parted curtain mass',pts,.023-.004*q,.0075,mat,32,12))
  center=Vector((.010 if id=='mara' else 0,1.695,-.056));core=ellipsoid('Sculpted bun core',center,(.089,.068,.075),mat,40,28);parts.append(core)
  for v in core.data.vertices:
   d=G(v.co)-center;lump=1+.07*math.sin(d.x*63+1.3)*math.sin(d.y*73+.4)*math.sin(d.z*58+2.1);v.co=P(center+d*lump)
  for k in range(9):
   pts=[];angle=k/9*math.tau
   for t in np.linspace(0,1,13):
    a=angle+1.90*t;h=-.052+.115*t+.004*math.sin(angle*2);r=math.sqrt(max(.04,1-(h/.072)**2))
    pts.append(tuple(center+Vector((.092*r*math.cos(a),h,.079*r*math.sin(a)))))
   parts.append(lock('Wrapped bun fold',pts,.021+.004*math.sin(k*2),.010,mat,34,12))
  for side in (-1,1):
   for k in range(2):
    pts=[scalp(side*(1.01+.15*k),.20-.08*k,.003),(side*(.112+k*.009),1.455,.063-k*.016),(side*(.105-k*.003),1.407,.060-k*.012),(side*.096,1.355-k*.008,.048),(side*.103,1.315-k*.012,.041),(side*.118,1.306-k*.014,.034)]
    parts.append(lock('Loose curling tendril',pts,.0065-k*.0012,.0027,mat,42,10))
 if id=='claire':
  for k in range(15):
   a=.90+(math.tau-1.8)*k/14;pts=[]
   for j in range(9):
    t=j/8;flow=smooth(0,.28,t);spread=.090+.050*flow;wave=.023*math.sin(t*11+k*.40)*flow;pts.append((math.sin(a)*spread+wave,1.604-.574*t,math.cos(a)*(.080+.044*flow)-.020*flow+.020*math.sin(t*11+k*.40)*flow))
   parts.append(lock('Long sculpted wave',pts,.029,.012,mat,36,12))
  for side in (-1,1):
   for k in range(3):
    if side<0:pts=[(.035+k*.008,1.625,.040),(-.025,1.613,.092),(-.083,1.563,.104),(-.125,1.475,.070),(-.144,1.390,.072),(-.117,1.287,.099),(-.145,1.170,.084),(-.123,1.060-k*.015,.096)]
    else:pts=[(.037+k*.006,1.625,.040),(.092,1.578,.084),(.128,1.490,.074),(.146,1.390,.065),(.118,1.280,.102),(.143,1.162,.081),(.122,1.063-k*.015,.094)]
    pts=[(x+side*k*.003,y+k*.001,(.119*math.sqrt(max(0,1-(x/.133)**2-((y-1.485)/.166)**2))+.005+k*.002) if y>1.50 else z+k*.003) for x,y,z in pts]
    parts.append(lock('Long swept face frame',pts,.020-k*.001,.008,mat,44,12))
 for o in parts:o['bone']='head'
 return parts

def load_body(id,mats):
 bpy.ops.import_scene.gltf(filepath=str(OUT/'source'/f'{id}-before.glb'))
 hair=next(o for o in bpy.context.scene.objects if o.type=='MESH' and 'hair' in o.name.lower());old_head=hair.parent
 for o in reversed([old_head,*old_head.children_recursive] if old_head else [hair]):
  if o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
 imported=[o for o in bpy.context.scene.objects if o.type=='MESH'];old_mats=list(dict.fromkeys(m for o in imported for m in o.data.materials));atlas=np.ones((2048,2048,4),dtype=np.float32)
 def base_image(m):
  p=m.node_tree.nodes.get('Principled BSDF');images=[link.from_node.image for link in p.inputs['Base Color'].links if link.from_node.type=='TEX_IMAGE'];return images[0] if images else None
 large=next((i for i,m in enumerate(old_mats) if base_image(m) and base_image(m).size[0]>=2048),None)
 cells=[(x*256,y*256,256,256) for y in range(8) for x in range(8) if large is None or y>=2 or x>=4];rects={};cursor=0
 for index,m in enumerate(old_mats):
  if index==large:rects[index]=(0,0,1024,512)
  else:
   if cursor>=len(cells):raise RuntimeError('Wardrobe atlas full')
   rects[index]=cells[cursor];cursor+=1
  tx,ty,tw,th=rects[index];p=m.node_tree.nodes.get('Principled BSDF');base=np.array(p.inputs['Base Color'].default_value[:]);base[:3]=np.where(base[:3]<=.0031308,base[:3]*12.92,1.055*base[:3]**(1/2.4)-.055)
  block=np.ones((th,tw,4),dtype=np.float32);block[:]=base;im=base_image(m)
  if im:
   w,h=im.size;pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels);pixels=pixels.reshape(h,w,4);block=pixels[(np.arange(th)*h//th)[:,None],(np.arange(tw)*w//tw)[None,:]].copy();block[:,:,:3]*=base[:3]
  atlas[ty:ty+th,tx:tx+tw]=block
 atlas_image=image(id+' wardrobe atlas',atlas);cloth=material('Wardrobe',(1,1,1),.85,texture=atlas_image);metal=material('Accessories',(1,1,1),.32,.65,atlas_image);surface_detail(cloth,'cloth')
 c=rgb(COLORS[id][0]);skin_linear=np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
 for o in imported:
  o.data.transform(o.matrix_world.copy());o.parent=None;o.matrix_world=Matrix.Identity(4)
  if all(.62<G(v.co).y<.81 and abs(G(v.co).x)>.12 for v in o.data.vertices):bpy.data.objects.remove(o,do_unlink=True);continue
  layer=o.data.uv_layers.active or o.data.uv_layers.new(name='UVMap');skin=False;metallic=False
  for poly in o.data.polygons:
   old=o.data.materials[poly.material_index];index=old_mats.index(old);p=old.node_tree.nodes.get('Principled BSDF');color=np.array(old.diffuse_color[:3]);is_skin=np.max(abs(color-skin_linear))<.035 and not p.inputs['Base Color'].is_linked
   skin=skin or is_skin;metallic=metallic or p.inputs['Metallic'].default_value>.4
   for li in poly.loop_indices:
    u,v=layer.data[li].uv;tx,ty,tw,th=rects[index];layer.data[li].uv=(.015,.015) if is_skin else ((tx+(clamp(u)*.996+.002)*tw)/2048,(ty+(clamp(v)*.996+.002)*th)/2048)
   poly.material_index=0;poly.use_smooth=True
  o['source_color']=list(color);o['atlas_uv']=list(layer.data[0].uv)
  o.data.materials.clear();o.data.materials.append(mats['skin'] if skin else metal if metallic else cloth)
  if id in ('noah','jules'):
   for v in o.data.vertices:
    p=G(v.co);p.x*=1-.12*smooth(.88,1.20,p.y);v.co=P(p)
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
  if len(o.data.polygons)>100:
   bpy.context.view_layer.objects.active=o;dec=o.modifiers.new('Game retopology','DECIMATE');dec.ratio=.32;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
  o['body']=True
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)

def author_hands(id,mats,bones):
 wide=1.34 if id in ('noah','jules') else 1
 for side,tag in [(-1,'L'),(1,'R')]:
  x=side*(.180 if id in ('noah','jules') else .191);palm=ellipsoid('Palm.'+tag,(x,.764,.032),(.020,.036,.015),mats['skin'],20,16);palm['bone']='hand.'+tag
  for finger,length in enumerate([.055,.062,.059,.047]):
   fx=x+side*(finger-1.5)*.010;start=(fx,.742,.033);mid=(fx+side*.001,.742-length*.54,.039);end=(fx+side*.002,.742-length,.043);name=f'finger{finger}.{tag}';bones[name]=(start,mid,'hand.'+tag);bones[name+'Tip']=(mid,end,name)
   f=lock('Finger',[start,mid,end],.0052,.005,mats['skin'],14,8,taper=False);f['finger']=name
  start=(x-side*.016,.772,.035);mid=(x-side*.030,.751,.046);end=(x-side*.026,.731,.050);name='thumb.'+tag;bones[name]=(start,mid,'hand.'+tag);bones[name+'Tip']=(mid,end,name)
  f=lock('Thumb',[start,mid,end],.007,.006,mats['skin'],14,8,taper=False);f['finger']=name

def rig_definition(id):
 wide=1.34 if id in ('noah','jules') else 1
 b={'root':((0,0,0),(0,.10,0),None),'hips':((0,.8,0),(0,.95,0),'root'),'spine':((0,.95,0),(0,1.14,0),'hips'),'chest':((0,1.14,0),(0,1.28,0),'spine'),'neck':((0,1.28,0),(0,1.39,0),'chest'),'head':((0,1.39,0),(0,1.64,0),'neck'),'jaw':((0,1.405,.04),(0,1.36,.08),'head')}
 for side,tag in [(-1,'L'),(1,'R')]:
  b['thigh.'+tag]=((side*.085,.8,0),(side*.085,.42,0),'hips');b['shin.'+tag]=((side*.085,.42,0),(side*.085,.04,0),'thigh.'+tag);b['foot.'+tag]=((side*.085,.04,0),(side*.085,.04,.17),'shin.'+tag)
  b['upper.'+tag]=((side*.128*wide,1.222,-.02),(side*(.201 if id in ('noah','jules') else .16),1.035,0),'chest');b['lower.'+tag]=((side*(.201 if id in ('noah','jules') else .16),1.035,0),(side*(.180 if id in ('noah','jules') else .191),.785,.03),'upper.'+tag);b['hand.'+tag]=((side*(.180 if id in ('noah','jules') else .191),.785,.03),(side*(.180 if id in ('noah','jules') else .191),.74,.035),'lower.'+tag);b['eye.'+tag]=((side*.052,1.476,.065),(side*.052,1.476,.12),'head')
 return b

def bind_rig(id,bones):
 data=bpy.data.armatures.new(id+' shared rig');rig=bpy.data.objects.new('Rig',data);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for name,(head,tail,parent)in bones.items():
  b=data.edit_bones.new(name);b.head=P(head);b.tail=P(tail)
  if parent:b.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  groups={name:o.vertex_groups.new(name=name) for name in bones}
  for v in o.data.vertices:
   p=G(v.co);x,y,z=p;tag='L' if x<0 else 'R'
   if o.get('bone'):weights={o['bone']:1}
   elif o.get('finger'):
    name=o['finger'];start,mid,_=bones[name];tip=1-smooth(mid[1]-.008,mid[1]+.008,y);weights={name:1-tip,name+'Tip':tip}
   elif o.get('region')=='arm':
    arm=1-smooth(.985,1.085,y);root=smooth(1.18,1.27,y)*(1-smooth(.12,.18,abs(x)));weights={'lower.'+tag:arm*(1-root),'upper.'+tag:(1-arm)*(1-root),'chest':root}
   elif o.get('region')=='shoe':weights={'foot.'+tag:1}
   elif y<.88:
    if y>.69:pelvis=smooth(.74,.88,y);weights={'thigh.'+tag:1-pelvis,'hips':pelvis}
    elif y<.14:shin=smooth(.06,.14,y);weights={'foot.'+tag:1-shin,'shin.'+tag:shin}
    else:thigh=smooth(.36,.48,y);weights={'shin.'+tag:1-thigh,'thigh.'+tag:thigh}
   elif y>1.29:weights={'neck':1}
   else:chest=smooth(.94,1.2,y);weights={'spine':1-chest,'chest':chest}
   for name,w in weights.items():
    if w>.00001:groups[name].add([v.index],w,'REPLACE')
  o.parent=rig;mod=o.modifiers.new('Shared character skeleton','ARMATURE');mod.object=rig
 return rig

def merge_materials():
 batches={}
 for o in bpy.context.scene.objects:
  if o.type=='MESH':batches.setdefault((o.data.materials[0],bool(o.data.shape_keys)),[]).append(o)
 for (mat,morph),objects in batches.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=('Expression ' if morph else '')+mat.name+' geometry'

def build(id):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 skin=material('Skin',(1,1,1),.67,texture=face_texture(id));hair=material('Hair',(1,1,1),.43,texture=hair_texture(id));eye=material('Eyes',(1,1,1),.16,texture=eye_texture(id));eye.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.45
 surface_detail(hair,'hair')
 skin_shader=skin.node_tree.nodes.get('Principled BSDF');skin_shader.inputs['Sheen Weight'].default_value=.08;skin_shader.inputs['Sheen Color'].default_value=(.85,.45,.30,1);skin_shader.inputs['Sheen Roughness'].default_value=.7
 mats={'skin':skin,'hair':hair,'eye':eye};load_body(id,mats)
 if id=='noah':
  sys.path.insert(0,str(ROOT/'tools'));from noah_garments import refine_noah_clothes
  garments=refine_noah_clothes({'mesh':mesh,'lock':lock,'ellipsoid':ellipsoid,'P':P,'G':G,'mats':mats})
  for o in garments:
   for v in o.data.vertices:
    p=G(v.co);p.y-=.030*smooth(.94,1.20,p.y);v.co=P(p)
 author_head(id,mats);author_hair(id,hair)
 for o in bpy.context.scene.objects:
  if o.type=='MESH' and not o.get('body'):
   width={'maya':1,'claire':.985,'mara':1.018,'noah':1.012,'jules':1.025}[id]
   o.data.transform(Matrix.Translation((0,0,-.020))@Matrix.Diagonal((width,1,1,1)),shape_keys=True)
   scale=1.07 if id in ('noah','jules') else 1.14
   o.data.transform(Matrix.Translation((0,-.030,1.465))@Matrix.Diagonal((scale,scale,scale,1))@Matrix.Translation((0,0,-1.465)),shape_keys=True)
 bones=rig_definition(id);author_hands(id,mats,bones);rig=bind_rig(id,bones);merge_materials()
 for o in bpy.context.scene.objects:
  if o.type=='MESH':
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
   for p in o.data.polygons:p.use_smooth=True
 bpy.context.scene['character']=id;bpy.context.scene['identity_source']='Existing Maple Bean cast'
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{id}.blend'))
 optimize(56000)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{id}.glb'),export_format='GLB',export_animations=False,export_skins=True,export_morph=True,export_extras=True,export_yup=True)
 triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in bpy.context.scene.objects if o.type=='MESH');report={'id':id,'triangles':triangles,'bones':len(bones),'meshes':sum(o.type=='MESH' for o in bpy.context.scene.objects)}
 (OUT/f'{id}-stats.json').write_text(json.dumps(report,indent=2));print(report,flush=True)
 for o in bpy.context.scene.objects:
  if o.type=='MESH' and o.data.shape_keys:o.shape_key_clear()
 optimize(20000)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{id}-lod.glb'),export_format='GLB',export_animations=False,export_skins=True,export_extras=True,export_yup=True)

def optimize(target):
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 counts={o:sum(len(p.vertices)-2 for p in o.data.polygons)for o in objects}
 fixed=sum(n for o,n in counts.items() if o.data.shape_keys)
 movable=sum(n for o,n in counts.items() if not o.data.shape_keys)
 ratio=min(1,max(.12,(target-fixed)/max(1,movable)))
 for o in objects:
  if o.data.shape_keys or ratio>=1:continue
  bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Export detail budget','DECIMATE');mod.ratio=ratio;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)

if __name__=='__main__':
 requested=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else IDS
 for id in requested:
  if id not in IDS:raise ValueError(id)
  build(id)
