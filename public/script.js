"use strict";
const $=i=>document.getElementById(i);
const E=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"GH₵ "+Number(n).toLocaleString();
const opts=a=>a.map(x=>`<option>${E(x)}</option>`).join("");
const L=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
const S=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{toast("Storage is full. Use fewer or smaller images.");return false}};

const CATS=[["Vehicles","🚗",138412],["Property","🏠",28806],["Phones & Tablets","📱",47123],["Electronics","💻",215038],["Home, Furniture & Appliances","🛋️",321924],["Fashion","👗",53381],["Beauty & Personal Care","💄",20112]];
const LOCS=["All Ghana","Greater Accra","Ashanti","Western","Central","Eastern","Volta","Northern"];

let ads=[], cart=L("ws_cart",{}), wish=L("ws_wish",[]), user=null;
let FLD=[],deals={},curThread=0,chatTimer=null,editAttrs={};
const dp=a=>deals[a.id]??a.p;
let RULES={min:100,cod:100,online:false},st={cat:-1,list:false,n:8,wl:false,af:{},afc:-2}, tmp=[];
const FEE=25;

async function api(u,m="GET",b){
  try{const r=await fetch(u,{method:m,headers:b?{"Content-Type":"application/json"}:{},body:b?JSON.stringify(b):undefined});
    const j=await r.json().catch(()=>({}));return r.ok?j:{error:j.error||"Request failed ("+r.status+")"}}
  catch{return{error:"Cannot reach the server. Check your connection."}}
}
function shrink(f){return new Promise(r=>{const i=new Image();i.onload=()=>{const k=Math.min(1,700/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*k;c.height=i.height*k;c.getContext("2d").drawImage(i,0,0,c.width,c.height);r(c.toDataURL("image/jpeg",.7))};i.onerror=()=>r(null);i.src=URL.createObjectURL(f)})}
function toast(m){const t=$("toast");t.textContent=m;t.style.display="block";clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display="none",2400)}
const M=h=>{$("mb").innerHTML=h;$("m").classList.add("open");const f=$("mb").querySelector("input:not([type=file]),select,textarea");if(f)setTimeout(()=>f.focus(),60)};
const X=()=>{$("m").classList.remove("open");clearInterval(chatTimer)};
$("m").addEventListener("click",e=>{if(e.target.id=="m")X()});
document.addEventListener("keydown",e=>{if(e.key=="Escape")X()});

const bg=(a,i=0)=>a.imgs&&a.imgs[i]?`style="background-image:url('${a.imgs[i]}')"`:"";
const cartCount=()=>Object.values(cart).reduce((a,b)=>a+b,0);

function badges(){
  $("cc").textContent=cartCount();$("wc").textContent=wish.length;
  $("acct").textContent=user?"👤 "+user.name.split(" ")[0]:"Sign in";
}
function filtered(){
  const q=$("q").value.toLowerCase().trim(),l=$("loc").value,k=$("fk").value,so=$("so").value;
  const mn=+$("mn").value||0,mx=+$("mx").value||Infinity;
  const r=ads.filter(a=>!a.x&&!a.h&&(!st.wl||wish.includes(a.id))&&(st.cat<0||a.c==st.cat)&&(l=="All Ghana"||a.l==l)&&(k=="Any condition"||a.k==k)&&a.p>=mn&&a.p<=mx&&attrOk(a)&&(!q||(a.t+" "+(a.d||"")+" "+Object.values(a.at||{}).join(" ")).toLowerCase().includes(q)));
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
function add(id,d=1){cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];S("ws_cart",cart);badges();const c=$("cc");c.classList.remove("bump");void c.offsetWidth;c.classList.add("bump");toast(d>0?"Added to cart ✓":"Cart updated")}

