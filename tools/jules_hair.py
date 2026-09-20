"""Jules's short men's cut: a tight tapered fade with a textured crop on top.

The hairline sits well above the brows, the ears stay clear and the nape is
short, so the silhouette reads clearly masculine from every angle.
"""
import math


def author_jules_hair(api):
    mesh, lock, scalp, mat = (api[k] for k in ('mesh', 'lock', 'scalp', 'mat'))
    parts = []
    tau = math.tau

    def edge(psi):
        p = math.atan2(math.sin(psi), math.cos(psi))
        front = max(0, math.cos(p))
        back = max(0, -math.cos(p)) ** 1.2
        ear = math.exp(-((abs(p) - 1.62) / .28) ** 2)
        burn = math.exp(-((abs(p) - 1.18) / .12) ** 2)
        # Squared front hairline, cleared ears with short sideburns, and a nape
        # that follows the back of the head down like a real short cut.
        return -.14 - .52 * back + .78 * front ** 1.6 + .38 * ear - .10 * burn

    def volume(psi, el):
        top = max(0, math.sin(el)) ** 1.5
        fade = min(1, max(0, (el - edge(psi)) / .5))           # tight at the edge
        texture = .0026 * math.sin(psi * 23) * math.sin(el * 19) * top
        return .0010 + .0165 * top * fade + .0025 * fade + texture

    vs, faces, uv = [], [], []
    rows, cols = 22, 72
    for i in range(rows + 1):
        t = i / rows
        for j in range(cols):
            psi = j / cols * tau
            el = edge(psi) + (math.pi / 2 - edge(psi)) * t
            vs.append(scalp(psi, el, volume(psi, el)))
            uv.append((j / cols * 4, t))
    for i in range(rows):
        for j in range(cols):
            a = i * cols + j
            b = i * cols + (j + 1) % cols
            faces.append((a, b, b + cols, a + cols))
    parts.append(mesh('Jules tapered crop', vs, faces, mat, uv))

    # A few short forward-swept pieces give the crop texture on top only; each
    # stays seated on the cap and ends behind the hairline.
    for k in range(7):
        psi = -.62 + k * .205
        points = []
        for j in range(6):
            t = j / 5
            el = 1.30 - (1.30 - (edge(psi) + .16)) * t
            lift = volume(psi, el) + .0035 * math.sin(t * math.pi)
            points.append(scalp(psi + .05 * math.sin(k * 1.3) * t, el, lift))
        parts.append(lock('Jules textured top piece', points, .021, .0055, mat, 18, 8))
    for part in parts:
        part['bone'] = 'head'
    return parts
