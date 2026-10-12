"use strict";
const $=i=>document.getElementById(i);
const E=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"GH₵ "+Number(n).toLocaleString();
const opts=a=>a.map(x=>`<option>${E(x)}</option>`).join("");
const isValidEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||"").trim());
const L=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
const S=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{toast("Storage is full. Use fewer or smaller images.");return false}};

const CATS=[["Vehicles","🚗",138412],["Property","🏠",28806],["Phones & Tablets","📱",47123],["Electronics","💻",215038],["Home, Furniture & Appliances","🛋️",321924],["Fashion","👗",53381],["Beauty & Personal Care","💄",20112]];
const LOCS=["All Ghana","Greater Accra","Ashanti","Western","Central","Eastern","Volta","Northern"];

let ads=[], cart=L("ws_cart",{}), wish=L("ws_wish",[]), user=null;
let FLD=[],afterAuth=null,deals={},curThread=0,chatTimer=null,editAttrs={};
const dp=a=>deals[a.id]??a.p;
let RULES={min:100,cod:100,online:false},st={cat:-1,list:false,n:8,wl:false,af:{},afc:-2}, tmp=[];
const FEE=25;

async function api(u,m="GET",b){
  try{const r=await fetch(u,{method:m,headers:b?{"Content-Type":"application/json"}:{},body:b?JSON.stringify(b):undefined});
    const j=await r.json().catch(()=>({}));return r.ok?j:{error:j.error||"Request failed ("+r.status+")"}}
  catch{return{error:"Cannot reach the server. Check your connection."}}
}
function shrink(f){return new Promise(r=>{const i=new Image();i.onload=()=>{const k=Math.min(1,1280/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*k;c.height=i.height*k;c.getContext("2d").drawImage(i,0,0,c.width,c.height);r(c.toDataURL("image/jpeg",.82))};i.onerror=()=>r(null);i.src=URL.createObjectURL(f)})}
function toast(m){const t=$("toast");t.textContent=m;t.style.display="block";clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display="none",2400)}
/* ---- inline validation: red outline + message, cleared as soon as the user edits ---- */
const clearFlags=()=>document.querySelectorAll(".field-invalid").forEach(e=>{e.classList.remove("field-invalid");e.removeAttribute("aria-invalid")});
function mark(id){
  const el=typeof id==="string"?$(id):id;if(!el)return null;
  const t=el.type==="checkbox"?el.closest("label"):el;
  t.classList.add("field-invalid");el.setAttribute("aria-invalid","true");
  const clear=()=>{t.classList.remove("field-invalid");el.removeAttribute("aria-invalid");const n=t.nextElementSibling;if(n&&n.classList.contains("fe"))n.textContent=""};
  el.addEventListener("input",clear,{once:true});el.addEventListener("change",clear,{once:true});
  return t;
}
function invalid(ids,msg,err="er"){
  clearFlags();
  const list=[].concat(ids).map(mark).filter(Boolean);
  const e=$(err);if(e){e.textContent=msg;e.classList.add("cerr")}
  if(!list.length&&e)e.scrollIntoView({block:"nearest",behavior:"smooth"});
  if(list[0]){list[0].scrollIntoView({block:"center",behavior:"smooth"});const f=list[0].matches("input,select,textarea,button")?list[0]:list[0].querySelector("input");if(f)f.focus({preventScroll:true})}
  return false;
}
const PHONE_RE=/^[0-9+\s]{9,15}$/;
const M=h=>{$("mb").innerHTML=h;$("m").classList.add("open");const f=$("mb").querySelector("input:not([type=file]),select,textarea");if(f)setTimeout(()=>f.focus(),60)};
const X=()=>{$("m").classList.remove("open");clearInterval(chatTimer);afterAuth=null;if(/^\/ad\//.test(location.pathname))history.replaceState(null,"","/")};
$("m").addEventListener("click",e=>{if(e.target.id=="m")X()});
document.addEventListener("keydown",e=>{if(e.key=="Escape")X()});

const bg=(a,i=0)=>a.imgs&&a.imgs[i]?`style="background-image:url('${a.imgs[i]}')"`:"";
const cartCount=()=>Object.values(cart).reduce((a,b)=>a+b,0);

function badges(){
  $("cc").textContent=cartCount();$("wc").textContent=wish.length;
  $("acct").textContent=user?"👤 "+user.name.split(" ")[0]+(user.admin?" 🛡️":""):"Sign in";
}
function filtered(){
  const q=$("q").value.toLowerCase().trim(),l=$("loc").value,k=$("fk").value,so=$("so").value;
  const mn=+$("mn").value||0,mx=+$("mx").value||Infinity;
  const r=ads.filter(a=>!a.x&&!a.h&&(!st.wl||wish.includes(a.id))&&(st.cat<0||a.c==st.cat)&&(l=="All Ghana"||a.l==l)&&(k=="Any condition"||a.k==k)&&a.p>=mn&&a.p<=mx&&attrOk(a)&&(!q||q.split(/\s+/).every(w=>(a.t+" "+(a.d||"")+" "+Object.values(a.at||{}).join(" ")+" "+(CATS[a.c]?CATS[a.c][0]:"")+" "+a.l).toLowerCase().includes(w))));
  if(so=="low")r.sort((a,b)=>a.p-b.p);
  if(so=="high")r.sort((a,b)=>b.p-a.p);
  const nf=st.afc==st.cat?Object.keys(st.af).length:0;$("xc").textContent=nf?"("+nf+")":"";
  return r;
}
function draw(){
  $("cats").innerHTML=CATS.map((c,i)=>{
    const n=c[2]+ads.filter(a=>a.c==i&&!a.s).length;
    return `<button class="cat${st.cat==i?" on":""}" onclick="pick(${i})"><span class="ic">${c[1]}</span><span><b>${E(c[0])}</b><small>${n.toLocaleString()} ads</small></span><span class="ch">›</span></button>`}).join("");
  const r=filtered();
  $("ttl").textContent=st.wl?"Saved items":st.cat<0?"Trending ads":CATS[st.cat][0];
  $("cnt").textContent=r.length+" result"+(r.length==1?"":"s");
  const g=$("grid");g.className="grid"+(st.list?" list":"");
  g.innerHTML=r.length?r.slice(0,st.n).map(a=>`<div class="ad${a.f||a.pm?" feat":""}" onclick="view(${a.id})"><div class="pic" ${bg(a)}>${a.imgs&&a.imgs[0]?"":a.e}${a.pm?'<span class="badge">⭐ Promoted</span>':a.f?'<span class="badge">Popular</span>':""}<button class="heart" aria-label="Save" onclick="event.stopPropagation();fav(${a.id})">${wish.includes(a.id)?"♥":"♡"}</button></div><div class="info"><div class="price">${money(a.p)}</div><div class="t">${E(a.t)}</div><div class="m">${E(a.l)} · ${E(a.k)}</div>${a.sn?`<div class="m">${E(a.sn)}${a.sv?" ✔":""}${a.sc?" · ★"+a.sa:""}</div>`:""}<button class="add" onclick="event.stopPropagation();add(${a.id})">Add to cart</button></div></div>`).join(""):'<div class="empty">No ads match. Try another search, location or price range.</div>';
  $("more").style.display=r.length>st.n?"inline-block":"none";
  badges();
}
const pick=i=>{st.cat=st.cat==i?-1:i;st.n=8;draw()};
function fav(id){wish=wish.includes(id)?wish.filter(x=>x!=id):[...wish,id];S("ws_wish",wish);draw()}
function add(id,d=1,quiet=false){
  const a=ads.find(x=>x.id==id);
  cart[id]=(cart[id]||0)+d;
  if(cart[id]<=0)delete cart[id];
  S("ws_cart",cart);
  badges();
  const c=$("cc");
  c.classList.remove("bump");
  void c.offsetWidth;
  c.classList.add("bump");
  if(d>0&&!quiet&&a){showCart(a.t);return}
  if(!quiet)toast("Cart updated");
}

function view(id){
  const a=ads.find(x=>x.id==id);if(!a)return;
  const im=a.imgs||[];
  history.replaceState(null,"","/ad/"+a.id);if(!view.seen)view.seen=new Set();if(!view.seen.has(a.id)){view.seen.add(a.id);api("/api/ads/"+a.id+"/view","POST")}
  const wa=a.ph?`https://wa.me/${a.ph.replace(/\D/g,"").replace(/^0/,"233")}?text=${encodeURIComponent("Hi, is '"+a.t+"' still available?")}`:"";
  M(`${galHtml(a)}
  
  <div class="price" style="font-size:22px;margin-top:10px">${money(a.p)}${a.n?' <span class="m">· Negotiable</span>':""}</div>
  <h3>${E(a.t)}</h3><div class="m">${E(CATS[a.c][0])} · ${E(a.l)} · ${E(a.k)}</div>${a.o&&a.sn?`<button class="slr" onclick="seller(${a.o})"><span class="av">${E(a.sn[0])}</span><span style="flex:1"><b>${E(a.sn)}</b> ${a.sv?'<span class="vb">✔ Verified</span>':""}<br><span class="m">${stars(a.sa,a.sc)}</span></span><span class="ch">›</span></button>`:""}
  ${specs(a)}<button class="link" onclick="reviews(${a.id})">${a.rn?stars(a.ra,a.rn):"No reviews yet"} · Reviews</button><p>${E(a.d||"No description provided.")}</p>
  <div class="row"><button class="btn alt" onclick="share(${a.id})">🔗 Share</button><button class="btn alt" onclick="fav(${a.id});view(${a.id})">${wish.includes(a.id)?"♥ Saved":"♡ Save"}</button><button class="btn" onclick="add(${a.id})">Add to cart</button></div>
  ${a.o&&!(user&&a.o===user.id)?`<div class="row"><button class="btn alt" onclick="chat(${a.id})">💬 Message seller</button><button class="btn alt" onclick="chat(${a.id},1)">🏷️ Make an offer</button></div><button class="link" style="margin:6px 0" onclick="reportAd(${a.id})">🚩 Report this ad</button>`:""}<div class="row">${wa?`<a class="btn alt" target="_blank" rel="noopener" href="${wa}">Chat on WhatsApp</a>`:`<button class="btn alt" onclick="toast('This is a sample listing')">Contact seller</button>`}${user&&a.o===user.id?`<button class="btn alt" onclick="promote(${a.id})">⭐ Promote</button><button class="btn alt" onclick="sell(${a.id})">Edit</button><button class="btn alt" onclick="del(${a.id})">Delete</button>`:""}</div>`);
}
function del(id){ask("Delete this ad?","This cannot be undone.","Delete",async()=>{const r=await api("/api/ads/"+id,"DELETE");if(r.error)return toast(r.error);ads=ads.filter(a=>a.id!=id);delete cart[id];S("ws_cart",cart);draw();toast("Ad deleted")})}

const cartSub=()=>Object.entries(cart).reduce((s,[id,q])=>{const a=ads.find(x=>x.id==id);return a?s+dp(a)*q:s},0);
function showCart(added){
  const rows=cartRows();
  if(!rows.length)return M('<h3>Your cart</h3><p class="m">Your cart is empty.</p><button class="btn" onclick="X()">Continue shopping</button>');
  const sel=rows.filter(r=>!unsel.has(r.a.id)),sub=sel.reduce((s,r)=>s+dp(r.a)*r.q,0),low=sub<RULES.min;
  M(`<h3>Your cart</h3>${typeof added==="string"?`<div class="added">✓ <b>${E(added)}</b> was added to your cart. Would you like to continue shopping or check out?</div>`:""}
  <div class="cbar"><label class="chk"><input type="checkbox" id="sa"${sel.length==rows.length?" checked":""} onchange="cartAll(this.checked)"> Select all (${rows.length})</label><button class="link" onclick="clearCart()">🗑 Clear cart</button></div>
  ${rows.map(r=>`<div class="line"><input type="checkbox" class="ck"${unsel.has(r.a.id)?"":" checked"} onchange="cartPick(${r.a.id},this.checked)" aria-label="Select ${E(r.a.t)}"><div class="ic" ${bg(r.a)}>${r.a.imgs&&r.a.imgs[0]?"":r.a.e}</div><div class="g">${E(r.a.t)}<br><b>${money(dp(r.a))}</b></div><div class="q"><button onclick="add(${r.a.id},-1,true);showCart()">−</button> ${r.q} <button onclick="add(${r.a.id},1,true);showCart()">+</button></div></div>`).join("")}
  <div class="tot"><span>Subtotal (${sel.length} selected)</span><span>${money(sub)}</span></div><div class="tot"><span>Delivery</span><span class="m">Calculated at checkout</span></div>
  ${!sel.length?'<p class="err">Tick at least one item to check out.</p>':low?`<p class="err">Minimum order is ${money(RULES.min)} (items only). Add ${money(RULES.min-sub)} more to check out.</p>`:""}
  <div class="row"><button class="btn alt" onclick="X()">Continue shopping</button><button class="btn" onclick="openCheckout()"${!sel.length||low?" disabled":""}>Checkout</button></div>`);
}
const cartAll=on=>{unsel.clear();if(!on)cartRows().forEach(r=>unsel.add(r.a.id));showCart()};
const cartPick=(id,on)=>{on?unsel.delete(id):unsel.add(id);showCart()};
const clearCart=()=>ask("Clear your cart?","This removes everything you added.","Clear cart",()=>{cart={};unsel.clear();S("ws_cart",cart);badges();toast("Cart cleared");showCart()});
function auth(mode,msg=""){
  const reg=mode=="register";
  M(`<img class="lw" src="logo-wide.png" alt="DealMart"><h3>${reg?"Create account":"Sign in"}</h3>${msg?`<p class="m">${E(msg)}</p>`:""}${reg?'<label>Full name</label><input id="aN"><label>Phone</label><input id="aP" type="tel">':""}
  <label>Email</label><input id="aE" type="email"><label>Password</label><input id="aW" type="password">${reg?'<p class="m" style="font-size:12px;margin:4px 0">At least 8 characters.</p><label class="chk"><input type="checkbox" id="aT"> I agree to the <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a></label>':'<button class="link" onclick="forgot()">Forgot password?</button>'}
  <div class="err" id="er"></div><div class="row"><button class="btn" onclick="${reg?"doReg()":"doLogin()"}">${reg?"Register":"Sign in"}</button></div>
  <p class="m">${reg?"Have an account?":"New here?"} <button class="link" onclick="auth('${reg?"login":"register"}')">${reg?"Sign in":"Register"}</button></p>
  `);
}
async function doReg(){
  const n=$("aN").value.trim(),p=$("aP").value.trim(),e=$("aE").value.trim(),w=$("aW").value;
  if(n.length<2)return invalid("aN","Enter your full name.");
  if(!isValidEmail(e))return invalid("aE","Enter a valid email address.");
  if(w.length<8)return invalid("aW","Your password must be at least 8 characters.");
  if(!$("aT").checked)return invalid("aT","Please tick the box to accept the Terms and Privacy Policy.");
  const r=await api("/api/register","POST",{name:n,phone:p,email:e,password:w,agree:true});
  if(r.error)return invalid(/email/i.test(r.error)?"aE":/phone/i.test(r.error)?"aP":/password/i.test(r.error)?"aW":[],r.error);
  login(r.user);
}
async function doLogin(){
  const e=$("aE").value.trim(),w=$("aW").value;
  if(!isValidEmail(e))return invalid("aE","Enter the email you signed up with.");
  if(!w)return invalid("aW","Enter your password.");
  const r=await api("/api/login","POST",{email:e,password:w});
  if(r.error)return invalid(["aE","aW"],r.error);
  login(r.user);
}
const stars=(a,n)=>n?`★ ${a} (${n} review${n==1?"":"s"})`:"No reviews yet";
let curSeller=null,rt=0;
async function seller(id){
  const r=await api("/api/sellers/"+id);if(r.error)return toast(r.error);
  const s=curSeller=r.seller,me=user&&user.id==s.id;
  M(`<div class="slr-h"><span class="av big">${E(s.name[0])}</span><div><h3 style="margin:0">${E(s.name)}</h3>${s.verified?'<span class="vb">✔ Verified phone</span>':'<span class="m">Phone not verified</span>'}<div class="m">Member since ${new Date(s.since).toLocaleDateString(undefined,{month:"short",year:"numeric"})}<br>${stars(s.avg,s.n)}</div></div></div>
  ${me?'<div class="row"><button class="btn alt" onclick="account()">Back to my account</button></div>':""}
  <h3 style="margin-top:16px">Ads (${s.ads.length})</h3>${s.ads.length?s.ads.map(a=>`<div class="line" style="cursor:pointer" onclick="view(${a.id})"><div class="ic" ${bg(a)}>${a.imgs&&a.imgs[0]?"":a.e}</div><div class="g">${E(a.t)}<br><b>${money(a.p)}</b></div></div>`).join(""):'<p class="m">No ads right now.</p>'}
  <h3 style="margin-top:16px">Reviews</h3>${r.reviews.length?r.reviews.map(v=>rvHtml(v)).join(""):'<p class="m">No reviews yet.</p>'}`);
}
const rvHtml=v=>`<div class="rv"><b>${"★".repeat(v.stars)}${"☆".repeat(5-v.stars)}</b> <span class="vb">✔ Verified buyer</span><div class="m">${E(v.name)} · ${new Date(v.created).toLocaleDateString()}${v.title?" · "+E(v.title):""}</div>${v.text?`<div>${E(v.text)}</div>`:""}${v.photos&&v.photos.length?`<div class="rp">${v.photos.map(p=>`<img alt="Buyer photo" src="${E(p)}" onclick="zoom(this.src)">`).join("")}</div>`:""}${v.id?`<button class="sm" onclick="helpful(${v.id})">👍 Helpful${v.helpful?" ("+v.helpful+")":""}${v.voted?" ✓":""}</button>`:""}</div>`;
const zoom=src=>M(`<img alt="Buyer photo" src="${E(src)}" style="width:100%;border-radius:10px"><div class="row"><button class="btn" onclick="X()">Close</button></div>`);
let curAd=0,rvMine=null,rtmp=[];
async function reviews(id,po){
  curAd=id;const a=ads.find(x=>x.id==id),r=await api("/api/ads/"+id+"/reviews");if(r.error)return toast(r.error);
  rvMine=r.mine;const s=r.summary,list=po?r.reviews.filter(v=>v.photos.length):r.reviews;
  M(`<h3>${E(a?a.t:"Reviews")}</h3>
  <div class="sum"><div class="big">${s.n?s.avg:"–"}<small> / 5</small><div class="m">${s.n} review${s.n==1?"":"s"}</div></div><div class="bars">${[5,4,3,2,1].map(i=>`<div class="bar"><span>${i}★</span><i><u style="width:${s.n?Math.round(s.counts[i-1]/s.n*100):0}%"></u></i><span>${s.counts[i-1]}</span></div>`).join("")}</div></div>
  ${r.canReview?`<div class="row"><button class="btn" onclick="writeReview(${id})">${r.mine?"✏️ Edit my review":"✍️ Write a review"}</button></div>`:'<p class="m">Only people who bought this item through DealMart can review it.</p>'}
  <div class="row" style="margin-top:10px"><button class="btn${po?" alt":""}" onclick="reviews(${id})">All (${s.n})</button><button class="btn${po?"":" alt"}" onclick="reviews(${id},1)">With photos (${s.photos})</button></div>
  <div style="margin-top:8px">${list.length?list.map(v=>rvHtml(v)).join(""):'<p class="m">No reviews here yet.</p>'}</div>
  <div class="row"><button class="btn alt" onclick="view(${id})">Back to item</button></div>`);
}
function writeReview(id){
  const m=rvMine;rt=m?m.stars:0;rtmp=m?[...m.photos]:[];
  M(`<h3>${m?"Edit your review":"Write a review"}</h3><p class="m">Share how it arrived and what it looks like.</p><div class="stars" id="stv">${[1,2,3,4,5].map(i=>`<button aria-label="${i} star" onclick="setStar(${i})">${i<=rt?"★":"☆"}</button>`).join("")}</div>
  <label>Your review (optional)</label><textarea id="rT" rows="3" maxlength="300">${E(m?m.text:"")}</textarea>
  <label>Photos of your item (up to 3)</label><div class="drop" onclick="$('rf').click()">📷 Add photos</div><input type="file" id="rf" accept="image/*" multiple hidden onchange="rpics(this.files);this.value=''"><div class="thumbs" id="rth"></div>
  <div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="reviews(${id})">Back</button><button class="btn" id="rbtn" onclick="sendRate(${id})">Submit</button></div>`);
  showRth();
}
const showRth=()=>$("rth").innerHTML=rtmp.map((s,i)=>`<div class="th"><img alt="" src="${s}"><button aria-label="Remove photo" onclick="rtmp.splice(${i},1);showRth()">×</button></div>`).join("");
async function rpics(files){
  const room=3-rtmp.length,fs=[...files].filter(f=>f.type.startsWith("image/")).slice(0,Math.max(room,0));
  if(!fs.length)return toast(room>0?"Please choose image files":"You can add up to 3 photos");
  for(const f of fs){const s=await shrink(f);if(s)rtmp.push(s)}showRth();
}
const setStar=i=>{rt=i;$("stv").classList.remove("field-invalid");[...$("stv").children].forEach((b,k)=>b.textContent=k<i?"★":"☆")};
async function sendRate(id){
  if(!rt)return invalid("stv","Tap a star to rate.");
  const b=$("rbtn");b.disabled=true;b.textContent="Sending…";
  const r=await api("/api/ads/"+id+"/reviews","POST",{stars:rt,text:$("rT").value,photos:rtmp});
  if(r.error){b.disabled=false;b.textContent="Submit";return $("er").textContent=r.error}
  ads=(await api("/api/ads")).ads||ads;draw();toast("Thanks for your review ⭐");reviews(id);
}
async function helpful(id){const r=await api("/api/reviews/"+id+"/helpful","POST");if(r.error)return toast(r.error);reviews(curAd)}
function verifyPhone(){
  M(`<h3>Verify your phone</h3><p class="m">We will text a 6-digit code to this number. A verified badge helps buyers trust your ads.</p><label>Phone number</label><input id="vP" type="tel" value="${E(user.phone)}"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="account()">Back</button><button class="btn" onclick="sendCode()">Send code</button></div>`);
}
async function sendCode(){
  const p=$("vP").value.trim();if(!PHONE_RE.test(p))return invalid("vP","Enter a valid phone number.");
  const r=await api("/api/verify/send","POST",{phone:p});if(r.error)return invalid("vP",r.error);
  M(`<h3>Enter the code</h3><p class="m">Sent to ${E(p)}.${r.dev?" Test mode: the code appears in the server window (PowerShell).":""}</p><label>6-digit code</label><input id="vC" inputmode="numeric" maxlength="6"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="verifyPhone()">Back</button><button class="btn" onclick="checkCode()">Verify</button></div>`);
}
async function checkCode(){
  if(!/^\d{6}$/.test($("vC").value.trim()))return invalid("vC","Enter the 6-digit code.");
  const r=await api("/api/verify/check","POST",{code:$("vC").value.trim()});if(r.error)return invalid("vC",r.error);
  user=r.user;ads=(await api("/api/ads")).ads||ads;draw();
  M('<div class="ok">✓</div><h3 style="text-align:center">Phone verified</h3><p class="m" style="text-align:center">Buyers now see a ✔ Verified badge on your ads.</p><button class="btn" onclick="X()">Done</button>');
}
function login(u){const f=afterAuth;user=u;X();badges();draw();loadDeals();pollInbox();toast("Welcome, "+u.name.split(" ")[0]);if(f)f()}
function logout(){api("/api/logout","POST");user=null;deals={};setCount(0);X();badges();draw();toast("Signed out")}
async function account(){
  if(!user)return auth("login");
  const mine=myOrders=(await api("/api/orders")).orders||[];myPromos=(await api("/api/promos/mine")).promos||{};myEarn=await api("/api/payout");const ps=await pushState().catch(()=>"unsupported");
  M(`<h3>${E(user.name)}</h3><div class="m">${E(user.email)}</div><div style="margin-top:8px">${user.verified?'<span class="vb">✔ Verified phone</span>':'<button class="sm" onclick="verifyPhone()">Verify my phone</button>'} <button class="link" style="margin-left:8px" onclick="seller(${user.id})">View my public profile</button> <button class="link" style="margin-left:8px" onclick="changePw()">Change password</button></div>${user.admin?'<div class="row" style="margin-top:12px"><button class="btn" onclick="adminQ()">🛡️ Admin queue</button><button class="btn alt" onclick="adminOrders()">🚚 Deliveries</button><button class="btn alt" onclick="adminPay()">💰 Payouts</button><button class="btn alt" onclick="adminDisp()">⚖️ Disputes</button></div>':""}<h3 style="margin-top:16px">My orders</h3>
  ${mine.length?mine.map(o=>`<div class="line" style="cursor:pointer" onclick="orderView('${E(o.no)}')"><div class="g"><b>${E(o.no)}</b> · ${new Date(o.created).toLocaleDateString()} <span class="vb">${E(D_LBL[o.dstatus]||"Order placed")}</span><br><span class="m">${o.items.map(i=>E(i.t)+" x"+i.q).join(", ")}${o.dday?"<br>🚚 "+fmtDay(o.dday)+", "+E(o.slot):""}</span></div><b>${money(o.total)}</b></div>`).join(""):'<p class="m">No orders yet.</p>'}
  <h3 style="margin-top:16px">My ads</h3>${myAds()}${earnSection()}${appSection(ps)}<div class="row"><button class="btn alt" onclick="logout()">Sign out</button></div>`);
}

let editId=null;
function sell(id){
  if(!user)return sellGate();
  const a=id?ads.find(x=>x.id==id):null;editId=a?a.id:null;tmp=a?[...(a.imgs||[])]:[];
  const v=k=>a&&a[k]!=null?a[k]:"";
  M(`<h3>${a?"Edit your ad":"Sell something"}</h3><p class="m">Add clear photos and a fair price. It takes about a minute.</p>
  <label>Photos (up to 5)</label><div class="drop" id="dz" onclick="$('fi').click()">📷 Tap to upload or drag photos here</div>
  <input type="file" id="fi" accept="image/*" multiple hidden onchange="pics(this.files);this.value=''"><div class="thumbs" id="th"></div>
  <label>Title</label><input id="fT" maxlength="80" value="${E(v("t"))}" placeholder="e.g. iPhone 13, 128GB"><div class="fe" id="eT"></div>
  <label>Category</label><select id="fC" onchange="fields()">${CATS.map((c,i)=>`<option value="${i}"${a&&a.c==i?" selected":""}>${E(c[0])}</option>`).join("")}</select>
  <div id="fx"></div><label>Location</label><select id="fL">${opts(LOCS.slice(1))}</select><label>Condition</label><select id="fK">${opts(["Brand new","Used","Refurbished"])}</select>
  <label>Price (GH₵)</label><input id="fP" type="number" min="0" inputmode="decimal" value="${E(v("p"))}"><div class="fe" id="eP"></div>
  <label class="chk"><input type="checkbox" id="fN"${a&&a.n?" checked":""}> Price is negotiable</label>
  <label>Phone / WhatsApp</label><input id="fH" type="tel" value="${E(v("ph")||user.phone)}"><div class="fe" id="eH"></div>
  <label>Description</label><textarea id="fD" rows="3" maxlength="500">${E(v("d"))}</textarea><div class="hint" id="dc"></div>
  <div class="row"><button class="btn alt" onclick="X()">Cancel</button><button class="btn" id="pbtn" onclick="post()">${a?"Save changes":"Publish ad"}</button></div>`);
  if(a){$("fL").value=a.l;$("fK").value=a.k}
  editAttrs=a?a.at||{}:{};fields();
  showTh();
  const dz=$("dz");
  ["dragenter","dragover"].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add("over")}));
  ["dragleave","drop"].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove("over");if(n=="drop")pics(e.dataTransfer.files)}));
  const dc=()=>$("dc").textContent=$("fD").value.length+" / 500";$("fD").oninput=dc;dc();
}
function showTh(){$("th").innerHTML=tmp.map((s,i)=>`<div class="th"><img alt="" src="${s}"><button aria-label="Remove photo" onclick="tmp.splice(${i},1);showTh()">×</button>${i?"":'<span class="cv">Cover</span>'}</div>`).join("")}
async function pics(files){
  const room=5-tmp.length,fs=[...files].filter(f=>f.type.startsWith("image/"));
  if(!fs.length)return toast("Please choose image files");
  if(fs.length>room)toast(room>0?"Only "+room+" more photo"+(room==1?"":"s")+" allowed":"You can add up to 5 photos");
  const dz=$("dz");dz.textContent="⏳ Processing photos…";
  for(const f of fs.slice(0,Math.max(room,0))){const s=await shrink(f);if(s)tmp.push(s)}
  dz.textContent="📷 Tap to upload or drag photos here";showTh();
}
async function post(){
  const t=$("fT").value.trim(),p=$("fP").value,h=$("fH").value.trim();let bad=0;
  const err=(i,f,m)=>{$(i).textContent=m;mark(f);bad=bad||f};["eT","eP","eH"].forEach(i=>$(i).textContent="");clearFlags();
  if(t.length<3)err("eT","fT","Enter a title of at least 3 characters.");
  if(p===""||+p<0)err("eP","fP","Enter a price (use 0 if it is free).");
  if(!PHONE_RE.test(h))err("eH","fH","Enter a valid phone number.");
  if(bad){$(bad).scrollIntoView({block:"center",behavior:"smooth"});$(bad).focus({preventScroll:true});return toast("Please fix the highlighted fields")}
  const eid=editId,btn=$("pbtn"),label=btn.textContent;btn.disabled=true;btn.textContent="Saving…";
  const r=await api(eid?"/api/ads/"+eid:"/api/ads",eid?"PUT":"POST",{t,c:+$("fC").value,l:$("fL").value,p:+p,k:$("fK").value,d:$("fD").value.trim(),ph:h,imgs:tmp,n:$("fN").checked,at:getAt()});
  if(r.error){btn.disabled=false;btn.textContent=label;return toast(r.error)}
  ads=eid?ads.map(x=>x.id==eid?r.ad:x):[r.ad,...ads];
  st.cat=-1;st.wl=false;$("q").value="";draw();
  M(`<div class="ok">✓</div><h3 style="text-align:center">${eid?"Changes saved":"Your ad is live!"}</h3><p class="m" style="text-align:center">${E(t)} · ${money(p)}</p><div class="row"><button class="btn alt" onclick="sell()">Sell another</button><button class="btn" onclick="X()">Done</button></div>`);
}
function myAds(){
  const m=ads.filter(a=>a.o===user.id);
  return m.length?m.map(a=>`<div class="line"><div class="ic" ${bg(a)}>${a.imgs&&a.imgs[0]?"":a.e}</div><div class="g"><b>${E(a.t)}</b><br><span class="m">${money(a.p)}${a.x?" · Sold":""}${a.h?" · Hidden by moderators":""}${promoTag(a.id)}</span></div><button class="sm" onclick="sell(${a.id})">Edit</button><button class="sm" onclick="sold(${a.id})">${a.x?"Relist":"Mark sold"}</button>${a.x||a.h?"":`<button class="sm" onclick="promote(${a.id})">Promote</button>`}<button class="sm" onclick="del(${a.id})">Delete</button></div>`).join(""):'<p class="m">You have not posted any ads yet.</p>';
}
async function sold(id){
  const r=await api("/api/ads/"+id+"/sold","POST");if(r.error)return toast(r.error);
  ads=ads.map(x=>x.id==id?r.ad:x);if(r.ad.x){delete cart[id];S("ws_cart",cart)}
  draw();toast(r.ad.x?"Marked as sold":"Your ad is live again");account();
}
function ask(t,m,ok,fn){window._ask=fn;M(`<h3>${E(t)}</h3><p>${E(m)}</p><div class="row"><button class="btn alt" onclick="X()">Cancel</button><button class="btn" style="background:#d6204a" onclick="X();_ask()">${E(ok)}</button></div>`)}
function confirmAction(t,m,primaryLabel,primaryAction,secondaryLabel="Cancel",secondaryAction=()=>X()){window._ask=primaryAction;window._askSecondary=secondaryAction;M(`<h3>${E(t)}</h3><p>${E(m)}</p><div class="row"><button class="btn alt" onclick="X();_askSecondary()">${E(secondaryLabel)}</button><button class="btn" onclick="X();_ask()">${E(primaryLabel)}</button></div>`)}

