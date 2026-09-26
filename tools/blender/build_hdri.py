"""Render physically-based sky HDRIs (Nishita) for each level theme. CC0 output. Usage: python build_hdri.py <out_dir>"""
import bpy, sys, os, math, json, time
args=[a for a in sys.argv[1:] if not a.endswith('.py')];OUT=args[0];ONLY=args[1].split(',') if len(args)>1 else None;os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=8;sc.cycles.use_denoising=False
sc.render.resolution_x=2048;sc.render.resolution_y=1024;sc.render.resolution_percentage=100
sc.render.image_settings.file_format='HDR';sc.render.image_settings.color_management='OVERRIDE';sc.view_settings.view_transform='Standard'
cam_data=bpy.data.cameras.new('c');cam=bpy.data.objects.new('cam',cam_data);sc.collection.objects.link(cam);sc.camera=cam
cam_data.type='PANO';cam_data.panorama_type='EQUIRECTANGULAR';cam.location=(0,0,1.6);cam.rotation_euler=(math.radians(90),0,0)
w=bpy.data.worlds.new('sky');sc.world=w;w.use_nodes=True;nt=w.node_tree;nt.nodes.clear()
out=nt.nodes.new('ShaderNodeOutputWorld');bg=nt.nodes.new('ShaderNodeBackground');sky=nt.nodes.new('ShaderNodeTexSky');sky.sky_type='MULTIPLE_SCATTERING'
nt.links.new(sky.outputs['Color'],bg.inputs['Color']);nt.links.new(bg.outputs['Background'],out.inputs['Surface'])
THEMES={
 'day':   dict(elev=52,rot=40,intensity=1.0,alt=200,air=1.0,dust=0.6,ozone=1.0,strength=1.0),
 'dusk':  dict(elev=7,rot=250,intensity=0.9,alt=100,air=1.4,dust=2.5,ozone=0.9,strength=1.0),
 'overcast':dict(elev=48,rot=120,intensity=0.35,alt=50,air=2.0,dust=6.0,ozone=1.5,strength=0.45),
 'golden':dict(elev=12,rot=200,intensity=1.0,alt=150,air=1.2,dust=3.0,ozone=1.0,strength=1.0),
 'night': dict(elev=-6,rot=300,intensity=0.02,alt=200,air=1.0,dust=0.3,ozone=1.0,strength=0.35),
}
for name,t in THEMES.items():
    if ONLY and name not in ONLY: continue
    sky.sun_elevation=math.radians(t['elev']);sky.sun_rotation=math.radians(t['rot']);sky.sun_intensity=t['intensity'];sky.altitude=t['alt'];sky.air_density=t['air'];sky.aerosol_density=t['dust'];sky.ozone_density=t['ozone'];sky.sun_size=math.radians(0.7 if name!='overcast' else 3.0)
    bg.inputs['Strength'].default_value=t['strength']
    sc.render.filepath=os.path.join(OUT,'sky_%s.hdr'%name);t0=time.time();bpy.ops.render.render(write_still=True)
    print('[hdri]',name,round(time.time()-t0,1),'s',os.path.getsize(sc.render.filepath),flush=True)
print('[hdri] done')
