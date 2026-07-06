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
  window.getKomorebiSupabaseClient=async function(){
    if(window.KOMOREBI_SUPABASE_CLIENT)return window.KOMOREBI_SUPABASE_CLIENT;
    const library=window.supabase||await window.KOMOREBI_SUPABASE_READY;
    const cfg=window.KOMOREBI_CONFIG||{};
    if(!library||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return null;
    window.KOMOREBI_SUPABASE_CLIENT=library.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return window.KOMOREBI_SUPABASE_CLIENT;
  };
})();
