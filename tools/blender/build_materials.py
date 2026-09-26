"""Bake tileable PBR texture sets (color/normal/roughness) from procedural Blender materials, CC0.
Uses a torus-mapped 4D noise so every texture tiles seamlessly. Usage: python build_materials.py <out_dir> [size]"""
import bpy, sys, os, math, time
args=[a for a in sys.argv[1:] if not a.endswith('.py')]
OUT=args[0]; SIZE=int(args[1]) if len(args)>1 else 1024; ONLY=args[2].split(',') if len(args)>2 else None
os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.device='CPU'
log=lambda *a:print('[mat]',*a,flush=True)
def lin(h):
    f=lambda c:((c/255)/12.92 if c/255<=0.04045 else (((c/255)+0.055)/1.055)**2.4)
    return (f(h>>16&255),f(h>>8&255),f(h&255),1.0)
bpy.ops.mesh.primitive_plane_add(size=1);plane=bpy.context.object
def tile_coords(nt,scale):
    """returns (vector_socket, w_socket) of a torus mapping of UV -> tileable 4D coords"""
    uv=nt.nodes.new('ShaderNodeUVMap');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(uv.outputs['UV'],sep.inputs['Vector'])
    def trig(src,op):
        m=nt.nodes.new('ShaderNodeMath');m.operation='MULTIPLY';m.inputs[1].default_value=2*math.pi;nt.links.new(src,m.inputs[0])
        t=nt.nodes.new('ShaderNodeMath');t.operation=op;nt.links.new(m.outputs[0],t.inputs[0])
        s=nt.nodes.new('ShaderNodeMath');s.operation='MULTIPLY';s.inputs[1].default_value=scale;nt.links.new(t.outputs[0],s.inputs[0]);return s.outputs[0]
    cx=trig(sep.outputs['X'],'COSINE');sx=trig(sep.outputs['X'],'SINE');cy=trig(sep.outputs['Y'],'COSINE');sy=trig(sep.outputs['Y'],'SINE')
    comb=nt.nodes.new('ShaderNodeCombineXYZ');nt.links.new(cx,comb.inputs['X']);nt.links.new(sx,comb.inputs['Y']);nt.links.new(cy,comb.inputs['Z'])
    return comb.outputs['Vector'],sy
def noise(nt,vec,w,scale,detail=6,rough=0.6,distortion=0.0):
    n=nt.nodes.new('ShaderNodeTexNoise');n.noise_dimensions='4D';n.inputs['Scale'].default_value=scale;n.inputs['Detail'].default_value=detail;n.inputs['Roughness'].default_value=rough;n.inputs['Distortion'].default_value=distortion
    nt.links.new(vec,n.inputs['Vector']);nt.links.new(w,n.inputs['W']);return n
def voronoi(nt,vec,w,scale,feature='F1'):
    n=nt.nodes.new('ShaderNodeTexVoronoi');n.voronoi_dimensions='4D';n.feature=feature;n.inputs['Scale'].default_value=scale
    nt.links.new(vec,n.inputs['Vector']);nt.links.new(w,n.inputs['W']);return n
def ramp(nt,fac,stops):
    r=nt.nodes.new('ShaderNodeValToRGB');cr=r.color_ramp
    while len(cr.elements)<len(stops): cr.elements.new(0.5)
    for i,(pos,col) in enumerate(stops): cr.elements[i].position=pos;cr.elements[i].color=lin(col) if isinstance(col,int) else col
    nt.links.new(fac,r.inputs['Fac']);return r
def mixrgb(nt,fac,a,b,mode='MIX'):
    m=nt.nodes.new('ShaderNodeMixRGB');m.blend_type=mode
    if isinstance(fac,(int,float)): m.inputs['Fac'].default_value=fac
    else: nt.links.new(fac,m.inputs['Fac'])
    for sock,v in (('Color1',a),('Color2',b)):
        if isinstance(v,tuple): m.inputs[sock].default_value=v
        elif isinstance(v,int): m.inputs[sock].default_value=lin(v)
        else: nt.links.new(v,m.inputs[sock])
    return m
def bump(nt,height,strength,dist=0.02):
    b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=strength;b.inputs['Distance'].default_value=dist;nt.links.new(height,b.inputs['Height']);return b
