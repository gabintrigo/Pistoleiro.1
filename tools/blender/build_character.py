"""Build the base football character (rigged, skinned, Mixamo bone names) with MPFB2 in headless Blender.
Outputs: <out>/human_base.glb (armature + body/hair/eyes/kit + layered animations), textures (skin tones, kits).
Usage: bpyenv/bin/python build_character.py <out_dir>
Licenses: MakeHuman base mesh/targets/rigs (MPFB2) and eyes are CC0; everything generated here is CC0."""
import bpy, sys, importlib, os, math, json, mathutils, time
OUT=sys.argv[-1]; os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')
def dyn(pkg,key):
    for amod in list(sys.modules):
        if amod.endswith(pkg): return getattr(importlib.import_module(amod),key)
    raise ValueError(pkg)
HumanService=dyn("mpfb.services.humanservice","HumanService");TargetService=dyn("mpfb.services.targetservice","TargetService")
MH='/tmp/mhassets/makehuman-master/makehuman/data'
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=4;sc.cycles.device='CPU'
log=lambda *a:print('[build]',*a,flush=True)

# ---------------- human ----------------
d=TargetService.get_default_macro_info_dict()
d.update({'gender':1.0,'age':0.42,'muscle':0.72,'weight':0.48,'height':0.62,'proportions':0.55})
d['race']={'african':0.0,'asian':0.0,'caucasian':1.0}
h=HumanService.create_human(macro_detail_dict=d)
h.name='Body'
me=h.data
vg={g.name:g.index for g in h.vertex_groups}
def in_group(v,gi,th=0.5): return any(g.group==gi and g.weight>th for g in v.groups)
eye_vs=[v.co.copy() for v in me.vertices if in_group(v,vg['helper-l-eye'])]
eye_c=sum(eye_vs,mathutils.Vector())/len(eye_vs)
log('eye center',[round(x,3) for x in eye_c])

# ---------------- rig ----------------
rig=HumanService.add_builtin_rig(h,'mixamo')
rig.name='Armature'
log('bones',len(rig.data.bones))

# ---------------- eyes ----------------
eyes=HumanService.add_mhclo_asset(MH+'/eyes/low-poly/low-poly.mhclo',h,asset_type='Eyes')
eyes.name='Eyes'
if not any(m.type=='ARMATURE' for m in eyes.modifiers):
    am=eyes.modifiers.new('Armature','ARMATURE');am.object=rig
if 'mixamorig:Head' not in [g.name for g in eyes.vertex_groups]:
    g=eyes.vertex_groups.new(name='mixamorig:Head');g.add([v.index for v in eyes.data.vertices],1.0,'REPLACE')
eyes.parent=rig
log('eyes ok',len(eyes.data.vertices))

# ---------------- split helper geometry into hair cap and kit ----------------
def separate_by_vertices(src,keep_pred,name):
    """Duplicate src, keep only vertices satisfying keep_pred, return new object (weights/UVs preserved)."""
    bpy.ops.object.select_all(action='DESELECT');src.select_set(True);bpy.context.view_layer.objects.active=src
    bpy.ops.object.duplicate();dup=bpy.context.active_object;dup.name=name
    dm=dup.data
    for v in dm.vertices: v.select=not keep_pred(v)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_mode(type='VERT');bpy.ops.mesh.delete(type='VERT');bpy.ops.object.mode_set(mode='OBJECT')
    for mod in list(dup.modifiers):
        if mod.type=='MASK': dup.modifiers.remove(mod)
    return dup
hair_gi=vg['helper-hair'];tights_gi=vg['helper-tights'];body_gi=vg['body']
hair=separate_by_vertices(h,lambda v:in_group(v,hair_gi,0.05) and ((v.co.y<eye_c.y+0.04 and v.co.z>eye_c.z+0.052) or (eye_c.y+0.04<=v.co.y<eye_c.y+0.12 and v.co.z>eye_c.z+0.02) or (v.co.y>=eye_c.y+0.12 and v.co.z>eye_c.z-0.035)),'Hair')
kit=separate_by_vertices(h,lambda v:in_group(v,tights_gi,0.05) and ((0.93<v.co.z<1.425 and abs(v.co.x)<0.34 and not (v.co.z>1.372 and abs(v.co.x)<0.078)) or (0.60<v.co.z<=0.93) or (0.10<v.co.z<0.42)),'Kit')
# body: keep only 'body' group
body=separate_by_vertices(h,lambda v:in_group(v,body_gi,0.1),'BodyMesh')
bpy.data.objects.remove(h,do_unlink=True);body.name='Body';h=body;h.data.name='Body';hair.data.name='Hair';kit.data.name='Kit'
log('body verts',len(h.data.vertices),'hair',len(hair.data.vertices),'kit',len(kit.data.vertices))
for o in (hair,kit):
    o.parent=rig
    if not any(m.type=='ARMATURE' for m in o.modifiers):
        am=o.modifiers.new('Armature','ARMATURE');am.object=rig
