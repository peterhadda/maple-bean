"""Add the Study Room (east) and Garden & Games room (back) to MapleBeanExpanded.blend.

blender --background --factory-startup --python-exit-code 1 --python tools/build_wings.py

Idempotent: every object this script creates is tagged `wing`, and the layout
entries it owns carry "wing": true, so re-running replaces rather than stacks.
The main room's furniture, stations and collision boxes are untouched; only the
back and east walls are rebuilt as segments around the two new doorways.
Coordinates below are glTF/browser coordinates (x, z) — `B()` converts to Blender.
"""
import bpy, math, random, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
random.seed(27)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'MapleBeanExpanded.blend'))
scene = bpy.context.scene
for o in list(scene.objects):
    if o.get('wing'): bpy.data.objects.remove(o, do_unlink=True)

M = bpy.data.materials
def mat(name, color=None, rough=.75, metal=0, emission=0):
    if name in M: return M[name]
    m = M.new(name); rgb = tuple(int(color[i:i+2], 16)/255 for i in (0, 2, 4))
    lin = tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)
    m.diffuse_color = (*lin, 1); m.use_nodes = True; bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*lin, 1); bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    if emission: bs.inputs['Emission Color'].default_value = (*lin, 1); bs.inputs['Emission Strength'].default_value = emission
    return m
pine = mat('Bean · forest green'); oak = mat('Bean · honey oak'); cream = mat('Bean · warm plaster'); brass = mat('Bean · aged brass')
rust = mat('Bean · cinnamon velvet'); sage = mat('Bean · sage upholstery'); ivory = mat('Bean · linen'); dark = mat('Bean · espresso')
clay = mat('Bean · terracotta'); leaf = mat('Bean · foliage'); glow = mat('Bean · warm light'); stone = mat('Bean · limestone'); ink = mat('Bean · chalk')
felt = mat('Bean · games felt', '3F6B55', .95); cork = mat('Bean · dartboard cork', 'C9A36E', .9); red = mat('Bean · dartboard red', 'B5463A', .8)
screen = mat('Bean · arcade screen', '1B2A22', .35, 0, .25); glass = mat('Bean · conservatory glass', 'DDEBE4', .08)
woodtones = [m for m in M if m.name.startswith('Oak plank ')] or [oak]

def B(x, z): return (x, -z)
def tag(o):
    o['wing'] = True; o['source'] = 'Maple Bean wings (tools/build_wings.py)'; return o
def box(name, x, z, y, w, d, h, m, bevel=.02, rot=0):
    bx, by = B(x, z)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(bx, by, y))
    o = bpy.context.object; o.name = name; o.dimensions = (w, d, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler.z = rot; o.data.materials.append(m)
    if bevel:
        mod = o.modifiers.new('Soft edges', 'BEVEL'); mod.width = bevel; mod.segments = 2
        o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return tag(o)
def cyl(name, x, z, y, r, h, m, verts=24):
    bx, by = B(x, z)
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(bx, by, y))
    o = bpy.context.object; o.name = name; o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = True
    return tag(o)
def text(name, words, x, z, y, size, m, facing=0):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = words; cu.align_x = 'CENTER'; cu.size = size; cu.extrude = .002
    o = bpy.data.objects.new(name, cu); scene.collection.objects.link(o); bx, by = B(x, z)
    o.location = (bx, by, y); o.rotation_euler = (math.pi/2, 0, facing); cu.materials.append(m)
    return tag(o)

obstacles, stations, rooms, doors = [], [], [], []
def collide(x, z, w, d): obstacles.append(dict(x=round(x, 3), z=round(z, 3), w=round(w, 3), d=round(d, 3), wing=True))
def station(**s): s['wing'] = True; stations.append(s)

