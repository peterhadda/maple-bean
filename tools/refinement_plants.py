"""Import preserved runtime foliage into the refinement copy only."""
import bpy, json
from pathlib import Path
from mathutils import Matrix

def apply():
    data=json.loads((Path(__file__).resolve().parents[1]/'refinement/runtime_plants.json').read_text())
    collection=bpy.data.collections.new('Preserved runtime organic plants')
    bpy.context.scene.collection.children.link(collection)
    conversion=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
    # Preserve originals in the file, but show their established detailed runtime replacements.
    for obj in bpy.context.scene.objects:
        if obj.name.startswith(('Broad living leaf','Plant frond','Maple Hollow tree canopy')):
            obj.hide_render=True
            obj.hide_set(True)
    for ri,r in enumerate(data['records']):
        mesh=bpy.data.meshes.new(r['name'])
        vertices=list(zip(*[iter(r['position'])]*3))
        indices=r['index'] or list(range(len(vertices)))
        faces=list(zip(*[iter(indices)]*3))
        if r['name']=='Layered Maple Hollow tree crowns':
            # Bake the runtime instances into one draw mesh rather than 13,760 Blender objects.
            from mathutils import Vector
            baked_vertices=[];baked_faces=[];baked_colors=[]
            for instance in r['instances']:
                m=instance['matrix'];matrix=Matrix([m[j::4] for j in range(4)]);offset=len(baked_vertices)
                baked_vertices.extend(matrix@Vector(v) for v in vertices)
                baked_faces.extend(tuple(offset+i for i in f) for f in faces)
                baked_colors.extend(instance['color']*len(vertices))
            vertices,faces=baked_vertices,baked_faces
            r['color']=baked_colors
            r['instances']=[{'matrix':[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],'color':[1,1,1]}]
        mesh.from_pydata(vertices,[],faces)
        mesh.update()
        if r['uv']:
            uv=mesh.uv_layers.new(name='Runtime UV')
            for loop in mesh.loops:uv.data[loop.index].uv=r['uv'][loop.vertex_index*2:loop.vertex_index*2+2]
        colors=mesh.color_attributes.new(name='Runtime vertex color',type='FLOAT_COLOR',domain='POINT')
        for i,c in enumerate(colors.data):c.color=tuple(r['color'][i*3:i*3+3] if r['color'] else [1,1,1])+(1,)
        for p in mesh.polygons:p.use_smooth=True
        mat=bpy.data.materials.new(r['name']+' preserved runtime material');mat.use_nodes=True
        nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value=r['material']['roughness']
        attr=nodes.new('ShaderNodeVertexColor');attr.layer_name=colors.name
        info=nodes.new('ShaderNodeObjectInfo')
        multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
        links.new(attr.outputs['Color'],multiply.inputs[1]);links.new(info.outputs['Color'],multiply.inputs[2])
        base=nodes.new('ShaderNodeMixRGB');base.blend_type='MULTIPLY';base.inputs[0].default_value=1
        base.inputs[2].default_value=tuple(r['material']['color'])+(1,);links.new(multiply.outputs[0],base.inputs[1])
        links.new(base.outputs[0],bs.inputs['Base Color'])
        if r['material']['veins']:
            # Recreate the runtime's 128px ivory leaf map with its central and diagonal veins.
            image=bpy.data.images.new('Runtime leaf veins 128',128,128)
            bg=[v/255 for v in (230,236,221)];fg=[v/255 for v in (183,195,163)]
            pixels=bg+[1.0];pixels=pixels*(128*128)
            def pixel(x,y):
                if 0<=x<128 and 0<=y<128:pixels[4*((127-y)*128+x):4*((127-y)*128+x)+4]=fg+[1.0]
            for y in range(128):pixel(64,y)
            for y in range(12,126,17):
                for d in range(57):
                    pixel(64-d,round(y-d*22/56));pixel(64+d,round(y-d*22/56))
            image.pixels.foreach_set(pixels);image.pack()
            texture=nodes.new('ShaderNodeTexImage');texture.image=image
            mul=nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
            links.new(base.outputs[0],mul.inputs[1]);links.new(texture.outputs['Color'],mul.inputs[2]);links.new(mul.outputs[0],bs.inputs['Base Color'])
        mesh.materials.append(mat)
        for i,instance in enumerate(r['instances']):
            obj=bpy.data.objects.new(f'{r["name"]} {i:04d}',mesh);collection.objects.link(obj)
            m=instance['matrix'];obj.matrix_world=conversion@Matrix([m[j::4] for j in range(4)])
            obj.color=tuple(instance['color'])+(1,)
    print('PRESERVED_RUNTIME_PLANTS',data['plants'],'pots',sum(len(r['instances']) for r in data['records']),'instances')
