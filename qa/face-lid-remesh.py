"""Isolated local eyelid topology trial. Original outer face, body, rig and materials remain."""
import bpy, sys, math, os
import numpy as np
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]; source, destination=args
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(source))
obj=next(o for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys and any(m.name=='Skin' for m in o.data.materials))
mesh=obj.data
verts=[v.co.copy() for v in mesh.vertices]; faces=[list(p.vertices) for p in mesh.polygons]
keys={k.name:[p.co.copy() for p in k.data] for k in mesh.shape_keys.key_blocks}
old_count=len(verts); weights=[[(g.group,g.weight) for g in v.groups] for v in mesh.vertices]
uvs=[[mesh.uv_layers.active.data[i].uv.copy() for i in p.loop_indices] for p in mesh.polygons]
materials=list(mesh.materials); material_indices=[p.material_index for p in mesh.polygons]
edges={}
for f in faces:
 for a,b in zip(f,f[1:]+f[:1]):
  key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
boundary={i for edge,n in edges.items() if n==1 for i in edge}
# Blender coordinates: x, negative game depth, game height.
for side in (-1,1):
 ids=[i for i in boundary if verts[i].y<-.075 and abs(verts[i].x-side*.064)<.050 and abs(verts[i].z-1.445)<.039]
 assert len(ids)>12, ('Missing eye rim',side,len(ids))
 cx=(min(verts[i].x for i in ids)+max(verts[i].x for i in ids))/2
 cy=(min(verts[i].z for i in ids)+max(verts[i].z for i in ids))/2
 ids.sort(key=lambda i:math.atan2(verts[i].z-cy,verts[i].x-cx))
 rx=(max(verts[i].x for i in ids)-min(verts[i].x for i in ids))/2
 ry=(max(verts[i].z for i in ids)-min(verts[i].z for i in ids))/2
 uv_samples={}
 for f,uv in zip(faces,uvs):
  for i,value in zip(f,uv):
   if i in ids:uv_samples[i]=value
 fit=np.linalg.lstsq(np.array([[verts[i].x,verts[i].z,1] for i in ids]),np.array([uv_samples[i] for i in ids]),rcond=None)[0]
 previous=ids
 for ring in range(1,4):
  t=ring/3; current=[]
  for i in ids:
   outer=verts[i]; angle=math.atan2((outer.z-cy)/ry,(outer.x-cx)/rx)
   inner=Vector((cx+rx*.87*math.cos(angle),outer.y,cy+ry*.72*math.sin(angle)))
   # Continue the existing convex rim over the globe rather than forming a flat shelf.
   depth=max(-outer.y,.1041+math.sqrt(max(0,.0476**2-(inner.x-cx)**2-(inner.z-1.4451)**2)))+.0007
   inner.y=-depth
   point=outer.lerp(inner,t); n=len(verts); current.append(n);verts.append(point);weights.append(weights[i])
   seam=Vector((inner.x,-.153,cy-.002+.001*math.sin(angle)**2))
   for name,coords in keys.items():
    if name in ('blink.L','blink.R','wink'):
     active=(side<0 and name=='blink.L') or (side>0 and name in ('blink.R','wink'))
     coords.append(outer.lerp(seam,t) if active else point.copy())
    else:
     delta=coords[i]-keys['Basis'][i] if name!='Basis' else Vector()
     coords.append(point+delta)
  for k in range(len(ids)):
   f=[previous[k],previous[(k+1)%len(ids)],current[(k+1)%len(ids)],current[k]]
   # Front-facing winding in Blender coordinates.
   if (verts[f[1]]-verts[f[0]]).cross(verts[f[2]]-verts[f[0]]).y>0:f.reverse()
   faces.append(f);material_indices.append(0)
   uvs.append([Vector(np.array([verts[i].x,verts[i].z,1]) @ fit) for i in f])
  previous=current
for name in ('blink.L','blink.R','wink'):
 if name in keys:
  for i in range(old_count):keys[name][i]=keys['Basis'][i].copy()
new=bpy.data.meshes.new('Connected eyelid rings');new.from_pydata(verts,[],faces);new.update()
for m in materials:new.materials.append(m)
obj.shape_key_clear();obj.data=new
layer=new.uv_layers.new(name='UVMap')
for p,uv,mi in zip(new.polygons,uvs,material_indices):
 p.use_smooth=True;p.material_index=mi
 for loop,value in zip(p.loop_indices,uv):layer.data[loop].uv=value
for name,coords in keys.items():
 key=obj.shape_key_add(name=name)
 for vertex,co in zip(key.data,coords):vertex.co=co
for index,groups in enumerate(weights):
 for group,weight in groups:obj.vertex_groups[group].add([index],weight,'REPLACE')
for o in bpy.data.objects:
 if o.type=='MESH' and o.data.shape_keys:
  for key in o.data.shape_keys.key_blocks:key.value=0
os.makedirs(os.path.dirname(os.path.abspath(destination)),exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(destination+'.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.abspath(destination+'.glb'),export_format='GLB',export_animations=False,export_morph=True,export_skins=True,export_yup=True)
print('LID_RING_RESULT',old_count,len(verts),len(faces))

