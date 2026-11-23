#!/usr/bin/env python3
"""문법 지도 내용 → data/grammar.json
예문 표기: {역할:덩어리}  역할 = S 주어, FS 가주어, RS 진짜 주어, V 동사, O 목적어, IO 간접목적어, DO 직접목적어, C 보어, OC 목적격 보어, M 수식어
           {S>subj-ger:Swimming} 처럼 > 뒤에 페이지 id 를 쓰면 그 덩어리를 눌렀을 때 그 페이지로 가요.
m = 학생 카드(영어 문장 + 포인트 설명)와 이어 주는 정규식."""
import json, re, sys, os

N = {}
def node(id, t, s, d, body=(), ex=(), wrong=(), tip="", kids=(), more=(), m="", groups=()):
    pt = [a for a, _ in body] if body and isinstance(body[0], tuple) else []
    if pt: body = [b for _, b in body]
    N[id] = {k: v for k, v in dict(t=t, s=s, d=d, pt=pt, body=list(body), ex=[list(x) for x in ex], wrong=[list(x) for x in wrong],
                                   tip=tip, kids=list(kids), more=list(more), m=m, groups=[[a, list(b)] for a, b in groups]).items() if v}

# ───────────── 뿌리
node("bones", "문장의 뼈대", "문장을 이루는 다섯 조각",
     "영어 문장은 주어·동사·목적어·보어라는 네 가지 뼈와, 거기에 살을 붙이는 수식어로 이루어져요.",
     ["영어는 <em>순서가 곧 문법</em>이에요. 한국어는 '은/는/을/를'이 역할을 알려 주지만, 영어는 자리가 역할을 정해요.",
      "모든 문장에는 <em>주어와 동사</em>가 꼭 있어요. 목적어와 보어는 동사에 따라 필요할 때만 와요.",
      "수식어는 빼도 문장이 성립해요."],
     [["{S:I} {V:study} {O:English} {M:every day}.", "저는 매일 영어를 공부해요."],
      ["{S:She} {V:is} {C:a nurse}.", "그녀는 간호사예요."],
      ["{S:My mom} {V:made} {O:me} {OC:happy}.", "엄마는 저를 행복하게 해 주셨어요."]],
     tip="말이 꼬이면 뼈대만 먼저 말하세요. '누가 + 한다 + 무엇을'을 말한 다음 언제·어디서를 붙이면 돼요.",
     kids=["subj", "verb", "obj", "comp", "mod"])

# ───────────── 주어
node("subj", "주어", "누가 · 무엇이",
     "문장의 주인공이에요. '~은/는/이/가'에 해당하고, 평서문에서는 동사 앞에 와요.",
     ["주어 자리에는 <em>명사 역할을 하는 말</em>만 올 수 있어요. 명사, 대명사, 동명사, to부정사, 명사절이에요.",
      "영어는 주어를 생략하지 않아요. 한국어로는 '배고파'지만 영어는 <em>I'm</em> hungry.",
      "주어가 단수인지 복수인지에 따라 동사 모양이 바뀌어요."],
     [["{S>subj-noun:My sister} {V:lives} {M:in Busan}.", "제 여동생은 부산에 살아요."],
      ["{S>subj-pron:They} {V:are} {C:tired}.", "그들은 피곤해요."],
      ["{S>subj-ger:Cooking} {V:is} {C:my hobby}.", "요리는 제 취미예요."]],
     [["Is very cold today.", "It is very cold today.", "주어가 없으면 it이라도 세워요."]],
     "답을 시작할 때 주어부터 정하면 문장이 흔들리지 않아요. 생각이 안 나면 I / It / There로 시작해 보세요.",
     kids=["subj-noun", "subj-pron", "subj-ger", "subj-to", "subj-clause", "subj-there", "subj-agree"],
     groups=[["주어가 될 수 있는 것", ["subj-noun", "subj-pron", "subj-ger", "subj-to", "subj-clause"]], ["주어와 함께 알아둘 것", ["subj-there", "subj-agree"]]])

node("subj-noun", "명사 주어", "사람·사물 이름이 주인공",
     "가장 기본적인 주어예요. 명사 하나일 수도 있고, 꾸미는 말이 붙은 긴 덩어리(명사구)일 수도 있어요.",
     ["주어가 길어도 <em>핵심 명사 하나</em>를 찾으면 돼요. 동사는 그 핵심 명사에 맞춰요.",
      "The <em>books</em> on the table <em>are</em> mine. → 핵심은 books(복수)라서 are.",
      "셀 수 있는 단수 명사는 혼자 못 와요. a / the / my 같은 말이 꼭 붙어요."],
     [["{S:The weather} {V:is} {C:nice} {M:today}.", "오늘 날씨가 좋아요."],
      ["{S:The people in my office} {V:are} {C:friendly}.", "우리 사무실 사람들은 친절해요."],
      ["{S:My best friend from high school} {V:lives} {M:in Canada}.", "고등학교 때 가장 친한 친구는 캐나다에 살아요."]],
     [["The price of vegetables are high.", "The price of vegetables is high.", "핵심 명사는 price(단수)예요."],
      ["Dog is cute.", "The dog is cute. / Dogs are cute.", "단수 명사에는 관사가 필요해요."]],
     "People in my country ~, The place I want to talk about ~ 처럼 긴 주어 덩어리를 몇 개 외워 두면 답이 풍성해져요.",
     more=["subj-agree", "mod-adj"], m=r"가 주어|주어\(|핵심 명사")

node("subj-pron", "대명사 주어", "I, you, he, she, it, we, they",
     "명사를 대신하는 말이에요. 주어 자리에는 주격(I, he, she, we, they)을 써요.",
     ["주격 – 목적격: I – me, he – him, she – her, we – us, they – them. 주어 자리에는 <em>왼쪽</em>이에요.",
      "<em>it</em>은 날씨·시간·거리·상황을 말할 때 뜻 없이 주어 자리를 채워요. It's raining. / It's 7 o'clock.",
      "일반적인 사람들을 말할 때는 you, people, they를 써요."],
     [["{S:She} {V:works} {M:at a hospital}.", "그녀는 병원에서 일해요."],
      ["{S:It} {V:is} {C:really hot} {M:in summer}.", "여름에는 정말 더워요."],
      ["{S:My friends and I} {V:went} {M:to Jeju}.", "친구들과 저는 제주에 갔어요."]],
     [["Me and my friend went shopping.", "My friend and I went shopping.", "주어 자리는 주격 I. '나'는 뒤에 두는 게 예의예요."],
      ["My mom, she is a teacher.", "My mom is a teacher.", "명사 주어 뒤에 대명사를 또 쓰지 않아요."]],
     "같은 명사를 반복하지 말고 두 번째부터는 it / they로 받으면 자연스러워요.",
     more=["obj-noun", "subj-to"], m=r"주격|비인칭")

node("subj-ger", "동명사 주어", "~하는 것은",
     "동사에 -ing를 붙이면 '~하는 것'이라는 명사가 돼서 주어 자리에 올 수 있어요.",
     ["동명사 주어는 <em>항상 단수</em> 취급해요. Reading books <em>is</em> fun. (books 때문에 are ✕)",
      "말할 때는 to부정사 주어보다 동명사 주어가 훨씬 자연스러워요.",
      "부정은 not을 앞에 붙여요. <em>Not sleeping</em> enough is bad for you."],
     [["{S:Swimming} {V:is} {C:good exercise}.", "수영은 좋은 운동이에요."],
      ["{S:Living alone} {V:has} {O:pros and cons}.", "혼자 사는 건 장단점이 있어요."],
      ["{S:Talking with friends} {V:helps} {O:me} {OC:relax}.", "친구들과 이야기하면 마음이 편해져요."]],
     [["Study English is hard.", "Studying English is hard.", "동사원형은 주어가 못 돼요."],
      ["Watching movies are my hobby.", "Watching movies is my hobby.", "동명사 주어는 단수예요."]],
     "취미·습관을 말할 때 -ing로 시작하면 깔끔해요. Walking my dog is the best part of my day.",
     more=["obj-ger", "subj-agree", "subj-to"], m=r"동명사 주어")

node("subj-to", "to부정사 주어 · 가주어 it", "It is ~ to …",
     "to + 동사원형도 '~하는 것'이라는 뜻으로 주어가 될 수 있어요. 하지만 보통은 가짜 주어 it을 앞에 세우고 진짜 주어는 뒤로 보내요.",
     ["To learn a language is hard. (문법은 맞지만 딱딱해요) → <em>It</em> is hard <em>to learn</em> a language.",
      "틀: <em>It is + 형용사 + (for 사람) + to 동사원형</em>.",
      "누가 하는지 밝히려면 for + 사람을 넣어요. It's hard <em>for me</em> to wake up early."],
     [["{FS:It} {V:is} {C:important} {RS:to sleep well}.", "잘 자는 게 중요해요."],
      ["{FS:It} {V:is} {C:hard} {M:for me} {RS:to wake up early}.", "저는 일찍 일어나는 게 힘들어요."],
      ["{FS:It} {V:takes} {O:an hour} {RS:to get there}.", "거기 가는 데 한 시간 걸려요."]],
     [["Is difficult to find a job.", "It is difficult to find a job.", "가주어 it을 빼면 안 돼요."],
      ["It is hard for me study at night.", "It is hard for me to study at night.", "진짜 주어는 to + 동사원형이에요."]],
     "의견을 말할 때 만능 틀이에요. It's important to ~, It's easy to ~, It's hard for me to ~.",
     more=["subj-ger", "obj-to", "comp-obj"], m=r"가주어|진주어|It is \+ 형용사|It's \+ 형용사|it \+ 형용사 \+ to")

node("subj-clause", "명사절 주어", "문장이 통째로 주어",
     "'주어 + 동사'가 들어 있는 덩어리(절)가 통째로 주어 자리에 올 수 있어요.",
     ["<em>What</em> + 주어 + 동사 = ~하는 것. What I like is ~.",
      "<em>Whether</em> ~ = ~인지 아닌지. <em>That</em> ~ = ~라는 것 (That은 보통 It ~ that으로 바꿔 말해요).",
      "절 주어도 단수 취급해요."],
     [["{S:What I need} {V:is} {C:a long holiday}.", "제게 필요한 건 긴 휴가예요."],
      ["{S:What she said} {V:made} {O:me} {OC:angry}.", "그녀가 한 말이 저를 화나게 했어요."],
      ["{FS:It} {V:is} {C:true} {RS:that he quit his job}.", "그가 일을 그만둔 건 사실이에요."]],
     [["What I want are more time.", "What I want is more time.", "절 주어는 단수예요."],
      ["What do I like is pizza.", "What I like is pizza.", "절 안은 평서문 순서(주어 + 동사)예요."]],
     "What I like most about ~ is … 는 어디서나 쓰는 강조 틀이에요.",
     more=["obj-clause", "subj-to"], m=r"^What (happened|I|we|you|he|she|they) |What happened was|명사절")

node("subj-there", "There is / are", "~이 있다",
     "'~이 있다'고 처음 소개할 때 쓰는 틀이에요. there는 자리만 채우고, 진짜 주어는 be동사 뒤에 와요.",
     ["be동사는 <em>뒤에 오는 명사</em>에 맞춰요. There <em>is</em> a park. / There <em>are</em> many parks.",
      "have로 바꾸면 안 돼요. '있다'는 There is / are.",
      "과거는 There was / were, 현재완료는 There has / have been."],
     [["There {V:is} {S:a café} {M:near my house}.", "우리 집 근처에 카페가 있어요."],
      ["There {V:are} {S:a lot of mountains} {M:in Korea}.", "한국에는 산이 많아요."],
      ["There {V:was} {S:a problem} {M:with my order}.", "제 주문에 문제가 있었어요."]],
     [["There has a big park.", "There is a big park.", "there 뒤에는 have가 아니라 be동사예요."],
      ["There is many people.", "There are many people.", "진짜 주어 people이 복수예요."]],
     "동네·고향을 묘사하는 질문에서 가장 많이 쓰는 틀이에요.",
     more=["subj-agree", "f1"], m=r"there (is|are|was|were|has|have)\b")

node("subj-agree", "주어-동사 수 일치", "주어가 하나면 동사에 -s",
     "현재시제에서 주어가 3인칭 단수(he, she, it, 단수 명사)면 동사에 -s / -es를 붙여요.",
     ["be동사: I <em>am</em> / he·she·it <em>is</em> / you·we·they <em>are</em>.",
      "일반동사: I work / she work<em>s</em>. 부정·의문은 does가 -s를 가져가요. She <em>doesn't</em> work. <em>Does</em> she work?",
      "단수 취급: 동명사, 절, everyone, each, every + 명사, 셀 수 없는 명사.",
      "복수 취급: people, A and B, a lot of + 복수명사."],
     [["{S:My brother} {V:works} {M:at a bank}.", "제 형은 은행에서 일해요."],
      ["{S:Everyone} {V:likes} {O:her}.", "모두가 그녀를 좋아해요."],
      ["{S:People} {V:are} {C:busy} {M:these days}.", "요즘 사람들은 바빠요."]],
     [["She don't like coffee.", "She doesn't like coffee.", "3인칭 단수 부정은 doesn't."],
      ["Everyone have a phone.", "Everyone has a phone.", "everyone은 단수예요."],
      ["People is kind.", "People are kind.", "people은 복수예요."]],
     "말할 때 가장 눈에 띄는 실수예요. he / she / it로 시작했으면 동사 끝 -s를 한 번 더 확인하세요.",
     more=["subj-ger", "subj-noun", "verb-be"], m=r"단수 동사|단수라|3인칭 단수|단수 →|단수 취급|수 일치|복수 동사")

# ───────────── 동사
node("verb", "동사", "~하다 · ~이다",
     "주어가 무엇을 하는지, 어떤 상태인지 말해 줘요. 문장의 엔진이라서 동사가 정해지면 뒤에 무엇이 올지도 정해져요.",
     ["접속사 없이는 문장 하나에 <em>동사가 하나</em>예요. I am go ✕.",
      "동사는 시제·부정·의문을 책임져요.",
      "동사 종류에 따라 뒤가 달라요. 목적어가 필요 없는 동사(자동사), 꼭 필요한 동사(타동사), 보어가 필요한 동사(연결동사)가 있어요."],
     [["{S:Birds} {V>verb-intr:fly}.", "새는 날아요."],
      ["{S:I} {V>verb-tr:like} {O:coffee}.", "저는 커피를 좋아해요."],
      ["{S:She} {V>verb-link:looks} {C:tired}.", "그녀는 피곤해 보여요."]],
     [["I am agree with you.", "I agree with you.", "be동사와 일반동사를 겹쳐 쓰지 않아요."]],
     "말이 막히면 동사부터 떠올리세요. 동사가 나오면 나머지 자리는 따라와요.",
     kids=["verb-be", "verb-intr", "verb-tr", "verb-link", "verb-modal", "verb-phrasal", "forms"],
     groups=[["동사의 종류", ["verb-be", "verb-intr", "verb-tr", "verb-link"]], ["동사에 붙는 말", ["verb-modal", "verb-phrasal"]], ["동사가 정하는 문장 모양 (1~5형식)", ["f1", "f2", "f3", "f4", "f5"]]])

node("verb-be", "be동사와 일반동사", "am · is · are 와 나머지 동사",
     "be동사(am, is, are, was, were)는 '~이다 / ~에 있다', 일반동사는 그 밖의 모든 동작·상태를 나타내요. 둘은 부정문·의문문 만드는 법이 달라요.",
     ["be동사: not을 바로 뒤에, 의문문은 자리 바꾸기. She <em>is not</em> busy. / <em>Is she</em> busy?",
      "일반동사: do / does / did의 도움을 받아요. She <em>doesn't</em> work. / <em>Does</em> she work?",
      "be동사 + 동사원형은 같이 못 써요. be 뒤에는 -ing(진행)나 p.p.(수동)만 와요."],
     [["{S:I} {V:am} {C:a student}.", "저는 학생이에요."],
      ["{S:He} {V:doesn't eat} {O:meat}.", "그는 고기를 안 먹어요."],
      ["{S:They} {V:were} {M:at home} {M:yesterday}.", "그들은 어제 집에 있었어요."]],
     [["I'm usually order coffee.", "I usually order coffee.", "일반동사 앞에 am을 붙이지 않아요."],
      ["She is work here.", "She works here.", "be + 동사원형 ✕."],
      ["Are you like it?", "Do you like it?", "일반동사 의문문은 do."]],
     "I'm ~으로 시작하는 버릇이 있으면, 뒤가 형용사·명사인지 동사인지 먼저 확인하세요.",
     more=["subj-agree", "verb-link"], m=r"일반동사 앞에|be동사와|I'm 붙이지|I'm ✕|am ✕")

node("verb-intr", "자동사", "목적어 없이 혼자 서는 동사",
     "동작이 주어에서 끝나서 목적어가 필요 없는 동사예요. 뒤에 명사를 붙이려면 전치사가 필요해요.",
     ["대표: go, come, arrive, live, work, sleep, happen, wait, listen, look, talk.",
      "명사를 붙일 때: go <em>to</em>, arrive <em>at / in</em>, listen <em>to</em>, look <em>at</em>, wait <em>for</em>, talk <em>to / about</em>.",
      "자동사는 수동태가 안 돼요. It was happened ✕ → It happened."],
     [["{S:I} {V:arrived} {M:at the airport} {M:early}.", "저는 공항에 일찍 도착했어요."],
      ["{S:She} {V:listens} {M:to music} {M:every night}.", "그녀는 매일 밤 음악을 들어요."],
      ["{S:Something strange} {V:happened}.", "이상한 일이 일어났어요."]],
     [["I listen music.", "I listen to music.", "listen은 자동사라 to가 필요해요."],
      ["The accident was happened.", "The accident happened.", "자동사는 수동태 ✕."],
      ["I arrived Seoul.", "I arrived in Seoul.", "arrive + in / at."]],
     "go home, go there, go abroad에는 to가 없어요. home / there / abroad가 부사라서 그래요.",
     more=["verb-tr", "mod-prep", "f1"], m=r"자동사|listen to|arrive (at|in)|wait for")

node("verb-tr", "타동사", "목적어가 꼭 필요한 동사",
     "'무엇을?'이 빠지면 말이 안 되는 동사예요. 동사 바로 뒤에 목적어가 오고, 사이에 전치사를 넣지 않아요.",
     ["대표: like, want, have, make, buy, need, enjoy, discuss, marry, enter, reach, attend, call, fit.",
      "한국어 '~에 대해, ~와, ~에'에 끌려 전치사를 넣기 쉬운 동사: discuss (about ✕), marry (with ✕), enter (into ✕), reach (to ✕), call (with ✕), fit (to ✕), contact (to ✕).",
      "목적어를 빼먹지 마세요. I like. ✕ → I like <em>it</em>."],
     [["{S:We} {V:discussed} {O:the problem}.", "우리는 그 문제를 논의했어요."],
      ["{S:I} {V:call} {O:my mom} {M:every day}.", "저는 매일 엄마한테 전화해요."],
      ["{S:This shirt} {V:fits} {O:me}.", "이 셔츠는 저한테 맞아요."]],
     [["We discussed about the plan.", "We discussed the plan.", "discuss는 타동사예요."],
      ["I call with my mom every day.", "I call my mom every day.", "call + 사람."],
      ["This shirt fits to me.", "This shirt fits me.", "fit + 사람."],
      ["She married with a doctor.", "She married a doctor.", "marry + 사람."]],
     "Do you like ~? 질문에 Yes, I like. 로 끝내지 말고 Yes, I like it / them. 까지 말하세요.",
     more=["verb-intr", "obj", "f3"], m=r"타동사|\(with ✕\)|\(to ✕\)|\(about ✕\)|바로 목적어")

node("verb-link", "연결동사", "주어와 보어를 이어 주는 동사",
     "주어가 어떤 상태인지 이어 주는 동사예요. 뒤에 목적어가 아니라 보어(형용사·명사)가 와요.",
     ["상태: be, seem, stay, keep, remain.",
      "변화: become, get, turn, grow, go (go bad).",
      "감각: look, sound, smell, taste, feel + <em>형용사</em>.",
      "감각동사 뒤에 명사를 쓰려면 like를 넣어요. It looks <em>like</em> a toy."],
     [["{S:You} {V:look} {C:tired}.", "피곤해 보여요."],
      ["{S:The soup} {V:smells} {C:good}.", "수프 냄새가 좋아요."],
      ["{S:I} {V:got} {C:nervous} {M:before the test}.", "시험 전에 긴장됐어요."]],
     [["You look tiredly.", "You look tired.", "연결동사 뒤는 형용사예요."],
      ["It sounds like interesting.", "It sounds interesting.", "형용사 앞에는 like를 안 써요."],
      ["I feel happily.", "I feel happy.", "feel + 형용사."]],
     "sounds good, looks nice, feels strange, tastes amazing. 감각동사 + 형용사는 반응할 때 바로 꺼내 쓰기 좋아요.",
     more=["comp-subj", "comp-adj", "f2"], m=r"(look|feel|sound|smell|taste|seem|get|become|end up) \+ 형용사|감각동사|연결동사")

node("verb-modal", "조동사", "동사 앞에서 뜻을 더하는 말",
     "can, will, should, must, may, might, could, would처럼 동사 앞에 붙어 가능·의무·추측을 더해요.",
     ["조동사 뒤는 항상 <em>동사원형</em>이에요. She can swims ✕.",
      "조동사는 주어에 따라 변하지 않아요. He cans ✕.",
      "조동사 두 개를 겹치지 않아요. will can ✕ → will <em>be able to</em>.",
      "부정은 not을 바로 뒤에, 의문문은 조동사를 앞으로 보내요."],
     [["{S:I} {V:can speak} {O:English}.", "저는 영어를 할 수 있어요."],
      ["{S:You} {V:should see} {O:a doctor}.", "병원에 가 보는 게 좋겠어요."],
      ["{S:It} {V:might rain} {M:tomorrow}.", "내일 비가 올지도 몰라요."]],
     [["She can sings well.", "She can sing well.", "조동사 + 동사원형."],
      ["I will can go.", "I will be able to go.", "조동사 두 개 ✕."],
      ["He musts go.", "He must go.", "조동사에는 -s가 안 붙어요."]],
     "확신이 없을 땐 might / could, 조언은 should, 가정은 would. 조동사를 섞어 쓰면 말이 한결 정교해져요.",
     more=["verb-be"], m=r"조동사|might have to|should have p|could have p|might have p")

node("verb-phrasal", "구동사", "동사 + 짧은 말이 한 덩어리",
     "동사에 up, off, out, on 같은 말이 붙어서 새 뜻이 되는 덩어리예요. put off(미루다), give up(포기하다)처럼요.",
     ["목적어가 명사면 가운데·뒤 둘 다 돼요. put off the meeting = put the meeting off.",
      "목적어가 <em>대명사(it, them, me)면 반드시 가운데</em>예요. put <em>it</em> off ○ / put off it ✕.",
      "떨어질 수 없는 구동사도 있어요. look for, look after, deal with, come up with, run out of. 이건 항상 뒤에 목적어가 와요."],
     [["{S:I} {V:put off} {O:the cleaning} {M:until tomorrow}.", "청소를 내일로 미뤘어요."],
      ["{S:I} {V:put} {O:it} {V:off}.", "그걸 미뤘어요."],
      ["{S:She} {V:came up with} {O:a good idea}.", "그녀가 좋은 생각을 떠올렸어요."]],
     [["I'll pick up you at seven.", "I'll pick you up at seven.", "대명사는 가운데에 넣어요."],
      ["Turn off it.", "Turn it off.", "대명사는 가운데에 넣어요."],
      ["I'm looking my keys for.", "I'm looking for my keys.", "look for는 못 떼어요."]],
     "구동사는 딱딱한 단어보다 자연스러워요. postpone → put off, tolerate → put up with.",
     more=["verb-tr", "obj-noun"], m=r"구동사|put off|pick up|come up with|deal with|run out of|give up|look after|bring it up|clear up|reach out|talk something through|slow down")

