"""Calibre les scores simulés de la démo AccidentWatch.

Cherche deux lois Bêta (accidents graves / non graves) qui reproduisent les
métriques réelles du Random Forest du projet : AUC 0,76, rappel 6 % au seuil 0,5,
rappel 60 % et précision 0,34 au seuil 0,3, 16,6 % d'accidents graves.
Écrit src/data/accident-hist.json (histogrammes de 50 intervalles, 10 000 accidents).

Lancer depuis la racine du projet : python3 scripts/calibrate-accidents.py  (numpy requis)
"""
import numpy as np, json
P = 0.166
tgt_fpr = P*0.60*(1-0.34)/(0.34*(1-P))
xs = np.linspace(0,1,20001)[1:-1]; dx = xs[1]-xs[0]
def dist(a,b):
    lp = (a-1)*np.log(xs)+(b-1)*np.log(1-xs); p = np.exp(lp-lp.max()); p/=p.sum()*dx
    c = np.cumsum(p)*dx; return p, c
def sf(c, t): return 1-np.interp(t, xs, c)
def metrics(p):
    a1,b1,a2,b2 = np.exp(p)
    pp, cp = dist(a1,b1); pn, cn = dist(a2,b2)
    auc = np.sum(pp*cn)*dx
    return sf(cp,.5), sf(cp,.3), sf(cn,.3), auc
def loss(p):
    r5,r3,f3,auc = metrics(p)
    return (r5-0.06)**2*20+(r3-0.60)**2+(f3-tgt_fpr)**2+(auc-0.76)**2
# Nelder-Mead minimal
def nm(f, x0, it=4000, step=0.3):
    n=len(x0); S=[x0]+[x0+step*np.eye(n)[i] for i in range(n)]; F=[f(s) for s in S]
    for _ in range(it):
        o=np.argsort(F); S=[S[i] for i in o]; F=[F[i] for i in o]
        c=np.mean(S[:-1],axis=0); xr=c+(c-S[-1]); fr=f(xr)
        if fr<F[0]:
            xe=c+2*(c-S[-1]); fe=f(xe)
            if fe<fr: S[-1],F[-1]=xe,fe
            else: S[-1],F[-1]=xr,fr
        elif fr<F[-2]: S[-1],F[-1]=xr,fr
        else:
            xc=c+0.5*(S[-1]-c); fc=f(xc)
            if fc<F[-1]: S[-1],F[-1]=xc,fc
            else:
                S=[S[0]]+[S[0]+0.5*(s-S[0]) for s in S[1:]]; F=[f(s) for s in S]
    i=int(np.argmin(F)); return S[i],F[i]
best=None
for s in [(3,6,2,7),(4,8,2,8),(2,4,1.5,6),(6,10,2,6)]:
    x,fx=nm(loss,np.log(np.array(s,float)))
    if best is None or fx<best[1]: best=(x,fx)
a1,b1,a2,b2=np.exp(best[0]); print("params",a1,b1,a2,b2,"loss",best[1],"metrics",metrics(best[0]),"tgt",tgt_fpr)
N=10000; npos=round(N*P); nneg=N-npos
edges=np.linspace(0,1,51)
_,cp=dist(a1,b1); _,cn=dist(a2,b2)
Cp=np.interp(edges,xs,cp); Cn=np.interp(edges,xs,cn); Cp[0]=Cn[0]=0; Cp[-1]=Cn[-1]=1
hp=np.diff(Cp)*npos; hn=np.diff(Cn)*nneg
def rnd(h,tot):
    f=np.floor(h).astype(int); rem=tot-f.sum(); idx=np.argsort(-(h-f))[:rem]; f[idx]+=1; return f.tolist()
hp=rnd(hp,npos); hn=rnd(hn,nneg)
def at(t):
    k=int(round(t*50)); tp=sum(hp[k:]); fp=sum(hn[k:]); return round(tp/npos,3), round(tp/max(1,tp+fp),3), round((tp+sum(hn[:k]))/N,3)
print("check .5",at(.5),".3",at(.3),"1.0",at(1.0))
# AUC discrete
auc=0; cumn=0
for i in range(50):
    auc+=hp[i]*(cumn+hn[i]/2); cumn+=hn[i]
print("auc disc", auc/(npos*nneg))
json.dump({"pos":hp,"neg":hn},open("src/data/accident-hist.json","w"))
