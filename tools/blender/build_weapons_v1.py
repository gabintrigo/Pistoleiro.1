"""First-person weapon models (also used in enemies' hands): bevelled primitives, baked AO in vertex colours, named
materials, origin at the receiver, barrel towards -Z, +Z towards the shooter. Exports body + detachable 'mag' + 'tip'/'eject' empties.
Usage: python build_weapons.py <out_dir> [id,id,...]   (CC0)"""
import bpy, sys, os, math
args=[a for a in sys.argv[1:] if not a.endswith('.py')];OUT=args[0];ONLY=args[1].split(',') if len(args)>1 else None;os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=24
log=lambda *a:print('[wpn]',*a,flush=True)
MATS={};DUMMY=None
def mat(name):
    global DUMMY
    if name in MATS: return MATS[name]
    m=bpy.data.materials.new(name);m.use_nodes=True;MATS[name]=m
    if DUMMY is None: DUMMY=bpy.data.images.new('dummy_uv',2,2);DUMMY.pixels=[1,1,1,1]*4
    nt=m.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=DUMMY;uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map='UVMap';nt.links.new(uv.outputs['UV'],tex.inputs['Vector']);nt.links.new(tex.outputs['Color'],nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m
# game coords (x right, y up, z back); helper z is negated on export
def box(w,h,d,x,y,z,m,bev=0.004,segs=2,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.scale=(w,d,h);o.location=(x,-z,y);o.rotation_euler=(math.radians(rot[0]),math.radians(-rot[2]),math.radians(rot[1]))
    bpy.ops.object.transform_apply(scale=True,rotation=True);o.data.materials.append(mat(m))
    if bev>0:
        b=o.modifiers.new('bev','BEVEL');b.width=min(bev,min(w,h,d)*0.3);b.segments=segs;b.limit_method='ANGLE';b.angle_limit=math.radians(40)
    return o
def cylz(r,l,x,y,z,m,n=14):   # cylinder along z (barrels, tubes)
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=l,vertices=n);o=bpy.context.object;o.location=(x,-z,y);o.rotation_euler=(math.radians(90),0,0)
    bpy.ops.object.transform_apply(rotation=True);o.data.materials.append(mat(m));return o
def cylx(r,l,x,y,z,m,n=12):   # cylinder along x (bolt handles, pins)
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=l,vertices=n);o=bpy.context.object;o.location=(x,-z,y);o.rotation_euler=(0,math.radians(90),0)
    bpy.ops.object.transform_apply(rotation=True);o.data.materials.append(mat(m));return o
def cyly(r,l,x,y,z,m,n=12):   # vertical cylinder
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=l,vertices=n);o=bpy.context.object;o.location=(x,-z,y);o.data.materials.append(mat(m));return o
def project_uvs(o):
    me=o.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    uv=me.uv_layers.active.data
    for p in me.polygons:
        n=p.normal;ax=max(range(3),key=lambda i:abs(n[i]));a,b=[(1,2),(0,2),(0,1)][ax]
        for li,vi in zip(p.loop_indices,p.vertices): c=me.vertices[vi].co;uv[li].uv=(c[a]*4,c[b]*4)
