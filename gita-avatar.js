(()=>{
  const btn=document.getElementById('gitaAvatarBtn');
  const video=document.getElementById('gitaAvatarVideo');
  if(!btn||!video)return;
  const sources={
    idle:'./assets/gita-idle.mp4',
    thinking:'./assets/gita-thinking.mp4',
    talking:'./assets/gita-talking.mp4'
  };
  let current='';
  let talkingTimer=null;
  function setGitaState(state){
    if(!sources[state]||state===current)return;
    current=state;
    btn.dataset.gitaState=state;
    video.src=sources[state];
    video.currentTime=0;
    video.play().catch(()=>{});
  }
  window.setGitaState=setGitaState;
  setGitaState('idle');

  const palette=document.getElementById('commandPalette');
  const results=document.getElementById('commandPaletteResults');
  if(results){
    new MutationObserver(()=>{
      if(results.querySelector('.assistant-thinking')){
        clearTimeout(talkingTimer);
        setGitaState('thinking');
        return;
      }
      if(results.querySelector('.assistant-answer')){
        setGitaState('talking');
        clearTimeout(talkingTimer);
        talkingTimer=setTimeout(()=>setGitaState('idle'),4500);
      }
    }).observe(results,{childList:true,subtree:true});
  }
  if(palette){
    new MutationObserver(()=>{
      if(palette.classList.contains('hidden')){
        clearTimeout(talkingTimer);
        setGitaState('idle');
      }
    }).observe(palette,{attributes:true,attributeFilter:['class']});
  }
  video.addEventListener('error',()=>{
    btn.classList.add('gita-video-missing');
  });
})();