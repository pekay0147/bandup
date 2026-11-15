# 큐카드 문장 음성(mp3) 만들기: python3 gen_say.py <kokoro 모델 폴더>
# 모델: github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2  (pip install sherpa-onnx soundfile)
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
VOICES=[21,22,26]  # bf_emma, bf_isabella, bm_george
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
        if what=='rest' and len(o)==3 and all(isinstance(x,str) for x in o) and KO.search(o[1]): add(o[0]); add(o[2])
        for v in o: walk(v,what)
docs=[json.load(open(f)) for f in sorted(glob.glob('data/**/*.json',recursive=True))]
for what in ('cards','rest'):
    for d in docs: walk(d,what)
os.makedirs('audio/say',exist_ok=True)
def save():
    have=sorted(k for k in S if os.path.exists(f'audio/say/{k}.mp3'))
    json.dump(have,open('audio/say/index.json','w'),separators=(',',':')); return len(have)
todo=[k for k in S if not os.path.exists(f'audio/say/{k}.mp3')]
print(len(S),'texts,',len(todo),'to make',flush=True)
if todo:
    import sherpa_onnx, soundfile as sf
    d=sys.argv[1].rstrip('/')+'/'
    tts=sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=d+'model.onnx',voices=d+'voices.bin',tokens=d+'tokens.txt',data_dir=d+'espeak-ng-data',lexicon=d+'lexicon-gb-en.txt'),num_threads=2)))
    tmp=tempfile.mktemp(suffix='.wav')
    for n,k in enumerate(todo,1):
        a=tts.generate(S[k].replace('/',', ').replace('~','').replace('=',','),sid=VOICES[int(k,16)%3],speed=1.0)
        if not len(a.samples): print('FAIL',S[k],flush=True); continue
        sf.write(tmp,a.samples,a.sample_rate)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',tmp,'-ac','1','-b:a','40k',f'audio/say/{k}.part.mp3'],check=True)
        os.replace(f'audio/say/{k}.part.mp3',f'audio/say/{k}.mp3')
        if n%200==0: print(n,'/',len(todo),'index',save(),flush=True)
print('done',save(),flush=True)