# Chairs face `angle` (browser yaw: 0 faces +z, pi/2 faces +x); the back sits behind.
def chair(x, z, angle, m=sage, seat=.54):
    fx, fz = math.sin(angle), math.cos(angle)
    parts = [box('Chair upholstered seat', x, z, seat-.065, .56, .58, .13, m, .06),
             box('Chair curved back', x-fx*.26, z-fz*.26, seat+.25, .59, .12, .58, m, .05)]
    for dx in (-.21, .21):
        for dz in (-.21, .21): parts.append(box('Chair oak leg', x+dx, z+dz, (seat-.13)/2, .055, .055, seat-.13, oak, .01))
    for p in parts[:2]: p.rotation_euler.z = angle
    fp = .62*(abs(fx)+abs(fz)) if abs(fx) > .01 and abs(fz) > .01 else .62
    collide(x, z, fp, fp)
def armchair(x, z, angle, m=rust):
    fx, fz = math.sin(angle), math.cos(angle)
    o = box('Armchair seat', x, z, .30, .82, .80, .36, m, .1); o.rotation_euler.z = angle
    o = box('Armchair cushion', x+fx*.04, z+fz*.04, .52, .66, .62, .12, m, .05); o.rotation_euler.z = angle
    o = box('Armchair back', x-fx*.34, z-fz*.34, .72, .82, .16, .72, m, .08); o.rotation_euler.z = angle
    for s in (-1, 1):
        o = box('Armchair arm', x+fz*s*.36, z-fx*s*.36, .56, .14, .78, .30, m, .06); o.rotation_euler.z = angle
    collide(x, z, .86, .86)
def plant(x, z, s=1, hanging=False, y0=0):
    if not hanging:
        cyl('Terracotta plant pot', x, z, y0+.22*s, .22*s, .44*s, clay)
        cyl('Potting soil', x, z, y0+.445*s, .195*s, .025, dark)
    for i in range(10 if not hanging else 8):
        a = i*2.399; r = (.12+.12*random.random())*s; y = y0+((.65+random.random()*.55) if not hanging else (-.1-random.random()*.5))*s
        bx, by = B(x+math.cos(a)*r, z+math.sin(a)*r)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=(bx, by, y))
        o = bpy.context.object; o.name = 'Broad living leaf'; o.scale = (.11*s, .055*s, .28*s); o.rotation_euler = (.35*math.sin(a), .45*math.cos(a), a); o.data.materials.append(leaf); tag(o)
    if not hanging and s >= .9: collide(x, z, .6*s, .6*s)
def rug(x, z, w, d, m):
    box('Woven rug', x, z, .009, w, d, .016, m, .015)
    for o in (-w/2+.12, w/2-.12): box('Rug border', x+o, z, .019, .035, d-.2, .005, ivory, 0)
    for o in (-d/2+.12, d/2-.12): box('Rug border', x, z+o, .019, w-.2, .035, .005, ivory, 0)
def lamp(x, z, y, energy=16):
    cyl('Desk lamp base', x, z, y+.015, .05, .03, dark)
    cyl('Desk lamp arm', x, z, y+.13, .011, .2, brass)
    cyl('Desk lamp shade', x, z, y+.27, .07, .1, brass)
    cyl('Desk lamp glow', x, z, y+.225, .045, .012, glow)
def pendant(x, z, y=2.75):
    cyl('Pendant cord', x, z, y+.45, .012, .9, dark, 10)
    bx, by = B(x, z); bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=.30, radius2=.14, depth=.26, location=(bx, by, y))
    o = bpy.context.object; o.name = 'Pendant shade'; o.data.materials.append(brass); tag(o)
    cyl('Pendant warm diffuser', x, z, y-.135, .25, .016, glow)
def shelf(x, z, w, facing_x, height=2.1):
    # Freestanding bookcase against a wall. facing_x: +1 faces +x, -1 faces -x, 0 faces +z.
    along_z = facing_x != 0
    box('Bookcase oak frame', x, z, height/2, .42 if along_z else w, w if along_z else .42, height, oak)
    for y in [.3, .75, 1.2, 1.65][: int(height/.45)]:
        n = int(w/.17)
        for j in range(n):
            h = random.uniform(.22, .36); off = -w/2+.12+j*(w-.24)/max(1, n-1)
            bx, bz = (x+facing_x*.1, z+off) if along_z else (x+off, z+.1)
            box('Community library book', bx, bz, y+h/2, .15 if along_z else .12, .12 if along_z else .15, h, random.choice([pine, rust, sage, ivory, brass]), .004)
    collide(x, z, .5 if along_z else w, w if along_z else .5)

