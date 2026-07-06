const phrases=[
['今日は何を勉強しますか。','きょうは なにを べんきょうしますか。','What will you study today?','今日は (topic) + 何を (object) + 勉強しますか (action/question).',
  [['今日は','topic'],['何を','object'],['勉強しますか','action']]],
['毎晩ギターを練習します。','まいばん ギターを れんしゅうします。','I practice guitar every evening.','毎晩 (time) + ギターを (object) + 練習します (action).',
  [['毎晩','time'],['ギターを','object'],['練習します','action']]],
['この言葉はどういう意味ですか。','この ことばは どういう いみですか。','What does this word mean?','この言葉は (topic) + どういう意味ですか (what meaning?).',
  [['この言葉は','topic'],['どういう意味ですか','question']]],
['もう一度ゆっくり話してください。','もういちど ゆっくり はなしてください。','Please speak slowly one more time.','もう一度 (again) + ゆっくり (slowly) + 話してください (please speak).',
  [['もう一度','again'],['ゆっくり','slowly'],['話してください','request']]],
['好きな曲を聴いています。','すきな きょくを きいています。','I am listening to a favorite song.','好きな曲を (object) + 聴いています (ongoing action).',
  [['好きな曲を','object'],['聴いています','ongoing action']]],
['ペットが窓の外を見ています。','ペットが まどの そとを みています。','A pet is looking outside the window.','ペットが (subject) + 窓の外を (object/direction) + 見ています (ongoing action).',
  [['ペットが','subject'],['窓の外を','object/direction'],['見ています','ongoing action']]]
];
if(Array.isArray(window.KomorebiStarterPhrases))phrases.push(...window.KomorebiStarterPhrases);
let phraseIndex=0;
const phrase=document.querySelector('#jpPhrase'),reading=document.querySelector('#jpReading'),meaning=document.querySelector('#jpMeaning'),note=document.querySelector('#jpNote'),reveal=document.querySelector('#jpReveal');

function shuffle(array){const copy=[...array];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}

const patternHeadline=document.querySelector('#patternHeadline'),patternBlocks=document.querySelector('#patternBlocks'),patternSentence=document.querySelector('#patternSentence');
function renderSentenceStructure(){
  const blocks=phrases[phraseIndex][4]||[],p=phrases[phraseIndex];
  patternHeadline.textContent=blocks.map(b=>b[1]).join(' → ');
  patternBlocks.innerHTML=blocks.map(b=>'<span>'+b[0]+'<br><small>'+b[1]+'</small></span>').join('');
  patternSentence.innerHTML='<b>'+p[0]+'</b><br>'+p[2];
}

function renderPhrase(){const p=phrases[phraseIndex];phrase.textContent=p[0];reading.textContent=p[1];meaning.textContent=p[2];note.textContent=p[3];document.querySelector('#jpCard').dataset.level=p[5]||'CORE';meaning.hidden=true;note.hidden=true;reveal.textContent='Show meaning';renderSentenceStructure()}
reveal.addEventListener('click',()=>{const hidden=meaning.hidden;meaning.hidden=!hidden;note.hidden=!hidden;reveal.textContent=hidden?'Hide meaning':'Show meaning'});
document.querySelector('#jpNext').addEventListener('click',()=>{phraseIndex=(phraseIndex+1)%phrases.length;renderPhrase()});

function collectVocabPool(){
  const seen=new Set(),pool=[];
  phrases.forEach((p,phraseIndexInPool)=>{
    (p[4]||[]).forEach(block=>{
      const text=block[0],label=block[1];
      if(!text||seen.has(text))return;
      seen.add(text);
      pool.push({text,label,phraseIndex:phraseIndexInPool});
    });
  });
  return pool;
}

const vocabListRoot=document.querySelector('#vocabList');
function renderVocabList(){
  if(!vocabListRoot)return;
  const pool=collectVocabPool();
  vocabListRoot.innerHTML=pool.map(item=>'<div><dt>'+item.text+'</dt><dd>'+item.label+'</dd></div>').join('');
}

function buildVocabRound(){
  const pool=collectVocabPool(),target=pool[Math.floor(Math.random()*pool.length)],sourcePhrase=phrases[target.phraseIndex];
  const distractorPool=shuffle(pool.filter(item=>item.text!==target.text)).slice(0,Math.min(3,pool.length-1));
  return{
    sentence:sourcePhrase[0].replace(target.text,'___'),
    reading:sourcePhrase[1],
    translation:sourcePhrase[2],
    answer:target.text,
    options:shuffle([target.text,...distractorPool.map(item=>item.text)])
  };
}