hs=hair.modifiers.new('Sub','SUBSURF');hs.levels=1;hs.render_levels=1
solid=hair.modifiers.new('Solid','SOLIDIFY');solid.thickness=0.016;solid.offset=1.0
ksb=kit.modifiers.new('Sub','SUBSURF');ksb.levels=1;ksb.render_levels=1
ks=kit.modifiers.new('Solid','SOLIDIFY');ks.thickness=0.004;ks.offset=1.0
for o in (h,hair,kit):
    for p in o.data.polygons: p.use_smooth=True

# ---------------- materials ----------------
def rgb(h,a=1.0):
    lin=lambda c:((c/255)/12.92 if c/255<=0.04045 else (((c/255)+0.055)/1.055)**2.4)
    return (lin(h>>16&255),lin(h>>8&255),lin(h&255),a)
def skin_material(name,tone,dark):
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;nodes=nt.nodes;links=nt.links;nodes.clear()
    out=nodes.new('ShaderNodeOutputMaterial');bsdf=nodes.new('ShaderNodeBsdfPrincipled')
    tc=nodes.new('ShaderNodeTexCoord');n1=nodes.new('ShaderNodeTexNoise');n1.inputs['Scale'].default_value=22;n1.inputs['Detail'].default_value=8;n1.inputs['Roughness'].default_value=0.7
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=0.35;ramp.color_ramp.elements[0].color=rgb(dark);ramp.color_ramp.elements[1].position=0.7;ramp.color_ramp.elements[1].color=rgb(tone)
    links.new(tc.outputs['Object'],n1.inputs['Vector']);links.new(n1.outputs['Fac'],ramp.inputs['Fac']);links.new(ramp.outputs['Color'],bsdf.inputs['Base Color'])
    n2=nodes.new('ShaderNodeTexNoise');n2.inputs['Scale'].default_value=1400;n2.inputs['Detail'].default_value=3
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=0.35;bump.inputs['Distance'].default_value=0.0006
    links.new(tc.outputs['Object'],n2.inputs['Vector']);links.new(n2.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value=0.52
    links.new(bsdf.outputs['BSDF'],out.inputs['Surface']);return m
def flat_material(name,col,rough=0.6,metal=0.0,emit=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;b=nt.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=rgb(col);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
    if emit is not None:
        b.inputs['Emission Color'].default_value=rgb(emit);b.inputs['Emission Strength'].default_value=1.0
    return m
TONES={'light':(0xe8b898,0xc48a68),'tan':(0xc98d63,0x9a6642),'dark':(0x6e4630,0x4a2d1e)}
def assign_body_materials(tone):
    t,dk=TONES[tone]
    skin=skin_material('skin_'+tone,t,dk);lips=skin_material('lips_'+tone,int(t*0.0+0x000000)|0xb06a5a if tone=='light' else (0x8a4a3a if tone=='tan' else 0x5a2e24),dk)
    nails=flat_material('nails_'+tone,0xf1d9c4,0.35)
    h.data.materials.clear()
    for name in ['body','nipple','lips','fingernails','toenails','ears','genitals']:
        h.data.materials.append({'lips':lips,'fingernails':nails,'toenails':nails}.get(name,skin))
# eye material check
log('eye mats',[m.name for m in eyes.data.materials])
hair_mat=flat_material('hair',0x1e120a,0.5);hair.data.materials.clear();hair.data.materials.append(hair_mat)

# ---------------- kit material slots by region ----------------
km=kit.data
shirt=flat_material('shirt',0xd8202a,0.75);shorts=flat_material('shorts',0x1c2f6b,0.7);socks=flat_material('socks',0xffffff,0.8)
km.materials.clear();km.materials.append(shirt);km.materials.append(shorts);km.materials.append(socks)
for p in km.polygons:
    z=sum(km.vertices[i].co.z for i in p.vertices)/len(p.vertices)
    p.material_index=0 if z>0.93 else (1 if z>0.5 else 2)

# ---------------- bake helpers ----------------
def bake_object(obj,size,kind,path,samples=4):
    img=bpy.data.images.new(obj.name+'_'+kind,size,size,alpha=False)
    if kind=='NORMAL': img.colorspace_settings.name='Non-Color'
    for m in obj.data.materials:
        nt=m.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=img;nt.nodes.active=tex
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    sc.cycles.samples=samples
    if kind=='DIFFUSE': bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},margin=12,use_clear=True)
    elif kind=='NORMAL': bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT',margin=12,use_clear=True)
    elif kind=='EMIT': bpy.ops.object.bake(type='EMIT',margin=12,use_clear=True)
    img.filepath_raw=path;img.file_format='PNG';img.save()
    for m in obj.data.materials:
        nt=m.node_tree
        for n in [n for n in nt.nodes if n.type=='TEX_IMAGE' and n.image==img]: nt.nodes.remove(n)
    return img

