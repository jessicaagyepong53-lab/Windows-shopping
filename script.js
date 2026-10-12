"use strict";
const $=i=>document.getElementById(i);
const E=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=n=>"GH₵ "+Number(n).toLocaleString();
const opts=a=>a.map(x=>`<option>${E(x)}</option>`).join("");
const L=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch{return d}};
const S=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{toast("Storage is full. Use fewer or smaller images.")}};

const CATS=[["Vehicles","🚗",138412],["Property","🏠",28806],["Phones & Tablets","📱",47123],["Electronics","💻",215038],["Home, Furniture & Appliances","🛋️",321924],["Fashion","👗",53381],["Beauty & Personal Care","💄",20112]];
const LOCS=["All Ghana","Greater Accra","Ashanti","Western","Central","Eastern","Volta","Northern"];
const SEED=[
["Toyota Highlander 2008",0,"Ashanti",55000,"Used","🚙",1],["Honda Civic 2009, clean",0,"Greater Accra",38000,"Used","🚗"],
["Toyota Matrix, foreign used",0,"Greater Accra",42000,"Used","🚘"],["Honda Civic Sport 2018",0,"Ashanti",120000,"Used","🏎️",1],
["3 bedroom house to let",1,"Greater Accra",2800,"Used","🏡"],["iPhone 13 128GB",2,"Greater Accra",5200,"Used","📱",1],
["Samsung Galaxy Tab A8",2,"Central",1900,"Brand new","📲"],["HP Laptop 15, 8GB RAM",3,"Ashanti",3400,"Refurbished","💻"],
["55 inch Smart TV",3,"Greater Accra",3900,"Brand new","📺",1],["Sofa set, 5 seater",4,"Western",2500,"Brand new","🛋️"],
["Ankara dress, size M",5,"Volta",180,"Brand new","👗"],["Shea butter gift set",6,"Northern",95,"Brand new","🧴"]
].map((a,i)=>({id:i+1,t:a[0],c:a[1],l:a[2],p:a[3],k:a[4],e:a[5],f:a[6]||0,s:1}));

let ads=L("ws_ads",null)||SEED, cart=L("ws_cart",{}), wish=L("ws_wish",[]), user=L("ws_user",null), users=L("ws_users",[]), orders=L("ws_orders",[]);
let st={cat:-1,list:false,n:8,wl:false}, tmp=[];
const FEE=25;

async function hash(s){
  if(!(window.crypto&&crypto.subtle))return btoa(s);
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function shrink(f){return new Promise(r=>{const i=new Image();i.onload=()=>{const k=Math.min(1,700/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*k;c.height=i.height*k;c.getContext("2d").drawImage(i,0,0,c.width,c.height);r(c.toDataURL("image/jpeg",.7))};i.src=URL.createObjectURL(f)})}
function toast(m){const t=$("toast");t.textContent=m;t.style.display="block";clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display="none",2400)}
const M=h=>{$("mb").innerHTML=h;$("m").classList.add("open")};
const X=()=>$("m").classList.remove("open");
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
  const r=ads.filter(a=>(!st.wl||wish.includes(a.id))&&(st.cat<0||a.c==st.cat)&&(l=="All Ghana"||a.l==l)&&(k=="Any condition"||a.k==k)&&a.p>=mn&&a.p<=mx&&(!q||(a.t+" "+(a.d||"")).toLowerCase().includes(q)));
  if(so=="low")r.sort((a,b)=>a.p-b.p);
  if(so=="high")r.sort((a,b)=>b.p-a.p);
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
  g.innerHTML=r.length?r.slice(0,st.n).map(a=>`<div class="ad${a.f?" feat":""}" onclick="view(${a.id})"><div class="pic" ${bg(a)}>${a.imgs&&a.imgs[0]?"":a.e}${a.f?'<span class="badge">Popular</span>':""}<button class="heart" aria-label="Save" onclick="event.stopPropagation();fav(${a.id})">${wish.includes(a.id)?"♥":"♡"}</button></div><div class="info"><div class="price">${money(a.p)}</div><div class="t">${E(a.t)}</div><div class="m">${E(a.l)} · ${E(a.k)}</div><button class="add" onclick="event.stopPropagation();add(${a.id})">Add to cart</button></div></div>`).join(""):'<div class="empty">No ads match. Try another search, location or price range.</div>';
  $("more").style.display=r.length>st.n?"inline-block":"none";
  badges();
}
const pick=i=>{st.cat=st.cat==i?-1:i;st.n=8;draw()};
function fav(id){wish=wish.includes(id)?wish.filter(x=>x!=id):[...wish,id];S("ws_wish",wish);draw()}
function add(id,d=1){cart[id]=(cart[id]||0)+d;if(cart[id]<=0)delete cart[id];S("ws_cart",cart);badges();toast("Added to cart")}