function view(id){
  const a=ads.find(x=>x.id==id);if(!a)return;
  const im=a.imgs||[];
  const wa=a.ph?`https://wa.me/${a.ph.replace(/\D/g,"").replace(/^0/,"233")}?text=${encodeURIComponent("Hi, is '"+a.t+"' still available?")}`:"";
  M(`<div class="dv" id="dv" ${bg(a)}>${im[0]?"":a.e}</div>
  ${im.length>1?`<div class="thumbs">${im.map(s=>`<img alt="" src="${s}" onclick="$('dv').style.backgroundImage='url('+this.src+')'">`).join("")}</div>`:""}
  <div class="price" style="font-size:22px;margin-top:10px">${money(a.p)}${a.n?' <span class="m">· Negotiable</span>':""}</div>
  <h3>${E(a.t)}</h3><div class="m">${E(CATS[a.c][0])} · ${E(a.l)} · ${E(a.k)}</div>${a.o&&a.sn?`<button class="slr" onclick="seller(${a.o})"><span class="av">${E(a.sn[0])}</span><span style="flex:1"><b>${E(a.sn)}</b> ${a.sv?'<span class="vb">✔ Verified</span>':""}<br><span class="m">${stars(a.sa,a.sc)}</span></span><span class="ch">›</span></button>`:""}
  ${specs(a)}<button class="link" onclick="reviews(${a.id})">${a.rn?stars(a.ra,a.rn):"No reviews yet"} · Reviews</button><p>${E(a.d||"No description provided.")}</p>
  <div class="row"><button class="btn alt" onclick="fav(${a.id});view(${a.id})">${wish.includes(a.id)?"♥ Saved":"♡ Save"}</button><button class="btn" onclick="add(${a.id})">Add to cart</button></div>
  ${a.o&&!(user&&a.o===user.id)?`<div class="row"><button class="btn alt" onclick="chat(${a.id})">💬 Message seller</button><button class="btn alt" onclick="chat(${a.id},1)">🏷️ Make an offer</button></div><button class="link" style="margin:6px 0" onclick="reportAd(${a.id})">🚩 Report this ad</button>`:""}<div class="row">${wa?`<a class="btn alt" target="_blank" rel="noopener" href="${wa}">Chat on WhatsApp</a>`:`<button class="btn alt" onclick="toast('This is a sample listing')">Contact seller</button>`}${user&&a.o===user.id?`<button class="btn alt" onclick="promote(${a.id})">⭐ Promote</button><button class="btn alt" onclick="sell(${a.id})">Edit</button><button class="btn alt" onclick="del(${a.id})">Delete</button>`:""}</div>`);
}
function del(id){ask("Delete this ad?","This cannot be undone.","Delete",async()=>{const r=await api("/api/ads/"+id,"DELETE");if(r.error)return toast(r.error);ads=ads.filter(a=>a.id!=id);delete cart[id];S("ws_cart",cart);draw();toast("Ad deleted")})}

