"""Armas realistas (CC0, geometria escrita em código): perfis laterais extrudidos com chanfros, peças torneadas,
calhas picatinny, rebites; AO + desgaste nas arestas em cores de vértice. Coordenadas de jogo: x direita, y cima,
z para trás (cano para -Z). Cada arma exporta 'body', 'mag' (opcional) e 'bolt' (opcional: manivela, corrediça,
bomba, ferrolho ou tambor) e os marcadores 'tip', 'eject', 'sight', 'grip_r', 'grip_l'.
Também exporta 'hands.glb' (hand_r / hand_l: luvas táticas + manga) e 'ar_lo.glb' (espingarda leve para os inimigos).
Uso: python build_weapons.py <out_dir> [id,id,...]   (a versão anterior ficou em build_weapons_v1.py)"""
import bpy, bmesh, sys, os, math
from mathutils import Vector
args=[a for a in sys.argv[1:] if not a.endswith('.py')];OUT=args[0];ONLY=args[1].split(',') if len(args)>1 else None;os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=16
log=lambda *a:print('[wpn]',*a,flush=True)
MATS={};DUMMY=None
def mat(name):
    global DUMMY
    if name in MATS: return MATS[name]
    m=bpy.data.materials.new(name);m.use_nodes=True;MATS[name]=m
    if DUMMY is None: DUMMY=bpy.data.images.new('dummy_uv',2,2);DUMMY.pixels=[1,1,1,1]*4
    nt=m.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=DUMMY;uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map='UVMap'
    nt.links.new(uv.outputs['UV'],tex.inputs['Vector']);nt.links.new(tex.outputs['Color'],nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m
def G(x,y,z): return Vector((x,-z,y))          # jogo -> blender
def _obj(bm,m,name='p'):
    me=bpy.data.meshes.new(name);bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me);sc.collection.objects.link(o);o.data.materials.append(mat(m));return o
def bev(o,w,segs=2,ang=40):
    if w>0: b=o.modifiers.new('bev','BEVEL');b.width=w;b.segments=segs;b.limit_method='ANGLE';b.angle_limit=math.radians(ang)
    return o
def prof(m,pts,w,x=0.0,b=0.0025,segs=2):
    """perfil lateral (lista de (z,y)) extrudido em largura w, centrado em x"""
    bm=bmesh.new();a=[bm.verts.new(G(x-w/2,y,z)) for z,y in pts];c=[bm.verts.new(G(x+w/2,y,z)) for z,y in pts];n=len(pts)
    bm.faces.new(a);bm.faces.new(c[::-1])
    for i in range(n): j=(i+1)%n;bm.faces.new((a[i],a[j],c[j],c[i]))
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    return bev(_obj(bm,m),min(b,w*0.45),segs)
def lathe(m,zr,y=0.0,x=0.0,n=20,b=0.0):
    """peça torneada ao longo de z: lista de (z, raio)"""
    bm=bmesh.new();rings=[[bm.verts.new(G(x+r*math.cos(2*math.pi*i/n),y+r*math.sin(2*math.pi*i/n),z)) for i in range(n)] for z,r in zr]
    for k in range(len(rings)-1):
        A,B=rings[k],rings[k+1]
        for i in range(n): bm.faces.new((A[i],A[(i+1)%n],B[(i+1)%n],B[i]))
    bm.faces.new(rings[0]);bm.faces.new(rings[-1][::-1]);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    return bev(_obj(bm,m),b,2,50)
def box(w,h,d,x,y,z,m,bev=0.002,segs=2,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.scale=(w,d,h);o.location=(x,-z,y);o.rotation_euler=(math.radians(rot[0]),math.radians(-rot[2]),math.radians(rot[1]))
    bpy.ops.object.transform_apply(scale=True,rotation=True);o.data.materials.append(mat(m))
    if bev>0:
        b=o.modifiers.new('bev','BEVEL');b.width=min(bev,min(w,h,d)*0.3);b.segments=segs;b.limit_method='ANGLE';b.angle_limit=math.radians(40)
    return o
def cylx(r,l,x,y,z,m,n=12):
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=l,vertices=n);o=bpy.context.object;o.location=(x,-z,y);o.rotation_euler=(0,math.radians(90),0)
    bpy.ops.object.transform_apply(rotation=True);o.data.materials.append(mat(m));return o
def cyly(r,l,x,y,z,m,n=12):
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=l,vertices=n);o=bpy.context.object;o.location=(x,-z,y);o.data.materials.append(mat(m));return o
def rail(z0,z1,y,x=0.0,w=0.021,m='gun_metal'):
    out=[box(w*0.72,0.005,z1-z0,x,y+0.0025,(z0+z1)/2,m,bev=0.001)];k=z0+0.005
    while k<z1-0.004: out.append(box(w,0.0036,0.0052,x,y+0.0066,k,m,bev=0.0008,segs=1));k+=0.01
    return out
def curved(m,top,length,R,hw,w,x=0.0,th0=0.06,steps=10,b=0.003,plate=None):
    """carregador curvo: eixo em arco que desce e curva para a frente"""
    ang=th0;z,y=top;ds=length/steps;cs=[];ns=[];d=(0,-1)
    for i in range(steps+1):
        d=(-math.sin(ang),-math.cos(ang));n=(math.cos(ang),-math.sin(ang));cs.append((z,y));ns.append(n)
        if i<steps: z+=d[0]*ds;y+=d[1]*ds;ang+=ds/R if R else 0
    front=[(c[0]-n[0]*hw,c[1]-n[1]*hw) for c,n in zip(cs,ns)];back=[(c[0]+n[0]*hw,c[1]+n[1]*hw) for c,n in zip(cs,ns)]
    out=[prof(m,front+back[::-1],w,x,b)]
    if plate:
        c,n=cs[-1],ns[-1];e=hw+0.003;t=0.009
        out.append(prof(plate,[(c[0]-n[0]*e,c[1]-n[1]*e),(c[0]+n[0]*e,c[1]+n[1]*e),(c[0]+n[0]*e+d[0]*t,c[1]+n[1]*e+d[1]*t),(c[0]-n[0]*e+d[0]*t,c[1]-n[1]*e+d[1]*t)],w+0.004,x,0.002))
    return out
def rivets(pts,half,m='gun_steel',r=0.0024):
    return [cylx(r,0.004,s*half,yy,zz,m,n=8) for zz,yy in pts for s in (-1,1)]
def shade(o):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(34))
    except Exception:
        for p in o.data.polygons: p.use_smooth=False
def project_uvs(o):
    me=o.data
    if not me.uv_layers: me.uv_layers.new(name='UVMap')
    uv=me.uv_layers.active.data
    for p in me.polygons:
        nn=p.normal;ax=max(range(3),key=lambda i:abs(nn[i]));a,b=[(1,2),(0,2),(0,1)][ax]
        for li,vi in zip(p.loop_indices,p.vertices): c=me.vertices[vi].co;uv[li].uv=(c[a]*4,c[b]*4)
def wear(o,amount=0.3):
    """cor de vértice final = AO suavizado + realce nas arestas convexas (desgaste)"""
    me=o.data;bm=bmesh.new();bm.from_mesh(me);bm.verts.ensure_lookup_table();bm.normal_update();conv=[0.0]*len(bm.verts)
    for v in bm.verts:
        s=0.0;k=0
        for e in v.link_edges:
            dv=e.other_vert(v).co-v.co;L=dv.length
            if L>1e-6: s+=dv.dot(v.normal)/L;k+=1
        conv[v.index]=max(0.0,min(1.0,-s/max(1,k)*2.2))
    bm.free();ca=me.color_attributes.get('Col')
    if not ca: return
    for li,lp in enumerate(me.loops):
        ao=ca.data[li].color[0];val=0.55+0.45*math.sqrt(max(0.0,ao));val=min(1.0,val*0.9+conv[lp.vertex_index]*amount)
        ca.data[li].color=(val,val,val,1.0)
def join(name,objs,origin=None,amount=0.3):
    objs=[o for o in objs if o]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        bpy.context.view_layer.objects.active=o
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    o=bpy.context.object;o.name=name;o.data.name=name
    if origin is not None:
        sc.cursor.location=G(*origin);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');sc.cursor.location=(0,0,0)
    shade(o);project_uvs(o)
    ca=o.data.color_attributes.new('Col','BYTE_COLOR','CORNER');o.data.color_attributes.active_color=ca
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    sc.render.bake.target='VERTEX_COLORS'
    try: bpy.ops.object.bake(type='AO',use_clear=True)
    except Exception as e: log('AO bake failed',name,e)
    wear(o,amount);return o
def empty(name,x,y,z):
    e=bpy.data.objects.new(name,None);sc.collection.objects.link(e);e.location=G(x,y,z);return e
def export(name,objs,clear=True):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0];path=os.path.join(OUT,name+'.glb')
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_image_format='NONE',export_vertex_color='ACTIVE',export_yup=True,export_normals=True,export_texcoords=True,export_animations=False)
    tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs if o.type=='MESH');log(name,'tris',tris,'bytes',os.path.getsize(path))
    if clear:
        for o in list(sc.collection.objects): bpy.data.objects.remove(o,do_unlink=True)