function view(id){
  const a=ads.find(x=>x.id==id);if(!a)return;
  const im=a.imgs||[];
  const wa=a.ph?`https://wa.me/${a.ph.replace(/\D/g,"").replace(/^0/,"233")}?text=${encodeURIComponent("Hi, is '"+a.t+"' still available?")}`:"";
  M(`<div class="dv" id="dv" ${bg(a)}>${im[0]?"":a.e}</div>
  ${im.length>1?`<div class="thumbs">${im.map(s=>`<img alt="" src="${s}" onclick="$('dv').style.backgroundImage='url('+this.src+')'">`).join("")}</div>`:""}
  <div class="price" style="font-size:22px;margin-top:10px">${money(a.p)}</div>
  <h3>${E(a.t)}</h3><div class="m">${E(CATS[a.c][0])} · ${E(a.l)} · ${E(a.k)}</div>
  <p>${E(a.d||"No description provided.")}</p>
  <div class="row"><button class="btn alt" onclick="fav(${a.id});view(${a.id})">${wish.includes(a.id)?"♥ Saved":"♡ Save"}</button><button class="btn" onclick="add(${a.id})">Add to cart</button></div>
  <div class="row">${wa?`<a class="btn alt" target="_blank" rel="noopener" href="${wa}">Chat on WhatsApp</a>`:`<button class="btn alt" onclick="toast('This is a sample listing')">Contact seller</button>`}${user&&a.o===user.id?`<button class="btn alt" onclick="del(${a.id})">Delete ad</button>`:""}</div>`);
}
function del(id){if(!confirm("Delete this ad?"))return;ads=ads.filter(a=>a.id!=id);delete cart[id];S("ws_ads",ads);S("ws_cart",cart);X();draw()}