# ───────────── 목적어
node("obj", "목적어", "무엇을 · 누구를",
     "동사의 동작을 받는 말이에요. '~을/를'에 해당하고, 타동사 바로 뒤에 와요.",
     ["목적어 자리에도 <em>명사 역할을 하는 말</em>만 와요. 명사, 대명사(목적격), 동명사, to부정사, 명사절이에요.",
      "전치사 뒤에 오는 말도 목적어예요. 그래서 전치사 뒤 대명사는 목적격, 동사는 -ing예요. for <em>me</em>, without <em>saying</em>.",
      "어떤 동사는 목적어를 두 개 가져요(~에게 ~을)."],
     [["{S:I} {V:bought} {O>obj-noun:a new phone}.", "새 휴대폰을 샀어요."],
      ["{S:She} {V:enjoys} {O>obj-ger:cooking}.", "그녀는 요리를 즐겨요."],
      ["{S:I} {V:think} {O>obj-clause:that he is right}.", "저는 그가 옳다고 생각해요."]],
     [["I like she.", "I like her.", "목적어 자리는 목적격이에요."]],
     "'무엇을?'까지 말해야 문장이 끝나요. I enjoy. I want. 에서 멈추지 마세요.",
     kids=["obj-noun", "obj-ger", "obj-to", "obj-both", "obj-clause", "obj-two"],
     groups=[["목적어가 될 수 있는 것", ["obj-noun", "obj-ger", "obj-to", "obj-clause"]], ["목적어와 함께 알아둘 것", ["obj-both", "obj-two"]]])

node("obj-noun", "명사·대명사 목적어", "me, him, her, us, them",
     "가장 기본적인 목적어예요. 대명사는 목적격으로 바꿔야 해요.",
     ["목적격: me, you, him, her, it, us, them.",
      "전치사 뒤에도 목적격이에요. with <em>me</em>, for <em>him</em>, between you and <em>me</em>.",
      "주어와 목적어가 같은 사람이면 -self를 써요. I taught <em>myself</em>. / Enjoy <em>yourself</em>."],
     [["{S:I} {V:met} {O:him} {M:at a party}.", "파티에서 그를 만났어요."],
      ["{S:My parents} {V:support} {O:me}.", "부모님은 저를 지지해 주세요."],
      ["{S:She} {V:introduced} {O:herself}.", "그녀는 자기소개를 했어요."]],
     [["My teacher helped I.", "My teacher helped me.", "목적어는 목적격이에요."],
      ["between you and I", "between you and me", "전치사 뒤는 목적격이에요."],
      ["I enjoyed me at the party.", "I enjoyed myself at the party.", "주어 = 목적어면 -self."]],
     "앞에서 말한 명사를 it / them으로 받을 때 단·복수를 맞추세요. I love movies. I watch them every weekend.",
     more=["subj-pron", "verb-phrasal"], m=r"목적격|myself|yourself|themselves")

node("obj-ger", "동명사 목적어", "enjoy -ing",
     "어떤 동사는 뒤에 '~하는 것을'을 말할 때 -ing만 받아요.",
     ["-ing만 받는 동사: enjoy, finish, mind, avoid, keep, give up, consider, suggest, practise, put off, can't help.",
      "<em>전치사 뒤</em>에도 -ing예요. be good at -ing, be interested in -ing, look forward to -ing, be used to -ing.",
      "이미 하고 있거나 해 본 일, 실제 경험의 느낌이 있어요."],
     [["{S:I} {V:enjoy} {O:walking my dog}.", "저는 강아지 산책시키는 걸 즐겨요."],
      ["{S:She} {V:finished} {O:writing the report}.", "그녀는 보고서 쓰는 걸 끝냈어요."],
      ["{S:I} {V:look forward to} {O:seeing you}.", "만나기를 기대하고 있어요."]],
     [["I enjoy to read.", "I enjoy reading.", "enjoy + -ing."],
      ["I look forward to see you.", "I look forward to seeing you.", "이 to는 전치사라 -ing예요."],
      ["I'm used to wake up early.", "I'm used to waking up early.", "be used to + -ing."]],
     "I enjoy -ing, I'm into -ing, I spend time -ing 는 취미를 말할 때 단골 틀이에요.",
     more=["obj-to", "obj-both", "subj-ger", "mod-prep"], m=r"\+ -ing|from -ing|to -ing|than -ing|뒤엔 동사 -ing|동명사(?! 주어)")

node("obj-to", "to부정사 목적어", "want to ~",
     "어떤 동사는 뒤에 '~하는 것을'을 말할 때 to + 동사원형만 받아요.",
     ["to만 받는 동사: want, hope, decide, plan, need, expect, promise, agree, learn, choose, refuse, would like, can't afford.",
      "아직 안 한 일, 앞으로 할 일의 느낌이 있어요.",
      "부정은 not to예요. I decided <em>not to</em> go.",
      "의문사 + to: I don't know <em>what to</em> do / <em>how to</em> cook / <em>where to</em> go."],
     [["{S:I} {V:want} {O:to travel abroad}.", "해외여행을 가고 싶어요."],
      ["{S:We} {V:decided} {O:to move}.", "우리는 이사하기로 했어요."],
      ["{S:I} {V:don't know} {O:how to explain it}.", "그걸 어떻게 설명해야 할지 모르겠어요."]],
     [["I want go home.", "I want to go home.", "want + to."],
      ["I decided going.", "I decided to go.", "decide + to."],
      ["I hope to not be late.", "I hope not to be late.", "부정은 not to가 기본이에요."]],
     "앞으로의 계획을 말할 때는 I'm planning to ~, I'd like to ~, I hope to ~ 를 번갈아 쓰세요.",
     more=["obj-ger", "obj-both", "comp-obj"], m=r"(want|hope|decide|plan|need|agree|learn) to|how to \+|agree to \+|a way to \+")

node("obj-both", "to와 -ing에 따라 뜻이 달라지는 동사", "remember, stop, try",
     "to부정사와 동명사를 둘 다 받는데, 무엇을 쓰느냐에 따라 뜻이 바뀌는 동사가 있어요.",
     ["remember / forget: <em>to</em> = (앞으로) 할 일을 기억하다 · <em>-ing</em> = (과거에) 한 일을 기억하다.",
      "stop: <em>-ing</em> = ~하는 걸 그만두다 · <em>to</em> = ~하려고 멈추다.",
      "try: <em>to</em> = ~하려고 애쓰다 · <em>-ing</em> = 시험 삼아 해 보다.",
      "like, love, hate, start, begin, continue는 둘 다 써도 뜻이 거의 같아요."],
     [["{S:I} {V:remember} {O:locking the door}.", "문 잠근 게 기억나요."],
      ["{V:Remember} {O:to lock the door}.", "문 잠그는 거 잊지 마세요."],
      ["{S:I} {V:stopped} {O:drinking coffee}.", "커피를 끊었어요."],
      ["{S:I} {V:tried} {O:to call you}.", "전화하려고 했어요."]],
     [["I stopped to smoke last year.", "I stopped smoking last year.", "끊었다 = stop -ing."],
      ["I'm trying to reading books.", "I'm trying to read books.", "to 뒤는 동사원형이에요."]],
     "'요즘 ~하려고 노력 중이에요'는 I'm trying to + 동사원형. 말할 때 정말 자주 써요.",
     more=["obj-ger", "obj-to"], m=r"remember|forget to|try to|trying to|start -ing|stop -ing")

node("obj-clause", "명사절 목적어", "I think (that) ~",
     "'주어 + 동사' 덩어리가 통째로 목적어가 돼요. 생각·말·앎을 나타내는 동사 뒤에 많이 와요.",
     ["that절: I think (that) ~, I believe ~, I heard ~, I hope ~. 말할 때 that은 자주 생략해요.",
      "if / whether절: ~인지 아닌지. I don't know <em>if</em> he's coming.",
      "의문사절(간접의문문): <em>순서는 평서문</em>이에요. I don't know where <em>he lives</em>. (where does he live ✕)",
      "what절: ~하는 것. I like <em>what I do</em>."],
     [["{S:I} {V:think} {O:it's a good idea}.", "좋은 생각인 것 같아요."],
      ["{S:I} {V:don't know} {O:where she lives}.", "그녀가 어디 사는지 몰라요."],
      ["{S:I} {V:wonder} {O:if it will rain}.", "비가 올지 궁금해요."]],
     [["I don't know where does he live.", "I don't know where he lives.", "간접의문문은 평서문 순서예요."],
      ["I think so it is good.", "I think it is good.", "think 뒤에 바로 절이 와요."],
      ["Can you tell me what is your name?", "Can you tell me what your name is?", "평서문 순서예요."]],
     "의견은 I think로만 시작하지 말고 I believe / I guess / I'd say / I feel like 로 바꿔 보세요.",
     more=["subj-clause", "f3"], m=r"that \+ 문장|\+ 문장 =|간접의문문|what I do|have found that|^I (believe|think|guess) ")

node("obj-two", "목적어 두 개", "~에게 ~을",
     "give, send, show처럼 '누구에게 무엇을' 주는 동사는 목적어를 두 개 가져요. 사람(간접목적어)이 먼저, 물건(직접목적어)이 나중이에요.",
     ["틀 1: 동사 + <em>사람 + 물건</em>. She gave me a book.",
      "틀 2: 동사 + <em>물건 + to / for + 사람</em>. She gave a book to me.",
      "to를 쓰는 동사: give, send, show, tell, teach, lend, pass. for를 쓰는 동사: buy, make, cook, get, find.",
      "물건이 대명사(it, them)면 틀 2만 돼요. Give it to me. (Give me it ✕)",
      "explain, say, suggest, introduce는 틀 1이 안 돼요. explain it <em>to me</em>."],
     [["{S:My dad} {V:bought} {IO:me} {DO:a laptop}.", "아빠가 저에게 노트북을 사 주셨어요."],
      ["{S:She} {V:teaches} {IO:children} {DO:English}.", "그녀는 아이들에게 영어를 가르쳐요."],
      ["{S:I} {V:sent} {O:an email} {M:to my boss}.", "상사에게 이메일을 보냈어요."]],
     [["He explained me the rule.", "He explained the rule to me.", "explain + 물건 + to 사람."],
      ["She said me that she was busy.", "She told me that she was busy.", "say는 사람을 바로 못 받아요. tell + 사람."],
      ["Give me it.", "Give it to me.", "it은 앞으로 보내요."]],
     "선물·도움 이야기에서 My friend gave me ~, She taught me how to ~ 틀이 바로 쓰여요.",
     more=["f4", "obj-noun"], m=r"간접목적어|직접목적어|4형식|\+ 사람 \+ 물건")

# ───────────── 보어
node("comp", "보어", "주어나 목적어가 어떤지 채워 주는 말",
     "동사만으로는 뜻이 완성되지 않을 때, 주어나 목적어가 '무엇인지 / 어떤 상태인지'를 채워 주는 말이에요.",
     ["목적어와 구별하는 법: 보어는 앞의 말과 같거나(=) 그 상태를 설명해요. She is a nurse. (She = a nurse)",
      "보어 자리에는 <em>명사와 형용사</em>가 와요. 부사는 못 와요.",
      "주어를 설명하면 주격 보어, 목적어를 설명하면 목적격 보어예요."],
     [["{S:She} {V:became} {C:a doctor}.", "그녀는 의사가 됐어요."],
      ["{S:The movie} {V:was} {C:boring}.", "영화가 지루했어요."],
      ["{S:The news} {V:made} {O:me} {OC:sad}.", "그 소식에 슬퍼졌어요."]],
     [["She looks happily.", "She looks happy.", "보어 자리에 부사는 못 와요."]],
     "감정·평가를 말할 때 보어 형용사가 다양하면 어휘가 풍부해 보여요. good 대신 relaxing, rewarding, exhausting.",
     kids=["comp-subj", "comp-obj", "comp-adj"],
     groups=[["보어의 종류", ["comp-subj", "comp-obj"]], ["보어 자리에서 자주 하는 실수", ["comp-adj"]]])

node("comp-subj", "주격 보어", "주어 = 보어",
     "be동사나 연결동사 뒤에서 주어가 무엇인지, 어떤지를 말해 줘요.",
     ["명사 보어: 주어와 같은 것. My dream is <em>a house by the sea</em>.",
      "형용사 보어: 주어의 상태. I'm <em>tired</em>. / It got <em>dark</em>.",
      "to부정사·동명사·절도 보어가 돼요. My goal is <em>to pass the test</em>. / My hobby is <em>reading</em>. / The problem is <em>that I'm busy</em>.",
      "-ed / -ing 형용사: I'm interest<em>ed</em>(내 감정) / It's interest<em>ing</em>(원인)."],
     [["{S:My hometown} {V:is} {C:a small city}.", "제 고향은 작은 도시예요."],
      ["{S:My goal} {V:is} {C:to get band 7}.", "제 목표는 7점을 받는 거예요."],
      ["{S:The problem} {V:is} {C:that I have no time}.", "문제는 시간이 없다는 거예요."]],
     [["My hobby is read books.", "My hobby is reading books.", "보어 자리에 동사원형은 못 와요."],
      ["I'm boring in class.", "I'm bored in class.", "내 감정은 -ed, 원인은 -ing."],
      ["My job is very stress.", "My job is very stressful.", "상태는 형용사로 말해요."]],
     "stressed(내 기분) / stressful(상황), tired / tiring, excited / exciting. 짝으로 외워 두세요.",
     more=["verb-link", "comp-adj", "f2"], m=r"주격 보어|stressed|stressful|내 감정|feel \+ 형용사|be \+ 형용사")

node("comp-obj", "목적격 보어", "목적어 = 보어",
     "목적어 뒤에서 그 목적어가 무엇인지, 어떤 상태인지, 무엇을 하는지를 말해 줘요. '목적어가 ~하게 / ~라고 / ~하도록'.",
     ["형용사·명사: make me <em>happy</em>, keep the room <em>clean</em>, call him <em>Tim</em>, find it <em>difficult</em>.",
      "to부정사: want / ask / tell / expect / allow + 목적어 + <em>to 동사원형</em>.",
      "동사원형(사역동사): make / let / have + 목적어 + <em>동사원형</em>. help는 to가 있어도 없어도 돼요.",
      "지각동사: see / hear / watch / feel + 목적어 + <em>동사원형 또는 -ing</em>.",
      "find it + 형용사 + to ~: it은 가짜 목적어, 진짜는 to ~ 예요."],
     [["{S:Music} {V:makes} {O:me} {OC:happy}.", "음악은 저를 행복하게 해요."],
      ["{S:My parents} {V:want} {O:me} {OC:to study harder}.", "부모님은 제가 더 열심히 공부하길 바라세요."],
      ["{S:My boss} {V:let} {O:me} {OC:leave early}.", "상사가 일찍 가게 해 줬어요."],
      ["{S:I} {V:saw} {O:him} {OC:crossing the street}.", "그가 길을 건너는 걸 봤어요."]],
     [["My mom made me to clean my room.", "My mom made me clean my room.", "make + 목적어 + 동사원형."],
      ["I want that you come.", "I want you to come.", "want + 목적어 + to."],
      ["It makes me happily.", "It makes me happy.", "목적격 보어는 형용사예요."],
      ["She let me to go.", "She let me go.", "let + 목적어 + 동사원형."]],
     "It makes me feel ~, It helps me relax, It allows me to ~ 는 이유를 설명할 때 가장 쓸모 있는 틀이에요.",
     more=["f5", "comp-adj", "obj-to"], m=r"목적격 보어|5형식|사역|\+ 사람 \+ to|find it \+|bring people closer|keep things fair|helps work go|see A as B|take A as B")

node("comp-adj", "형용사 자리에 부사를 쓰는 실수", "happy 와 happily",
     "보어 자리는 형용사예요. 한국어 '~하게'에 끌려 -ly 부사를 쓰는 실수가 아주 흔해요.",
     ["형용사: 명사를 꾸미거나 보어가 돼요. a <em>quiet</em> room / The room is <em>quiet</em>.",
      "부사: 동사·형용사·문장을 꾸며요. She speaks <em>quietly</em>.",
      "판별법: 그 말이 주어·목적어의 <em>상태</em>면 형용사, 동작의 <em>방식</em>이면 부사예요.",
      "모양이 헷갈리는 것: friendly, lovely, lonely는 형용사 / hard, fast, late, early는 형용사이자 부사 / hardly는 '거의 ~않다'."],
     [["{S:He} {V:is} {C:careful}.", "그는 조심스러운 사람이에요."],
      ["{S:He} {V:drives} {M:carefully}.", "그는 조심스럽게 운전해요."],
      ["{S:I} {V:work} {M:hard}.", "저는 열심히 일해요."]],
     [["I feel badly about it.", "I feel bad about it.", "feel + 형용사."],
      ["She sings beautiful.", "She sings beautifully.", "동작의 방식은 부사예요."],
      ["I studied hardly.", "I studied hard.", "hardly는 '거의 ~않다'예요."],
      ["really quality", "really good quality", "부사는 명사를 못 꾸며요."]],
     "good은 형용사, well은 부사예요. I did good ✕ → I did well.",
     more=["mod-adv", "comp-subj", "verb-link"], m=r"형용사 자리|부사는 명사|hardly|\(형용사\)")

# ───────────── 수식어
node("mod", "수식어", "빼도 문장이 되는 살",
     "뼈대(주어·동사·목적어·보어)에 언제, 어디서, 어떻게, 어떤 같은 정보를 덧붙이는 말이에요. 빼도 문장은 성립해요.",
     ["명사를 꾸미면 형용사 역할, 그 밖의 것(동사·형용사·문장)을 꾸미면 부사 역할이에요.",
      "수식어를 걷어 내면 뼈대가 보여요. (Yesterday) I met an (old) friend (at a café) (near my office). → <em>I met a friend.</em>",
      "답이 짧다면 뼈대는 그대로 두고 수식어를 붙여 보세요."],
     [["{S:I} {V:study} {M>mod-adv:hard}.", "저는 열심히 공부해요."],
      ["{S:I} {V:met} {O:an old friend} {M>mod-prep:at a café}.", "카페에서 오랜 친구를 만났어요."],
      ["{M>mod-adv:Usually}, {S:I} {V:go} {M>mod-prep:to bed} {M>mod-adv:late}.", "보통 저는 늦게 자요."]],
     tip="답을 늘리는 가장 쉬운 방법은 언제, 어디서, 누구와, 왜를 하나씩 붙이는 거예요.",
     kids=["mod-adj", "mod-adv", "mod-prep", "mod-order"],
     groups=[["수식어의 종류", ["mod-adj", "mod-adv", "mod-prep"]], ["수식어를 놓는 자리", ["mod-order"]]])

node("mod-adj", "형용사 수식", "명사를 꾸미는 말",
     "형용사는 명사 앞에서 '어떤' 명사인지 알려 줘요.",
     ["기본 위치는 명사 앞이에요. a <em>beautiful</em> beach.",
      "-thing, -one, -body는 뒤에서 꾸며요. something <em>special</em>, someone <em>new</em>.",
      "길어지면 뒤로 가요. a café <em>near my house</em>, the book <em>I bought</em>, people <em>living in cities</em>.",
      "여러 개일 때 순서: 의견 → 크기 → 나이 → 색 → 재료. a nice big old wooden table."],
     [["{S:I} {V:live} {M:in a small quiet town}.", "저는 작고 조용한 동네에 살아요."],
      ["{S:I} {V:want} {O:something sweet}.", "달콤한 게 먹고 싶어요."],
      ["{S:The café near my office} {V:is} {M:always} {C:busy}.", "사무실 근처 카페는 항상 붐벼요."]],
     [["I want to eat special something.", "I want to eat something special.", "-thing은 뒤에서 꾸며요."],
      ["a red big bag", "a big red bag", "크기 → 색 순서예요."]],
     "명사 하나에 형용사 하나만 붙여도 묘사가 살아나요. a place → a peaceful place.",
     more=["comp-adj", "subj-noun"], m=r"관계대명사|뒤에서 꾸|형용사 순서")

node("mod-adv", "부사 수식", "동사·형용사·문장을 꾸미는 말",
     "부사는 어떻게, 얼마나, 얼마나 자주, 언제를 알려 줘요.",
     ["방식(carefully, well, fast): 보통 동사나 목적어 뒤. She speaks English <em>well</em>. (speaks well English ✕)",
      "빈도(always, usually, often, sometimes, never)와 also, just, still, really: <em>be동사·조동사 뒤, 일반동사 앞</em>. I <em>usually</em> get up at 7. / I'm <em>always</em> late. / I can <em>also</em> swim.",
      "정도(very, really, quite, too): 꾸미는 말 바로 앞. <em>really</em> good.",
      "문장 전체(Actually, Honestly, Luckily): 맨 앞 + 쉼표.",
      "enough는 형용사·부사 <em>뒤</em>에 와요. big enough, long enough."],
     [["{S:I} {M:usually} {V:walk} {M:to work}.", "저는 보통 걸어서 출근해요."],
      ["{S:She} {V:speaks} {O:English} {M:very well}.", "그녀는 영어를 아주 잘해요."],
      ["{S:I} {V:am} {M:always} {C:busy} {M:on Mondays}.", "저는 월요일마다 항상 바빠요."],
      ["{S:I} {M:also} {V:like} {O:going for a walk}.", "저는 산책하는 것도 좋아해요."]],
     [["I go always to the gym.", "I always go to the gym.", "빈도부사는 일반동사 앞이에요."],
      ["I like very much pizza.", "I like pizza very much.", "동사와 목적어 사이를 끊지 않아요."],
      ["I also am tired.", "I am also tired.", "be동사 뒤에 와요."],
      ["enough big", "big enough", "enough는 뒤에 와요."]],
     "Honestly, / To be honest, / Actually, / Personally, 로 문장을 열면 말이 자연스럽게 이어져요.",
     more=["comp-adj", "mod-order"], m=r"also는|빈도부사|일반동사 앞!|enough는|부사 위치")

