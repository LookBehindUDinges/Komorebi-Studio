'use strict';
const musicRoot=document.querySelector('#recordingLibrary');const uploadInput=document.querySelector('#audio');const uploadCard=document.querySelector('.upload');const encodeMusicPath=file=>file.split('/').map(encodeURIComponent).join('/');const safeMusic=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
const OWNER_ID='009ad202-be4a-415d-b539-707c6e928322';
let client=null,currentUser=null,lastLocalFiles=[];
function trackCard(track,src,label='PUBLIC MP3',actionsHtml=''){return '<article class="cloud-track"><div class="cloud-track-mark">♫</div><div><small>'+label+'</small><h4>'+safeMusic(track.title)+'</h4><p>'+safeMusic(track.description||'Komorebi Studio recording')+'</p><audio controls preload="metadata" src="'+src+'"></audio>'+actionsHtml+'</div></article>'}
async function loadPublicMusic(){
  if(!musicRoot)return;
  const staticTracks=await fetch('Music/music-library.json',{cache:'no-store'}).then(r=>r.ok?r.json():{tracks:[]}).then(lib=>Array.isArray(lib.tracks)?lib.tracks.map(t=>({title:t.title,description:t.description,src:'Music/'+encodeMusicPath(t.file)})):[]).catch(()=>[]);
  let cloudTracks=[];
  if(client){
    const result=await client.from('public_tracks').select('id,title,description,storage_path').order('created_at',{ascending:false});
    if(!result.error)cloudTracks=(result.data||[]).map(row=>({title:row.title,description:row.description,src:client.storage.from('public-music').getPublicUrl(row.storage_path).data.publicUrl}));
  }
  const tracks=[...cloudTracks,...staticTracks];
  if(!tracks.length){musicRoot.innerHTML='<div class="library-head"><h3>Your public music</h3><span>MP3 library ready</span></div><p class="music-empty">No public MP3s are in the Music folder yet. Files selected above can still play privately on this device.</p>';return}
  musicRoot.innerHTML='<div class="library-head"><h3>Your public music</h3><span>'+tracks.length+' track'+(tracks.length===1?'':'s')+'</span></div><div class="cloud-track-grid">'+tracks.map(track=>trackCard(track,track.src)).join('')+'</div>';
}
function playLocalFiles(files){
  const audioFiles=[...files].filter(file=>file.type.startsWith('audio/')||/\.(mp3|m4a|aac|ogg|wav)$/i.test(file.name));
  if(!audioFiles.length)return;
  lastLocalFiles=audioFiles;
  const isOwner=Boolean(client&&currentUser&&currentUser.id===OWNER_ID);
  const list=document.querySelector('#files');
  list.innerHTML=audioFiles.map((file,index)=>{
    const publishable=isOwner&&/\.mp3$/i.test(file.name);
    const actionsHtml=publishable?'<button type="button" class="publish-track" data-index="'+index+'">Publish publicly →</button><p class="publish-note" data-index="'+index+'" role="status" aria-live="polite"></p>':(isOwner?'<p class="publish-note">Public publishing uses MP3 files only.</p>':'');
    return trackCard({title:file.name.replace(/\.[^.]+$/,''),description:'Playing from this device only'},URL.createObjectURL(file),'LOCAL PREVIEW',actionsHtml);
  }).join('');
  list.className='local-track-grid';
  if(!isOwner)return;
  list.querySelectorAll('.publish-track').forEach(button=>{
    button.addEventListener('click',async()=>{
      const index=Number(button.dataset.index),file=audioFiles[index],note=list.querySelector('.publish-note[data-index="'+index+'"]');
      button.disabled=true;note.textContent='Uploading…';
      const title=file.name.replace(/\.[^.]+$/,'').trim().slice(0,120)||'Untitled recording';
      const path=Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_');
      const upload=await client.storage.from('public-music').upload(path,file,{contentType:'audio/mpeg'});
      if(upload.error){note.textContent=upload.error.message;button.disabled=false;return}
      const insert=await client.from('public_tracks').insert({title,storage_path:path});
      if(insert.error){const cleanup=await client.storage.from('public-music').remove([path]);note.textContent=insert.error.message+(cleanup.error?' The uploaded file also needs manual cleanup.':' The incomplete upload was removed.');button.disabled=false;return}
      note.textContent='Published.';
      loadPublicMusic();
    });
  });
}
if(uploadInput)uploadInput.onchange=event=>playLocalFiles(event.target.files);if(uploadCard){uploadCard.addEventListener('dragover',event=>{event.preventDefault();uploadCard.classList.add('dragging')});uploadCard.addEventListener('dragleave',()=>uploadCard.classList.remove('dragging'));uploadCard.addEventListener('drop',event=>{event.preventDefault();uploadCard.classList.remove('dragging');playLocalFiles(event.dataTransfer.files)})}
(async()=>{
  const cfg=window.KOMOREBI_CONFIG||{};
  const library=window.supabase||await(window.KOMOREBI_SUPABASE_READY||Promise.resolve(null));
  if(library&&cfg.supabaseUrl&&cfg.supabasePublishableKey){
    client=window.getKomorebiSupabaseClient?await window.getKomorebiSupabaseClient():library.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
    const {data}=await client.auth.getSession();
    currentUser=data?.session?.user||null;
    client.auth.onAuthStateChange((_event,session)=>{currentUser=session?.user||null;if(lastLocalFiles.length)playLocalFiles(lastLocalFiles)});
  }
  loadPublicMusic();
})();
