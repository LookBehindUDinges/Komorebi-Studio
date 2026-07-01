(function(){
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
