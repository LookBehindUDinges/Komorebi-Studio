(function(){
  if(window.KOMOREBI_SUPABASE_READY)return;
  window.KOMOREBI_SUPABASE_READY=new Promise(resolve=>{
    if(window.supabase){resolve(window.supabase);return}
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;resolve(value||null)};
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async=true;
    script.onload=()=>finish(window.supabase);
    script.onerror=()=>finish(null);
    document.head.appendChild(script);
    setTimeout(()=>finish(window.supabase),4500);
  });
})();
