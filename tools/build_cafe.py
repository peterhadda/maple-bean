"""Expand the supplied MapleBeanGraphics.blend; export one editable scene and GLB."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
random.seed(14)
scene = bpy.context.scene
obstacles, stations = [], []

def material(name, color, rough=.75, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    rgb = tuple(int(color[i:i+2],16)/255 for i in (0,2,4))
    linear = tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb)
    m.diffuse_color = (*linear,1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*linear,1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if emission:
        bs.inputs['Emission Color'].default_value = (*linear,1)
        bs.inputs['Emission Strength'].default_value = emission
    return m

pine=material('Bean · forest green','304C40'); oak=material('Bean · honey oak','AD7950'); cream=material('Bean · warm plaster','E9D9C0')
brass=material('Bean · aged brass','BD975D',.4,.55); rust=material('Bean · cinnamon velvet','AD6046'); sage=material('Bean · sage upholstery','879071')
ivory=material('Bean · linen','EDE0C7'); dark=material('Bean · espresso','302A25'); clay=material('Bean · terracotta','AC634D'); leaf=material('Bean · foliage','426B46')
glow=material('Bean · warm light','FFE1A2',.6,0,1.6); stone=material('Bean · limestone','CEBCA3'); ink=material('Bean · chalk','F1E5CB')
woodtones=[material('Oak plank '+str(i), c) for i,c in enumerate(['AC835D','B58B63','C0986C','BC9064','A67D59','B38A64','C29A73'])]

def box(name, loc, size, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat: o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Soft furniture edges','BEVEL'); mod.width=bevel; mod.segments=3
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return o

def cyl(name, loc, radius, depth, mat, vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o=bpy.context.object; o.name=name; o.data.materials.append(mat)
    mod=o.modifiers.new('Rounded edge','BEVEL'); mod.width=.012; mod.segments=2
    for p in o.data.polygons: p.use_smooth=True
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def text(name, words, loc, size=.22, mat=ink, rotation=(math.pi/2,0,0)):
    cu=bpy.data.curves.new(name,'FONT'); cu.body=words; cu.align_x='CENTER'; cu.size=size; cu.extrude=.001
    o=bpy.data.objects.new(name,cu); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=rotation; cu.materials.append(mat)
    return o

def collision(x,y,w,d): obstacles.append(dict(x=x,z=-y,w=w,d=d))
def station(id,label,kind,x,y,ax,ay,angle=0):
    stations.append(dict(id=id,label=label,kind=kind,x=x,z=-y,approach=[ax,-ay],angle=angle))

# Keep the original counter, espresso machine, crockery, pastry display, chairs,
# menu and shelves. Replace only the small shell with the larger floor plan.
remove_prefix=('Back wall','Left wall','Right wall','Floor','Front solid panel','Window','Door','Marquee','Cornice','Forest green awning','Awning valance','Corner trim','MAPLE BEAN lettering','Pine wall panelling','Dado rail','Ceiling beam','Pendant','Roof cutaway')
original_count=0
for o in list(scene.objects):
    if o.type in {'CAMERA','LIGHT'} or o.name.startswith(remove_prefix): bpy.data.objects.remove(o,do_unlink=True)
    else:
        o.location.x-=3.4; o.location.y+=1.8; o.location.z-=.14
        o['source']='Original Maple Bean / Maple Hollow'
        original_count+=1

# Recover consistent exportable colors from the original material names.
mapping={'Maple_Brick':cream,'Maple_Wood':oak,'Maple_Cream':ivory,'Maple_Pine':pine,'Maple_Stone':stone,'Deep pine cabinetry':pine,'Warm oak':oak,'Warm brass':brass,'Ivory ceramic':ivory,'Terracotta':clay,'Chalkboard':dark,'Living fern':leaf,'Brushed espresso steel':brass}
for o in scene.objects:
    if o.type=='MESH':
        for i,m in enumerate(o.data.materials):
            if m and m.name in mapping: o.data.materials[i]=mapping[m.name]

box('Expanded foundation',(0,0,-.17),(20.4,14.4,.3),dark,.05)
for row in range(40):
    x=-9.75+row*.5
    y=-7
    while y < 6.999:
        length=min(random.choice([1.8,2.2,2.6]),7-y)
        box('Individual oak floorboard',(x,y+length/2,-.028),(.49,length-.012,.055),random.choice(woodtones),.006)
        y+=length
box('Back plaster wall',(0,7,1.9),(20,.24,3.8),cream)
box('Left plaster wall',(-10,0,1.9),(.24,14,3.8),cream)
box('Right plaster wall',(10,0,1.9),(.24,14,3.8),cream)
box('Back green wainscot',(0,6.83,.58),(19.8,.08,1.16),pine)
for x in [-9.82,9.82]:
    box('Green wainscot',(x,0,.58),(.08,13.8,1.16),pine)
    box('Oak dado',(x,0,1.18),(.14,13.9,.07),oak)
    for y in range(-6,7): box('Panel moulding',(x+(.048 if x<0 else -.048),y,.58),(.035,.055,.95),sage,.009)
box('Back dado',(0,6.79,1.18),(19.8,.14,.07),oak)

# Front windows really have openings; the earlier opaque wall behind each pane
# prevented light or a view through the shopfront.
for x in [-7.3,-3.3,3.3,7.3]:
    box('Facade lower panel',(x,-7,.38),(3.8,.22,.76),pine)
    for xx in [x-1.88,x+1.88]: box('Cream window upright',(xx,-7,1.95),(.12,.28,2.4),ivory)
    for zz in [.8,3.12]: box('Cream window lintel',(x,-7,zz),(3.9,.28,.12),ivory)
    box('Window slender mullion',(x,-7,1.95),(.055,.15,2.3),brass)
    box('Window sill',(x,-6.88,.78),(3.95,.42,.12),oak)
    box('Pine awning',(x,-7.5,3.25),(3.9,1.1,.12),pine)
    box('Awning valance',(x,-8,3.1),(3.9,.08,.22),pine)
for x in [-1.32,1.32]: box('Entrance door jamb',(x,-7,1.7),(.16,.32,3.4),pine)
for x in [-9.6,9.6]: box('Shopfront corner pier',(x,-7,1.7),(.8,.24,3.4),cream)
box('Entrance transom',(0,-7,3.14),(2.48,.32,.22),pine)
box('Flush oak threshold',(0,-7,.004),(2.48,.5,.008),oak,.004)
box('Entrance welcome mat',(0,-6.25,.012),(1.8,.85,.024),pine,.025)
text('Welcome mat lettering','WELCOME',(0,-6.36,.026),.19,ivory,rotation=(0,0,0))
# The open leaf sits beside the passage rather than across the entrance.
for y in [-7.12,-8.34]: box('Open entrance door stile',(-1.23,y,1.42),(.10,.10,2.84),oak)
for z in [.08,1.0,2.78]: box('Open entrance door rail',(-1.23,-7.73,z),(.10,1.32,.12),oak)
box('Open entrance door lower panel',(-1.23,-7.73,.54),(.065,1.22,.80),pine)
box('Entrance brass pull',(-1.15,-8.18,1.35),(.055,.055,.35),brass)
box('Maple Bean marquee',(0,-7,3.58),(20,.32,.7),pine)
text('Original shop name','M A P L E   B E A N',(0,-7.18,3.40),.32)
text('Door welcome','COME AS YOU ARE',(0,-7.2,3.14),.10)

# The beams can be toggled for an unobstructed floor-plan review in the browser.
for y in [-5,-1,3,6]: box('Ceiling beam',(0,y,3.68),(19.8,.16,.18),oak)
for x,y in [(-7,-3),(-3,-3),(2,-3),(7,-3),(-7,3),(-3,3),(2,3),(7,3)]:
    cyl('Pendant cord',(x,y,3.30),.012,.65,dark,10)
    bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.34,radius2=.16,depth=.28,location=(x,y,2.86))
    o=bpy.context.object;o.name='Pendant shade';o.data.materials.append(brass)
    cyl('Pendant warm diffuser',(x,y,2.715),.29,.018,glow)
    ld=bpy.data.lights.new('Warm pendant','POINT');ld.energy=65;ld.color=(1,.69,.39);ld.shadow_soft_size=.75
    lo=bpy.data.objects.new('Warm pendant',ld);scene.collection.objects.link(lo);lo.location=(x,y,2.60)

def rug(x,y,w,d,mat):
    box('Woven rug',(x,y,.009),(w,d,.016),mat,.015)
    for ox in [-w/2+.12,w/2-.12]: box('Rug border',(x+ox,y,.019),(.035,d-.20,.005),ivory,0)
    for oy in [-d/2+.12,d/2-.12]: box('Rug border',(x,y+oy,.019),(w-.20,.035,.005),ivory,0)

def plant(x,y,scale=1):
    cyl('Terracotta plant pot',(x,y,.22*scale),.22*scale,.44*scale,clay)
    cyl('Potting soil',(x,y,.445*scale),.195*scale,.025,dark)
    for i in range(10):
        a=i*2.399; r=(.12+.12*random.random())*scale
        z=(.65+random.random()*.55)*scale
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=(x+math.cos(a)*r,y+math.sin(a)*r,z))
        o=bpy.context.object;o.name='Broad living leaf';o.scale=(.11*scale,.055*scale,.28*scale);o.rotation_euler=(.35*math.sin(a),.45*math.cos(a),a);o.data.materials.append(leaf)
    if scale>=1: collision(x,y,.6*scale,.6*scale)

def cup(x,y,z):
    cyl('Ceramic coffee cup',(x,y,z+.065),.066,.12,ivory)
    cyl('Coffee surface',(x,y,z+.127),.052,.008,dark)
    cyl('Ceramic saucer',(x,y,z+.012),.10,.02,ivory)
    bpy.ops.mesh.primitive_torus_add(major_radius=.038,minor_radius=.010,major_segments=16,minor_segments=8,location=(x+.072,y,z+.075),rotation=(math.pi/2,0,0))
    bpy.context.object.name='Cup handle';bpy.context.object.data.materials.append(ivory)

def chair(x,y,rot=0,mat=sage):
    created=[]; before=set(scene.objects)
    box('Chair upholstered seat',(x,y,.475),(.56,.58,.13),mat,.07)
    box('Chair curved back',(x,y+.26,.79),(.59,.12,.58),mat,.055)
    for dx in [-.21,.21]:
        for dy in [-.21,.21]: box('Chair oak leg',(x+dx,y+dy,.21),(.055,.055,.42),oak,.01)
    for o in set(scene.objects)-before:
        ox,oy=o.location.x-x,o.location.y-y
        o.location.x=x+ox*math.cos(rot)-oy*math.sin(rot);o.location.y=y+ox*math.sin(rot)+oy*math.cos(rot);o.rotation_euler.z+=rot
    footprint=.62*(abs(math.cos(rot))+abs(math.sin(rot)))
    collision(x,y,footprint,footprint)

def sofa(x,y,w,mat):
    box('Sofa upholstered base',(x,y,.29),(w,.92,.35),mat,.12)
    box('Sofa generous back',(x,y+.43,.73),(w,.22,.89),mat,.10)
    for sx in [-1,1]: box('Sofa rounded arm',(x+sx*(w/2-.10),y,.59),(.23,1,.49),mat,.095)
    for i in range(3):
        xx=x-w/2+.27+(i+.5)*(w-.54)/3
        box('Sofa cushion',(xx,y-.06,.50),((w-.59)/3,.76,.17),mat,.065)
    for sx in [-1,1]:
        o=box('Linen throw pillow',(x+sx*(w/2-.48),y+.24,.78),(.42,.19,.44),ivory,.08);o.rotation_euler.y=sx*.15
    collision(x,y,w,1)

def round_table(x,y):
    cyl('Oak cafe tabletop',(x,y,.78),.56,.09,oak)
    cyl('Table pedestal',(x,y,.39),.055,.73,brass)
    cyl('Table foot',(x,y,.035),.30,.06,pine)
    cup(x+.18,y,.825)
    collision(x,y,1.15,1.15)

# Retained counter and two original table/chair sets.
collision(-3.4,4.8,5.3,1.15);collision(-6.9,4.8,1.5,1.15)
for x in [-7.4,.6]:
    collision(x,1.8,1.2,1.2);collision(x,.8,.7,.75)
station('coffee','Order a little happiness','coffee',-3.4,4.2,-3.4,3.3,math.pi)
station('original-west','Oak café table','seat',-7.4,.8,-7.4,-.05,math.pi)
station('original-east','A seat by the café','seat',.6,.8,.6,-.1,math.pi)

# New fireside living room, with seats facing into a clear shared lounge.
rug(6.7,3.9,5.4,4.6,rust)
sofa(6.7,5.55,3.6,sage)
station('sofa','Settle into the sofa','seat',6.7,5.05,6.7,4.5,0)
box('Low lounge coffee table',(6.7,3.55,.39),(1.8,.85,.09),oak,.15)
for x in [6.03,7.37]: box('Coffee table legs',(x,3.55,.19),(.11,.62,.38),pine)
collision(6.7,3.55,1.9,.95)
cup(6.3,3.5,.44);cup(7,3.5,.44)
box('Coffee table book',(6.8,3.7,.455),(.35,.27,.04),pine,.008)
for x in [5.3,8.1]: chair(x,2.15,math.atan2(6.7-x,2.15-3.55),rust)
station('lounge-chair','Join the fireside circle','seat',5.3,2.15,4.35,2.15,math.pi*.75)
box('Fireplace stone surround',(9.30,4,.95),(.80,2.40,1.90),stone,.08)
box('Fireplace dark opening',(8.88,4,.70),(.035,1.5,1),dark,.015)
box('Fireplace glowing hearth',(8.85,4,.28),(.03,1.3,.25),glow,.03)
box('Fireplace oak mantel',(9.25,4,1.94),(1,2.65,.14),oak)
collision(9.25,4,1.0,2.65)
plant(8.9,6.15,1.15)

# Community table for conversation, games and shared work.
rug(4,-2,4.6,3.8,sage)
box('Community oak table',(4,-2,.79),(3.25,1.18,.12),oak,.07)
for x in [2.8,5.2]: box('Community trestle',(x,-2,.38),(.14,.87,.76),pine)
collision(4,-2,3.4,1.3)
for i,x in enumerate([2.9,4,5.1]):
    chair(x,-.88,0);chair(x,-3.12,math.pi)
    station('community-'+str(i),'Share the community table','seat',x,-3.12,x,-4.0,math.pi)
for x in [2.9,4,5.1]: cup(x,-2,.86)
box('Board game',(4,-2.13,.873),(.40,.40,.026),ivory,.008)
for i in range(4):
    for j in range(4):
        if (i+j)%2: box('Game board square',(3.85+i*.10,-2.28+j*.10,.89),(.10,.10,.008),pine,0)

# Quiet reading room, carved out of the old front-left area.
rug(-6.7,-3.9,5.0,3.8,ivory)
sofa(-6.8,-2.55,2.9,rust)
station('reading','Read by the window','read',-5.9,-3.05,-5.9,-3.5,0)
round_table(-7,-4.35)
box('Bookcase oak frame',(-9.50,-3.7,1.14),(.55,3.8,2.28),oak)
for z in [.25,.85,1.45,2.05]:
    box('Bookcase dark recess',(-9.20,-3.7,z+.15),(.025,3.5,.42),pine,0)
    for j in range(18):
        h=random.uniform(.24,.4)
        box('Community library book',(-9.15,-5.35+j*.185,z+h/2),(.16,.13,h),random.choice([pine,rust,sage,ivory,brass]),.004)
collision(-9.5,-3.7,.75,3.8)
plant(-8.75,-1.25,1.25)

# Window perches and independent two-person tables.
for x in [-3.1,8.0]:
    round_table(x,-5.5);chair(x-.95,-5.5,math.pi/2);chair(x+.95,-5.5,-math.pi/2)
    station('window-'+str(x),'Watch Maple Hollow go by','seat',x-.95,-5.5,x-.95,-4.55,math.pi/2)
for x,y in [(1,6.15),(-9,5.9),(9,-.4),(2.0,-6.35)]:plant(x,y,1.05)

# Study nook: two individual desks in the quiet pocket right of the community
# table, each with its own lamp and a shelf of books - somewhere to bring a
# laptop rather than a whole party.
def desk_lamp(x,y,z):
    cyl('Desk lamp base',(x,y,z+.015),.05,.03,dark)
    cyl('Desk lamp arm',(x,y,z+.13),.011,.20,brass)
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.085,radius2=.03,depth=.10,location=(x,y,z+.275))
    o=bpy.context.object;o.name='Desk lamp shade';o.rotation_euler.x=math.pi;o.data.materials.append(brass)
    cyl('Desk lamp glow',(x,y,z+.235),.045,.015,glow)
    ld=bpy.data.lights.new('Desk lamp light','POINT');ld.energy=14;ld.color=(1,.74,.46);ld.shadow_soft_size=.25
    lo=bpy.data.objects.new('Desk lamp light',ld);scene.collection.objects.link(lo);lo.location=(x,y,z+.24)

def charging_strip(x,y,z):
    box('Charging strip',(x,y,z),(.20,.05,.02),dark,.005)
    for dx in [-.06,0,.06]: box('Charging strip light',(x+dx,y-.018,z+.012),(.018,.018,.006),glow,0)

def study_desk(prefix,x,y,chair_y,with_laptop=False):
    box(prefix+' top',(x,y,.74),(.85,.55,.05),oak,.02)
    for dx in [-.36,.36]:
        for dy in [-.20,.20]: box(prefix+' leg',(x+dx,y+dy,.37),(.045,.045,.70),pine,.008)
    chair(x,chair_y,math.pi,sage)
    desk_lamp(x+.28,y+.16,.765)
    charging_strip(x-.05,y+.19,.762)
    if with_laptop:
        box(prefix+' laptop',(x-.05,y-.05,.775),(.28,.20,.016),dark,.004)
    else:
        for j in range(3):
            h=random.uniform(.15,.22)
            box(prefix+' book',(x-.30+j*.09,y-.14,.765+h/2),(.08,.12,h),random.choice([pine,rust,ivory]),.004)
    collision(x,y,.55,.5)

study_desk('Study desk one',7.1,-2.0,-2.5)
station('study-0','A quiet desk to focus','study',7.1,-2.5,7.1,-3.4,math.pi)
study_desk('Study desk two',8.5,-2.0,-2.5,with_laptop=True)
station('study-1','A quiet desk to focus','study',8.5,-2.5,8.5,-3.4,math.pi)
plant(6.55,-1.35,.75)

# Quiet storytelling details on the expanded walls.
box('Community noticeboard',(4.7,6.78,2.13),(2.6,.10,1.05),oak)
for i,words in enumerate(['BOOK CLUB','MAKE A FRIEND','SUNDAY JAZZ']):
    x=3.9+i*.8;box('Pinned community note',(x,6.715,2.14),(.66,.016,.72),ivory,.009)
    text('Community note '+str(i),words,(x,6.69,2.26),.07,pine)
text('Lounge wall title','STAY A LITTLE LONGER',(6.9,6.83,3.06),.20,pine)
text('Reading wall title','TAKE A BOOK. LEAVE A STORY.',(-6.9,6.82,3.28),.12,pine)
station('mara','Say hello to Mara','talk',-4.7,5.75,-4.7,3.7,0)
station('jules','Chat with Jules','talk',3.0,.2,2.15,.2,0)

station('claire','Meet Claire','talk',-3.1,-1,-2.35,-1,0)

# An outdoor surround makes the open front read as a real place.
box('Stone entrance path',(0,-8.2,-.05),(22,2.4,.10),stone,.03)
box('Garden backdrop',(0,0,-.36),(60,60,.14),sage,0)
for x,y in [(-12,-8),(-12,1),(-12,9),(12,-8),(12,1),(12,9),(-5,11),(6,11)]:
    cyl('Garden tree trunk',(x,y,1.2),.16,2.4,oak)
    for dx,dy,dz in [(0,0,2.7),(.7,0,2.4),(-.6,.3,2.5),(0,-.5,3.35)]:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1.15,location=(x+dx,y+dy,dz))
        o=bpy.context.object;o.name='Maple Hollow tree canopy';o.data.materials.append(leaf)

world=bpy.data.worlds.new('Maple afternoon');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.63,.72,.80,1);world.node_tree.nodes['Background'].inputs[1].default_value=.5
ld=bpy.data.lights.new('Afternoon sun','AREA');ld.energy=2800;ld.shape='DISK';ld.size=12
lo=bpy.data.objects.new('Afternoon sun',ld);scene.collection.objects.link(lo);lo.location=(-4,-6,12)
lo.rotation_euler=(Vector((0,0,0))-lo.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.cameras.new('Cafe overview');co=bpy.data.objects.new('Cafe overview',cam);scene.collection.objects.link(co);co.location=(22,-28,24)
co.rotation_euler=(Vector((0,0,0))-co.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=29;scene.camera=co
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene['source']='Expanded from the user supplied MapleBeanGraphics.blend'
scene['original_floor_area_m2']=120;scene['expanded_floor_area_m2']=280;scene['original_objects_retained']=original_count
scene['browser_preview']='Run Start Cafe.cmd, then open http://localhost:4321'

# Export fonts as meshes so the name, menu and community notes survive in GLB.
for o in list(scene.objects):
    if o.type=='FONT':
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
Path(ROOT/'assets').mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'MapleBeanExpanded.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/cafe.glb'),export_format='GLB',export_extras=True,export_lights=False,export_cameras=False,export_apply=True)
for s in stations:
    s['seatHeight'] = .585 if s['id'] in ['sofa','reading'] else .44 if s['id'].startswith('original-') else .54
(ROOT/'assets/layout.json').write_text(json.dumps(dict(width=20,depth=14,entrance=dict(halfWidth=1.24,endZ=9.0),originalArea=120,area=280,originalObjects=original_count,obstacles=obstacles,stations=stations),indent=2))
print('EXPANDED CAFE',original_count,'original objects,',len(scene.objects),'total objects;',len(stations),'interactions')
