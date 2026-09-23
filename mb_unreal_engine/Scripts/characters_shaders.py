"""Character master materials (Agent A). Imported by characters_materials.py; not run on its own.



Masters live in /Game/MapleBean/Characters/Shared/Materials and are rebuilt in place on every run

(expressions cleared, graph re-made), so instances keep their parent reference.



  M_MB_Character_Skin   default lit: saturation lift (keeps painted blush), warm grazing tint, soft roughness

  M_MB_Character_Hair   fake Kajiya-Kay: two shifted bands along a "strand runs downward" tangent that scale the

                        hair's own colour (dark hair stays dark),

                        plus stretched noise for strand-to-strand colour variation

  M_MB_Character_Eye    clear-coat: glossy low-roughness film over the painted iris atlas

  M_MB_Character_Cloth  fabric sheen + denim fix (blue-dominant texels re-coloured toward light wash blue)

All are two-sided (hair ribbons / lashes are single sheets) and opt in to skeletal mesh + morph targets.

"""

import unreal



DIR = "/Game/MapleBean/Characters/Shared/Materials"

MEL = unreal.MaterialEditingLibrary

at = unreal.AssetToolsHelpers.get_asset_tools()

eal = unreal.EditorAssetLibrary

WHITE = "/Engine/EngineResources/WhiteSquareTexture"

FLAT_N = "/Engine/EngineMaterials/DefaultNormal"

P = unreal.MaterialProperty





class G:

    """Tiny graph helper: g.node(cls, **props), g.link(src, dst, pin), g.out(src, prop)."""



    def __init__(self, m):

        self.m, self.y = m, 0



    def node(self, cls, x=-600, **props):

        self.y += 90

        n = MEL.create_material_expression(self.m, cls, x, self.y)

        for k, v in props.items():

            n.set_editor_property(k, v)

        return n



    def link(self, src, dst, pin="", out=""):

        MEL.connect_material_expressions(src, out, dst, pin)



    def out(self, src, prop, out=""):

        MEL.connect_material_property(src, out, prop)



    # ---- parameters

    def scalar(self, name, v):

        return self.node(unreal.MaterialExpressionScalarParameter, -1400, parameter_name=name, default_value=v)



    def vec(self, name, rgb):

        return self.node(unreal.MaterialExpressionVectorParameter, -1400, parameter_name=name,

                         default_value=unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1))



    def tex(self, name, default=WHITE, normal=False, uv=None):

        n = self.node(unreal.MaterialExpressionTextureSampleParameter2D, -1200, parameter_name=name,

                      texture=unreal.load_asset(default))

        if normal:

            n.set_editor_property("sampler_type", unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)

        if uv is not None:

            self.link(uv, n, "UVs")

        return n



    # ---- math

    def op(self, cls, a, b=None, pa="A", pb="B", oa="", ob=""):

        n = self.node(cls, -400)

        self.link(a, n, pa, oa)

        if b is not None:

            self.link(b, n, pb, ob)

        return n



    def mul(self, a, b, oa="", ob=""):

        return self.op(unreal.MaterialExpressionMultiply, a, b, oa=oa, ob=ob)



    def add(self, a, b):

        return self.op(unreal.MaterialExpressionAdd, a, b)



    def sub(self, a, b, oa="", ob=""):

        return self.op(unreal.MaterialExpressionSubtract, a, b, oa=oa, ob=ob)



    def lerp(self, a, b, t):

        n = self.op(unreal.MaterialExpressionLinearInterpolate, a, b)

        self.link(t, n, "Alpha")

        return n



    def dot(self, a, b):

        return self.op(unreal.MaterialExpressionDotProduct, a, b)



    def norm(self, a):

        return self.op(unreal.MaterialExpressionNormalize, a, pa="VectorInput")



    def one(self, fn, a, oa=""):

        return self.op(fn, a, pa="", oa=oa)



    def const(self, v):

        return self.node(unreal.MaterialExpressionConstant, -800, r=v)



    def const3(self, rgb):

        return self.node(unreal.MaterialExpressionConstant3Vector, -800,

                         constant=unreal.LinearColor(rgb[0], rgb[1], rgb[2], 1))



    def mask(self, a, ch, oa=""):

        n = self.node(unreal.MaterialExpressionComponentMask, -600, **{c: (c in ch) for c in "rgba"})

        self.link(a, n, "", oa)

        return n





def _prepare(name, shading=None):

    path = f"{DIR}/{name}"

    if eal.does_asset_exist(path):

        m = unreal.load_asset(path)

        MEL.delete_all_material_expressions(m)

    else:

        m = at.create_asset(name, DIR, unreal.Material, unreal.MaterialFactoryNew())

    m.set_editor_property("used_with_skeletal_mesh", True)

    m.set_editor_property("used_with_morph_targets", True)

    m.set_editor_property("two_sided", True)

    m.set_editor_property("shading_model", shading or unreal.MaterialShadingModel.MSM_DEFAULT_LIT)

    return m, G(m)





