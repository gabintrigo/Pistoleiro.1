"""First-person hands: right fist around a vertical grip (origin = grip point), left hand cupped under a horizontal
handguard (origin = handguard point); forearms with sleeves run back towards the shooter (+z). CC0."""
import bpy, sys, os, math
args=[a for a in sys.argv[1:] if not a.endswith('.py')];OUT=args[0];os.makedirs(OUT,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene
MATS={}
def mat(name):
    if name in MATS: return MATS[name]
    m=bpy.data.materials.new(name);m.use_nodes=True;MATS[name]=m;return m
def box(w,h,d,x,y,z,m,rot=(0,0,0),bev=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.scale=(w,d,h);o.location=(x,-z,y);o.rotation_euler=(math.radians(rot[0]),math.radians(-rot[2]),math.radians(rot[1]))
    bpy.ops.object.transform_apply(scale=True,rotation=True);o.data.materials.append(mat(m))
    if bev>0:
        b=o.modifiers.new('bev','BEVEL');b.width=min(bev,min(w,h,d)*0.3);b.segments=2;b.limit_method='ANGLE';b.angle_limit=math.radians(40)
    return o
def cylz(r,l,x,y,z,m,n=12,tilt=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r,depth=l,vertices=n);o=bpy.context.object;o.location=(x,-z,y);o.rotation_euler=(math.radians(90+tilt[0]),math.radians(tilt[1]),math.radians(tilt[2]))
    bpy.ops.object.transform_apply(rotation=True);o.data.materials.append(mat(m));return o
def join(name,objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    for o in objs:
        bpy.context.view_layer.objects.active=o
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;o.data.name=name
    for p in o.data.polygons: p.use_smooth=True
    return o
S,K='skin','sleeve'
# ---- right hand: fist around a vertical grip (grip axis = y through origin) ----
r=[box(0.055,0.085,0.075,0.045,0.0,0.0,S)]                 # palm (right of the grip)
for i,(y,zz) in enumerate(((0.03,-0.01),(0.01,-0.01),(-0.01,-0.01),(-0.03,-0.01))):
    r.append(box(0.06,0.02,0.02,0.01,y,-0.045,S,rot=(0,0,0)))   # finger knuckles across the front
    r.append(box(0.02,0.02,0.05,-0.035,y,-0.02,S))               # finger tips wrapping the left side
r.append(box(0.022,0.05,0.022,-0.005,0.04,0.02,S,rot=(0,0,-35)))  # thumb over the top
r.append(cylz(0.032,0.12,0.08,-0.05,0.09,S,n=10,tilt=(-30,20,0)))  # wrist
r.append(cylz(0.045,0.22,0.13,-0.11,0.24,K,n=12,tilt=(-30,20,0)))  # forearm sleeve
r.append(cylz(0.048,0.03,0.105,-0.08,0.155,K,n=12,tilt=(-30,20,0)))# cuff
hr=join('hand_r',r)
# ---- left hand: cupped under a horizontal handguard (barrel axis = z through origin) ----
l=[box(0.075,0.045,0.09,-0.005,-0.045,0.0,S)]               # palm under the guard
for i,zz in enumerate((0.03,0.01,-0.01,-0.03)):
    l.append(box(0.02,0.055,0.02,0.045,-0.015,zz,S))             # fingers up the right side
    l.append(box(0.02,0.02,0.02,0.035,0.028,zz,S))               # fingertips over the top
l.append(box(0.02,0.05,0.022,-0.045,-0.01,0.02,S,rot=(0,0,20)))   # thumb up the left side
l.append(cylz(0.032,0.12,-0.06,-0.09,0.08,S,n=10,tilt=(-35,-25,0)))
l.append(cylz(0.045,0.22,-0.12,-0.16,0.22,K,n=12,tilt=(-35,-25,0)))
l.append(cylz(0.048,0.03,-0.085,-0.125,0.14,K,n=12,tilt=(-35,-25,0)))
hl=join('hand_l',l)
bpy.ops.object.select_all(action='DESELECT');hr.select_set(True);hl.select_set(True);bpy.context.view_layer.objects.active=hr
path=os.path.join(OUT,'hands.glb')
bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_image_format='NONE',export_yup=True,export_normals=True,export_texcoords=False,export_animations=False)
print('[hands] exported',path,os.path.getsize(path),'tris',len(hr.data.polygons)+len(hl.data.polygons),flush=True)