# UV utilities for post-paint (eyebrows, boots)
def uv_pixels(obj,vert_pred,size):
    uvl=obj.data.uv_layers.active.data;pts=[]
    for p in obj.data.polygons:
        for li,vi in zip(p.loop_indices,p.vertices):
            v=obj.data.vertices[vi]
            if vert_pred(v):
                u,w=uvl[li].uv;pts.append((u*size,(1-w)*size))
    return pts
def uv_faces(obj,face_pred,size):
    uvl=obj.data.uv_layers.active.data;polys=[]
    for p in obj.data.polygons:
        if face_pred(p):
            polys.append([(uvl[li].uv[0]*size,(1-uvl[li].uv[1])*size) for li in p.loop_indices])
    return polys

# ---------------- bake skins ----------------
from PIL import Image, ImageDraw, ImageFilter
skins={}
for tone,size in [('light',2048),('tan',1024),('dark',1024)]:
    assign_body_materials(tone)
    t0=time.time();path=os.path.join(OUT,'skin_%s.png'%tone);bake_object(h,size,'DIFFUSE',path)
    # post-paint: eyebrows + boots + scalp shading
    im=Image.open(path).convert('RGB');dr=ImageDraw.Draw(im)
    for side in (-1,1):
        brow=uv_pixels(h,lambda v:(eye_c.z+0.02<v.co.z<eye_c.z+0.042) and 0.012<side*v.co.x<0.056 and v.co.y<eye_c.y+0.03,size)
        if len(brow)>=2:
            brow=sorted(brow);dr.line(brow,fill=(46,30,18),width=max(2,int(size/170)),joint='curve')
    boots=uv_faces(h,lambda p:max(h.data.vertices[i].co.z for i in p.vertices)<0.085,size)
    for poly in boots: dr.polygon(poly,fill=(18,18,20))
    scalp=uv_faces(h,lambda p:all(hair_gi_ok for hair_gi_ok in [True]) and sum(h.data.vertices[i].co.z for i in p.vertices)/len(p.vertices)>eye_c.z+0.06 and sum(h.data.vertices[i].co.y for i in p.vertices)/len(p.vertices)>eye_c.y-0.02,size)
    for poly in scalp: dr.polygon(poly,fill=(70,48,32))
    im=im.filter(ImageFilter.GaussianBlur(0.6));im.save(path,optimize=True)
    skins[tone]=path;log('skin',tone,'baked',round(time.time()-t0,1),'s')
assign_body_materials('light')
t0=time.time();bake_object(h,2048,'NORMAL',os.path.join(OUT,'skin_normal.png'),samples=2);log('normal baked',round(time.time()-t0,1))