def make(name,build):
    m=bpy.data.materials.new(name);m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
    out=nt.nodes.new('ShaderNodeOutputMaterial');b=nt.nodes.new('ShaderNodeBsdfPrincipled');nt.links.new(b.outputs['BSDF'],out.inputs['Surface'])
    build(nt,b);plane.data.materials.clear();plane.data.materials.append(m)
    for kind in ('DIFFUSE','NORMAL','ROUGHNESS'):
        img=bpy.data.images.new(name+kind,SIZE,SIZE,alpha=False)
        if kind!='DIFFUSE': img.colorspace_settings.name='Non-Color'
        tex=nt.nodes.new('ShaderNodeTexImage');tex.image=img;nt.nodes.active=tex
        bpy.ops.object.select_all(action='DESELECT');plane.select_set(True);bpy.context.view_layer.objects.active=plane
        sc.cycles.samples=2 if kind=='DIFFUSE' else 1
        if kind=='DIFFUSE': bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},margin=0,use_clear=True)
        elif kind=='NORMAL': bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT',margin=0,use_clear=True)
        else: bpy.ops.object.bake(type='ROUGHNESS',margin=0,use_clear=True)
        suffix={'DIFFUSE':'color','NORMAL':'normal','ROUGHNESS':'rough'}[kind]
        img.filepath_raw=os.path.join(OUT,'%s_%s.png'%(name,suffix));img.file_format='PNG';img.save();nt.nodes.remove(tex)
    log('baked',name)

def grass(nt,b):
    v,w=tile_coords(nt,1.0)
    blades=noise(nt,v,w,90,8,0.75);patches=noise(nt,v,w,3,4,0.5);clover=voronoi(nt,v,w,40)
    base=ramp(nt,blades.outputs['Fac'],[(0.25,0x2f6a22),(0.5,0x4a8f2c),(0.75,0x6fae3a)])
    dry=mixrgb(nt,patches.outputs['Fac'],base.outputs['Color'],0x8a9a3a);dry.inputs['Fac'].default_value=0.0
    m2=mixrgb(nt,patches.outputs['Fac'],base.outputs['Color'],dry.outputs['Color'],'MIX')
    dark=mixrgb(nt,clover.outputs['Distance'],m2.outputs['Color'],0x24501a);dark.blend_type='MULTIPLY'
    nt.links.new(m2.outputs['Color'],b.inputs['Base Color'])
    hb=noise(nt,v,w,140,7,0.8);bp=bump(nt,hb.outputs['Fac'],0.9,0.01);nt.links.new(bp.outputs['Normal'],b.inputs['Normal'])
    rr=ramp(nt,blades.outputs['Fac'],[(0.3,(0.85,0.85,0.85,1)),(0.7,(0.6,0.6,0.6,1))]);nt.links.new(rr.outputs['Color'],b.inputs['Roughness'])
def concrete(nt,b):
    v,w=tile_coords(nt,1.0)
    fine=noise(nt,v,w,60,8,0.7);coarse=noise(nt,v,w,6,5,0.6);pits=voronoi(nt,v,w,45,'SMOOTH_F1')
    base=ramp(nt,coarse.outputs['Fac'],[(0.3,0x7d7b76),(0.7,0x9a978f)])
    spec=mixrgb(nt,fine.outputs['Fac'],base.outputs['Color'],0x5d5b57);spec.inputs['Fac'].default_value=0.25
    m=mixrgb(nt,0.35,spec.outputs['Color'],base.outputs['Color'])
    stain=noise(nt,v,w,2,3,0.5);st=mixrgb(nt,stain.outputs['Fac'],m.outputs['Color'],0x6a675f);st.blend_type='MULTIPLY';st.inputs['Fac'].default_value=0.35
    nt.links.new(st.outputs['Color'],b.inputs['Base Color'])
    hmix=mixrgb(nt,0.5,fine.outputs['Fac'],pits.outputs['Distance']);bp=bump(nt,hmix.outputs['Color'],0.45,0.02);nt.links.new(bp.outputs['Normal'],b.inputs['Normal'])
    rr=ramp(nt,fine.outputs['Fac'],[(0.2,(0.95,0.95,0.95,1)),(0.8,(0.7,0.7,0.7,1))]);nt.links.new(rr.outputs['Color'],b.inputs['Roughness'])
