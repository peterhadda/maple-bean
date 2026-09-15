import bpy, json
from mathutils import Vector
items = []
for o in bpy.context.scene.objects:
    corners = [o.matrix_world @ Vector(v) for v in o.bound_box]
    items.append(dict(name=o.name, type=o.type, location=list(o.location), dimensions=list(o.dimensions), materials=[m.name for m in o.data.materials] if o.type == 'MESH' else [], bounds=[[min(p[i] for p in corners) for i in range(3)], [max(p[i] for p in corners) for i in range(3)]]))
with open('cafe-source.json', 'w') as f: json.dump(items, f, indent=2)
print('CAFE_OBJECTS', len(items))