# ---------------- bake kits (emission colours per region) ----------------
TEAMS=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'teams.json')))
def set_kit_colours(shirtc,shortsc,socksc,stripes=None):
    for m,c in ((shirt,shirtc),(shorts,shortsc),(socks,socksc)):
        nt=m.node_tree;b=nt.nodes['Principled BSDF']
        for n in [n for n in nt.nodes if n.name.startswith('kitstripe')]: nt.nodes.remove(n)
        if m is shirt and stripes:
            tc=nt.nodes.new('ShaderNodeTexCoord');tc.name='kitstripe_tc';sep=nt.nodes.new('ShaderNodeSeparateXYZ');sep.name='kitstripe_sep'
            mm=nt.nodes.new('ShaderNodeMath');mm.name='kitstripe_m1';mm.operation='MULTIPLY';mm.inputs[1].default_value=14.0
            md=nt.nodes.new('ShaderNodeMath');md.name='kitstripe_m2';md.operation='MODULO';md.inputs[1].default_value=2.0
            lt=nt.nodes.new('ShaderNodeMath');lt.name='kitstripe_m3';lt.operation='LESS_THAN';lt.inputs[1].default_value=1.0
            mix=nt.nodes.new('ShaderNodeMixRGB');mix.name='kitstripe_mix';mix.inputs['Color1'].default_value=rgb(c);mix.inputs['Color2'].default_value=rgb(stripes)
            nt.links.new(tc.outputs['Object'],sep.inputs['Vector']);nt.links.new(sep.outputs['X'],mm.inputs[0]);nt.links.new(mm.outputs[0],md.inputs[0]);nt.links.new(md.outputs[0],lt.inputs[0]);nt.links.new(lt.outputs[0],mix.inputs['Fac'])
            nt.links.new(mix.outputs['Color'],b.inputs['Emission Color'])
        else:
            for l in list(b.inputs['Emission Color'].links): nt.links.remove(l)
            b.inputs['Emission Color'].default_value=rgb(c)
        b.inputs['Emission Strength'].default_value=1.0
kits={}
for team in TEAMS:
    for variant in ('outfield','gk'):
        k=team['gk'] if variant=='gk' else team
        set_kit_colours(k['shirt'],k['shorts'],k['socks'],team.get('stripes') if variant=='outfield' else None)
        path=os.path.join(OUT,'kit_%s_%s.png'%(team['key'],variant));bake_object(kit,512,'EMIT',path,samples=1)
        kits[team['key']+'_'+variant]=path
# player kit
set_kit_colours(0xc8102e,0x0b6b3a,0xffffff);bake_object(kit,512,'EMIT',os.path.join(OUT,'kit_player.png'),samples=1)
# back-of-shirt UV box for numbers (world-space back = +Y)
back=uv_pixels(kit,lambda v:v.co.z>1.05 and v.co.z<1.32 and v.co.y>0.02 and abs(v.co.x)<0.12,512)
bb=[min(p[0] for p in back),min(p[1] for p in back),max(p[0] for p in back),max(p[1] for p in back)] if back else None
log('shirt back uv box',bb)
# reset kit to neutral colours for export (texture swapped at runtime)
for m in (shirt,shorts,socks):
    b=m.node_tree.nodes['Principled BSDF'];b.inputs['Emission Strength'].default_value=0.0
    for l in list(b.inputs['Emission Color'].links): m.node_tree.links.remove(l)
kit_tex=bpy.data.images.load(os.path.join(OUT,'kit_player.png'))
for m in (shirt,shorts,socks):
    nt=m.node_tree;b=nt.nodes['Principled BSDF'];tex=nt.nodes.new('ShaderNodeTexImage');tex.image=kit_tex;nt.links.new(tex.outputs['Color'],b.inputs['Base Color'])
# skin export material: baked textures
assign_body_materials('light')
skin_tex=bpy.data.images.load(skins['light']);nrm_tex=bpy.data.images.load(os.path.join(OUT,'skin_normal.png'));nrm_tex.colorspace_settings.name='Non-Color'
exp_skin=bpy.data.materials.new('SkinBaked');exp_skin.use_nodes=True;nt=exp_skin.node_tree;b=nt.nodes['Principled BSDF'];b.inputs['Roughness'].default_value=0.55
ti=nt.nodes.new('ShaderNodeTexImage');ti.image=skin_tex;nt.links.new(ti.outputs['Color'],b.inputs['Base Color'])
tn=nt.nodes.new('ShaderNodeTexImage');tn.image=nrm_tex;nm=nt.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=0.6;nt.links.new(tn.outputs['Color'],nm.inputs['Color']);nt.links.new(nm.outputs['Normal'],b.inputs['Normal'])
h.data.materials.clear();h.data.materials.append(exp_skin)

