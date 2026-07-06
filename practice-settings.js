(function(){
  const catalog=window.KomorebiActivities;
  const escapeText=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function render(){
    const items=catalog.read(),parents=items.filter(item=>!item.parentId&&item.active);
    document.querySelector('#newActivityParent').innerHTML='<option value="">Top-level category</option>'+parents.map(item=>`<option value="${item.id}">${escapeText(item.name)}</option>`).join('');
    document.querySelector('#activityManagerList').innerHTML=items.map(item=>`<article class="${item.active?'':'is-inactive'}"><span><i style="background:${item.color}"></i><strong>${escapeText(catalog.label(item.id,items))}</strong><small>${item.active?'Active':'Inactive · history preserved'}</small></span><button type="button" data-toggle-activity="${item.id}" data-next-active="${item.active?'false':'true'}">${item.active?'Deactivate':'Reactivate'}</button></article>`).join('');
  }
  document.querySelector('#newActivityForm').addEventListener('submit',event=>{event.preventDefault();const name=document.querySelector('#newActivityName').value.trim(),parentId=document.querySelector('#newActivityParent').value||null;if(!name)return;const item=catalog.add(name,parentId);event.target.reset();document.querySelector('#activityManagerNote').textContent=`${catalog.label(item.id)} added.`;render()});
  document.querySelector('#activityManagerList').addEventListener('click',event=>{const button=event.target.closest('[data-toggle-activity]');if(!button)return;catalog.setActive(button.dataset.toggleActivity,button.dataset.nextActive==='true');document.querySelector('#activityManagerNote').textContent=button.dataset.nextActive==='true'?'Activity restored to current logging.':'Activity hidden from current logging. Its history is unchanged.';render()});
  render();
})();
