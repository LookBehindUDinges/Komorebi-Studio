const phrases=[
['今日は何を勉強しますか。','きょうは なにを べんきょうしますか。','What will you study today?','今日は (topic) + 何を (object) + 勉強しますか (action/question).'],
['毎晩ギターを練習します。','まいばん ギターを れんしゅうします。','I practice guitar every evening.','毎晩 (time) + ギターを (object) + 練習します (action).'],
['この言葉はどういう意味ですか。','この ことばは どういう いみですか。','What does this word mean?','この言葉は (topic) + どういう意味ですか (what meaning?).'],
['もう一度ゆっくり話してください。','もういちど ゆっくり はなしてください。','Please speak slowly one more time.','もう一度 (again) + ゆっくり (slowly) + 話してください (please speak).'],
['好きな曲を聴いています。','すきな きょくを きいています。','I am listening to a favorite song.','好きな曲を (object) + 聴いています (ongoing action).'],
['ペットが窓の外を見ています。','ペットが まどの そとを みています。','A pet is looking outside the window.','ペットが (subject) + 窓の外を (object/direction) + 見ています (ongoing action).']
];let phraseIndex=0;
const phrase=document.querySelector('#jpPhrase'),reading=document.querySelector('#jpReading'),meaning=document.querySelector('#jpMeaning'),note=document.querySelector('#jpNote'),reveal=document.querySelector('#jpReveal');
function renderPhrase(){const p=phrases[phraseIndex];phrase.textContent=p[0];reading.textContent=p[1];meaning.textContent=p[2];note.textContent=p[3];meaning.hidden=true;note.hidden=true;reveal.textContent='Show meaning'}
reveal.addEventListener('click',()=>{const hidden=meaning.hidden;meaning.hidden=!hidden;note.hidden=!hidden;reveal.textContent=hidden?'Hide meaning':'Show meaning'});
document.querySelector('#jpNext').addEventListener('click',()=>{phraseIndex=(phraseIndex+1)%phrases.length;renderPhrase()});
document.querySelectorAll('[data-particle]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-particle]').forEach(b=>b.classList.remove('correct','wrong'));const correct=button.dataset.particle==='を';button.classList.add(correct?'correct':'wrong');document.querySelector('#particleFeedback').textContent=correct?'Correct. を marks ギター as the direct object of 弾きます。':'Not this one. The guitar is the direct object, so use を。'}));