# ---------------- animations (layered: lower = hips+legs, upper = spine+arms+head) ----------------
FPS=24;sc.render.fps=FPS
def bone(name): return rig.pose.bones[name]
B={'hips':'mixamorig:Hips','sp':'mixamorig:Spine','sp1':'mixamorig:Spine1','sp2':'mixamorig:Spine2','neck':'mixamorig:Neck','head':'mixamorig:Head',
   'lul':'mixamorig:LeftUpLeg','ll':'mixamorig:LeftLeg','lf':'mixamorig:LeftFoot','rul':'mixamorig:RightUpLeg','rl':'mixamorig:RightLeg','rf':'mixamorig:RightFoot',
   'lsh':'mixamorig:LeftShoulder','la':'mixamorig:LeftArm','lfa':'mixamorig:LeftForeArm','lh':'mixamorig:LeftHand','rsh':'mixamorig:RightShoulder','ra':'mixamorig:RightArm','rfa':'mixamorig:RightForeArm','rh':'mixamorig:RightHand'}
LOWER=['hips','lul','ll','lf','rul','rl','rf'];UPPER=['sp','sp1','sp2','neck','head','lsh','la','lfa','lh','rsh','ra','rfa','rh']
for pb in rig.pose.bones: pb.rotation_mode='QUATERNION'
def rot(key,rx,ry,rz):
    pb=bone(B[key]);R=mathutils.Euler((math.radians(rx),math.radians(ry),math.radians(rz)),'XYZ').to_matrix();M=pb.bone.matrix_local.to_3x3()
    pb.rotation_quaternion=(M.inverted()@R@M).to_quaternion()
def hips_loc(wx,wy,wz):
    pb=bone(B['hips']);M=pb.bone.matrix_local.to_3x3();pb.location=M.inverted()@mathutils.Vector((wx,wy,wz))
def key_pose(frame,keys,loc=None):
    for k in keys:
        pb=bone(B[k]);pb.keyframe_insert('rotation_quaternion',frame=frame)
    if loc is not None:
        hips_loc(*loc);pb=bone(B['hips']);pb.keyframe_insert('location',frame=frame)
def reset_pose():
    for pb in rig.pose.bones: pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
def new_action(name):
    reset_pose();a=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=a;return a
def push_nla(a):
    tr=rig.animation_data.nla_tracks.new();tr.name=a.name;st=tr.strips.new(a.name,int(a.frame_range[0]),a);rig.animation_data.action=None
S=lambda t,ph=0:math.sin(2*math.pi*t+ph);Cc=lambda t,ph=0:math.cos(2*math.pi*t+ph)
# smoothed triangle wave: nearly constant angular velocity through stance (less foot slide than a pure sine)
TRI=lambda t:(2/math.pi)*math.asin(math.sin(2*math.pi*t));SW=lambda t:0.7*TRI(t)+0.3*S(t)
def aim_pose(sway=0.0):
    rot('sp',0,0,10);rot('sp1',-3,0,4);rot('head',2,0,-8)
    rot('la',-62+sway,8,-38);rot('lfa',-48,0,-10);rot('lh',0,0,-20)
    rot('ra',-55+sway,-4,26);rot('rfa',-70,0,20);rot('rh',0,0,10)
def gait(name,period,thigh,knee,arm,lean,bob,armFore,hipRoll=4,hipYaw=6):
    """game-style locomotion cycle: stance/swing legs with knee flexion in swing, foot roll, pelvis roll/yaw with
    torso counter-rotation, opposite arm swing. thigh/knee/arm in degrees, period in seconds."""
    a=new_action(name);n=int(period*FPS)
    def leg(ul,ll,ft,ph):
        fwd=thigh*SW(ph)                      # thigh forward angle (+ = forward), smoothed-triangle profile
        sw=max(0.0,Cc(ph))                    # 1 at mid-swing (leg passing under the body moving forward), 0 in stance
        kn=knee*sw**1.3+7*max(0.0,-Cc(ph))**2 # big flex in swing, small flex at mid-stance
        toe=14*max(0.0,S(ph+0.12))**3         # toe-off push at the end of stance
        rot(ul,-fwd,0,0);rot(ll,kn,0,0);rot(ft,(fwd-kn)*0.75-6*sw+toe,0,0)
    for f in range(n+1):
        t=f/n
        rot('hips',-lean,hipRoll*S(t),hipYaw*S(t))
        leg('lul','ll','lf',t);leg('rul','rl','rf',t+0.5)
        key_pose(f,LOWER,loc=(0,0,-bob*(1-abs(Cc(t)))))
    a.use_frame_range=True;a.frame_range=(0,n);push_nla(a)
    # matching upper body (used when not aiming): torso counter-rotates the pelvis, arms swing opposite to the legs
    a2=new_action(name+'_upper')
    for f in range(n+1):
        t=f/n
        rot('sp',-lean*0.6,-hipRoll*0.5*S(t),-hipYaw*0.9*S(t));rot('sp1',-lean*0.2,0,-hipYaw*0.3*S(t));rot('head',lean*0.6,0,hipYaw*0.4*S(t))
        la_f=-arm*S(t);ra_f=arm*S(t)          # left arm swings with the right leg
        rot('la',-la_f,0,-7);rot('lfa',-armFore-armFore*0.45*max(0.0,la_f/max(1,arm)),0,0)
        rot('ra',-ra_f,0,7);rot('rfa',-armFore-armFore*0.45*max(0.0,ra_f/max(1,arm)),0,0)
        key_pose(f,UPPER)
    a2.use_frame_range=True;a2.frame_range=(0,n);push_nla(a2)