function showCart(){
  const rows=Object.entries(cart).map(([id,q])=>({a:ads.find(x=>x.id==id),q})).filter(r=>r.a);
  if(!rows.length)return M('<h3>Your cart</h3><p class="m">Your cart is empty.</p><button class="btn" onclick="X()">Keep shopping</button>');
  const sub=rows.reduce((s,r)=>s+r.a.p*r.q,0);
  M(`<h3>Your cart</h3>${rows.map(r=>`<div class="line"><div class="ic" ${bg(r.a)}>${r.a.imgs&&r.a.imgs[0]?"":r.a.e}</div><div class="g">${E(r.a.t)}<br><b>${money(r.a.p)}</b></div><div class="q"><button onclick="add(${r.a.id},-1);showCart()">−</button> ${r.q} <button onclick="add(${r.a.id});showCart()">+</button></div></div>`).join("")}
  <div class="tot"><span>Subtotal</span><span>${money(sub)}</span></div><div class="tot"><span>Delivery</span><span>${money(FEE)}</span></div><div class="tot"><b>Total</b><b>${money(sub+FEE)}</b></div>
  <div class="row"><button class="btn alt" onclick="X()">Continue</button><button class="btn" onclick="checkout()">Checkout</button></div>`);
}
function checkout(){
  M(`<h3>Checkout</h3><label>Full name</label><input id="cN" value="${E(user?.name)}"><label>Phone (Mobile Money number)</label><input id="cP" type="tel" value="${E(user?.phone)}">
  <label>Region</label><select id="cR">${opts(LOCS.slice(1))}</select><label>Delivery address</label><textarea id="cA" rows="2"></textarea>
  <label>Payment method</label><select id="cM">${opts(["MTN Mobile Money","Telecel Cash","AirtelTigo Money","Cash on delivery","Card (demo)"])}</select>
  <div class="err" id="er"></div><div class="row"><button class="btn alt" onclick="showCart()">Back</button><button class="btn" onclick="placeOrder()">Place order</button></div>`);
}
function placeOrder(){
  const n=$("cN").value.trim(),p=$("cP").value.trim(),a=$("cA").value.trim();
  if(!n||!/^[0-9+\s]{9,15}$/.test(p)||!a)return $("er").textContent="Enter your name, a valid phone number and an address.";
  const items=Object.entries(cart).map(([id,q])=>{const x=ads.find(y=>y.id==id);return x&&{t:x.t,p:x.p,q}}).filter(Boolean);
  const total=items.reduce((s,i)=>s+i.p*i.q,0)+FEE;
  const o={no:"WS"+Date.now().toString().slice(-7),items,total,pay:$("cM").value,to:`${a}, ${$("cR").value}`,date:new Date().toLocaleDateString(),by:user?user.id:null};
  orders.unshift(o);cart={};S("ws_orders",orders);S("ws_cart",cart);badges();
  M(`<h3>Order placed ✅</h3><p>Thank you, ${E(n)}. Your order number is <b>${o.no}</b>.</p><p class="m">Total ${money(total)} · ${E(o.pay)}<br>Delivery to ${E(o.to)}</p><button class="btn" onclick="X()">Done</button>`);
}

function auth(mode,msg=""){
  const reg=mode=="register";
  M(`<h3>${reg?"Create account":"Sign in"}</h3>${msg?`<p class="m">${E(msg)}</p>`:""}${reg?'<label>Full name</label><input id="aN"><label>Phone</label><input id="aP" type="tel">':""}
  <label>Email</label><input id="aE" type="email"><label>Password</label><input id="aW" type="password">
  <div class="err" id="er"></div><div class="row"><button class="btn" onclick="${reg?"doReg()":"doLogin()"}">${reg?"Register":"Sign in"}</button></div>
  <p class="m">${reg?"Have an account?":"New here?"} <button class="link" onclick="auth('${reg?"login":"register"}')">${reg?"Sign in":"Register"}</button></p>
  <p class="m">Accounts are stored in this browser only.</p>`);
}
async function doReg(){
  const n=$("aN").value.trim(),p=$("aP").value.trim(),e=$("aE").value.trim().toLowerCase(),w=$("aW").value;
  if(!n||!e.includes("@")||w.length<6)return $("er").textContent="Enter a name, a valid email and a password of 6 or more characters.";
  if(users.some(u=>u.email==e))return $("er").textContent="That email is already registered.";
  const u={id:Date.now(),name:n,phone:p,email:e,pw:await hash(w)};users.push(u);S("ws_users",users);login(u);
}
async function doLogin(){
  const e=$("aE").value.trim().toLowerCase(),h=await hash($("aW").value),u=users.find(x=>x.email==e&&x.pw==h);
  if(!u)return $("er").textContent="Wrong email or password.";login(u);
}
function login(u){user={id:u.id,name:u.name,phone:u.phone,email:u.email};S("ws_user",user);X();badges();toast("Welcome, "+u.name.split(" ")[0])}
function account(){
  if(!user)return auth("login");
  const mine=orders.filter(o=>o.by===user.id);
  M(`<h3>${E(user.name)}</h3><div class="m">${E(user.email)}</div><h3 style="margin-top:16px">My orders</h3>
  ${mine.length?mine.map(o=>`<div class="line"><div class="g"><b>${o.no}</b> · ${o.date}<br><span class="m">${o.items.map(i=>E(i.t)+" x"+i.q).join(", ")}</span></div><b>${money(o.total)}</b></div>`).join(""):'<p class="m">No orders yet.</p>'}
  <div class="row"><button class="btn alt" onclick="user=null;S('ws_user',null);X();badges()">Sign out</button></div>`);
}