def _finish(m):

    MEL.recompile_material(m)

    eal.save_loaded_asset(m)

    unreal.log(f"[MapleBean] characters: built {m.get_name()}")

    return m





def _base(g, normal=True):

    """BaseTexture * Tint (+ optional tangent-space NormalTexture blended by NormalStrength). Returns (uv, colour)."""

    uv = g.node(unreal.MaterialExpressionTextureCoordinate, -1600)

    tex = g.tex("BaseTexture", uv=uv)

    col = g.mul(tex, g.vec("Tint", (1, 1, 1)), oa="RGB")

    if normal:

        nt = g.tex("NormalTexture", FLAT_N, normal=True, uv=uv)

        g.out(g.lerp(g.const3((0, 0, 1)), g.mask(nt, "rgb", oa="RGB"), g.scalar("NormalStrength", 0.5)), P.MP_NORMAL)

    return uv, col





def _fresnel(g, exponent):

    return g.node(unreal.MaterialExpressionFresnel, -800, exponent=exponent, base_reflect_fraction=0.0)





def _pbr(g, rough, spec, metal=0.0):

    g.out(g.scalar("Roughness", rough), P.MP_ROUGHNESS)

    g.out(g.scalar("Specular", spec), P.MP_SPECULAR)

    g.out(g.scalar("Metallic", metal), P.MP_METALLIC)





def build_skin():

    """Default lit (pre-integrated skin washed the faces out to chalk under the café sun). Warmth comes from

    a saturation lift on the painted skin (keeps its blush) and a darker warm tint at grazing angles."""

    m, g = _prepare("M_MB_Character_Skin")

    _, col = _base(g, normal=False)

    lum = g.dot(col, g.const3((0.2126, 0.7152, 0.0722)))

    sat = g.lerp(lum, col, g.scalar("Saturation", 1.18))

    rim = g.mul(_fresnel(g, 3.0), g.scalar("WarmRim", 0.3))

    warm = g.lerp(g.vec("WarmBias", (1.0, 0.94, 0.9)), g.vec("WarmTint", (0.95, 0.62, 0.52)), rim)

    # Baked contact AO (vertex colour from characters_blender_v2.bake_face_ao; white where absent).
    ao = g.lerp(g.const3((1, 1, 1)), g.mask(g.node(unreal.MaterialExpressionVertexColor, -1600), "rgb"),
                g.scalar("AOStrength", 1.0))
    g.out(g.mul(g.mul(g.mul(sat, warm), ao), g.scalar("SkinGain", 0.9)), P.MP_BASE_COLOR)
    g.out(g.mask(g.node(unreal.MaterialExpressionVertexColor, -1600), "r"), P.MP_AMBIENT_OCCLUSION)

    g.out(g.scalar("Roughness", 0.6), P.MP_ROUGHNESS)

    g.out(g.scalar("Specular", 0.3), P.MP_SPECULAR)

    return _finish(m)





