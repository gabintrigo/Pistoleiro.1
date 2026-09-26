"""Offline sound bank: layered synthesis (transient + shaped noise + low boom) with a stadium reverb, 22.05 kHz 16-bit WAV.
Deterministic (seeded), licence-free. Usage: python build_sfx.py <out_dir>"""
import numpy as np, wave, os, sys
SR=22050;OUT=sys.argv[1];os.makedirs(OUT,exist_ok=True);rng=np.random.default_rng(7)
def env(n,a,d,curve=3.0):
    t=np.arange(n)/SR;e=np.ones(n);ai=int(a*SR);
    if ai>0:e[:ai]=np.linspace(0,1,ai)
    e[ai:]=np.exp(-(t[ai:]-t[ai])*curve/max(d,1e-3));return e
def noise(n):return rng.standard_normal(n)
def lowpass(x,fc):
    a=np.exp(-2*np.pi*fc/SR);y=np.zeros_like(x);acc=0.0
    for i in range(len(x)):acc=a*acc+(1-a)*x[i];y[i]=acc
    return y
def highpass(x,fc):return x-lowpass(x,fc)
def bandpass(x,lo,hi):return highpass(lowpass(x,hi),lo)
def tone(f,dur,decay,f_end=None,harm=()):
    n=int(dur*SR);t=np.arange(n)/SR;fr=np.linspace(f,f_end if f_end else f,n);ph=np.cumsum(2*np.pi*fr/SR);y=np.sin(ph)
    for k,a in harm:y+=a*np.sin(ph*k)
    return y*env(n,0.002,decay)
def reverb(x,size=0.9,mix=0.35,pre=0.02):
    """stadium-ish: sparse early reflections + exponentially decaying noise tail"""
    n=len(x);tail=int(size*SR);ir=np.zeros(tail+n);er=[(0.021,0.5),(0.037,0.4),(0.058,0.3),(0.083,0.25),(0.12,0.2),(0.19,0.15)]
    for d,g in er:i=int(d*SR);ir[i]+=g
    t=np.arange(tail)/SR;ir[int(pre*SR):int(pre*SR)+tail]+=noise(tail)*np.exp(-t*6.5/size)*0.10
    ir=lowpass(ir,2200);y=np.convolve(x,ir)[:n+tail];out=np.zeros(n+tail);out[:n]+=x*(1-mix*0.5);out+=y*mix;return out
