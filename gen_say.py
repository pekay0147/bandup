# 큐카드 문장 음성(mp3) 만들기: python3 gen_say.py <kokoro 모델 폴더> [speaker id]
# 모델: github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2  (pip install sherpa-onnx soundfile)
# data/ 안의 모든 카드 영어 문장을 audio/say/<hash>.mp3 로 만들고(이미 있으면 건너뜀) audio/say/index.json 에 목록을 써요.
import json,glob,os,sys,subprocess,tempfile
def h(s):  # app.js sayKey 와 같은 해시 (FNV-1a, UTF-16 단위)
    x=0x811c9dc5
    b=s.encode('utf-16-le')
    for i in range(0,len(b),2):
        x^=b[i]|(b[i+1]<<8); x=(x*0x01000193)&0xffffffff
    return format(x,'08x')
def norm(s): return ' '.join(s.replace('’',"'").split())
S={}
def walk(o):
    if isinstance(o,dict):
        if isinstance(o.get('en'),str) and 'ko' in o: S[h(norm(o['en']))]=norm(o['en'])
        for v in o.values(): walk(v)
    elif isinstance(o,list):
        for v in o: walk(v)
for f in glob.glob('data/**/*.json',recursive=True): walk(json.load(open(f)))
os.makedirs('audio/say',exist_ok=True)
todo=[k for k in S if not os.path.exists(f'audio/say/{k}.mp3')]
print(len(S),'sentences,',len(todo),'to make',flush=True)
if todo:
    import sherpa_onnx, soundfile as sf
    d=sys.argv[1].rstrip('/')+'/'; sid=int(sys.argv[2]) if len(sys.argv)>2 else 21
    lex=d+('lexicon-gb-en.txt' if 20<=sid<=27 else 'lexicon-us-en.txt')
    tts=sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=d+'model.onnx',voices=d+'voices.bin',tokens=d+'tokens.txt',data_dir=d+'espeak-ng-data',lexicon=lex),num_threads=2)))
    tmp=tempfile.mktemp(suffix='.wav')
    for n,k in enumerate(todo,1):
        a=tts.generate(S[k].replace('/',', '),sid=sid,speed=1.0)
        if not len(a.samples): print('FAIL',S[k],flush=True); continue
        sf.write(tmp,a.samples,a.sample_rate)
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',tmp,'-ac','1','-b:a','40k',f'audio/say/{k}.part.mp3'],check=True)
        os.replace(f'audio/say/{k}.part.mp3',f'audio/say/{k}.mp3')
        if n%100==0: print(n,'/',len(todo),flush=True)
have=sorted(k for k in S if os.path.exists(f'audio/say/{k}.mp3'))
json.dump(have,open('audio/say/index.json','w'),separators=(',',':'))
print('done',len(have),flush=True)