M,S,D,W,PL,T,GL,RB,BR,RD,OL,GW='gun_metal','gun_steel','gun_dark','gun_wood','gun_polymer','gun_tan','gun_glass','gun_rubber','gun_brass','gun_red','gun_olive','gun_glow'

# ---------------------------------------------------------------- AK (madeira + aço estampado)
def w_ar():
    b=[]
    b.append(prof(M,[(-0.19,-0.032),(-0.19,0.028),(0.128,0.028),(0.135,0.012),(0.135,-0.034),(0.075,-0.036),(-0.19,-0.034)],0.046,b=0.002))
    b.append(prof(M,[(-0.118,0.026),(-0.118,0.041),(-0.1,0.047),(0.1,0.047),(0.128,0.052),(0.137,0.03),(0.137,0.026)],0.043,b=0.009,segs=3))
    for zz in (-0.05,0.02,0.08): b.append(box(0.041,0.004,0.006,0,0.048,zz,M,bev=0.0015))
    b.append(prof(M,[(-0.19,0.026),(-0.19,0.046),(-0.14,0.05),(-0.118,0.05),(-0.118,0.026)],0.03,b=0.003))
    b.append(box(0.024,0.005,0.07,0,0.053,-0.15,M,bev=0.001))
    for sx in (-0.0065,0.0065): b.append(box(0.007,0.009,0.006,sx,0.06,-0.118,M,bev=0.001))
    b.append(prof(W,[(-0.405,0.018),(-0.405,0.034),(-0.385,0.046),(-0.215,0.046),(-0.198,0.038),(-0.198,0.018)],0.036,b=0.009,segs=3))
    b.append(prof(W,[(-0.43,-0.014),(-0.43,0.012),(-0.192,0.014),(-0.192,-0.028),(-0.22,-0.037),(-0.41,-0.032)],0.052,b=0.01,segs=3))
    b.append(box(0.056,0.05,0.008,0,-0.001,-0.434,S,bev=0.002))
    b.append(lathe(M,[(-0.19,0.0105),(-0.43,0.0098),(-0.53,0.0092),(-0.531,0.0118),(-0.585,0.0118),(-0.586,0.0125),(-0.625,0.0125)],y=0.004,n=18,b=0.0015))
    b.append(prof(M,[(-0.47,-0.004),(-0.47,0.04),(-0.435,0.042),(-0.405,0.03),(-0.405,-0.004)],0.028,b=0.003))
    b.append(prof(M,[(-0.565,-0.012),(-0.565,0.036),(-0.53,0.036),(-0.525,-0.012)],0.022,b=0.003))
    for sx in (-0.0085,0.0085): b.append(box(0.0035,0.036,0.018,sx,0.052,-0.546,M,bev=0.0008))
    b.append(cyly(0.0018,0.028,0,0.048,-0.546,M,n=8))
    b.append(lathe(S,[(-0.43,0.003),(-0.53,0.003)],y=-0.012,n=8))
    b.append(box(0.026,0.006,0.02,0,0.013,-0.615,D,bev=0.001,rot=(35,0,0)))
    b.append(prof(PL,[(0.034,-0.032),(0.08,-0.032),(0.108,-0.142),(0.06,-0.148),(0.046,-0.07)],0.031,b=0.008,segs=3))
    b.append(box(0.012,0.004,0.092,0,-0.061,-0.006,M,bev=0.0012))
    b.append(box(0.012,0.028,0.004,0,-0.047,-0.05,M,bev=0.0012))
    b.append(box(0.006,0.02,0.005,0,-0.045,-0.004,S,bev=0.001,rot=(12,0,0)))
    b.append(box(0.05,0.006,0.075,0,-0.036,-0.1,M,bev=0.0015))
    b.append(prof(S,[(-0.105,0.012),(-0.1,0.02),(0.06,0.02),(0.066,0.012),(0.066,-0.004),(0.056,-0.004),(0.054,0.012)],0.003,x=0.0245,b=0.0008,segs=1))
    b.append(box(0.002,0.016,0.085,0.0232,0.019,-0.03,D,bev=0.0005))
    b+=rivets(((-0.172,-0.02),(-0.16,-0.02),(-0.172,0.012),(0.105,-0.018),(0.105,0.01),(0.118,-0.004),(-0.06,-0.022)),0.0235)
    b.append(prof(W,[(0.128,0.022),(0.18,0.02),(0.442,0.006),(0.446,-0.118),(0.43,-0.121),(0.18,-0.062),(0.135,-0.036)],0.04,b=0.009,segs=3))
    b.append(prof(S,[(0.44,0.009),(0.453,0.009),(0.457,-0.12),(0.444,-0.123)],0.042,b=0.003))
    mag=curved(M,(-0.098,-0.034),0.235,0.42,0.034,0.028,th0=0.09,b=0.004,plate=M)+curved(M,(-0.098,-0.04),0.2,0.42,0.012,0.0305,th0=0.09,b=0.0015)
    bolt=[box(0.006,0.01,0.03,0.026,0.018,-0.085,S,bev=0.0012),cylx(0.0045,0.022,0.038,0.018,-0.1,S,n=10),cylx(0.0068,0.012,0.052,0.018,-0.1,S,n=12)]
    return dict(body=b,mag=mag,mag_o=(0,-0.034,-0.098),bolt=bolt,bolt_o=(0.026,0.018,-0.09),tip=(0,0.004,-0.628),eject=(0.03,0.02,-0.03),sight=(0,0.0625,-0.12),grip_r=(0,-0.088,0.07),grip_l=(0,-0.008,-0.31))
# ---------------------------------------------------------------- SMG (tipo MP5)
def w_smg():
    b=[]
    b.append(prof(M,[(-0.17,-0.014),(-0.17,0.032),(0.13,0.032),(0.13,-0.014)],0.042,b=0.013,segs=3))
    b.append(lathe(M,[(-0.33,0.0105),(-0.17,0.0105)],y=0.03,n=14,b=0.001))
    b.append(prof(PL,[(-0.02,-0.012),(0.105,-0.012),(0.105,-0.03),(0.075,-0.032),(0.094,-0.132),(0.052,-0.138),(0.034,-0.046),(0.0,-0.05),(-0.03,-0.03),(-0.03,-0.012)],0.034,b=0.006,segs=3))
    b.append(box(0.036,0.018,0.034,0,-0.036,0.0,D,bev=0.002))
    b.append(prof(PL,[(-0.335,-0.02),(-0.335,0.022),(-0.17,0.024),(-0.17,-0.03),(-0.2,-0.038),(-0.315,-0.033)],0.046,b=0.011,segs=3))
    for yy in (-0.018,-0.004,0.01):
        for s in (-1,1): b.append(box(0.002,0.004,0.12,s*0.0232,yy,-0.26,D,bev=0.0))
    b.append(lathe(M,[(-0.335,0.0085),(-0.35,0.0085),(-0.351,0.0115),(-0.38,0.0115),(-0.381,0.0085),(-0.405,0.0085)],y=0.012,n=16,b=0.0008))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.013,minor_radius=0.0028,major_segments=20,minor_segments=8,location=G(0,0.05,-0.34),rotation=(math.radians(90),0,0))
    t=bpy.context.object;t.data.materials.append(mat(M));b.append(t)
    b.append(box(0.012,0.022,0.012,0,0.034,-0.34,M,bev=0.002));b.append(cyly(0.0017,0.02,0,0.048,-0.34,M,n=8))
    b.append(cylx(0.012,0.022,0,0.05,0.1,M,n=16));b.append(box(0.018,0.016,0.03,0,0.036,0.1,M,bev=0.002))
    b+=rivets(((0.02,0.0),(0.09,0.0)),0.022)
    for s in (-1,1): b.append(lathe(S,[(0.12,0.0045),(0.36,0.0045)],y=0.0,x=s*0.018,n=8))
    b.append(prof(RB,[(0.35,0.03),(0.37,0.032),(0.372,-0.095),(0.352,-0.092)],0.046,b=0.004))
    b.append(box(0.002,0.012,0.05,0.022,0.02,-0.07,D,bev=0.0))
    mag=curved(M,(-0.045,-0.012),0.21,0.9,0.023,0.026,th0=0.12,b=0.003,plate=PL)
    bolt=[cylx(0.0035,0.03,-0.03,0.03,-0.27,S,n=8),box(0.004,0.012,0.016,-0.045,0.03,-0.27,S,bev=0.001)]
    return dict(body=b,mag=mag,mag_o=(0,-0.012,-0.045),bolt=bolt,bolt_o=(-0.02,0.03,-0.27),tip=(0,0.012,-0.41),eject=(0.025,0.02,-0.07),sight=(0,0.05,-0.1),grip_r=(0,-0.08,0.07),grip_l=(0,-0.006,-0.25))