const gLinks='<div class="glinks"><a class="link" href="/faq" target="_blank" rel="noopener">Read the FAQs</a><a class="link" href="/contact" target="_blank" rel="noopener">Contact support</a></div>';
const guide=k=>({
hb:["🧺 How to buy",`<p class="m">From finding an item to holding it in your hands, this is how buying works on DealMart.</p>
<ol class="guide">
<li><b>Find what you need</b>Search by keyword, choose a location, or tap a category. Use the sort, condition and price filters, and <i>More filters</i> (such as year or mileage for vehicles), to narrow things down.</li>
<li><b>Check the ad properly</b>Swipe through every photo, read the description and details, and open the seller's profile. Look for the ✔ Verified badge, their rating, and reviews from verified buyers.</li>
<li><b>Ask before you buy</b>Tap <i>Message seller</i> or <i>Chat on WhatsApp</i> to confirm the item is still available. If the price is negotiable, tap <i>Make an offer</i>. When the seller accepts, that price applies when you order.</li>
<li><b>Add to cart</b>Tap <i>Add to cart</i>. Your cart opens so you can change quantities or untick items you are not ready for. Then choose <i>Continue shopping</i> or <i>Checkout</i>. The minimum order is ${money(RULES.min)} (items only).</li>
<li><b>Check out in 3 steps</b><u>Delivery:</u> pick or add an address (street or area is required) and choose a delivery day and time window. <u>Payment:</u> pay by Card or Mobile Money when available, or pay cash on delivery for orders up to ${money(RULES.cod)}. <u>Review:</u> check everything, then tap <i>Place order</i>.</li>
<li><b>Track your order</b>Open your account, then <i>My orders</i>. You will see Order placed, Confirmed, Out for delivery, then Delivered. You can change the address, day or time until the order is out for delivery.</li>
<li><b>Inspect, then review</b>Check the item when it arrives. If something is wrong, contact us within 48 hours of the delivery date with your order number. Happy with it? Leave a review to help other buyers.</li>
</ol>
<div class="tip">💡 The delivery fee is always shown at checkout before you pay.</div>`],
hs:["💰 How to sell",`<p class="m">Listing is free. A good ad sells faster, so take a few extra minutes to get it right.</p>
<ol class="guide">
<li><b>Create an account and verify your phone</b>Register for free, then tap <i>Verify my phone</i> in your account. The ✔ Verified badge makes buyers trust you more.</li>
<li><b>Tap SELL and add photos</b>Add up to 5 clear photos in good light. The first one is your cover photo. Show the front, back and any flaws, because honest photos mean fewer disputes.</li>
<li><b>Write a clear title and description</b>Put the brand, model and size in the title. In the description (up to 500 characters) say what condition it is in, how old it is, what is included and why you are selling. Fill in the extra details for your category, such as year or mileage, so buyers can find you with filters.</li>
<li><b>Set a fair price</b>Look at similar ads first. Choose the right condition (Brand new, Used or Refurbished) and tick <i>Price is negotiable</i> if you are open to offers.</li>
<li><b>Publish and manage your ad</b>Your ad goes live straight away. From <i>My ads</i> you can edit it, mark it as sold (or relist it), or delete it. Mark items as sold quickly so buyers do not waste time.</li>
<li><b>Reply fast</b>Check your messages 💬 often. Answer questions, and accept or decline offers. Quick replies lead to quick sales.</li>
<li><b>Get paid</b>When an item sells through checkout, your earnings are the item price minus DealMart's commission. They become payable after the order is delivered. Add your Mobile Money details under <i>My earnings</i> and we will pay you, usually within 3 working days. Delivery fees are not part of your earnings.</li>
<li><b>Promote your ad (optional)</b>Tap <i>Promote</i> on your ad, choose a plan, pay by Mobile Money and enter the transaction ID. We approve within 24 hours, and promoted ads show first with a ⭐ badge.</li>
</ol>
<div class="tip">⚠️ Only sell items you own and are allowed to sell. Illegal items, stolen or counterfeit goods, weapons, drugs and adult content are not allowed and will be removed.</div>`],
ht:["🛡️ Safety tips",`<p class="m">Most deals go smoothly. These habits keep it that way.</p>
<div class="gsec"><h4>Before you buy</h4><ul>
<li>Read the whole ad and look at every photo. Be careful with prices that look too good to be true.</li>
<li>Check the seller's profile: ✔ Verified phone, rating, and reviews from verified buyers.</li>
<li>Ask questions in DealMart messages or on WhatsApp. A real seller answers clearly and does not rush you.</li></ul></div>
<div class="gsec"><h4>Paying safely</h4><ul>
<li>Use checkout (Card or Mobile Money through Paystack, or cash on delivery up to ${money(RULES.cod)}). We never see or store your card details.</li>
<li>Never send money outside the site to someone you do not know, including "reservation" or "delivery" fees.</li>
<li>Never share your Mobile Money PIN, a verification code or your password with anyone, including people who say they work for DealMart.</li></ul></div>
<div class="gsec"><h4>Delivery and meeting</h4><ul>
<li>Choose a delivery day and time when you will be reachable, and give a clear street, area or landmark.</li>
<li>If you meet in person, pick a busy public place in daylight and tell a friend or family member where you are going. Bring someone with you for expensive items.</li>
<li>Inspect the item before you accept it. Switch on phones and electronics and test them. For vehicles, check the ownership documents and take a test drive with someone you trust.</li></ul></div>
<div class="gsec"><h4>Red flags</h4><ul>
<li>The seller wants to move to another app, or asks you to pay first.</li>
<li>Pressure like "someone else is paying now", or a request for your PIN or a code.</li>
<li>Photos that look like stock pictures, or a description that does not match the photos.</li></ul></div>
<div class="gsec"><h4>If you are selling</h4><ul>
<li>Do not hand over an item until you have confirmed the money has really arrived in your own account. Ignore "overpayment" stories and screenshots of payments.</li>
<li>Share only the personal details you need to. Keep chats in DealMart messages where you can.</li></ul></div>
<div class="gsec"><h4>If something goes wrong</h4><ul>
<li>See a suspicious ad? Open it and tap <i>Report this ad</i>.</li>
<li>Problem with an order? Contact us within 48 hours of the delivery date with your order number.</li>
<li>If you feel threatened or in danger, contact the police first.</li></ul></div>`]
}[k]);
["hb","hs","ht"].forEach(k=>$(k).onclick=()=>{const g=guide(k);M(`<h3>${g[0]}</h3>${g[1]}${gLinks}<div class="row"><button class="btn" onclick="X()">Got it</button></div>`)});