const cartSub=()=>Object.entries(cart).reduce((s,[id,q])=>{const a=ads.find(x=>x.id==id);return a?s+dp(a)*q:s},0);
function showCart(){
  const rows=Object.entries(cart).map(([id,q])=>({a:ads.find(x=>x.id==id),q})).filter(r=>r.a);
  if(!rows.length)return M('<h3>Your cart</h3><p class="m">Your cart is empty.</p><button class="btn" onclick="X()">Keep shopping</button>');
  const sub=rows.reduce((s,r)=>s+dp(r.a)*r.q,0);
  M(`<h3>Your cart</h3>${rows.map(r=>`<div class="line"><div class="ic" ${bg(r.a)}>${r.a.imgs&&r.a.imgs[0]?"":r.a.e}</div><div class="g">${E(r.a.t)}<br><b>${money(dp(r.a))}</b></div><div class="q"><button onclick="add(${r.a.id},-1);showCart()">−</button> ${r.q} <button onclick="add(${r.a.id});showCart()">+</button></div></div>`).join("")}
  <div class="tot"><span>Subtotal</span><span>${money(sub)}</span></div><div class="tot"><span>Delivery</span><span class="m">Calculated at checkout</span></div>
  ${sub<RULES.min?`<p class="err">Minimum order is ${money(RULES.min)} (items only). Add ${money(RULES.min-sub)} more to check out.</p>`:""}
  <div class="row"><button class="btn alt" onclick="X()">Continue</button><button class="btn" onclick="openCheckout()"${sub<RULES.min?" disabled":""}>Checkout</button></div>`);
}
function auth(mode,msg=""){
  const reg=mode=="register";
  M(`<img class="lw" src="logo-wide.png" alt="DealMart"><h3>${reg?"Create account":"Sign in"}</h3>${msg?`<p class="m">${E(msg)}</p>`:""}${reg?'<label>Full name</label><input id="aN"><label>Phone</label><input id="aP" type="tel">':""}
  <label>Email</label><input id="aE" type="email"><label>Password</label><input id="aW" type="password">
  <div class="err" id="er"></div><div class="row"><button class="btn" onclick="${reg?"doReg()":"doLogin()"}">${reg?"Register":"Sign in"}</button></div>
  <p class="m">${reg?"Have an account?":"New here?"} <button class="link" onclick="auth('${reg?"login":"register"}')">${reg?"Sign in":"Register"}</button></p>
  `);
}
async function doReg(){
  const n=$("aN").value.trim(),p=$("aP").value.trim(),e=$("aE").value.trim(),w=$("aW").value;
  if(!n||!e.includes("@")||w.length<6)return $("er").textContent="Enter a name, a valid email and a password of 6 or more characters.";
  const r=await api("/api/register","POST",{name:n,phone:p,email:e,password:w});
  if(r.error)return $("er").textContent=r.error;login(r.user);
}
async function doLogin(){
  const r=await api("/api/login","POST",{email:$("aE").value.trim(),password:$("aW").value});
  if(r.error)return $("er").textContent=r.error;login(r.user);
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
const setStar=i=>{rt=i;[...$("stv").children].forEach((b,k)=>b.textContent=k<i?"★":"☆")};
async function sendRate(id){
  if(!rt)return $("er").textContent="Tap a star to rate.";
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
  const p=$("vP").value.trim(),r=await api("/api/verify/send","POST",{phone:p});if(r.error)return $("er").textContent=r.error;
  M(`<h3>Enter the code</h3><p class="m">Sent to ${E(p)}.${r.dev?" Test mode: the code appears in the server window (PowerShell).":""}</p><label>6-digit code</label><input id="vC" inputmode="numeric" maxlength="6"><div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="verifyPhone()">Back</button><button class="btn" onclick="checkCode()">Verify</button></div>`);
}
async function checkCode(){
  const r=await api("/api/verify/check","POST",{code:$("vC").value.trim()});if(r.error)return $("er").textContent=r.error;
  user=r.user;ads=(await api("/api/ads")).ads||ads;draw();
  M('<div class="ok">✓</div><h3 style="text-align:center">Phone verified</h3><p class="m" style="text-align:center">Buyers now see a ✔ Verified badge on your ads.</p><button class="btn" onclick="X()">Done</button>');
}
function login(u){user=u;X();badges();draw();loadDeals();pollInbox();toast("Welcome, "+u.name.split(" ")[0])}
function logout(){api("/api/logout","POST");user=null;deals={};setCount(0);X();badges();draw();toast("Signed out")}
async function account(){
  if(!user)return auth("login");
  const mine=myOrders=(await api("/api/orders")).orders||[];myPromos=(await api("/api/promos/mine")).promos||{};
  M(`<h3>${E(user.name)}</h3><div class="m">${E(user.email)}</div><div style="margin-top:8px">${user.verified?'<span class="vb">✔ Verified phone</span>':'<button class="sm" onclick="verifyPhone()">Verify my phone</button>'} <button class="link" style="margin-left:8px" onclick="seller(${user.id})">View my public profile</button></div><h3 style="margin-top:16px">My orders</h3>
  ${mine.length?mine.map(o=>`<div class="line" style="cursor:pointer" onclick="orderView('${E(o.no)}')"><div class="g"><b>${E(o.no)}</b> · ${new Date(o.created).toLocaleDateString()} <span class="vb">${E(D_LBL[o.dstatus]||"Order placed")}</span><br><span class="m">${o.items.map(i=>E(i.t)+" x"+i.q).join(", ")}${o.dday?"<br>🚚 "+fmtDay(o.dday)+", "+E(o.slot):""}</span></div><b>${money(o.total)}</b></div>`).join(""):'<p class="m">No orders yet.</p>'}
  <h3 style="margin-top:16px">My ads</h3>${myAds()}${user.admin?'<button class="btn" style="margin-top:12px" onclick="adminQ()">🛡️ Admin queue</button><button class="btn alt" style="margin-top:8px" onclick="adminOrders()">🚚 Deliveries</button>':""}<div class="row"><button class="btn alt" onclick="logout()">Sign out</button></div>`);
}

let editId=null;
function sell(id){
  if(!user)return auth("login","Sign in to post an ad.");
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
  const err=(i,m)=>{$(i).textContent=m;bad=1};["eT","eP","eH"].forEach(i=>$(i).textContent="");
  if(t.length<3)err("eT","Enter a title of at least 3 characters.");
  if(p===""||+p<0)err("eP","Enter a price (use 0 if it is free).");
  if(!/^[0-9+\s]{9,15}$/.test(h))err("eH","Enter a valid phone number.");
  if(bad)return toast("Please fix the highlighted fields");
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

const info={
  hb:["How to buy","<p>1. Search or pick a category.<br>2. Open an ad, then chat with the seller on WhatsApp or add it to your cart.<br>3. Check out with Mobile Money or cash on delivery.</p>"],
  hs:["How to sell","<p>1. Create a free account.<br>2. Tap SELL, add clear photos, a price and your phone number.<br>3. Buyers contact you directly. Edit your ad, mark it as sold or delete it any time from your account.</p>"],
  ht:["Safety tips","<p>Meet in a public place. Inspect the item before paying. Never send money to someone you have not met. Keep chats on the platform or WhatsApp.</p>"]
};
for(const k in info)$(k).onclick=()=>M(`<h3>${info[k][0]}</h3>${info[k][1]}<button class="btn" onclick="X()">Got it</button>`);

$("loc").innerHTML=opts(LOCS);
["q","loc","so","fk","mn","mx"].forEach(i=>$(i).addEventListener(i=="q"||i=="mn"||i=="mx"?"input":"change",()=>{st.n=8;draw()}));
$("tog").onclick=()=>{st.list=!st.list;draw()};
$("more").onclick=()=>{st.n+=8;draw()};
$("sellB").onclick=()=>sell();$("msgB").onclick=inbox;$("xf").onclick=moreFilters;$("cartB").onclick=showCart;$("acct").onclick=account;
$("wishB").onclick=()=>{st.wl=!st.wl;st.n=8;draw()};
badges();
(async()=>{const f=await api("/api/fields");if(f.fields)FLD=f.fields;if(f.rules)RULES=f.rules;const m=await api("/api/me");if(m.user){user=m.user;loadDeals();pollInbox()}
  const rf=new URLSearchParams(location.search).get("reference");if(rf){history.replaceState(null,"",location.pathname);if(user)verifyReturn(rf);else toast("Sign in to confirm your payment")}const r=await api("/api/ads");if(r.error)toast(r.error);else ads=r.ads;draw()})();
setCount(0);setInterval(pollInbox,15000);

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
async function sendOffer(){const v=$("oA").value;if(!(+v>0))return $("er").textContent="Enter an amount above 0.";const r=await api("/api/threads/"+curThread+"/messages","POST",{offer:+v});if(r.error)return $("er").textContent=r.error;toast("Offer sent");openThread(curThread)}
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
  const r=await api("/api/ads/"+id+"/promote","POST",{plan:promoPick,ref:$("pR").value});if(r.error)return $("er").textContent=r.error;
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
  if(r.paid){cart={};S("ws_cart",cart);badges();M(`<div class="ok">✓</div><h3 style="text-align:center">Payment received</h3><p style="text-align:center">Thank you! Your order number is <b>${E(r.no)}</b>.</p>${r.dday?`<div class="promise" style="text-align:center">🚚 Arrives <b>${fmtDay(r.dday)}</b>, ${E(r.slot)}</div>`:""}<p class="m" style="text-align:center">Total ${money(r.total)} · paid with Paystack</p><button class="btn" onclick="X()">Done</button>`)}
  else M('<h3>Payment not completed</h3><p class="m">We did not receive your payment. Your cart is still saved, so you can try again.</p><button class="btn" onclick="showCart()">Back to cart</button>');
}

/* ================= CHECKOUT ================= */
let CO={},myOrders=[];
const D_LBL={placed:"Order placed",confirmed:"Confirmed",out:"Out for delivery",delivered:"Delivered"};
const fmtDay=d=>new Date(d+"T12:00:00").toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
const tierFee=(D,x)=>{for(const t of D.tiers)if(t.below==null||x<t.below)return t.fee;return 0};
const calcFee=(D,rows,reg)=>(D.mode=="order"?tierFee(D,rows.reduce((n,r)=>n+dp(r.a)*r.q,0)):rows.reduce((n,r)=>n+tierFee(D,dp(r.a))*(D.perUnit?r.q:1),0))+((D.regionFees||{})[reg]||0);
const cartRows=()=>Object.entries(cart).map(([id,q])=>({a:ads.find(x=>x.id==id),q})).filter(r=>r.a);
const feeNote=()=>{const D=CO.info.delivery;return D.mode=="order"?"Delivery is based on your order total.":"Delivery per product: "+D.tiers.map(t=>t.below==null?money(t.fee)+" for the rest":money(t.fee)+" under "+money(t.below)).join(", ")+(D.perUnit?" (for each item).":".")};
const payList=sub=>[["Card","💳","Card","Visa or Mastercard. You enter your details on Paystack's secure page.",!RULES.online],["Mobile Money","📱","Mobile Money","MTN, Telecel or AirtelTigo. Approve the prompt on your phone.",!RULES.online],["Cash on delivery","💵","Cash on delivery","Pay the rider when your order arrives.",sub>RULES.cod]];

async function openCheckout(){
  if(!user){X();return auth("login","Sign in to check out.")}
  const rows=cartRows(),sub=rows.reduce((n,r)=>n+dp(r.a)*r.q,0);
  if(!rows.length)return;
  if(sub<RULES.min){toast("Minimum order is "+money(RULES.min));return showCart()}
  const [i,a]=await Promise.all([api("/api/delivery"),api("/api/addresses")]);
  if(i.error||a.error)return toast(i.error||a.error);
  RULES=i.rules;
  CO={step:0,info:i,addrs:a.addresses,addrId:a.addresses[0]?a.addresses[0].id:null,form:a.addresses.length?null:{label:"Home",name:user.name,phone:user.phone},day:i.days[0]||"",slot:i.slots[1]||i.slots[0]||"",pay:"",notes:""};
  X();$("co").classList.add("open");document.body.style.overflow="hidden";coRender();
}
const coClose=()=>{$("co").classList.remove("open");document.body.style.overflow=""};
const coGo=n=>{CO.step=n;coRender();$("co").scrollTop=0};
function coRender(){
  const rows=cartRows(),sub=rows.reduce((n,r)=>n+dp(r.a)*r.q,0),A=CO.addrs.find(x=>x.id==CO.addrId),fee=A?calcFee(CO.info.delivery,rows,A.region):0,total=sub+fee,st=CO.step;
  if(!CO.pay){const f=payList(sub).find(p=>!p[4]);if(f)CO.pay=f[0]}
  const blocked=(st==0&&!(A&&CO.day&&CO.slot&&!CO.form))||(st==1&&!CO.pay);
  $("co").innerHTML=`<div class="cohd"><button onclick="${st?"coGo("+(st-1)+")":"coClose();showCart()"}">‹ Back</button><b><img src="logo-icon.png" alt="" style="width:24px;height:24px;border-radius:6px;vertical-align:middle;margin-right:6px">Secure checkout</b><span style="width:60px"></span></div>
  <div class="steps">${["Delivery","Payment","Review"].map((n,i)=>`<div class="${i==st?"on":i<st?"dn":""}">${i+1}. ${n}</div>`).join("")}</div>
  <div class="cowrap"><div>${[coDelivery,coPay,coReview][st](A,rows,sub,fee)}</div><div class="cc">${coSummary(rows,sub,fee,total,A)}</div></div>
  <div class="cobar"><div class="tt"><span class="m">${A&&CO.day&&CO.slot?"🚚 Arrives "+fmtDay(CO.day)+", "+E(CO.slot):"Choose your delivery"}</span><br><b>${money(total)}</b></div><button class="btn" id="cobtn" onclick="${st==2?"coPlace()":"coGo("+(st+1)+")"}"${blocked?" disabled":""}>${st==2?"Place order":"Continue"}</button></div>`;
}
const coSummary=(rows,sub,fee,total,A)=>`<h4>Order summary</h4>${rows.map(r=>`<div class="line"><div class="ic" ${bg(r.a)}>${r.a.imgs&&r.a.imgs[0]?"":r.a.e}</div><div class="g">${E(r.a.t)}<br><span class="m">${money(dp(r.a))} × ${r.q}</span></div><b>${money(dp(r.a)*r.q)}</b></div>`).join("")}<div class="tot"><span>Subtotal</span><span>${money(sub)}</span></div><div class="tot"><span>Delivery${A?" to "+E(A.region):""}</span><span>${A?money(fee):"–"}</span></div><div class="tot"><b>Total</b><b>${money(total)}</b></div><p class="m" style="font-size:12px">${feeNote()}</p>`;
const coDelivery=()=>{
  const I=CO.info;
  return `<div class="cc"><h4>1. Where should we deliver?</h4>${CO.addrs.map(a=>`<div class="opt${a.id==CO.addrId&&!CO.form?" on":""}" onclick="CO.addrId=${a.id};CO.form=null;coRender()"><span class="rad"></span><div style="flex:1"><b>${E(a.label)}</b> · ${E(a.name)} · ${E(a.phone)}<br><span class="m">${E(a.addr)}, ${E(a.region)}${a.gps?" · "+E(a.gps):""}</span></div><button class="sm" onclick="event.stopPropagation();coAddr(${a.id})">Edit</button></div>`).join("")}${CO.form?coForm():'<button class="btn alt" onclick="coAddr()">＋ Add a new address</button>'}</div>
  <div class="cc" style="margin-top:14px"><h4>2. Delivery day</h4><div class="days">${I.days.map(d=>{const t=new Date(d+"T12:00:00");return`<button class="dchip${d==CO.day?" on":""}" onclick="CO.day='${d}';coRender()"><b>${t.toLocaleDateString(undefined,{weekday:"short"})}</b><span>${t.getDate()}</span><b>${t.toLocaleDateString(undefined,{month:"short"})}</b></button>`}).join("")}</div>
  <h4 style="margin-top:14px">3. Time window</h4><div class="slots">${I.slots.map(s=>`<button class="dchip${s==CO.slot?" on":""}" data-s="${E(s)}" onclick="CO.slot=this.dataset.s;coRender()"><span style="font-size:14px">${E(s)}</span></button>`).join("")}</div>
  <label>Delivery notes (optional)</label><textarea rows="2" maxlength="200" placeholder="Gate code, landmark, who to ask for…" oninput="CO.notes=this.value">${E(CO.notes)}</textarea></div>`;
};
const coForm=()=>{
  const f=CO.form,F=(k,l,ph,t)=>`<label>${l}</label><input type="${t||"text"}" placeholder="${ph}" value="${E(f[k]||"")}" oninput="CO.form.${k}=this.value">`;
  return `<div class="cc" style="margin-top:8px;background:var(--bg)"><h4>${f.id?"Edit address":"New address"}</h4>${F("label","Label","Home, Work…")}${F("name","Receiver's name","Full name")}${F("phone","Phone number","0244 000 000","tel")}<label>Region</label><select onchange="CO.form.region=this.value">${LOCS.slice(1).map(r=>`<option${(f.region||LOCS[1])==r?" selected":""}>${E(r)}</option>`).join("")}</select>${F("addr","Street, area or landmark","e.g. House 12, Oyarifa Road")}${F("gps","GhanaPost digital address (optional)","GA-123-4567")}<div class="err" id="er"></div><div class="row" style="margin-top:10px">${f.id?'<button class="btn alt" onclick="coDelAddr()">Delete</button>':""}${CO.addrs.length?'<button class="btn alt" onclick="CO.form=null;coRender()">Cancel</button>':""}<button class="btn" onclick="coSaveAddr()">Save address</button></div></div>`;
};
const coAddr=id=>{CO.form=id?{...CO.addrs.find(a=>a.id==id)}:{label:CO.addrs.length?"":"Home",name:user.name,phone:user.phone};coRender()};
async function coSaveAddr(){
  const f=CO.form,r=await api("/api/addresses","POST",{...f,region:f.region||LOCS[1]});if(r.error)return $("er").textContent=r.error;
  CO.addrs=(await api("/api/addresses")).addresses||CO.addrs;CO.addrId=r.id;CO.form=null;coRender();
}
const coDelAddr=()=>ask("Delete this address?","You can add it again later.","Delete",async()=>{const id=CO.form.id;await api("/api/addresses/"+id,"DELETE");CO.addrs=CO.addrs.filter(a=>a.id!=id);CO.addrId=CO.addrs[0]?CO.addrs[0].id:null;CO.form=CO.addrs.length?null:{label:"Home",name:user.name,phone:user.phone};coRender()});
const coPay=(A,rows,sub)=>`<div class="cc"><h4>How would you like to pay?</h4>${payList(sub).map(p=>`<button class="opt${CO.pay==p[0]?" on":""}"${p[4]?" disabled":""} onclick="CO.pay='${p[0]}';coRender()"><span class="rad"></span><div><b>${p[1]} ${p[2]}</b><br><span class="m">${p[4]?(p[0]=="Cash on delivery"?"Only for orders of "+money(RULES.cod)+" or less.":"Not set up yet."):p[3]}</span></div></button>`).join("")}<p class="m" style="font-size:12px">🔒 We never see or store your card details.</p></div>`;
const coReview=(A,rows,sub,fee)=>`<div class="cc"><h4>Review your order</h4>
  <div class="line"><div class="g"><b>📍 Delivery address</b><br><span class="m">${E(A.name)} · ${E(A.phone)}<br>${E(A.addr)}, ${E(A.region)}${A.gps?" · "+E(A.gps):""}</span></div><button class="sm" onclick="coGo(0)">Edit</button></div>
  <div class="line"><div class="g"><b>🕒 Delivery time</b><br><span class="m">${fmtDay(CO.day)}, ${E(CO.slot)}${CO.notes?"<br>Note: "+E(CO.notes):""}</span></div><button class="sm" onclick="coGo(0)">Edit</button></div>
  <div class="line"><div class="g"><b>💳 Payment</b><br><span class="m">${E(CO.pay)}</span></div><button class="sm" onclick="coGo(1)">Edit</button></div>
  <p class="m" style="font-size:12px;margin-top:10px">You will pay ${money(sub+fee)}. You can change the delivery day, time or address from My orders until the order is out for delivery.</p></div>`;
async function coPlace(){
  const b=$("cobtn"),A=CO.addrs.find(x=>x.id==CO.addrId);b.disabled=true;b.textContent="Placing order…";
  const r=await api("/api/orders","POST",{items:Object.entries(cart).map(([id,q])=>({id:+id,q})),address:{name:A.name,phone:A.phone,region:A.region,addr:A.addr,gps:A.gps},day:CO.day,slot:CO.slot,pay:CO.pay,notes:CO.notes});
  if(r.error){b.disabled=false;b.textContent="Place order";return toast(r.error)}
  if(r.online){b.textContent="Opening Paystack…";location.href=r.url;return}
  cart={};S("ws_cart",cart);badges();coClose();
  M(`<div class="ok">✓</div><h3 style="text-align:center">Order placed</h3><p style="text-align:center">Your order number is <b>${E(r.no)}</b>.</p><div class="promise" style="text-align:center">🚚 Arrives <b>${fmtDay(r.dday)}</b>, ${E(r.slot)}</div><p class="m" style="text-align:center">Total ${money(r.total)} (delivery ${money(r.fee)}) · ${E(r.pay)}</p><div class="row"><button class="btn alt" onclick="X()">Keep shopping</button><button class="btn" onclick="account()">Track my order</button></div>`);
}

/* ---- order tracking and editing ---- */
function orderView(no){
  const o=myOrders.find(x=>x.no==no);if(!o)return;
  const steps=["placed","confirmed","out","delivered"],at=steps.indexOf(o.dstatus||"placed"),edit=o.dday&&at<2;
  M(`<h3>Order ${E(o.no)}</h3><div class="tl">${steps.map((s,i)=>`<div class="${i<=at?"dn":""}"><i>${i<=at?"✓":""}</i>${D_LBL[s]}</div>`).join("")}</div>
  ${o.dday?`<div class="promise">🚚 <b>${fmtDay(o.dday)}</b>, ${E(o.slot)}<br><span class="m">${E(o.dname)} · ${E(o.dphone)}<br>${E(o.daddr)}, ${E(o.region)}${o.gps?" · "+E(o.gps):""}${o.notes?"<br>Note: "+E(o.notes):""}</span></div>`:'<p class="m">Delivery details were not recorded for this older order.</p>'}
  <h3 style="margin-top:14px">Items</h3>${o.items.map(i=>`<div class="line"><div class="g">${E(i.t)}<br><span class="m">${money(i.p)} × ${i.q}</span></div><b>${money(i.p*i.q)}</b></div>`).join("")}
  <div class="tot"><span>Delivery</span><span>${money(o.fee||0)}</span></div><div class="tot"><b>Total</b><b>${money(o.total)}</b></div><p class="m">Payment: ${E(o.pay)}${o.status=="paid"?" · paid ✓":""}</p>
  <div class="row"><button class="btn alt" onclick="account()">Back</button>${edit?`<button class="btn" onclick="editDelivery('${E(o.no)}')">Change delivery</button>`:""}</div>`);
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
  const r=await api("/api/orders/"+no+"/delivery","PUT",{address:{name:$("eN").value,phone:$("eP").value,addr:$("eA").value,gps:$("eG").value,notes:$("eT").value},day:$("eD").value,slot:$("eS").value});
  if(r.error)return $("er").textContent=r.error;toast("Delivery details updated");account();
}
async function adminOrders(){
  const r=await api("/api/admin/orders");if(r.error)return toast(r.error);
  const nx={placed:"Confirm",confirmed:"Out for delivery",out:"Mark delivered"};
  M(`<h3>🚚 Deliveries (${r.orders.length})</h3>${r.orders.length?r.orders.map(o=>`<div class="line"><div class="g"><b>${o.dday?fmtDay(o.dday)+", "+E(o.slot):"No date"}</b> <span class="vb">${E(D_LBL[o.dstatus])}</span><br>${E(o.dname||o.uname||"")} · ${E(o.dphone||"")}<br><span class="m">${E(o.daddr||"")}${o.region?", "+E(o.region):""}${o.gps?" · "+E(o.gps):""}${o.notes?"<br>Note: "+E(o.notes):""}<br>${o.items.map(i=>E(i.t)+" ×"+i.q).join(", ")} · ${money(o.total)} · ${E(o.pay)}${o.status=="paid"?" ✓ paid":o.pay=="Cash on delivery"?" · collect cash":""}</span></div><button class="sm" onclick="adminAdv('${E(o.no)}')">${nx[o.dstatus]}</button></div>`).join(""):'<p class="m">No deliveries waiting.</p>'}<div class="row"><button class="btn" onclick="account()">Back</button></div>`);
}
async function adminAdv(no){const r=await api("/api/admin/orders/"+no+"/advance","POST");if(r.error)return toast(r.error);adminOrders()}