# ---------------------------------------------------------------- Caçadeira de bomba
def w_shotgun():
    b=[]
    b.append(prof(M,[(-0.1,-0.036),(-0.1,0.034),(0.12,0.034),(0.14,0.018),(0.14,-0.036)],0.042,b=0.006))
    b.append(box(0.002,0.022,0.07,0.0212,0.012,-0.035,D,bev=0.0))
    b.append(lathe(M,[(-0.1,0.0125),(-0.6,0.0125),(-0.601,0.0135),(-0.625,0.0135)],y=0.02,n=18,b=0.001))
    b.append(box(0.008,0.004,0.49,0,0.0345,-0.36,M,bev=0.001))
    for zz in (-0.15,-0.3,-0.45,-0.58): b.append(box(0.004,0.004,0.006,0,0.03,zz,M,bev=0.0))
    b.append(cyly(0.0025,0.006,0,0.039,-0.605,BR,n=8))
    b.append(lathe(M,[(-0.1,0.012),(-0.55,0.012),(-0.551,0.013),(-0.566,0.013)],y=-0.012,n=16,b=0.001))
    b.append(box(0.022,0.04,0.014,0,0.004,-0.54,M,bev=0.002))
    b.append(prof(W,[(0.135,0.03),(0.18,0.028),(0.44,0.01),(0.445,-0.13),(0.43,-0.135),(0.24,-0.096),(0.19,-0.112),(0.15,-0.11),(0.138,-0.036)],0.042,b=0.01,segs=3))
    b.append(prof(RB,[(0.44,0.012),(0.46,0.012),(0.464,-0.132),(0.446,-0.136)],0.044,b=0.005))
    b.append(box(0.012,0.004,0.09,0,-0.066,0.07,M,bev=0.0012));b.append(box(0.012,0.03,0.004,0,-0.05,0.025,M,bev=0.0012))
    b.append(box(0.006,0.02,0.005,0,-0.046,0.07,S,bev=0.001,rot=(12,0,0)))
    for k in range(4):
        zz=-0.06+k*0.03;b.append(cyly(0.0115,0.05,-0.026,-0.002,zz,RD,n=12));b.append(cyly(0.012,0.012,-0.026,-0.032,zz,BR,n=12))
    b.append(box(0.006,0.056,0.13,-0.021,-0.004,-0.015,PL,bev=0.002))
    bolt=[prof(W,[(-0.41,-0.036),(-0.41,0.006),(-0.23,0.006),(-0.23,-0.036)],0.052,b=0.012,segs=3)]
    for zz in (-0.39,-0.37,-0.35,-0.27,-0.25): bolt.append(box(0.054,0.003,0.004,0,-0.012,zz,D,bev=0.0))
    for s in (-1,1): bolt.append(box(0.003,0.006,0.13,s*0.019,-0.012,-0.165,S,bev=0.0008))
    return dict(body=b,bolt=bolt,bolt_o=(0,-0.012,-0.32),tip=(0,0.02,-0.628),eject=(0.03,0.012,-0.03),sight=(0,0.041,-0.1),grip_r=(0,-0.08,0.165),grip_l=(0,-0.012,-0.32))
# ---------------------------------------------------------------- Sniper de ferrolho (coronha tática + mira)
def w_sniper():
    b=[]
    b.append(lathe(M,[(-0.12,0.018),(0.1,0.018)],y=0.0,n=20,b=0.002))
    b.append(lathe(M,[(-0.12,0.0145),(-0.5,0.0125),(-0.7,0.0105),(-0.701,0.0155),(-0.765,0.0155)],y=0.0,n=18,b=0.0015))
    for zz in (-0.72,-0.735,-0.75):
        for s in (-1,1): b.append(box(0.004,0.012,0.007,s*0.0145,0.0,zz,D,bev=0.0))
    b+=rail(-0.14,0.1,0.018)
    b.append(prof(T,[(-0.48,-0.004),(-0.48,-0.036),(-0.46,-0.045),(-0.12,-0.048),(-0.12,-0.004)],0.056,b=0.01,segs=3))
    b.append(prof(T,[(-0.12,-0.004),(-0.12,-0.05),(0.02,-0.05),(0.035,-0.026),(0.11,-0.026),(0.11,-0.004)],0.054,b=0.006))
    b.append(prof(RB,[(0.035,-0.026),(0.08,-0.026),(0.105,-0.135),(0.06,-0.14),(0.045,-0.06)],0.032,b=0.008,segs=3))
    b.append(prof(T,[(0.11,0.0),(0.125,0.032),(0.44,0.028),(0.445,-0.13),(0.42,-0.135),(0.3,-0.07),(0.16,-0.058),(0.11,-0.026)],0.05,b=0.01,segs=3))
    b.append(box(0.03,0.016,0.18,0,0.036,0.29,T,bev=0.006))
    b.append(prof(RB,[(0.44,0.03),(0.46,0.03),(0.464,-0.132),(0.446,-0.136)],0.052,b=0.005))
    b.append(box(0.012,0.004,0.085,0,-0.07,0.0,M,bev=0.0012));b.append(box(0.006,0.02,0.005,0,-0.058,0.005,S,bev=0.001,rot=(12,0,0)))
    b.append(lathe(M,[(-0.265,0.028),(-0.225,0.028),(-0.19,0.0165),(0.06,0.0165),(0.09,0.021),(0.145,0.021)],y=0.075,n=24,b=0.0015))
    b.append(lathe(GL,[(-0.263,0.0245),(-0.262,0.0245)],y=0.075,n=24));b.append(lathe(GL,[(0.143,0.018),(0.144,0.018)],y=0.075,n=24))
    b.append(cyly(0.011,0.02,0,0.1,-0.07,M,n=16));b.append(cylx(0.011,0.02,0.024,0.075,-0.07,M,n=16))
    for zz in (-0.12,0.03): b.append(box(0.03,0.05,0.016,0,0.05,zz,M,bev=0.003))
    for s in (-1,1): b.append(lathe(S,[(-0.44,0.005),(-0.24,0.005)],y=-0.056,x=s*0.012,n=8))
    b.append(box(0.036,0.02,0.03,0,-0.05,-0.455,M,bev=0.003))
    mag=[prof(M,[(-0.06,-0.045),(-0.06,-0.095),(0.0,-0.095),(0.0,-0.045)],0.03,b=0.003)]
    bolt=[lathe(S,[(0.05,0.009),(0.12,0.009)],y=0.0,n=14,b=0.001),box(0.006,0.006,0.05,0.04,-0.01,0.08,S,bev=0.001,rot=(0,0,-35)),lathe(S,[(0.075,0.001),(0.074,0.009),(0.092,0.009),(0.093,0.001)],y=-0.022,x=0.062,n=14)]
    return dict(body=b,mag=mag,mag_o=(0,-0.045,-0.03),bolt=bolt,bolt_o=(0.0,0.0,0.08),tip=(0,0.0,-0.77),eject=(0.02,0.01,0.0),sight=(0,0.075,0.0),grip_r=(0,-0.08,0.07),grip_l=(0,-0.026,-0.32))
# ---------------------------------------------------------------- Metralhadora ligeira (caixa de munições)
def w_lmg():
    b=[]
    b.append(prof(M,[(-0.2,-0.036),(-0.2,0.04),(0.16,0.04),(0.16,-0.036)],0.07,b=0.006))
    b.append(prof(M,[(-0.1,0.038),(-0.1,0.062),(0.12,0.062),(0.14,0.04)],0.072,b=0.008))
    b+=rail(-0.08,0.1,0.062,w=0.024)
    b.append(box(0.012,0.02,0.02,0,0.084,0.1,M,bev=0.002))
    b.append(prof(M,[(-0.4,0.0),(-0.4,0.03),(-0.2,0.032),(-0.2,0.0)],0.045,b=0.012,segs=3))
    for zz in (-0.37,-0.34,-0.31,-0.28,-0.25): b.append(box(0.012,0.004,0.014,0,0.034,zz,D,bev=0.0))
    b.append(lathe(M,[(-0.2,0.0125),(-0.6,0.0125),(-0.601,0.015),(-0.665,0.015)],y=0.0,n=18,b=0.001))
    for zz in (-0.615,-0.635,-0.655):
        for s in (-1,1): b.append(box(0.004,0.02,0.008,s*0.0145,0.0,zz,D,bev=0.0))
    b.append(lathe(M,[(-0.2,0.011),(-0.47,0.011)],y=-0.026,n=12));b.append(box(0.03,0.05,0.03,0,-0.012,-0.47,M,bev=0.003))
    b.append(prof(PL,[(-0.34,-0.02),(-0.34,-0.05),(-0.2,-0.056),(-0.2,-0.02)],0.056,b=0.008))
    b.append(box(0.004,0.07,0.012,0,0.045,-0.58,M,bev=0.001))
    b.append(box(0.008,0.03,0.018,0,0.054,-0.23,M,bev=0.002));b.append(box(0.02,0.012,0.12,0,0.075,-0.21,PL,bev=0.004))
    for s in (-1,1): b.append(lathe(S,[(-0.56,0.005),(-0.36,0.005)],y=-0.04,x=s*0.012,n=8))
    b.append(prof(PL,[(0.04,-0.034),(0.085,-0.034),(0.11,-0.142),(0.066,-0.148),(0.05,-0.07)],0.032,b=0.008,segs=3))
    b.append(box(0.012,0.004,0.09,0,-0.063,0.04,M,bev=0.0012));b.append(box(0.006,0.02,0.005,0,-0.05,0.04,S,bev=0.001,rot=(12,0,0)))
    b.append(prof(PL,[(0.16,0.03),(0.45,0.02),(0.452,-0.11),(0.3,-0.08),(0.16,-0.04)],0.05,b=0.01,segs=3))
    b.append(prof(RB,[(0.445,0.022),(0.462,0.022),(0.464,-0.112),(0.447,-0.114)],0.052,b=0.005))
    b.append(box(0.002,0.03,0.06,0.036,0.01,-0.05,D,bev=0.0))
    mag=[prof(T,[(-0.14,-0.036),(-0.14,-0.18),(0.0,-0.18),(0.0,-0.036)],0.085,x=-0.03,b=0.014,segs=3)]
    mag.append(box(0.07,0.004,0.12,-0.03,-0.108,-0.07,PL,bev=0.001))
    for k in range(6):
        t=k/5.0;xx=-0.07+0.035*t;yy=-0.03+0.05*t;mag.append(lathe(BR,[(-0.085,0.0048),(-0.04,0.0048),(-0.03,0.003)],y=yy,x=xx,n=8))
    bolt=[cylx(0.005,0.03,0.05,0.0,-0.1,S,n=10),box(0.01,0.02,0.01,0.066,-0.005,-0.1,S,bev=0.002)]
    return dict(body=b,mag=mag,mag_o=(-0.03,-0.036,-0.07),bolt=bolt,bolt_o=(0.04,0.0,-0.1),tip=(0,0.0,-0.668),eject=(0.0,-0.045,-0.05),sight=(0,0.08,0.05),grip_r=(0,-0.09,0.075),grip_l=(0,-0.03,-0.27))