$("loc").innerHTML=opts(LOCS);
["q","loc","so","fk","mn","mx"].forEach(i=>$(i).addEventListener(i=="q"||i=="mn"||i=="mx"?"input":"change",()=>{st.n=8;draw()}));
$("tog").onclick=()=>{st.list=!st.list;draw()};
$("more").onclick=()=>{st.n+=8;draw()};
$("sellB").onclick=()=>sell();$("msgB").onclick=inbox;$("xf").onclick=moreFilters;$("cartB").onclick=showCart;$("acct").onclick=account;
$("wishB").onclick=()=>{st.wl=!st.wl;st.n=8;draw()};
badges();
(async()=>{const f=await api("/api/fields");if(f.fields)FLD=f.fields;if(f.rules)RULES=f.rules;
  const si=await api("/api/site");if(si.whatsapp){$("wa").href="https://wa.me/"+si.whatsapp.replace(/\D/g,"").replace(/^0/,"233")+"?text="+encodeURIComponent("Hi DealMart, I need help");$("wa").hidden=false}const m=await api("/api/me");if(m.user){user=m.user;loadDeals();pollInbox()}badges();
  const rf=new URLSearchParams(location.search).get("reference");if(rf){history.replaceState(null,"",location.pathname);if(user)verifyReturn(rf);else toast("Sign in to confirm your payment")}const r=await api("/api/ads");if(r.error)toast(r.error);else ads=r.ads;draw();const dl=/^\/ad\/(\d+)/.exec(location.pathname);if(dl){if(ads.some(a=>a.id==dl[1]))view(+dl[1]);else{history.replaceState(null,"","/");toast("That ad is no longer available")}}})();

