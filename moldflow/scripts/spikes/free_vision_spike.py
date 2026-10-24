import base64,json,urllib.request,time,sys
from concurrent.futures import ThreadPoolExecutor
key=[l.split("=",1)[1].strip() for l in open(".env.local") if l.startswith("OPENROUTER")][0]
R="../Mold-Busters-Hackathon-Sample-Pack-v2/"
photos={"washroom":R+"01_OnSite_Sample/Photos/13_Washroom_discoloration_1.jpg","thermal":R+"01_OnSite_Sample/Photos/08_Thermal_anomaly_1.jpg"}
PROMPT='You pre-screen photos for a mold inspection company. Never diagnose; visible discoloration is "possibly fungal, cannot confirm without sampling". Return ONLY JSON: {"image_type":"regular|thermal|test_kit|other","observations":[str],"regions":[{"label":str,"box_2d":[ymin,xmin,ymax,xmax] (0-1000)}],"severity_bucket":"<1m2|1-3m2|>3m2|unknown","follow_up_question":str}'
models=sys.argv[1:]
def run(mp):
    m,(name,path)=mp
    img=base64.b64encode(open(path,"rb").read()).decode()
    body={"model":m,"messages":[{"role":"user","content":[{"type":"text","text":PROMPT},{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,"+img}}]}]}
    req=urllib.request.Request("https://openrouter.ai/api/v1/chat/completions",data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"})
    t=time.time()
    try:
        r=json.load(urllib.request.urlopen(req,timeout=120)); c=r["choices"][0]["message"]["content"] or ""
        return f"=== {m} | {name} | {time.time()-t:.1f}s\n{c.strip()[:650]}"
    except urllib.error.HTTPError as e: return f"=== {m} | {name} | HTTP {e.code} {e.read()[:200]}"
    except Exception as e: return f"=== {m} | {name} | ERR {e}"
jobs=[(m,p) for m in models for p in photos.items()]
with ThreadPoolExecutor(8) as ex:
    for out in ex.map(run,jobs): print(out,"\n")