# ---------------------------------------------------------------- Pistola (percutor lançado, polímero)
def w_pistol():
    b=[]
    b.append(prof(PL,[(-0.185,0.004),(-0.185,0.016),(-0.03,0.016),(-0.03,0.004)],0.024,b=0.003))
    b.append(prof(PL,[(-0.03,0.016),(0.012,0.016),(0.036,-0.095),(0.0,-0.102),(-0.012,-0.02)],0.03,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.05,0,-0.024,-0.045,PL,bev=0.001));b.append(box(0.012,0.026,0.004,0,-0.011,-0.068,PL,bev=0.001))
    b.append(box(0.005,0.018,0.005,0,-0.008,-0.04,S,bev=0.001,rot=(10,0,0)))
    b+=rail(-0.16,-0.08,-0.004,w=0.018,m=PL)
    for k in range(5): b.append(box(0.031,0.004,0.004,0,-0.03-0.014*k,0.02+0.003*k,D,bev=0.0))
    mag=[prof(M,[(-0.014,0.0),(0.006,0.0),(0.03,-0.096),(0.004,-0.1)],0.024,b=0.002),prof(PL,[(0.0,-0.098),(0.036,-0.094),(0.037,-0.106),(-0.002,-0.11)],0.03,b=0.002)]
    bolt=[prof(M,[(-0.19,0.015),(-0.19,0.045),(-0.175,0.05),(0.0,0.05),(0.006,0.045),(0.006,0.015)],0.026,b=0.004)]
    for k in range(6):
        for s in (-1,1): bolt.append(box(0.002,0.022,0.0025,s*0.0132,0.032,-0.004-0.006*k,D,bev=0.0))
    bolt.append(box(0.012,0.004,0.03,0.004,0.05,-0.06,D,bev=0.0))
    for sx in (-0.0045,0.0045): bolt.append(box(0.006,0.007,0.005,sx,0.0535,0.0,M,bev=0.0008))
    bolt.append(box(0.004,0.006,0.005,0,0.053,-0.18,M,bev=0.0008))
    bolt.append(lathe(D,[(-0.191,0.0055),(-0.19,0.0055)],y=0.03,n=12))
    return dict(body=b,mag=mag,mag_o=(0.01,-0.05,0.01),bolt=bolt,bolt_o=(0,0.032,-0.09),tip=(0,0.03,-0.195),eject=(0.012,0.05,-0.03),sight=(0,0.0565,-0.08),grip_r=(0,-0.045,0.012),grip_l=None)
# ---------------------------------------------------------------- Lança-granadas de tambor (6 tiros)
def w_gl():
    b=[]
    b.append(lathe(M,[(-0.12,0.024),(-0.4,0.024),(-0.401,0.027),(-0.43,0.027)],y=0.03,n=20,b=0.0015))
    b.append(box(0.03,0.012,0.28,0,0.062,0.0,M,bev=0.003));b+=rail(-0.1,0.1,0.068,w=0.022)
    b.append(box(0.03,0.028,0.04,0,0.09,0.0,PL,bev=0.004));b.append(box(0.024,0.018,0.004,0,0.093,-0.021,GL,bev=0.0));b.append(box(0.003,0.003,0.001,0,0.096,-0.022,GW,bev=0.0))
    b.append(lathe(M,[(-0.125,0.045),(-0.115,0.045)],y=-0.02,n=20));b.append(lathe(M,[(0.072,0.045),(0.082,0.045)],y=-0.02,n=20))
    b.append(box(0.02,0.08,0.02,0,0.02,0.09,M,bev=0.003))
    b.append(prof(PL,[(0.09,-0.02),(0.13,-0.02),(0.156,-0.13),(0.112,-0.136),(0.1,-0.06)],0.032,b=0.008,segs=3))
    b.append(box(0.012,0.004,0.07,0,-0.07,0.06,M,bev=0.0012))
    for s in (-1,1): b.append(lathe(S,[(0.14,0.006),(0.4,0.006)],y=-0.01+s*0.015,x=0.0,n=8))
    b.append(prof(RB,[(0.39,0.02),(0.41,0.02),(0.412,-0.07),(0.392,-0.07)],0.05,b=0.005))
    bolt=[lathe(M,[(-0.11,0.06),(0.07,0.06)],y=-0.02,n=24,b=0.003)]
    for k in range(6):
        a=2*math.pi*k/6;bolt.append(lathe(M,[(-0.112,0.021),(0.072,0.021)],y=-0.02+0.042*math.sin(a),x=0.042*math.cos(a),n=14,b=0.002))
    return dict(body=b,bolt=bolt,bolt_o=(0,-0.02,-0.02),tip=(0,0.03,-0.435),eject=(0,0,0),sight=(0,0.093,-0.02),grip_r=(0,-0.075,0.125),grip_l=(0,0.012,-0.3))
# ---------------------------------------------------------------- RPG (tubo, guardas de madeira, ogiva)
def w_rpg():
    b=[]
    b.append(lathe(M,[(-0.4,0.024),(0.34,0.02),(0.45,0.036),(0.56,0.047),(0.561,0.043),(0.45,0.032),(0.34,0.016)],y=0.0,n=20,b=0.0))
    b.append(lathe(W,[(-0.3,0.031),(-0.04,0.031)],y=0.0,n=20,b=0.004));b.append(lathe(W,[(0.1,0.031),(0.3,0.031)],y=0.0,n=20,b=0.004))
    for zz in (-0.3,-0.04,0.1,0.3): b.append(lathe(S,[(zz-0.004,0.033),(zz+0.004,0.033)],y=0.0,n=20))
    b.append(prof(PL,[(0.0,-0.02),(0.045,-0.02),(0.07,-0.13),(0.028,-0.135),(0.015,-0.06)],0.032,b=0.008,segs=3))
    b.append(prof(PL,[(0.13,-0.02),(0.17,-0.02),(0.19,-0.11),(0.15,-0.115),(0.14,-0.06)],0.03,b=0.008,segs=3))
    b.append(box(0.012,0.004,0.07,0,-0.06,-0.01,M,bev=0.0012))
    b.append(box(0.03,0.05,0.12,-0.045,0.03,0.04,M,bev=0.004));b.append(lathe(RB,[(0.1,0.012),(0.14,0.016)],y=0.035,x=-0.045,n=14))
    b.append(box(0.004,0.035,0.01,0,0.045,-0.3,M,bev=0.001));b.append(box(0.012,0.03,0.008,0,0.045,0.0,M,bev=0.001))
    mag=[lathe(OL,[(-0.4,0.02),(-0.45,0.042),(-0.62,0.042),(-0.72,0.02),(-0.78,0.006),(-0.79,0.002)],y=0.0,n=20,b=0.0),lathe(S,[(-0.78,0.006),(-0.8,0.003)],y=0.0,n=10)]
    return dict(body=b,mag=mag,mag_o=(0,0,-0.45),tip=(0,0.0,-0.4),eject=(0,0,0),sight=(0,0.062,-0.1),grip_r=(0,-0.075,0.035),grip_l=(0,0.0,-0.18))
# ---------------------------------------------------------------- mãos (luva tática + manga)
def capsule(parts,a,b,r):
    A=G(*a);B=G(*b);d=B-A;L=max(d.length,1e-4)
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=L,vertices=12,location=(A+B)/2);o=bpy.context.object
    o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(d.normalized());parts.append(o)
    for P in (A,B): bpy.ops.mesh.primitive_uv_sphere_add(radius=r,segments=12,ring_count=8,location=P);parts.append(bpy.context.object)
