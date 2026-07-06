(function(){
  const card=document.querySelector('#jpCard'),reveal=document.querySelector('#jpReveal'),next=document.querySelector('#jpNext');
  if(!card||!reveal||!next)return;
  reveal.addEventListener('click',()=>{card.classList.toggle('is-revealed',!document.querySelector('#jpMeaning').hidden)});
  next.addEventListener('click',()=>{card.classList.remove('is-revealed');card.classList.remove('is-changing');void card.offsetWidth;card.classList.add('is-changing');setTimeout(()=>card.classList.remove('is-changing'),420)});
  document.querySelectorAll('[data-review]').forEach(button=>button.addEventListener('click',()=>{card.classList.remove('is-revealed');card.classList.remove('is-changing');void card.offsetWidth;card.classList.add('is-changing');setTimeout(()=>card.classList.remove('is-changing'),420)}));
})();
