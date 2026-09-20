"""Reference-led cafe surface, planting and light pass; preserves existing layout."""
import bpy, math, random
from mathutils import Vector

def apply():
    random.seed(24)
    s=bpy.context.scene
    # Existing detailed runtime foliage is imported by refinement_plants.py.
    for m in list(bpy.data.materials):
        if not m.use_nodes:continue
        bs=m.node_tree.nodes.get('Principled BSDF')
        if not bs:continue
        n=m.name.lower()
        if any(k in n for k in ['oak','wood']):
            nodes=m.node_tree.nodes;links=m.node_tree.links
            tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=5;tex.inputs['Detail'].default_value=2
            coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(3,65,4)
            links.new(coord.outputs['Generated'],mapping.inputs[0]);links.new(mapping.outputs[0],tex.inputs['Vector'])
            ramp=nodes.new('ShaderNodeValToRGB');base=bs.inputs['Base Color'].default_value[:]
            ramp.color_ramp.elements[0].color=tuple(c*.72 for c in base[:3])+(1,);ramp.color_ramp.elements[1].color=tuple(min(c*1.15,1) for c in base[:3])+(1,)
            links.new(tex.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],bs.inputs['Base Color'])
            bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.008;links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs[0],bs.inputs['Normal']);bs.inputs['Roughness'].default_value=.58
        if any(k in n for k in ['velvet','upholstery','linen']):bs.inputs['Roughness'].default_value=.86;bs.inputs['Sheen Weight'].default_value=.24
    for o in s.objects:
        if o.type=='LIGHT':
            if o.data.type=='POINT':o.data.color=(1,.65,.34);o.data.energy=65;o.data.shadow_soft_size=.15
            elif o.name=='Afternoon sun':o.data.energy=1800;o.data.color=(1,.82,.61)
    world=s.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[1].default_value=.22
    ld=bpy.data.lights.new('Late afternoon through storefront','SUN');ld.energy=1.5;ld.angle=.10;ld.color=(1,.76,.49);lo=bpy.data.objects.new(ld.name,ld);s.collection.objects.link(lo);lo.rotation_euler=(math.radians(28),math.radians(-24),math.radians(-25))
    s['refinement_environment']='Reference Photos 1,3,5: existing runtime foliage, oak grain, fabric sheen and warm directional daylight. Original room layout retained.'
    return {'layout_preserved':True,'plants_preserved_from_runtime':True}