node("mod-prep", "전치사구", "전치사 + 명사 덩어리",
     "in the morning, at home, with my friends처럼 전치사와 명사가 한 덩어리가 되어 장소·시간·방법을 알려 줘요.",
     ["전치사 뒤는 명사, 대명사(목적격), 동명사만 와요. after <em>dinner</em>, with <em>him</em>, before <em>going</em> out.",
      "시간: <em>at</em> 7 o'clock / <em>on</em> Monday / <em>in</em> July, in 2026, in the morning.",
      "장소: <em>at</em> (지점) / <em>on</em> (표면) / <em>in</em> (안). at the bus stop, on the table, in the room.",
      "this, last, next, every 앞에는 전치사를 안 써요. last week (in last week ✕).",
      "전치사구는 명사도 꾸며요. the people <em>in my class</em>."],
     [["{S:I} {V:work out} {M:at the gym} {M:after work}.", "퇴근 후에 헬스장에서 운동해요."],
      ["{S:We} {V:met} {M:on Friday}.", "우리는 금요일에 만났어요."],
      ["{S:I} {V:went} {M:to the beach} {M:with my family}.", "가족과 바닷가에 갔어요."]],
     [["I went there in last year.", "I went there last year.", "last 앞에는 전치사를 안 써요."],
      ["I'm good at cook.", "I'm good at cooking.", "전치사 뒤는 -ing예요."],
      ["in Monday", "on Monday", "요일은 on."],
      ["I go to home.", "I go home.", "home은 부사예요."]],
     "on foot, by bus, on holiday, at work, in a rush처럼 덩어리째 외우는 게 가장 빨라요.",
     more=["verb-intr", "obj-ger", "mod-order"], m=r"전치사|on foot|on holiday|in a rush|by bus|over the holiday|on my own")

node("mod-order", "수식어 순서", "장소 → 방법 → 시간",
     "문장 끝에 수식어가 여러 개 올 때는 보통 장소 → 방법 → 시간 순서예요. 시간은 맨 앞으로 빼도 돼요.",
     ["I went <em>to Busan</em> / <em>by train</em> / <em>last weekend</em>.",
      "작은 단위가 먼저예요. at 7 / on Monday / in May.",
      "동사와 목적어 사이에는 수식어를 넣지 않아요.",
      "시간·장소를 강조하려면 문장 맨 앞에 둬요. <em>Last weekend,</em> I went to Busan."],
     [["{S:I} {V:go} {M:to the gym} {M:by bus} {M:every morning}.", "저는 매일 아침 버스로 헬스장에 가요."],
      ["{M:Last year}, {S:I} {V:lived} {M:in Australia}.", "작년에 저는 호주에 살았어요."],
      ["{S:I} {V:met} {O:her} {M:at a café} {M:yesterday}.", "어제 카페에서 그녀를 만났어요."]],
     [["I went yesterday to the park.", "I went to the park yesterday.", "장소가 시간보다 먼저예요."],
      ["I watched last night a movie.", "I watched a movie last night.", "동사 + 목적어를 붙여요."]],
     "한국어는 '어제 공원에 갔어요'지만 영어는 거꾸로 '갔어요 공원에 어제'라고 생각하면 순서가 맞아요.",
     more=["mod-adv", "mod-prep"])

# ───────────── 5가지 틀
node("forms", "문장의 5가지 틀", "동사가 정하는 다섯 가지 모양 (1~5형식)",
     "동사가 뒤에 무엇을 필요로 하느냐에 따라 문장 모양이 다섯 가지로 나뉘어요. 흔히 1~5형식이라고 불러요.",
     ["형식을 외우는 게 목적이 아니에요. 동사를 보면 뒤에 뭐가 와야 하는지 감이 오게 하는 지도예요.",
      "같은 동사도 뜻에 따라 틀이 달라져요. I got a letter(3형식) / I got tired(2형식) / I got him a gift(4형식).",
      "수식어는 어느 틀에나 자유롭게 붙어요."],
     [["{S:He} {V:runs}.", "1형식 · 그는 달려요."],
      ["{S:He} {V:is} {C:fast}.", "2형식 · 그는 빨라요."],
      ["{S:He} {V:has} {O:a dog}.", "3형식 · 그는 개를 키워요."],
      ["{S:He} {V:gave} {IO:me} {DO:a gift}.", "4형식 · 그는 저에게 선물을 줬어요."],
      ["{S:He} {V:makes} {O:me} {OC:laugh}.", "5형식 · 그는 저를 웃게 해요."]],
     tip="답이 단조롭다면 2·3형식만 쓰고 있을 가능성이 커요. 4·5형식 문장을 하나씩 섞어 보세요.",
     kids=["f1", "f2", "f3", "f4", "f5"])

node("f1", "1형식", "주어 + 동사",
     "주어와 동사만으로 완성되는 문장이에요. 동사는 자동사예요.",
     ["뼈대는 짧지만 보통 수식어(장소·시간)가 따라와요.",
      "대표 동사: go, come, live, work, sleep, arrive, happen, exist, matter.",
      "There is / are 문장도 1형식이에요."],
     [["{S:The sun} {V:rises} {M:in the east}.", "해는 동쪽에서 떠요."],
      ["{S:I} {V:live} {M:in Seoul}.", "저는 서울에 살아요."],
      ["{S:It} {V:doesn't matter}.", "상관없어요."]],
     [["I live Seoul.", "I live in Seoul.", "자동사 뒤에 명사를 쓰려면 전치사가 필요해요."]],
     "It depends. / It matters. / It works. 는 짧지만 자연스러운 1형식 문장이에요.",
     more=["verb-intr", "subj-there", "mod-prep"])

node("f2", "2형식", "주어 + 동사 + 보어",
     "주어가 무엇인지, 어떤 상태인지 말하는 문장이에요. 주어 = 보어.",
     ["동사는 be동사와 연결동사(become, get, look, feel, seem, sound…)예요.",
      "보어는 명사 또는 형용사예요."],
     [["{S:I} {V:am} {C:an office worker}.", "저는 회사원이에요."],
      ["{S:The food} {V:tastes} {C:great}.", "음식이 정말 맛있어요."],
      ["{S:It} {V:is getting} {C:cold}.", "날이 추워지고 있어요."]],
     [["It tastes greatly.", "It tastes great.", "보어는 형용사예요."]],
     "사람·장소·경험을 묘사할 때 기본이 되는 틀이에요.",
     more=["verb-link", "comp-subj", "comp-adj"])

node("f3", "3형식", "주어 + 동사 + 목적어",
     "'누가 무엇을 하다'. 영어에서 가장 흔한 문장이에요.",
     ["동사는 타동사, 목적어는 명사·대명사·동명사·to부정사·절이에요.",
      "동사와 목적어 사이를 끊지 않아요."],
     [["{S:I} {V:love} {O:spicy food}.", "저는 매운 음식을 정말 좋아해요."],
      ["{S:She} {V:enjoys} {O:hiking}.", "그녀는 등산을 즐겨요."],
      ["{S:I} {V:think} {O:it's worth it}.", "그럴 만한 가치가 있다고 생각해요."]],
     [["I like very much it.", "I like it very much.", "동사 + 목적어를 붙여요."]],
     more=["verb-tr", "obj"])

node("f4", "4형식", "주어 + 동사 + 사람 + 물건",
     "'누구에게 무엇을 해 주다'. 목적어가 두 개예요.",
     ["사람(간접목적어) → 물건(직접목적어) 순서예요.",
      "3형식으로 바꾸면 물건 + to / for + 사람이 돼요.",
      "대표 동사: give, send, show, tell, teach, buy, make, lend, ask."],
     [["{S:She} {V:told} {IO:me} {DO:a secret}.", "그녀가 저에게 비밀을 말해 줬어요."],
      ["{S:I} {V:made} {IO:my mom} {DO:a cake}.", "엄마께 케이크를 만들어 드렸어요."],
      ["{S:My friend} {V:lent} {IO:me} {DO:some money}.", "친구가 돈을 좀 빌려줬어요."]],
     [["She told to me a secret.", "She told me a secret.", "tell + 사람 + 내용."]],
     more=["obj-two"])

node("f5", "5형식", "주어 + 동사 + 목적어 + 목적격 보어",
     "'목적어가 ~하게 / ~하도록 하다'. 목적어와 그 뒤의 말이 주어-서술어 관계예요.",
     ["4형식과 구별: 4형식은 사람 ≠ 물건(me ≠ a book), 5형식은 목적어 = 보어(me = happy).",
      "목적격 보어: 형용사, 명사, to부정사, 동사원형, -ing.",
      "대표 동사: make, keep, find, call, want, ask, tell, let, help, see, hear."],
     [["{S:The movie} {V:made} {O:me} {OC:cry}.", "그 영화를 보고 울었어요."],
      ["{S:I} {V:keep} {O:my room} {OC:clean}.", "저는 방을 깨끗하게 유지해요."],
      ["{S:People} {V:call} {O:him} {OC:a genius}.", "사람들은 그를 천재라고 불러요."],
      ["{S:I} {V:asked} {O:him} {OC:to wait}.", "그에게 기다려 달라고 했어요."]],
     [["It made me to cry.", "It made me cry.", "make + 목적어 + 동사원형."]],
     "원인과 결과를 말할 때 써요. It makes me ~, It keeps me ~, It helps me ~.",
     more=["comp-obj"])

# ═════════════ 2단계: Grammar in Use 범위를 참고해 보강 (예문과 설명은 모두 새로 쓴 것)
# ───── 기존 가지 보강
node("subj-there", "There is / are", "~이 있다",
     "'~이 있다'고 처음 소개할 때 쓰는 틀이에요. there는 자리만 채우고, 진짜 주어는 be동사 뒤에 와요.",
     [("be동사는 뒤 명사에 맞춰요", "There <em>is</em> a park. / There <em>are</em> many parks."),
      ("have ✕", "'있다'는 There is / are예요. There has a park ✕."),
      ("there와 it의 차이", "<em>처음</em> 꺼내는 건 there, <em>이미 말한 것</em>을 가리킬 땐 it이에요. There's a new café near my office. <em>It</em>'s really good."),
      ("과거 · 미래 · 추측", "There <em>was / were</em>, There <em>will be</em>, There <em>must be</em>, There <em>might be</em>, There <em>used to be</em> (예전엔 있었어요).")],
     [["There {V:is} {S:a café} {M:near my house}.", "우리 집 근처에 카페가 있어요."],
      ["There {V:are} {S:a lot of mountains} {M:in Korea}.", "한국에는 산이 많아요."],
      ["There {V:used to be} {S:a cinema} {M:here}.", "예전에는 여기 영화관이 있었어요."]],
     [["There has a big park.", "There is a big park.", "there 뒤에는 have가 아니라 be동사예요."],
      ["There is many people.", "There are many people.", "진짜 주어 people이 복수예요."],
      ["It was a lot of traffic.", "There was a lot of traffic.", "처음 말하는 '있었다'는 there예요."]],
     "동네·고향을 묘사할 때 There is ~로 꺼내고, 바로 It's ~로 이어 가면 자연스러워요.",
     more=["subj-agree", "subj-pron", "f1"], m=r"there (is|are|was|were|has|have)\b")

node("verb-phrasal", "구동사", "동사 + 짧은 말이 한 덩어리",
     "동사에 up, off, out, on 같은 말이 붙어서 새 뜻이 되는 덩어리예요. put off(미루다), give up(포기하다)처럼요.",
     [("명사 목적어의 자리", "가운데·뒤 둘 다 돼요. turn on the light = turn the light on."),
      ("대명사는 가운데", "목적어가 it, them, me면 <em>반드시 가운데</em>예요. turn <em>it</em> on ○ / turn on it ✕."),
      ("못 떼는 구동사", "look for, look after, deal with, come up with, run out of는 항상 뒤에 목적어가 와요."),
      ("구동사 + 전치사", "세 단어가 한 덩어리인 것도 있어요. look forward <em>to</em>, keep up <em>with</em>, run away <em>from</em>, get on <em>with</em>.")],
     [["{S:I} {V:put off} {O:the cleaning} {M:until tomorrow}.", "청소를 내일로 미뤘어요."],
      ["{S:I} {V:put} {O:it} {V:off}.", "그걸 미뤘어요."],
      ["{S:I} {V:can't keep up with} {O:the class}.", "수업을 따라갈 수가 없어요."]],
     [["I'll pick up you at seven.", "I'll pick you up at seven.", "대명사는 가운데에 넣어요."],
      ["Turn off it.", "Turn it off.", "대명사는 가운데에 넣어요."],
      ["I'm looking forward to see you.", "I'm looking forward to seeing you.", "look forward to 뒤는 -ing예요."]],
     "구동사는 딱딱한 단어보다 자연스러워요. postpone → put off, tolerate → put up with.",
     more=["verb-tr", "obj-noun", "obj-ger"], m=r"구동사|put off|pick up|come up with|deal with|run out of|give up|look after|bring it up|clear up|reach out|talk something through|slow down")

node("obj-ger", "동명사 목적어", "enjoy -ing",
     "어떤 동사는 뒤에 '~하는 것을'을 말할 때 -ing만 받아요.",
     [("-ing만 받는 동사", "enjoy, finish, mind, avoid, suggest, recommend, consider, imagine, admit, deny, risk, fancy, stop."),
      ("구동사 뒤에도 -ing", "give up, put off, keep (on), go on, carry on + -ing. I <em>gave up</em> drink<em>ing</em> coffee."),
      ("전치사 뒤 -ing", "be good at -ing, be interested in -ing, look forward to -ing, be used to -ing."),
      ("동사 + 사람 + -ing", "I can't imagine <em>him cooking</em>. / Sorry to keep <em>you waiting</em>."),
      ("부정은 not -ing", "I enjoy <em>not having</em> to get up early.")],
     [["{S:I} {V:enjoy} {O:walking my dog}.", "저는 강아지 산책시키는 걸 즐겨요."],
      ["{S:My friend} {V:suggested} {O:going to Jeju}.", "친구가 제주에 가자고 했어요."],
      ["{S:I} {V:look forward to} {O:seeing you}.", "만나기를 기대하고 있어요."]],
     [["I enjoy to read.", "I enjoy reading.", "enjoy + -ing."],
      ["She suggested to take a taxi.", "She suggested taking a taxi.", "suggest + -ing."],
      ["I'm used to wake up early.", "I'm used to waking up early.", "be used to + -ing."]],
     "I enjoy -ing, I'm into -ing, I spend time -ing 는 취미를 말할 때 단골 틀이에요.",
     more=["obj-to", "obj-both", "obj-like", "subj-ger"], m=r"\+ -ing|from -ing|to -ing|than -ing|뒤엔 동사 -ing|동명사(?! 주어)")

node("obj-to", "to부정사 목적어", "want to ~",
     "어떤 동사는 뒤에 '~하는 것을'을 말할 때 to + 동사원형만 받아요.",
     [("to만 받는 동사", "want, hope, decide, plan, agree, offer, promise, refuse, manage, fail, afford, learn, tend."),
      ("seem · pretend", "seem, appear, pretend 뒤에도 to예요. He <em>seems to</em> know everything."),
      ("부정은 not to", "I decided <em>not to</em> go. / I promised <em>not to</em> be late."),
      ("의문사 + to", "I don't know <em>what to</em> do / <em>how to</em> cook / <em>where to</em> go.")],
     [["{S:I} {V:want} {O:to travel abroad}.", "해외여행을 가고 싶어요."],
      ["{S:We} {V:decided} {O:to move}.", "우리는 이사하기로 했어요."],
      ["{S:I} {V:don't know} {O:how to explain it}.", "그걸 어떻게 설명해야 할지 모르겠어요."]],
     [["I want go home.", "I want to go home.", "want + to."],
      ["I decided going.", "I decided to go.", "decide + to."],
      ["I decided to not go.", "I decided not to go.", "부정은 not to예요."]],
     "앞으로의 계획을 말할 때는 I'm planning to ~, I'd like to ~, I hope to ~ 를 번갈아 쓰세요.",
     more=["obj-ger", "obj-both", "obj-like", "comp-obj"], m=r"(want|hope|decide|plan|need|agree|learn) to|how to \+|agree to \+|a way to \+")

node("obj-both", "to와 -ing에 따라 뜻이 달라지는 동사", "remember, try, stop",
     "to부정사와 동명사를 둘 다 받는데, 무엇을 쓰느냐에 따라 뜻이 바뀌는 동사가 있어요.",
     [("remember · forget", "<em>-ing</em> = (이미) 한 일을 기억하다 · <em>to</em> = (앞으로) 할 일을 기억하다."),
      ("regret", "<em>-ing</em> = 한 일을 후회하다 · <em>to</em> = 유감이지만 ~하다 (I regret to say ~, 격식)."),
      ("go on", "<em>-ing</em> = 하던 일을 계속하다 · <em>to</em> = 이어서 다른 일을 하다."),
      ("try", "<em>to</em> = ~하려고 애쓰다 · <em>-ing</em> = 시험 삼아 해 보다."),
      ("need", "I need <em>to charge</em> my phone. = My phone needs <em>charging</em>. (물건이 주어면 -ing = ~되어야 한다)"),
      ("stop", "<em>-ing</em> = ~하는 걸 그만두다. stop <em>to</em> ~는 '~하려고 (하던 일을) 멈추다'로, to가 목적을 나타내요."),
      ("뜻이 같은 동사", "begin, start, continue는 둘 다 써도 같아요. 단, -ing가 겹치면 to를 써요. It's starting <em>to rain</em>.")],
     [["{S:I} {V:remember} {O:locking the door}.", "문 잠근 게 기억나요."],
      ["{V:Remember} {O:to lock the door}.", "문 잠그는 거 잊지 마세요."],
      ["{S:I} {V:regret} {O:quitting the gym}.", "헬스장 그만둔 걸 후회해요."],
      ["{S:My phone} {V:needs} {O:charging}.", "휴대폰을 충전해야 해요."]],
     [["I stopped to smoke last year.", "I stopped smoking last year.", "끊었다 = stop -ing."],
      ["I'm trying to reading books.", "I'm trying to read books.", "to 뒤는 동사원형이에요."]],
     "'요즘 ~하려고 노력 중이에요'는 I'm trying to + 동사원형. 말할 때 정말 자주 써요.",
     more=["obj-ger", "obj-to", "obj-like"], m=r"remember|forget to|try to|trying to|start -ing|stop -ing")

node("obj-like", "like -ing · like to · would like", "좋아하다와 하고 싶다",
     "like, love, hate 뒤에는 -ing와 to를 둘 다 쓸 수 있지만, 쓰임이 조금 달라요.",
     [("둘 다 되는 때", "반복해서 하는 일은 둘 다 돼요. I like <em>getting</em> up early. = I like <em>to get</em> up early."),
      ("지금 하고 있는 일은 -ing", "이미 그런 상황일 때는 -ing예요. I live in Seoul now. I like <em>living</em> here."),
      ("like to = 그렇게 하는 편이다", "즐겁지 않아도 '그렇게 하기로 한다'는 뜻이 돼요. I like <em>to clean</em> the kitchen every day."),
      ("would like + to", "'~하고 싶다'는 항상 to예요. I'd like <em>to go</em>. (I'd like going ✕)"),
      ("enjoy · mind는 -ing만", "I enjoy <em>cooking</em>. / I don't mind <em>waiting</em>.")],
     [["{S:I} {V:like} {O:living here}.", "저는 여기 사는 게 좋아요."],
      ["{S:I} {V:would like} {O:to visit Canada}.", "캐나다에 가 보고 싶어요."],
      ["{S:I} {V:don't mind} {O:waiting}.", "기다려도 괜찮아요."]],
     [["I'd like going there.", "I'd like to go there.", "would like + to."],
      ["I like play tennis.", "I like playing tennis.", "like 뒤에 동사원형은 못 와요."]],
     "I like ~ (평소에 좋아하는 것)와 I'd like to ~ (지금 하고 싶은 것)를 구분해서 쓰면 정확해 보여요.",
     more=["obj-ger", "obj-to"], m=r"would like|I'd like|would rather")

node("comp-obj", "목적격 보어", "목적어 = 보어",
     "목적어 뒤에서 그 목적어가 무엇인지, 어떤 상태인지, 무엇을 하는지를 말해 줘요. '목적어가 ~하게 / ~라고 / ~하도록'.",
     [("형용사 · 명사", "make me <em>happy</em>, keep the room <em>clean</em>, call him <em>Tim</em>, find it <em>difficult</em>."),
      ("목적어 + to부정사", "want, ask, tell, expect, advise, remind, warn, invite, encourage, persuade, allow, teach, get + 목적어 + <em>to 동사원형</em>."),
      ("want that ✕ · suggest me to ✕", "I want <em>you to</em> come. (want that you come ✕) / She suggested <em>that I</em> ask you. (suggested me to ask ✕)"),
      ("동사원형 (make · let)", "make / let + 목적어 + <em>동사원형</em>. help는 to가 있어도 없어도 돼요."),
      ("make의 수동태", "수동태가 되면 to가 살아나요. They made us wait. → We <em>were made to</em> wait."),
      ("see + 목적어 + do / doing", "<em>do</em> = 처음부터 끝까지 본 것 · <em>doing</em> = 하는 도중을 본 것. I saw him <em>cross</em> the road. / I saw him <em>crossing</em> the road."),
      ("find it + 형용사 + to", "it은 가짜 목적어, 진짜는 to ~ 예요. I find it hard <em>to say no</em>.")],
     [["{S:Music} {V:makes} {O:me} {OC:happy}.", "음악은 저를 행복하게 해요."],
      ["{S:My parents} {V:want} {O:me} {OC:to study harder}.", "부모님은 제가 더 열심히 공부하길 바라세요."],
      ["{S:My boss} {V:let} {O:me} {OC:leave early}.", "상사가 일찍 가게 해 줬어요."],
      ["{S:I} {V:saw} {O:him} {OC:crossing the street}.", "그가 길을 건너고 있는 걸 봤어요."]],
     [["My mom made me to clean my room.", "My mom made me clean my room.", "make + 목적어 + 동사원형."],
      ["I want that you come.", "I want you to come.", "want + 목적어 + to."],
      ["It makes me happily.", "It makes me happy.", "목적격 보어는 형용사예요."],
      ["She let me to go.", "She let me go.", "let + 목적어 + 동사원형."]],
     "It makes me feel ~, It helps me relax, It allows me to ~ 는 이유를 설명할 때 가장 쓸모 있는 틀이에요.",
     more=["f5", "comp-adj", "obj-to"], m=r"목적격 보어|5형식|사역|\+ 사람 \+ to|find it \+|bring people closer|keep things fair|helps work go|see A as B|take A as B")

node("comp-adj", "형용사 자리에 부사를 쓰는 실수", "happy 와 happily",
     "보어 자리는 형용사예요. 한국어 '~하게'에 끌려 -ly 부사를 쓰는 실수가 아주 흔해요.",
     [("형용사가 하는 일", "명사를 꾸미거나 보어가 돼요. a <em>quiet</em> room / The room is <em>quiet</em>."),
      ("부사가 하는 일", "동사·형용사·다른 부사를 꾸며요. She speaks <em>quietly</em>. / <em>really</em> good / <em>incredibly</em> quickly."),
      ("구별하는 법", "주어·목적어의 <em>상태</em>면 형용사, 동작의 <em>방식</em>이면 부사예요. She speaks <em>perfect</em> English. = She speaks English <em>perfectly</em>."),
      ("-ly로 끝나는 형용사", "friendly, lovely, lonely, lively, elderly는 형용사예요."),
      ("good 과 well", "good은 형용사, well은 부사예요. 단, well은 '건강한'이라는 형용사로도 써요. I'm very <em>well</em>, thanks."),
      ("hard · fast · late", "형용사와 부사 모양이 같아요. work <em>hard</em>, run <em>fast</em>, get up <em>late</em>. lately는 '최근에'예요."),
      ("hardly", "'거의 ~않다'. 동사 앞에 와요. I <em>hardly</em> know him. / I can <em>hardly</em> hear you.")],
     [["{S:He} {V:is} {C:careful}.", "그는 조심스러운 사람이에요."],
      ["{S:He} {V:drives} {M:carefully}.", "그는 조심스럽게 운전해요."],
      ["{S:I} {M:hardly} {V:know} {O:him}.", "저는 그를 거의 몰라요."]],
     [["I feel badly about it.", "I feel bad about it.", "feel + 형용사."],
      ["She sings beautiful.", "She sings beautifully.", "동작의 방식은 부사예요."],
      ["I studied hardly.", "I studied hard.", "hardly는 '거의 ~않다'예요."],
      ["really quality", "really good quality", "부사는 명사를 못 꾸며요."]],
     "I did good ✕ → I did well. 결과를 말할 때 자주 틀리는 부분이에요.",
     more=["mod-adv", "comp-subj", "verb-link"], m=r"형용사 자리|부사는 명사|hardly|\(형용사\)")

