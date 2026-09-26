"""Author stadium/prop modules in Blender (bevels, baked AO in vertex colours, named PBR materials), export GLBs. CC0.
Usage: python build_modules.py <out_dir> [module,module,...]"""
import bpy, sys, os, math, time, bmesh
args=[a for a in sys.argv[1:] if not a.endswith('.py')];OUT=args[0];ONLY=args[1].split(',') if len(args)>1 else None;os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=16
log=lambda *a:print('[mod]',*a,flush=True)
MATS={}
DUMMY=None
def mat(name):
    global DUMMY
    if name in MATS: return MATS[name]
    m=bpy.data.materials.new(name);m.use_nodes=True;MATS[name]=m
    # a linked image texture node forces the exporter to keep the UV map (textures are assigned at runtime)
    if DUMMY is None:
        DUMMY=bpy.data.images.new('dummy_uv',2,2);DUMMY.pixels=[1,1,1,1]*4
    nt=m.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=DUMMY;uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map='UVMap';nt.links.new(uv.outputs['UV'],tex.inputs['Vector']);nt.links.new(tex.outputs['Color'],nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m
def obj_from_mesh(name,me): o=bpy.data.objects.new(name,me);sc.collection.objects.link(o);return o
def box(w,h,d,pos=(0,0,0),m='concrete',bevel=0.02,rot=(0,0,0),segs=2):
    bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.scale=(w,d,h);o.location=(pos[0],pos[2],pos[1]);o.rotation_euler=(rot[0],rot[2],rot[1])
    bpy.ops.object.transform_apply(scale=True,rotation=True);o.data.materials.append(mat(m))
    if bevel>0:
        b=o.modifiers.new('bev','BEVEL');b.width=min(bevel,min(w,h,d)*0.3);b.segments=segs;b.limit_method='ANGLE';b.angle_limit=math.radians(40)
    return o
def cyl(r,h,pos=(0,0,0),m='metal_painted',axis='y',n=16,bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=h,vertices=n);o=bpy.context.object;o.location=(pos[0],pos[2],pos[1])
    if axis=='x': o.rotation_euler=(0,math.radians(90),0)
    elif axis=='z': o.rotation_euler=(math.radians(90),0,0)
    bpy.ops.object.transform_apply(rotation=True);o.data.materials.append(mat(m))
    if bevel>0:
        b=o.modifiers.new('bev','BEVEL');b.width=bevel;b.segments=2;b.limit_method='ANGLE'
    return o
def plane(w,h,pos,m,rot=(0,0,0)):
    bpy.ops.mesh.primitive_plane_add(size=1);o=bpy.context.object;o.scale=(w,h,1);o.location=(pos[0],pos[2],pos[1]);o.rotation_euler=(rot[0],rot[2],rot[1]);bpy.ops.object.transform_apply(scale=True,rotation=True);o.data.materials.append(mat(m));return o
def project_uvs(o,mode,tile=1.0):
    """tile: world-space box projection (1 repeat per `tile` metres); face: each face mapped to 0..1 by its own bounds"""
    me=o.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    uv=me.uv_layers.active.data
    for p in me.polygons:
        n=p.normal;ax=max(range(3),key=lambda i:abs(n[i]));a,b=[(1,2),(0,2),(0,1)][ax]
        if mode=='face':
            cs=[me.vertices[v].co for v in p.vertices];mn_a=min(c[a] for c in cs);mx_a=max(c[a] for c in cs);mn_b=min(c[b] for c in cs);mx_b=max(c[b] for c in cs)
            for li,vi in zip(p.loop_indices,p.vertices):
                c=me.vertices[vi].co;uv[li].uv=((c[a]-mn_a)/max(1e-6,mx_a-mn_a),(c[b]-mn_b)/max(1e-6,mx_b-mn_b))
        else:
            for li,vi in zip(p.loop_indices,p.vertices):
                c=me.vertices[vi].co;uv[li].uv=(c[a]/tile,c[b]/tile)
def finish(name,objs,ao=True,subdiv=0,smooth=False,uv='tile'):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    for o in objs:
        bpy.context.view_layer.objects.active=o
        for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    o=bpy.context.object;o.name=name
    if subdiv:
        sd=o.modifiers.new('sd','SUBSURF');sd.subdivision_type='SIMPLE';sd.levels=subdiv;bpy.ops.object.modifier_apply(modifier='sd')
    for p in o.data.polygons: p.use_smooth=smooth
    project_uvs(o,uv)
    if ao:
        ca=o.data.color_attributes.new('Col','BYTE_COLOR','CORNER');o.data.color_attributes.active_color=ca
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        sc.render.bake.target='VERTEX_COLORS'
        try: bpy.ops.object.bake(type='AO',use_clear=True)
        except Exception as e: log('AO bake failed',name,e)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    path=os.path.join(OUT,name+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_image_format='NONE',export_vertex_color='ACTIVE',export_yup=True,export_normals=True,export_texcoords=True)
    tris=sum(len(p.vertices)-2 for p in o.data.polygons)
    log(name,'tris',tris,'bytes',os.path.getsize(path))
    bpy.data.objects.remove(o,do_unlink=True)
# ---------------- modules ----------------
MODS={}
def register(name,fn): MODS[name]=fn
def m_tier():
    return finish('tier',[box(4,0.85,1.1,(0,0.425,0),'concrete',0.03,segs=1),box(4,0.06,0.16,(0,0.88,-0.47),'concrete',0.01,segs=1)],subdiv=0)
def m_seat():
    pan=box(0.44,0.05,0.42,(0,0.42,0),'plastic',0.02,segs=1);back=box(0.44,0.4,0.05,(0,0.63,0.19),'plastic',0.02,segs=1);back.rotation_euler=(math.radians(-8),0,0)
    br1=box(0.04,0.42,0.06,(-0.18,0.21,0.14),'metal_painted',0.0);br2=box(0.04,0.42,0.06,(0.18,0.21,0.14),'metal_painted',0.0)
    return finish('seat',[pan,back,br1,br2])
def m_railing():
    return finish('railing',[cyl(0.03,1.05,(-1.9,0.525,0),'metal_painted','y',10),cyl(0.03,1.05,(1.9,0.525,0),'metal_painted','y',10),cyl(0.03,1.05,(0,0.525,0),'metal_painted','y',10),cyl(0.025,4,(0,1.05,0),'metal_painted','x',10),cyl(0.02,4,(0,0.55,0),'metal_painted','x',10)],ao=False,smooth=True)
def m_wall():
    return finish('wall',[box(4,1.1,0.25,(0,0.55,0),'concrete',0.02,segs=1),box(4.02,0.08,0.31,(0,1.14,0),'concrete',0.01,segs=1)],subdiv=0)
def m_walkway():
    return finish('walkway',[box(4,0.3,3,(0,0.15,0),'concrete',0.02,segs=1)],subdiv=0)
def m_column():
    return finish('column',[box(1.2,26,1.2,(0,13,0),'concrete',0.04,segs=1)],subdiv=0)
def m_roof():
    return finish('roof',[box(4,0.5,18,(0,0.25,0),'metal_dark',0.03,segs=1),box(4,2.4,0.4,(0,-1.0,-8.8),'metal_dark',0.02,segs=1)],subdiv=0)
def m_mast():
    parts=[box(2.2,44,2.2,(0,22,0),'metal_painted',0.05),box(4,1.2,4,(0,0.6,0),'concrete',0.03),box(10,4.5,0.7,(0,45.5,0),'metal_dark',0.03)]
    for i in range(3):
        for j in range(8): parts.append(box(0.9,1.1,0.25,(-4.2+j*1.2,44.2+i*1.3,-0.5),'lamp',0.01))
    return finish('mast',parts,ao=False)
def m_goal():
    hw=3.66;parts=[cyl(0.06,2.44,(-hw,1.22,0),'goal_white','y',12),cyl(0.06,2.44,(hw,1.22,0),'goal_white','y',12),cyl(0.06,2*hw+0.12,(0,2.5,0),'goal_white','x',12),cyl(0.03,2.44,(-hw,1.22,-2),'goal_white','y',8),cyl(0.03,2.44,(hw,1.22,-2),'goal_white','y',8),cyl(0.03,2*hw,(0,2.44,-2),'goal_white','x',8)]
    return finish('goal',parts,ao=False,smooth=True)
def m_goalnet():
    hw=3.66;parts=[plane(2*hw,2.44,(0,1.22,-2),'net',(math.radians(90),0,0)),plane(2,2.44,(-hw,1.22,-1),'net',(math.radians(90),math.radians(90),0)),plane(2,2.44,(hw,1.22,-1),'net',(math.radians(90),math.radians(90),0)),plane(2*hw,2,(0,2.44,-1),'net')]
    return finish('goalnet',parts,ao=False)
def m_adboard():
    return finish('adboard',[box(4,1.0,0.25,(0,0.5,0),'ads',0.015),box(0.12,1.0,0.5,(-1.7,0.5,0.15),'metal_dark',0.01),box(0.12,1.0,0.5,(1.7,0.5,0.15),'metal_dark',0.01)],ao=False,uv='face')
def m_dugout():
    parts=[box(4,2.2,0.12,(0,1.1,-1.94),'glass',0.01),box(4.2,0.12,2.3,(0,2.26,-0.85),'metal_dark',0.02),box(0.12,2.2,2.3,(2.04,1.1,-0.85),'glass',0.01),box(0.12,2.2,2.3,(-2.04,1.1,-0.85),'glass',0.01),box(3.6,0.1,0.5,(0,0.48,-1.3),'metal_painted',0.01)]
    for i in range(4):
        sx=-1.35+i*0.9;parts.append(box(0.7,0.55,0.12,(sx,0.78,-1.5),'plastic',0.02));parts.append(box(0.7,0.12,0.5,(sx,0.55,-1.3),'plastic',0.02))
    for x in (-2.0,2.0): parts.append(box(0.1,2.2,0.1,(x,1.1,0.3),'metal_dark',0.01))
    return finish('dugout',parts,ao=False)
def m_container():
    parts=[box(4,2.9,4,(0,1.45,0),'corrugated',0.03),box(4.1,0.12,4.1,(0,2.9,0),'metal_dark',0.02),box(4.1,0.12,4.1,(0,0.06,0),'metal_dark',0.02)]
    for x in (-1.95,1.95):
        for z in (-1.95,1.95): parts.append(box(0.16,2.9,0.16,(x,1.45,z),'metal_dark',0.01))
    parts.append(box(0.3,1.1,0.08,(-0.9,1.45,2.03),'metal_dark',0.01));parts.append(box(0.3,1.1,0.08,(0.9,1.45,2.03),'metal_dark',0.01))
    return finish('container',parts,subdiv=1)
def m_crate():
    parts=[box(3.4,1.6,3.4,(0,0.8,0),'crate',0.03)]
    for s in (-1,1):
        parts.append(box(3.5,0.14,0.14,(0,0.1,s*1.68),'crate',0.01));parts.append(box(3.5,0.14,0.14,(0,1.55,s*1.68),'crate',0.01));parts.append(box(0.14,1.6,3.5,(s*1.68,0.8,0),'crate',0.01))
    return finish('crate',parts,uv='face')
def m_barrels():
    parts=[]
    for (x,z,c) in ((-0.55,-0.45,'barrel_a'),(0.55,-0.45,'barrel_b'),(0,0.55,'barrel_c')):
        parts.append(cyl(0.45,1.2,(x,0.6,z),c,'y',20,0.02));parts.append(cyl(0.47,0.06,(x,0.95,z),'metal_dark','y',20));parts.append(cyl(0.47,0.06,(x,0.3,z),'metal_dark','y',20))
    return finish('barrels',parts,ao=False,smooth=True)
def m_sandbags():
    parts=[]
    for l in range(3):
        n=3 if l%2 else 4;off=0.45 if l%2 else 0
        for i in range(n): parts.append(box(0.9,0.32,0.62,(-1.35+i*0.9+off,0.17+l*0.31,0),'burlap',0.09,segs=3))
    return finish('sandbags',parts,smooth=True)
def m_shopcrate():
    parts=[box(2.2,1.3,2.2,(0,0.65,0),'shop_green',0.03),box(2.32,0.16,2.32,(0,1.38,0),'shop_green',0.02),box(2.26,0.1,2.26,(0,0.62,0),'brass',0.01),box(0.12,2.2,0.12,(0,2.3,0),'metal_dark',0.01),box(0.5,0.12,0.5,(0,1.5,0),'brass',0.01)]
    for x in (-1.1,1.1):
        for z in (-1.1,1.1): parts.append(box(0.14,1.3,0.14,(x,0.65,z),'brass',0.01))
    parts.append(plane(1.7,0.85,(0,2.95,0),'shopsign',(math.radians(90),0,0)));parts.append(plane(1.7,0.85,(0,2.95,0),'shopsign',(math.radians(90),math.radians(90),0)))
    return finish('shopcrate',parts,ao=False,uv='face')
def m_cabin():
    return finish('cabin',[box(4,3.2,4,(0,1.6,0),'cabin',0.03),box(4.3,0.2,4.3,(0,3.3,0),'metal_dark',0.02)],subdiv=0,uv='face')
def m_tower():
    """watchtower 3.6x3.6x6 with a caged ladder on the south (+z game) face, cross bracing, corrugated skin and a floodlight (see Grid.addTower)"""
    P=[];B=lambda w,h,d,x,y,z,m,bev=0.02:P.append(box(w,h,d,(x,y,-z),m,bev,segs=1))
    B(3.4,6.0,3.4,0,3.0,0,'corrugated',0.02);B(3.8,0.5,3.8,0,0.25,0,'concrete',0.02)
    for (x,z) in ((-1.75,-1.75),(1.75,-1.75),(-1.75,1.75),(1.75,1.75)): B(0.24,6.2,0.24,x,3.1,z,'metal_dark',0.01)
    for y in (2.0,4.0): B(3.8,0.14,0.14,0,y,-1.8,'metal_dark',0.005);B(3.8,0.14,0.14,0,y,1.8,'metal_dark',0.005);B(0.14,0.14,3.8,-1.8,y,0,'metal_dark',0.005);B(0.14,0.14,3.8,1.8,y,0,'metal_dark',0.005)
    # cross bracing on the west, east and north faces
    for (x,z,ax) in ((-1.85,0,'x'),(1.85,0,'x'),(0,-1.85,'z')):
        for sgn in (-1,1):
            if ax=='x': P.append(box(0.08,6.2,0.08,(x,3.0,0),'metal_dark',0.003,rot=(math.radians(sgn*30),0,0),segs=1))
            else: P.append(box(0.08,6.2,0.08,(0,3.0,-z),'metal_dark',0.003,rot=(0,0,math.radians(sgn*30)),segs=1))
    B(4.0,0.25,4.0,0,6.125,0,'concrete',0.02)
    for (w,d,x,z) in ((4.0,0.2,0,-1.9),(0.2,4.0,-1.9,0),(0.2,4.0,1.9,0),(1.5,0.2,-1.25,1.9),(1.5,0.2,1.25,1.9)): B(w,1.0,d,x,6.75,z,'metal_painted',0.01)
    # ladder with safety cage rings
    for x in (-0.45,0.45): B(0.06,6.6,0.06,x,3.3,1.95,'metal_dark',0.005)
    for k in range(20): P.append(cyl(0.022,0.96,(0,0.45+k*0.3,-1.95),'metal_dark','x',8))
    for k in range(6): B(1.3,0.05,0.05,0,2.2+k*0.7,2.55,'metal_dark',0.004);B(0.05,0.05,0.7,-0.65,2.2+k*0.7,2.2,'metal_dark',0.004);B(0.05,0.05,0.7,0.65,2.2+k*0.7,2.2,'metal_dark',0.004)
    # floodlight mast, flag pole and a sandbag lip on the deck
    B(0.12,2.2,0.12,-1.5,7.2,-1.5,'metal_dark',0.005);B(0.6,0.4,0.25,-1.5,8.3,-1.4,'lamp',0.01)
    B(0.06,2.6,0.06,1.6,7.5,-1.6,'metal_dark',0.004);B(0.9,0.55,0.03,1.15,8.4,-1.6,'ads',0.003)
    B(1.2,2.2,0.08,0,1.1,-1.75,'metal_painted',0.01);B(0.9,0.9,0.08,-1.0,4.2,-1.75,'glass',0.005)
    return finish('tower',P,ao=True,subdiv=0,uv='tile')
def m_lamppost():
    return finish('lamppost',[cyl(0.09,6.5,(0,3.25,0),'metal_dark','y',12),box(0.9,0.12,0.12,(0.4,6.45,0),'metal_dark',0.01),box(0.9,0.5,0.4,(0.85,6.4,0),'lamp',0.02),box(1.2,0.5,0.7,(0.9,0.3,0),'metal_dark',0.02)],ao=False,smooth=True)
def m_cart():
    parts=[box(2.6,0.7,1.5,(0,0.75,0),'cart_white',0.05),box(1.2,0.7,1.4,(-0.5,1.35,0),'cart_white',0.05),box(1.24,0.4,1.44,(-0.5,1.42,0),'glass',0.02),box(1.0,0.6,1.3,(0.6,1.3,0),'cart_white',0.04)]
    for s in (0.76,-0.76): parts.append(box(0.7,0.2,0.04,(0.6,1.3,s),'cross_red',0.005));parts.append(box(0.2,0.7,0.04,(0.6,1.3,s),'cross_red',0.005))
    for (x,z) in ((-0.85,0.8),(0.85,0.8),(-0.85,-0.8),(0.85,-0.8)): parts.append(cyl(0.3,0.26,(x,0.3,z),'rubber','z',16,0.02))
    return finish('cart',parts,smooth=False)
def m_flag():
    return finish('flag',[cyl(0.03,1.5,(0,0.75,0),'goal_white','y',8),box(0.42,0.3,0.03,(0.24,1.33,0),'flag_a',0.005),box(0.42,0.1,0.035,(0.24,1.2,0),'flag_b',0.005)],ao=False,smooth=True)
def m_barrier():
    return finish('barrier',[box(4,0.5,0.62,(0,0.25,0),'concrete',0.03,segs=1),box(4,0.55,0.34,(0,0.77,0),'concrete',0.03,segs=1),box(4.02,0.06,0.36,(0,1.03,0),'concrete',0.01,segs=1),box(4,0.12,0.7,(0,0.06,0),'concrete',0.01,segs=1)],subdiv=0)
def m_bigcrate():
    parts=[box(3.4,1.3,3.4,(0,0.65,0),'crate',0.03),box(3.2,1.3,3.2,(0,1.95,0),'crate',0.03)]
    for s in (-1,1):
        for y in (0.08,1.25,1.4,2.55): parts.append(box(3.5 if y<1.3 else 3.3,0.14,0.14,(0,y,s*(1.68 if y<1.3 else 1.58)),'crate',0.01));parts.append(box(0.14,0.14,3.5 if y<1.3 else 3.3,(s*(1.68 if y<1.3 else 1.58),y,0),'crate',0.01))
    return finish('bigcrate',parts,uv='face')
def m_house():
    # 8x8 m two-storey house matching Grid.addBuilding: game +z (south) = helper -z. Doors: south x -1.1..1.1, west z -0.8..0.8.
    P=[];B=lambda w,h,d,x,y,z,m,bev=0.02:P.append(box(w,h,d,(x,y,-z),m,bev,segs=1))
    W=0.25
    B(8,3,W,0,1.5,-3.875,'concrete');B(W,3,8,3.875,1.5,0,'concrete')
    B(2.9,3,W,-2.55,1.5,3.875,'concrete');B(2.9,3,W,2.55,1.5,3.875,'concrete')
    B(W,3,3.2,-3.875,1.5,-2.4,'concrete');B(W,3,3.2,-3.875,1.5,2.4,'concrete')
    B(8,0.25,6.4,0,3.125,0.8,'concrete');B(2.8,0.25,1.6,2.6,3.125,-3.2,'concrete');B(0.5,0.25,1.6,-3.75,3.125,-3.2,'concrete')
    for (w,d,x,z) in ((8,W,0,-3.875),(8,W,0,3.875),(W,8,-3.875,0),(W,8,3.875,0)): B(w,1.1,d,x,3.8,z,'concrete')
    # corner pilasters, roof ledge, plinth
    for (x,z) in ((-3.9,-3.9),(3.9,-3.9),(-3.9,3.9),(3.9,3.9)): B(0.36,3.35,0.36,x,1.675,z,'concrete',0.02)
    # cornija só à volta do topo das paredes (a chapa inteira tapava a abertura da escada)
    for (w,d,x,z) in ((8.5,0.35,0,-4.075),(8.5,0.35,0,4.075),(0.35,8.5,-4.075,0),(0.35,8.5,4.075,0)): B(w,0.14,d,x,3.32,z,'metal_dark',0.01)
    B(8.3,0.4,8.3,0,0.2,0,'concrete',0.02)
    # guarda à volta da abertura da escada no terraço (lado do terraço, z=-2.4), com postes
    B(4.65,0.05,0.05,-1.15,4.25,-2.4,'metal_dark',0.005);B(4.65,0.05,0.05,-1.15,3.75,-2.4,'metal_dark',0.005)
    for k in range(6): B(0.06,1.0,0.06,-3.45+k*0.92,3.75,-2.4,'metal_dark',0.005)
    # door frames + lintels + corrugated awning over the south door
    B(0.14,3,0.4,-1.17,1.5,3.85,'metal_dark',0.01);B(0.14,3,0.4,1.17,1.5,3.85,'metal_dark',0.01);B(2.5,0.16,0.4,0,2.92,3.85,'metal_dark',0.01)
    B(0.4,3,0.14,-3.85,1.5,-0.87,'metal_dark',0.01);B(0.4,3,0.14,-3.85,1.5,0.87,'metal_dark',0.01);B(0.4,0.16,1.9,-3.85,2.92,0,'metal_dark',0.01)
    B(3.2,0.06,1.1,0,2.75,4.55,'corrugated',0.005);B(0.05,0.05,1.1,-1.55,2.72,4.55,'metal_dark',0.005);B(0.05,0.05,1.1,1.55,2.72,4.55,'metal_dark',0.005)
    B(1.3,0.35,0.06,0,3.1,4.0,'shopsign',0.005)   # sign board over the door (texture assigned at runtime)
    # windows: dark recessed glass with frames and bars, on the east, north and south walls
    def window(x,y,z,w,h,axis):
        if axis=='z': B(w,h,0.05,x,y,z,'glass',0.004);B(w+0.16,0.08,0.1,x,y+h/2+0.04,z,'metal_dark',0.005);B(w+0.16,0.08,0.1,x,y-h/2-0.04,z,'metal_dark',0.005);B(0.08,h+0.16,0.1,x-w/2-0.04,y,z,'metal_dark',0.005);B(0.08,h+0.16,0.1,x+w/2+0.04,y,z,'metal_dark',0.005);B(0.03,h,0.1,x,y,z,'metal_dark',0.003)
        else: B(0.05,h,w,x,y,z,'glass',0.004);B(0.1,0.08,w+0.16,x,y+h/2+0.04,z,'metal_dark',0.005);B(0.1,0.08,w+0.16,x,y-h/2-0.04,z,'metal_dark',0.005);B(0.1,h+0.16,0.08,x,y,z-w/2-0.04,'metal_dark',0.005);B(0.1,h+0.16,0.08,x,y,z+w/2+0.04,'metal_dark',0.005);B(0.1,h,0.03,x,y,z,'metal_dark',0.003)
    window(-2.6,1.7,4.0,1.2,0.9,'z');window(2.6,1.7,4.0,1.2,0.9,'z');window(-2.2,1.7,-4.0,1.2,0.9,'z');window(2.2,1.7,-4.0,1.2,0.9,'z');window(4.0,1.7,-2.0,1.2,0.9,'x');window(4.0,1.7,2.0,1.2,0.9,'x')
    # stairs: 11 solid steps along +x from x=-3.5 to 1.2, strip z -3.75..-2.4, with a handrail
    n=11;run=4.7/n;rise=3.25/n
    for i in range(n): B(run,(i+1)*rise,1.35,-3.5+(i+0.5)*run,(i+1)*rise/2,-3.075,'crate',0.01)
    # corrimão só na parte alta (os primeiros 4 degraus ficam abertos do lado da sala: é por aí que se entra), inclinado a acompanhar a escada
    for i in range(4,n,2): B(0.05,1.0,0.05,-3.5+(i+0.5)*run,(i+1)*rise+0.5,-2.36,'metal_dark',0.005)
    P.append(box(3.65,0.05,0.05,(-0.3,3.16,2.36),'metal_dark',0.005,rot=(0,0,-0.606),segs=1))
    B(0.3,0.03,1.35,-3.35,0.02,-3.075,'metal_dark',0.005)   # cantoneira no primeiro degrau
    # locker-room dressing: bench, lockers, a crate, and a floodlight on the roof corner
    B(2.4,0.08,0.4,2.0,0.5,2.6,'crate',0.01);B(0.08,0.5,0.4,0.9,0.25,2.6,'metal_dark',0.005);B(0.08,0.5,0.4,3.1,0.25,2.6,'metal_dark',0.005)
    for k in range(4): B(0.5,1.9,0.45,1.0+k*0.55,0.95,-3.35,'metal_painted',0.01)
    B(0.9,0.9,0.9,3.0,0.45,-1.0,'crate',0.02)
    B(0.3,0.3,0.3,3.3,4.5,3.3,'lamp',0.01);B(0.08,0.9,0.08,3.3,3.9,3.3,'metal_dark',0.005)
    return finish('house',P,ao=True,subdiv=0,uv='tile')
def m_casa():
    # casinha de bairro 4x4 m (substitui os contentores fora do iate): reboco tingido por país, portadas tingidas, porta de madeira
    P=[];B=lambda w,h,d,x,y,z,m,bev=0.02:P.append(box(w,h,d,(x,y,-z),m,bev,segs=1))
    B(3.9,3.1,3.9,0,1.6,0,'plaster',0.03);B(4.0,0.34,4.0,0,0.17,0,'concrete',0.02);B(4.06,0.12,4.06,0,3.2,0,'window_frame',0.02)
    for (w,d,x,z) in ((4.0,0.14,0,-1.93),(4.0,0.14,0,1.93),(0.14,4.0,-1.93,0),(0.14,4.0,1.93,0)): B(w,0.34,d,x,3.43,z,'plaster',0.02)
    B(1.05,2.25,0.08,-0.85,1.3,1.96,'window_frame',0.01);B(0.9,2.1,0.06,-0.85,1.27,1.99,'door_wood',0.01);B(1.1,0.14,0.3,-0.85,0.27,2.08,'concrete',0.01)
    B(1.5,0.06,0.62,-0.85,2.55,2.25,'shutter',0.01)
    def win(x,y,z,axis):
        if axis=='z':
            s=1 if z>0 else -1
            B(0.9,1.1,0.05,x,y,z,'glass',0.004);B(1.06,0.08,0.12,x,y+0.59,z,'window_frame',0.005);B(1.1,0.08,0.18,x,y-0.6,z+0.04*s,'window_frame',0.005)
            B(0.46,1.16,0.04,x-0.72,y,z+0.03*s,'shutter',0.005);B(0.46,1.16,0.04,x+0.72,y,z+0.03*s,'shutter',0.005)
        else:
            s=1 if x>0 else -1
            B(0.05,1.1,0.9,x,y,z,'glass',0.004);B(0.12,0.08,1.06,x,y+0.59,z,'window_frame',0.005);B(0.18,0.08,1.1,x+0.04*s,y-0.6,z,'window_frame',0.005)
            B(0.04,1.16,0.46,x+0.03*s,y,z-0.72,'shutter',0.005);B(0.04,1.16,0.46,x+0.03*s,y,z+0.72,'shutter',0.005)
    win(0.95,1.75,1.97,'z');win(1.97,1.75,0.3,'x');win(-1.97,1.75,-0.2,'x');win(0.2,2.2,-1.97,'z')
    B(0.8,0.5,0.28,-1.0,2.3,-2.1,'metal_painted',0.02);B(0.35,0.45,0.12,1.2,1.3,-2.02,'metal_dark',0.01);B(0.07,3.1,0.07,1.85,1.6,1.9,'metal_dark',0.005)
    B(0.8,0.7,0.8,0.9,3.7,-0.8,'metal_painted',0.03)
    return finish('casa',P,ao=True,subdiv=0,uv='tile')
# ---------- monumentos ao longe (vistos por cima das bancadas): simples, grandes, poucos triângulos ----------
def cone(r1,r2,h,pos,m,n=4,rotz=45):
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r1,radius2=r2,depth=h);o=bpy.context.object;o.location=(pos[0],pos[2],pos[1]);o.rotation_euler=(0,0,math.radians(rotz))
    bpy.ops.object.transform_apply(rotation=True);o.data.materials.append(mat(m));return o