/* ---- category fields ---- */
function fields(){
  const c=+$("fC").value,at=editAttrs;
  $("fx").innerHTML=(FLD[c]||[]).map(f=>`<label>${E(f[1])}</label>${f[2]=="select"?`<select id="x_${f[0]}"><option value="">Select…</option>${f[3].map(o=>`<option${at[f[0]]==o?" selected":""}>${E(o)}</option>`).join("")}</select>`:`<input id="x_${f[0]}" type="${f[2]}"${f[2]=="number"?' min="0" inputmode="numeric"':' maxlength="40"'} value="${E(at[f[0]]??"")}">`}`).join("");
}
const getAt=()=>{const at={};(FLD[+$("fC").value]||[]).forEach(f=>{const e=$("x_"+f[0]);if(e&&e.value.trim())at[f[0]]=e.value.trim()});return at};
const specs=a=>{const r=(FLD[a.c]||[]).filter(f=>a.at&&a.at[f[0]]!=null&&a.at[f[0]]!=="");return r.length?`<div class="spec">${r.map(f=>`<div><span>${E(f[1])}</span><b>${E(f[2]=="number"?Number(a.at[f[0]]).toLocaleString():a.at[f[0]])}</b></div>`).join("")}</div>`:""};

/* ---- messages and offers ---- */
const setCount=n=>{$("mc").textContent=n;$("mc").style.display=n?"inline-block":"none"};
async function pollInbox(){if(!user)return setCount(0);const r=await api("/api/threads");if(!r.error)setCount(r.unread)}
async function loadDeals(){if(!user){deals={};return}const r=await api("/api/deals");if(!r.error)deals=r.deals}
async function chat(adId,offer){
  if(!user)return auth("login","Sign in to message sellers.");
  const r=await api("/api/threads","POST",{adId});if(r.error)return toast(r.error);
  openThread(r.id,offer);
}
async function inbox(){
  if(!user)return auth("login","Sign in to see your messages.");
  clearInterval(chatTimer);const r=await api("/api/threads");if(r.error)return toast(r.error);
  M(`<h3>Messages</h3>${r.threads.length?r.threads.map(t=>`<div class="line" style="cursor:pointer" onclick="openThread(${t.id})"><span class="av">${E(t.name[0])}</span><div class="g"><b>${E(t.name)}</b>${t.unread?` <span class="dot">${t.unread}</span>`:""}<br><span class="m">${E(t.title)}</span><br><span class="m">${E(t.last.slice(0,60))}</span></div></div>`).join(""):'<p class="m">No messages yet. Open an ad and tap Message seller.</p>'}<div class="row"><button class="btn" onclick="X()">Close</button></div>`);
  setCount(r.unread);
}
async function openThread(id,offer){
  curThread=id;
  M(`<div id="ch" class="chh"></div><div class="cm" id="cm"></div><p class="m" style="font-size:11px">Stay safe: meet in a public place and inspect the item before paying.</p>
  <div class="row" style="margin-top:6px"><input id="cT" placeholder="Type a message…" maxlength="500" onkeydown="if(event.key=='Enter')sendMsg()"><button class="btn" style="flex:none;width:auto" onclick="sendMsg()">Send</button></div>
  <div class="row"><button class="btn alt" onclick="offerBox()">🏷️ Make an offer</button><button class="btn alt" onclick="inbox()">All messages</button></div>`);
  await loadThread(true);clearInterval(chatTimer);chatTimer=setInterval(()=>loadThread(),4000);
  if(offer)offerBox();
}
const msgHtml=m=>m.kind=="system"?`<div class="sys">${E(m.body)}</div>`:m.kind=="offer"?`<div class="bub ${m.mine?"me":"them"} off"><b>🏷️ Offer: ${money(m.amount)}</b><div class="m">${{pending:m.mine?"Waiting for a reply":"Waiting for your reply",accepted:"Accepted ✓",declined:"Declined",void:"Replaced by a newer offer"}[m.status]||""}</div>${m.status=="pending"&&!m.mine?`<div class="row" style="margin-top:6px"><button class="sm" onclick="respond(${m.id},0)">Decline</button><button class="sm" style="background:var(--brand);color:#fff" onclick="respond(${m.id},1)">Accept</button></div>`:""}</div>`:`<div class="bub ${m.mine?"me":"them"}">${E(m.body)}<div class="m">${new Date(m.created).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div></div>`;
async function loadThread(first){
  const el=$("cm");if(!el){clearInterval(chatTimer);return}
  const r=await api("/api/threads/"+curThread);if(r.error){if(first)toast(r.error);return}
  if(!$("cm"))return;
  const t=r.thread,near=el.scrollHeight-el.scrollTop-el.clientHeight<80,sig=JSON.stringify(r.msgs.map(m=>[m.id,m.status]))+t.deal;
  $("ch").innerHTML=`<div class="line" style="padding-top:0"><span class="av">${E(t.other.name[0])}</span><div class="g"><b>${E(t.other.name)}</b> ${t.other.verified?'<span class="vb">✔ Verified</span>':""}<br><span class="m">${E(t.ad?t.ad.t:"Removed item")}${t.ad?" · "+money(t.ad.p):""}</span></div></div>${t.deal!=null?`<div class="deal">Agreed price: ${money(t.deal)}${t.iBuy?" · you can now order at this price":""}</div>`:""}`;
  if(el.dataset.sig!==sig){el.dataset.sig=sig;el.innerHTML=r.msgs.map(msgHtml).join("")||'<p class="m" style="text-align:center">Say hello or make an offer.</p>';if(first||near)el.scrollTop=el.scrollHeight}
  pollInbox();
}
async function sendMsg(){const i=$("cT"),v=i.value.trim();if(!v)return;i.value="";const r=await api("/api/threads/"+curThread+"/messages","POST",{body:v});if(r.error){i.value=v;return toast(r.error)}loadThread(true)}
function offerBox(){M(`<h3>Make an offer</h3><p class="m">Enter the price you want to pay (GH₵). The other person can accept or decline.</p><label>Your offer (GH₵)</label><input id="oA" type="number" min="1" inputmode="decimal"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="openThread(${curThread})">Back</button><button class="btn" onclick="sendOffer()">Send offer</button></div>`)}
async function sendOffer(){const v=$("oA").value;if(!(+v>0))return invalid("oA","Enter an amount above 0.");const r=await api("/api/threads/"+curThread+"/messages","POST",{offer:+v});if(r.error)return invalid("oA",r.error);toast("Offer sent");openThread(curThread)}
async function respond(id,accept){const r=await api("/api/messages/"+id+"/respond","POST",{accept:!!accept});if(r.error)return toast(r.error);loadDeals();loadThread(true)}

/* ---- filters using category details ---- */
const attrOk=a=>(st.cat<0||st.afc!=st.cat?[]:FLD[st.cat]||[]).every(f=>{
  const v=st.af[f[0]];if(!v)return true;const x=a.at?a.at[f[0]]:null;if(x==null)return false;
  if(f[2]=="number"){const n=+x;return(v.min===""||n>=+v.min)&&(v.max===""||n<=+v.max)}
  return f[2]=="select"?x==v:String(x).toLowerCase().includes(String(v).toLowerCase());
});
function moreFilters(){
  if(st.cat<0)return M('<h3>More filters</h3><p class="m">Pick a category first (for example Vehicles) to filter by details like year or mileage.</p><button class="btn" onclick="X()">OK</button>');
  const v=st.afc==st.cat?st.af:{};
  M(`<h3>Filter ${E(CATS[st.cat][0])}</h3>${(FLD[st.cat]||[]).map(f=>f[2]=="number"?`<label>${E(f[1])}</label><div class="row"><input id="f_${f[0]}_a" type="number" min="0" placeholder="From" value="${E(v[f[0]]?v[f[0]].min:"")}"><input id="f_${f[0]}_b" type="number" min="0" placeholder="To" value="${E(v[f[0]]?v[f[0]].max:"")}"></div>`:f[2]=="select"?`<label>${E(f[1])}</label><select id="f_${f[0]}"><option value="">Any</option>${f[3].map(o=>`<option${v[f[0]]==o?" selected":""}>${E(o)}</option>`).join("")}</select>`:`<label>${E(f[1])}</label><input id="f_${f[0]}" placeholder="Any" value="${E(v[f[0]]||"")}">`).join("")}<div class="row"><button class="btn alt" onclick="clearAf()">Clear</button><button class="btn" onclick="applyAf()">Show results</button></div>`);
}
function applyAf(){
  const af={};
  (FLD[st.cat]||[]).forEach(f=>{
    if(f[2]=="number"){const a=$("f_"+f[0]+"_a").value,b=$("f_"+f[0]+"_b").value;if(a!==""||b!=="")af[f[0]]={min:a,max:b}}
    else{const x=$("f_"+f[0]).value.trim();if(x)af[f[0]]=x}
  });
  st.af=af;st.afc=st.cat;st.n=8;X();draw();
}
const clearAf=()=>{st.af={};st.n=8;X();draw()};

