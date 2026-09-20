"""Noah's fitted jacket and folded hood, authored in the game's Y-up bind space.

Call refine_noah_clothes({'mesh': mesh, 'lock': lock, ...}) immediately after
load_body('noah', mats), before skin binding or material merging. Source meshes
must expose source_color (linear RGB) and atlas_uv. No new materials are made.
Run python tools/noah_garments.py for the standalone topology check.
"""
import math
from collections import Counter


def _lerp(a, b, t):
    return a * (1 - t) + b * t


def _solidify(vertices, faces, thickness):
    """Give an open garment panel a closed, thin inner surface and rolled edge."""
    normals = [[0., 0., 0.] for _ in vertices]
    edges = {}
    for face in faces:
        a, b, c = (vertices[i] for i in face[:3])
        u, v = [b[k] - a[k] for k in range(3)], [c[k] - a[k] for k in range(3)]
        n = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        for index in face:
            for k in range(3):
                normals[index][k] += n[k]
        for a, b in zip(face, face[1:] + face[:1]):
            key = tuple(sorted((a, b)))
            edges[key] = None if key in edges else (a, b)
    inner = []
    for vertex, normal in zip(vertices, normals):
        length = math.sqrt(sum(n*n for n in normal)) or 1
        inner.append(tuple(vertex[k] - thickness * normal[k] / length for k in range(3)))
    count = len(vertices)
    closed = faces + [tuple(i + count for i in reversed(face)) for face in faces]
    closed += [(b, a, a+count, b+count) for edge in edges.values() if edge for a, b in [edge]]
    return vertices + inner, closed


def _torso():
    vertices, faces = [], []
    rows, columns = 18, 40
    for row in range(rows + 1):
        t = row / rows
        opening = _lerp(.355, .50, t*t)
        for column in range(columns + 1):
            angle = opening + (math.tau - 2*opening) * column / columns
            side = abs(math.sin(angle))
            shoulder = 1.307 - .063 * side**1.6
            y = _lerp(.936, shoulder, t)
            width = _lerp(.126, .073 + .105*side**1.5, t) + .008*math.sin(math.pi*t)
            depth = _lerp(.107, .069 + .022*side, t)
            # Shallow cloth folds gather at the hem and side of the waist.
            fold = .0011 * math.sin(angle*9 + t*7) * math.sin(math.pi*t)**2
            fold += .0009 * math.sin(t*29) * (1-t)**3
            vertices.append((math.sin(angle)*(width+fold), y, math.cos(angle)*(depth+fold)-.012))
    for row in range(rows):
        for column in range(columns):
            n = row*(columns+1)+column
            faces.append((n, n+1, n+columns+2, n+columns+1))
    return _solidify(vertices, faces, .0028)


def _sleeve(side):
    # Center x/y/z and elliptical radii. The shoulder cap is part of the loft.
    profile = [
        (.157, 1.289, -.017, .005, .005),
        (.169, 1.276, -.017, .035, .039),
        (.178, 1.251, -.016, .050, .052),
        (.190, 1.171, -.002, .044, .047),
        (.201, 1.060, .007, .039, .042),
        (.195, .985, .016, .035, .038),
        (.185, .879, .028, .031, .033),
        (.180, .802, .031, .028, .030),
    ]
    vertices, faces = [], []
    rows, columns = 28, 24
    for row in range(rows + 1):
        t = row/rows*(len(profile)-1)
        i, u = min(len(profile)-2, int(t)), t-min(len(profile)-2, int(t))
        a, b, c, d = [profile[max(0, min(len(profile)-1, k))] for k in (i-1, i, i+1, i+2)]
        x, y, z, rx, rz = [.5*((2*b[k])+(-a[k]+c[k])*u+(2*a[k]-5*b[k]+4*c[k]-d[k])*u*u+(-a[k]+3*b[k]-3*c[k]+d[k])*u*u*u) for k in range(5)]
        for column in range(columns):
            angle = column/columns*math.tau
            fold = .0009*math.sin(angle*3 + row*.65)*math.exp(-((y-1.06)/.075)**2)
            vertices.append((side*(x+math.cos(angle)*(rx+fold)), y, z+math.sin(angle)*(rz+fold)))
    for row in range(rows):
        for column in range(columns):
            a, b = row*columns+column, row*columns+(column+1)%columns
            faces.append((a, a+columns, b+columns, b))
    faces += [tuple(reversed(range(columns))), tuple(rows*columns+j for j in range(columns))]
    return vertices, faces


def _hood():
    vertices, faces = [], []
    rows, columns = 8, 40
    for row in range(rows+1):
        t = row/rows
        for column in range(columns+1):
            angle = .60 + (math.tau-1.20)*column/columns
            back = (1-math.cos(angle))*.5
            radius = .061 + .050*t
            y = 1.302 - .074*t*back + .012*math.sin(math.pi*t) - .012*t*(1-back)
            vertices.append((math.sin(angle)*radius*.96, y, math.cos(angle)*radius-.023-.012*t*back))
    for row in range(rows):
        for column in range(columns):
            n = row*(columns+1)+column
            faces.append((n, n+columns+1, n+columns+2, n+1))
    # Fold the forward hood tips down/back onto the tee neckline, retaining its open front.
    vertices = [(x, y-.022*max(0,min(1,(z-.005)/.06)), z-.018*max(0,min(1,(z-.005)/.06))) for x,y,z in vertices]
    return _solidify(vertices, faces, .0035)