def glove(parts,target=2600):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object
    rm=o.modifiers.new('rm','REMESH');rm.mode='VOXEL';rm.voxel_size=0.0026
    sm=o.modifiers.new('sm','SMOOTH');sm.factor=0.6;sm.iterations=6
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    dc=o.modifiers.new('dc','DECIMATE');dc.ratio=min(1.0,target/max(1,len(o.data.polygons)));bpy.ops.object.modifier_apply(modifier='dc')
    o.data.materials.clear();o.data.materials.append(mat('glove'));return o
def sleeve(start,d,r1,r2,L):
    A=G(*start);D=Vector((d[0],-d[2],d[1])).normalized()
    bpy.ops.mesh.primitive_cone_add(radius1=r1,radius2=r2,depth=L,vertices=18,location=A+D*(L/2));o=bpy.context.object
    o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(D);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    o.data.materials.append(mat('sleeve'));return o
def rake(p,deg=15):
    t=math.radians(-deg);x,y,z=p;return (x,y*math.cos(t)-z*math.sin(t),y*math.sin(t)+z*math.cos(t))
def hand_r():
    parts=[];R=lambda p:rake(p)
    b=box(0.024,0.09,0.075,*R((0.026,-0.005,0.006)),'glove',bev=0.009,segs=3,rot=(-15,0,0));parts.append(b)
    for pts,r in (([(0.022,0.034,-0.02),(0.016,0.038,-0.045),(0.008,0.04,-0.066)],0.0092),
                  ([(0.022,0.012,-0.02),(0.014,0.012,-0.034),(-0.004,0.012,-0.036),(-0.018,0.012,-0.022)],0.0095),
                  ([(0.022,-0.009,-0.02),(0.014,-0.009,-0.034),(-0.004,-0.009,-0.036),(-0.018,-0.009,-0.022)],0.009),
                  ([(0.02,-0.029,-0.018),(0.012,-0.029,-0.03),(-0.003,-0.029,-0.032),(-0.014,-0.029,-0.02)],0.008),
                  ([(0.02,0.028,0.034),(0.004,0.044,0.02),(-0.016,0.042,0.0),(-0.024,0.036,-0.02)],0.0105)):
        for i in range(len(pts)-1): capsule(parts,R(pts[i]),R(pts[i+1]),r)
    d=Vector((0.3,-0.4,0.87)).normalized();w0=R((0.026,-0.03,0.04));capsule(parts,w0,tuple(Vector(w0)+d*0.065),0.026)
    g=glove(parts)
    pad=box(0.008,0.07,0.03,*R((0.036,0.006,-0.014)),PL,bev=0.003,rot=(-15,0,0))
    sl=sleeve(tuple(Vector(w0)+d*0.05),tuple(d),0.035,0.047,0.36)
    cuff=sleeve(tuple(Vector(w0)+d*0.045),tuple(d),0.0365,0.037,0.02);cuff.data.materials.clear();cuff.data.materials.append(mat('gun_rubber'))
    return join('hand_r',[g,pad,sl,cuff],origin=(0,0,0),amount=0.18)
def hand_l():
    parts=[]
    parts.append(box(0.066,0.022,0.082,0.0,-0.034,0.004,'glove',bev=0.009,segs=3))
    for zf,r in ((-0.028,0.0092),(-0.009,0.0095),(0.01,0.0092),(0.029,0.008)):
        pts=[(0.024,-0.036,zf),(0.036,-0.016,zf),(0.034,0.008,zf),(0.022,0.024,zf)]
        for i in range(3): capsule(parts,pts[i],pts[i+1],r)
    pts=[(-0.024,-0.036,0.03),(-0.036,-0.016,0.016),(-0.032,0.006,-0.004),(-0.022,0.02,-0.02)]
    for i in range(3): capsule(parts,pts[i],pts[i+1],0.0105)
    d=Vector((-0.35,-0.55,0.76)).normalized();w0=(-0.008,-0.046,0.044);capsule(parts,w0,tuple(Vector(w0)+d*0.065),0.026)
    g=glove(parts)
    pad=box(0.008,0.028,0.07,0.042,-0.012,0.0,PL,bev=0.003)
    sl=sleeve(tuple(Vector(w0)+d*0.05),tuple(d),0.035,0.048,0.4)
    band=sleeve(tuple(Vector(w0)+d*0.2),tuple(d),0.0425,0.0445,0.05);band.data.materials.clear();band.data.materials.append(mat('armband'))
    cuff=sleeve(tuple(Vector(w0)+d*0.045),tuple(d),0.0365,0.037,0.02);cuff.data.materials.clear();cuff.data.materials.append(mat('gun_rubber'))
    return join('hand_l',[g,pad,sl,band,cuff],origin=(0,0,0),amount=0.18)


# ---------------------------------------------------------------- Revólver Magnum (tambor de 6, cão, cano com nervura, punho de madeira)
def w_pistol_mag():
    b=[]
    b.append(prof(M,[(-0.034,-0.004),(-0.034,0.044),(0.03,0.044),(0.034,0.03),(0.034,-0.008),(0.014,-0.022),(-0.034,-0.022)],0.028,b=0.004))
    b.append(lathe(S,[(-0.034,0.0115),(-0.2,0.0115),(-0.201,0.0125),(-0.214,0.0125)],y=0.028,n=18,b=0.001))
    b.append(box(0.009,0.008,0.18,0,0.043,-0.124,M,bev=0.0015))
    b.append(lathe(M,[(-0.034,0.0065),(-0.16,0.0065),(-0.161,0.008),(-0.168,0.008)],y=0.011,n=12,b=0.0008))
    b.append(box(0.004,0.012,0.006,0,0.052,-0.205,S,bev=0.0))
    for s in (-1,1): b.append(box(0.003,0.008,0.006,s*0.004,0.05,0.026,S,bev=0.0))
    b.append(prof(W,[(0.014,-0.006),(0.036,-0.006),(0.058,-0.104),(0.022,-0.112),(0.0,-0.034)],0.032,b=0.009,segs=3))
    for k in range(6): b.append(box(0.034,0.0025,0.004,0,-0.03-0.012*k,0.024+0.004*k,D,bev=0.0))
    b.append(box(0.012,0.004,0.052,0,-0.026,-0.02,M,bev=0.0012));b.append(box(0.012,0.026,0.004,0,-0.013,-0.046,M,bev=0.0012))
    b.append(box(0.005,0.018,0.005,0,-0.01,-0.018,S,bev=0.001,rot=(12,0,0)))
    mag=[lathe(S,[(-0.03,0.0),(-0.03,0.021),(0.022,0.021),(0.022,0.0)],y=0.02,n=24,b=0.0015)]
    for k in range(6):
        import math as _m
        a=k/6*6.283; mag.append(box(0.005,0.005,0.046,_m.cos(a)*0.02,0.02+_m.sin(a)*0.02,-0.004,D,bev=0.0))
    bolt=[box(0.006,0.02,0.014,0,0.046,0.038,S,bev=0.001,rot=(-28,0,0)),box(0.012,0.004,0.008,0,0.056,0.046,D,bev=0.0)]
    return dict(body=b,mag=mag,mag_o=(0,0.02,-0.004),bolt=bolt,bolt_o=(0,0.046,0.038),tip=(0,0.028,-0.216),eject=(0.02,0.03,0.0),sight=(0,0.056,-0.1),grip_r=(0,-0.046,0.03),grip_l=None)
# ---------------------------------------------------------------- Caçadeira de canos serrados (dois canos lado a lado, abertura por báscula)
def w_shotgun_db():
    b=[]
    b.append(prof(M,[(-0.08,-0.032),(-0.08,0.03),(0.06,0.03),(0.08,0.012),(0.08,-0.032)],0.052,b=0.006))
    for sx in (-0.0135,0.0135): b.append(lathe(S,[(-0.08,0.0128),(-0.42,0.0128),(-0.421,0.0138),(-0.432,0.0138)],y=0.012,x=sx,n=18,b=0.001))
    b.append(box(0.007,0.004,0.35,0,0.027,-0.25,M,bev=0.0008))
    b.append(cyly(0.0028,0.006,0,0.031,-0.42,BR,n=8))
    b.append(prof(W,[(-0.3,-0.004),(-0.3,-0.026),(-0.28,-0.034),(-0.1,-0.036),(-0.08,-0.004)],0.052,b=0.008,segs=3))
    b.append(prof(W,[(0.075,0.026),(0.12,0.02),(0.19,-0.02),(0.215,-0.1),(0.176,-0.112),(0.1,-0.052),(0.075,-0.032)],0.044,b=0.01,segs=3))
    b.append(box(0.012,0.006,0.034,0,0.036,0.066,S,bev=0.0012,rot=(0,20,0)))
    for sx in (-0.007,0.007): b.append(box(0.004,0.014,0.004,sx,-0.044,0.03+(0.012 if sx>0 else 0),S,bev=0.0008,rot=(12,0,0)))
    b.append(box(0.012,0.004,0.07,0,-0.058,0.03,M,bev=0.0012));b.append(box(0.012,0.024,0.004,0,-0.046,-0.003,M,bev=0.0012))
    for sx in (-0.012,0.012): b.append(box(0.005,0.014,0.01,sx,0.034,0.07,S,bev=0.001,rot=(-25,0,0)))
    return dict(body=b,tip=(0,0.012,-0.434),eject=(0,0.03,-0.07),sight=(0,0.034,-0.1),grip_r=(0,-0.07,0.13),grip_l=(0,-0.022,-0.2))