# ----------------------------------------------------------------------------- walls
H = 3.8
def remove_named(prefix, test):
    for o in list(scene.objects):
        if o.name.startswith(prefix) and not o.get('wing') and test(o): bpy.data.objects.remove(o, do_unlink=True)
remove_named('Back plaster wall', lambda o: True); remove_named('Back green wainscot', lambda o: True); remove_named('Back dado', lambda o: True)
remove_named('Right plaster wall', lambda o: True)
remove_named('Green wainscot', lambda o: o.location.x > 0); remove_named('Oak dado', lambda o: o.location.x > 0)
remove_named('Panel moulding', lambda o: o.location.x > 0 and .2 < o.location.y < 1.9)
# Trees that would stand inside the new rooms move further into the garden.
for o in scene.objects:
    if o.name.startswith(('Garden tree trunk', 'Maple Hollow tree canopy')):
        x, gz = o.location.x, -o.location.y
        if 9 < x < 14 and -8 < gz < 3: o.location.x += 7.5
        # Back-garden trees go well behind the Games & Garden room (earlier runs
        # of this script shifted them the wrong way, to z = -5: fix those too).
        if -2 < x < 9 and (-9 < gz < -2 or -12 < gz < -9): o.location.y = o.location.y + (12 if gz > -9 else 6)

def wall_x(z, x0, x1, gaps, t=.24, h=H, m=cream, wainscot=True, side=1):
    """Wall along x at depth z with door/window gaps [(a,b,kind)]."""
    cuts = sorted(gaps); edges = [x0]
    for a, b, _ in cuts: edges += [a, b]
    edges.append(x1)
    for i in range(0, len(edges), 2):
        a, b = edges[i], edges[i+1]
        if b-a > .01:
            box('Wing plaster wall', (a+b)/2, z, h/2, b-a, t, h, m, 0)
            if wainscot:
                box('Wing green wainscot', (a+b)/2, z+side*.16, .58, b-a, .08, 1.16, pine, 0)
                box('Wing oak dado', (a+b)/2, z+side*.17, 1.18, b-a, .12, .07, oak, 0)
    for a, b, kind in cuts:
        if kind == 'door': box('Wing door lintel', (a+b)/2, z, (2.7+h)/2, b-a, t, h-2.7, m, 0)
        else:
            box('Wing window sill wall', (a+b)/2, z, .45, b-a, t, .9, m, 0)
            box('Wing window lintel', (a+b)/2, z, (2.55+h)/2, b-a, t, h-2.55, m, 0)
            box('Wing window sill', (a+b)/2, z+side*.12, .92, b-a+.1, .26, .06, oak)
            box('Cream window upright', (a+b)/2, z, 1.72, .06, .12, 1.64, ivory)
def wall_z(x, z0, z1, gaps, t=.24, h=H, m=cream, wainscot=True, side=1):
    cuts = sorted(gaps); edges = [z0]
    for a, b, _ in cuts: edges += [a, b]
    edges.append(z1)
    for i in range(0, len(edges), 2):
        a, b = edges[i], edges[i+1]
        if b-a > .01:
            box('Wing plaster wall', x, (a+b)/2, h/2, t, b-a, h, m, 0)
            if wainscot:
                box('Wing green wainscot', x+side*.16, (a+b)/2, .58, .08, b-a, 1.16, pine, 0)
                box('Wing oak dado', x+side*.17, (a+b)/2, 1.18, .12, b-a, .07, oak, 0)
    for a, b, kind in cuts:
        if kind == 'door': box('Wing door lintel', x, (a+b)/2, (2.7+h)/2, t, b-a, h-2.7, m, 0)
        else:
            box('Wing window sill wall', x, (a+b)/2, .45, t, b-a, .9, m, 0)
            box('Wing window lintel', x, (a+b)/2, (2.55+h)/2, t, b-a, h-2.55, m, 0)
            box('Wing window sill', x+side*.12, (a+b)/2, .92, .26, b-a+.1, .06, oak)
            box('Cream window upright', x, (a+b)/2, 1.72, .12, .06, 1.64, ivory)