node("mod-adj", "형용사 수식", "명사를 꾸미는 말",
     "형용사는 명사 앞에서 '어떤' 명사인지 알려 줘요.",
     [("명사 앞", "a <em>beautiful</em> beach."),
      ("-thing은 뒤에서", "something <em>special</em>, someone <em>new</em>."),
      ("의견이 사실보다 먼저", "의견(nice, beautiful) → 사실(new, big, wooden). a <em>nice new</em> house."),
      ("사실 형용사의 순서", "크기 → 나이 → 색 → 출신 → 재료. a <em>big old white Korean wooden</em> table."),
      ("색이 둘이면 and", "a black <em>and</em> white dress. 다른 형용사 사이에는 and를 안 써요. a long black dress.")],
     [["{S:I} {V:live} {M:in a small quiet town}.", "저는 작고 조용한 동네에 살아요."],
      ["{S:I} {V:want} {O:something sweet}.", "달콤한 게 먹고 싶어요."],
      ["{S:She} {V:bought} {O:a nice big wooden table}.", "그녀는 멋지고 큰 나무 식탁을 샀어요."]],
     [["I want to eat special something.", "I want to eat something special.", "-thing은 뒤에서 꾸며요."],
      ["a red big bag", "a big red bag", "크기 → 색 순서예요."],
      ["a long and black dress", "a long black dress", "색끼리가 아니면 and를 안 써요."]],
     "명사 하나에 형용사 하나만 붙여도 묘사가 살아나요. a place → a peaceful place.",
     more=["comp-adj", "rel-who", "subj-noun"], m=r"뒤에서 꾸|형용사 순서")

node("mod-adv", "부사 수식", "동사·형용사·문장을 꾸미는 말",
     "부사는 어떻게, 얼마나, 얼마나 자주, 언제를 알려 줘요.",
     [("방식 (well, carefully)", "동사 + 목적어 뒤에 와요. She speaks English <em>well</em>. (speaks well English ✕)"),
      ("동사가 한 단어일 때", "always, usually, often, never, also, probably, almost는 <em>동사 앞</em>이에요. I <em>always</em> walk to work."),
      ("be동사는 뒤", "am / is / are / was / were <em>뒤</em>에 와요. I'm <em>always</em> late. / We were <em>also</em> hungry."),
      ("동사가 두 단어 이상일 때", "<em>첫 번째 동사 뒤</em>예요. I can <em>never</em> remember. / She doesn't <em>usually</em> drive. / I've <em>always</em> lived here."),
      ("have to 앞", "I <em>always</em> have to call him. (have always to ✕)"),
      ("probably와 부정", "부정어 앞에 와요. I <em>probably</em> won't go. (won't probably ✕)"),
      ("all · both도 같은 자리", "We <em>all</em> felt tired. / My parents are <em>both</em> teachers."),
      ("문장 전체", "Actually, Honestly, Luckily는 맨 앞 + 쉼표."),
      ("enough는 뒤", "big <em>enough</em>, long <em>enough</em>. 명사는 앞에서 꾸며요. <em>enough</em> money.")],
     [["{S:I} {M:usually} {V:walk} {M:to work}.", "저는 보통 걸어서 출근해요."],
      ["{S:She} {V:speaks} {O:English} {M:very well}.", "그녀는 영어를 아주 잘해요."],
      ["{S:I} {V:am} {M:always} {C:busy} {M:on Mondays}.", "저는 월요일마다 항상 바빠요."],
      ["{S:I} {M:also} {V:like} {O:going for a walk}.", "저는 산책하는 것도 좋아해요."]],
     [["I go always to the gym.", "I always go to the gym.", "한 단어 동사 앞이에요."],
      ["I like very much pizza.", "I like pizza very much.", "동사와 목적어 사이를 끊지 않아요."],
      ["I also am tired.", "I am also tired.", "be동사 뒤에 와요."],
      ["I won't probably go.", "I probably won't go.", "probably는 부정어 앞이에요."]],
     "Honestly, / To be honest, / Actually, / Personally, 로 문장을 열면 말이 자연스럽게 이어져요.",
     more=["comp-adj", "mod-order"], m=r"also는|빈도부사|일반동사 앞!|enough는|부사 위치")

# ───── 동사 › 시제
node("t-pres", "현재: I do 와 I am doing", "늘 하는 일과 지금 하는 일",
     "현재 단순(I do)은 늘 그런 일, 현재진행(I am doing)은 지금 하고 있는 일을 말해요.",
     [("현재 단순 = 늘 · 반복", "습관, 사실, 얼마나 자주 하는지. I <em>get up</em> at seven every day."),
      ("현재진행 = 지금 · 요즘", "지금 하는 중이거나 요즘 일시적으로 하는 일. I'<em>m learning</em> to drive these days."),
      ("변하고 있는 일", "get, change, improve, increase + 진행형. My English <em>is getting</em> better."),
      ("always + 진행형", "'너무 자주 그런다'는 뜻이 돼요. I'<em>m always losing</em> my keys.")],
     [["{S:I} {V:work} {M:at a hospital}.", "저는 병원에서 일해요."],
      ["{S:I} {V:am working} {M:from home} {M:this week}.", "이번 주는 집에서 일하고 있어요."],
      ["{S:My English} {V:is getting} {C:better}.", "제 영어가 나아지고 있어요."]],
     [["I'm usually getting up at 7.", "I usually get up at 7.", "습관은 현재 단순이에요."],
      ["Look! It rains.", "Look! It's raining.", "지금 일어나는 일은 진행형이에요."]],
     "자기소개(직업·습관)는 현재 단순, '요즘 ~하고 있어요'는 진행형. 둘을 섞어 쓰면 답이 살아나요.",
     more=["t-state", "subj-agree", "verb-be"], m=r"현재진행|are keeping|지금 그렇다는")

node("t-state", "진행형으로 안 쓰는 동사", "know, like, want",
     "상태를 나타내는 동사는 진행형으로 잘 쓰지 않아요.",
     [("대표 동사", "like, love, hate, want, need, prefer, know, understand, believe, remember, mean, belong, seem."),
      ("think", "'~라고 생각하다(의견)'는 단순형, '생각 중이다'는 진행형이에요. I <em>think</em> it's good. / I'<em>m thinking</em> about it."),
      ("see · hear · smell · taste", "감각은 보통 can과 함께 써요. I <em>can hear</em> music."),
      ("have", "'가지다'는 단순형, '먹다·보내다'는 진행형이 돼요. I'<em>m having</em> lunch.")],
     [["{S:I} {V:know} {O:him} {M:well}.", "저는 그를 잘 알아요."],
      ["{S:I} {V:want} {O:some coffee}.", "커피가 마시고 싶어요."],
      ["{S:I} {V:am thinking} {M:about changing jobs}.", "이직을 생각하고 있어요."]],
     [["I'm knowing the answer.", "I know the answer.", "know는 진행형 ✕."],
      ["I'm wanting to go home.", "I want to go home.", "want는 진행형 ✕."],
      ["I'm liking this song.", "I like this song.", "like는 진행형 ✕."]],
     "I'm loving it 같은 표현은 광고 문구예요. 시험에서는 I love it으로 말하세요.",
     more=["t-pres", "t-perf-cont"])

node("t-past", "과거: I did 와 I was doing", "끝난 일과 하던 중이던 일",
     "과거 단순(I did)은 끝난 일, 과거진행(I was doing)은 그때 하던 중이던 일이에요.",
     [("과거 단순", "끝난 일. 부정·의문은 did + 동사원형이에요. I <em>didn't go</em>. / <em>Did</em> you <em>go</em>?"),
      ("과거진행", "어떤 시점에 하던 중이던 일. At 8, I <em>was having</em> dinner."),
      ("둘을 함께", "하던 중(진행)에 일이 일어났다(단순). I <em>was cooking</em> when she <em>called</em>."),
      ("불규칙 동사", "go – went, see – saw, buy – bought, eat – ate, take – took. 자주 쓰는 것부터 외워요.")],
     [["{S:I} {V:visited} {O:my grandparents} {M:last weekend}.", "지난 주말에 조부모님을 찾아뵀어요."],
      ["{S:I} {V:was studying} {M:when you called}.", "전화하셨을 때 공부하고 있었어요."],
      ["{S:I} {V:didn't sleep} {M:well} {M:last night}.", "어젯밤에 잘 못 잤어요."]],
     [["I didn't went there.", "I didn't go there.", "did 뒤는 동사원형이에요."],
      ["Did you saw it?", "Did you see it?", "did 뒤는 동사원형이에요."],
      ["When I was a child, I was playing soccer every day.", "When I was a child, I played soccer every day.", "과거의 습관은 과거 단순이에요."]],
     "과거 질문에는 과거로 답하세요. 첫 문장의 시제를 끝까지 지키는 게 중요해요.",
     more=["t-usedto", "t-perf-past", "t-pastperf"], m=r"과거진행|was dealing|과거 질문")

node("t-perf", "현재완료: I have done", "과거와 지금을 잇는 시제",
     "have + p.p.는 과거의 일이 지금과 이어져 있을 때 써요.",
     [("지금 결과가 남은 일", "I'<em>ve lost</em> my key. (그래서 지금 없어요)"),
      ("경험", "지금까지 해 본 적. <em>Have</em> you ever <em>been</em> to Japan? / I'<em>ve never tried</em> it."),
      ("just · already · yet", "I'<em>ve just</em> finished. / I'<em>ve already</em> eaten. / I <em>haven't</em> finished <em>yet</em>."),
      ("아직 안 끝난 기간", "today, this week, recently, so far. I'<em>ve been</em> busy this week."),
      ("It's the first time", "It's the first time I'<em>ve tried</em> this. (현재완료를 써요)")],
     [["{S:I} {V:have been} {M:to Canada} {M:twice}.", "캐나다에 두 번 가 봤어요."],
      ["{S:I} {V:have already seen} {O:that movie}.", "그 영화는 이미 봤어요."],
      ["{S:I} {V:haven't decided} {M:yet}.", "아직 못 정했어요."]],
     [["I have went there.", "I have been there.", "have + p.p. (go – went – gone / been)."],
      ["I didn't finish yet.", "I haven't finished yet.", "yet은 현재완료와 써요."],
      ["I've never ate it.", "I've never eaten it.", "have + p.p. (eat – ate – eaten)."]],
     "Have you ever ~? 로 묻는 질문에는 Yes, I have. I went there last year. 처럼 경험은 현재완료, 구체적인 때는 과거로 이어 가세요.",
     more=["t-perf-past", "t-perf-cont", "t-for"], m=r"현재완료(?!진행)|has become|have found")

node("t-perf-cont", "현재완료진행: I have been doing", "전부터 지금까지 계속",
     "have been -ing는 과거에 시작해서 지금까지 계속하고 있는 일을 말해요.",
     [("지금까지 계속", "I'<em>ve been waiting</em> for an hour. (아직 기다리는 중)"),
      ("방금까지 하던 일", "흔적이 남아 있을 때. You look tired. — I'<em>ve been working</em> all day."),
      ("얼마나 오래 · 얼마나 많이", "<em>기간</em>은 진행형, <em>횟수·양</em>은 단순형이에요. I've <em>been reading</em> for two hours. / I've <em>read</em> 50 pages."),
      ("진행형이 안 되는 동사", "know, like, have(가지다)는 단순형으로 써요. I'<em>ve known</em> him for years.")],
     [["{S:I} {V:have been learning} {O:English} {M:for three years}.", "영어를 3년째 배우고 있어요."],
      ["{S:It} {V:has been raining} {M:all day}.", "하루 종일 비가 오고 있어요."],
      ["{S:I} {V:have known} {O:her} {M:since high school}.", "고등학교 때부터 그녀를 알아요."]],
     [["I'm learning English for three years.", "I've been learning English for three years.", "'~째 하고 있다'는 현재완료진행이에요."],
      ["I've been knowing him for a long time.", "I've known him for a long time.", "know는 진행형 ✕."]],
     "How long have you been -ing? 질문에는 I've been -ing for ~ 로 그대로 받아 답하면 돼요.",
     more=["t-for", "t-perf", "t-state"], m=r"현재완료진행|과거완료진행|had been -ing|have been -ing")

node("t-for", "for · since · how long", "기간과 시작점",
     "얼마나 오래 했는지 말할 때 for와 since를 써요.",
     [("for + 기간", "for two hours, for a long time, for ten years."),
      ("since + 시작점", "since Monday, since 2020, since I was a child."),
      ("when 과 how long", "<em>When</em> did it start? (과거) / <em>How long</em> has it been raining? (현재완료)"),
      ("It's been ~ since", "It's been two years <em>since</em> I moved here.")],
     [["{S:I} {V:have lived} {M:here} {M:for five years}.", "여기 산 지 5년 됐어요."],
      ["{S:I} {V:haven't seen} {O:him} {M:since last year}.", "작년 이후로 그를 못 봤어요."],
      ["{S:It} {V:has been} {C:a long time} {M:since we met}.", "우리 만난 지 오래됐네요."]],
     [["I've lived here since five years.", "I've lived here for five years.", "기간은 for예요."],
      ["I live here for five years.", "I've lived here for five years.", "지금까지 이어지면 현재완료예요."]],
     "얼마나 했는지 물으면 for + 기간으로 답하고, 언제부터인지는 since + 시점으로 덧붙이세요.",
     more=["t-perf-cont", "t-perf"])

node("t-perf-past", "현재완료와 과거의 차이", "I have done 와 I did",
     "끝난 때를 말하면 과거, 때를 말하지 않거나 지금과 이어지면 현재완료예요.",
     [("끝난 때가 있으면 과거", "yesterday, last year, in 2020, two days ago, when I was young과는 현재완료를 못 써요."),
      ("when 질문은 과거", "<em>When did</em> you arrive? (When have you arrived ✕)"),
      ("새 소식 → 자세한 이야기", "처음엔 현재완료, 이어지는 설명은 과거예요. I'<em>ve cut</em> my finger. — How <em>did</em> you do that?"),
      ("기간이 끝났는지", "오전이 안 끝났으면 I'<em>ve had</em> two coffees this morning. 끝났으면 I <em>had</em> two coffees this morning.")],
     [["{S:I} {V:went} {M:to Japan} {M:last year}.", "작년에 일본에 갔어요."],
      ["{S:I} {V:have been} {M:to Japan}.", "일본에 가 본 적이 있어요."],
      ["{S:I} {V:lost} {O:my wallet} {M:yesterday}.", "어제 지갑을 잃어버렸어요."]],
     [["I have seen him yesterday.", "I saw him yesterday.", "yesterday는 과거와 써요."],
      ["I have been there two years ago.", "I went there two years ago.", "ago는 과거와 써요."],
      ["When have you started?", "When did you start?", "when 질문은 과거예요."]],
     "가장 흔한 시제 실수예요. 문장에 '언제'가 들어가면 과거로 말한다고 기억하세요.",
     more=["t-perf", "t-past"])

node("t-pastperf", "과거완료: I had done", "과거보다 더 과거",
     "과거의 어떤 시점보다 먼저 일어난 일은 had + p.p.로 말해요.",
     [("더 앞선 일", "When I arrived, the movie <em>had</em> already <em>started</em>."),
      ("과거 단순과 비교", "When I arrived, she <em>left</em>. (도착하자 떠남) / she <em>had left</em>. (도착 전에 이미 떠남)"),
      ("과거완료진행", "그때까지 계속하던 일. I <em>had been waiting</em> for an hour when the bus came.")],
     [["{S:The train} {V:had left} {M:when I got there}.", "제가 도착했을 때 기차는 이미 떠났어요."],
      ["{S:I} {V:had never seen} {O:snow} {M:before that trip}.", "그 여행 전에는 눈을 본 적이 없었어요."],
      ["{S:I} {V:had been studying} {M:for hours}.", "몇 시간째 공부하고 있었어요."]],
     [["When I got home, my family already ate dinner.", "When I got home, my family had already eaten dinner.", "먼저 일어난 일은 과거완료예요."]],
     "경험담을 말할 때 'I had never ~ before'를 한 번 넣으면 이야기에 깊이가 생겨요.",
     more=["t-past", "t-perf"], m=r"과거완료")

node("t-usedto", "used to", "예전에는 ~했어요",
     "used to + 동사원형은 예전에는 그랬지만 지금은 아닌 일을 말해요.",
     [("과거의 습관 · 상태", "I <em>used to</em> play tennis. / There <em>used to</em> be a park here."),
      ("부정 · 의문", "I <em>didn't use to</em> like coffee. / <em>Did</em> you <em>use to</em> live here?"),
      ("현재형은 없어요", "지금의 습관은 usually를 써요. I <em>usually</em> walk to work."),
      ("be used to -ing 와 구별", "be used to -ing = ~에 익숙하다. I'<em>m used to</em> gett<em>ing</em> up early."),
      ("would", "과거에 반복하던 동작은 would도 돼요. We <em>would</em> go to the beach every summer.")],
     [["{S:I} {V:used to live} {M:in Busan}.", "예전에 부산에 살았어요."],
      ["{S:I} {V:didn't use to like} {O:vegetables}.", "예전에는 채소를 안 좋아했어요."],
      ["{S:I} {V:am used to} {O:working at night}.", "밤에 일하는 데 익숙해요."]],
     [["I use to go there.", "I used to go there.", "used to는 과거형으로만 써요."],
      ["I'm used to wake up early.", "I'm used to waking up early.", "be used to + -ing."],
      ["I used to going there.", "I used to go there.", "used to + 동사원형."]],
     "어린 시절 질문이 나오면 I used to ~, but now I ~ 로 과거와 현재를 대비해 보세요.",
     more=["t-past", "obj-ger"], m=r"used to")

node("t-future", "미래: will · be going to · 현재진행", "정한 때에 따라 달라요",
     "미래는 언제 정했는지에 따라 표현이 달라요.",
     [("will = 지금 정한 일", "말하는 순간 결정했을 때. I'<em>ll</em> have the pasta."),
      ("be going to = 미리 정한 일", "이미 마음먹은 계획. I'<em>m going to</em> study abroad next year."),
      ("현재진행 = 약속이 잡힌 일", "날짜·상대가 정해진 일정. I'<em>m meeting</em> my friend at six."),
      ("예측", "근거가 눈앞에 있으면 going to, 생각·추측이면 will. Look at the clouds. It'<em>s going to</em> rain. / I think it <em>will</em> be fine."),
      ("현재 단순 = 시간표", "The train <em>leaves</em> at nine."),
      ("will과 잘 쓰는 말", "probably, I think, I'm sure, I hope. I'<em>ll probably</em> be late.")],
     [["{S:I} {V:am going to visit} {O:my parents} {M:this weekend}.", "이번 주말에 부모님을 찾아뵐 거예요."],
      ["{S:I} {V:will call} {O:you} {M:later}.", "이따 전화할게요."],
      ["{S:I} {V:am meeting} {O:a friend} {M:tonight}.", "오늘 저녁에 친구를 만나기로 했어요."]],
     [["I will go to Japan next month. (이미 표를 샀을 때)", "I'm going to Japan next month.", "이미 정해진 일정은 will을 안 써요."],
      ["I go to the party tomorrow.", "I'm going to the party tomorrow.", "개인 일정은 현재진행이에요."]],
     "주말 계획을 물으면 will보다 I'm going to ~ 나 I'm -ing 로 답하는 게 자연스러워요.",
     more=["t-when", "m-may"], m=r"be going to|이미 정해진 계획")

node("t-when", "when · if 뒤에는 현재", "미래 일이어도 현재로",
     "when, if, after, before, until, as soon as 뒤에서는 미래 일도 현재시제로 말해요.",
     [("when + 현재", "I'll call you when I <em>get</em> home. (when I will get ✕)"),
      ("if + 현재", "If it <em>rains</em>, I'll stay home."),
      ("현재완료도 돼요", "먼저 끝나는 일이면 현재완료. I'll go out when I'<em>ve finished</em> this."),
      ("if 와 when", "<em>if</em> = 일어날지 모르는 일 · <em>when</em> = 일어날 게 확실한 일.")],
     [["{S:I} {V:will text} {O:you} {M:when I arrive}.", "도착하면 문자할게요."],
      ["{M:If I have time}, {S:I} {V:will help} {O:you}.", "시간이 있으면 도와줄게요."],
      ["{S:I} {V:will wait} {M:until you come back}.", "돌아올 때까지 기다릴게요."]],
     [["I'll call you when I will arrive.", "I'll call you when I arrive.", "when 뒤는 현재예요."],
      ["If it will rain, I'll stay home.", "If it rains, I'll stay home.", "if 뒤는 현재예요."]],
     "미래 계획을 말할 때 when I ~, I'll ~ 틀 하나로 문장이 길고 자연스러워져요.",
     more=["if-1", "t-future"], m=r"If \+ 현재|unless")

# ───── 동사 › 조동사
node("m-can", "can · could · be able to", "할 수 있다",
     "능력과 가능을 말해요.",
     [("can = 할 수 있다", "I <em>can</em> swim. 조동사 뒤나 완료형에서는 be able to를 써요. I'll <em>be able to</em> come. / I haven't <em>been able to</em> sleep."),
      ("could = 과거의 능력", "일반적인 능력이에요. I <em>could</em> run fast when I was young."),
      ("한 번 해낸 일은 was able to", "The exam was hard, but I <em>was able to</em> pass. (= managed to)"),
      ("could = 지금 · 미래의 가능성", "과거가 아니에요. It <em>could</em> rain later. / We <em>could</em> go to the beach."),
      ("could have p.p.", "할 수 있었는데 안 했다. I <em>could have gone</em>, but I was tired.")],
     [["{S:I} {V:can speak} {O:a little Japanese}.", "일본어를 조금 할 줄 알아요."],
      ["{S:I} {V:couldn't sleep} {M:last night}.", "어젯밤에 잠을 못 잤어요."],
      ["{S:I} {V:was able to finish} {O:it} {M:on time}.", "제시간에 끝낼 수 있었어요."]],
     [["I will can do it.", "I will be able to do it.", "will 뒤에는 be able to."],
      ["I can to drive.", "I can drive.", "can + 동사원형."]],
     "제안할 때 We could ~ 를 쓰면 부드러워요. We could meet at a café.",
     more=["m-may", "m-request", "verb-modal"])

