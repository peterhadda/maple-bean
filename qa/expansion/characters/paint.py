import bpy, sys
from pathlib import Path
root=Path.cwd();sys.path.insert(0,str(root/'tools'))
from author_characters import face_texture, IDS
out=root/'qa/expansion/characters/paint';out.mkdir(exist_ok=True)
for id in IDS:
 im=face_texture(id);im.filepath_raw=str(out/(id+'.png'));im.file_format='PNG';im.save()