def norm(x,peak=0.92):m=np.max(np.abs(x))+1e-9;return x/m*peak
def save(name,x,peak=0.92):
    x=np.clip(norm(x,peak),-1,1);path=os.path.join(OUT,name+'.wav')
    with wave.open(path,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((x*32767).astype('<i2').tobytes())
    print('[sfx]',name,round(len(x)/SR,2),'s',os.path.getsize(path),'B',flush=True)
def pad(*parts):
    n=max(len(p) for p in parts);out=np.zeros(n)
    for p in parts:out[:len(p)]+=p
    return out
def crack(n_imp=4,spread=0.002,width=0.0008):
    """muzzle crack: several micro-transients with random polarity in the first ~2 ms, each a tiny noise burst"""
    n=int(0.02*SR);y=np.zeros(n)
    for i in range(n_imp):
        st=int(rng.uniform(0,spread)*SR);ln=max(4,int(rng.uniform(0.3,1.0)*width*SR));pol=rng.choice([-1,1])
        y[st:st+ln]+=noise(ln)*env(ln,0.0001,width*0.5,5)*pol*rng.uniform(0.7,1.3)
    return highpass(y,600)
def body(lo_dec,mid_dec,hi_dec,lo_amt=1.0,mid_amt=1.0,hi_amt=1.0,n=None):
    """spectral decay: three noise bands, the higher the band the faster it dies"""
    n=n or int(0.35*SR);src=noise(n)
    hi=bandpass(src,2000,8000)*env(n,0.0006,hi_dec,4)*hi_amt
    mid=bandpass(src,400,2000)*env(n,0.0008,mid_dec,3.5)*mid_amt
    lo=bandpass(src,80,400)*env(n,0.002,lo_dec,3)*lo_amt
    return hi+mid+lo
def thump(f0,f1,dur,dec,amt):
    n=int(dur*SR);t=np.arange(n)/SR;fr=f0*np.exp(np.log(f1/f0)*np.minimum(1,t/(dur*0.6)));ph=np.cumsum(2*np.pi*fr/SR)
    return np.sin(ph)*env(n,0.0015,dec,3)*amt
def slapbacks(dry,delays,gains,cutoffs,diffuse=0.02):
    """discrete stadium echoes: each one is the first 30 ms of the shot, diffused, low-passed and delayed"""
    head=dry[:int(0.03*SR)]*env(int(0.03*SR),0.0,0.01,3);total=len(dry)+int((max(delays)+0.4)*SR);out=np.zeros(total)
    for d,g,fc in zip(delays,gains,cutoffs):
        k=int(diffuse*SR);burst=noise(k)*np.exp(-np.arange(k)/(k*0.3));e=np.convolve(head,burst)[:len(head)+k];e=lowpass(e,fc)*g/ (np.max(np.abs(e))+1e-9)*np.max(np.abs(head))
        st=int(d*SR);out[st:st+len(e)]+=e
    return out
def tail(n_len,size,cut,amt):
    n=int(n_len*SR);t=np.arange(n)/SR;return lowpass(noise(n),cut)*np.exp(-t*4.5/size)*amt
def gunshot(kind,seed=0):
    global rng;rng=np.random.default_rng(100+seed)
    K=dict(
      ar=dict(crack=(4,0.002,0.0008,1.4),body=(0.13,0.06,0.022,1.0,1.1,0.9),thump=(170,55,0.14,0.09,1.0),mech=0.22,echo=([0.06,0.11,0.19,0.29,0.41],[0.28,0.22,0.16,0.11,0.07],[3200,2200,1500,1000,700]),tail=(0.9,0.55,1200,0.05),drive=1.7),
      smg=dict(crack=(3,0.0015,0.0006,1.2),body=(0.09,0.045,0.018,0.7,1.0,1.0),thump=(220,80,0.09,0.06,0.7),mech=0.3,echo=([0.05,0.1,0.17,0.26],[0.22,0.16,0.11,0.07],[3000,2000,1300,900]),tail=(0.7,0.45,1100,0.04),drive=1.6),
      shotgun=dict(crack=(5,0.003,0.0012,1.3),body=(0.2,0.09,0.03,1.4,1.2,0.9),thump=(140,38,0.22,0.16,1.6),mech=0.15,echo=([0.07,0.13,0.22,0.33,0.47],[0.32,0.26,0.19,0.13,0.08],[2400,1600,1100,800,600]),tail=(1.2,0.7,900,0.07),drive=1.8),
      sniper=dict(crack=(6,0.0025,0.0009,1.8),body=(0.16,0.07,0.025,1.0,1.1,1.2),thump=(150,42,0.2,0.14,1.3),mech=0.18,echo=([0.08,0.15,0.25,0.38,0.54,0.72],[0.34,0.28,0.22,0.16,0.11,0.07],[3400,2400,1600,1100,800,600]),tail=(1.5,0.8,1000,0.07),drive=1.75),
      lmg=dict(crack=(4,0.002,0.001,1.3),body=(0.16,0.07,0.024,1.3,1.1,0.85),thump=(160,48,0.16,0.11,1.3),mech=0.25,echo=([0.06,0.11,0.19,0.29,0.41],[0.3,0.23,0.17,0.12,0.08],[3000,2000,1400,950,700]),tail=(1.0,0.6,1100,0.06),drive=1.75),
      pistol=dict(crack=(3,0.0015,0.0007,1.3),body=(0.07,0.04,0.015,0.55,1.0,1.0),thump=(260,95,0.07,0.05,0.6),mech=0.28,echo=([0.05,0.1,0.17,0.26],[0.2,0.14,0.1,0.06],[2800,1900,1300,900]),tail=(0.6,0.4,1000,0.035),drive=1.6),
    )[kind]
    c=K['crack'];cr=crack(c[0],c[1],c[2])*c[3]
    b=K['body'];bd=body(b[0],b[1],b[2],b[3],b[4],b[5])
    t=K['thump'];th=thump(t[0],t[1],t[2],t[3],t[4])
    m=int(0.04*SR);mech=np.concatenate([np.zeros(m),bandpass(noise(int(0.025*SR)),1200,4500)*env(int(0.025*SR),0.0004,0.01,4)*K['mech']])
    dry=pad(cr,bd,th,mech)
    dry=np.tanh(dry*K['drive'])/np.tanh(K['drive'])          # saturation glues the layers
    dry[:int(0.003*SR)]*=1.15                                   # slight transient emphasis
    e=K['echo'];ec=slapbacks(dry,e[0],e[1],e[2])
    tl=K['tail'];tt=tail(tl[0],tl[1],tl[2],tl[3])
    return pad(dry,ec,tt)
def distant(x,cut=750,delay=0.03,boost_tail=1.4):
    """far-away version: crack gone, low-passed, tail relatively louder"""
    y=lowpass(lowpass(x,cut),cut*1.5);y[:int(0.006*SR)]*=0.35
    y=np.concatenate([np.zeros(int(delay*SR)),y]);return y
for k in ['ar','smg','shotgun','sniper','lmg','pistol']:
    save(k,gunshot(k,0));save(k+'_b',gunshot(k,1))
save('eshot_near',gunshot('ar',2));save('eshot_far',distant(gunshot('ar',3)))
save('gl',pad(tone(180,0.25,0.12,90)*1.2,lowpass(noise(int(0.12*SR)),900)*env(int(0.12*SR),0.002,0.06)*0.6))
save('rpg',reverb(pad(lowpass(noise(int(0.6*SR)),1200)*env(int(0.6*SR),0.05,0.35,2.0)*0.8,tone(70,0.5,0.3,45)*0.9),1.2,0.4))
# explosion: sub boom + rumble + debris crackle, long tail
n=int(1.4*SR)
save('boom',reverb(pad(tone(48,1.2,0.6,30,harm=((2,0.5),(3,0.25)))*1.4,lowpass(noise(n),700)*env(n,0.004,0.5,2.5)*1.0,bandpass(noise(n),1500,5000)*env(n,0.01,0.25)*0.35),1.8,0.45))
# impacts
save('ping',pad(tone(2900,0.35,0.16,harm=((1.5,0.5),(2.7,0.3))),highpass(noise(int(0.02*SR)),4000)*env(int(0.02*SR),0.0005,0.006)*0.8))
save('wood',pad(bandpass(noise(int(0.12*SR)),200,1200)*env(int(0.12*SR),0.001,0.05)*1.0,tone(220,0.1,0.05,140)*0.5))
save('crack',pad(highpass(noise(int(0.08*SR)),1800)*env(int(0.08*SR),0.0005,0.03)*1.0,lowpass(noise(int(0.15*SR)),600)*env(int(0.15*SR),0.005,0.08)*0.4))
save('thud',lowpass(noise(int(0.14*SR)),450)*env(int(0.14*SR),0.002,0.07)*1.0)
# feedback
save('hitmark',pad(tone(1500,0.05,0.02),tone(2200,0.05,0.015)*0.5))
save('head',pad(tone(1300,0.35,0.18,harm=((2,0.35),(3,0.15))),tone(1950,0.25,0.1)*0.4))
save('kill',pad(tone(160,0.25,0.12,90),lowpass(noise(int(0.1*SR)),800)*env(int(0.1*SR),0.002,0.05)*0.4))
save('reload',pad(np.concatenate([np.zeros(0),bandpass(noise(int(0.05*SR)),800,4000)*env(int(0.05*SR),0.001,0.02)]),np.concatenate([np.zeros(int(0.35*SR)),bandpass(noise(int(0.06*SR)),600,3500)*env(int(0.06*SR),0.001,0.025)*1.1]),np.concatenate([np.zeros(int(0.7*SR)),tone(900,0.08,0.03)*0.5,])))
save('swap',pad(bandpass(noise(int(0.06*SR)),700,3000)*env(int(0.06*SR),0.001,0.03),tone(600,0.08,0.03)*0.4))
save('empty',tone(1200,0.06,0.02)*0.8)
save('pick',pad(tone(880,0.12,0.06),np.concatenate([np.zeros(int(0.08*SR)),tone(1320,0.15,0.08)])))
# footsteps (two variants each)
for i in range(2):
    g=lowpass(noise(int(0.11*SR)),260+i*60)*env(int(0.11*SR),0.012,0.05,2.5)      # soft grass thud, slow attack
    save('step_grass%d'%i,g,peak=0.28)
    h=pad(lowpass(noise(int(0.07*SR)),700+i*150)*env(int(0.07*SR),0.004,0.03,2.5),tone(140+i*20,0.06,0.03)*0.35)
    save('step_hard%d'%i,h,peak=0.32)
# crowd ambience: layered filtered noise with slow swells + sparse 'shouts', made seamless by crossfading the ends
n=int(4.0*SR);t=np.arange(n)/SR
base=lowpass(noise(n),900)*0.6+bandpass(noise(n),300,2500)*0.25
swell=1+0.35*np.sin(2*np.pi*0.23*t)+0.2*np.sin(2*np.pi*0.61*t+1.3)
crowd=base*swell
for i in range(26):
    st=int(rng.uniform(0,3.6)*SR);ln=int(rng.uniform(0.08,0.25)*SR);f=rng.uniform(250,900)
    sh=tone(f,ln/SR,ln/SR*0.5,f*0.8,harm=((2,0.4),(3,0.2)));m=min(len(sh),n-st);crowd[st:st+m]+=sh[:m]*0.25
xf=int(0.4*SR);w=np.linspace(0,1,xf);crowd[:xf]=crowd[:xf]*w+crowd[-xf:]*(1-w);crowd=crowd[:-xf]
save('crowd',crowd)
save('whistle',pad(tone(2600,0.5,0.35,harm=((1.02,0.8),(2,0.15)))*np.where(np.arange(int(0.5*SR))%1400<700,1.0,0.35)[:int(0.5*SR)]))
print('[sfx] done')