/* ---- promote, report and admin queue ---- */
let myPromos={},promoPick="";
const promoTag=id=>{const p=myPromos[id];return !p?"":p.status=="active"?" · ⭐ Promoted until "+new Date(p.ends).toLocaleDateString():p.status=="pending"?" · ⭐ Promotion awaiting approval":""};
async function promote(id){
  if(!user)return auth("login","Sign in first.");
  const r=await api("/api/promo/plans");if(r.error)return toast(r.error);
  promoPick=r.plans[0]?r.plans[0].id:"";
  M(`<h3>⭐ Promote your ad</h3><p class="m">Promoted ads appear first with a ⭐ badge.</p><div class="sws">${r.plans.map((p,i)=>`<button class="sw${i?"":" on"}" onclick="pickPlan('${p.id}',this)"><b>${p.days} days</b>${money(p.price)}</button>`).join("")}</div>
  <p style="margin-top:12px">${r.pay.number?`Send the amount by Mobile Money to <b>${E(r.pay.number)}</b>${r.pay.name?" ("+E(r.pay.name)+")":""}, then enter the transaction ID below. We approve within 24 hours.`:"Promotion payments are not set up yet. Please try again later."}</p>
  <label>Mobile Money transaction ID</label><input id="pR" maxlength="40" placeholder="e.g. 1234567890"><div class="err" id="er"></div>
  <div class="row"><button class="btn alt" onclick="view(${id})">Back</button><button class="btn" onclick="sendPromo(${id})"${r.pay.number?"":" disabled"}>Request promotion</button></div>`);
}
const pickPlan=(id,el)=>{promoPick=id;[...el.parentNode.children].forEach(b=>b.classList.toggle("on",b==el))};
async function sendPromo(id){
  if(!$("pR").value.trim())return invalid("pR","Enter the Mobile Money transaction ID.");
  const r=await api("/api/ads/"+id+"/promote","POST",{plan:promoPick,ref:$("pR").value});if(r.error)return invalid("pR",r.error);
  M('<div class="ok">✓</div><h3 style="text-align:center">Request sent</h3><p class="m" style="text-align:center">We will check your payment and switch the promotion on. Follow it under My ads.</p><button class="btn" onclick="X()">Done</button>');
}
const REASONS=["Scam or fraud","Prohibited item","Wrong category","Duplicate ad","Offensive content","Other"];
function reportAd(id){
  if(!user)return auth("login","Sign in to report an ad.");
  M(`<h3>🚩 Report this ad</h3><p class="m">Tell us what is wrong. Reports are reviewed by our team.</p><label>Reason</label><select id="rR">${opts(REASONS)}</select><label>Details (optional)</label><textarea id="rN" rows="3" maxlength="300"></textarea><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="view(${id})">Back</button><button class="btn" onclick="sendReport(${id})">Send report</button></div>`);
}
async function sendReport(id){
  const r=await api("/api/ads/"+id+"/report","POST",{reason:$("rR").value,note:$("rN").value});if(r.error)return $("er").textContent=r.error;
  M('<div class="ok">✓</div><h3 style="text-align:center">Thank you</h3><p class="m" style="text-align:center">Your report was sent to our team.</p><button class="btn" onclick="X()">Done</button>');
}
async function adminQ(){
  const r=await api("/api/admin/queue");if(r.error)return toast(r.error);
  M(`<h3>🛡️ Admin queue</h3><h3 style="margin-top:10px">Promotions to approve (${r.promos.length})</h3>${r.promos.length?r.promos.map(p=>`<div class="line"><div class="g"><b>${E(p.title)}</b><br><span class="m">${E(p.uname)} · ${p.days} days · ${money(p.price)}<br>Transaction ID: ${E(p.ref)}</span></div><button class="sm" onclick="adminPromo(${p.id},0)">Reject</button><button class="sm" onclick="adminPromo(${p.id},1)">Approve</button></div>`).join(""):'<p class="m">Nothing waiting.</p>'}
  <h3 style="margin-top:14px">Open reports (${r.reports.length})</h3>${r.reports.length?r.reports.map(x=>`<div class="line"><div class="g"><b>${E(x.title)}</b>${x.hidden?' <span class="dot">hidden</span>':""}<br><span class="m">${E(x.reason)}${x.note?": "+E(x.note):""} · ${x.n} open on this ad</span></div><button class="sm" onclick="adminRep(${x.id},'dismiss')">Dismiss</button>${x.hidden?`<button class="sm" onclick="adminRep(${x.id},'restore')">Restore ad</button>`:`<button class="sm" onclick="adminRep(${x.id},'hide')">Hide ad</button>`}</div>`).join(""):'<p class="m">No open reports.</p>'}
  <div class="row"><button class="btn" onclick="account()">Back</button></div>`);
}
async function adminPromo(id,ok){const r=await api("/api/admin/promos/"+id,"POST",{approve:!!ok});if(r.error)return toast(r.error);toast(ok?"Promotion approved":"Rejected");ads=(await api("/api/ads")).ads||ads;draw();adminQ()}
async function adminRep(id,action){const r=await api("/api/admin/reports/"+id,"POST",{action});if(r.error)return toast(r.error);toast("Done");ads=(await api("/api/ads")).ads||ads;draw();adminQ()}

/* ---- returning from Paystack ---- */
async function verifyReturn(ref){
  const r=await api("/api/pay/verify","POST",{reference:ref});if(r.error)return toast(r.error);
  if(r.paid){(r.ids||[]).forEach(id=>delete cart[id]);S("ws_cart",cart);badges();M(`<div class="ok">✓</div><h3 style="text-align:center">Payment received</h3><p style="text-align:center">Thank you! Your order number is <b>${E(r.no)}</b>.</p>${r.dday?`<div class="promise" style="text-align:center">🚚 Arrives <b>${fmtDay(r.dday)}</b>, ${E(r.slot)}</div>`:""}<p class="m" style="text-align:center">Total ${money(r.total)} · paid with Paystack</p><button class="btn" onclick="X()">Done</button>`)}
  else M('<h3>Payment not completed</h3><p class="m">We did not receive your payment. Your cart is still saved, so you can try again.</p><button class="btn" onclick="showCart()">Back to cart</button>');
}

/* ================= CHECKOUT ================= */
let CO={},myOrders=[];
const D_LBL={placed:"Order placed",confirmed:"Confirmed",out:"Out for delivery",delivered:"Delivered",cancelled:"Cancelled"};
const fmtDay=d=>new Date(d+"T12:00:00").toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
const tierFee=(D,x)=>{for(const t of D.tiers)if(t.below==null||x<t.below)return t.fee;return 0};
const calcFee=(D,rows,reg)=>(D.mode=="order"?tierFee(D,rows.reduce((n,r)=>n+dp(r.a)*r.q,0)):rows.reduce((n,r)=>n+tierFee(D,dp(r.a))*(D.perUnit?r.q:1),0))+((D.regionFees||{})[reg]||0);
let unsel=new Set();
const selRows=()=>cartRows().filter(r=>!unsel.has(r.a.id));
const cartRows=()=>Object.entries(cart).map(([id,q])=>({a:ads.find(x=>x.id==id),q})).filter(r=>r.a);
const feeNote=()=>{const D=CO.info.delivery;return D.mode=="order"?"Delivery is based on your order total.":"Delivery per product: "+D.tiers.map(t=>t.below==null?money(t.fee)+" for the rest":money(t.fee)+" under "+money(t.below)).join(", ")+(D.perUnit?" (for each item).":".")};
const payList=sub=>[["Card","💳","Card","Visa or Mastercard. You enter your details on Paystack's secure page.",!RULES.online],["Mobile Money","📱","Mobile Money","MTN, Telecel or AirtelTigo. Approve the prompt on your phone.",!RULES.online],["Cash on delivery","💵","Cash on delivery","Pay the rider when your order arrives.",sub>RULES.cod]];

