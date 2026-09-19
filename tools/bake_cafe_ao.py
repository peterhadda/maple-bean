"""Blender background: bake bounded ambient shading into the existing GLB vertices.

Preserves the original nodes, materials, meshes and gameplay coordinates. No UV atlas
or runtime postprocessing; the only added data is normalized vertex colour.
Run: blender --background --factory-startup --python tools/bake_cafe_ao.py
"""
import json
import math
import struct
from pathlib import Path
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parent.parent
raw = (ROOT / 'assets/cafe.glb').read_bytes()
json_size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_size])
start = 20 + json_size
size = struct.unpack_from('<I', raw, start)[0]
binary = bytearray(raw[start + 8:start + 8 + size])

def read(index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    code, width = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}[a['componentType']]
    count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    stride = view.get('byteStride', width * count)
    offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<' + code * count, binary, offset + i * stride) for i in range(a['count'])]

def local(node):
    if 'matrix' in node:
        return Matrix([node['matrix'][i:i + 4] for i in range(0, 16, 4)]).transposed()
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    return Matrix.LocRotScale(Vector(node.get('translation', [0, 0, 0])), Quaternion((w, x, y, z)), Vector(node.get('scale', [1, 1, 1])))

world = {}
def visit(i, parent):
    node = doc['nodes'][i]
    world[i] = parent @ local(node)
    for child in node.get('children', []):
        visit(child, world[i])
for i in doc['scenes'][doc.get('scene', 0)]['nodes']:
    visit(i, Matrix.Identity(4))

vertices, triangles, targets = [], [], []
for ni, node in enumerate(doc['nodes']):
    if 'mesh' not in node or ni not in world:
        continue
    name = node.get('name', '')
    if any(s in name for s in ['Broad living leaf', 'Plant frond', 'Maple Hollow tree canopy', 'Garden backdrop']):
        continue
    transform = world[ni]
    normal_matrix = transform.to_3x3().inverted().transposed()
    for prim in doc['meshes'][node['mesh']]['primitives']:
        if prim.get('mode', 4) != 4:
            continue
        positions = [transform @ Vector(p) for p in read(prim['attributes']['POSITION'])]
        normals = [(normal_matrix @ Vector(n)).normalized() for n in read(prim['attributes']['NORMAL'])]
        indices = [x[0] for x in read(prim['indices'])] if 'indices' in prim else list(range(len(positions)))
        base = len(vertices)
        vertices.extend(positions)
        triangles.extend(tuple(base + i for i in indices[j:j + 3]) for j in range(0, len(indices), 3))
        targets.append((prim, positions, normals))

tree = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
samples = []
for i in range(20):
    radius = math.sqrt((i + .5) / 20)
    angle = i * 2.39996323
    samples.append((math.cos(angle) * radius, math.sin(angle) * radius, math.sqrt(1 - radius * radius)))

cache = {}
for ti, (prim, positions, normals) in enumerate(targets):
    colors = bytearray()
    for p, n in zip(positions, normals):
        key = tuple(round(v, 4) for v in (*p, *n))
        if key not in cache:
            tangent = n.cross(Vector((0, 0, 1)) if abs(n.z) < .9 else Vector((0, 1, 0))).normalized()
            bitangent = n.cross(tangent)
            occlusion = 0
            for x, y, z in samples:
                hit, _, _, distance = tree.ray_cast(p + n * .0025, tangent * x + bitangent * y + n * z, .75)
                if hit is not None:
                    occlusion += (1 - distance / .75) ** 1.5
            # This is ambient shading only: retain colour and readable shadows.
            cache[key] = round(255 * (1 - .34 * occlusion / len(samples)))
        c = cache[key]
        colors.extend((c, c, c, 255))
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    binary.extend(colors)
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(colors), 'target': 34962})
    accessor = len(doc['accessors'])
    doc['accessors'].append({'bufferView': view, 'componentType': 5121, 'normalized': True, 'count': len(positions), 'type': 'VEC4'})
    prim['attributes']['COLOR_0'] = accessor
    if ti % 100 == 0:
        print(f'Ambient shading {ti}/{len(targets)}', flush=True)

doc['buffers'][0]['byteLength'] = len(binary)
data = json.dumps(doc, separators=(',', ':')).encode()
data += b' ' * (-len(data) % 4)
binary += b'\0' * (-len(binary) % 4)
result = struct.pack('<III', 0x46546C67, 2, 28 + len(data) + len(binary))
result += struct.pack('<II', len(data), 0x4E4F534A) + data
result += struct.pack('<II', len(binary), 0x004E4942) + binary
assert struct.unpack_from('<I', result, 8)[0] == len(result)
assert all(len(p) == len(n) for _, p, n in targets)
path = ROOT / 'assets/cafe-ambient.glb'
path.write_bytes(result)
print(f'Saved {path.name}: {len(targets)} unchanged primitives, {len(cache)} shaded samples', flush=True)