def ball(r,pos,m,seg=16):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r,segments=seg,ring_count=seg//2);o=bpy.context.object;o.location=(pos[0],pos[2],pos[1]);o.data.materials.append(mat(m));return o
def m_lm_esp():   # Giralda (Sevilha)
    P=[box(14,64,14,(0,32,0),'lm_stone',0.1)]
    for f in range(4):
        for r in range(7):
            for c in (-3.5,0,3.5):
                x,z=((c,7.05),(7.05,c),(c,-7.05),(-7.05,c))[f];w,d=(1.4,0.3) if f%2==0 else (0.3,1.4);P.append(box(w,3.2,d,(x,8+r*7.5,z),'lm_dark',0))
    P+=[box(12,11,12,(0,69.5,0),'lm_stone',0.1),box(12.6,1,12.6,(0,64.5,0),'lm_white',0.05)]
    for f in range(4):
        for c in (-3,3):
            x,z=((c,6.05),(6.05,c),(c,-6.05),(-6.05,c))[f];w,d=(2.2,0.3) if f%2==0 else (0.3,2.2);P.append(box(w,6,d,(x,69,z),'lm_dark',0))
    P+=[box(8,7,8,(0,78.5,0),'lm_white',0.08),box(5,6,5,(0,85,0),'lm_stone',0.06),cone(2.6,0.2,9,(0,92.5,0),'lm_bronze',n=8,rotz=22.5),box(0.3,4,0.3,(0,98.5,0),'lm_bronze',0)]
    return finish('lm_esp',P,ao=False,uv='tile')