let currentVocabRound=null;
const vgSentence=document.querySelector('#vgSentence'),vgReading=document.querySelector('#vgReading'),vgOptions=document.querySelector('#vgOptions'),vgFeedback=document.querySelector('#vgFeedback'),vgNext=document.querySelector('#vgNext');
function renderVocabGame(){
  currentVocabRound=buildVocabRound();
  vgSentence.textContent=currentVocabRound.sentence;
  vgReading.textContent=currentVocabRound.reading;
  vgOptions.innerHTML=currentVocabRound.options.map(word=>'<button type="button" data-word="'+word+'">'+word+'</button>').join('');
  vgFeedback.textContent='Choose the word that completes the sentence.';
  vgNext.hidden=true;
}
if(vgOptions)vgOptions.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||!currentVocabRound)return;
  const correct=button.dataset.word===currentVocabRound.answer;
  vgOptions.querySelectorAll('button').forEach(b=>{b.disabled=true;if(b.dataset.word===currentVocabRound.answer)b.classList.add('correct')});
  if(!correct)button.classList.add('wrong');
  vgFeedback.textContent=(correct?'Correct. ':'Not quite. ')+currentVocabRound.sentence.replace('___',currentVocabRound.answer)+' — '+currentVocabRound.translation;
  vgNext.hidden=false;
});
if(vgNext)vgNext.addEventListener('click',renderVocabGame);

const particleItems=[
  {sentence:'私はギター ___ 弾きます。',reading:'わたしは ギター ___ ひきます。',answer:'を',options:['は','を','で'],explain:'を marks ギター as the direct object of 弾きます.'},
  {sentence:'毎朝公園 ___ 走ります。',reading:'まいあさ こうえん ___ はしります。',answer:'で',options:['に','で','を'],explain:'で marks 公園 as the place where the action happens.'},
  {sentence:'これ ___ 私の猫です。',reading:'これ ___ わたしの ねこです。',answer:'は',options:['が','は','を'],explain:'は introduces これ as the topic being described.'},
  {sentence:'友達 ___ 一緒に勉強します。',reading:'ともだち ___ いっしょに べんきょうします。',answer:'と',options:['と','に','で'],explain:'と marks 友達 as the companion — “together with.”'},
  {sentence:'六時 ___ 起きます。',reading:'ろくじ ___ おきます。',answer:'に',options:['で','に','を'],explain:'に marks 六時 as the specific time of the action.'},
  {sentence:'猫 ___ 窓の外を見ています。',reading:'ねこ ___ まどの そとを みています。',answer:'が',options:['は','が','を'],explain:'が marks 猫 as the subject performing the action.'}
];
let particleIndex=0;
const particleSentence=document.querySelector('#particleSentence'),particleReading=document.querySelector('#particleReading'),particleOptions=document.querySelector('#particleOptions'),particleFeedback=document.querySelector('#particleFeedback'),particleNext=document.querySelector('#particleNext');
function renderParticleQuiz(){
  const item=particleItems[particleIndex];
  particleSentence.textContent=item.sentence;
  particleReading.textContent=item.reading;
  particleOptions.innerHTML=shuffle(item.options).map(p=>'<button type="button" data-particle="'+p+'">'+p+'</button>').join('');
  particleFeedback.textContent='Choose one answer.';
  particleNext.hidden=true;
}
if(particleOptions)particleOptions.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button)return;
  const item=particleItems[particleIndex],correct=button.dataset.particle===item.answer;
  particleOptions.querySelectorAll('button').forEach(b=>{b.disabled=true;if(b.dataset.particle===item.answer)b.classList.add('correct')});
  if(!correct)button.classList.add('wrong');
  particleFeedback.textContent=(correct?'Correct. ':'Not quite. ')+item.explain;
  particleNext.hidden=false;
});
if(particleNext)particleNext.addEventListener('click',()=>{particleIndex=(particleIndex+1)%particleItems.length;renderParticleQuiz()});

renderPhrase();
renderVocabList();
if(vgOptions)renderVocabGame();
if(particleOptions)renderParticleQuiz();

function loadDeckScript(src){return new Promise(resolve=>{const script=document.createElement('script');script.src=src;script.onload=()=>resolve(true);script.onerror=()=>resolve(false);document.head.appendChild(script)})}
(async function extendPhraseDeck(){
  await loadDeckScript('jlpt-starter-deck.js?v=31');
  if(Array.isArray(window.KomorebiStarterPhrases)){
    const existing=new Set(phrases.map(item=>item[0]));
    window.KomorebiStarterPhrases.forEach(item=>{if(!existing.has(item[0])){phrases.push(item);existing.add(item[0])}});
  }
  renderVocabList();
  await Promise.all([loadDeckScript('supabase-config.js'),loadDeckScript('supabase-loader.js?v=16')]);
  await loadDeckScript('phrase-deck-sync.js?v=32');
  if(typeof drawReviewStatus==='function')drawReviewStatus();
})();
