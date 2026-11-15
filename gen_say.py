# 큐카드 문장 음성(mp3) 만들기: python3 gen_say.py <kokoro 모델 폴더>
# 모델: github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/ 의 kokoro-v1.0.onnx, voices-v1.0.bin  (pip install kokoro-onnx soundfile)
# 목소리는 문장마다 Emma·Isabella·George 중 하나로 고정(해시로 고름).
# data/ 안의 카드 문장, 단어, 예문, 질문을 audio/say/<hash>.mp3 로 만들고(이미 있으면 건너뜀) audio/say/index.json 에 목록을 써요.
import json,glob,os,sys,subprocess,tempfile
def h(s):  # app.js sayKey 와 같은 해시 (FNV-1a, UTF-16 단위)
    x=0x811c9dc5
    b=s.encode('utf-16-le')
    for i in range(0,len(b),2):
        x^=b[i]|(b[i+1]<<8); x=(x*0x01000193)&0xffffffff
    return format(x,'08x')
def norm(s): return ' '.join(s.replace('’',"'").split())
import re
VOICES=['bf_emma','bf_isabella','bm_george']
def tts_text(t):  # 읽을 때만 바꾸는 표기 (파일 이름은 원문 기준)
    t=t.replace(' / ',', ').replace('~','').replace(' = ',', ').replace(' + ',' ').replace('IELTS','I-ELTS')
    t=re.sub(r'(?<=[A-Za-z])/(?=[A-Za-z])',' or ',t)
    t=re.sub(r'\bsb\b','somebody',t); t=re.sub(r'\bsth\b','something',t)
    return t
KO=re.compile('[가-힣]')
S={}  # hash -> text, 카드 문장부터 (먼저 만들 것부터)
def add(t):
    if isinstance(t,str) and t.strip() and not KO.search(t) and re.search('[A-Za-z]',t): S.setdefault(h(norm(t)),norm(t))
def walk(o,what):
    if isinstance(o,dict):
        if 'ko' in o:
            if what=='cards': add(o.get('en'))
            else: add(o.get('w')); add(o.get('ex'))
        if what=='rest':
            if isinstance(o.get('qs'),list):
                for q in o['qs']: add(q)
            add(o.get('topic'))
            for k,v in o.items():
                if isinstance(v,dict) and 'ko' in v and 'ex' in v: add(k)
        for v in o.values(): walk(v,what)
    elif isinstance(o,list):
        if what=='rest' and len(o)==3 and all(isinstance(x,str) for x in o) and KO.search(o[1]):
            add(o[0])
            if o[2].replace('-','')!=o[0].replace('-',''): add(o[2])  # 세 번째가 음절 표시(lab-o-ra-to-ry)면 읽지 않음
        for v in o: walk(v,what)
docs=[json.load(open(f)) for f in sorted(glob.glob('data/**/*.json',recursive=True))]
for what in ('cards','rest'):
    for d in docs: walk(d,what)
for line in open('app.js',encoding='utf-8'):  # app.js 안에 직접 적힌 이디엄 목록 ["표현","뜻","예문"]
    m=re.match(r'^\s*(\["[^"]+","[^"]*[가-힣][^"]*","[^"]*"\]),?\s*$',line)
    if m:
        w,_,ex=json.loads(m.group(1)); add(w); add(ex)
os.makedirs('audio/say',exist_ok=True)
def save():
    have=sorted(k for k in S if os.path.exists(f'audio/say/{k}.mp3'))
    json.dump(have,open('audio/say/index.json','w'),separators=(',',':')); return len(have)
todo=[k for k in S if not os.path.exists(f'audio/say/{k}.mp3')]
print(len(S),'texts,',len(todo),'to make',flush=True)
if todo:
    from kokoro_onnx import Kokoro
    import soundfile as sf
    d=sys.argv[1].rstrip('/')+'/'
    tts=Kokoro(d+'kokoro-v1.0.onnx',d+'voices-v1.0.bin')
    tmp=tempfile.mktemp(suffix='.wav')
    for n,k in enumerate(todo,1):
        try: a,sr=tts.create(tts_text(S[k]),voice=VOICES[int(k,16)%3],speed=1.0,lang='en-gb')
        except Exception as e: print('FAIL',S[k],e,flush=True); continue
        sf.write(tmp,a,sr)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',tmp,'-ac','1','-b:a','40k',f'audio/say/{k}.part.mp3'],check=True)
        os.replace(f'audio/say/{k}.part.mp3',f'audio/say/{k}.mp3')
        if n%200==0: print(n,'/',len(todo),'index',save(),flush=True)
print('done',save(),flush=True)