def m_lm_fra():   # Torre Eiffel
    P=[]
    for sx in (-1,1):
        for sz in (-1,1):
            for (y0,y1,r0,r1,t) in ((0,57,22,9,4.2),(57,116,9,4,2.6)):
                h=y1-y0;xm=sx*(r0+r1)/2;zm=sz*(r0+r1)/2;ang=math.atan((r0-r1)/h)
                P.append(box(t,h/math.cos(ang),t,(xm,(y0+y1)/2,zm),'lm_bronze',0,rot=(sz*ang,0,-sx*ang)))
    P+=[box(34,3,34,(0,57,0),'lm_bronze',0.1),box(16,2.4,16,(0,116,0),'lm_bronze',0.1),cone(4.5,1.2,44,(0,139,0),'lm_bronze',n=4),box(1,16,1,(0,168,0),'lm_bronze',0)]
    for sx in (-1,1):
        P.append(box(24,1.2,1.2,(0,28,sx*15.5),'lm_bronze',0));P.append(box(1.2,1.2,24,(sx*15.5,28,0),'lm_bronze',0))
    return finish('lm_fra',P,ao=False,uv='tile')
def m_lm_ale():   # Torre de Televisão (Berlim)
    P=[box(34,6,34,(0,3,0),'lm_white',0.2),cyl(4.6,150,(0,78,0),'lm_white',n=20),ball(15,(0,160,0),'lm_steel',seg=20),cyl(6.5,5,(0,172,0),'lm_white',n=20),cyl(1.8,40,(0,195,0),'lm_white',n=12),cyl(0.9,20,(0,224,0),'lm_red',n=8)]
    return finish('lm_ale',P,ao=False,uv='tile')