def _cuff(side):
    vertices, faces = [], []
    columns = 24
    profile = [(.821, .0295), (.816, .031), (.798, .029), (.792, .027)]
    for y, radius in profile:
        for column in range(columns):
            a = column/columns*math.tau
            vertices.append((side*(.180 + math.cos(a)*radius), y, .031+math.sin(a)*radius*1.07))
    for row in range(len(profile)-1):
        for column in range(columns):
            a, b = row*columns+column, row*columns+(column+1)%columns
            faces.append((a, a+columns, b+columns, b))
    return _solidify(vertices, faces, .002)


def refine_noah_clothes(api):
    """Replace Noah-only olive/cream details; return the new body mesh objects.

    Required api: mesh(name, vertices, faces, material, uv), lock(...).
    Coordinates are already at final body height: do not apply the +.03 lift
    again. Every result is body=True; sleeves/cuffs carry region='arm', side.
    """
    import bpy

    def linear(hex_color):
        values = [int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)]
        return [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in values]

    sources = [o for o in bpy.context.scene.objects if o.type == 'MESH'
               and o.name.replace('_', ' ').startswith('Noah garment details')]
    matched = {}
    for name, color in [('olive', '535d45'), ('cream', 'e8ddc9')]:
        target = linear(color)
        matched[name] = [o for o in sources if o.get('source_color') is not None
                         and max(abs(a-b) for a, b in zip(o['source_color'], target)) < .025]
        if not matched[name]:
            raise ValueError('Noah '+name+' source material/atlas marker is missing')
    palette = {name: (objects[0].data.materials[0], tuple(objects[0]['atlas_uv']),
                      list(objects[0]['source_color'])) for name, objects in matched.items()}
    created = []

    def mark(obj, color, side=None):
        material, uv, source_color = palette[color]
        layer = obj.data.uv_layers.active
        for loop in obj.data.loops:
            p=api['G'](obj.data.vertices[loop.vertex_index].co)
            u=max(0,min(1,(p.x+.3)/.6));v=max(0,min(1,(p.y-.79)/.54))
            layer.data[loop.index].uv=((int(uv[0]*8)+.02+.96*u)/8,(int(uv[1]*8)+.02+.96*v)/8)
        obj['body'] = True
        obj['source_color'] = source_color
        obj['atlas_uv'] = list(uv)
        if side is not None:
            obj['region'], obj['side'] = 'arm', side
        created.append(obj)
        return obj

    def make(name, geometry, color, side=None):
        vertices, faces = geometry
        material, uv, _ = palette[color]
        return mark(api['mesh']('Noah refined '+name, vertices, faces, material, [uv]*len(vertices)), color, side)

    def seam(name, points, width, color, side=None, steps=20):
        return mark(api['lock']('Noah refined '+name, points, width, width*.65,
                               palette[color][0], steps=steps, sides=6, taper=False), color, side)

    make('fitted jacket', _torso(), 'olive')
    make('folded hood', _hood(), 'cream')
    for side in (-1, 1):
        make('continuous sleeve '+str(side), _sleeve(side), 'olive', side)
        make('knit cuff '+str(side), _cuff(side), 'olive', side)
        seam('hood drawcord '+str(side), [(side*.043, 1.288, .067),
             (side*.052, 1.234, .099), (side*.050, 1.174, .112),
             (side*.048, 1.118, .121)], .0017, 'cream', steps=22)
        seam('front folded edge '+str(side), [(side*.037, 1.293, .064),
             (side*.045, 1.227, .080), (side*.047, 1.119, .098),
             (side*.045, 1.013, .103), (side*.044, .941, .092)], .0018, 'olive')
    hem = []
    for i in range(41):
        angle = .355 + (math.tau-.710)*i/40
        hem.append((math.sin(angle)*.1264, .943, math.cos(angle)*.1074-.012))
    seam('soft hem', hem, .0021, 'olive', steps=40)
    # The outer jacket now contains complete sleeves; remove the hidden cream
    # under-sleeves so they cannot break through the shoulder surface.
    cream=linear('e8ddc9')
    for obj in list(bpy.context.scene.objects):
        if obj not in created and obj.get('region')=='arm' and obj.get('source_color') is not None and max(abs(a-b) for a,b in zip(obj['source_color'],cream))<.025:
            bpy.data.objects.remove(obj,do_unlink=True)
    # Remove only the matching source batches after the replacement exists.
    # Canvas, leather and original cream underbody batches remain untouched.
    for objects in matched.values():
        for obj in objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    return created


def _check():
    for name, geometry in [('torso', _torso()), ('hood', _hood()),
                           ('left sleeve', _sleeve(-1)), ('right sleeve', _sleeve(1)),
                           ('cuff', _cuff(1))]:
        vertices, faces = geometry
        assert all(math.isfinite(value) for vertex in vertices for value in vertex), name
        edges = Counter()
        for face in faces:
            assert len(face) >= 3 and all(0 <= i < len(vertices) for i in face), name
            for a, b in zip(face, face[1:] + face[:1]):
                edges[tuple(sorted((a, b)))] += 1
        assert set(edges.values()) == {2}, name+' must be a closed garment surface'
    assert max(v[1] for v in _hood()[0]) < 1.32
    print('Noah garment lofts: finite coordinates, closed surfaces, fitted height passed.')


if __name__ == '__main__':
    _check()
