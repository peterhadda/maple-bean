"""Match the existing denim panels with vertex colour; keep atlas pixels unchanged.
Run only after male geometry is frozen. Captures an idempotent source per model.
"""
from pathlib import Path
import json, struct, io, math, sys
from PIL import Image

BASE=Path('qa/expansion/characters/denim-source')
INSPECT='--inspect' in sys.argv
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def linear(c):
 c=c/255;return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4

def patch(who):
 file=Path('assets/characters')/(who+'.glb');source=file if INSPECT else BASE/file.name
 if not INSPECT:
  BASE.mkdir(parents=True,exist_ok=True)
  if not source.exists():source.write_bytes(file.read_bytes())
 raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);data=bytearray(raw[n+28:])
 def meta(aid):
  a=doc['accessors'][aid];v=doc['bufferViews'][a['bufferView']];return a,v,v.get('byteOffset',0)+a.get('byteOffset',0)
 def read(aid,i,count):
  a,v,off=meta(aid);kind={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']];size=struct.calcsize(kind)*count
  return struct.unpack_from('<'+kind*count,data,off+i*v.get('byteStride',size))
 changed=0
 for mesh in doc['meshes']:
  for prim in mesh['primitives']:
   mat=doc['materials'][prim.get('material',0)]
   if mat.get('name')!='Wardrobe':continue
   attrs=prim['attributes'];count=doc['accessors'][attrs['POSITION']]['count'];pos=[read(attrs['POSITION'],i,3) for i in range(count)];uv=[read(attrs['TEXCOORD_0'],i,2) for i in range(count)]
   parents=list(range(count));flags=[0]*count
   def find(i):
    while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
    return i
   for k in range(0,doc['accessors'][prim['indices']]['count'],3):
    ids=[read(prim['indices'],k+d,1)[0] for d in range(3)]
    for i in ids[1:]:parents[find(i)]=find(ids[0])
    for i in ids:
     if abs(pos[i][1]-.76)<.0002:
      if any(pos[q][1]>.761 for q in ids):flags[i]|=1
      if any(pos[q][1]<.759 for q in ids):flags[i]|=2
   hip=[i for i in range(count) if flags[i]==1];leg=[i for i in range(count) if flags[i]==2]
   if not hip or not leg:continue
   hip_roots={find(i) for i in hip};leg_roots={find(i) for i in leg}
   im=doc['images'][doc['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source']];v=doc['bufferViews'][im['bufferView']];off=v.get('byteOffset',0);image=Image.open(io.BytesIO(data[off:off+v['byteLength']])).convert('RGB')
   def sample(tex):
    # Average inside each original 256px atlas cell, avoiding neighbour bleed.
    x,y=[t*d for t,d in zip(tex,image.size)];cx,cy=[int(t*8) for t in tex];cw,ch=image.width//8,image.height//8
    x=max(cx*cw+3,min((cx+1)*cw-4,int(x)));y=max(cy*ch+3,min((cy+1)*ch-4,int(y)))
    return [sum(image.getpixel((x+dx,y+dy))[k] for dx in [-1,0,1] for dy in [-1,0,1])/9 for k in range(3)]
   pairs=[]
   for i in hip:
    q=min(leg,key=lambda q:math.dist(pos[i],pos[q]));a,b=sample(uv[i]),sample(uv[q]);ratios=[max(.4,min(1,linear(b[k])/max(.0001,linear(a[k])))) for k in range(3)];pairs.append((pos[i],ratios))
   colors=bytearray([255]*(count*3));ua,uvmeta,uoff=meta(attrs['TEXCOORD_0'])
   for i,p in enumerate(pos):
    root=find(i)
    if root in hip_roots|leg_roots:
     # Give existing atlas panels enough inset to suppress neighbouring-cell seams.
     padded=[]
     for t in uv[i]:
      cell=int(t*8);f=t*8-cell;m=4/256;padded.append((cell+m+(f-.002)/.996*(1-2*m))/8)
     struct.pack_into('<ff',data,uoff+i*uvmeta.get('byteStride',8),*padded)
    if root not in hip_roots or not .7599<=p[1]<.90:continue
    nearby=sorted(pairs,key=lambda r:(r[0][0]-p[0])**2+(r[0][2]-p[2])**2)[:5]
    fade=1-smooth(.76,.90,p[1]);ratio=[sum(r[1][k] for r in nearby)/len(nearby) for k in range(3)]
    for k in range(3):colors[i*3+k]=round(255*(1+(ratio[k]-1)*fade))
    changed+=1
   while len(data)%4:data.append(0)
   offset=len(data);data.extend(colors);view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(colors),'target':34962});attrs['COLOR_0']=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5121,'normalized':True,'count':count,'type':'VEC3'})
 while len(data)%4:data.append(0)
 doc['buffers'][0]['byteLength']=len(data);text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*((-len(text))%4)
 result=struct.pack('<4sII',b'glTF',2,28+len(text)+len(data))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(data),0x004e4942)+data
 assert changed>0,who+' no seam vertices found'
 if not INSPECT:file.write_bytes(result)
 print(who,'blended vertices',changed,'extra bytes',len(result)-len(raw),'inspect only' if INSPECT else 'written')
if __name__=='__main__':
 for who in ['jules','jules-lod','noah','noah-lod']:patch(who)