function sell(){
  if(!user)return auth("login","Sign in to post an ad.");
  tmp=[];
  M(`<h3>Post an ad</h3><label>Photos (up to 5)</label><div class="drop" onclick="$('fi').click()">Tap to upload images</div>
  <input type="file" id="fi" accept="image/*" multiple hidden onchange="pics(this)"><div class="thumbs" id="th"></div>
  <label>Title</label><input id="fT" maxlength="80"><label>Category</label><select id="fC">${CATS.map((c,i)=>`<option value="${i}">${E(c[0])}</option>`).join("")}</select>
  <label>Location</label><select id="fL">${opts(LOCS.slice(1))}</select><label>Condition</label><select id="fK">${opts(["Brand new","Used","Refurbished"])}</select>
  <label>Price (GH₵)</label><input id="fP" type="number" min="0"><label>Phone / WhatsApp</label><input id="fH" type="tel" value="${E(user.phone)}">
  <label>Description</label><textarea id="fD" rows="3"></textarea><div class="err" id="er"></div>
  <div class="row"><button class="btn alt" onclick="X()">Cancel</button><button class="btn" onclick="post()">Publish</button></div>`);
}
async function pics(inp){
  for(const f of [...inp.files].slice(0,5-tmp.length))tmp.push(await shrink(f));
  $("th").innerHTML=tmp.map(s=>`<img alt="" src="${s}">`).join("");inp.value="";
}
function post(){
  const t=$("fT").value.trim(),p=$("fP").value,h=$("fH").value.trim();
  if(!t||p===""||+p<0||!h)return $("er").textContent="A title, a price and a contact number are required.";
  ads.unshift({id:Date.now(),t,c:+$("fC").value,l:$("fL").value,p:+p,k:$("fK").value,d:$("fD").value.trim(),ph:h,imgs:tmp,e:"🛍️",f:0,o:user.id});
  S("ws_ads",ads);X();st.cat=-1;st.wl=false;$("q").value="";draw();toast("Your ad is live");
}

const info={
  hb:["How to buy","<p>1. Search or pick a category.<br>2. Open an ad, then chat with the seller on WhatsApp or add it to your cart.<br>3. Check out with Mobile Money or cash on delivery.</p>"],
  hs:["How to sell","<p>1. Create a free account.<br>2. Tap SELL, add clear photos, a price and your phone number.<br>3. Buyers contact you directly. Delete the ad once the item is sold.</p>"],
  ht:["Safety tips","<p>Meet in a public place. Inspect the item before paying. Never send money to someone you have not met. Keep chats on the platform or WhatsApp.</p>"]
};
for(const k in info)$(k).onclick=()=>M(`<h3>${info[k][0]}</h3>${info[k][1]}<button class="btn" onclick="X()">Got it</button>`);

$("loc").innerHTML=opts(LOCS);
["q","loc","so","fk","mn","mx"].forEach(i=>$(i).addEventListener(i=="q"||i=="mn"||i=="mx"?"input":"change",()=>{st.n=8;draw()}));
$("tog").onclick=()=>{st.list=!st.list;draw()};
$("more").onclick=()=>{st.n+=8;draw()};
$("sellB").onclick=sell;$("cartB").onclick=showCart;$("acct").onclick=account;
$("wishB").onclick=()=>{st.wl=!st.wl;st.n=8;draw()};
draw();