node("m-must", "must · have to", "해야 한다",
     "둘 다 '해야 한다'지만, 부정이 되면 뜻이 완전히 달라져요.",
     [("have to = 해야 한다", "규칙이나 상황 때문에. I <em>have to</em> get up early tomorrow."),
      ("must", "말하는 사람의 의견이나 규칙문에 써요. 과거·미래는 had to / will have to예요."),
      ("mustn't 와 don't have to", "<em>mustn't</em> = 하면 안 된다 · <em>don't have to</em> = 안 해도 된다. 완전히 달라요."),
      ("have got to", "말할 때는 I'<em>ve got to</em> go. 도 많이 써요."),
      ("don't need to", "안 해도 된다. You <em>don't need to</em> hurry.")],
     [["{S:I} {V:have to work} {M:this Saturday}.", "이번 토요일에 일해야 해요."],
      ["{S:You} {V:mustn't tell} {O:anyone}.", "아무에게도 말하면 안 돼요."],
      ["{S:You} {V:don't have to pay}.", "돈을 안 내도 돼요."]],
     [["You don't must smoke here.", "You mustn't smoke here.", "금지는 mustn't."],
      ["I must to go.", "I must go.", "must + 동사원형."],
      ["Yesterday I must work late.", "Yesterday I had to work late.", "과거는 had to."]],
     "말할 때는 must보다 have to가 훨씬 흔해요. 의무는 I have to ~ 로 말하세요.",
     more=["m-should", "m-deduce"], m=r"have to \+|해야 할 수도")

node("m-should", "should · had better", "하는 게 좋다",
     "조언하거나 '그게 맞다'고 말할 때 써요.",
     [("should = 하는 게 좋다", "You <em>should</em> see a doctor. / I think you <em>should</em> ~ 로 부드럽게."),
      ("예상", "지금쯤 그럴 거다. She <em>should</em> be here by now."),
      ("should have p.p. = 후회", "했어야 했는데 (안 했다). I <em>should have studied</em> harder. / I <em>shouldn't have said</em> that."),
      ("had better", "안 하면 문제가 생길 때. 뒤는 동사원형이에요. We'<em>d better</em> leave now. / You'<em>d better not</em> be late."),
      ("ought to", "should와 같은 뜻이에요.")],
     [["{S:You} {V:should try} {O:this restaurant}.", "이 식당에 한번 가 보세요."],
      ["{S:I} {V:should have left} {M:earlier}.", "더 일찍 나왔어야 했어요."],
      ["{S:We} {V:had better hurry}.", "서두르는 게 좋겠어요."]],
     [["You should to go.", "You should go.", "should + 동사원형."],
      ["I should went there.", "I should have gone there.", "과거의 후회는 should have p.p."],
      ["You had better to go.", "You had better go.", "had better + 동사원형."]],
     "과거 경험을 말한 뒤 I should have ~ 로 아쉬움을 덧붙이면 답이 풍부해져요.",
     more=["m-must", "m-past"], m=r"should have")

node("m-may", "may · might · could", "~일지도 모른다",
     "확실하지 않은 일을 말할 때 써요.",
     [("지금 · 미래의 가능성", "It <em>might</em> rain. / She <em>may</em> be busy. / It <em>could</em> be true. 뜻 차이는 거의 없어요."),
      ("부정", "might not = 아닐지도 모른다. I <em>might not</em> go. (couldn't는 '그럴 리 없다'라서 달라요)"),
      ("진행형", "She <em>might be working</em>. (일하는 중일지도)"),
      ("과거 추측", "may / might have p.p. He <em>might have forgotten</em>."),
      ("might as well", "딱히 다른 수가 없으니 ~하는 게 낫다. We <em>might as well</em> walk.")],
     [["{S:I} {V:might go} {M:to Jeju} {M:this summer}.", "이번 여름에 제주에 갈지도 몰라요."],
      ["{S:She} {V:may be} {C:busy} {M:right now}.", "그녀는 지금 바쁠지도 몰라요."],
      ["{S:He} {V:might have missed} {O:the bus}.", "그는 버스를 놓쳤을지도 몰라요."]],
     [["It maybe rain.", "It may rain. / Maybe it will rain.", "maybe는 부사, may는 조동사예요."],
      ["I might to go.", "I might go.", "might + 동사원형."]],
     "계획이 확실하지 않을 때 I will 대신 I might ~ 를 쓰면 정확하고 자연스러워요.",
     more=["m-deduce", "m-past", "t-future"])

node("m-deduce", "must be · can't be", "틀림없이 ~다 / ~일 리 없다",
     "근거가 있어서 확신할 때 써요.",
     [("must = 틀림없이 ~다", "You've been working all day. You <em>must be</em> tired."),
      ("can't = ~일 리 없다", "반대는 mustn't가 아니라 can't예요. That <em>can't be</em> true."),
      ("진행형", "She <em>must be joking</em>."),
      ("과거", "must have p.p. / can't have p.p. I <em>must have left</em> it at home. / He <em>can't have seen</em> me.")],
     [["{S:You} {V:must be} {C:hungry}.", "배고프시겠어요."],
      ["{S:That} {V:can't be} {C:right}.", "그게 맞을 리가 없어요."],
      ["{S:I} {V:must have dropped} {O:my card}.", "카드를 떨어뜨린 게 틀림없어요."]],
     [["It mustn't be true.", "It can't be true.", "'~일 리 없다'는 can't예요."]],
     "상대 이야기에 You must be tired / That must have been hard 로 반응하면 대화가 자연스러워요.",
     more=["m-may", "m-past", "m-must"])

node("m-past", "조동사 + have p.p.", "지나간 일에 대한 후회와 추측",
     "조동사 뒤에 have + p.p.를 붙이면 과거 일에 대한 후회나 추측이 돼요.",
     [("should have p.p.", "했어야 했는데 (안 했다)."),
      ("could have p.p.", "할 수 있었는데 (안 했다)."),
      ("might have p.p.", "~했을지도 모른다."),
      ("must have p.p.", "~한 게 틀림없다."),
      ("can't have p.p.", "~했을 리 없다."),
      ("needn't have p.p.", "할 필요 없었는데 (했다).")],
     [["{S:I} {V:should have checked} {O:the time}.", "시간을 확인했어야 했어요."],
      ["{S:I} {V:could have gone}, but I was too tired.", "갈 수도 있었는데 너무 피곤했어요."],
      ["{S:I} {V:might not have locked} {O:the door}.", "문을 안 잠갔을지도 몰라요."]],
     [["I should have go.", "I should have gone.", "have 뒤는 p.p.예요."],
      ["I must had left it.", "I must have left it.", "조동사 뒤는 have (had ✕)."]],
     "should have /ʃʊdəv/ 처럼 붙여서 발음돼요. 듣기에서 놓치기 쉬운 부분이에요.",
     more=["m-should", "m-deduce", "if-3"], m=r"should have p|could have p|might have p|must have p")

node("m-would", "would", "~할 텐데 · ~하곤 했다",
     "실제가 아닌 상황을 상상하거나, 공손하게 말할 때 써요.",
     [("상상", "실제가 아닌 일. It <em>would</em> be nice to live by the sea."),
      ("will 과 비교", "I<em>'ll</em> stay. (실제로 그럴 거예요) / I<em>'d</em> stay, but I have to go. (그러고 싶지만 못 해요)"),
      ("과거의 반복", "used to처럼. When I was a kid, I <em>would</em> play outside all day."),
      ("공손한 표현", "I'<em>d like</em> ~, <em>Would you like</em> ~?, I'<em>d rather</em> ~."),
      ("would have p.p.", "(그랬다면) ~했을 텐데. I <em>would have called</em>, but I didn't have your number.")],
     [["{FS:It} {V:would be} {C:great} {RS:to travel more}.", "여행을 더 다니면 좋겠어요."],
      ["{S:I} {V:would rather stay} {M:home}.", "차라리 집에 있고 싶어요."],
      ["{S:We} {V:would go} {M:camping} {M:every summer}.", "여름마다 캠핑을 가곤 했어요."]],
     [["I would rather to stay home.", "I would rather stay home.", "would rather + 동사원형."],
      ["I'd like going.", "I'd like to go.", "would like + to."]],
     "'만약 ~라면' 질문은 I would ~ 로 답해요. If I could live anywhere, I'd live in ~.",
     more=["if-2", "obj-like", "t-usedto"], m=r"would rather|I'd rather")

node("m-request", "부탁 · 허락 · 제안", "Can you ~? Could I ~?",
     "조동사 의문문으로 부탁하고, 허락을 구하고, 제안해요.",
     [("부탁", "<em>Can you</em> ~? / <em>Could you</em> ~? (더 공손) / <em>Would you mind</em> -ing?"),
      ("달라고 할 때", "<em>Can I have</em> ~? / <em>Could I get</em> ~?"),
      ("허락", "<em>Can I</em> ~? / <em>Could I</em> ~? / <em>May I</em> ~? / <em>Do you mind if I</em> ~?"),
      ("제안 · 권유", "<em>Shall I</em> ~? (제가 ~할까요) / <em>Shall we</em> ~? / <em>Would you like</em> ~? / <em>I'll</em> ~ (제가 할게요).")],
     [["{V:Could} {S:you} {V:say} {O:that} {M:again}?", "다시 한번 말씀해 주시겠어요?"],
      ["{V:Can} {S:I} {V:have} {O:a glass of water}?", "물 한 잔 주시겠어요?"],
      ["{V:Would} {S:you} {V:like} {O:some coffee}?", "커피 드시겠어요?"]],
     [["Do you like some coffee?", "Would you like some coffee?", "권할 때는 Would you like."],
      ["Would you mind to open the window?", "Would you mind opening the window?", "mind + -ing."]],
     "질문을 못 알아들었을 때: Could you say that again? / Could you rephrase the question?",
     more=["m-can", "m-would", "obj-ger"])

# ───── 동사 › 가정법
node("if-1", "if + 현재, will", "일어날 수 있는 일",
     "실제로 일어날 수 있는 일을 말해요.",
     [("틀", "If + <em>현재</em>, 주어 + <em>will</em> + 동사원형."),
      ("if 쪽에 will ✕", "If it <em>rains</em> ~ (If it will rain ✕)."),
      ("unless = if ~ not", "<em>Unless</em> it rains, I'll walk."),
      ("will 대신", "can, might, should도 써요. If you're tired, you <em>should</em> rest.")],
     [["{M:If it rains}, {S:I} {V:will stay} {M:home}.", "비가 오면 집에 있을 거예요."],
      ["{M:If I pass the test}, {S:I} {V:will celebrate}.", "시험에 붙으면 축하할 거예요."],
      ["{S:I} {V:walk} {O:my dog} {M:unless it rains}.", "비가 오지 않으면 강아지를 산책시켜요."]],
     [["If I will have time, I will go.", "If I have time, I will go.", "if 쪽은 현재예요."]],
     "미래 계획에 조건을 붙이면 문장이 길어져요. If I have time, I'll ~.",
     more=["t-when", "if-2"], m=r"If \+ 현재|가정법 현재|unless")

node("if-2", "if + 과거, would", "지금 사실이 아닌 일",
     "지금 사실이 아니거나 일어날 것 같지 않은 일을 상상해요. 형태는 과거지만 뜻은 현재예요.",
     [("틀", "If + <em>과거</em>, 주어 + <em>would</em> + 동사원형."),
      ("If I were", "be동사는 were를 써요. If I <em>were</em> you, I'd take it. (was도 쓰지만 were가 기본이에요)"),
      ("if 쪽에 would ✕", "If I <em>had</em> time ~ (If I would have time ✕)."),
      ("could · might", "If I had more money, I <em>could</em> travel more."),
      ("if-1 과 비교", "If I <em>have</em> time, I'<em>ll</em> go. (갈 수도 있음) / If I <em>had</em> time, I'<em>d</em> go. (시간이 없음)")],
     [["{M:If I had more time}, {S:I} {V:would travel} {M:more}.", "시간이 더 있으면 여행을 더 다닐 텐데요."],
      ["{M:If I were rich}, {S:I} {V:wouldn't work}.", "부자라면 일하지 않을 텐데요."],
      ["{M:If I were you}, {S:I} {V:would apologise}.", "제가 당신이라면 사과하겠어요."]],
     [["If I would have money, I would buy it.", "If I had money, I would buy it.", "if 쪽은 과거예요."],
      ["If I were a rich, I'd travel.", "If I were rich, I'd travel.", "rich는 형용사라 a가 안 붙어요."],
      ["If I am you, I will go.", "If I were you, I would go.", "사실이 아닌 일은 과거 + would."]],
     "'만약 ~라면 어떻게 하겠어요?' 질문은 If I ~ed, I would ~ 로 답하는 게 정석이에요.",
     more=["if-wish", "if-3", "m-would"], m=r"가정법 과거|If I were|If \+ 과거")

node("if-3", "if + had p.p., would have p.p.", "지나간 일을 다르게 상상",
     "이미 지나간 일을 '그랬다면'이라고 상상해요.",
     [("틀", "If + <em>had p.p.</em>, 주어 + <em>would have p.p.</em>"),
      ("if 쪽에 would have ✕", "If I <em>had known</em> ~ (If I would have known ✕)."),
      ("could have · might have", "If I had left earlier, I <em>could have caught</em> the train."),
      ("섞어 쓰기", "과거의 원인 + 지금의 결과. If I <em>had slept</em> more, I <em>wouldn't be</em> tired now.")],
     [["{M:If I had studied harder}, {S:I} {V:would have passed}.", "더 열심히 공부했다면 붙었을 텐데요."],
      ["{M:If I had known}, {S:I} {V:would have helped} {O:you}.", "알았다면 도와줬을 텐데요."],
      ["{M:If I hadn't moved}, {S:I} {V:wouldn't have met} {O:her}.", "이사하지 않았다면 그녀를 못 만났을 거예요."]],
     [["If I would have known, I would have come.", "If I had known, I would have come.", "if 쪽은 had p.p.예요."],
      ["If I knew it yesterday, I would tell you.", "If I had known it yesterday, I would have told you.", "지나간 일은 had p.p. + would have p.p."]],
     "인생의 전환점을 말할 때 If I hadn't ~, I wouldn't have ~ 를 쓰면 인상적이에요.",
     more=["if-2", "if-wish", "m-past"])

node("if-wish", "I wish", "~라면 좋을 텐데",
     "지금이나 과거가 바라는 것과 다를 때 아쉬움을 말해요.",
     [("지금에 대한 아쉬움", "I wish + <em>과거</em>. I wish I <em>had</em> more time. / I wish I <em>were</em> taller."),
      ("과거에 대한 아쉬움", "I wish + <em>had p.p.</em> I wish I <em>had studied</em> harder."),
      ("I wish I could", "할 수 없어서 아쉬울 때. I wish I <em>could</em> stay longer."),
      ("I wish ~ would", "남이나 상황이 바뀌길 바랄 때. I wish it <em>would</em> stop raining."),
      ("hope 와 구별", "일어날 수 있는 일은 hope예요. I <em>hope</em> you pass. (I wish you pass ✕)")],
     [["{S:I} {V:wish} {O:I had more free time}.", "자유 시간이 더 있으면 좋겠어요."],
      ["{S:I} {V:wish} {O:I could speak Spanish}.", "스페인어를 할 수 있으면 좋겠어요."],
      ["{S:I} {V:wish} {O:I had started earlier}.", "더 일찍 시작했으면 좋았을 텐데요."]],
     [["I wish I have a car.", "I wish I had a car.", "wish 뒤는 과거예요."],
      ["I wish you have a good trip.", "I hope you have a good trip.", "바라는 일은 hope예요."]],
     "바꾸고 싶은 것을 묻는 질문에 I wish I could ~ 로 답하면 딱 맞아요.",
     more=["if-2", "if-3"])

# ───── 주어 · 목적어 › 명사와 관사
node("n-count", "셀 수 있는 명사 · 셀 수 없는 명사", "a book 과 water",
     "명사는 셀 수 있는 것과 셀 수 없는 것으로 나뉘고, 그에 따라 앞에 붙는 말이 달라져요.",
     [("셀 수 있는 명사", "단수와 복수가 있어요. 단수는 혼자 못 와요. a / the / my가 붙어요. I have <em>a</em> car."),
      ("셀 수 없는 명사", "복수형이 없고 a / an을 안 써요. water, rice, money, music, weather."),
      ("헷갈리는 셀 수 없는 명사", "advice, information, news, furniture, luggage, homework, work, traffic, equipment, progress."),
      ("세는 법", "a piece of advice, a bottle of water, some information."),
      ("뜻에 따라 달라지는 것", "a paper (신문) / paper (종이), a room (방) / room (공간), an experience (경험 하나) / experience (경력)."),
      ("many · much", "many / a few + 셀 수 있는 것, much / a little + 셀 수 없는 것, a lot of는 둘 다.")],
     [["{S:I} {V:need} {O:some advice}.", "조언이 좀 필요해요."],
      ["{S:She} {V:gave} {IO:me} {DO:a lot of information}.", "그녀가 정보를 많이 줬어요."],
      ["{S:I} {V:don't have} {O:much time}.", "시간이 별로 없어요."]],
     [["I need an advice.", "I need some advice.", "advice는 셀 수 없어요."],
      ["I have many homeworks.", "I have a lot of homework.", "homework는 셀 수 없어요."],
      ["I bought new furnitures.", "I bought new furniture.", "furniture는 셀 수 없어요."]],
     "셀 수 있는지 헷갈리면 a lot of를 쓰세요. 둘 다에 쓸 수 있어요.",
     more=["n-a-the", "n-plural", "subj-agree"], m=r"셀 수 없|too much|fewer \+")

node("n-a-the", "a / an 과 the", "처음 말하는 것과 서로 아는 것",
     "a / an은 여럿 중 하나, the는 듣는 사람도 아는 바로 그것이에요.",
     [("처음엔 a, 다시 말하면 the", "I saw <em>a</em> dog. <em>The</em> dog was huge."),
      ("어떤 것인지 뻔할 때 the", "the door, the kitchen, the station, the doctor."),
      ("하나뿐인 것", "the sun, the moon, the world, the sky, the internet, the same."),
      ("직업 · 종류는 a / an", "I'm <em>a</em> nurse. / It's <em>an</em> interesting job."),
      ("a 와 an", "철자가 아니라 <em>소리</em>로 정해요. an hour, a university."),
      ("빈도 · 단위", "once <em>a</em> week, three times <em>a</em> day.")],
     [["{S:I} {V:am} {C:an office worker}.", "저는 회사원이에요."],
      ["{S:I} {V:bought} {O:a jacket}. {S:The jacket} {V:was} {C:on sale}.", "재킷을 샀어요. 그 재킷은 세일 중이었어요."],
      ["{S:I} {V:go} {M:to the gym} {M:twice a week}.", "일주일에 두 번 헬스장에 가요."]],
     [["I'm student.", "I'm a student.", "직업·신분에는 a / an."],
      ["It's same.", "It's the same.", "same 앞에는 the."],
      ["I go there one time in a week.", "I go there once a week.", "빈도는 once a week."]],
     "관사는 완벽하지 않아도 뜻은 통해요. 다만 I'm a ~ (직업)와 the same은 꼭 지키세요.",
     more=["n-the-no", "n-count", "subj-noun"], m=r"관사|a가 안 붙|a 없이")

node("n-the-no", "the를 쓰지 않는 때", "일반적으로 말할 때",
     "'~라는 것 전반'을 말할 때는 the를 쓰지 않아요.",
     [("일반적인 것", "I like <em>dogs</em>. / <em>Life</em> is short. / <em>Music</em> helps me relax. (the dogs ✕)"),
      ("특정한 것은 the", "I like <em>the</em> dogs next door. / <em>the</em> music in this café."),
      ("식사 · 운동 · 과목 · 언어", "have breakfast, play tennis, study maths, speak English."),
      ("본래 목적으로 갈 때", "go to school / work / bed / church, be in hospital, at home."),
      ("the를 쓰는 곳", "go to <em>the</em> cinema / <em>the</em> theatre / <em>the</em> bank / <em>the</em> gym."),
      ("번호가 붙으면 the ✕", "room 5, page 20, platform 3.")],
     [["{S:I} {V:love} {O:Korean food}.", "저는 한국 음식을 정말 좋아해요."],
      ["{S:I} {V:usually have} {O:breakfast} {M:at seven}.", "보통 7시에 아침을 먹어요."],
      ["{S:I} {V:go} {M:to bed} {M:late}.", "저는 늦게 자요."]],
     [["I like the music.", "I like music.", "음악 전반을 말할 땐 the ✕."],
      ["I had the lunch.", "I had lunch.", "식사 이름에는 the ✕."],
      ["The life is hard.", "Life is hard.", "일반적인 것에는 the ✕."]],
     "취미와 좋아하는 것을 말할 때는 대부분 the가 없어요. I like movies / music / sports.",
     more=["n-a-the", "n-names"])

node("n-names", "이름과 the", "나라 · 장소 이름",
     "이름에는 보통 the를 안 쓰지만, 붙는 것들이 정해져 있어요.",
     [("the 없음", "사람, 대륙, 대부분의 나라·도시, 산 하나, 호수 하나, 거리·공원·공항·대학. Korea, Seoul, Mount Halla, Hyde Park."),
      ("the 있음: 복수 · 연합", "the United States, the UK, the Philippines, the Netherlands."),
      ("the 있음: 바다 · 강 · 산맥", "the Pacific, the Han River, the Alps."),
      ("the 있음: 호텔 · 극장 · 박물관", "the Hilton, the National Museum."),
      ("of가 들어가면 the", "the University of Seoul, the Bank of Korea.")],
     [["{S:I} {V:lived} {M:in the UK} {M:for two months}.", "영국에서 두 달 살았어요."],
      ["{S:I} {V:want} {O:to visit New Zealand}.", "뉴질랜드에 가 보고 싶어요."],
      ["{S:The Han River} {V:runs} {M:through Seoul}.", "한강은 서울을 가로질러 흘러요."]],
     [["I went to the Japan.", "I went to Japan.", "나라 이름에는 보통 the ✕."],
      ["I lived in United States.", "I lived in the United States.", "States가 복수라 the가 붙어요."]],
     "자주 말하는 나라만 외워 두세요. the US, the UK, the Philippines에는 the가 붙어요.",
     more=["n-the-no", "n-a-the"])

node("n-plural", "단수 · 복수 주의할 것", "people, news, 20 minutes",
     "모양과 실제 수가 다른 명사들이 있어요.",
     [("항상 복수", "두 부분으로 된 것. trousers, jeans, glasses, scissors. → a pair of jeans."),
      ("-s로 끝나도 단수", "news, maths, economics, politics. The news <em>is</em> good."),
      ("person 의 복수는 people", "three <em>people</em> (three persons ✕). People <em>are</em> ~."),
      ("금액 · 시간 · 거리는 단수", "Twenty minutes <em>is</em> enough. / Ten dollars <em>is</em> too much."),
      ("불규칙 복수", "child – children, man – men, woman – women, foot – feet, tooth – teeth."),
      ("숫자 + 단위 + 명사", "꾸밀 때는 단수예요. a <em>ten-minute</em> walk, a <em>two-hour</em> movie.")],
     [["{S:The news} {V:was} {C:surprising}.", "그 소식은 놀라웠어요."],
      ["{S:Many people} {V:live} {M:in apartments}.", "많은 사람들이 아파트에 살아요."],
      ["{S:It} {V:is} {C:a twenty-minute walk}.", "걸어서 20분 거리예요."]],
     [["The news are bad.", "The news is bad.", "news는 단수예요."],
      ["There were many peoples.", "There were many people.", "people이 이미 복수예요."],
      ["a five-years-old child", "a five-year-old child", "꾸밀 때는 단수예요."]],
     "It's a ten-minute walk / a two-hour drive 는 거리 설명에 아주 자주 쓰여요.",
     more=["n-count", "subj-agree"], m=r"복수!|복수는|단수 line|하이픈")