async function openCheckout(){
  if(!user){X();return auth("login","Sign in to check out.")}
  const rows=selRows(),sub=rows.reduce((n,r)=>n+dp(r.a)*r.q,0);
  if(!rows.length)return;
  if(sub<RULES.min){toast("Minimum order is "+money(RULES.min));return showCart()}
  const [i,a]=await Promise.all([api("/api/delivery"),api("/api/addresses")]);
  if(i.error||a.error)return toast(i.error||a.error);
  RULES=i.rules;
  CO={step:0,err:"",info:i,addrs:a.addresses,addrId:a.addresses[0]?a.addresses[0].id:null,form:a.addresses.length?null:{label:"Home",name:user.name,phone:user.phone},day:i.days[0]||"",slot:i.slots[1]||i.slots[0]||"",pay:"",notes:""};
  X();$("co").classList.add("open");document.body.style.overflow="hidden";coRender();
}
const coClose=()=>{$("co").classList.remove("open");document.body.style.overflow=""};
const coOpen=()=>$("co").classList.contains("open");
const coGo=n=>{CO.step=n;CO.err="";coRender();$("co").scrollTop=0};
const newForm=()=>({label:CO.addrs.length?"":"Home",name:user.name,phone:user.phone});
function coLeave(fn){
  confirmAction("Are you sure you want to go back?","Your order has not been placed yet. Your cart is saved, but the delivery choices on this page will not be kept.","Yes, go back",fn,"Stay in checkout",()=>{});
}
function coBack(){
  if(CO.step>0)return coGo(CO.step-1);
  coLeave(()=>{coClose();showCart()});
}
const fail=msg=>{CO.err=msg;CO.focusErr=1;coRender();return false};
const errBox=()=>CO.err?`<div class="err cerr" role="alert">⚠️ ${E(CO.err)}</div>`:"";
async function coNext(){
  if(CO.step===0){
    if(CO.form&&!(await coSaveAddr()))return;
    const A=CO.addrs.find(x=>x.id==CO.addrId);
    if(!A){CO.form={...newForm(),_invalid:{}};return fail("Please add a delivery address to continue.")}
    const v=validateAddressForm(A);
    if(Object.keys(v.invalid).length){CO.form={...A,_invalid:v.invalid};return fail(v.error)}
    if(!CO.day)return fail("Please choose a delivery day.");
    if(!CO.slot)return fail("Please choose a delivery time window.");
    return coGo(1);
  }
  if(CO.step===1){
    if(!CO.pay)return fail("Please choose how you want to pay.");
    return coGo(2);
  }
}
function coRender(){
  const rows=selRows(),sub=rows.reduce((n,r)=>n+dp(r.a)*r.q,0),A=CO.addrs.find(x=>x.id==CO.addrId),fee=A?calcFee(CO.info.delivery,rows,A.region):0,total=sub+fee,st=CO.step;
  if(!CO.pay){const f=payList(sub).find(p=>!p[4]);if(f)CO.pay=f[0]}
  $("co").innerHTML=`<div class="cohd"><button onclick="coBack()">‹ Back</button><b><img src="logo-icon.png" alt="" style="width:24px;height:24px;border-radius:6px;vertical-align:middle;margin-right:6px">Secure checkout</b><span style="width:60px"></span></div>
  <div class="steps">${["Delivery","Payment","Review"].map((n,i)=>`<div class="${i==st?"on":i<st?"dn":""}">${i+1}. ${n}</div>`).join("")}</div>
  <div class="cowrap"><div>${[coDelivery,coPay,coReview][st](A,rows,sub,fee)}</div><div class="cc">${coSummary(rows,sub,fee,total,A)}</div></div>
  <div class="cobar"><div class="tt"><span class="m">${A&&CO.day&&CO.slot?"🚚 Arrives "+fmtDay(CO.day)+", "+E(CO.slot):"Choose your delivery"}</span><br><b>${money(total)}</b></div><button class="btn" id="cobtn" onclick="${st==2?"coPlace()":"coNext()"}">${st==2?"Place order":"Continue"}</button></div>`;
  if(CO.focusErr){CO.focusErr=0;const t=$("co").querySelector(".field-invalid")||$("co").querySelector(".cerr");if(t){t.scrollIntoView({block:"center",behavior:"smooth"});if(/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))t.focus({preventScroll:true})}}
}
const validateAddressForm=(f={})=>{
  const v=k=>String(f[k]||"").trim(),invalid={};
  if(v("name").length<2)invalid.name="Enter the receiver's full name.";
  if(!PHONE_RE.test(v("phone")))invalid.phone="Enter a valid phone number, e.g. 0244 000 000.";
  if(v("addr").length<4)invalid.addr="Enter your street, area or landmark so the rider can find you.";
  const n=Object.keys(invalid).length;
  return {invalid,error:!n?"":invalid.addr&&n==1?"Please enter your street, area or landmark.":"Please complete the highlighted fields to continue."};
};
const coSummary=(rows,sub,fee,total,A)=>`<h4>Order summary</h4>${rows.map(r=>`<div class="line"><div class="ic" ${bg(r.a)}>${r.a.imgs&&r.a.imgs[0]?"":r.a.e}</div><div class="g">${E(r.a.t)}<br><span class="m">${money(dp(r.a))} × ${r.q}</span></div><b>${money(dp(r.a)*r.q)}</b></div>`).join("")}<div class="tot"><span>Subtotal</span><span>${money(sub)}</span></div><div class="tot"><span>Delivery${A?" to "+E(A.region):""}</span><span>${A?money(fee):"–"}</span></div><div class="tot"><b>Total</b><b>${money(total)}</b></div><p class="m" style="font-size:12px">${feeNote()}</p>`;
const coDelivery=(A,rows,sub,fee)=>{
  const I=CO.info;
  return `<div class="cc"><h4>1. Where should we deliver?</h4>${errBox()}${CO.addrs.map(a=>`<div class="opt${a.id==CO.addrId&&!CO.form?" on":""}" onclick="CO.addrId=${a.id};CO.form=null;CO.err='';coRender()"><span class="rad"></span><div style="flex:1"><b>${E(a.label)}</b> · ${E(a.name)} · ${E(a.phone)}<br><span class="m">${E(a.addr)}, ${E(a.region)}${a.gps?" · "+E(a.gps):""}</span></div><button class="sm" onclick="event.stopPropagation();coAddr(${a.id})">Edit</button></div>`).join("")}${CO.form?coForm():`<button class="btn alt" onclick="coAddr()">＋ Add a new address</button>`}</div>
  <div class="cc" style="margin-top:14px"><h4>2. Delivery day</h4><div class="days">${I.days.map(d=>{const t=new Date(d+"T12:00:00");return`<button class="dchip${d==CO.day?" on":""}" onclick="CO.day='${d}';CO.err='';coRender()"><b>${t.toLocaleDateString(undefined,{weekday:"short"})}</b><span>${t.getDate()}</span><b>${t.toLocaleDateString(undefined,{month:"short"})}</b></button>`}).join("")}</div>
  <h4 style="margin-top:14px">3. Time window</h4><div class="slots">${I.slots.map(s=>`<button class="dchip${s==CO.slot?" on":""}" data-s="${E(s)}" onclick="CO.slot=this.dataset.s;CO.err='';coRender()"><span style="font-size:14px">${E(s)}</span></button>`).join("")}</div>
  <label>Delivery notes (optional)</label><textarea rows="2" maxlength="200" placeholder="Gate code, landmark, who to ask for…" oninput="CO.notes=this.value">${E(CO.notes)}</textarea></div>`;
};
const coIn=(el,k)=>{
  CO.form[k]=el.value;el.classList.remove("field-invalid");el.removeAttribute("aria-invalid");
  const fe=el.nextElementSibling;if(fe&&fe.classList.contains("fe"))fe.textContent="";
  if(CO.form._invalid)delete CO.form._invalid[k];
};
const coForm=()=>{
  const f=CO.form||{},inv=f._invalid||{};
  const F=(k,l,ph,t)=>`<label for="cf_${k}">${l}</label><input id="cf_${k}" type="${t||"text"}" class="${inv[k]?"field-invalid":""}"${inv[k]?' aria-invalid="true"':""} placeholder="${ph}" value="${E(f[k]||"")}" oninput="coIn(this,'${k}')"><div class="fe">${E(inv[k]||"")}</div>`;
  const region=f.region||LOCS[1]||"Greater Accra";
  return `<div class="cc" style="margin-top:8px;background:var(--bg)"><h4>${f.id?"Edit address":"New address"}</h4>${F("label","Label (optional)","Home, Work…")}${F("name","Receiver's name *","Full name")}${F("phone","Phone number *","0244 000 000","tel")}<label>Region</label><select onchange="CO.form.region=this.value">${LOCS.slice(1).map(r=>`<option${region==r?" selected":""}>${E(r)}</option>`).join("")}</select>${F("addr","Street, area or landmark *","e.g. House 12, Oyarifa Road")}${F("gps","GhanaPost digital address (optional)","GA-123-4567")}${f.error?`<div class="err cerr" role="alert">${E(f.error)}</div>`:""}<div class="row" style="margin-top:10px">${f.id?'<button class="btn alt" onclick="coDelAddr()">Delete</button>':""}${CO.addrs.length?'<button class="btn alt" onclick="CO.form=null;CO.err=\'\';coRender()">Cancel</button>':""}<button class="btn" onclick="coSaveAddr()">Save address</button></div></div>`;
};
const coAddr=id=>{CO.err="";CO.form=id?{...CO.addrs.find(a=>a.id==id)}:newForm();coRender()};
async function coSaveAddr(){
  const f=CO.form;if(!f)return true;
  const {invalid,error}=validateAddressForm(f);
  if(Object.keys(invalid).length){CO.form={...f,_invalid:invalid,error:""};return fail(error)}
  const body={id:f.id,label:String(f.label||"").trim(),name:f.name.trim(),phone:f.phone.trim(),region:f.region||LOCS[1],addr:f.addr.trim(),gps:String(f.gps||"").trim()};
  const r=await api("/api/addresses","POST",body);
  if(r.error){CO.form={...f,error:r.error};return fail(r.error)}
  CO.addrs=(await api("/api/addresses")).addresses||CO.addrs;CO.addrId=r.id;CO.form=null;CO.err="";coRender();return true;
}
const coDelAddr=()=>ask("Delete this address?","You can add it again later.","Delete",async()=>{const id=CO.form.id;await api("/api/addresses/"+id,"DELETE");CO.addrs=CO.addrs.filter(a=>a.id!=id);CO.addrId=CO.addrs[0]?CO.addrs[0].id:null;CO.form=CO.addrs.length?null:{label:"Home",name:user.name,phone:user.phone};coRender()});
const coPay=(A,rows,sub)=>`<div class="cc"><h4>How would you like to pay?</h4>${errBox()}${payList(sub).map(p=>`<button class="opt${CO.pay==p[0]?" on":""}"${p[4]?" disabled":""} onclick="CO.pay='${p[0]}';CO.err='';coRender()"><span class="rad"></span><div><b>${p[1]} ${p[2]}</b><br><span class="m">${p[4]?(p[0]=="Cash on delivery"?"Only for orders of "+money(RULES.cod)+" or less.":"Not set up yet."):p[3]}</span></div></button>`).join("")}<p class="m" style="font-size:12px">🔒 We never see or store your card details.</p></div>`;
const coReview=(A,rows,sub,fee)=>`<div class="cc"><h4>Review your order</h4>
  <div class="line"><div class="g"><b>📍 Delivery address</b><br><span class="m">${E(A.name)} · ${E(A.phone)}<br>${E(A.addr)}, ${E(A.region)}${A.gps?" · "+E(A.gps):""}</span></div><button class="sm" onclick="coGo(0)">Edit</button></div>
  <div class="line"><div class="g"><b>🕒 Delivery time</b><br><span class="m">${fmtDay(CO.day)}, ${E(CO.slot)}${CO.notes?"<br>Note: "+E(CO.notes):""}</span></div><button class="sm" onclick="coGo(0)">Edit</button></div>
  <div class="line"><div class="g"><b>💳 Payment</b><br><span class="m">${E(CO.pay)}</span></div><button class="sm" onclick="coGo(1)">Edit</button></div>
  <p class="m" style="font-size:12px;margin-top:10px">You will pay ${money(sub+fee)}. You can change the delivery day, time or address from My orders until the order is out for delivery.</p></div>`;
async function coPlace(){
  const b=$("cobtn"),A=CO.addrs.find(x=>x.id==CO.addrId);b.disabled=true;b.textContent="Placing order…";
  const r=await api("/api/orders","POST",{items:selRows().map(r=>({id:r.a.id,q:r.q})),address:{name:A.name,phone:A.phone,region:A.region,addr:A.addr,gps:A.gps},day:CO.day,slot:CO.slot,pay:CO.pay,notes:CO.notes});
  if(r.error){b.disabled=false;b.textContent="Place order";return toast(r.error)}
  if(r.online){b.textContent="Opening Paystack…";CO.leaving=1;location.href=r.url;return}
  selRows().forEach(r=>delete cart[r.a.id]);S("ws_cart",cart);badges();coClose();
  M(`<div class="ok">✓</div><h3 style="text-align:center">Order placed</h3><p style="text-align:center">Your order number is <b>${E(r.no)}</b>.</p><div class="promise" style="text-align:center">🚚 Arrives <b>${fmtDay(r.dday)}</b>, ${E(r.slot)}</div><p class="m" style="text-align:center">Total ${money(r.total)} (delivery ${money(r.fee)}) · ${E(r.pay)}</p><div class="row"><button class="btn alt" onclick="X()">Keep shopping</button><button class="btn" onclick="account()">Track my order</button></div>`);
}

/* ---- order tracking and editing ---- */
function orderView(no){
  const o=myOrders.find(x=>x.no==no);if(!o)return;
  const steps=["placed","confirmed","out","delivered"],at=steps.indexOf(o.dstatus||"placed"),edit=o.dday&&at>=0&&at<2,canc=o.dstatus=="cancelled",canCancel=at>=0&&at<2&&(!o.cancelBy||Date.now()<o.cancelBy),
    cutNote=at>=0&&at<2&&o.cancelBy?(Date.now()<o.cancelBy?`<p class="m">You can cancel this order until ${new Date(o.cancelBy).toLocaleString([],{weekday:"short",day:"numeric",month:"short",hour:"numeric",minute:"2-digit"})}.</p>`:`<p class="m">The cancellation window has closed. Orders can be cancelled up to ${o.cancelHours} hours before delivery.</p>`):"",canReport=o.dstatus=="delivered"&&!o.dispute&&(!o.delivered||Date.now()-o.delivered<48*36e5),
    banner=canc?`<div class="promise">❌ This order was cancelled.${o.refund=="pending"?" Your refund is being processed.":o.refund=="refunded"?" Your refund has been sent.":""}</div>`:"",
    dnote=o.dispute?`<p class="m">Problem reported: ${E(o.dispute.reason)} · ${o.dispute.status=="open"?"we are looking into it":o.dispute.status=="refunded"?"refund approved":"closed, no refund"}${o.dispute.resolution?"<br>"+E(o.dispute.resolution):""}${o.dispute.status=="refunded"&&o.refund=="refunded"?"<br>Refund sent.":""}</p>`:"";
  M(`<h3>Order ${E(o.no)}</h3>${banner}<div class="tl"${canc?' style="display:none"':""}>${steps.map((s,i)=>`<div class="${i<=at?"dn":""}"><i>${i<=at?"✓":""}</i>${D_LBL[s]}</div>`).join("")}</div>
  ${o.dday?`<div class="promise">🚚 <b>${fmtDay(o.dday)}</b>, ${E(o.slot)}<br><span class="m">${E(o.dname)} · ${E(o.dphone)}<br>${E(o.daddr)}, ${E(o.region)}${o.gps?" · "+E(o.gps):""}${o.notes?"<br>Note: "+E(o.notes):""}</span></div>`:'<p class="m">Delivery details were not recorded for this older order.</p>'}
  <h3 style="margin-top:14px">Items</h3>${o.items.map(i=>`<div class="line"><div class="g">${E(i.t)}<br><span class="m">${money(i.p)} × ${i.q}</span></div><b>${money(i.p*i.q)}</b></div>`).join("")}
  <div class="tot"><span>Delivery</span><span>${money(o.fee||0)}</span></div><div class="tot"><b>Total</b><b>${money(o.total)}</b></div><p class="m">Payment: ${E(o.pay)}${o.status=="paid"?" · paid ✓":""}</p>
  <div class="row"><button class="btn alt" onclick="account()">Back</button>${edit?`<button class="btn" onclick="editDelivery('${E(o.no)}')">Change delivery</button>`:""}${canCancel?`<button class="btn alt" onclick="cancelOrder('${E(o.no)}')">Cancel order</button>`:""}${canReport?`<button class="btn alt" onclick="reportProblem('${E(o.no)}')">Report a problem</button>`:""}</div>${cutNote}${dnote}`);
}
async function editDelivery(no){
  const o=myOrders.find(x=>x.no==no),i=await api("/api/delivery");if(i.error)return toast(i.error);
  const days=[...new Set([o.dday,...i.days])].filter(Boolean);
  M(`<h3>Change delivery</h3><p class="m">The region (${E(o.region)}) can't change after ordering because the delivery fee depends on it.</p>
  <label>Receiver's name</label><input id="eN" value="${E(o.dname)}"><label>Phone</label><input id="eP" type="tel" value="${E(o.dphone)}"><label>Address</label><input id="eA" value="${E(o.daddr)}"><label>GhanaPost digital address (optional)</label><input id="eG" value="${E(o.gps)}">
  <label>Delivery day</label><select id="eD">${days.map(d=>`<option value="${d}"${d==o.dday?" selected":""}>${fmtDay(d)}</option>`).join("")}</select>
  <label>Time window</label><select id="eS">${i.slots.map(s=>`<option${s==o.slot?" selected":""}>${E(s)}</option>`).join("")}</select>
  <label>Notes</label><textarea id="eT" rows="2" maxlength="200">${E(o.notes)}</textarea><div class="err" id="er"></div>
  <div class="row"><button class="btn alt" onclick="orderView('${E(o.no)}')">Cancel</button><button class="btn" onclick="saveDelivery('${E(o.no)}')">Save changes</button></div>`);
}
async function saveDelivery(no){
  if($("eN").value.trim().length<2)return invalid("eN","Enter the receiver's name.");
  if(!PHONE_RE.test($("eP").value.trim()))return invalid("eP","Enter a valid phone number.");
  if($("eA").value.trim().length<4)return invalid("eA","Enter the street, area or landmark.");
  const r=await api("/api/orders/"+no+"/delivery","PUT",{address:{name:$("eN").value,phone:$("eP").value,addr:$("eA").value,gps:$("eG").value,notes:$("eT").value},day:$("eD").value,slot:$("eS").value});
  if(r.error)return invalid(/phone/i.test(r.error)?"eP":/address|street/i.test(r.error)?"eA":[],r.error);toast("Delivery details updated");account();
}
async function adminOrders(){
  const r=await api("/api/admin/orders");if(r.error)return toast(r.error);
  const nx={placed:"Confirm",confirmed:"Out for delivery",out:"Mark delivered"};
  M(`<h3>🚚 Deliveries (${r.orders.length})</h3>${r.orders.length?r.orders.map(o=>`<div class="line"><div class="g"><b>${o.dday?fmtDay(o.dday)+", "+E(o.slot):"No date"}</b> <span class="vb">${E(D_LBL[o.dstatus])}</span><br>${E(o.dname||o.uname||"")} · ${E(o.dphone||"")}<br><span class="m">${E(o.daddr||"")}${o.region?", "+E(o.region):""}${o.gps?" · "+E(o.gps):""}${o.notes?"<br>Note: "+E(o.notes):""}<br>${o.items.map(i=>E(i.t)+" ×"+i.q).join(", ")} · ${money(o.total)} · ${E(o.pay)}${o.status=="paid"?" ✓ paid":o.pay=="Cash on delivery"?" · collect cash":""}</span></div><button class="sm" onclick="adminAdv('${E(o.no)}')">${nx[o.dstatus]}</button></div>`).join(""):'<p class="m">No deliveries waiting.</p>'}<div class="row"><button class="btn" onclick="account()">Back</button></div>`);
}
async function adminAdv(no){const r=await api("/api/admin/orders/"+no+"/advance","POST");if(r.error)return toast(r.error);adminOrders()}

