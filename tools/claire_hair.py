"""Claire's continuous crown-to-length hair, in the builder's unscaled Y-up space.

Call author_claire_hair({'mesh': mesh, 'scalp': scalp, 'mat': hair_material})
instead of the generic Claire hair branch. The builder applies its shared head
transform and joins the returned meshes as usual. Run this file to check geometry.
"""
import math


def _smooth(a, b, x):
    t = max(0., min(1., (x - a) / (b - a)))
    return t * t * (3. - 2. * t)


def _point(points, t):
    s = t * (len(points) - 1)
    i = min(len(points) - 2, int(s))
    u = s - i
    a, b, c, d = [points[max(0, min(len(points) - 1, k))] for k in (i - 1, i, i + 1, i + 2)]
    return tuple(.5 * (2 * b[k] + (-a[k] + c[k]) * u +
                       (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * u * u +
                       (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * u ** 3) for k in range(3))


def _unit(v):
    length = math.sqrt(sum(x * x for x in v))
    assert length > 1e-10, 'Degenerate hair frame'
    return tuple(x / length for x in v)


def _sweep(api, name, points, width, depth, azimuth, steps=40, sides=10):
    # A fixed lateral guide prevents the twisting frame of a nearly vertical tube.
    guide = (math.cos(azimuth), 0., -math.sin(azimuth))
    vertices, faces, uv = [], [], []
    for i in range(steps + 1):
        t = i / steps
        centre = _point(points, t)
        a, b = _point(points, max(0., t - .002)), _point(points, min(1., t + .002))
        tangent = _unit(tuple(b[k] - a[k] for k in range(3)))
        dot = sum(guide[k] * tangent[k] for k in range(3))
        across = _unit(tuple(guide[k] - tangent[k] * dot for k in range(3)))
        normal = (tangent[1] * across[2] - tangent[2] * across[1],
                  tangent[2] * across[0] - tangent[0] * across[2],
                  tangent[0] * across[1] - tangent[1] * across[0])
        taper = max(.025, 1. - _smooth(.72, 1., t)) ** .65
        fullness = .12 + .88 * _smooth(0., .19, t)
        for j in range(sides):
            angle = j / sides * math.tau
            lateral = math.cos(angle) * width * fullness * taper
            thickness = math.sin(angle) * depth * (.80 + .20 * math.sin(math.pi * t)) * taper
            vertices.append(tuple(centre[k] + across[k] * lateral + normal[k] * thickness for k in range(3)))
            uv.append((j / sides, t))
    for i in range(steps):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.extend([tuple(reversed(range(sides))), tuple(steps * sides + j for j in range(sides))])
    return api['mesh'](name, vertices, faces, api['mat'], uv)


def author_claire_hair(api):
    mesh, scalp, mat = api['mesh'], api['scalp'], api['mat']
    parts = []
    # The front edge stays buried under the two swept curtains. There is no
    # exposed horizontal blonde band, and no separate short nape layer.
    vertices = [(0., 1.651, 0.)]
    uv, faces = [(.5, 1.)], []
    sectors, rings = 60, 18
    for i in range(1, rings + 1):
        t = i / rings
        for j in range(sectors):
            psi = j / sectors * math.tau
            front, back = max(0., math.cos(psi)), max(0., -math.cos(psi))
            edge = -.30 - .40 * back ** 1.5 + 1.42 * front ** 2.5
            el = math.pi / 2 + (edge - math.pi / 2) * t
            vertices.append(tuple(scalp(psi, el, 0.)))
            uv.append((j / sectors, 1. - t))
    for j in range(sectors):
        faces.append((0, 1 + j, 1 + (j + 1) % sectors))
    for i in range(rings - 1):
        for j in range(sectors):
            a, b = 1 + i * sectors + j, 1 + i * sectors + (j + 1) % sectors
            faces.append((a, b, b + sectors, a + sectors))
    parts.append(mesh('Claire crown foundation', vertices, faces, mat, uv))

    def long_mass(psi, phase, lift=0., tip=1.045):
        points = [tuple(scalp(psi + .10, 1.31, -.006 + lift * .35)),
                  tuple(scalp(psi + .07, .92, .003 + lift)),
                  tuple(scalp(psi + .03, .42, .006 + lift)),
                  tuple(scalp(psi, -.20, .008 + lift))]
        for k, y in enumerate((1.365, 1.280, 1.195, 1.110, tip)):
            t = k / 4
            wave = .023 * math.sin(t * math.tau * (1.03 + .08 * math.sin(phase)) + phase)
            radius = .148 + .010 * math.sin(t * math.pi) + lift
            points.append((math.sin(psi) * (radius + wave), y,
                           math.cos(psi) * (radius * .93 + wave * .6) - .016 + .010 * math.sin(t * 5.8 + phase)))
        return points

    # Each of these primary volumes flows from the crown through the shoulders
    # to its own tapered end. Overlap is wide enough to read as one hairstyle.
    for k in range(9):
        psi = 1.08 + (math.tau - 2.16) * k / 8
        parts.append(_sweep(api, 'Claire continuous primary wave',
                            long_mass(psi, .35 + k * .61, tip=1.052 + .023 * math.sin(k * 1.7)),
                            .035 + .002 * math.sin(k), .015, psi))

    # The side part and face-framing sweeps are continuous all the way down.
    # The eye-height controls stay outside the outer eyelid contour.
    left = [(.025, 1.641, .006), (.015, 1.614, .077), (-.043, 1.591, .105),
            (-.093, 1.540, .104), (-.136, 1.461, .069), (-.147, 1.375, .080),
            (-.126, 1.285, .108), (-.150, 1.195, .108), (-.130, 1.110, .111),
            (-.143, 1.052, .075)]
    right = [(.032, 1.640, .005), (.070, 1.607, .081), (.119, 1.548, .094),
             (.145, 1.465, .066), (.154, 1.387, .075), (.133, 1.297, .108),
             (.150, 1.209, .110), (.134, 1.132, .101), (.148, 1.078, .068)]
    for side, points in ((-1, left), (1, right)):
        parts.append(_sweep(api, 'Claire parted curtain', points, .030 if side < 0 else .026, .0105,
                            side * .65, steps=52, sides=12))
        # Two shallow overlapping wave ridges add shape without a bundle of rods.
        for k in range(2):
            ridge = [(x + side * (.009 + k * .012) * _smooth(0., .30, i / (len(points) - 1)),
                      y + .002 * k, z + .007 - k * .002) for i, (x, y, z) in enumerate(points)]
            parts.append(_sweep(api, 'Claire curtain secondary fold', ridge, .012 - k * .001,
                                .0045, side * .65, steps=36, sides=8))

    for k, psi in enumerate((1.65, 2.40, 3.10, 3.85, 4.55)):
        parts.append(_sweep(api, 'Claire overlapping back wave',
                            long_mass(psi, .2 + k * .75, .006, 1.080 + .012 * math.sin(k)),
                            .016, .005, psi, steps=36, sides=8))
    for part in parts:
        part['bone'] = 'head'
    return parts


def _check():
    triangles = 0
    def record(name, vertices, faces, mat, uv):
        nonlocal triangles
        assert vertices and faces and len(uv) == len(vertices), name
        assert all(math.isfinite(v) for p in vertices for v in p), name
        assert all(0 <= i < len(vertices) for face in faces for i in face), name
        assert all(.98 < p[1] < 1.68 and abs(p[0]) < .23 and abs(p[2]) < .23 for p in vertices), name
        triangles += sum(len(face) - 2 for face in faces)
        return {}
    def scalp(psi, el, extra=0):
        return ((.133 + extra) * math.cos(el) * math.sin(psi),
                1.485 + (.166 + extra) * math.sin(el),
                (.119 + extra) * math.cos(el) * math.cos(psi))
    parts = author_claire_hair({'mesh': record, 'scalp': scalp, 'mat': None})
    assert all(p['bone'] == 'head' for p in parts)
    assert triangles <= 18000, triangles
    print(f'Claire hair: {len(parts)} meshes, {triangles} source triangles; finite/index/bounds checks passed')


if __name__ == '__main__':
    _check()