node("n-poss", "'s 와 of · 명사 + 명사", "~의",
     "'~의'는 사람이면 's, 사물이면 of나 명사 두 개를 붙여 써요.",
     [("사람 · 동물은 's", "my sister<em>'s</em> room, the dog<em>'s</em> name."),
      ("복수는 s'", "my parents<em>'</em> house."),
      ("사물은 of", "the name <em>of</em> the book, the end <em>of</em> the month."),
      ("시간에도 's", "today<em>'s</em> news, a week<em>'s</em> holiday."),
      ("명사 + 명사", "앞 명사가 형용사처럼 꾸며요. 앞 명사는 단수예요. a bus driver, a shoe shop, the city centre."),
      ("a friend of mine", "my friend 중 한 명. <em>a friend of mine</em> (a friend of me ✕).")],
     [["{S:My friend's dad} {V:is} {C:a doctor}.", "제 친구 아버지는 의사예요."],
      ["{S:I} {V:forgot} {O:the title of the movie}.", "그 영화 제목을 잊어버렸어요."],
      ["{S:A friend of mine} {V:lives} {M:in Tokyo}.", "제 친구 하나가 도쿄에 살아요."]],
     [["the room of my sister", "my sister's room", "사람은 's."],
      ["a shoes shop", "a shoe shop", "앞 명사는 단수예요."],
      ["a friend of me", "a friend of mine", "of 뒤에는 mine."]],
     "사람 소개에 a friend of mine / one of my friends 를 쓰면 자연스러워요.",
     more=["subj-noun", "obj-noun"])

# ───── 보어 › 비교
node("cmp-er", "비교급", "-er / more ~ than",
     "둘을 비교할 때 써요.",
     [("짧은 말은 -er", "한 음절. cheap<em>er</em>, big<em>ger</em>, fast<em>er</em>. -y로 끝나면 -ier. eas<em>ier</em>, happ<em>ier</em>."),
      ("긴 말은 more", "두 음절 이상. <em>more</em> expensive, <em>more</em> comfortable. -ly 부사도 more. <em>more</em> slowly."),
      ("불규칙", "good / well – <em>better</em>, bad – <em>worse</em>, far – <em>further</em>."),
      ("than", "비교 대상 앞에 than. It's cheaper <em>than</em> I expected."),
      ("less", "덜 ~한. It's <em>less</em> crowded on weekdays.")],
     [["{S:Seoul} {V:is} {C:bigger than Busan}.", "서울은 부산보다 커요."],
      ["{S:This one} {V:is} {C:more expensive}.", "이게 더 비싸요."],
      ["{S:I} {V:feel} {C:better} {M:today}.", "오늘은 컨디션이 더 좋아요."]],
     [["more cheaper", "cheaper", "-er와 more를 같이 쓰지 않아요."],
      ["more good", "better", "good의 비교급은 better."],
      ["It's bigger then mine.", "It's bigger than mine.", "than이에요."]],
     "'A와 B 중 뭐가 좋아요?' 질문에는 I prefer A because it's -er than B 로 답해요.",
     more=["cmp-much", "cmp-as", "cmp-est"], m=r"비교급|more ~ than|better than")

node("cmp-much", "비교급 강조와 점점 더", "much better · the more, the better",
     "비교급 앞뒤에 말을 붙여 차이의 크기와 변화를 말해요.",
     [("much · a lot · far", "훨씬. <em>much</em> better, <em>a lot</em> cheaper. (very better ✕)"),
      ("a bit · a little · slightly", "조금. <em>a bit</em> more expensive."),
      ("점점 더", "비교급 and 비교급. It's getting <em>hotter and hotter</em>. / <em>more and more</em> popular."),
      ("~할수록 더 …하다", "the + 비교급, the + 비교급. <em>The more</em> I practise, <em>the better</em> I get."),
      ("any · no", "It isn't <em>any</em> better. / It's <em>no</em> longer than a mile.")],
     [["{S:This phone} {V:is} {C:much better}.", "이 휴대폰이 훨씬 좋아요."],
      ["{S:It} {V:is getting} {C:more and more difficult}.", "점점 더 어려워지고 있어요."],
      ["{S:The weather} {V:is} {C:a bit colder} {M:today}.", "오늘은 날씨가 조금 더 추워요."]],
     [["very better", "much better", "비교급 강조는 much / a lot."],
      ["more and more hot", "hotter and hotter", "짧은 말은 -er and -er."]],
     "The more ~, the more ~ 는 의견을 말할 때 한 번만 써도 문법 범위가 넓어 보여요.",
     more=["cmp-er", "cmp-as"], m=r"the \+ 비교급")

node("cmp-as", "as ~ as · the same as", "~만큼",
     "두 가지가 같거나 못 미친다고 말할 때 써요.",
     [("not as ~ as", "~만큼 …하지 않다. It's <em>not as</em> cold <em>as</em> yesterday."),
      ("as ~ as", "~만큼 …한. I got here <em>as</em> fast <em>as</em> I could."),
      ("as much / many as", "I don't earn <em>as much as</em> him."),
      ("the same as", "<em>the same as</em> (the same like ✕). My bag is the same as yours."),
      ("배수", "twice <em>as</em> big <em>as</em>, three times <em>as</em> expensive <em>as</em>."),
      ("than me / than I am", "말할 때는 than <em>me</em>가 보통이에요.")],
     [["{S:My room} {V:isn't} {C:as big as yours}.", "제 방은 당신 방만큼 크지 않아요."],
      ["{S:This} {V:is} {C:twice as expensive}.", "이건 두 배나 비싸요."],
      ["{S:My job} {V:is} {C:the same as before}.", "제 일은 전과 똑같아요."]],
     [["the same like mine", "the same as mine", "the same as."],
      ["as better as", "as good as", "as와 as 사이에는 원급이에요."]],
     "한국과 다른 나라를 비교할 때 not as ~ as 를 쓰면 부드럽게 비교할 수 있어요.",
     more=["cmp-er", "cmp-est"])

node("cmp-est", "최상급", "the -est / the most ~",
     "셋 이상 중에서 가장 ~한 것을 말해요.",
     [("the -est / the most", "the cheap<em>est</em>, the <em>most</em> expensive. the를 꼭 붙여요."),
      ("불규칙", "good – <em>the best</em>, bad – <em>the worst</em>."),
      ("in + 장소 · 집단", "the tallest building <em>in</em> Korea. (of Korea ✕) 기간은 of. the best day <em>of</em> my life."),
      ("현재완료와 함께", "the best movie I'<em>ve ever seen</em>."),
      ("one of the + 최상급 + 복수", "one of the most popular place<em>s</em>.")],
     [["{S:It} {V:was} {C:the best trip of my life}.", "제 인생 최고의 여행이었어요."],
      ["{S:This} {V:is} {C:the most delicious food I've ever had}.", "지금까지 먹어 본 것 중 가장 맛있어요."],
      ["{S:Jeju} {V:is} {C:one of the most popular places}.", "제주는 가장 인기 있는 곳 중 하나예요."]],
     [["It's most beautiful city.", "It's the most beautiful city.", "최상급에는 the."],
      ["one of the best place", "one of the best places", "one of 뒤는 복수예요."],
      ["the tallest building of the world", "the tallest building in the world", "장소는 in."]],
     "좋아하는 것을 말할 때 the best ~ I've ever ~ 한 문장이면 최상급과 현재완료를 함께 보여 줄 수 있어요.",
     more=["cmp-er", "t-perf"], m=r"최상급|I've ever")

# ───── 수식어 › 관계절
node("rel-who", "who · which · that", "명사를 문장으로 꾸미기",
     "명사 뒤에 문장을 붙여서 '어떤' 사람·물건인지 알려 줘요.",
     [("사람은 who", "the woman <em>who</em> lives next door. (that도 돼요)"),
      ("사물은 which / that", "the bus <em>that</em> goes to the airport."),
      ("대명사를 또 쓰지 않아요", "the man who <em>he</em> lives here ✕ → the man who lives here."),
      ("동사는 꾸밈받는 명사에 맞춰요", "people who <em>live</em> / a person who <em>lives</em>.")],
     [["{S:I} {V:have} {O:a friend who lives in Canada}.", "캐나다에 사는 친구가 있어요."],
      ["{S:I} {V:like} {O:movies that make me laugh}.", "저는 웃게 해 주는 영화를 좋아해요."],
      ["{S:The people who work here} {V:are} {C:friendly}.", "여기서 일하는 사람들은 친절해요."]],
     [["I have a friend who he lives in Canada.", "I have a friend who lives in Canada.", "who가 주어라 he를 또 안 써요."],
      ["the people which I met", "the people who I met", "사람은 who / that."]],
     "사람·장소를 묘사할 때 a person who ~, a place that ~ 로 시작하면 설명이 쉬워져요.",
     more=["rel-omit", "rel-where", "mod-adj"], m=r"관계대명사|a story that|those who")

node("rel-omit", "who · that을 생략할 수 있는 때", "the book I bought",
     "관계절 안에 주어가 따로 있으면 who / that을 빼도 돼요.",
     [("목적어일 때 생략", "the book (that) <em>I bought</em>, the man (who) <em>I met</em>."),
      ("주어일 때는 생략 못 해요", "the man <em>who lives</em> here. (the man lives here ✕)"),
      ("전치사는 뒤에", "the hotel (that) we stayed <em>at</em>, the person I was talking <em>to</em>."),
      ("everything / all + that", "everything (that) he said. (everything what ✕)")],
     [["{S:The movie I saw yesterday} {V:was} {C:great}.", "어제 본 영화는 정말 좋았어요."],
      ["{S:This} {V:is} {C:the bag I bought in Japan}.", "이게 일본에서 산 가방이에요."],
      ["{S:The people I work with} {V:are} {C:nice}.", "같이 일하는 사람들이 좋아요."]],
     [["The movie I saw it was great.", "The movie I saw was great.", "it을 또 쓰지 않아요."],
      ["everything what I need", "everything I need", "everything 뒤는 that (생략 가능)."]],
     "말할 때는 대부분 생략해요. the place I visited, the food I ate 처럼 짧게 붙이면 자연스러워요.",
     more=["rel-who", "rel-what"], m=r"관계대명사 생략")

node("rel-where", "whose · where · when", "장소 · 때 · 소유를 꾸미기",
     "who / which 말고도 명사를 꾸미는 말이 있어요.",
     [("whose = ~의", "a friend <em>whose</em> father is a chef."),
      ("where = 장소", "the café <em>where</em> I study. = the café I study <em>at</em>."),
      ("the day · the time · the reason", "the day (<em>that</em>) we met, the reason (<em>why</em>) I left. 생략할 수 있어요."),
      ("whom", "목적어일 때 격식체. 말할 때는 who나 생략을 써요.")],
     [["{S:This} {V:is} {C:the town where I grew up}.", "여기가 제가 자란 동네예요."],
      ["{S:I} {V:remember} {O:the day we first met}.", "우리가 처음 만난 날을 기억해요."],
      ["{S:I} {V:have} {O:a friend whose mom is a teacher}.", "어머니가 선생님인 친구가 있어요."]],
     [["the place where I visited", "the place I visited", "visit은 목적어를 받아서 where가 아니라 that(생략)이에요."],
      ["the town where I was born in", "the town where I was born", "where에 in이 들어 있어요."]],
     "장소 묘사의 시작 문장으로 It's a place where ~ 를 외워 두세요.",
     more=["rel-who", "rel-omit"])

node("rel-what", "what 과 that", "~하는 것",
     "what은 'the thing(s) that'이에요. 앞에 꾸밀 명사가 없을 때 써요.",
     [("what = ~하는 것", "<em>What</em> I need is sleep. / I didn't hear <em>what</em> he said."),
      ("명사가 있으면 that", "the thing <em>that</em> I need. (the thing what I need ✕)"),
      ("everything · all 뒤는 that", "all (that) I want. (all what ✕)")],
     [["{S:What I like most} {V:is} {C:the food}.", "제가 가장 좋아하는 건 음식이에요."],
      ["{S:I} {V:don't understand} {O:what you mean}.", "무슨 뜻인지 모르겠어요."],
      ["{S:That} {V:is} {C:what I wanted}.", "그게 제가 원하던 거예요."]],
     [["the thing what I want", "the thing that I want", "명사 뒤는 that."],
      ["That I need is time.", "What I need is time.", "앞에 명사가 없으면 what."]],
     "What I like about ~ is … 는 이유를 강조하는 가장 쉬운 틀이에요.",
     more=["subj-clause", "obj-clause", "rel-omit"], m=r"what I do|What happened")

node("rel-extra", "쉼표가 있는 관계절", "덧붙이는 정보",
     "누구인지 이미 분명한 명사에 정보를 덧붙일 때는 쉼표를 써요.",
     [("덧붙이는 정보", "My brother, <em>who</em> lives in Busan, is a nurse."),
      ("that ✕ · 생략 ✕", "쉼표 뒤에는 who / which만 써요."),
      ("앞 문장 전체를 받는 which", "He was late again, <em>which</em> annoyed me. (what ✕)"),
      ("most of whom · which", "I have three sisters, <em>two of whom</em> are married.")],
     [["{S:My mom, who is a teacher,} {V:loves} {O:reading}.", "선생님이신 우리 엄마는 책 읽기를 좋아하세요."],
      ["{S:I} {V:passed} {O:the test}, {M:which surprised everyone}.", "제가 시험에 붙어서 모두가 놀랐어요."],
      ["{S:Jeju, which is an island,} {V:is} {C:famous for its beaches}.", "섬인 제주는 해변으로 유명해요."]],
     [["I failed the test, what made me sad.", "I failed the test, which made me sad.", "앞 문장 전체는 which로 받아요."],
      ["My mom, that is a teacher, ...", "My mom, who is a teacher, ...", "쉼표 뒤에는 that ✕."]],
     "~, which is why … / ~, which means … 로 이유와 결과를 이으면 말이 길고 논리적으로 들려요.",
     more=["rel-who", "rel-what"])

node("rel-ing", "-ing · -ed로 꾸미기", "who is / which was를 줄인 모양",
     "관계절을 줄여서 -ing나 -ed(p.p.)만으로 명사를 뒤에서 꾸밀 수 있어요.",
     [("-ing = ~하고 있는 · ~하는", "the woman <em>talking</em> to Tom (= who is talking)."),
      ("-ed = ~된 · ~당한", "the phone <em>made</em> in Korea (= which was made)."),
      ("There is + 명사 + -ing", "There were some kids <em>playing</em> outside."),
      ("-ing와 -ed 고르기", "명사가 직접 하면 -ing, 당하면 -ed. the man <em>driving</em> the car / the car <em>driven</em> by him.")],
     [["{S:The man sitting next to me} {V:was} {C:very kind}.", "제 옆에 앉은 남자는 아주 친절했어요."],
      ["{S:I} {V:like} {O:food made by my mom}.", "저는 엄마가 만든 음식을 좋아해요."],
      ["There {V:were} {S:many people waiting in line}.", "줄 서서 기다리는 사람이 많았어요."]],
     [["the people live in cities", "the people living in cities", "명사를 꾸미려면 -ing."],
      ["a book writing by him", "a book written by him", "'쓰인'은 p.p."]],
     "people living in cities, food made with ~ 처럼 짧게 꾸미면 문장이 간결해져요.",
     more=["rel-who", "comp-subj", "mod-adj"])

# ───── 성분에 새 가지 달기
N["verb-modal"]["n"] = "조동사의 기본 규칙"
N["subj"]["groups"].insert(1, ["명사와 관사", ["n-count", "n-a-the", "n-the-no", "n-names", "n-plural", "n-poss"]])
N["obj"]["groups"] = [["목적어가 될 수 있는 것", ["obj-noun", "obj-ger", "obj-to", "obj-clause"]],
                      ["to와 -ing 고르기", ["obj-both", "obj-like"]],
                      ["목적어와 함께 알아둘 것", ["obj-two"]]]
N["verb"]["groups"] = [["동사의 종류", ["verb-be", "verb-intr", "verb-tr", "verb-link"]],
                       ["시제", ["t-pres", "t-state", "t-past", "t-perf", "t-perf-cont", "t-for", "t-perf-past", "t-pastperf", "t-usedto", "t-future", "t-when"]],
                       ["조동사", ["verb-modal", "m-can", "m-must", "m-should", "m-may", "m-deduce", "m-past", "m-would", "m-request"]],
                       ["가정법", ["if-1", "if-2", "if-3", "if-wish"]],
                       ["구동사", ["verb-phrasal"]],
                       ["동사가 정하는 문장 모양 (1~5형식)", ["f1", "f2", "f3", "f4", "f5"]]]
N["comp"]["groups"] = [["보어의 종류", ["comp-subj", "comp-obj"]], ["비교", ["cmp-er", "cmp-much", "cmp-as", "cmp-est"]], ["보어 자리에서 자주 하는 실수", ["comp-adj"]]]
N["mod"]["groups"] = [["수식어의 종류", ["mod-adj", "mod-adv", "mod-prep"]], ["관계절 (문장으로 명사 꾸미기)", ["rel-who", "rel-omit", "rel-where", "rel-what", "rel-extra", "rel-ing"]], ["수식어를 놓는 자리", ["mod-order"]]]
for c in ("subj", "verb", "obj", "comp", "mod"):
    for g in N[c]["groups"]:
        for k in g[1]:
            if k not in N[c]["kids"] and not any(k in N[x].get("kids", []) for x in N): N[c]["kids"].append(k)

# ───────────── 지도에서 쓰는 짧은 이름 + 설명 한 줄마다 붙는 제목 (누르면 그 줄이 펼쳐져요)
SHORT = {"subj-noun": "명사", "subj-pron": "대명사", "subj-ger": "동명사", "subj-to": "to부정사 · 가주어 it", "subj-clause": "명사절",
         "obj-noun": "명사 · 대명사", "obj-ger": "동명사", "obj-to": "to부정사", "obj-clause": "명사절", "obj-both": "to와 -ing로 뜻이 바뀌는 동사",
         "comp-adj": "형용사와 부사 헷갈리기", "obj-like": "like -ing · like to · would like", "mod-adj": "형용사", "mod-adv": "부사", "mod-prep": "전치사구", "mod-order": "순서"}
PT = {
 "subj-noun": ["핵심 명사 찾기", "동사는 핵심 명사에 맞춰요", "단수 명사에는 a / the"],
 "subj-pron": ["주격과 목적격", "뜻 없는 it", "일반적인 사람: you · people"],
 "subj-ger": ["항상 단수 취급", "to부정사보다 자연스러워요", "부정은 not -ing"],
 "subj-to": ["가주어 it으로 바꾸기", "It is + 형용사 + to", "for + 사람"],
 "subj-clause": ["What + 주어 + 동사", "Whether · That", "절 주어도 단수"],
 "subj-there": ["be동사는 뒤 명사에 맞춰요", "have ✕", "과거 · 현재완료"],
 "subj-agree": ["be동사", "일반동사 -s", "단수로 보는 것", "복수로 보는 것"],
 "verb-be": ["be동사의 부정 · 의문", "일반동사의 부정 · 의문", "be + 동사원형 ✕"],
 "verb-intr": ["대표 자동사", "명사를 붙일 땐 전치사", "수동태 ✕"],
 "verb-tr": ["대표 타동사", "전치사를 넣기 쉬운 동사", "목적어 빼먹지 않기"],
 "verb-link": ["상태", "변화", "감각 + 형용사", "명사 앞에는 like"],
 "verb-modal": ["뒤는 동사원형", "-s가 안 붙어요", "두 개 겹치기 ✕", "부정 · 의문"],
 "verb-phrasal": ["명사 목적어의 자리", "대명사는 가운데", "못 떼는 구동사"],
 "obj-noun": ["목적격", "전치사 뒤에도 목적격", "-self"],
 "obj-ger": ["-ing만 받는 동사", "전치사 뒤 -ing", "어떤 느낌?"],
 "obj-to": ["to만 받는 동사", "어떤 느낌?", "부정은 not to", "의문사 + to"],
 "obj-both": ["remember · forget", "stop", "try", "뜻이 같은 동사"],
 "obj-clause": ["that절", "if · whether절", "의문사절 (간접의문문)", "what절"],
 "obj-two": ["사람 + 물건", "물건 + to / for + 사람", "to를 쓰는 동사 · for를 쓰는 동사", "물건이 it이면", "explain · say는 안 돼요"],
 "comp-subj": ["명사 보어", "형용사 보어", "to부정사 · 동명사 · 절", "-ed 와 -ing"],
 "comp-obj": ["형용사 · 명사", "to부정사", "동사원형 (make · let · have)", "지각동사 (see · hear)", "find it + 형용사 + to"],
 "comp-adj": ["형용사가 하는 일", "부사가 하는 일", "구별하는 법", "모양이 헷갈리는 말"],
 "mod-adj": ["명사 앞", "-thing은 뒤에서", "길면 뒤로", "여러 개일 때 순서"],
 "mod-adv": ["방식 (well, carefully)", "빈도 · also의 자리", "정도 (very, really)", "문장 전체", "enough는 뒤"],
 "mod-prep": ["전치사 뒤에 오는 것", "시간 at · on · in", "장소 at · on · in", "전치사를 안 쓰는 때", "명사도 꾸며요"],
 "mod-order": ["장소 → 방법 → 시간", "작은 단위 먼저", "동사와 목적어는 붙여요", "맨 앞으로 빼기"],
 "f1": ["수식어가 따라와요", "대표 동사", "There is도 1형식"],
 "f2": ["쓰는 동사", "보어는 명사 · 형용사"],
 "f3": ["타동사 + 목적어", "사이를 끊지 않아요"],
 "f4": ["사람 → 물건", "3형식으로 바꾸기", "대표 동사"],
 "f5": ["4형식과 구별", "목적격 보어가 되는 것", "대표 동사"],
}
for i, ts in PT.items():
    if N[i].get("pt"): continue  # 2단계에서 새로 쓴 가지는 제목이 이미 있어요
    assert len(ts) == len(N[i]["body"]), (i, len(ts), len(N[i]["body"]))
    N[i]["pt"] = ts
for i, v in SHORT.items(): N[i].setdefault("n", v)
leafs = {x for n in N.values() for g in n.get("groups", []) for x in g[1]}
assert all(N[x].get("pt") for x in leafs), [x for x in leafs if not N[x].get("pt")]

