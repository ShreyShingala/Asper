"""Emulate web/src/lib/camera.ts probes on the sample walkthrough to tune DARK_LUMA / MOVING_DIFF / CAPTURE_MARGIN.
Usage (from moldflow/api): ffmpeg -i <pack>/02_Virtual_Sample/Videos/Walkthrough_Silent.mp4 -vf "scale=64:48,format=gray" -f rawvideo /tmp/probe.gray
                           uv run --with numpy python ../scripts/camera_thresholds.py"""
import numpy as np
raw=np.fromfile('/tmp/probe.gray',dtype=np.uint8); W,H=64,48; n=len(raw)//(W*H)
f=raw[:n*W*H].reshape(n,H,W).astype(float); fps=10
luma=f.mean(axis=(1,2)); step=6
d=np.abs(f[step:]-f[:-step]).mean(axis=(1,2))
print(f"frames={n} luma p1={np.percentile(luma,1):.0f} p5={np.percentile(luma,5):.0f} p50={np.percentile(luma,50):.0f} min={luma.min():.0f}")
print("seconds with luma<42:", sorted(set((np.where(luma<42)[0]//fps).tolist())))
print(f"diff@600ms p50={np.percentile(d,50):.1f} p75={np.percentile(d,75):.1f} p90={np.percentile(d,90):.1f}")
segs={"hose 33-48s":(33,48),"ceiling vent 57-69s":(57,69),"grille 102-111s":(102,111),"selfie 0-5s":(0,5),"boxes 117-125s":(117,125)}
for k,(a,b) in segs.items():
    sl=slice(a*fps,b*fps); ds=d[a*fps:b*fps]
    print(f"{k:22} luma min={luma[sl].min():.0f} mean={luma[sl].mean():.0f} | diff p50={np.percentile(ds,50):.1f} p90={np.percentile(ds,90):.1f} >22={(ds>22).mean():.2f} >28={(ds>28).mean():.2f}")
probes=f[::step]; pl=probes.mean(axis=(1,2)); pd=np.abs(probes[1:]-probes[:-1]).mean(axis=(1,2))
def episodes(T, seg=None):
    run=0; hints=0
    rng = range(len(pd)) if seg is None else range(seg[0]*fps//step, seg[1]*fps//step)
    for i in rng:
        run = run+1 if pd[i]>T else 0
        if run==4: hints+=1
    return hints
for T in (18,22,26,30,35):
    print(f"MOVING_DIFF={T}: shaky episodes total={episodes(T)} | on vent/hose close-ups={episodes(T,(33,48))+episodes(T,(57,69))+episodes(T,(102,111))}")
for D in (30,36,42,50):
    vent = [(pl[a*fps//step:b*fps//step]<D).sum() for a,b in [(33,48),(57,69),(102,111)]]
    print(f"DARK_LUMA={D}: probes under = {(pl<D).sum()} of {len(pl)}; on vent/hose close-ups = {sum(vent)}")
d1=np.abs(f[1:]-f[:-1]).mean(axis=(1,2))
best=np.array([d1[i:i+5].min() for i in range(0,len(d1)-5,10)])
for T in (22,28,34):
    print(f"captureSteady rejects (best diff > {T}): {(best>T).mean():.2f} of seconds; on close-ups {np.mean([(best[a:b]>T).mean() for a,b in [(33,48),(57,69),(102,111)]]):.2f}")