def build_hair():

    m, g = _prepare("M_MB_Character_Hair")

    uv, col = _base(g)

    # Strand-to-strand variation: noise stretched along Z (strands mostly hang), in object-relative space.

    rel = g.sub(g.node(unreal.MaterialExpressionWorldPosition, -1600),

                g.node(unreal.MaterialExpressionObjectPositionWS, -1600))

    stretched = g.mul(rel, g.const3((1.0, 1.0, 0.18)))

    noise = g.node(unreal.MaterialExpressionNoise, -800, scale=0.35, levels=2, output_min=0.0, output_max=1.0)

    g.link(stretched, noise, "Position")

    var = g.lerp(g.scalar("VariationLow", 0.82), g.scalar("VariationHigh", 1.08), noise)

    albedo = g.mul(g.mul(col, var), g.scalar("HairGain", 0.8))

    # Tangent T = world-down projected onto the surface; shifted along N per strand (noise) so bands break up.

    n = g.node(unreal.MaterialExpressionVertexNormalWS, -1600)

    down = g.const3((0, 0, -1))

    t0 = g.norm(g.sub(down, g.mul(n, g.dot(n, down))))

    v = g.node(unreal.MaterialExpressionCameraVectorWS, -1600)

    h = g.norm(g.add(v, g.norm(g.vec("KeyLightDir", (0.3, 0.5, 0.8)))))

    jitter = g.mul(g.sub(noise, g.const(0.5)), g.scalar("ShiftJitter", 0.35))



    def band(shift_name, shift, exp_name, exp):

        t = g.norm(g.add(t0, g.mul(n, g.add(g.scalar(shift_name, shift), jitter))))

        th = g.dot(t, h)

        sin_th = g.one(unreal.MaterialExpressionSquareRoot,

                       g.one(unreal.MaterialExpressionSaturate, g.sub(g.const(1.0), g.mul(th, th))))

        p = g.op(unreal.MaterialExpressionPower, sin_th, g.scalar(exp_name, exp), pa="Base", pb="Exponent")

        return p



    b1 = band("PrimaryShift", 0.08, "PrimaryExponent", 90.0)

    b2 = band("SecondaryShift", -0.12, "SecondaryExponent", 18.0)

    # Highlights scale the hair's own colour (never a fixed additive colour: dark hair must stay dark).

    hl1 = g.mul(g.mul(b1, g.mul(albedo, g.vec("HighlightColor", (1.3, 1.2, 1.05)))), g.scalar("HighlightStrength", 0.9))

    hl2 = g.mul(g.mul(b2, albedo), g.scalar("SecondaryStrength", 0.2))

    g.out(g.one(unreal.MaterialExpressionSaturate, g.add(g.add(albedo, hl1), hl2)), P.MP_BASE_COLOR)

    g.out(g.lerp(g.scalar("Roughness", 0.6), g.scalar("BandRoughness", 0.42), b1), P.MP_ROUGHNESS)

    g.out(g.scalar("Specular", 0.3), P.MP_SPECULAR)

    g.out(g.scalar("Metallic", 0.0), P.MP_METALLIC)

    return _finish(m)





def _prop(*names):

    for n in names:

        if hasattr(P, n):

            return getattr(P, n)

    return None





def build_eye():

    """Clear coat when the enum pins are exposed to Python; otherwise a glossy default-lit fallback."""

    cc, ccr = _prop("MP_CUSTOM_DATA0", "MP_CUSTOM_DATA_0", "MP_CLEAR_COAT"), _prop(

        "MP_CUSTOM_DATA1", "MP_CUSTOM_DATA_1", "MP_CLEAR_COAT_ROUGHNESS")

    unreal.log(f"[MapleBean] characters: eye clear coat pins {cc} {ccr}; "

               f"{[n for n in dir(P) if n.startswith('MP_')]}")

    shading = unreal.MaterialShadingModel.MSM_CLEAR_COAT if cc and ccr else None

    m, g = _prepare("M_MB_Character_Eye", shading)

    _, col = _base(g, normal=False)

    g.out(g.mul(col, g.scalar("Brightness", 1.08)), P.MP_BASE_COLOR)

    if shading:

        _pbr(g, 0.22, 0.6)

        g.out(g.scalar("ClearCoat", 1.0), cc)

        g.out(g.scalar("ClearCoatRoughness", 0.03), ccr)

    else:

        _pbr(g, 0.06, 0.75)

    return _finish(m)





def build_cloth():

    m, g = _prepare("M_MB_Character_Cloth")

    _, col = _base(g)

    # Denim: texels whose blue clearly beats red are re-coloured to DenimColor, keeping their relative

    # luminance (stitching, seams, wash gradient). Whites, creams, greens and charcoals have B - R ~ 0.

    r = g.mask(col, "r")

    b = g.mask(col, "b")

    dmask = g.one(unreal.MaterialExpressionSaturate,

                  g.sub(g.mul(g.sub(b, r), g.scalar("DenimMaskGain", 10.0)), g.const(0.3)))

    lum = g.dot(col, g.const3((0.2126, 0.7152, 0.0722)))

    ratio = g.op(unreal.MaterialExpressionDivide, lum, g.scalar("DenimRefLum", 0.16))

    denim = g.mul(g.vec("DenimColor", (0.27, 0.46, 0.8)), ratio)

    fixed0 = g.lerp(col, denim, g.mul(dmask, g.scalar("DenimAmount", 1.0)))
    flum = g.dot(fixed0, g.const3((0.2126, 0.7152, 0.0722)))
    fixed = g.lerp(flum, fixed0, g.scalar("Saturation", 1.15))  # mood-board saturation

    # Fabric sheen: soft brightening at grazing angles.

    sheen = g.add(g.const(1.0), g.mul(_fresnel(g, 2.5), g.scalar("Sheen", 0.18)))

    g.out(g.one(unreal.MaterialExpressionSaturate, g.mul(fixed, sheen)), P.MP_BASE_COLOR)

    _pbr(g, 0.85, 0.35)

    return _finish(m)





def build_all():

    return {"skin": build_skin(), "hair": build_hair(), "eye": build_eye(), "cloth": build_cloth()}

