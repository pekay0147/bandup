"""Make one entry page per student (u/<slug>/) so 'Add to Home Screen' always opens that student's cards."""
import json, os, glob, re
ROOT=os.path.dirname(os.path.abspath(__file__))
base=open(os.path.join(ROOT,"index.html"),encoding="utf-8").read()
for f in glob.glob(os.path.join(ROOT,"data","students","*.json")):
    d=json.load(open(f,encoding="utf-8")); slug=d["slug"]; name=d["name"]
    out=os.path.join(ROOT,"u",slug); os.makedirs(out,exist_ok=True)
    h=base.replace('<meta charset="utf-8">','<meta charset="utf-8">\n<base href="../../">',1)
    h=h.replace('<link rel="manifest" href="manifest.webmanifest">',f'<link rel="manifest" href="u/{slug}/manifest.webmanifest">')
    h=h.replace('<title>밴드업 아이엘츠</title>',f'<title>{name}님 · 밴드업 아이엘츠</title>')
    h=h.replace('<script src="app.js"></script>',f'<script>window.BANDUP_SLUG="{slug}";</script>\n<script src="app.js"></script>')
    open(os.path.join(out,"index.html"),"w",encoding="utf-8").write(h)
    m=json.load(open(os.path.join(ROOT,"manifest.webmanifest"),encoding="utf-8"))
    m.update({"id":f"./u/{slug}/","name":f"밴드업 · {name}","short_name":"밴드업","start_url":"./","scope":"../../",
              "icons":[{**i,"src":"../../"+i["src"]} for i in m["icons"]]})
    json.dump(m,open(os.path.join(out,"manifest.webmanifest"),"w",encoding="utf-8"),ensure_ascii=False,indent=1)
    print("built",slug)