def simple(name,length,fn,keys,loop=True):
    a=new_action(name);n=int(length*FPS)
    for f in range(n+1):
        fn(f/n)
        for k in keys: bone(B[k]).keyframe_insert('rotation_quaternion',frame=f)
        if 'hips' in keys: bone(B['hips']).keyframe_insert('location',frame=f)
    a.use_frame_range=True;a.frame_range=(0,n);push_nla(a)
# idle
def idle_l(t): rot('hips',0,0,1.5*S(t));rot('lul',1.5*S(t),0,0);rot('rul',-1.5*S(t),0,0);hips_loc(0,0,0.004*S(t))
simple('idle',2.4,idle_l,LOWER)
def idle_u(t): rot('sp',1.2*S(t),0,0);rot('sp1',1.0*S(t,0.6),0,0);rot('head',1.5*S(t,1.2),0,0);rot('la',-4,0,-5+2*S(t));rot('lfa',-12,0,0);rot('ra',-4,0,5-2*S(t));rot('rfa',-12,0,0)
simple('idle_upper',2.4,idle_u,UPPER)
gait('walk',1.0,26,42,22,3,0.02,28,hipRoll=4,hipYaw=6)
gait('jog',0.72,36,62,40,8,0.035,70,hipRoll=3,hipYaw=8)
gait('sprint',0.56,48,80,55,14,0.05,85,hipRoll=3,hipYaw=10)
# strafes: lateral step (rotation about Y = forward axis in Blender for a -Y facing character)
def strafe(name,sign):
    a=new_action(name);n=int(0.9*FPS)
    for f in range(n+1):
        t=f/n
        rot('hips',0,sign*4*S(t),0);rot('lul',6*S(t),sign*(-14+18*S(t)),0);rot('rul',-6*S(t),sign*(14+18*S(t)),0)
        rot('ll',16*max(0,S(t)),0,0);rot('rl',16*max(0,-S(t)),0,0);key_pose(f,LOWER,loc=(0,0,0.008*abs(S(t*2))))
    a.use_frame_range=True;a.frame_range=(0,n);push_nla(a)
strafe('strafe_left',1);strafe('strafe_right',-1)
# aim / shoot / reload: two-bone IK on both arms so the hands actually hold a rifle (grip + foregrip), then baked to FK
SC=bpy.context.scene;IK_EMPTIES={};IK_CONS=[]
def add_empty(nm,pos):
    e=bpy.data.objects.new(nm,None);SC.collection.objects.link(e);e.location=pos;IK_EMPTIES[nm]=e;return e
# character faces -Y; its RIGHT side is -X. grip near the right shoulder line, foregrip ~0.36 m forward along the barrel
GRIP=(-0.10,-0.26,1.28);FORE=(-0.05,-0.54,1.32)
for nm,pos in {'ik_r':GRIP,'ik_l':FORE,'pole_r':(-0.55,0.35,0.85),'pole_l':(0.35,-0.30,0.7)}.items(): add_empty(nm,pos)
def add_ik(fa,tgt,pole):
    pb=bone(B[fa]);con=pb.constraints.new('IK');con.target=IK_EMPTIES[tgt];con.pole_target=IK_EMPTIES[pole];con.chain_count=2;con.use_tail=True;con.mute=True;IK_CONS.append(con);return con
