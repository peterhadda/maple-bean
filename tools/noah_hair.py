"""Noah's broad tousled masses, built with the production Blender helpers."""
import math


def author_noah_hair(api):
    mesh, lock, scalp, mat = (api[k] for k in ('mesh', 'lock', 'scalp', 'mat'))
    parts = []
    tau = math.tau

    def edge(psi):
        p = math.atan2(math.sin(psi), math.cos(psi))
        front = max(0, math.cos(p))
        ear = math.exp(-((abs(p) - 1.53) / .25) ** 2)
        return -.36 + .78 * front ** 1.15 + .37 * ear + .035 * math.sin(7 * p + .7)

    def volume(psi, el):
        top = max(0, math.sin(el))
        # Wide irregular ridges belong to the primary mass, so there are no
        # scalp holes between the separately sculpted locks.
        ridge = (.5 + .5 * math.cos(9 * psi + 1.7 * el)) ** 3
        return .005 + .010 * top + .009 * ridge * math.cos(el) ** 2

    vs, faces, uv = [], [], []
    rows, cols = 25, 72
    for i in range(rows + 1):
        t = i / rows
        for j in range(cols):
            psi = j / cols * tau
            el = edge(psi) + (math.pi / 2 - edge(psi)) * t
            p = list(scalp(psi + .18 * math.sin(el), el, volume(psi, el)))
            p[0] -= .006 * math.sin(el) ** 4
            p[1] += .004 * math.sin(psi * 3 + 1) * max(0, math.sin(el)) * math.cos(el)
            vs.append(p)
            uv.append((j / cols * 3, t))
    for i in range(rows):
        for j in range(cols):
            a = i * cols + j
            b = i * cols + (j + 1) % cols
            faces.append((a, b, b + cols, a + cols))
    parts.append(mesh('Noah continuous tousled crown', vs, faces, mat, uv))

    # Each broad sweep follows the actual crown surface. Only its tapered
    # end crosses the hairline: raised looping paths leave scalp visible.
    front = [(-1.17,.075,.028),(-.84,.17,.032),(-.50,.27,.036),
             (-.16,.33,.033),(.25,.30,.031),(.63,.21,.033),(1.03,.07,.027)]
    for k, (finish, elevation, width) in enumerate(front):
        points = []
        start = .30 + .11 * (k - 3)
        for j in range(11):
            t = j / 10
            angle = start + (finish-start) * t ** .82 + .13 * math.sin(t*math.pi)
            el = 1.35 - (1.35-elevation) * t
            lift = volume(angle,el) - .005 + .008 * math.sin(t*math.pi)
            points.append(scalp(angle,el,lift))
        parts.append(lock('Noah broad seated forehead sweep',points,width,.0065,mat,30,10))

    # Crown pieces turn sideways and back into the mass; they do not form an
    # upright row of spikes. Roots and most of each ribbon remain seated.
    for k in range(6):
        psi = 1.20 + k * .77
        points = []
        for j in range(8):
            t = j / 7
            el = 1.40 - (.66 + .11 * math.sin(k * 1.9)) * t
            angle = psi - .33 * t + .16 * math.sin(t * math.pi)
            lift = .001 + .018 * math.sin(t * math.pi) + .004 * t
            points.append(scalp(angle, el, lift))
        parts.append(lock('Noah overlapping crown fold', points,
                          .028 + .003 * math.sin(k * 2), .0075, mat, 22, 10))

    # Short broad layered locks break up the side/back outline, with the
    # lowest layer tapering into the nape and leaving the ear bowls visible.
    for side in (-1, 1):
        for k in range(8):
            psi = side * (1.13 + 1.87 * k / 7)
            finish = edge(psi) - .015 + .085 * math.sin(k * 2.1 + side)
            points = []
            for j in range(7):
                t = j / 6
                angle = psi - side * .19 * (1 - t) + side * .07 * math.sin(t * math.pi)
                el = .91 + .06 * math.sin(k * 1.3) - (.91 - finish) * t
                lift = volume(angle,el) - .003 + .006 * math.sin(t * math.pi)
                lift += .004 * math.sin(k * 1.6) * t ** 4
                points.append(scalp(angle, el, lift))
            parts.append(lock('Noah tapered side and nape layer', points,
                              .026 + .003 * math.cos(k * 1.7), .0065, mat, 21, 8))

    # Three shallow, curved accent locks share the underlying volume. The
    # curled tips provide asymmetry without floating hoops above the head.
    for k, (finish, elevation) in enumerate([(-.37,.23),(.55,.17),(-1.03,.03)]):
        points=[]
        for j in range(11):
            t=j/10
            angle=.31+(finish-.31)*t+.11*math.sin(t*math.pi*1.4+k*.3)
            el=1.23-(1.23-elevation)*t
            lift=volume(angle,el)-.001+.007*math.sin(t*math.pi)
            points.append(scalp(angle,el,lift))
        parts.append(lock('Noah shallow sculpted accent curl',points,.012,.0045,mat,26,10))
    for part in parts:
        part['bone'] = 'head'
    return parts


def _check():
    """Run without Blender: validate authored cap and lock inputs."""
    triangles = 0
    class Part(dict):
        pass
    def mesh(name, vertices, faces, mat, uv):
        nonlocal triangles
        assert len(uv) == len(vertices)
        assert all(math.isfinite(x) for p in vertices for x in p)
        assert all(len(f) >= 3 and all(0 <= x < len(vertices) for x in f) for f in faces)
        triangles += sum(len(f) - 2 for f in faces)
        return Part()
    def lock(name, points, width, depth, mat, steps, sides):
        nonlocal triangles
        assert len(points) >= 4 and 0 < depth < width
        assert all(math.isfinite(x) for p in points for x in p)
        assert all(sum((a-b)**2 for a,b in zip(p,q)) > 1e-10 for p,q in zip(points,points[1:]))
        triangles += steps*sides*2 + (sides-2)*2
        return Part()
    def scalp(p,e,x=0):
        return ((.133+x)*math.cos(e)*math.sin(p),1.485+(.166+x)*math.sin(e),(.119+x)*math.cos(e)*math.cos(p))
    parts = author_noah_hair(dict(mesh=mesh,lock=lock,scalp=scalp,mat=None))
    assert all(p['bone'] == 'head' for p in parts)
    assert triangles < 18000, triangles
    print(f'Noah hair: {len(parts)} pieces, at most {triangles} triangles; finite inputs and valid cap faces.')


if __name__ == '__main__':
    _check()
