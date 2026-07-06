(function(){
  const chromeStyles=document.createElement('link');
  chromeStyles.rel='stylesheet';
  chromeStyles.href='site-chrome.css?v=36';
  document.head.appendChild(chromeStyles);
  const addCalendarShortcut=()=>{
    if(document.querySelector('.calendar-shortcut'))return;
    const link=document.createElement('a');
    link.className='calendar-shortcut';
    link.href='practice-calendar.html';
    link.setAttribute('aria-label','Open practice calendar');
    link.innerHTML='<span aria-hidden="true">▦</span> Calendar';
    document.body.appendChild(link);
  };
  const addAccountWidget=async()=>{
    if(document.querySelector('.account-shortcut'))return;
    const EMAIL_KEY='komorebi-account-email';
    const rememberedEmail=localStorage.getItem(EMAIL_KEY)||'';
    const wrap=document.createElement('div');
    wrap.className='account-shortcut';
    wrap.innerHTML='<button type="button" class="account-toggle" data-mode="signed-out" aria-expanded="false" aria-haspopup="true" aria-label="Account">＠</button><div class="account-panel" hidden></div>';
    document.body.appendChild(wrap);
    const toggle=wrap.querySelector('.account-toggle'),panel=wrap.querySelector('.account-panel');
    let client=null,currentUser=null;
    const renderSignedOut=()=>{
      panel.innerHTML='<small>SIGN IN</small><button type="button" class="google-signin" data-action="google-signin">Continue with Google →</button><div class="account-divider">or</div><form data-role="password-form"><label>Email<input type="email" name="email" required autocomplete="email" placeholder="you@example.com" value="'+rememberedEmail.replace(/"/g,'&quot;')+'"></label><label>Password<span class="pw-field"><input type="password" name="password" autocomplete="current-password" placeholder="••••••••" minlength="6"><button type="button" class="pw-toggle">Show</button></span></label><button type="submit">Sign in →</button></form><button type="button" class="account-link-button" data-action="send-link">Email me a sign-in link instead</button><p class="account-note" role="status" aria-live="polite"></p>';
    };
    const renderSignedIn=user=>{
      panel.innerHTML='<small>SIGNED IN</small><p class="account-email"></p><button type="button" data-action="sign-out">Sign out</button><button type="button" class="account-link-button" data-action="toggle-password">Set / change password</button><form data-role="set-password-form" hidden><label>New password<span class="pw-field"><input type="password" name="password" required autocomplete="new-password" minlength="6" placeholder="At least 6 characters"><button type="button" class="pw-toggle">Show</button></span></label><button type="submit">Save password</button></form><p class="account-note" role="status" aria-live="polite"></p>';
      panel.querySelector('.account-email').textContent=user.email;
    };
    const paint=user=>{
      currentUser=user;
      toggle.textContent=user&&user.email?user.email[0].toUpperCase():'＠';
      toggle.dataset.mode=user?'signed-in':'signed-out';
      if(user)renderSignedIn(user);else renderSignedOut();
    };
    toggle.addEventListener('click',async()=>{
      const wasHidden=panel.hidden;panel.hidden=!wasHidden;toggle.setAttribute('aria-expanded',String(wasHidden));
      if(!wasHidden)return;
      panel.querySelector('input')?.focus();
      if(toggle.dataset.mode==='signed-out'&&window.PasswordCredential&&navigator.credentials){
        try{
          const credential=await navigator.credentials.get({password:true,mediation:'optional'});
          const form=panel.querySelector('[data-role="password-form"]');
          if(credential&&credential.type==='password'&&form){form.email.value=credential.id;form.password.value=credential.password}
        }catch{}
      }
    });
    panel.addEventListener('submit',async event=>{
      const note=panel.querySelector('.account-note');
      const passwordForm=event.target.closest('[data-role="password-form"]');
      const setPasswordForm=event.target.closest('[data-role="set-password-form"]');
      if(passwordForm){
        event.preventDefault();
        if(!client){note.textContent='Sign-in is still loading. Try again in a moment.';return}
        const email=passwordForm.email.value.trim(),password=passwordForm.password.value;
        localStorage.setItem(EMAIL_KEY,email);
        if(!password){note.textContent='Enter a password, or use the link below.';return}
        note.textContent='Signing in…';
        const {error}=await client.auth.signInWithPassword({email,password});
        note.textContent=error?error.message:'';
        if(!error&&window.PasswordCredential){
          try{await navigator.credentials.store(new PasswordCredential({id:email,password,name:email}))}catch{}
        }
      }else if(setPasswordForm){
        event.preventDefault();
        if(!client){note.textContent='Account settings are still loading.';return}
        note.textContent='Saving…';
        const newPassword=setPasswordForm.password.value;
        const {error}=await client.auth.updateUser({password:newPassword});
        note.textContent=error?error.message:'Password saved. Use it next time you sign in.';
        if(!error&&window.PasswordCredential&&currentUser){
          try{await navigator.credentials.store(new PasswordCredential({id:currentUser.email,password:newPassword,name:currentUser.email}))}catch{}
        }
        if(!error)setPasswordForm.hidden=true;
      }
    });
    panel.addEventListener('click',async event=>{
      const pwToggle=event.target.closest('.pw-toggle');
      if(pwToggle){
        const input=pwToggle.previousElementSibling,showing=input.type==='text';
        input.type=showing?'password':'text';
        pwToggle.textContent=showing?'Show':'Hide';
        return;
      }
      if(event.target.closest('[data-action="google-signin"]')){
        if(!client){panel.querySelector('.account-note').textContent='Sign-in is still loading.';return}
        await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('#')[0]}});
        return;
      }
      if(event.target.closest('[data-action="sign-out"]')){client?.auth.signOut();return}
      if(event.target.closest('[data-action="toggle-password"]')){
        const form=panel.querySelector('[data-role="set-password-form"]');
        form.hidden=!form.hidden;
        if(!form.hidden)form.querySelector('input').focus();
        return;
      }
      if(event.target.closest('[data-action="send-link"]')){
        if(!client){panel.querySelector('.account-note').textContent='Sign-in is still loading.';return}
        const email=panel.querySelector('[data-role="password-form"] [name="email"]').value.trim(),note=panel.querySelector('.account-note');
        if(!email){note.textContent='Enter your email above first.';return}
        localStorage.setItem(EMAIL_KEY,email);
        note.textContent='Sending…';
        const redirect=location.href.split('#')[0];
        const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirect}});
        note.textContent=error?error.message:'Check your email for the sign-in link.';
      }
    });
    renderSignedOut();
    if(!window.KOMOREBI_CONFIG){
      await new Promise(resolve=>{
        const loader=document.createElement('script');loader.src='supabase-loader.js?v=16';loader.async=false;
        const config=document.createElement('script');config.src='supabase-config.js';config.async=false;
        config.onload=resolve;config.onerror=resolve;
        document.head.appendChild(loader);
        document.head.appendChild(config);
      });
    }
    const cfg=window.KOMOREBI_CONFIG||{};
    const library=window.supabase||await(window.KOMOREBI_SUPABASE_READY||Promise.resolve(null));
    if(!library||!cfg.supabaseUrl||!cfg.supabasePublishableKey){toggle.textContent='×';toggle.title='Sign-in unavailable';toggle.disabled=true;return}
    client=window.getKomorebiSupabaseClient?await window.getKomorebiSupabaseClient():library.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
    const {data}=await client.auth.getSession();
    paint(data?.session?.user||null);
    client.auth.onAuthStateChange((_event,session)=>paint(session?.user||null));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addCalendarShortcut,{once:true});else addCalendarShortcut();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addAccountWidget,{once:true});else addAccountWidget();
  const revealScenes=()=>setTimeout(()=>document.documentElement.classList.add('remote-scenes-ready'),1200);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',revealScenes,{once:true});else revealScenes();
  if('serviceWorker' in navigator){
    window.addEventListener('load',async()=>{
      try{
        const registration=await navigator.serviceWorker.register('./service-worker.js?v=17',{updateViaCache:'none'});
        await registration.update();
      }catch(error){
        console.info('Offline mode is unavailable right now. The website will still work online.',error);
      }
    });
  }
})();