# ───────────── 한 장 지도에 쓰는 아주 짧은 이름
K = {"subj-noun": "명사", "subj-pron": "대명사", "subj-ger": "동명사", "subj-to": "to부정사", "subj-clause": "명사절",
     "n-count": "셀 수 있는 · 없는", "n-a-the": "a · the", "n-the-no": "the 없이", "n-names": "이름과 the", "n-plural": "단수 · 복수", "n-poss": "'s · of",
     "subj-there": "There is", "subj-agree": "수 일치",
     "verb-be": "be · 일반동사", "verb-intr": "자동사", "verb-tr": "타동사", "verb-link": "연결동사",
     "t-pres": "현재", "t-state": "상태동사", "t-past": "과거", "t-perf": "현재완료", "t-perf-cont": "완료진행", "t-for": "for · since",
     "t-perf-past": "완료와 과거", "t-pastperf": "과거완료", "t-usedto": "used to", "t-future": "미래", "t-when": "when · if",
     "verb-modal": "기본 규칙", "m-can": "can", "m-must": "must · have to", "m-should": "should", "m-may": "may · might", "m-deduce": "must be",
     "m-past": "have p.p.", "m-would": "would", "m-request": "부탁 · 허락",
     "if-1": "if 현재", "if-2": "if 과거", "if-3": "if had p.p.", "if-wish": "wish", "verb-phrasal": "구동사",
     "f1": "1형식", "f2": "2형식", "f3": "3형식", "f4": "4형식", "f5": "5형식",
     "obj-noun": "명사 · 대명사", "obj-ger": "동명사", "obj-to": "to부정사", "obj-clause": "명사절", "obj-both": "뜻이 바뀌는 동사", "obj-like": "like · would like", "obj-two": "목적어 두 개",
     "comp-subj": "주격 보어", "comp-obj": "목적격 보어", "cmp-er": "비교급", "cmp-much": "비교급 강조", "cmp-as": "as ~ as", "cmp-est": "최상급", "comp-adj": "형용사와 부사",
     "mod-adj": "형용사", "mod-adv": "부사", "mod-prep": "전치사구", "rel-who": "who · that", "rel-omit": "생략", "rel-where": "where · whose", "rel-what": "what", "rel-extra": "쉼표 관계절", "rel-ing": "-ing · -ed", "mod-order": "순서"}
GS = {"subj": ["올 수 있는 것", "명사와 관사", "함께 알기"], "verb": ["종류", "시제", "조동사", "가정법", "구동사", "문장 모양"],
      "obj": ["올 수 있는 것", "to와 -ing", "함께 알기"], "comp": ["종류", "비교", "자주 하는 실수"], "mod": ["종류", "관계절", "놓는 자리"]}
for c, labs in GS.items():
    assert len(labs) == len(N[c]["groups"]), c
    for g, lab in zip(N[c]["groups"], labs): g.append(lab)
assert leafs == set(K), leafs ^ set(K)
for i, v in K.items(): N[i]["k"] = v

# ═════════════ 가지를 눌렀을 때 둘레에 뜨는 "모양"과 그 예문. (이름, 한 줄, [(예문, 뜻), …])
FORMS = {
 "subj-noun": [
  ("명사 하나", "가장 기본이에요.", [("{S:The weather} {V:is} {C:nice}.", "날씨가 좋아요."), ("{S:Time} {V:flies}.", "시간이 빨리 가요.")]),
  ("꾸미는 말 + 명사", "my, this, 형용사까지가 한 덩어리 주어예요.", [("{S:My best friend} {V:lives} {M:in Canada}.", "제 가장 친한 친구는 캐나다에 살아요."), ("{S:This small café} {V:is} {M:always} {C:busy}.", "이 작은 카페는 항상 붐벼요.")]),
  ("명사 + 뒤에서 꾸미는 말", "동사는 핵심 명사(people, café)에 맞춰요.", [("{S:The people in my office} {V:are} {C:friendly}.", "우리 사무실 사람들은 친절해요."), ("{S:The café near my house} {V:opens} {M:early}.", "우리 집 근처 카페는 일찍 열어요.")]),
  ("A and B", "and로 묶으면 복수예요.", [("{S:My sister and I} {V:share} {O:a room}.", "언니와 저는 방을 같이 써요."), ("{S:Coffee and cake} {V:go} {M:well together}.", "커피와 케이크는 잘 어울려요.")]),
 ],
 "subj-pron": [
  ("I · you · we · they", "동사는 그대로예요.", [("{S:I} {V:work} {M:at a hospital}.", "저는 병원에서 일해요."), ("{S:They} {V:live} {M:next door}.", "그들은 옆집에 살아요.")]),
  ("he · she · it", "동사에 -s가 붙어요.", [("{S:She} {V:teaches} {O:English}.", "그녀는 영어를 가르쳐요."), ("{S:It} {V:looks} {C:expensive}.", "비싸 보여요.")]),
  ("뜻 없는 it", "날씨·시간·거리는 it으로 시작해요.", [("{S:It} {V:is raining}.", "비가 오고 있어요."), ("{S:It} {V:is} {C:seven o'clock}.", "7시예요.")]),
  ("this · that", "가까운 것은 this, 방금 들은 말은 that.", [("{S:This} {V:is} {C:my favourite place}.", "여기가 제가 제일 좋아하는 곳이에요."), ("{S:That} {V:sounds} {C:great}.", "그거 좋네요.")]),
  ("everyone · someone", "뜻은 여럿이어도 단수예요.", [("{S:Everyone} {V:likes} {O:her}.", "모두가 그녀를 좋아해요."), ("{S:Someone} {V:called} {O:you}.", "누가 전화했어요.")]),
 ],
 "subj-ger": [
  ("-ing 하나", "동사에 -ing를 붙이면 '~하는 것'이 돼요.", [("{S:Swimming} {V:is} {C:good exercise}.", "수영은 좋은 운동이에요."), ("{S:Cooking} {V:relaxes} {O:me}.", "요리를 하면 마음이 편해져요.")]),
  ("-ing + 목적어", "books가 복수여도 동사는 단수예요 (is, takes).", [("{S:Reading books} {V:is} {C:fun}.", "책 읽기는 재미있어요."), ("{S:Learning English} {V:takes} {O:time}.", "영어를 배우는 데는 시간이 걸려요.")]),
  ("-ing + 수식어", "어디서·어떻게까지 한 덩어리예요.", [("{S:Living alone} {V:has} {O:pros and cons}.", "혼자 사는 건 장단점이 있어요."), ("{S:Walking in the park} {V:clears} {O:my head}.", "공원을 걸으면 머리가 맑아져요.")]),
  ("not -ing", "부정은 not을 앞에 붙여요.", [("{S:Not sleeping enough} {V:is} {C:bad for you}.", "잠을 충분히 안 자는 건 몸에 나빠요."), ("{S:Not having a car} {V:is} {C:inconvenient}.", "차가 없는 건 불편해요.")]),
  ("being + 형용사 · 명사", "'~인 것'은 being으로 시작해요.", [("{S:Being late} {V:is} {C:rude}.", "늦는 건 예의가 아니에요."), ("{S:Being a parent} {V:is} {C:hard work}.", "부모가 되는 건 힘든 일이에요.")]),
 ],
 "subj-to": [
  ("It is + 형용사 + to", "It은 가짜 주어, 진짜 주어는 to ~ 예요.", [("{FS:It} {V:is} {C:important} {RS:to sleep well}.", "잘 자는 게 중요해요."), ("{FS:It} {V:is} {C:easy} {RS:to make mistakes}.", "실수하기 쉬워요.")]),
  ("for 사람 + to", "누가 하는지는 for + 사람으로 넣어요.", [("{FS:It} {V:is} {C:hard} {M:for me} {RS:to wake up early}.", "저는 일찍 일어나는 게 힘들어요."), ("{FS:It} {V:is} {C:normal} {M:for kids} {RS:to make noise}.", "아이들이 떠드는 건 당연해요.")]),
  ("It takes + 시간 + to", "'~하는 데 시간이 걸리다'.", [("{FS:It} {V:takes} {O:an hour} {RS:to get there}.", "거기 가는 데 한 시간 걸려요."), ("{FS:It} {V:took} {O:two years} {RS:to learn it}.", "그걸 배우는 데 2년 걸렸어요.")]),
  ("To ~가 맨 앞", "문법은 맞지만 딱딱해요. 말할 땐 It ~ to나 -ing를 써요.", [("{S:To travel alone} {V:is} {C:exciting}.", "혼자 여행하는 건 신나는 일이에요."), ("{S:To learn a language} {V:takes} {O:time}.", "언어를 배우는 데는 시간이 걸려요.")]),
 ],
 "subj-clause": [
  ("What + 주어 + 동사", "'~하는 것'. 동사는 단수예요.", [("{S:What I need} {V:is} {C:a long holiday}.", "제게 필요한 건 긴 휴가예요."), ("{S:What she said} {V:made} {O:me} {OC:angry}.", "그녀가 한 말이 저를 화나게 했어요.")]),
  ("It ~ that", "That ~ 주어는 보통 It으로 바꿔 말해요.", [("{FS:It} {V:is} {C:true} {RS:that he quit his job}.", "그가 일을 그만둔 건 사실이에요."), ("{FS:It} {V:is} {C:surprising} {RS:that she won}.", "그녀가 이긴 건 놀라워요.")]),
  ("Whether ~", "'~인지 아닌지'.", [("{S:Whether we go} {V:depends} {M:on the weather}.", "우리가 갈지는 날씨에 달렸어요."), ("{S:Whether he comes} {V:doesn't matter}.", "그가 오든 말든 상관없어요.")]),
  ("How · Why ~", "의문사 뒤는 평서문 순서(주어 + 동사)예요.", [("{S:How you say it} {V:matters}.", "어떻게 말하느냐가 중요해요."), ("{S:Why he left} {V:is} {C:a mystery}.", "그가 왜 떠났는지는 수수께끼예요.")]),
 ],
 "n-count": [
  ("셀 수 있는 명사", "하나면 a / an, 여럿이면 -s.", [("{S:I} {V:have} {O:a car}.", "저는 차가 한 대 있어요."), ("{S:I} {V:bought} {O:two books}.", "책을 두 권 샀어요.")]),
  ("셀 수 없는 명사", "a도 -s도 안 붙어요. advice, information, money, homework.", [("{S:I} {V:need} {O:some advice}.", "조언이 좀 필요해요."), ("{S:Money} {V:isn't} {C:everything}.", "돈이 전부는 아니에요.")]),
  ("a piece of · a cup of", "셀 수 없는 건 그릇이나 조각으로 세요.", [("{S:She} {V:gave} {IO:me} {DO:a piece of advice}.", "그녀가 조언을 하나 해 줬어요."), ("{S:I} {V:drink} {O:three cups of coffee} {M:a day}.", "하루에 커피를 세 잔 마셔요.")]),
  ("many 와 much", "many + 셀 수 있는 것, much + 셀 수 없는 것. a lot of는 둘 다 돼요.", [("{S:I} {V:don't have} {O:many friends} {M:here}.", "여기는 친구가 많지 않아요."), ("{S:I} {V:don't have} {O:much time}.", "시간이 별로 없어요.")]),
  ("a few 와 a little", "a few + 셀 수 있는 것, a little + 셀 수 없는 것.", [("{S:I} {V:have} {O:a few questions}.", "질문이 몇 개 있어요."), ("{S:I} {V:speak} {O:a little Japanese}.", "일본어를 조금 해요.")]),
 ],
 "n-a-the": [
  ("처음엔 a, 다시 말하면 the", "처음 꺼낼 땐 a, 그다음부터는 the.", [("{S:I} {V:saw} {O:a dog}. {S:The dog} {V:was} {C:huge}.", "개를 봤어요. 그 개는 엄청 컸어요."), ("{S:I} {V:bought} {O:a jacket}. {S:The jacket} {V:was} {C:on sale}.", "재킷을 샀어요. 그 재킷은 세일 중이었어요.")]),
  ("서로 아는 것 the", "어떤 것인지 뻔하면 the.", [("{V:Can} {S:you} {V:close} {O:the door}?", "문 좀 닫아 줄래요?"), ("{S:I} {V:am going} {M:to the station}.", "역에 가는 중이에요.")]),
  ("하나뿐인 것 the", "the sun, the world, the same.", [("{S:The sun} {V:is} {C:hot} {M:today}.", "오늘은 햇볕이 뜨거워요."), ("{S:It} {V:is} {C:the same}.", "똑같아요.")]),
  ("직업 · 종류는 a / an", "모음 소리 앞에서는 an.", [("{S:I} {V:am} {C:a nurse}.", "저는 간호사예요."), ("{S:It} {V:is} {C:an interesting job}.", "재미있는 직업이에요.")]),
  ("once a week", "'~에 한 번'은 a를 써요.", [("{S:I} {V:go} {M:to the gym} {M:twice a week}.", "일주일에 두 번 헬스장에 가요."), ("{S:I} {V:visit} {O:them} {M:once a month}.", "한 달에 한 번 그분들을 찾아봬요.")]),
 ],
 "n-the-no": [
  ("일반적인 것", "'~라는 것 전반'에는 the를 안 써요.", [("{S:I} {V:like} {O:dogs}.", "저는 개를 좋아해요."), ("{S:Music} {V:helps} {O:me} {OC:relax}.", "음악은 긴장을 풀어 줘요.")]),
  ("식사 · 운동 · 언어", "have lunch, play tennis, speak English.", [("{S:I} {V:had} {O:lunch} {M:at noon}.", "정오에 점심을 먹었어요."), ("{S:I} {V:play} {O:tennis} {M:on Sundays}.", "일요일마다 테니스를 쳐요.")]),
  ("school · work · bed", "본래 목적으로 갈 때는 the가 없어요.", [("{S:I} {V:go} {M:to bed} {M:late}.", "저는 늦게 자요."), ("{S:She} {V:is} {M:at work} {M:now}.", "그녀는 지금 일하는 중이에요.")]),
  ("특정한 것은 the", "어느 것인지 정해지면 the가 붙어요.", [("{S:I} {V:like} {O:the dogs next door}.", "저는 옆집 개들을 좋아해요."), ("{S:The music in this café} {V:is} {C:nice}.", "이 카페 음악이 좋네요.")]),
 ],
 "n-names": [
  ("나라 · 도시", "대부분 the가 없어요.", [("{S:I} {V:live} {M:in Korea}.", "저는 한국에 살아요."), ("{S:Seoul} {V:is} {C:crowded}.", "서울은 붐벼요.")]),
  ("the + 복수 · 연합 나라", "the UK, the US, the Philippines.", [("{S:I} {V:lived} {M:in the UK}.", "저는 영국에 살았어요."), ("{S:She} {V:is} {M:from the United States}.", "그녀는 미국 출신이에요.")]),
  ("the + 바다 · 강 · 산맥", "the Pacific, the Han River, the Alps.", [("{S:The Han River} {V:runs} {M:through Seoul}.", "한강은 서울을 가로질러 흘러요."), ("{S:We} {V:flew} {M:over the Pacific}.", "우리는 태평양 위를 날았어요.")]),
  ("of가 들어간 이름", "of가 있으면 the가 붙어요.", [("{S:I} {V:studied} {M:at the University of Seoul}.", "저는 서울시립대에서 공부했어요."), ("{S:The Bank of Korea} {V:is} {M:near here}.", "한국은행이 이 근처에 있어요.")]),
 ],
 "n-plural": [
  ("people", "person의 복수예요. 동사도 복수.", [("{S:Many people} {V:live} {M:in apartments}.", "많은 사람들이 아파트에 살아요."), ("{S:People} {V:are} {C:friendly} {M:here}.", "여기 사람들은 친절해요.")]),
  ("news · maths", "-s로 끝나도 단수예요.", [("{S:The news} {V:was} {C:surprising}.", "그 소식은 놀라웠어요."), ("{S:Maths} {V:is} {C:hard} {M:for me}.", "저한테 수학은 어려워요.")]),
  ("jeans · glasses", "두 부분으로 된 물건은 항상 복수예요.", [("{S:My glasses} {V:are} {C:broken}.", "제 안경이 부러졌어요."), ("{S:These jeans} {V:are} {C:too tight}.", "이 청바지는 너무 껴요.")]),
  ("시간 · 돈", "한 덩어리로 봐서 단수예요.", [("{S:Twenty minutes} {V:is} {C:enough}.", "20분이면 충분해요."), ("{S:Ten dollars} {V:is} {C:too much}.", "10달러는 너무 비싸요.")]),
  ("a ten-minute walk", "명사를 꾸밀 때는 -s를 안 붙여요.", [("{S:It} {V:is} {C:a ten-minute walk}.", "걸어서 10분 거리예요."), ("{S:I} {V:have} {O:a five-year-old son}.", "저는 다섯 살 아들이 있어요.")]),
 ],
 "n-poss": [
  ("사람 's", "사람·동물의 것은 's.", [("{S:My friend's dad} {V:is} {C:a doctor}.", "제 친구 아버지는 의사예요."), ("{S:This} {V:is} {C:my sister's room}.", "여기는 제 언니 방이에요.")]),
  ("사물 of", "사물의 것은 of.", [("{S:I} {V:forgot} {O:the title of the movie}.", "그 영화 제목을 잊어버렸어요."), ("{S:I} {V:will see} {O:you} {M:at the end of the month}.", "월말에 봬요.")]),
  ("명사 + 명사", "앞 명사가 형용사처럼 꾸며요. 앞 명사는 단수.", [("{S:The bus driver} {V:was} {C:kind}.", "버스 기사님이 친절했어요."), ("{S:I} {V:work} {M:at a shoe shop}.", "저는 신발 가게에서 일해요.")]),
  ("a friend of mine", "'내 친구 중 한 명'.", [("{S:A friend of mine} {V:lives} {M:in Tokyo}.", "제 친구 하나가 도쿄에 살아요."), ("{S:She} {V:is} {C:a colleague of mine}.", "그녀는 제 직장 동료예요.")]),
 ],
 "subj-there": [
  ("There is + 단수", "진짜 주어는 be동사 뒤에 있어요.", [("There {V:is} {S:a café} {M:near my house}.", "우리 집 근처에 카페가 있어요."), ("There {V:is} {S:a problem}.", "문제가 있어요.")]),
  ("There are + 복수", "뒤 명사가 복수면 are.", [("There {V:are} {S:a lot of mountains} {M:in Korea}.", "한국에는 산이 많아요."), ("There {V:are} {S:three people} {M:in my family}.", "우리 가족은 세 명이에요.")]),
  ("There was · were", "과거에 있었던 것.", [("There {V:was} {S:a lot of traffic}.", "차가 많이 막혔어요."), ("There {V:were} {S:no seats}.", "자리가 없었어요.")]),
  ("There used to be · will be", "예전에 있었던 것과 앞으로 있을 것.", [("There {V:used to be} {S:a cinema} {M:here}.", "예전에는 여기 영화관이 있었어요."), ("There {V:will be} {S:a test} {M:tomorrow}.", "내일 시험이 있을 거예요.")]),
  ("there 다음엔 it", "처음엔 there로 꺼내고, 그다음엔 it으로 받아요.", [("There {V:is} {S:a new café} {M:near my office}. {S:It} {V:is} {C:really good}.", "사무실 근처에 새 카페가 있어요. 거기 정말 좋아요.")]),
 ],
 "subj-agree": [
  ("he · she · it + -s", "주어가 하나면 동사에 -s.", [("{S:My brother} {V:works} {M:at a bank}.", "제 형은 은행에서 일해요."), ("{S:She} {V:has} {O:two cats}.", "그녀는 고양이 두 마리를 키워요.")]),
  ("부정 · 의문은 does", "does가 -s를 가져가서 동사는 원형이에요.", [("{S:She} {V:doesn't like} {O:coffee}.", "그녀는 커피를 안 좋아해요."), ("{V:Does} {S:he} {V:live} {M:here}?", "그는 여기 살아요?")]),
  ("단수로 보는 것", "everyone, 동명사, 셀 수 없는 명사.", [("{S:Everyone} {V:has} {O:a phone}.", "누구나 휴대폰이 있어요."), ("{S:Watching movies} {V:is} {C:my hobby}.", "영화 보기가 제 취미예요.")]),
  ("복수로 보는 것", "people, A and B.", [("{S:People} {V:are} {C:busy} {M:these days}.", "요즘 사람들은 바빠요."), ("{S:My mom and dad} {V:live} {M:in Busan}.", "엄마 아빠는 부산에 사세요.")]),
  ("핵심 명사에 맞추기", "가까운 명사가 아니라 핵심 명사(price, books)에 맞춰요.", [("{S:The price of vegetables} {V:is} {C:high}.", "채소 값이 비싸요."), ("{S:The books on the table} {V:are} {C:mine}.", "탁자 위 책들은 제 거예요.")]),
 ],
}
for i, fs in FORMS.items():
    N[i]["f"] = [[a, b, [list(x) for x in c]] for a, b, c in fs]

# ═════════════ 3단계: 품사를 누르면 그 품사의 문법 주제가 나와요 (Grammar in Use 의 주제 나눔과 가르치는 방식을 따름: 규칙 한 줄 → 예문 → 틀린 말 → 나란히 비교)
# 칸 = (제목, 규칙 한 줄, [줄…])   줄: ("e", 예문, 뜻) · ("x", 틀린 말, 이유) · ("l", 낱말 목록) · ("c", 왼쪽 제목, 오른쪽 제목, [(왼쪽, 오른쪽), …])
def topic(id, t, k, s, secs, m=""):
    old = N.get(id, {})
    N[id] = {kk: v for kk, v in dict(t=t, k=k, n=t, s=s, d=s, m=m or old.get("m", ""), more=old.get("more", []),
                                     sec=[[a, b, [list(r) if r[0] != "c" else [r[0], r[1], r[2], [list(x) for x in r[3]]] for r in rows]] for a, b, rows in secs]).items() if v}

topic("n-count", "셀 수 있는 명사 · 셀 수 없는 명사", "셀 수 있는 · 없는", "a banana 와 rice", [
 ("둘의 차이", "셀 수 있는 명사는 하나·여럿으로 나뉘고, 셀 수 없는 명사는 모양이 하나뿐이에요.", [
   ("c", "셀 수 있는 명사", "셀 수 없는 명사", [("I eat <em>an apple</em> every day.", "I eat <em>rice</em> every day."), ("I like <em>apples</em>.", "I like <em>rice</em>."), ("one apple, two apples", "<s>one rice, two rices</s>")])]),
 ("a / an", "a / an은 셀 수 있는 단수 명사에만 붙어요.", [
   ("e", "I need <em>a</em> pen.", "펜이 하나 필요해요."), ("e", "She has <em>an</em> umbrella.", "그녀는 우산이 있어요."), ("x", "a music · a rice · a money", "셀 수 없는 명사에는 a를 안 붙여요.")]),
 ("혼자 못 쓰는 명사", "셀 수 있는 단수 명사는 혼자 못 써요. a / the / my가 꼭 붙어요. 셀 수 없는 명사와 복수는 혼자 쓸 수 있어요.", [
   ("e", "Do you want <em>a</em> banana?", "바나나 먹을래요?"), ("x", "Do you want banana?", ""), ("e", "I'm looking for <em>a</em> job.", "일자리를 찾고 있어요."), ("x", "I'm looking for job.", ""),
   ("e", "I like <em>music</em>. / I like <em>dogs</em>.", "저는 음악을 좋아해요. / 저는 개를 좋아해요.")]),
 ("a ~ of 로 세기", "셀 수 없는 명사는 그릇이나 조각으로 세요.", [
   ("l", "a cup of coffee · a glass of water · a piece of cake · a slice of bread · a bottle of wine · a bowl of rice"), ("e", "I'd like <em>a glass of</em> water.", "물 한 잔 주세요.")]),
 ("some · any", "복수와 셀 수 없는 명사 앞에 써요. 긍정문은 some, 부정문·의문문은 any.", [
   ("e", "I bought <em>some</em> apples.", "사과를 몇 개 샀어요."), ("e", "I need <em>some</em> money.", "돈이 좀 필요해요."), ("e", "I don't have <em>any</em> money.", "돈이 하나도 없어요.")]),
 ("many · much", "many / a few + 셀 수 있는 복수, much / a little + 셀 수 없는 명사. a lot of는 둘 다 돼요.", [
   ("c", "셀 수 있는 명사", "셀 수 없는 명사", [("<em>many</em> friends", "<em>much</em> time"), ("<em>a few</em> days", "<em>a little</em> money"), ("a lot of books", "a lot of homework")]),
   ("e", "I don't have <em>much</em> time.", "시간이 별로 없어요.")]),
])