/* ---- sell gate and logo ---- */
function sellGate(){
  afterAuth=()=>sell();
  M(`<img class="lw" src="logo-wide.png" alt="DealMart"><h3 style="text-align:center">Sign in to start selling</h3><p class="m" style="text-align:center">You need a DealMart account to post an ad. It only takes a minute.</p><div class="row"><button class="btn" onclick="auth('register')">Create account</button><button class="btn alt" onclick="auth('login')">Sign in</button></div>`);
}
function goHome(){X();coClose();st.cat=-1;st.n=8;st.wl=false;st.af={};st.afc=-2;$("q").value="";draw();scrollTo({top:0,behavior:"smooth"})}
document.querySelector(".logo").onclick=e=>{e.preventDefault();coOpen()?coLeave(goHome):goHome()};
window.addEventListener("beforeunload",e=>{if(coOpen()&&!CO.leaving){e.preventDefault();e.returnValue=""}});
/* ---- photo gallery ---- */
let gal=[],gi=0,galId=0;
const galHtml=a=>{
  gal=a.imgs||[];gi=0;galId=a.id;
  if(!gal.length)return `<div class="dv">${a.e}</div>`;
  setTimeout(galInit,0);
  return `<div class="gal" id="gal"><img id="gm" src="${E(gal[0])}" alt="${E(a.t)}" onclick="lightbox()">${gal.length>1?`<button class="gn gp" aria-label="Previous photo" onclick="gGo(-1)">‹</button><button class="gn gx" aria-label="Next photo" onclick="gGo(1)">›</button>`:""}<span class="gc" id="gc">1 / ${gal.length}</span></div>${gal.length>1?`<div class="thumbs">${gal.map((s,i)=>`<img alt="Photo ${i+1}" src="${E(s)}" onclick="gSet(${i})">`).join("")}</div>`:""}`;
};
const gSet=i=>{gi=(i+gal.length)%gal.length;const m=$("gm");if(m){m.src=gal[gi];$("gc").textContent=(gi+1)+" / "+gal.length}};
const gGo=d=>gSet(gi+d);
const galInit=()=>{const g=$("gal");if(!g||gal.length<2)return;let x0=0;g.ontouchstart=e=>{x0=e.touches[0].clientX};g.ontouchend=e=>{const d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>40)gGo(d<0?1:-1)}};
const lightbox=()=>M(`<img id="lb" src="${E(gal[gi])}" alt="" style="width:100%;border-radius:10px"><div class="row">${gal.length>1?'<button class="btn alt" onclick="gGo(-1);lightbox()">‹ Prev</button>':""}<button class="btn" onclick="view(galId)">Back to ad</button>${gal.length>1?'<button class="btn alt" onclick="gGo(1);lightbox()">Next ›</button>':""}</div>`);
document.addEventListener("keydown",e=>{if($("m").classList.contains("open")&&$("gm")){if(e.key=="ArrowRight")gGo(1);if(e.key=="ArrowLeft")gGo(-1)}});
/* ---- forgot / change password ---- */
let myEarn={},resetEmail="";
function forgot(){
  const v=$("aE")?$("aE").value:"";
  M(`<img class="lw" src="logo-wide.png" alt="DealMart"><h3>Reset your password</h3><p class="m">Enter your account email and we will send you a 6-digit code.</p><label>Email</label><input id="rsE" type="email" value="${E(v)}"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="auth('login')">Back</button><button class="btn" onclick="sendReset()">Send code</button></div>`);
}
async function sendReset(){
  const e=$("rsE").value.trim();if(!isValidEmail(e))return invalid("rsE","Enter a valid email address.");
  const r=await api("/api/forgot","POST",{email:e});if(r.error)return invalid("rsE",r.error);
  resetEmail=e;
  M(`<h3>Enter your code</h3><p class="m">If ${E(e)} has an account, we have sent it a 6-digit code. It works for 15 minutes. Check your spam folder too.</p><label>6-digit code</label><input id="rsC" inputmode="numeric" maxlength="6"><label>New password (8 or more characters)</label><input id="rsW" type="password"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="forgot()">Back</button><button class="btn" onclick="doReset()">Set new password</button></div>`);
}
async function doReset(){
  if(!/^\d{6}$/.test($("rsC").value.trim()))return invalid("rsC","Enter the 6-digit code we sent you.");
  if($("rsW").value.length<8)return invalid("rsW","Your new password must be at least 8 characters.");
  const r=await api("/api/reset","POST",{email:resetEmail,code:$("rsC").value.trim(),password:$("rsW").value});
  if(r.error)return invalid(/password/i.test(r.error)?"rsW":"rsC",r.error);login(r.user);
}
function changePw(){M('<h3>Change password</h3><label>Current password</label><input id="cwC" type="password"><label>New password (8 or more characters)</label><input id="cwN" type="password"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="account()">Back</button><button class="btn" onclick="doChangePw()">Save password</button></div>')}
async function doChangePw(){
  if(!$("cwC").value)return invalid("cwC","Enter your current password.");
  if($("cwN").value.length<8)return invalid("cwN","Your new password must be at least 8 characters.");
  const r=await api("/api/password","POST",{current:$("cwC").value,password:$("cwN").value});
  if(r.error)return invalid(/current/i.test(r.error)?"cwC":"cwN",r.error);toast("Password changed");account();
}

/* ---- seller earnings and admin payouts ---- */
const earnSection=()=>{
  const e=myEarn;if(!e||e.error||!(e.items.length||e.details.number||ads.some(a=>a.o===user.id)))return"";
  return `<h3 style="margin-top:16px">💰 My earnings</h3><div class="tot"><span>Waiting to be paid out</span><b>${money(e.pending)}</b></div><div class="tot"><span>Paid out so far</span><span>${money(e.paid)}</span></div><p class="m" style="font-size:12px">You earn the item price minus DealMart's ${e.rate}% commission once an order is delivered. Delivery fees are not part of your earnings.</p>${e.details.number?`<p class="m" style="font-size:12px">Paying to ${E(e.details.net)} ${E(e.details.number)} (${E(e.details.name)})</p>`:'<p class="err">Add your Mobile Money details so we can pay you.</p>'}<div class="row"><button class="btn alt" onclick="dash()">📊 Dashboard</button><button class="btn alt" onclick="payoutForm()">${e.details.number?"Edit":"Add"} payout details</button>${e.items.length?'<button class="btn alt" onclick="earnList()">See earnings</button>':""}</div>`;
};
function payoutForm(){
  const d=myEarn.details||{};
  M(`<h3>Payout details</h3><p class="m">We pay your earnings to this Mobile Money number after your orders are delivered.</p><label>Network</label><select id="poN">${["MTN","Telecel","AirtelTigo"].map(n=>`<option${d.net==n?" selected":""}>${n}</option>`).join("")}</select><label>Mobile Money number</label><input id="poP" type="tel" value="${E(d.number)}"><label>Name registered on the number</label><input id="poA" value="${E(d.name)}"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="account()">Back</button><button class="btn" onclick="savePayout()">Save</button></div>`);
}
async function savePayout(){
  if(!PHONE_RE.test($("poP").value.trim()))return invalid("poP","Enter a valid Mobile Money number.");
  if($("poA").value.trim().length<2)return invalid("poA","Enter the name registered on that number.");
  const r=await api("/api/payout","POST",{net:$("poN").value,number:$("poP").value,name:$("poA").value});
  if(r.error)return invalid([],r.error);toast("Payout details saved");account();
}
const earnList=()=>M(`<h3>My earnings</h3>${myEarn.items.map(i=>`<div class="line"><div class="g"><b>${E(i.title)}</b><br><span class="m">${E(i.order_no)} · ${new Date(i.created).toLocaleDateString()} · item ${money(i.gross)} − commission ${money(i.commission)}</span></div><div><b>${money(i.net)}</b><br><span class="m">${i.status=="paid"?"Paid ✓":"Waiting"}</span></div></div>`).join("")}<div class="row"><button class="btn" onclick="account()">Back</button></div>`);
async function adminPay(){
  const r=await api("/api/admin/payouts");if(r.error)return toast(r.error);
  M(`<h3>💰 Payouts</h3><p class="m">Commission rate: <b>${r.rate}%</b>${r.rate==0?" (change commissionPercent in config.json)":""}</p><div class="tot"><span>Owed to sellers</span><b>${money(r.totals.owed)}</b></div><div class="tot"><span>Paid to sellers</span><span>${money(r.totals.paid)}</span></div><div class="tot"><span>Your commission</span><span>${money(r.totals.commission)}</span></div><div class="tot"><span>Delivery fees collected</span><span>${money(r.fees)}</span></div>
  <h3 style="margin-top:14px">Sellers waiting to be paid (${r.sellers.length})</h3>${r.sellers.length?r.sellers.map(s=>`<div class="line"><div class="g"><b>${E(s.name)}</b> · ${money(s.pending)}<br><span class="m">${s.num?E(s.net)+" "+E(s.num)+" ("+E(s.pname)+")":"⚠️ No payout details yet"} · ${s.n} item${s.n==1?"":"s"}</span></div><button class="sm" onclick="payRef(${s.id},${s.pending})">Mark paid</button></div>`).join(""):'<p class="m">Nobody is waiting for a payout.</p>'}
  <div class="row"><button class="btn alt" onclick="account()">Back</button><a class="btn" href="/api/admin/backup" download style="text-align:center;text-decoration:none">⬇️ Download backup</a></div>`);
}
const payRef=(id,amt)=>M(`<h3>Record payout</h3><p class="m">After you send ${money(amt)} to the seller's Mobile Money, enter the transaction ID here.</p><label>Mobile Money transaction ID</label><input id="prf" maxlength="40"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="adminPay()">Cancel</button><button class="btn" onclick="savePay(${id})">Mark as paid</button></div>`);
async function savePay(id){
  if($("prf").value.trim().length<4)return invalid("prf","Enter the transaction ID (at least 4 characters).");
  const r=await api("/api/admin/payouts","POST",{seller:id,ref:$("prf").value});if(r.error)return invalid("prf",r.error);toast("Payout recorded");adminPay();
}
setCount(0);setInterval(pollInbox,15000);