def door_frame(x, z, along_x, width, label):
    for s in (-1, 1):
        if along_x: box('Doorway oak casing', x+s*(width/2+.05), z, 1.36, .1, .34, 2.72, oak)
        else: box('Doorway oak casing', x, z+s*(width/2+.05), 1.36, .34, .1, 2.72, oak)
    if along_x: box('Doorway oak header', x, z, 2.75, width+.2, .34, .1, oak)
    else: box('Doorway oak header', x, z, 2.75, .34, width+.2, .1, oak)
def floor(x0, x1, z0, z1):
    box('Wing foundation', (x0+x1)/2, (z0+z1)/2, -.17, x1-x0+.4, z1-z0+.4, .3, dark, .05)
    x = x0+.25
    while x < x1:
        z = z0
        while z < z1-.001:
            ln = min(random.choice([1.8, 2.2, 2.6]), z1-z)
            box('Individual oak floorboard', x, z+ln/2, -.028, .49, ln-.012, .055, random.choice(woodtones), .006)
            z += ln
        x += .5

# Main room: back wall (z=-7) gains the Garden & Games doorway; east wall (x=10) the Study Room doorway.
BACK_DOOR = (2.0, 3.2); EAST_DOOR = (-1.75, -.35)
wall_x(-7, -10, 10, [(BACK_DOOR[0], BACK_DOOR[1], 'door')], side=1)
wall_z(10, -7, 7, [(EAST_DOOR[0], EAST_DOOR[1], 'door')], side=-1, wainscot=False)
for a, b in [(-7, EAST_DOOR[0]), (EAST_DOOR[1], 7)]:
    box('Green wainscot', 9.82, (a+b)/2, .58, .08, b-a, 1.16, pine, 0); box('Oak dado', 9.82, (a+b)/2, 1.18, .14, b-a, .07, oak, 0)
door_frame(sum(BACK_DOOR)/2, -7, True, BACK_DOOR[1]-BACK_DOOR[0], 'games')
door_frame(10, sum(EAST_DOOR)/2, False, EAST_DOOR[1]-EAST_DOOR[0], 'study')
text('Games doorway sign', 'GAMES & GARDEN', sum(BACK_DOOR)/2, -6.82, 3.02, .13, pine, 0)
text('Study doorway sign', 'STUDY ROOM', 9.82, sum(EAST_DOOR)/2, 3.02, .13, pine, math.pi/2)

# ----------------------------------------------------------------------------- Study Room
SX0, SX1, SZ0, SZ1 = 10, 17.2, -6.4, 2.2
rooms.append(dict(id='study-room', name='Study Room', x0=SX0, x1=SX1, z0=SZ0, z1=SZ1))
doors.append(dict(id='study-door', x0=9.3, x1=10.75, z0=EAST_DOOR[0]+.28, z1=EAST_DOOR[1]-.28))
floor(SX0, SX1, SZ0, SZ1)
wall_x(SZ0, SX0-.12, SX1+.12, [(11.2, 12.8, 'window'), (14.3, 15.9, 'window')], side=1)
wall_x(SZ1, SX0-.12, SX1+.12, [(12.4, 14.4, 'window')], side=-1)
wall_z(SX1, SZ0, SZ1, [(-3.2, -1.2, 'window')], side=-1)
rug(13.6, -1.95, 4.2, 2.6, sage)
# Individual focus desks under the north windows, each with a lamp and a laptop or books.
for i, x in enumerate([11.5, 13.3, 15.1]):
    box('Study desk top', x, -5.55, .74, .95, .6, .05, oak, .02)
    for dx in (-.4, .4):
        for dz in (-.22, .22): box('Study desk leg', x+dx, -5.55+dz, .37, .045, .045, .7, pine, .008)
    lamp(x+.32, -5.72, .765)
    box('Study laptop base', x-.05, -5.5, .772, .3, .21, .014, dark, .004)
    lid = box('Study laptop lid', x-.05, -5.62, .88, .3, .012, .2, dark, .004); lid.rotation_euler.x = -.25
    box('Study laptop screen', x-.05, -5.608, .88, .27, .004, .17, screen, 0).rotation_euler.x = -.25
    box('Study notebook', x+.12, -5.4, .77, .16, .21, .01, ivory, .003)
    collide(x, -5.55, .98, .62)
    chair(x, -4.95, math.pi)
    station(id=f'study-room-{i}', label='A focus desk', kind='study', x=x, z=-4.95, approach=[x, -4.1], angle=math.pi, seatHeight=.54, deskHeight=.765, zone='study')
