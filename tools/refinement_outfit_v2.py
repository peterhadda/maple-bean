"""Minimal below-waist extensions of existing men tops; preserves accepted design."""
import math


def components(mesh):
    parents = list(range(len(mesh.vertices)))
    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for e in mesh.edges:
        parents[root(e.vertices[1])] = root(e.vertices[0])
    groups = {}
    for v in mesh.vertices:
        groups.setdefault(root(v.index), []).append(v.index)
    return list(groups.values())


def lower_top(z, old_hem):
    t = max(0, min(1, (1.16-z)/max(.01, 1.16-old_hem)))
    return z-max(0,old_hem-.895)*t, t


def apply(character_id, objects, rig):
    if character_id not in ('noah', 'jules'):
        return {'changed': False, 'reason': 'Accepted design preserved'}
    if rig.get('maple_long_top_v2'):
        return {'changed': False, 'reason': 'already applied'}
    extended = 0
    hems = []
    for obj in objects:
        if obj.type != 'MESH' or not any(m and (m.name.startswith('Wardrobe') or 'reference' in m.name and ('Sweatshirt' in m.name or 'Hoodie' in m.name)) for m in obj.data.materials):
            continue
        assert not obj.data.shape_keys, 'Wardrobe morphs require explicit handling'
        for indices in components(obj.data):
            lo = [min(obj.data.vertices[i].co[a] for i in indices) for a in range(3)]
            hi = [max(obj.data.vertices[i].co[a] for i in indices) for a in range(3)]
            width = hi[0]-lo[0]
            central = lo[0] < -.07 and hi[0] > .07 and hi[1] < .13
            torso = central and .92 < lo[2] < 1.08 and hi[2]-lo[2] > .15 and hi[2] < 1.30
            rib = central and .93 < lo[2] < 1.06 and hi[2]-lo[2] < .015 and hi[2] < 1.10
            edge = character_id == 'noah' and width < .03 and abs((lo[0]+hi[0])/2) < .065 and .93 < lo[2] < .96 and hi[2] > 1.2 and hi[1] < -.06
            if not (torso or rib or edge):
                continue
            hems.append(lo[2])
            bottom=[obj.data.vertices[i].co for i in indices if obj.data.vertices[i].co.z < lo[2]+.025]
            # Existing pants reach X=.152, front Y=-.090, back Y=.140.
            # A lowered fitted chest ring would otherwise disappear inside them.
            sx=max(1,.159/max(.02,max(abs(p.x) for p in bottom))) if not edge else 1.26
            front=max(1,.112/max(.02,max(-p.y for p in bottom))) if not edge else 1.20
            back=max(1,.151/max(.02,max(p.y for p in bottom))) if not edge else 1.20
            for i in indices:
                vertex = obj.data.vertices[i]
                vertex.co.z, t = lower_top(vertex.co.z, lo[2])
                # Ease only the lower half over hips; keep chest and shoulders.
                vertex.co.x *= 1+(sx-1)*t
                vertex.co.y *= 1+((front if vertex.co.y<0 else back)-1)*t
                if vertex.co.z < 1.04:
                    for group in obj.vertex_groups:
                        group.remove([i])
                    spine = max(0,min(1,(vertex.co.z-.89)/.16))
                    for name,weight in [('hips',1-spine),('spine',spine)]:
                        group=obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                        if weight:group.add([i],weight,'REPLACE')
                extended += 1
    assert extended > 0, character_id+': no shirt component matched'
    rig['maple_long_top_v2']=True
    return {'changed':True,'extended_vertices':extended,'source_hems_m':hems,
            'target_hem_m':.895,'rig_coordinates_changed':False,'new_meshes':0}


if __name__ == '__main__':
    assert abs(lower_top(1.03,1.03)[0]-.895) < 1e-9
    assert abs(lower_top(.936,.936)[0]-.895) < 1e-9
    assert lower_top(1.22,1.03)[0] == 1.22
    assert all(math.isfinite(lower_top(z,.97)[0]) for z in (.97,1.02,1.10,1.26))
    print('Original top extension checks passed')
