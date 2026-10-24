import base64, json, os, sys, time, urllib.request
key = [l.split("=",1)[1].strip() for l in open(".env.local") if l.startswith("GEMINI_API_KEY")][0]
root = "../Mold-Busters-Hackathon-Sample-Pack-v2"
photos = ["01_OnSite_Sample/Photos/13_Washroom_discoloration_1.jpg",
          "02_Virtual_Sample/Photos/02_Discoloration_ceiling_vent.jpg",
          "01_OnSite_Sample/Photos/07_Swab_test_positive_for_mold.jpg",
          "01_OnSite_Sample/Photos/08_Thermal_anomaly_1.jpg"]
PROMPT = """You are Bruce, a pre-screening assistant for a mold inspection company. You NEVER diagnose mold; visible discoloration is "possibly fungal, cannot confirm without sampling".
Return ONLY JSON: {"image_type": "regular|thermal|test_kit|other", "observations": [str], "regions": [{"label": str, "box_2d": [ymin,xmin,ymax,xmax] (0-1000), "concern": "low|medium|high"}], "severity_bucket": "<1m2|1-3m2|>3m2|unknown", "scale_reference_visible": bool, "follow_up_question": str}"""
for model in sys.argv[1:]:
    for p in photos:
        b64 = base64.b64encode(open(os.path.join(root,p),"rb").read()).decode()
        body = {"contents":[{"parts":[{"text":PROMPT},{"inline_data":{"mime_type":"image/jpeg","data":b64}}]}],
                "generationConfig":{"responseMimeType":"application/json","temperature":0.2}}
        req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
              data=json.dumps(body).encode(), headers={"Content-Type":"application/json","x-goog-api-key":key})
        t=time.time()
        try:
            r = json.load(urllib.request.urlopen(req, timeout=90))
            txt = r["candidates"][0]["content"]["parts"][-1]["text"]; u=r.get("usageMetadata",{})
            print(f"\n=== {model} | {p.split('/')[-1]} | {time.time()-t:.1f}s | tokens in/out {u.get('promptTokenCount')}/{u.get('candidatesTokenCount')}")
            print(txt[:900])
        except Exception as e:
            print(f"\n=== {model} | {p} ERROR", getattr(e,'read',lambda:b'')()[:300] or e)