# ---------------------------------------------------------------- Sniper .50 (cano pesado, travão de boca, bipé, luneta grande)
def w_sniper_50():
    b=[]
    b.append(lathe(M,[(-0.13,0.022),(0.1,0.022)],y=0.0,n=20,b=0.002))
    b.append(lathe(M,[(-0.13,0.019),(-0.62,0.017),(-0.86,0.016)],y=0.0,n=20,b=0.0015))
    b.append(box(0.05,0.034,0.075,0,0.0,-0.9,D,bev=0.004))
    for zz in (-0.885,-0.9,-0.915):
        for s in (-1,1): b.append(box(0.008,0.02,0.008,s*0.024,0.0,zz,M,bev=0.0))
    b+=rail(-0.16,0.1,0.022)
    b.append(prof(D,[(-0.52,-0.004),(-0.52,-0.04),(-0.5,-0.05),(-0.13,-0.054),(-0.13,-0.004)],0.064,b=0.01,segs=3))
    b.append(prof(D,[(-0.13,-0.004),(-0.13,-0.056),(0.02,-0.056),(0.035,-0.03),(0.11,-0.03),(0.11,-0.004)],0.06,b=0.006))
    b.append(prof(RB,[(0.035,-0.03),(0.08,-0.03),(0.105,-0.14),(0.06,-0.145),(0.045,-0.064)],0.034,b=0.008,segs=3))
    b.append(prof(D,[(0.11,0.0),(0.125,0.034),(0.46,0.03),(0.465,-0.14),(0.44,-0.145),(0.3,-0.076),(0.16,-0.062),(0.11,-0.03)],0.056,b=0.01,segs=3))
    b.append(prof(RB,[(0.46,0.032),(0.48,0.032),(0.484,-0.142),(0.466,-0.146)],0.058,b=0.005))
    b.append(box(0.012,0.004,0.09,0,-0.074,0.0,M,bev=0.0012));b.append(box(0.006,0.02,0.005,0,-0.062,0.005,S,bev=0.001,rot=(12,0,0)))
    b.append(lathe(M,[(-0.3,0.036),(-0.25,0.036),(-0.205,0.02),(0.07,0.02),(0.105,0.026),(0.165,0.026)],y=0.088,n=26,b=0.0015))
    b.append(lathe(GL,[(-0.298,0.032),(-0.297,0.032)],y=0.088,n=26));b.append(lathe(GL,[(0.163,0.022),(0.164,0.022)],y=0.088,n=26))
    b.append(cyly(0.013,0.024,0,0.116,-0.07,M,n=16));b.append(cylx(0.013,0.024,0.028,0.088,-0.07,M,n=16))
    for zz in (-0.13,0.03): b.append(box(0.034,0.06,0.018,0,0.058,zz,M,bev=0.003))
    b.append(box(0.03,0.016,0.03,0,-0.03,-0.58,D,bev=0.003))
    for s in (-1,1): b.append(box(0.008,0.2,0.008,s*0.03,-0.13,-0.62,S,bev=0.001,rot=(20,0,s*14)))
    mag=[prof(M,[(-0.07,-0.05),(-0.07,-0.115),(0.01,-0.115),(0.01,-0.05)],0.036,b=0.003)]
    bolt=[lathe(S,[(0.05,0.011),(0.13,0.011)],y=0.0,n=14,b=0.001),box(0.007,0.007,0.056,0.046,-0.012,0.085,S,bev=0.001,rot=(0,0,-35)),lathe(S,[(0.08,0.001),(0.079,0.011),(0.099,0.011),(0.1,0.001)],y=-0.026,x=0.072,n=14)]
    return dict(body=b,mag=mag,mag_o=(0,-0.05,-0.03),bolt=bolt,bolt_o=(0.0,0.0,0.09),tip=(0,0.0,-0.94),eject=(0.02,0.01,0.0),sight=(0,0.088,0.0),grip_r=(0,-0.084,0.075),grip_l=(0,-0.03,-0.34))


import math as _m
def w_pistol_auto():  # pistola automática (Glock-18): compensador, carregador alongado, seletor vermelho
    b=[]
    b.append(prof(PL,[(-0.185,0.004),(-0.185,0.016),(-0.03,0.016),(-0.03,0.004)],0.024,b=0.003))
    b.append(prof(PL,[(-0.03,0.016),(0.012,0.016),(0.036,-0.095),(0.0,-0.102),(-0.012,-0.02)],0.03,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.05,0,-0.024,-0.045,PL,bev=0.001));b.append(box(0.012,0.026,0.004,0,-0.011,-0.068,PL,bev=0.001))
    b.append(box(0.005,0.018,0.005,0,-0.008,-0.04,S,bev=0.001,rot=(10,0,0)));b.append(box(0.006,0.008,0.012,0.016,0.03,0.0,RD,bev=0.001))
    for k in range(5): b.append(box(0.031,0.004,0.004,0,-0.03-0.014*k,0.02+0.003*k,D,bev=0.0))
    mag=[prof(M,[(-0.014,0.0),(0.006,0.0),(0.05,-0.17),(0.024,-0.176)],0.024,b=0.002),prof(PL,[(0.02,-0.172),(0.058,-0.168),(0.059,-0.182),(0.018,-0.186)],0.03,b=0.002)]
    bolt=[prof(M,[(-0.19,0.015),(-0.19,0.045),(-0.175,0.05),(0.0,0.05),(0.006,0.045),(0.006,0.015)],0.026,b=0.004),box(0.03,0.03,0.04,0,0.03,-0.21,D,bev=0.004)]
    for sd in (-1,1): bolt.append(box(0.004,0.008,0.012,sd*0.0135,0.038,-0.21,M,bev=0.0))
    for sx in (-0.0045,0.0045): bolt.append(box(0.006,0.007,0.005,sx,0.0535,0.0,M,bev=0.0008))
    bolt.append(box(0.004,0.006,0.005,0,0.053,-0.18,M,bev=0.0008))
    return dict(body=b,mag=mag,mag_o=(0.02,-0.08,0.01),bolt=bolt,bolt_o=(0,0.032,-0.09),tip=(0,0.03,-0.235),eject=(0.012,0.05,-0.03),sight=(0,0.0565,-0.08),grip_r=(0,-0.045,0.012),grip_l=None)
def w_smg_vespa():  # SM Vespa (Vector): corpo angular, supressor, coronha de esqueleto, punho frontal
    b=[]
    b.append(prof(PL,[(-0.3,0.0),(-0.3,0.03),(0.05,0.04),(0.12,0.04),(0.12,0.0),(-0.02,-0.06),(-0.12,-0.06),(-0.2,0.0)],0.05,b=0.006,segs=3))
    b+=rail(-0.26,0.1,0.042,w=0.02,m=PL)
    b.append(lathe(D,[(-0.3,0.016),(-0.43,0.016)],y=0.012,n=16,b=0.001))
    b.append(prof(PL,[(0.04,0.0),(0.06,0.0),(0.085,-0.11),(0.058,-0.115),(0.035,-0.02)],0.03,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.06,0,-0.05,0.0,PL,bev=0.001));b.append(box(0.005,0.018,0.005,0,-0.04,0.01,S,bev=0.001,rot=(12,0,0)))
    b.append(box(0.012,0.012,0.16,0,0.018,0.2,M,bev=0.002));b.append(prof(PL,[(0.26,0.03),(0.29,0.03),(0.29,-0.07),(0.26,-0.07)],0.03,b=0.004))
    b.append(box(0.034,0.05,0.04,0,-0.075,-0.22,PL,bev=0.004))
    b.append(box(0.012,0.012,0.006,0,0.054,-0.24,M,bev=0.0));b.append(box(0.014,0.012,0.006,0,0.054,0.06,M,bev=0.0))
    mag=[prof(M,[(-0.1,-0.055),(-0.07,-0.055),(-0.07,-0.2),(-0.1,-0.2)],0.028,b=0.003)]
    bolt=[box(0.012,0.012,0.03,0.03,0.02,-0.12,S,bev=0.002)]
    return dict(body=b,mag=mag,mag_o=(0,-0.06,-0.085),bolt=bolt,bolt_o=(0.03,0.02,-0.12),tip=(0,0.012,-0.435),eject=(0.025,0.02,-0.07),sight=(0,0.054,-0.1),grip_r=(0,-0.08,0.07),grip_l=(0,-0.075,-0.22))
