"""Normalise physical-sky HDRIs to renderer-friendly exposure (median sky ~0.6, sun clamped). Usage: python normalize_hdri.py <dir>"""
import bpy, sys, os, numpy as np
D=sys.argv[-1]
for f in sorted(os.listdir(D)):
    if not f.endswith('.hdr'): continue
    im=bpy.data.images.load(os.path.join(D,f));w,h=im.size
    arr=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(arr);px=arr.reshape(h,w,4)
    lum=0.2126*px[...,0]+0.7152*px[...,1]+0.0722*px[...,2]
    upper=lum[h//2:,:]  # blender image rows start at bottom -> upper half = sky
    ref=float(np.percentile(upper[upper>1e-6],60)) if (upper>1e-6).any() else 1.0
    target={'sky_night.hdr':0.02}.get(f,0.6)
    scale=target/max(ref,1e-6)
    px[...,:3]=np.minimum(px[...,:3]*scale,48.0)
    im.pixels.foreach_set(px.reshape(-1))
    im.filepath_raw=os.path.join(D,f);im.file_format='HDR';im.save()
    print('[norm]',f,'ref',round(ref,3),'scale',round(scale,4),'max',round(float(px[...,:3].max()),1),flush=True)