/* ---- share an ad ---- */
async function share(id){
  const a=ads.find(x=>x.id==id);if(!a)return;
  const url=location.origin+"/ad/"+a.id,text=a.t+" – "+money(a.p)+" on DealMart";
  if(navigator.share){try{await navigator.share({title:a.t,text,url})}catch{}return}
  let ok=false;try{await navigator.clipboard.writeText(url);ok=true}catch{}
  window.open("https://wa.me/?text="+encodeURIComponent(text+"\n"+url),"_blank","noopener");toast(ok?"Link copied":"Opening WhatsApp");
}
/* ---- seller dashboard ---- */
async function dash(){
  const r=await api("/api/seller/dashboard");if(r.error)return toast(r.error);
  const t=r.totals,fu=r.fulfil;
  M(`<h3>📊 Seller dashboard</h3>
  <div class="tot"><span>Live ads</span><b>${t.live} of ${t.ads}</b></div>
  <div class="tot"><span>Ad views</span><b>${t.views.toLocaleString()}</b></div>
  <div class="tot"><span>Delivered sales</span><b>${t.sales} · ${money(t.gross)}</b></div>
  <div class="tot"><span>Waiting to be paid out</span><b>${money(t.pending)}</b></div>
  <div class="tot"><span>Paid out so far</span><span>${money(t.paid)}</span></div>
  ${t.held?`<div class="tot"><span>On hold (problem reported)</span><b>${money(t.held)}</b></div>`:""}
  <h3 style="margin-top:14px">Orders to fulfil (${fu.length})</h3>${fu.length?fu.map(o=>`<div class="line"><div class="g"><b>${E(o.no)}</b> <span class="vb">${E(D_LBL[o.dstatus]||"Order placed")}</span><br><span class="m">${o.items.map(i=>E(i.t)+" x"+i.q+" · "+money(i.p*i.q)).join("<br>")}${o.dday?"<br>🚚 "+fmtDay(o.dday)+", "+E(o.slot):""}</span></div></div>`).join(""):'<p class="m">Nothing to fulfil right now.</p>'}
  <h3 style="margin-top:14px">Your ads</h3>${r.ads.length?r.ads.map(a=>`<div class="line" style="cursor:pointer" onclick="view(${a.id})"><div class="g"><b>${E(a.t)}</b>${a.live?"":' <span class="m">(not live)</span>'}<br><span class="m">👁 ${a.views} view${a.views==1?"":"s"} · ${a.sales} sale${a.sales==1?"":"s"}${a.gross?" · "+money(a.gross):""}</span></div></div>`).join(""):'<p class="m">You have not posted any ads yet.</p>'}
  <div class="row"><button class="btn alt" onclick="account()">Back</button></div>`);
}

/* ---- cancel an order and report a problem ---- */
function cancelOrder(no){
  const o=myOrders.find(x=>x.no==no);if(!o)return;
  M(`<h3>Cancel order ${E(no)}?</h3><p class="m">${o.status=="paid"?"You already paid online, so your money will be refunded to your original payment method.":"You have not been charged."}</p><label>Reason</label><select id="cR">${opts(["Changed my mind","Ordered by mistake","Found a better price","Delivery date does not suit me","Other"])}</select><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="orderView('${E(no)}')">Keep order</button><button class="btn" onclick="doCancel('${E(no)}')">Cancel order</button></div>`);
}
async function doCancel(no){const r=await api("/api/orders/"+no+"/cancel","POST",{reason:$("cR").value});if(r.error)return invalid([],r.error);toast("Order cancelled");account()}
function reportProblem(no){
  M(`<h3>Report a problem</h3><p class="m">Tell us what went wrong with order ${E(no)}. You can report a problem within 48 hours of delivery. The seller's payout is paused while we check.</p><label>What went wrong?</label><select id="rR">${opts(["Item not received","Not as described","Damaged","Wrong item","Other"])}</select><label>Details</label><textarea id="rN" rows="3" maxlength="500" placeholder="Describe what happened"></textarea><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="orderView('${E(no)}')">Back</button><button class="btn" onclick="doReport('${E(no)}')">Send report</button></div>`);
}
async function doReport(no){
  if($("rN").value.trim().length<5)return invalid("rN","Describe what happened (a few words is enough).");
  const r=await api("/api/orders/"+no+"/dispute","POST",{reason:$("rR").value,note:$("rN").value});if(r.error)return invalid([],r.error);toast("Report sent. We will update you soon.");account();
}
/* ---- admin: reported problems and refunds ---- */
async function adminDisp(){
  const r=await api("/api/admin/disputes");if(r.error)return toast(r.error);
  M(`<h3>⚖️ Problems reported (${r.disputes.length})</h3>${r.disputes.length?r.disputes.map(d=>`<div class="line"><div class="g"><b>${E(d.order_no)}</b> · ${E(d.uname)} · ${money(d.total)}<br><span class="m">${E(d.reason)}: ${E(d.note)}<br>${E(d.items.join(", "))} · ${E(d.pay)}</span></div><div><button class="sm" onclick="resolveDisp(${d.id},1)">Refund</button> <button class="sm" onclick="resolveDisp(${d.id},0)">Reject</button></div></div>`).join(""):'<p class="m">Nothing to review.</p>'}
  <h3 style="margin-top:14px">Refunds to send (${r.refunds.length})</h3>${r.refunds.length?r.refunds.map(o=>{const ps=o.ref&&r.online;return `<div class="line"><div class="g"><b>${E(o.no)}</b> · ${E(o.uname||"")} · ${money(o.total)}<br><span class="m">${ps?"Paid online: refund through Paystack":"Send by Mobile Money, then record the transaction ID"}</span></div>${ps?`<button class="sm" onclick="doRefund('${E(o.no)}')">Refund</button>`:`<button class="sm" onclick="refundRef('${E(o.no)}')">Record</button>`}</div>`}).join(""):'<p class="m">No refunds waiting.</p>'}<div class="row"><button class="btn" onclick="account()">Back</button></div>`);
}
const resolveDisp=(id,refund)=>M(`<h3>${refund?"Approve refund":"Reject report"}</h3><p class="m">Add a short note the buyer will see (optional).</p><input id="dnote" maxlength="300"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="adminDisp()">Back</button><button class="btn" onclick="saveDisp(${id},${refund})">Confirm</button></div>`);
async function saveDisp(id,refund){const r=await api("/api/admin/disputes/"+id,"POST",{refund:!!refund,note:$("dnote").value});if(r.error)return invalid([],r.error);toast(r.sellerPaid?"Done. This seller was already paid, so recover the money from them.":"Done");adminDisp()}
async function doRefund(no){const r=await api("/api/admin/orders/"+no+"/refund","POST",{paystack:true});if(r.error)return toast(r.error);toast("Refund started");adminDisp()}
const refundRef=no=>M(`<h3>Record refund</h3><p class="m">After you refund the buyer by Mobile Money, enter the transaction ID.</p><label>Mobile Money transaction ID</label><input id="rfr" maxlength="40"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="adminDisp()">Cancel</button><button class="btn" onclick="saveRefund('${E(no)}')">Mark refunded</button></div>`);
async function saveRefund(no){if($("rfr").value.trim().length<4)return invalid("rfr","Enter the transaction ID (at least 4 characters).");const r=await api("/api/admin/orders/"+no+"/refund","POST",{ref:$("rfr").value});if(r.error)return invalid("rfr",r.error);toast("Refund recorded");adminDisp()}
/* ---- search: suggestions, recent searches, near me ---- */
let recent=L("ws_recent",[]),sugI=-1;
const saveRecent=q=>{q=q.trim();if(q.length<2)return;recent=[q,...recent.filter(x=>x.toLowerCase()!=q.toLowerCase())].slice(0,6);S("ws_recent",recent)};
function clearRecent(){recent=[];S("ws_recent",recent);sugDraw()}
function sugList(){
  const q=$("q").value.toLowerCase().trim();
  if(!q)return{head:recent.length?"Recent searches":"",items:recent.map(t=>({t,ic:"🕘"})),clear:!!recent.length};
  const seen=new Set(),out=[],ws=q.split(/\s+/);
  CATS.forEach((c,i)=>{if(c[0].toLowerCase().includes(q))out.push({t:c[0],ic:c[1],cat:i})});
  for(const a of ads){if(a.x||a.h)continue;const tl=a.t.toLowerCase();if(ws.every(w=>tl.includes(w))&&!seen.has(tl)){seen.add(tl);out.push({t:a.t,ic:"🔎"})}if(out.length>=7)break}
  return{head:"",items:out.slice(0,7),clear:false};
}
function sugDraw(){
  const box=$("sug"),s=sugList();sugI=-1;
  if(!s.items.length){box.hidden=true;return}
  box._items=s.items;
  box.innerHTML=(s.head?`<div class="sh"><span>${s.head}</span>${s.clear?'<button type="button" onmousedown="event.preventDefault();clearRecent()">Clear</button>':""}</div>`:"")+s.items.map((x,i)=>`<button type="button" onmousedown="event.preventDefault();sugPick(${i})">${x.ic} ${E(x.t)}</button>`).join("");
  box.hidden=false;
}
function sugPick(i){
  const x=$("sug")._items[i];if(!x)return;
  if(x.cat!=null){st.cat=x.cat;$("q").value=""}else{$("q").value=x.t;saveRecent(x.t)}
  $("sug").hidden=true;st.n=8;draw();
}
$("q").addEventListener("focus",sugDraw);
$("q").addEventListener("input",sugDraw);
$("q").addEventListener("blur",()=>setTimeout(()=>{$("sug").hidden=true},120));
$("q").addEventListener("keydown",e=>{
  const bs=[...$("sug").querySelectorAll("button[onmousedown*=sugPick]")];
  if(e.key=="ArrowDown"||e.key=="ArrowUp"){if(!bs.length)return;e.preventDefault();sugI=(sugI+(e.key=="ArrowDown"?1:-1)+bs.length)%bs.length;bs.forEach((b,i)=>b.classList.toggle("on",i==sugI))}
  else if(e.key=="Enter"){if(sugI>=0&&bs.length){e.preventDefault();sugPick(sugI)}else{saveRecent($("q").value);$("sug").hidden=true}}
  else if(e.key=="Escape")$("sug").hidden=true;
});
const REGION_PTS={"Greater Accra":[5.60,-0.19],"Ashanti":[6.69,-1.62],"Western":[4.90,-1.76],"Central":[5.11,-1.25],"Eastern":[6.09,-0.26],"Volta":[6.60,0.47],"Northern":[9.40,-0.84]};
function nearMe(){
  if(!navigator.geolocation)return toast("Your browser can't share your location.");
  toast("Finding your area…");
  navigator.geolocation.getCurrentPosition(p=>{
    const a=p.coords.latitude,b=p.coords.longitude;let best="",d=1e9;
    for(const [r,[x,y]] of Object.entries(REGION_PTS)){const k=Math.hypot(x-a,(y-b)*Math.cos(a*Math.PI/180));if(k<d){d=k;best=r}}
    if(d>3||!LOCS.includes(best))return toast("You seem to be outside Ghana, so all ads are shown.");
    $("loc").value=best;st.n=8;draw();toast("Showing ads in "+best+", near you");
  },e=>toast(e.code==1?"Location is blocked. Allow it in your browser settings, or pick a region.":"Could not find your location."),{timeout:10000,maximumAge:6e5});
}
$("near").onclick=nearMe;
/* ---- install as an app and phone alerts ---- */
let installEv=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEv=e});
const isApp=()=>matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
async function installApp(){
  if(installEv){installEv.prompt();await installEv.userChoice.catch(()=>{});installEv=null;return account()}
  M(`<h3>Install DealMart</h3><p><b>iPhone:</b> open this site in Safari, tap the Share button, then “Add to Home Screen”.</p><p><b>Android:</b> open the browser menu and tap “Install app” or “Add to Home screen”.</p><div class="row"><button class="btn" onclick="account()">OK</button></div>`);
}
async function pushState(){
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window))return"unsupported";
  if(Notification.permission=="denied")return"denied";
  const r=await navigator.serviceWorker.ready;return(await r.pushManager.getSubscription())?"on":"off";
}
const urlB64=s=>{const b=(s+"=".repeat((4-s.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from([...atob(b)].map(c=>c.charCodeAt(0)))};
async function pushOn(){
  try{
    if(await Notification.requestPermission()!="granted")return toast("Alerts are blocked. Allow notifications in your browser settings.");
    const k=await api("/api/push/key");if(!k.key)return toast("Phone alerts are not set up on the server yet.");
    const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlB64(k.key)});
    const r=await api("/api/push/subscribe","POST",{sub:sub.toJSON()});if(r.error)return toast(r.error);toast("Phone alerts are on");account();
  }catch(e){toast("Could not turn on alerts on this device.")}
}
async function pushOff(){
  try{const reg=await navigator.serviceWorker.ready,s=await reg.pushManager.getSubscription();if(s){await api("/api/push/unsubscribe","POST",{endpoint:s.endpoint});await s.unsubscribe()}}catch{}
  toast("Phone alerts are off");account();
}
const appSection=ps=>`<h3 style="margin-top:16px">📲 App and alerts</h3><div class="row">${isApp()?"":`<button class="btn alt" onclick="installApp()">Install app</button>`}${ps=="off"?'<button class="btn alt" onclick="pushOn()">🔔 Turn on phone alerts</button>':ps=="on"?'<button class="btn alt" onclick="pushOff()">🔕 Turn off phone alerts</button>':""}</div>${ps=="denied"?'<p class="m" style="font-size:12px">Phone alerts are blocked in your browser settings.</p>':ps=="unsupported"?'<p class="m" style="font-size:12px">Phone alerts are not available in this browser. On iPhone, install the app first, then turn them on.</p>':""}`;