def w_smg_45():  # SM .45 (UMP): caixa de polímero, carregador direito, coronha rebatível
    b=[]
    b.append(prof(PL,[(-0.26,-0.03),(-0.26,0.035),(0.1,0.035),(0.1,-0.03)],0.046,b=0.005))
    b+=rail(-0.2,0.08,0.037,w=0.02,m=M)
    b.append(lathe(M,[(-0.26,0.011),(-0.39,0.011),(-0.391,0.014),(-0.405,0.014)],y=0.008,n=14,b=0.001))
    b.append(prof(PL,[(0.02,-0.03),(0.05,-0.03),(0.075,-0.13),(0.045,-0.136),(0.02,-0.05)],0.032,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.06,0,-0.056,-0.01,PL,bev=0.001));b.append(box(0.005,0.018,0.005,0,-0.045,0.0,S,bev=0.001,rot=(12,0,0)))
    b.append(prof(PL,[(0.1,0.03),(0.32,0.02),(0.32,-0.07),(0.29,-0.07),(0.22,-0.01),(0.1,-0.01)],0.03,b=0.005))
    for zz in (-0.24,0.07): b.append(box(0.014,0.012,0.006,0,0.05,zz,M,bev=0.0))
    mag=[prof(PL,[(-0.09,-0.03),(-0.055,-0.03),(-0.045,-0.2),(-0.08,-0.205)],0.028,b=0.003)]
    bolt=[box(0.01,0.012,0.028,-0.028,0.018,-0.18,S,bev=0.002)]
    return dict(body=b,mag=mag,mag_o=(0,-0.03,-0.07),bolt=bolt,bolt_o=(-0.028,0.018,-0.18),tip=(0,0.008,-0.41),eject=(0.025,0.02,-0.07),sight=(0,0.056,-0.1),grip_r=(0,-0.08,0.06),grip_l=(0,-0.01,-0.2))
def w_ar_tac():  # espingarda tática (M4): guarda-mão de calha, tapa-chamas, coronha retrátil
    b=[]
    b.append(prof(M,[(-0.16,-0.03),(-0.16,0.03),(0.08,0.03),(0.08,-0.03)],0.042,b=0.004))
    b+=rail(-0.16,0.08,0.032,w=0.021,m=M)
    b.append(prof(M,[(-0.42,-0.026),(-0.42,0.028),(-0.16,0.028),(-0.16,-0.026)],0.05,b=0.004))
    for zz in (-0.39,-0.34,-0.29,-0.24,-0.19):
        for sd in (-1,1): b.append(box(0.002,0.03,0.018,sd*0.0255,0.0,zz,D,bev=0.0))
    b+=rail(-0.42,-0.16,0.03,w=0.02,m=M)
    b.append(lathe(M,[(-0.42,0.0095),(-0.6,0.0095),(-0.601,0.013),(-0.64,0.013)],y=0.004,n=14,b=0.001))
    for zz in (-0.61,-0.625):
        for sd in (-1,1): b.append(box(0.003,0.02,0.006,sd*0.012,0.004,zz,D,bev=0.0))
    b.append(prof(PL,[(0.03,-0.03),(0.06,-0.03),(0.085,-0.13),(0.055,-0.136),(0.03,-0.05)],0.032,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.06,0,-0.056,-0.01,M,bev=0.001));b.append(box(0.005,0.018,0.005,0,-0.045,0.0,S,bev=0.001,rot=(12,0,0)))
    b.append(lathe(M,[(0.08,0.014),(0.3,0.014)],y=0.0,n=14,b=0.001))
    b.append(prof(PL,[(0.2,0.03),(0.33,0.028),(0.335,-0.08),(0.3,-0.085),(0.2,-0.03)],0.04,b=0.008,segs=3))
    b.append(box(0.014,0.018,0.008,0,0.05,-0.4,M,bev=0.001));b.append(box(0.016,0.016,0.012,0,0.05,0.06,M,bev=0.001))
    mag=[prof(M,[(-0.1,-0.03),(-0.06,-0.03),(-0.05,-0.19),(-0.09,-0.195)],0.024,b=0.003)]
    bolt=[box(0.016,0.008,0.03,0,0.036,0.07,S,bev=0.002)]
    return dict(body=b,mag=mag,mag_o=(0,-0.03,-0.08),bolt=bolt,bolt_o=(0,0.036,0.07),tip=(0,0.004,-0.642),eject=(0.03,0.02,-0.03),sight=(0,0.0625,-0.12),grip_r=(0,-0.088,0.07),grip_l=(0,-0.008,-0.31))
def w_ar_choque():  # espingarda de choque (SCAR-H): cor areia, carregador grande, travão de boca
    b=[]
    b.append(prof(T,[(-0.2,-0.034),(-0.2,0.034),(0.08,0.034),(0.08,-0.034)],0.046,b=0.005))
    b+=rail(-0.36,0.08,0.036,w=0.021,m=D)
    b.append(prof(T,[(-0.4,-0.028),(-0.4,0.03),(-0.2,0.03),(-0.2,-0.028)],0.05,b=0.005))
    b.append(lathe(M,[(-0.4,0.011),(-0.6,0.011)],y=0.004,n=14,b=0.001));b.append(box(0.03,0.026,0.05,0,0.004,-0.62,D,bev=0.003))
    for zz in (-0.605,-0.62,-0.635):
        for sd in (-1,1): b.append(box(0.006,0.014,0.006,sd*0.015,0.004,zz,M,bev=0.0))
    b.append(prof(PL,[(0.03,-0.034),(0.06,-0.034),(0.085,-0.135),(0.055,-0.14),(0.03,-0.054)],0.032,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.06,0,-0.06,-0.01,M,bev=0.001));b.append(box(0.005,0.018,0.005,0,-0.049,0.0,S,bev=0.001,rot=(12,0,0)))
    b.append(prof(T,[(0.08,0.03),(0.33,0.024),(0.335,-0.09),(0.3,-0.095),(0.2,-0.04),(0.08,-0.034)],0.042,b=0.008,segs=3))
    b.append(prof(RB,[(0.33,0.026),(0.35,0.026),(0.352,-0.092),(0.335,-0.096)],0.044,b=0.004))
    b.append(box(0.014,0.02,0.008,0,0.054,-0.34,D,bev=0.001));b.append(box(0.016,0.018,0.012,0,0.054,0.05,D,bev=0.001))
    mag=[prof(M,[(-0.11,-0.034),(-0.06,-0.034),(-0.055,-0.2),(-0.105,-0.204)],0.03,b=0.003)]
    bolt=[box(0.01,0.012,0.03,-0.028,0.016,-0.12,S,bev=0.002)]
    return dict(body=b,mag=mag,mag_o=(0,-0.034,-0.085),bolt=bolt,bolt_o=(-0.028,0.016,-0.12),tip=(0,0.004,-0.648),eject=(0.03,0.02,-0.03),sight=(0,0.066,-0.12),grip_r=(0,-0.09,0.07),grip_l=(0,-0.01,-0.31))
def w_lmg_light():  # metralhadora ligeira (M249 Para): bolsa de munições, bipé recolhido
    b=[]
    b.append(prof(M,[(-0.2,-0.04),(-0.2,0.04),(0.1,0.04),(0.1,-0.04)],0.06,b=0.006))
    b.append(prof(PL,[(-0.42,-0.03),(-0.42,0.03),(-0.2,0.03),(-0.2,-0.03)],0.056,b=0.006))
    b.append(lathe(M,[(-0.42,0.012),(-0.6,0.012),(-0.601,0.015),(-0.63,0.015)],y=0.0,n=14,b=0.001))
    b.append(box(0.03,0.02,0.04,0,0.05,-0.12,D,bev=0.004))
    b.append(prof(PL,[(0.04,-0.04),(0.07,-0.04),(0.095,-0.14),(0.065,-0.146),(0.04,-0.06)],0.034,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.06,0,-0.066,-0.01,M,bev=0.001));b.append(box(0.005,0.018,0.005,0,-0.055,0.0,S,bev=0.001,rot=(12,0,0)))
    b.append(lathe(M,[(0.1,0.014),(0.26,0.014)],y=-0.01,n=12,b=0.001));b.append(prof(PL,[(0.2,0.02),(0.3,0.018),(0.305,-0.08),(0.27,-0.085),(0.2,-0.03)],0.042,b=0.008))
    for sd in (-1,1): b.append(box(0.007,0.007,0.2,sd*0.015,-0.04,-0.5,S,bev=0.001))
    mag=[prof(OL,[(-0.12,-0.04),(-0.02,-0.04),(-0.02,-0.15),(-0.12,-0.15)],0.07,x=-0.02,b=0.012,segs=3)]
    bolt=[prof(M,[(-0.18,0.04),(-0.18,0.052),(0.06,0.052),(0.06,0.04)],0.056,b=0.003)]
    return dict(body=b,mag=mag,mag_o=(-0.02,-0.09,-0.07),bolt=bolt,bolt_o=(0.0,0.046,-0.06),tip=(0,0.0,-0.632),eject=(0.0,-0.045,-0.05),sight=(0,0.08,0.05),grip_r=(0,-0.09,0.075),grip_l=(0,-0.03,-0.27))