# A shared study table for studying together.
box('Shared study table', 13.6, -1.95, .74, 2.5, 1.05, .06, oak, .03)
for x in (12.55, 14.65): box('Shared study trestle', x, -1.95, .37, .1, .8, .7, pine)
for x in (12.9, 14.3):
    lamp(x+.35, -1.95, .77)
    box('Shared table books', x-.3, -1.75, .81, .2, .15, .08, random.choice([rust, pine, ivory]), .004)
collide(13.6, -1.95, 2.6, 1.15)
for j, (x, z, a) in enumerate([(12.9, -2.75, 0), (14.3, -2.75, 0), (12.9, -1.15, math.pi), (14.3, -1.15, math.pi)]):
    chair(x, z, a)
    station(id=f'study-table-{j}', label='The shared study table', kind='study', x=x, z=z, approach=[x, z-.85 if a == 0 else z+.85], angle=a, seatHeight=.54, deskHeight=.77, zone='study', shared=True)
# Reading armchairs, shelves and plants keep the room calm and warm.
armchair(11.2, 1.3, math.pi*.85); armchair(16.2, 1.3, -math.pi*.85)
for x, z, a in [(11.2, 1.3, math.pi*.85), (16.2, 1.3, -math.pi*.85)]:
    station(id=f'study-armchair-{int(x)}', label='A reading armchair', kind='read', x=x, z=z, approach=[x+math.sin(a)*.8, z+math.cos(a)*.8], angle=a, seatHeight=.52, zone='study')
cyl('Side table', 13.7, 1.55, .3, .28, .6, oak); collide(13.7, 1.55, .6, .6)
shelf(16.9, -4.6, 2.6, -1, 2.3)
plant(16.7, -1.1, 1.1); plant(10.5, -5.9, .95); plant(16.7, 1.9, .9)
for x, z in [(11.8, -4.2), (15.2, -4.2), (13.6, -1.95)]: pendant(x, z, 2.9)
text('Study room title', 'QUIET  FOCUS', 13.6, -6.24, 3.05, .18, pine, 0)
text('Study room motto', 'one page at a time', 13.6, -6.24, 2.8, .09, pine, 0)

# ----------------------------------------------------------------------------- Garden & Games room
GX0, GX1, GZ0, GZ1 = -1.0, 7.6, -14.4, -7
rooms.append(dict(id='games-room', name='Games & Garden', x0=GX0, x1=GX1, z0=GZ0, z1=GZ1))
doors.append(dict(id='games-door', x0=BACK_DOOR[0]+.26, x1=BACK_DOOR[1]-.26, z0=-7.75, z1=-6.3))
floor(GX0, GX1, GZ0, GZ1)
wall_z(GX0, GZ0, GZ1, [(-12.8, -10.8, 'window')], side=1)
wall_z(GX1, GZ0, GZ1, [(-9.6, -8.0, 'window')], side=-1)
wall_x(GZ0, GX0-.12, GX1+.12, [(0.2, 2.2, 'window'), (4.4, 6.4, 'window')], side=1)
rug(1.4, -10.6, 3.6, 5.6, rust)
def game_table(x, z, w, d, top=felt, round_=False):
    if round_: cyl('Games table top', x, z, .76, max(w, d)/2, .06, oak)
    else: box('Games table top', x, z, .76, w, d, .06, oak, .02)
    cyl('Games table pedestal', x, z, .38, .06, .72, brass); cyl('Games table foot', x, z, .03, .28, .05, pine)
    collide(x, z, w+.05, d+.05)
