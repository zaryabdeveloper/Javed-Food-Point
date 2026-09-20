
AOS.init({once:true,easing:'ease-out-quad',offset:50,duration:700});

// ── MOBILE NAV ──
const hamBtn    = document.getElementById('hamBtn');
const navMenu   = document.getElementById('navMenu');
const navOverlay= document.getElementById('navOverlay');
const navClose  = document.getElementById('navClose');

function openNav(){
  navMenu.classList.add('open');
  navOverlay.classList.add('show');
  hamBtn.setAttribute('aria-expanded','true');
  document.body.style.overflow='hidden';
}
function closeNav(){
  navMenu.classList.remove('open');
  navOverlay.classList.remove('show');
  hamBtn.setAttribute('aria-expanded','false');
  document.body.style.overflow='';
}
hamBtn.addEventListener('click', openNav);
navClose.addEventListener('click', closeNav);
navOverlay.addEventListener('click', closeNav);
document.querySelectorAll('[data-nav]').forEach(a=>a.addEventListener('click',closeNav));

// ── SCROLL ──
$(window).on('scroll',function(){
  const st=$(this).scrollTop();
  // back to top
  st>300?$('#btt').addClass('show'):$('#btt').removeClass('show');
  // active nav
  $('section[id]').each(function(){
    const t=$(this).offset().top-100;
    const b=t+$(this).outerHeight();
    if(st>=t&&st<b){
      $('[data-nav]').removeClass('active');
      $(`[data-nav][href="#${$(this).attr('id')}"]`).addClass('active');
    }
  });
});

$('#btt').on('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

// ── MENU FILTER ──
$('.fbtn').on('click',function(){
  const f=$(this).data('f');
  $('.fbtn').removeClass('active');$(this).addClass('active');
  if(f==='all'){$('.mi').stop(true).fadeIn(300);}
  else{
    $('.mi').each(function(){
      $(this).data('c')===f?$(this).stop(true).fadeIn(300):$(this).stop(true).fadeOut(200);
    });
  }
});

// ── COUNT-UP ──
let counted=false;
function doCount(){
  if(counted)return;counted=true;
  $('[data-count]').each(function(){
    const el=$(this),target=parseFloat(el.data('count'));
    const dec=target%1!==0;
    let cur=0,step=target/60;
    const t=setInterval(()=>{
      cur+=step;
      if(cur>=target){clearInterval(t);cur=target;}
      el.text(dec?cur.toFixed(1):Math.floor(cur).toLocaleString());
    },2000/60);
  });
}
$(window).on('scroll',function(){
  if(!counted&&$('#hero').length){
    const hb=$('#hero').offset().top+$('#hero').outerHeight();
    if($(window).scrollTop()+$(window).height()>hb-200)doCount();
  }
});
setTimeout(doCount,900);

// ── CONTACT FORM → WHATSAPP ──
function sendWA(btn){
  const wrap=$(btn).closest('.contact-form');
  const name=wrap.find('input').eq(0).val().trim();
  const phone=wrap.find('input').eq(1).val().trim();
  const subj=wrap.find('select').val();
  const msg=wrap.find('textarea').val().trim();
  if(!name||!msg){alert('Naam aur message zaroor likhein!');return;}
  const txt=encodeURIComponent(`Assalam o Alaikum Javed Food Point! 🍔\n\nNaam: ${name}\nPhone: ${phone}\nSubject: ${subj}\n\nMessage:\n${msg}`);
  window.open(`https://wa.me/923001234567?text=${txt}`,'_blank');
}