def join(name,objs,smooth=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    for o in objs:
        bpy.context.view_layer.objects.active=o
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    o=bpy.context.object;o.name=name;o.data.name=name
    for p in o.data.polygons: p.use_smooth=smooth
    project_uvs(o)
    ca=o.data.color_attributes.new('Col','BYTE_COLOR','CORNER');o.data.color_attributes.active_color=ca
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    sc.render.bake.target='VERTEX_COLORS'
    try: bpy.ops.object.bake(type='AO',use_clear=True)
    except Exception as e: log('AO bake failed',name,e)
    return o
def empty(name,x,y,z):
    e=bpy.data.objects.new(name,None);sc.collection.objects.link(e);e.location=(x,-z,y);return e
def export(name,objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    path=os.path.join(OUT,name+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_image_format='NONE',export_vertex_color='ACTIVE',export_yup=True,export_normals=True,export_texcoords=True,export_animations=False,export_extras=False)
    tris=sum(len(o.data.polygons) for o in objs if o.type=='MESH');log(name,'tris',tris,'bytes',os.path.getsize(path))
    for o in list(sc.collection.objects): bpy.data.objects.remove(o,do_unlink=True)
M,P,W,T,G='gun_metal','gun_polymer','gun_wood','gun_tan','gun_glass'
def w_ar():
    b=[box(0.075,0.13,0.5,0,0,0,M),box(0.04,0.03,0.42,0,0.085,-0.05,M),box(0.085,0.11,0.34,0,-0.005,-0.41,P),cylz(0.018,0.5,0,0.03,-0.8,M),cylz(0.028,0.09,0,0.03,-1.06,M),
       box(0.03,0.07,0.03,0,0.12,-0.55,M),box(0.05,0.06,0.06,0,0.115,0.1,M),box(0.055,0.13,0.075,0,-0.14,0.18,P,rot=(15,0,0)),box(0.06,0.1,0.3,0,-0.02,0.5,P),box(0.065,0.12,0.03,0,-0.02,0.66,P),
       cylx(0.012,0.05,0.045,0.03,0.08,M),box(0.02,0.05,0.09,0.04,0.0,-0.06,M),box(0.03,0.03,0.05,0,-0.075,-0.1,M)]
    mag=join('mag',[box(0.05,0.2,0.09,0,-0.16,-0.02,M,rot=(-8,0,0)),box(0.052,0.02,0.092,0,-0.265,-0.03,P)])
    return join('body',b),mag,(0,0.03,-1.11),(0.06,0.03,-0.06)
def w_smg():
    b=[box(0.07,0.12,0.4,0,0,0,P),box(0.055,0.06,0.2,0,0.02,-0.3,M),cylz(0.015,0.2,0,0.03,-0.5,M),box(0.045,0.025,0.3,0,0.075,-0.1,M),box(0.03,0.05,0.03,0,0.11,-0.02,M),box(0.03,0.05,0.03,0,0.11,-0.36,M),
       box(0.05,0.12,0.07,0,-0.12,0.14,P,rot=(12,0,0)),box(0.02,0.02,0.3,0.03,0.0,0.35,M),box(0.02,0.02,0.3,-0.03,0.0,0.35,M),box(0.06,0.08,0.03,0,0.0,0.5,P),box(0.06,0.11,0.06,0,-0.12,-0.3,P)]
    mag=join('mag',[box(0.045,0.26,0.06,0,-0.19,-0.02,M),box(0.047,0.02,0.062,0,-0.325,-0.02,P)])
    return join('body',b),mag,(0,0.03,-0.61),(0.05,0.02,-0.02)
def w_shotgun():
    b=[box(0.08,0.13,0.36,0,0,0.05,M),cylz(0.024,0.7,0,0.03,-0.6,M),cylz(0.02,0.6,0,-0.04,-0.55,M),box(0.07,0.09,0.22,0,-0.02,-0.5,W,bev=0.008),box(0.02,0.03,0.02,0,0.065,-0.93,M),
       box(0.07,0.12,0.12,0,-0.12,0.18,W,bev=0.008),box(0.08,0.11,0.32,0,-0.02,0.36,W,bev=0.01),box(0.085,0.12,0.03,0,-0.02,0.53,P),box(0.04,0.05,0.08,0,-0.075,0.0,M),cylx(0.01,0.09,0.0,0.0,0.0,M)]
    return join('body',b),None,(0,0.03,-0.96),(0.05,0.0,0.02)
def w_sniper():
    b=[box(0.07,0.11,0.55,0,0,0.08,M),cylz(0.02,0.95,0,0.02,-0.78,M),cylz(0.03,0.1,0,0.02,-1.24,M),cylz(0.038,0.32,0,0.14,-0.05,M,n=18),cylz(0.045,0.05,0,0.14,-0.22,M,n=18),cylz(0.041,0.05,0,0.14,0.12,M,n=18),
       cylz(0.035,0.01,0,0.14,-0.245,G,n=18),cylz(0.03,0.01,0,0.14,0.145,G,n=18),box(0.03,0.08,0.03,0,0.075,-0.05,M),box(0.03,0.08,0.03,0,0.075,0.02,M),cylx(0.01,0.07,0.06,0.02,0.12,M),cyly(0.014,0.02,0.09,0.02,0.12,M),
       box(0.07,0.1,0.36,0,-0.01,0.42,T,bev=0.008),box(0.07,0.1,0.1,0,-0.12,0.2,T,bev=0.008),box(0.075,0.12,0.03,0,-0.01,0.6,P),box(0.015,0.2,0.015,0.06,-0.12,-0.75,M,rot=(0,0,-12)),box(0.015,0.2,0.015,-0.06,-0.12,-0.75,M,rot=(0,0,12))]
    mag=join('mag',[box(0.05,0.12,0.08,0,-0.11,0.0,M)])
    return join('body',b),mag,(0,0.02,-1.3),(0.06,0.03,0.0)
def w_lmg():
    b=[box(0.1,0.16,0.6,0,0,0,M),cylz(0.024,0.6,0,0.04,-0.82,M),box(0.06,0.05,0.5,0,0.075,-0.5,M),box(0.05,0.05,0.2,0,0.14,-0.1,M),box(0.03,0.06,0.03,0,0.12,-0.6,M),
       box(0.07,0.12,0.12,0,-0.14,0.2,P,rot=(12,0,0)),box(0.08,0.11,0.3,0,-0.02,0.38,P),box(0.085,0.12,0.03,0,-0.02,0.54,P),box(0.02,0.22,0.02,0.07,-0.13,-0.75,M,rot=(0,0,-14)),box(0.02,0.22,0.02,-0.07,-0.13,-0.75,M,rot=(0,0,14)),box(0.02,0.05,0.09,0.05,0.02,0.06,M)]
    mag=join('mag',[box(0.12,0.14,0.16,-0.1,-0.1,-0.05,T,bev=0.008),box(0.06,0.03,0.12,-0.1,-0.03,-0.05,M)])
    return join('body',b),mag,(0,0.04,-1.13),(0.07,0.0,-0.1)
def w_pistol():
    b=[box(0.06,0.075,0.28,0,0.02,-0.06,M),box(0.055,0.06,0.2,0,-0.03,-0.02,P),box(0.05,0.15,0.08,0,-0.12,0.1,P,rot=(14,0,0)),box(0.02,0.05,0.02,0,0.065,-0.18,M),box(0.02,0.02,0.02,0,0.065,0.06,M),box(0.045,0.02,0.04,0,-0.05,-0.02,M),box(0.04,0.01,0.09,0,-0.065,0.0,M),cylz(0.012,0.04,0,0.02,-0.21,M)]
    mag=join('mag',[box(0.03,0.11,0.05,0,-0.13,0.1,M,rot=(14,0,0)),box(0.032,0.015,0.052,0,-0.2,0.1,P,rot=(14,0,0))])
    return join('body',b),mag,(0,0.02,-0.24),(0.04,0.03,-0.02)
def w_gl():
    b=[cylz(0.05,0.55,0,0.03,-0.42,M,n=16),cylz(0.058,0.06,0,0.03,-0.7,M,n=16),cylz(0.1,0.13,0,-0.01,-0.08,M,n=18),box(0.05,0.05,0.16,0,0.12,-0.3,M),box(0.03,0.06,0.03,0,0.13,-0.62,M),box(0.06,0.15,0.08,0,-0.16,0.0,P,rot=(12,0,0)),box(0.07,0.1,0.28,0,-0.03,0.32,W,bev=0.008),box(0.075,0.11,0.03,0,-0.03,0.47,P),box(0.06,0.05,0.14,0,-0.05,-0.45,P),box(0.08,0.14,0.1,0,0.0,0.12,M)]
    return join('body',b),None,(0,0.03,-0.74),(0.06,0.02,-0.05)
def w_rpg():
    b=[cylz(0.055,1.25,0,0.05,-0.55,T,n=16),cylz(0.085,0.28,0,0.05,-1.2,M,n=16),cylz(0.03,0.14,0,0.05,-1.4,M,n=12),cylz(0.075,0.12,0,0.05,0.12,M,n=16),box(0.05,0.08,0.05,0,-0.02,-0.02,P),box(0.05,0.13,0.06,0,-0.12,0.05,P,rot=(10,0,0)),box(0.05,0.11,0.06,0,-0.11,-0.42,P,rot=(10,0,0)),box(0.04,0.05,0.2,0,0.14,-0.3,M),box(0.05,0.07,0.05,0,0.17,-0.45,G),box(0.02,0.04,0.02,0,0.14,-0.62,M)]
    return join('body',b),None,(0,0.05,-1.47),(0,0,0)
ALL={'ar':w_ar,'smg':w_smg,'shotgun':w_shotgun,'sniper':w_sniper,'lmg':w_lmg,'pistol':w_pistol,'gl':w_gl,'rpg':w_rpg}
for name,fn in ALL.items():
    if ONLY and name not in ONLY: continue
    body,mag,tip,eject=fn();objs=[body];
    if mag: objs.append(mag)
    objs.append(empty('tip',*tip));objs.append(empty('eject',*eject))
    export(name,objs)
log('done')