def w_lmg_heavy():  # metralhadora pesada (M60): camisa de arrefecimento, caixa de munições, pega, bipé aberto
    b=[]
    b.append(prof(D,[(-0.22,-0.046),(-0.22,0.046),(0.12,0.046),(0.12,-0.046)],0.064,b=0.006))
    b.append(lathe(D,[(-0.22,0.024),(-0.62,0.024)],y=0.0,n=18,b=0.002))
    for k in range(10):
        zz=-0.26-k*0.035
        for a in range(4):
            ang=a*1.5708+0.785; b.append(box(0.006,0.006,0.012,_m.cos(ang)*0.024,_m.sin(ang)*0.024,zz,M,bev=0.0))
    b.append(lathe(M,[(-0.62,0.014),(-0.76,0.014),(-0.761,0.018),(-0.8,0.018)],y=0.0,n=14,b=0.001))
    b.append(box(0.012,0.05,0.012,0,0.06,-0.3,M,bev=0.002));b.append(box(0.012,0.012,0.12,0,0.085,-0.3,M,bev=0.002))
    b.append(prof(W,[(0.04,-0.046),(0.075,-0.046),(0.1,-0.15),(0.066,-0.156),(0.04,-0.066)],0.036,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.06,0,-0.072,-0.01,M,bev=0.001));b.append(box(0.005,0.018,0.005,0,-0.06,0.0,S,bev=0.001,rot=(12,0,0)))
    b.append(prof(W,[(0.12,0.04),(0.4,0.03),(0.405,-0.1),(0.37,-0.105),(0.24,-0.05),(0.12,-0.046)],0.05,b=0.01,segs=3))
    for sd in (-1,1): b.append(box(0.008,0.22,0.008,sd*0.04,-0.12,-0.58,S,bev=0.001,rot=(24,0,sd*12)))
    mag=[prof(OL,[(-0.12,-0.046),(0.0,-0.046),(0.0,-0.17),(-0.12,-0.17)],0.08,x=-0.03,b=0.006)]
    bolt=[prof(M,[(-0.2,0.046),(-0.2,0.06),(0.08,0.06),(0.08,0.046)],0.064,b=0.003)]
    return dict(body=b,mag=mag,mag_o=(-0.03,-0.1,-0.06),bolt=bolt,bolt_o=(0.0,0.053,-0.06),tip=(0,0.0,-0.802),eject=(0.0,-0.05,-0.05),sight=(0,0.092,0.05),grip_r=(0,-0.1,0.08),grip_l=(0,-0.04,-0.3))
def w_shotgun_auto():  # caçadeira semiautomática (Benelli M4): punho de pistola, coronha retrátil, miras de anel
    b=[]
    b.append(prof(M,[(-0.1,-0.036),(-0.1,0.034),(0.12,0.034),(0.14,0.018),(0.14,-0.036)],0.044,b=0.006))
    b.append(lathe(M,[(-0.1,0.0125),(-0.6,0.0125),(-0.601,0.0135),(-0.62,0.0135)],y=0.02,n=18,b=0.001))
    b.append(lathe(D,[(-0.1,0.012),(-0.52,0.012)],y=-0.012,n=16,b=0.001))
    b.append(prof(PL,[(-0.4,-0.03),(-0.4,0.006),(-0.12,0.006),(-0.12,-0.03)],0.05,b=0.008,segs=3))
    b+=rail(-0.08,0.12,0.036,w=0.02,m=D)
    b.append(box(0.014,0.02,0.01,0,0.05,0.1,D,bev=0.001));b.append(box(0.012,0.016,0.008,0,0.044,-0.58,D,bev=0.001))
    b.append(prof(PL,[(0.14,-0.036),(0.17,-0.036),(0.195,-0.14),(0.165,-0.146),(0.14,-0.056)],0.034,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.07,0,-0.066,0.07,M,bev=0.0012));b.append(box(0.006,0.02,0.005,0,-0.05,0.07,S,bev=0.001,rot=(12,0,0)))
    b.append(lathe(M,[(0.14,0.014),(0.36,0.014)],y=0.0,n=12,b=0.001));b.append(prof(PL,[(0.3,0.03),(0.44,0.026),(0.445,-0.1),(0.41,-0.105),(0.3,-0.04)],0.042,b=0.008,segs=3))
    b.append(prof(RB,[(0.44,0.028),(0.46,0.028),(0.462,-0.1),(0.445,-0.104)],0.044,b=0.004))
    bolt=[box(0.016,0.012,0.03,0.03,0.01,-0.02,S,bev=0.002)]
    return dict(body=b,bolt=bolt,bolt_o=(0.03,0.01,-0.02),tip=(0,0.02,-0.622),eject=(0.03,0.012,-0.03),sight=(0,0.058,-0.1),grip_r=(0,-0.09,0.165),grip_l=(0,-0.014,-0.28))
def w_sniper_semi():  # sniper semiautomático (atirador designado): apoio de face, luneta curta
    b=[]
    b.append(prof(D,[(-0.16,-0.036),(-0.16,0.03),(0.1,0.03),(0.1,-0.036)],0.046,b=0.005))
    b+=rail(-0.16,0.1,0.03,w=0.021,m=D)
    b.append(prof(PL,[(-0.46,-0.03),(-0.46,0.026),(-0.16,0.026),(-0.16,-0.03)],0.052,b=0.006))
    b.append(lathe(M,[(-0.46,0.011),(-0.7,0.011),(-0.701,0.015),(-0.74,0.015)],y=0.0,n=16,b=0.001))
    b.append(prof(PL,[(0.04,-0.036),(0.07,-0.036),(0.095,-0.14),(0.065,-0.146),(0.04,-0.056)],0.032,b=0.006,segs=3))
    b.append(box(0.012,0.004,0.06,0,-0.062,-0.01,M,bev=0.001));b.append(box(0.005,0.018,0.005,0,-0.05,0.0,S,bev=0.001,rot=(12,0,0)))
    b.append(prof(PL,[(0.1,0.03),(0.42,0.024),(0.425,-0.12),(0.39,-0.125),(0.26,-0.06),(0.1,-0.036)],0.046,b=0.01,segs=3))
    b.append(box(0.028,0.014,0.14,0,0.04,0.3,PL,bev=0.004))
    b.append(lathe(M,[(-0.22,0.024),(-0.19,0.024),(-0.16,0.015),(0.05,0.015),(0.08,0.019),(0.12,0.019)],y=0.072,n=22,b=0.0015))
    b.append(lathe(GL,[(-0.218,0.021),(-0.217,0.021)],y=0.072,n=22));b.append(lathe(GL,[(0.118,0.016),(0.119,0.016)],y=0.072,n=22))
    for zz in (-0.12,0.02): b.append(box(0.028,0.045,0.014,0,0.05,zz,M,bev=0.003))
    mag=[prof(M,[(-0.1,-0.036),(-0.05,-0.036),(-0.045,-0.15),(-0.095,-0.154)],0.028,b=0.003)]
    bolt=[box(0.01,0.012,0.028,0.028,0.012,-0.06,S,bev=0.002)]
    return dict(body=b,mag=mag,mag_o=(0,-0.036,-0.075),bolt=bolt,bolt_o=(0.028,0.012,-0.06),tip=(0,0.0,-0.742),eject=(0.02,0.01,0.0),sight=(0,0.072,0.0),grip_r=(0,-0.08,0.07),grip_l=(0,-0.026,-0.32))

ALL={'ar':w_ar,'smg':w_smg,'shotgun':w_shotgun,'sniper':w_sniper,'lmg':w_lmg,'pistol':w_pistol,'gl':w_gl,'rpg':w_rpg,'pistol_mag':w_pistol_mag,'shotgun_db':w_shotgun_db,'sniper_50':w_sniper_50,'pistol_auto':w_pistol_auto,'smg_vespa':w_smg_vespa,'smg_45':w_smg_45,'ar_tac':w_ar_tac,'ar_choque':w_ar_choque,'lmg_light':w_lmg_light,'lmg_heavy':w_lmg_heavy,'shotgun_auto':w_shotgun_auto,'sniper_semi':w_sniper_semi}
for name,fn in ALL.items():
    if ONLY and name not in ONLY: continue
    spec=fn();objs=[join('body',spec['body'],origin=(0,0,0))]
    if spec.get('mag'): objs.append(join('mag',spec['mag'],origin=spec['mag_o']))
    if spec.get('bolt'): objs.append(join('bolt',spec['bolt'],origin=spec['bolt_o']))
    for k in ('tip','eject','sight','grip_r','grip_l'):
        if spec.get(k): objs.append(empty(k,*spec[k]))
    if name=='ar':
        export('ar',objs,clear=False)
        meshes=[o for o in objs if o.type=='MESH'];dup=[]
        for o in meshes:
            c=o.copy();c.data=o.data.copy();sc.collection.objects.link(c);c.matrix_world=o.matrix_world.copy();dup.append(c)
        for o in objs: o.name=o.name+'_hi'
        bpy.ops.object.select_all(action='DESELECT')
        for c in dup: c.select_set(True)
        bpy.context.view_layer.objects.active=dup[0];bpy.ops.object.join();lo=bpy.context.object;lo.name='body';lo.data.name='body'
        dc=lo.modifiers.new('dc','DECIMATE');dc.ratio=0.22;bpy.ops.object.modifier_apply(modifier='dc')
        lo_objs=[lo,empty('tip',*spec['tip']),empty('eject',*spec['eject']),empty('grip_r',*spec['grip_r'])]
        for o in objs: bpy.data.objects.remove(o,do_unlink=True)
        export('ar_lo',lo_objs)
    else: export(name,objs)
if not ONLY or 'hands' in ONLY:
    export('hands',[hand_r(),hand_l()])
log('done')