con_r=add_ik('rfa','ik_r','pole_r');con_l=add_ik('lfa','ik_l','pole_l')
def choose_pole(con,arm,fa,side):
    """pick the pole angle that puts the elbow low, outward and slightly back (natural rifle hold)"""
    con.mute=False;best=(-1e9,0)
    for ang in range(-180,180,15):
        con.pole_angle=math.radians(ang);reset_pose();bpy.context.view_layer.update()
        sh=bone(B[arm]).head;e=bone(B[fa]).head;h=bone(B[fa]).tail
        score=(sh.z-e.z)*1.0+side*(e.x-sh.x)*1.2+(e.y-max(sh.y,h.y))*0.4
        if score>best[0]: best=(score,ang)
    con.pole_angle=math.radians(best[1]);con.mute=True;return best
reset_pose();bpy.context.view_layer.update();log('arm geometry: left shoulder joint',[round(v,3) for v in bone(B['la']).head],'upper',round(bone(B['la']).length,3),'fore',round(bone(B['lfa']).length,3),'right shoulder',[round(v,3) for v in bone(B['ra']).head])
log('pole right',choose_pole(con_r,'ra','rfa',-1),'pole left',choose_pole(con_l,'la','lfa',1))
def ik_clip(name,length,fn,loop=True):
    n=int(length*FPS);frames=[]
    for con in IK_CONS: con.mute=False
    for f in range(n+1):
        t=f/n;reset_pose();fn(t);bpy.context.view_layer.update()
        frames.append({k:rig.convert_space(pose_bone=bone(B[k]),matrix=bone(B[k]).matrix,from_space='POSE',to_space='LOCAL').to_quaternion() for k in UPPER})
        if name=='aim' and f==0:
            rh=bone(B['rh']).head;lh=bone(B['lh']).head;re=bone(B['rfa']).head;le=bone(B['lfa']).head
            log('aim hands (armature space) right',[round(v,3) for v in rh],'left',[round(v,3) for v in lh],'elbows',[round(v,2) for v in re],[round(v,2) for v in le],'target err',round((rh-mathutils.Vector(GRIP)).length,3),round((lh-mathutils.Vector(FORE)).length,3))
    for con in IK_CONS: con.mute=True
    a=new_action(name)
    for f,fr in enumerate(frames):
        for k,q in fr.items(): pb=bone(B[k]);pb.rotation_quaternion=q;pb.keyframe_insert('rotation_quaternion',frame=f)
    a.use_frame_range=True;a.frame_range=(0,n);push_nla(a)
def set_targets(gr,fo):
    IK_EMPTIES['ik_r'].location=gr;IK_EMPTIES['ik_l'].location=fo
def aim_ik(t,sway=1.0):
    s1=0.004*S(t)*sway;s2=0.006*S(t,0.8)*sway
    set_targets((GRIP[0]+s1,GRIP[1],GRIP[2]+s2),(FORE[0]+s1,FORE[1],FORE[2]+s2))
    rot('sp',0,0,-32);rot('sp1',-2,0,0);rot('head',5,0,26);rot('rh',0,0,0);rot('lh',0,0,0)
ik_clip('aim',2.0,aim_ik)
def shoot_ik(t):
    k=max(0,1-t*3.5);aim_ik(t,0.0)
    set_targets((GRIP[0],GRIP[1]+0.045*k,GRIP[2]+0.01*k),(FORE[0],FORE[1]+0.045*k,FORE[2]+0.025*k))
    rot('sp1',-2-4*k,0,3);rot('head',4+3*k,0,-7)
ik_clip('shoot',0.25,shoot_ik,False)
def reload_ik(t):
    p=math.sin(math.pi*min(1,t/0.8)) if t<0.8 else 0;aim_ik(t,0.0)
    set_targets(GRIP,(FORE[0]-0.04*p,FORE[1]+0.30*p,FORE[2]-0.34*p))
    rot('head',4+12*p,0,-7)
ik_clip('reload',1.7,reload_ik,False)
for e in IK_EMPTIES.values(): e.hide_render=True
def hit(t):
    k=math.sin(math.pi*t);rot('sp',8*k,0,0);rot('sp1',6*k,0,0);rot('head',9*k,0,4*k);rot('la',-20*k,0,-12);rot('ra',-20*k,0,12)