topic("n-count2", "헷갈리는 셀 수 없는 명사", "헷갈리는 명사", "advice, news, paper", [
 ("뜻에 따라 달라지는 명사", "같은 낱말인데 셀 수 있을 때와 없을 때 뜻이 달라요.", [
   ("c", "셀 수 있을 때", "셀 수 없을 때", [("<em>a paper</em> 신문", "<em>paper</em> 종이"), ("<em>a room</em> 방", "<em>room</em> 공간"), ("<em>a hair</em> 머리카락 한 올", "<em>hair</em> 머리 전체"), ("<em>an experience</em> 겪은 일 하나", "<em>experience</em> 경력"), ("<em>a noise</em> 어떤 소리", "<em>noise</em> 소음"), ("<em>a</em> good <em>time</em> 즐거운 한때", "<em>time</em> 시간")]),
   ("e", "I had <em>a</em> great <em>time</em>. / I don't have <em>time</em>.", "정말 즐거웠어요. / 시간이 없어요.")]),
 ("음료", "커피·차·주스는 셀 수 없어요. 다만 주문할 때는 '한 잔'이라는 뜻으로 a coffee, two coffees라고 해요.", [
   ("e", "I don't drink <em>coffee</em>.", "저는 커피를 안 마셔요."), ("e", "<em>Two coffees</em>, please.", "커피 두 잔 주세요.")]),
 ("셀 수 없는 명사 목록", "한국어로는 셀 수 있을 것 같지만 영어에서는 못 세요. a도 -s도 안 붙어요.", [
   ("l", "advice · information · news · furniture · luggage · baggage · homework · work · traffic · weather · bread · luck · progress · permission · behaviour · accommodation · scenery · equipment"),
   ("e", "I need <em>some advice</em>.", "조언이 좀 필요해요."), ("e", "We had <em>good weather</em>.", "날씨가 좋았어요."), ("x", "an advice · informations · a good weather · furnitures", "")]),
 ("짝으로 외우기", "뜻은 비슷한데 하나는 셀 수 있고 하나는 못 세요.", [
   ("c", "셀 수 있음", "셀 수 없음", [("a job", "work"), ("a trip · a journey", "travel"), ("a view", "scenery"), ("a suggestion", "advice"), ("a bag · a suitcase", "luggage"), ("a loaf", "bread"), ("a chair · a table", "furniture")]),
   ("e", "I'm looking for <em>a job</em>. = I'm looking for <em>work</em>.", "일자리를 찾고 있어요.")]),
 ("news", "-s로 끝나지만 셀 수 없고 단수예요.", [
   ("e", "The news <em>was</em> shocking.", "그 소식은 충격적이었어요."), ("e", "I have <em>some good news</em>.", "좋은 소식이 있어요."), ("x", "The news were ~ · a news", "")]),
])

topic("n-a-some", "a / an 과 some", "a · some", "하나와 몇몇", [
 ("무엇인지 말할 때", "'어떤 종류의 것'인지 말할 때 단수는 a / an, 복수는 아무것도 안 붙여요.", [
   ("c", "단수", "복수", [("That's <em>a</em> nice table.", "Those are nice chairs."), ("<em>A</em> dog is <em>an</em> animal.", "Dogs are animals."), ("He's <em>a</em> kind person.", "They're kind people.")])]),
 ("직업", "직업을 말할 때는 a / an을 꼭 붙여요.", [
   ("e", "I'm <em>a</em> nurse.", "저는 간호사예요."), ("e", "My dad is <em>an</em> engineer.", "아빠는 엔지니어예요."), ("x", "I'm nurse.", "")]),
 ("a 와 an", "철자가 아니라 소리로 정해요. 모음 소리 앞이면 an.", [
   ("l", "<em>an</em> apple · <em>an</em> hour · <em>an</em> honest person · <em>a</em> university · <em>a</em> European country · <em>a</em> one-way ticket")]),
 ("some = 몇 개", "some + 복수. 정확한 수는 말하지 않아요.", [
   ("e", "I bought <em>some</em> books.", "책을 몇 권 샀어요."), ("e", "I've seen <em>some</em> good movies recently.", "최근에 좋은 영화를 몇 편 봤어요.")]),
 ("some = 일부", "전부는 아니고 일부라는 뜻이에요.", [
   ("e", "<em>Some</em> people like spicy food, and <em>some</em> don't.", "매운 음식을 좋아하는 사람도 있고 아닌 사람도 있어요."), ("e", "<em>Some</em> days are better than others.", "어떤 날은 다른 날보다 나아요.")]),
 ("some을 안 쓰는 때", "'~라는 것 전반'을 말할 때는 some 없이 복수만 써요.", [
   ("c", "몇 개", "전반", [("I ate <em>some</em> bananas.", "I love bananas."), ("I met <em>some</em> students.", "She teaches students.")])]),
])

topic("n-a-the", "a / an 과 the", "a · the", "여럿 중 하나와 바로 그것", [
 ("처음엔 a, 다시 말하면 the", "처음 꺼낼 때는 a / an, 그다음부터는 the예요.", [
   ("e", "I had <em>a</em> sandwich and <em>an</em> apple. <em>The</em> sandwich wasn't very good.", "샌드위치와 사과를 먹었어요. 샌드위치는 별로였어요."),
   ("e", "<em>A</em> man and <em>a</em> woman sat next to me. <em>The</em> man was asleep.", "남자와 여자가 제 옆에 앉았어요. 남자는 자고 있었어요.")]),
 ("여럿 중 하나 · 바로 그것", "a는 여럿 중 아무거나 하나, the는 듣는 사람도 아는 바로 그것이에요.", [
   ("c", "a / an", "the", [("I sat on <em>a</em> chair.", "I sat on <em>the</em> chair by the door."), ("Do you have <em>a</em> car?", "I cleaned <em>the</em> car yesterday."), ("I'm looking for <em>a</em> job.", "Did you get <em>the</em> job you applied for?")])]),
 ("서로 아는 것", "어떤 것인지 뻔할 때는 처음부터 the를 써요.", [
   ("e", "Can you turn off <em>the</em> light?", "불 좀 꺼 줄래요?"), ("e", "I took a taxi to <em>the</em> station.", "택시를 타고 역에 갔어요."), ("e", "I need to go to <em>the</em> bank.", "은행에 가야 해요."),
   ("l", "the door · the kitchen · the floor · the airport · the doctor · the dentist · the toilet")]),
 ("once a week", "'~마다'는 a / an을 써요.", [
   ("e", "I go to the gym twice <em>a</em> week.", "일주일에 두 번 헬스장에 가요."), ("e", "It costs ten dollars <em>a</em> day.", "하루에 10달러예요."), ("e", "I see him once <em>a</em> month.", "한 달에 한 번 그를 만나요.")]),
])

topic("n-the", "the를 쓰는 때", "the 쓰기", "하나뿐인 것, the same, the best", [
 ("하나뿐인 것", "세상에 하나밖에 없으면 the예요.", [
   ("e", "<em>The</em> sun is so hot today.", "오늘 햇볕이 정말 뜨거워요."), ("e", "What's <em>the</em> capital of Korea?", "한국의 수도는 어디예요?"), ("l", "the world · the sky · the sea · the ground · the moon · the internet · the environment")]),
 ("the same", "same 앞에는 항상 the예요.", [
   ("e", "We live in <em>the same</em> building.", "우리는 같은 건물에 살아요."), ("e", "Your bag is <em>the same</em> as mine.", "당신 가방은 제 것과 똑같아요."), ("x", "We live in same building.", "")]),
 ("the best · the first", "최상급과 순서 앞에는 the예요.", [
   ("e", "It was <em>the best</em> day of my life.", "제 인생 최고의 날이었어요."), ("e", "This is <em>the first</em> time I've been here.", "여기는 처음 와 봐요."), ("l", "the best · the worst · the first · the last · the only · the next"),
   ("x", "See you the next week.", "'다음 주, 지난주'는 the 없이 next week, last week.")]),
 ("the cinema · the radio", "영화관·극장·라디오에는 the를 붙여요. TV(방송)에는 안 붙여요.", [
   ("e", "I go to <em>the cinema</em> a lot.", "저는 영화관에 자주 가요."), ("e", "I heard it on <em>the radio</em>.", "라디오에서 들었어요."), ("e", "I watched it on <em>TV</em>.", "TV에서 봤어요.")]),
 ("the + 형용사", "the + 형용사 = '~한 사람들'. 복수로 봐요.", [
   ("e", "<em>The rich</em> should pay more tax.", "부자들은 세금을 더 내야 해요."), ("e", "We need to help <em>the elderly</em>.", "어르신들을 도와야 해요."), ("l", "the young · the old · the rich · the poor · the homeless · the unemployed")]),
 ("종류 전체 · 악기", "동물·기계의 종류 전체와 악기 앞에 the를 써요.", [
   ("e", "<em>The giraffe</em> is the tallest animal.", "기린은 가장 키가 큰 동물이에요."), ("e", "Who invented <em>the telephone</em>?", "전화기는 누가 발명했어요?"), ("e", "I play <em>the piano</em>.", "저는 피아노를 쳐요.")]),
])

topic("n-the-no", "the를 쓰지 않는 때", "the 안 쓰기", "일반적인 것, 식사, school", [
 ("일반적인 것", "'~라는 것 전반'을 말할 때는 the를 안 써요. 어느 것인지 정해지면 the를 써요.", [
   ("c", "전반 (the 없음)", "특정한 것 (the)", [("I like <em>dogs</em>.", "I like <em>the dogs</em> next door."), ("<em>Life</em> is short.", "<em>The life</em> of a nurse is hard."), ("I love <em>music</em>.", "I love <em>the music</em> in this film."), ("<em>Children</em> learn fast.", "<em>The children</em> are asleep.")]),
   ("x", "The life is short.", "")]),
 ("식사", "아침·점심·저녁에는 the를 안 써요.", [
   ("e", "What did you have for <em>breakfast</em>?", "아침으로 뭐 먹었어요?"), ("e", "We had <em>lunch</em> together.", "같이 점심을 먹었어요."), ("e", "We had <em>a</em> nice lunch.", "형용사가 붙으면 a를 써요.")]),
 ("school · hospital · church", "본래 목적으로 갈 때는 the가 없어요. 건물로 볼 때는 the를 써요.", [
   ("c", "본래 목적", "건물", [("My son is at <em>school</em>.", "I went to <em>the school</em> to meet his teacher."), ("She's in <em>hospital</em>.", "I visited her at <em>the hospital</em>."), ("We go to <em>church</em> on Sundays.", "<em>The church</em> is next to the bank.")])]),
 ("bed · work · home", "go to bed, at work, go home은 덩어리로 외워요.", [
   ("e", "I go to <em>bed</em> at eleven.", "저는 11시에 자요."), ("e", "I'm at <em>work</em>.", "저는 일하는 중이에요."), ("e", "I got <em>home</em> late.", "집에 늦게 왔어요."), ("x", "go to the bed · go to home", "")]),
 ("운동 · 과목 · 언어", "운동, 과목, 언어 이름에는 the를 안 써요.", [
   ("e", "I play <em>tennis</em>.", "저는 테니스를 쳐요."), ("e", "I studied <em>chemistry</em>.", "저는 화학을 공부했어요."), ("e", "She speaks <em>Korean</em>.", "그녀는 한국어를 해요."), ("x", "play the tennis", "")]),
 ("번호가 붙을 때", "명사 뒤에 번호가 오면 the를 안 써요.", [
   ("e", "Our train leaves from <em>platform 5</em>.", "우리 기차는 5번 승강장에서 떠나요."), ("e", "I'm in <em>room 302</em>.", "저는 302호에 있어요."), ("x", "the platform 5", "")]),
])

topic("n-names", "이름과 the", "이름과 the", "Korea, the UK, the Han River", [
 ("the가 없는 이름", "사람, 대륙, 대부분의 나라와 도시, 산 하나, 호수 하나, 섬 하나.", [
   ("l", "Tom · Asia · Korea · Japan · Seoul · Mount Halla · Lake Tahoe · Jeju"), ("e", "I've never been to <em>Europe</em>.", "유럽에는 가 본 적이 없어요.")]),
 ("복수 · 연합 나라", "이름이 복수이거나 States, Kingdom, Republic이 들어가면 the가 붙어요.", [
   ("l", "the United States · the UK · the Philippines · the Netherlands · the Czech Republic"), ("e", "I lived in <em>the UK</em> for two months.", "영국에서 두 달 살았어요."), ("x", "in United States", "")]),
 ("바다 · 강 · 사막 · 산맥", "the를 붙여요. 섬 무리와 산맥처럼 여럿이 모인 것도요.", [
   ("l", "the Pacific · the Han River · the Sahara · the Alps · the Maldives"), ("e", "We flew over <em>the Pacific</em>.", "우리는 태평양 위를 날았어요.")]),
 ("거리 · 역 · 공원 · 공항 · 대학", "보통 the가 없어요.", [
   ("l", "Gangnam Station · Hyde Park · Incheon Airport · Fifth Avenue · Seoul National University"), ("e", "I'll meet you at <em>Seoul Station</em>.", "서울역에서 만나요.")]),
 ("호텔 · 박물관 · 극장", "the가 붙어요.", [
   ("l", "the Hilton · the National Museum · the Louvre · the Empire State Building · the White House")]),
 ("of가 들어간 이름", "of가 있으면 the가 붙어요.", [
   ("l", "the University of Seoul · the Bank of Korea · the Great Wall of China · the Tower of London")]),
 ("the north of ~", "the north of는 the가 있고, northern은 없어요.", [
   ("c", "the + 방향 + of", "방향 형용사", [("<em>the</em> north of Korea", "northern Korea"), ("<em>the</em> south of France", "southern France")])]),
])

topic("n-plural", "단수 · 복수", "단수 · 복수", "jeans, news, people", [
 ("항상 복수인 물건", "두 부분으로 된 물건은 항상 복수예요. 셀 때는 a pair of.", [
   ("l", "trousers · jeans · shorts · pyjamas · glasses · scissors · tights"), ("e", "My jeans <em>are</em> too tight.", "제 청바지가 너무 껴요."), ("e", "I need <em>a</em> new <em>pair of</em> glasses.", "새 안경이 필요해요."), ("x", "a jeans", "")]),
 ("-s로 끝나지만 단수", "과목 이름과 news는 단수예요.", [
   ("l", "news · maths · physics · economics · politics · gymnastics"), ("e", "Maths <em>is</em> my favourite subject.", "수학은 제가 제일 좋아하는 과목이에요.")]),
 ("사람 여럿을 뜻하는 명사", "family, team, staff, company, government는 단수로 쓰고, 영국식으로는 복수 동사도 써요. police는 항상 복수예요.", [
   ("e", "My family <em>is</em> big.", "우리 가족은 대가족이에요."), ("e", "The police <em>are</em> looking for him.", "경찰이 그를 찾고 있어요."), ("x", "The police is ~", "")]),
 ("person 과 people", "person의 복수는 people이에요.", [
   ("e", "She's a nice <em>person</em>.", "그녀는 좋은 사람이에요."), ("e", "Three <em>people</em> came.", "세 명이 왔어요."), ("x", "three persons · many peoples", "")]),
 ("돈 · 시간 · 거리", "한 덩어리로 봐서 단수 동사를 써요.", [
   ("e", "Ten thousand won <em>is</em> enough.", "만 원이면 충분해요."), ("e", "Three years <em>is</em> a long time.", "3년은 긴 시간이에요."), ("e", "Two kilometres <em>isn't</em> far.", "2킬로미터는 멀지 않아요.")]),
 ("불규칙 복수", "-s를 붙이지 않는 복수예요.", [
   ("l", "man → men · woman → women · child → children · foot → feet · tooth → teeth · mouse → mice · fish → fish · sheep → sheep")]),
])

topic("n-nn", "명사 + 명사", "명사 + 명사", "a bus driver", [
 ("앞 명사가 꾸며요", "명사 두 개를 붙이면 앞 명사가 형용사처럼 '어떤' 것인지 알려 줘요.", [
   ("l", "a bus driver · a shoe shop · the city centre · a road accident · income tax · a tennis ball"), ("e", "I work at <em>a coffee shop</em>.", "저는 커피숍에서 일해요.")]),
 ("앞 명사는 단수", "뜻은 복수여도 앞 명사에는 -s를 안 붙여요. 숫자가 붙어도 마찬가지예요.", [
   ("c", "맞는 말", "틀린 말", [("a <em>shoe</em> shop", "<s>a shoes shop</s>"), ("a <em>three-hour</em> journey", "<s>a three-hours journey</s>"), ("a <em>ten-dollar</em> note", "<s>a ten-dollars note</s>"), ("a <em>five-year-old</em> girl", "<s>a five-years-old girl</s>")]),
   ("e", "It's a <em>twenty-minute</em> walk.", "걸어서 20분 거리예요.")]),
 ("a coffee cup 과 a cup of coffee", "순서가 바뀌면 뜻이 달라져요.", [
   ("c", "그릇", "내용물", [("a coffee cup 커피잔", "a cup of coffee 커피 한 잔"), ("a wine glass 와인잔", "a glass of wine 와인 한 잔"), ("a shopping bag 장바구니", "a bag of shopping 장 본 것 한 봉지")])]),
 ("셋 이상", "명사를 세 개 넘게 이어 붙이기도 해요.", [
   ("e", "I waited at <em>the hotel reception desk</em>.", "호텔 프런트에서 기다렸어요."), ("e", "We watched <em>the World Cup final</em>.", "월드컵 결승을 봤어요.")]),
 ("붙여 쓰는 말", "자주 쓰는 것은 한 낱말로 굳었어요.", [
   ("l", "a headache · toothpaste · a weekend · a bedroom · a bus stop · a car park")]),
])

topic("n-poss", "'s 와 of", "'s · of", "~의", [
 ("사람 · 동물은 's", "사람이나 동물의 것은 's로 말해요.", [
   ("e", "This is <em>Tom's</em> phone.", "이건 톰의 휴대폰이에요."), ("e", "What's your <em>dog's</em> name?", "강아지 이름이 뭐예요?"), ("e", "I stayed at my <em>sister's</em>.", "언니 집에서 지냈어요."), ("x", "the phone of Tom", "")]),
 ("복수는 s'", "-s로 끝나는 복수는 ' 만 붙여요. 불규칙 복수는 's.", [
   ("c", "한 명", "여러 명", [("my <em>sister's</em> room", "my <em>sisters'</em> room"), ("my <em>friend's</em> house", "my <em>friends'</em> house"), ("the <em>child's</em> toy", "the <em>children's</em> room")])]),
 ("사물은 of", "사물이나 생각의 것은 of로 말해요.", [
   ("e", "What's <em>the name of</em> the book?", "그 책 제목이 뭐예요?"), ("e", "I'll call you at <em>the end of</em> the month.", "월말에 전화할게요."), ("l", "the top of the page · the back of the car · the beginning of the film")]),
 ("회사 · 단체는 둘 다", "사람들이 모인 단체는 's도 of도 돼요.", [
   ("e", "<em>the government's</em> decision = the decision <em>of the government</em>", "정부의 결정")]),
 ("시간 's", "시간을 나타내는 말에도 's를 붙여요.", [
   ("l", "today's news · yesterday's meeting · next week's test · a week's holiday · ten minutes' walk"), ("e", "Did you see <em>today's</em> news?", "오늘 뉴스 봤어요?")]),
 ("a friend of mine", "'내 친구 중 한 명'은 a friend of mine이에요.", [
   ("e", "<em>A friend of mine</em> lives in Tokyo.", "제 친구 하나가 도쿄에 살아요."), ("e", "He's a colleague <em>of my dad's</em>.", "그분은 아빠의 직장 동료예요."), ("x", "a friend of me", "")]),
])

N["pos-noun"] = {"t": "명사", "k": "명사", "n": "명사", "s": "사람·사물·생각의 이름", "d": "사람·사물·생각의 이름",
                 "hub": ["n-count", "n-count2", "n-a-some", "n-a-the", "n-the", "n-the-no", "n-names", "n-plural", "n-nn", "n-poss"], "kids": []}
N["pos-noun"]["kids"] = list(N["pos-noun"]["hub"])
sg = N["subj"]["groups"]
sg[0][1][sg[0][1].index("subj-noun")] = "pos-noun"
N["subj"]["groups"] = [g for g in sg if g[0] != "명사와 관사"]
N["subj"]["kids"] = [k for k in N["subj"]["kids"] if k not in N["pos-noun"]["hub"]] + ["pos-noun"]
for n in N.values():
    n["more"] = [("pos-noun" if x == "subj-noun" else x) for x in n.get("more", [])]
    if not n["more"]: n.pop("more")
for i in ("n-count", "n-a-the", "n-the-no", "n-names", "n-plural", "n-poss"): assert "sec" in N[i] and "body" not in N[i]

# ───────────── 세 번째 원: 눌렀을 때 그 자리에서 바깥으로 가지가 펼쳐지는 묶음 (가지가 적고 순서가 있는 것만)
for g in N["verb"]["groups"]:
    if g[2] in ("가정법", "문장 모양"): g.append(1)
assert sum(len(g) == 4 for g in N["verb"]["groups"]) == 2

# ───────────── 검사 + 저장
ids = set(N)
for i, n in N.items():
    for k in n.get("kids", []) + n.get("more", []) + n.get("hub", []) + [x for g in n.get("groups", []) for x in g[1]]:
        assert k in ids, (i, k)
    for e, _ in n.get("ex", []) + [x for f in n.get("f", []) for x in f[2]]:
        for r, t, _x in re.findall(r"\{([A-Z]+)(?:>([a-z0-9-]+))?:([^}]+)\}", e):
            assert r in "S FS RS V O IO DO C OC M".split(), (i, r)
            assert not t or t in ids, (i, t)
        assert "{" not in re.sub(r"\{[A-Z]+(?:>[a-z0-9-]+)?:[^}]+\}", "", e), (i, e)
    if n.get("m"): re.compile(n["m"], re.I | re.M)
kid = {k for n in N.values() for k in n.get("kids", [])}
assert ids - kid == {"bones"}, ids - kid
out = {"root": "bones", "nodes": N}
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in ["data/grammar.json", "beta/data/grammar.json"]:
    open(os.path.join(root, p), "w").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(len(N), "pages")