def metal_painted(nt,b):
    v,w=tile_coords(nt,1.0)
    scratches=noise(nt,v,w,30,6,0.9,distortion=1.5);wear=noise(nt,v,w,4,4,0.5)
    base=mixrgb(nt,0.0,0x8a8d93,0x8a8d93)
    rust=ramp(nt,wear.outputs['Fac'],[(0.55,(1,1,1,1)),(0.75,(0.0,0,0,1))])
    m=mixrgb(nt,rust.outputs['Color'],0x6a4a2a,base.outputs['Color'])
    sc_=ramp(nt,scratches.outputs['Fac'],[(0.42,(1,1,1,1)),(0.5,(0.6,0.6,0.6,1)),(0.55,(1,1,1,1))]);m2=mixrgb(nt,0.6,m.outputs['Color'],sc_.outputs['Color'],'MULTIPLY')
    nt.links.new(m2.outputs['Color'],b.inputs['Base Color']);b.inputs['Metallic'].default_value=0.7
    bp=bump(nt,scratches.outputs['Fac'],0.12,0.01);nt.links.new(bp.outputs['Normal'],b.inputs['Normal'])
    rr=ramp(nt,wear.outputs['Fac'],[(0.3,(0.35,0.35,0.35,1)),(0.8,(0.65,0.65,0.65,1))]);nt.links.new(rr.outputs['Color'],b.inputs['Roughness'])
def rubber_track(nt,b):
    v,w=tile_coords(nt,1.0)
    grain=noise(nt,v,w,120,7,0.7);wear=noise(nt,v,w,3,3,0.5)
    base=ramp(nt,grain.outputs['Fac'],[(0.3,0x3d3a38),(0.7,0x55514e)])
    m=mixrgb(nt,wear.outputs['Fac'],base.outputs['Color'],0x2e2b2a);m.inputs['Fac'].default_value=0.5
    nt.links.new(m.outputs['Color'],b.inputs['Base Color'])
    bp=bump(nt,grain.outputs['Fac'],0.5,0.008);nt.links.new(bp.outputs['Normal'],b.inputs['Normal']);b.inputs['Roughness'].default_value=0.85
def plastic(nt,b):
    v,w=tile_coords(nt,1.0)
    grain=noise(nt,v,w,200,4,0.6);nt.links.new(grain.outputs['Fac'],b.inputs['Base Color'])
    bp=bump(nt,grain.outputs['Fac'],0.08,0.004);nt.links.new(bp.outputs['Normal'],b.inputs['Normal']);b.inputs['Roughness'].default_value=0.45
def corrugated(nt,b):
    v,w=tile_coords(nt,1.0)
    uv=nt.nodes.new('ShaderNodeUVMap');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(uv.outputs['UV'],sep.inputs['Vector'])
    m=nt.nodes.new('ShaderNodeMath');m.operation='MULTIPLY';m.inputs[1].default_value=2*math.pi*16;nt.links.new(sep.outputs['X'],m.inputs[0])
    s=nt.nodes.new('ShaderNodeMath');s.operation='SINE';nt.links.new(m.outputs[0],s.inputs[0])
    rust=noise(nt,v,w,5,5,0.7);grain=noise(nt,v,w,80,6,0.7)
    base=mixrgb(nt,0.0,0xb9b9b9,0xb9b9b9);rm=ramp(nt,rust.outputs['Fac'],[(0.55,(1,1,1,1)),(0.8,(0,0,0,1))])
    col=mixrgb(nt,rm.outputs['Color'],0x7a4a26,base.outputs['Color']);col2=mixrgb(nt,0.3,col.outputs['Color'],grain.outputs['Fac'],'MULTIPLY')
    nt.links.new(col2.outputs['Color'],b.inputs['Base Color']);b.inputs['Metallic'].default_value=0.5;b.inputs['Roughness'].default_value=0.55
    bp=bump(nt,s.outputs[0],0.9,0.03);nt.links.new(bp.outputs['Normal'],b.inputs['Normal'])
ALL={'grass':grass,'concrete':concrete,'metal_painted':metal_painted,'rubber_track':rubber_track,'plastic':plastic,'corrugated':corrugated}
for k,fn in ALL.items():
    if ONLY is None or k in ONLY: make(k,fn)
log('done')