simple('hit',0.45,hit,UPPER,False)
# headshot + death: full body, non-loop
def headshot(t):
    k=min(1,t*2.2);rot('head',38*k,0,10*k);rot('neck',10*k,0,0);rot('sp1',12*k,0,0);rot('sp',6*k,0,0);rot('la',-45*k,0,-20);rot('lfa',-30*k,0,0);rot('ra',-45*k,0,20);rot('rfa',-30*k,0,0);rot('lul',4*k,0,0);rot('rul',-4*k,0,0);hips_loc(0,0,-0.02*k)
simple('headshot',0.6,headshot,LOWER+UPPER,False)
def death(t):
    k1=min(1,t/0.45);k2=max(0,min(1,(t-0.4)/0.6))
    rot('lul',-78*k1,0,0);rot('rul',-78*k1,0,0);rot('ll',95*k1,0,0);rot('rl',95*k1,0,0)
    rot('sp',20*k1+45*k2,0,6*k2);rot('sp1',10*k1+15*k2,0,0);rot('head',-10*k1+35*k2,0,10*k2);rot('la',-30*k1-30*k2,0,-25);rot('ra',-30*k1-25*k2,0,25);rot('lfa',-20*k2,0,0);rot('rfa',-20*k2,0,0)
    rot('hips',-8*k1-70*k2,0,0);hips_loc(0,0,-0.55*k1-0.32*k2)
simple('death',1.25,death,LOWER+UPPER,False)
def death_back(t):
    k=min(1,t/0.9);rot('hips',75*k,0,0);rot('sp',-10*k,0,0);rot('head',-20*k,0,0);rot('la',-70*k,0,-30);rot('ra',-70*k,0,30);rot('lul',-10*k,0,0);rot('rul',-10*k,0,0);rot('ll',15*k,0,0);rot('rl',15*k,0,0);hips_loc(0,0.15*k,-0.85*k)
simple('death_back',1.1,death_back,LOWER+UPPER,False)
reset_pose()
log('animations',[t.name for t in rig.animation_data.nla_tracks])

# ---------------- export ----------------
for o in (h,hair,kit,eyes): o.parent=rig
bpy.ops.object.select_all(action='DESELECT')
for o in (rig,h,hair,kit,eyes): o.select_set(True)
bpy.context.view_layer.objects.active=rig
out=os.path.join(OUT,'human_base.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_apply=True,export_skins=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True,export_image_format='AUTO',export_texcoords=True,export_normals=True,export_materials='EXPORT',export_def_bones=False,export_optimize_animation_size=True)
log('exported',out,os.path.getsize(out))
json.dump({'skins':skins,'kits':kits,'shirt_back_uv':bb,'eye_center':list(eye_c)},open(os.path.join(OUT,'human_base.meta.json'),'w'),indent=1)
# preview render
bpy.ops.object.select_all(action='DESELECT')
cam_data=bpy.data.cameras.new('cam');cam=bpy.data.objects.new('cam',cam_data);sc.collection.objects.link(cam);cam.location=(1.6,-2.6,1.3);cam.rotation_euler=(math.radians(82),0,math.radians(31));sc.camera=cam;cam_data.lens=60
sun=bpy.data.lights.new('sun','SUN');sun.energy=3;so=bpy.data.objects.new('sun',sun);sc.collection.objects.link(so);so.rotation_euler=(math.radians(50),math.radians(20),math.radians(-30))
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(0.5,0.6,0.75,1);w.node_tree.nodes['Background'].inputs[1].default_value=0.6
sc.render.resolution_x=640;sc.render.resolution_y=900;sc.cycles.samples=32;sc.render.filepath=os.path.join(OUT,'preview_character.png');bpy.ops.render.render(write_still=True)
# pose preview: sprint + aim mid-cycle
rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks: tr.mute=not (tr.name in ('sprint','aim'))
sc.frame_set(0);bpy.context.view_layer.update();log('NLA aim check at frame 0: right hand',[round(v,3) for v in bone(B['rh']).head],'left hand',[round(v,3) for v in bone(B['lh']).head],'right elbow',[round(v,2) for v in bone(B['rfa']).head])
sc.frame_set(6);sc.render.filepath=os.path.join(OUT,'preview_pose.png');bpy.ops.render.render(write_still=True)
log('preview done')