def m_lm_bra():   # Morro do Corcovado com o Cristo Redentor
    P=[cone(70,8,110,(0,55,0),'lm_rock',n=9,rotz=10),cone(40,4,70,(-45,35,20),'lm_rock',n=7,rotz=30),box(9,9,9,(0,114.5,0),'lm_white',0.2),cyl(2.2,24,(0,131,0),'lm_white',n=10),box(30,3,2.6,(0,139,0),'lm_white',0.4),ball(1.9,(0,145,0),'lm_white',seg=12)]
    return finish('lm_bra',P,ao=False,uv='tile')
def m_lm_arg():   # Obelisco (Buenos Aires)
    P=[box(24,1.6,24,(0,0.8,0),'lm_white',0.1),cone(5.2,3.6,64,(0,33.6,0),'lm_white',n=4),cone(3.6,0.05,6,(0,68.6,0),'lm_white',n=4),box(0.8,2.4,0.1,(0,20,3.8),'lm_dark',0)]
    return finish('lm_arg',P,ao=False,uv='tile')
# ---------- vegetação por país (baixo polígono) ----------
def m_palm():
    P=[];x=0.0
    for i in range(6):
        x+=0.06*i;P.append(cyl(0.17-0.012*i,0.94,(x,0.47+i*0.88,0),'bark',n=8))
    tx,ty=x,5.55
    for k in range(8):
        a=k/8*6.283;P.append(box(2.4,0.04,0.46,(tx+math.cos(a)*1.1,ty-0.25,math.sin(a)*1.1),'leaf',0,rot=(0,a,0.38)))
    for k in range(3): P.append(ball(0.13,(tx+0.16*math.cos(k*2.1),ty-0.3,0.16*math.sin(k*2.1)),'bark',seg=8))
    return finish('palm',P,ao=False,uv='tile')