# Chess (players face each other across x).
game_table(0.6, -9.2, .9, .9)
box('Chess board', 0.6, -9.2, .795, .5, .5, .015, oak, .004)
for x, a in [(-.35, math.pi/2), (1.55, -math.pi/2)]: chair(x, -9.2, a, rust)
station(id='game-chess', label='Chess table', kind='game', game='chess', x=0.6, z=-9.2, seats=[dict(x=-.35, z=-9.2, angle=math.pi/2, approach=[-.35, -8.35]), dict(x=1.55, z=-9.2, angle=-math.pi/2, approach=[1.55, -8.35])], approach=[-.35, -8.35], angle=math.pi/2, tableHeight=.79, seatHeight=.54, zone='games')
# Tic-tac-toe.
game_table(0.6, -12.2, .8, .8)
for x, a in [(-.35, math.pi/2), (1.55, -math.pi/2)]: chair(x, -12.2, a, sage)
station(id='game-xo', label='XO table', kind='game', game='xo', x=0.6, z=-12.2, seats=[dict(x=-.35, z=-12.2, angle=math.pi/2, approach=[-.35, -11.35]), dict(x=1.55, z=-12.2, angle=-math.pi/2, approach=[1.55, -11.35])], approach=[-.35, -11.35], angle=math.pi/2, tableHeight=.79, seatHeight=.54, zone='games')
# Memory cards and a card-game table.
game_table(3.9, -12.5, 1.1, .9)
for x, a in [(3.9, 0), ]: chair(x, -13.35, 0, sage)
chair(3.9, -11.65, math.pi, sage)
station(id='game-memory', label='Memory cards', kind='game', game='memory', x=3.9, z=-12.5, seats=[dict(x=3.9, z=-11.65, angle=math.pi, approach=[3.9, -10.8]), dict(x=3.9, z=-13.35, angle=0, approach=[2.95, -13.35])], approach=[3.9, -10.8], angle=math.pi, tableHeight=.79, seatHeight=.54, zone='games')
game_table(3.7, -9.0, .9, .9, round_=True)
chair(3.7, -8.15, math.pi, rust); chair(3.7, -9.85, 0, rust)
station(id='game-cards', label='Card table', kind='game', game='cards', x=3.7, z=-9.0, seats=[dict(x=3.7, z=-8.15, angle=math.pi, approach=[4.6, -8.15]), dict(x=3.7, z=-9.85, angle=0, approach=[4.6, -9.85])], approach=[4.6, -8.15], angle=math.pi, tableHeight=.79, seatHeight=.54, zone='games')
# Arcade cabinet (Snake) against the east wall; the player stands at the controls.
ax, az = 7.05, -11.3
box('Arcade cabinet body', ax, az, .9, .7, .75, 1.8, pine, .03)
box('Arcade control panel', ax-.42, az, 1.0, .3, .72, .08, dark, .01).rotation_euler.y = 0
box('Arcade marquee', ax-.36, az, 1.72, .06, .66, .2, glow, .01)
box('Arcade screen', ax-.36, az, 1.36, .02, .5, .4, screen, 0)
cyl('Arcade joystick', ax-.45, az+.13, 1.08, .012, .08, dark); cyl('Arcade button', ax-.45, az-.08, 1.045, .025, .02, red); cyl('Arcade button', ax-.45, az-.17, 1.045, .025, .02, brass)
collide(ax-.1, az, 1.0, .85)
station(id='game-snake', label='Snake arcade', kind='game', game='snake', x=6.1, z=az, approach=[6.1, az], angle=math.pi/2, standing=True, panelHeight=1.02, zone='games')
# Dartboard on the back wall with an oche line.
dx, dz = 6.1, -14.25
cyl('Dartboard cabinet', dx, dz, 1.73, .36, .05, oak, 32).rotation_euler.x = math.pi/2
for r, m, off in [(.23, dark, .03), (.225, cork, .035), (.15, red, .04), (.1, cork, .045), (.05, felt, .05), (.018, red, .055)]:
    c = cyl('Dartboard ring', dx, dz+off, 1.73, r, .01, m, 40); c.rotation_euler.x = math.pi/2