def m_cypress():
    P=[cyl(0.14,1.0,(0,0.5,0),'bark',n=6),cone(0.78,0.05,6.2,(0,4.0,0),'leaf_dark',n=8,rotz=0),cone(0.62,0.05,4.4,(0.12,3.3,0.15),'leaf_dark',n=7,rotz=20)]
    return finish('cypress',P,ao=False,uv='tile')
def _roundtree(name,leaf):
    P=[cyl(0.2,2.6,(0,1.3,0),'bark',n=8),ball(1.5,(0,3.6,0),leaf,seg=10),ball(1.15,(0.9,3.1,0.4),leaf,seg=8),ball(1.1,(-0.8,3.2,-0.5),leaf,seg=8),ball(1.0,(0.1,4.5,-0.2),leaf,seg=8)]
    return finish(name,P,ao=True,uv='tile')
def m_tree(): return _roundtree('tree','leaf')
def m_tree_purple(): return _roundtree('tree_purple','leaf_purple')
def m_rubble():
    parts=[]
    import random;random.seed(7)
    for k in range(6): parts.append(box(0.15+random.random()*0.5,0.08+random.random()*0.26,0.15+random.random()*0.5,((random.random()-0.5)*1.6,0.1,(random.random()-0.5)*1.6),'concrete',0.04,rot=(0,random.random()*6.28,0),segs=2))
    return finish('rubble',parts)
for k,v in list(globals().items()):
    if k.startswith('m_'): register(k[2:],v)
for name,fn in MODS.items():
    if ONLY and name not in ONLY: continue
    t=time.time();fn();log('time',name,round(time.time()-t,1))
log('done')