box('Oche line', dx, -11.9, .004, .6, .04, .006, brass, 0)
station(id='game-darts', label='Dartboard', kind='game', game='darts', x=dx, z=-11.75, approach=[dx, -11.75], angle=math.pi, standing=True, board=dict(x=dx, y=1.73, z=dz+.06), zone='games')
# The garden half of the room: many plants, hanging greenery and a bench.
for x, z, s in [(-.5, -7.6, 1.1), (-.55, -13.9, 1.2), (2.3, -14.0, .95), (7.1, -7.5, 1.05), (7.1, -13.9, 1.0), (5.25, -7.6, .85)]:
    plant(x, z, s)
    station(id=f'plant-{x:.1f}-{z:.1f}', label='A thirsty plant', kind='plant', x=x, z=z, approach=[x+(.75 if x < 3 else -.75), z+(.6 if z < -11 else -.6)], angle=0, zone='garden')
for x, z in [(1.0, -10.6), (4.2, -10.7), (6.0, -8.0)]:
    plant(x, z, .8, hanging=True, y0=3.25); cyl('Hanging planter', x, z, 3.2, .16, .2, clay); cyl('Planter cord', x, z, 3.55, .006, .5, dark, 6)
box('Garden bench seat', 6.95, -9.6, .45, .5, 1.6, .08, oak); box('Garden bench back', 7.25, -9.6, .75, .08, 1.6, .5, oak)
for dz in (-.7, .7): box('Garden bench leg', 6.95, -9.6+dz, .22, .45, .06, .44, pine)
collide(7.0, -9.6, .7, 1.7)
station(id='garden-bench', label='A sunny garden bench', kind='seat', x=6.95, z=-9.6, approach=[6.1, -9.6], angle=-math.pi/2, seatHeight=.49, zone='garden')
for x, z in [(1.2, -10.6), (4.0, -10.9)]: pendant(x, z, 2.85)
text('Games room title', 'PLAY  NICE', 3.0, -14.24, 3.05, .18, pine, 0)

# Plants in the main room can be watered too.
for x, z, ax, az in [(1, -6.15, 1, -5.3), (-9, -5.9, -8.2, -5.2), (9, .4, 8.2, .4), (2.0, 6.35, 2.0, 5.5), (-8.75, 1.25, -8.75, .5)]:
    station(id=f'plant-{x:.1f}-{z:.1f}', label='A thirsty plant', kind='plant', x=x, z=z, approach=[ax, az], angle=0, zone='main')

# ----------------------------------------------------------------------------- export
for o in list(scene.objects):
    if o.type == 'FONT' and o.get('wing'):
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o; bpy.ops.object.convert(target='MESH'); tag(bpy.context.object)
scene['expanded_floor_area_m2'] = 280 + (SX1-SX0)*(SZ1-SZ0) + (GX1-GX0)*(GZ1-GZ0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'MapleBeanExpanded.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'assets/cafe.glb'), export_format='GLB', export_extras=True, export_lights=False, export_cameras=False, export_apply=True)
path = ROOT / 'assets/layout.json'; layout = json.loads(path.read_text())
layout['obstacles'] = [o for o in layout['obstacles'] if not o.get('wing')] + obstacles
layout['stations'] = [s for s in layout['stations'] if not s.get('wing')] + stations
layout['rooms'] = rooms; layout['doors'] = doors
layout['area'] = round(scene['expanded_floor_area_m2'])
path.write_text(json.dumps(layout, indent=2))
print('WINGS', len(obstacles), 'obstacles', len(stations), 'stations', 'area', layout['area'])
