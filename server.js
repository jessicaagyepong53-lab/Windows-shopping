"use strict";
const express=require("express"),Database=require("better-sqlite3"),bcrypt=require("bcryptjs"),crypto=require("crypto"),fs=require("fs"),path=require("path");
let CFG={};
for(const f of ["config.json","config.local.json"])try{CFG={...CFG,...JSON.parse(fs.readFileSync(path.join(__dirname,f),"utf8"))}}catch(e){if(e.code!=="ENOENT")console.log(`⚠️  ${f} has a mistake, so it was IGNORED: `+e.message)}
const PORT=process.env.PORT||3000,FEE=25,DAY=864e5;
const MIN_ORDER=CFG.minOrder??100,COD_MAX=CFG.codMax??100; // checkout rules (GH₵, items only, delivery fee not counted)
const ADMIN_EMAIL=String(process.env.ADMIN_EMAIL||CFG.adminEmail||"").trim().toLowerCase();
const PLANS=CFG.promoPlans||[{id:"d3",days:3,price:20},{id:"d7",days:7,price:40},{id:"d14",days:14,price:70}];
const PAY=process.env.PAY_NUMBER||CFG.payNumber||"",PAYNAME=CFG.payName||"";
const COMPANY=CFG.company||"DealMart",SUPPORT_EMAIL=process.env.SUPPORT_EMAIL||CFG.supportEmail||"",SUPPORT_WA=process.env.SUPPORT_WHATSAPP||CFG.supportWhatsapp||"",SUPPORT_HOURS=CFG.supportHours||"Monday to Saturday, 8am to 6pm";
const COMM=Math.max(0,Math.min(50,Number(CFG.commissionPercent??0)||0)); // % of the item price kept by DealMart
const PROD=process.env.NODE_ENV=="production",MIN_PW=8;
const CANCEL_H=Math.max(0,Number(CFG.cancelHoursBefore??24)||0); // refund policy: orders can only be cancelled (and refunded) this many hours before the delivery window starts, and never once out for delivery

const isValidEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||"").trim());
const RATE_LIMIT=Number(process.env.RATE_LIMIT||CFG.rateLimit||60); // sign-in type requests per 15 minutes per internet address (many people share one address on mobile networks)
const SHOW_SAMPLES=CFG.showSamples!==false; // set "showSamples": false in config.json to hide the demo ads
const isAdmin=u=>!!u&&!!ADMIN_EMAIL&&String(u.email).toLowerCase()===ADMIN_EMAIL;
// delivery: fee per product by unit price (mode "product") or by order total (mode "order"). Edit in config.json under "delivery".
const DEL=CFG.delivery||{mode:"product",perUnit:false,tiers:[{below:100,fee:50},{fee:100}],regionFees:{}};
const SLOTS=CFG.deliverySlots||["8am – 12pm","12pm – 4pm","4pm – 8pm"],DAYS_AHEAD=CFG.deliveryDays||7,NO_DAYS=CFG.noDeliveryWeekdays||[];
const tierFee=x=>{for(const t of DEL.tiers)if(t.below==null||x<t.below)return t.fee;return 0};
const deliveryFee=(items,region)=>(DEL.mode=="order"?tierFee(items.reduce((n,i)=>n+i.p*i.q,0)):items.reduce((n,i)=>n+tierFee(i.p)*(DEL.perUnit?i.q:1),0))+((DEL.regionFees||{})[region]||0);
const ymd=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const freeDays=()=>{const out=[];for(let i=1;out.length<DAYS_AHEAD&&i<45;i++){const d=new Date();d.setDate(d.getDate()+i);if(!NO_DAYS.includes(d.getDay()))out.push(ymd(d))}return out};
const LOCS=["Greater Accra","Ashanti","Western","Central","Eastern","Volta","Northern"],KINDS=["Brand new","Used","Refurbished"];
const PAYS=["Card","Mobile Money","Cash on delivery"];
const DATA=process.env.DATA_DIR||CFG.dataDir||path.join(__dirname,"data"),UP=path.join(DATA,"uploads");fs.mkdirSync(UP,{recursive:true});
const db=new Database(path.join(DATA,"shop.db"));db.pragma("journal_mode=WAL");db.pragma("foreign_keys=ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,email TEXT UNIQUE,pw TEXT,created INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,expires INTEGER);
CREATE TABLE IF NOT EXISTS ads(id INTEGER PRIMARY KEY,owner INTEGER REFERENCES users(id) ON DELETE SET NULL,t TEXT,c INTEGER,l TEXT,p REAL,k TEXT,d TEXT,ph TEXT,imgs TEXT DEFAULT '[]',e TEXT DEFAULT '🛍️',f INTEGER DEFAULT 0,n INTEGER DEFAULT 0,x INTEGER DEFAULT 0,s INTEGER DEFAULT 0,created INTEGER);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,no TEXT,user_id INTEGER,items TEXT,total REAL,pay TEXT,addr TEXT,created INTEGER);
`);
db.exec(`
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY,seller INTEGER REFERENCES users(id) ON DELETE CASCADE,reviewer INTEGER REFERENCES users(id) ON DELETE CASCADE,stars INTEGER,text TEXT,created INTEGER,UNIQUE(seller,reviewer));
CREATE TABLE IF NOT EXISTS item_reviews(id INTEGER PRIMARY KEY,ad_id INTEGER,seller INTEGER,reviewer INTEGER REFERENCES users(id) ON DELETE CASCADE,stars INTEGER,text TEXT,photos TEXT DEFAULT '[]',created INTEGER,UNIQUE(ad_id,reviewer));
CREATE TABLE IF NOT EXISTS bought(user_id INTEGER,ad_id INTEGER,seller INTEGER,created INTEGER,PRIMARY KEY(user_id,ad_id));
CREATE TABLE IF NOT EXISTS votes(review_id INTEGER REFERENCES item_reviews(id) ON DELETE CASCADE,user_id INTEGER,PRIMARY KEY(review_id,user_id));
CREATE TABLE IF NOT EXISTS threads(id INTEGER PRIMARY KEY,ad_id INTEGER,buyer INTEGER REFERENCES users(id) ON DELETE CASCADE,seller INTEGER REFERENCES users(id) ON DELETE CASCADE,deal REAL,created INTEGER,updated INTEGER,UNIQUE(ad_id,buyer));
CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY,thread INTEGER REFERENCES threads(id) ON DELETE CASCADE,sender INTEGER,kind TEXT,body TEXT,amount REAL,status TEXT,created INTEGER,seen INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS promos(id INTEGER PRIMARY KEY,ad_id INTEGER,owner INTEGER,days INTEGER,price REAL,status TEXT,ref TEXT,created INTEGER,starts INTEGER,ends INTEGER);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,ad_id INTEGER,reporter INTEGER,reason TEXT,note TEXT,status TEXT,created INTEGER,UNIQUE(ad_id,reporter));
CREATE TABLE IF NOT EXISTS resets(user_id INTEGER PRIMARY KEY,hash TEXT,expires INTEGER,tries INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS earnings(id INTEGER PRIMARY KEY,order_no TEXT,seller INTEGER,ad_id INTEGER,title TEXT,gross REAL,commission REAL,net REAL,status TEXT DEFAULT 'pending',payout_id INTEGER,created INTEGER,UNIQUE(order_no,ad_id));
CREATE TABLE IF NOT EXISTS payouts(id INTEGER PRIMARY KEY,seller INTEGER,amount REAL,ref TEXT,created INTEGER,by_user INTEGER);
CREATE TABLE IF NOT EXISTS addresses(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,label TEXT,name TEXT,phone TEXT,region TEXT,addr TEXT,gps TEXT);
CREATE TABLE IF NOT EXISTS codes(user_id INTEGER PRIMARY KEY,hash TEXT,expires INTEGER,phone TEXT);
CREATE TABLE IF NOT EXISTS disputes(id INTEGER PRIMARY KEY,order_no TEXT,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,reason TEXT,note TEXT,status TEXT,resolution TEXT,created INTEGER,resolved INTEGER);
CREATE TABLE IF NOT EXISTS push_subs(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,endpoint TEXT UNIQUE,sub TEXT,created INTEGER);
`);
if(!db.prepare("PRAGMA table_info(users)").all().some(c=>c.name=="verified"))db.exec("ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0");
if(!db.prepare("PRAGMA table_info(ads)").all().some(c=>c.name=="attrs"))db.exec("ALTER TABLE ads ADD COLUMN attrs TEXT DEFAULT '{}'");
if(!db.prepare("PRAGMA table_info(ads)").all().some(c=>c.name=="hidden"))db.exec("ALTER TABLE ads ADD COLUMN hidden INTEGER DEFAULT 0");
if(!db.prepare("PRAGMA table_info(ads)").all().some(c=>c.name=="views"))db.exec("ALTER TABLE ads ADD COLUMN views INTEGER DEFAULT 0");
for(const [col,ty] of [["status","TEXT"],["ref","TEXT"],["dname","TEXT"],["dphone","TEXT"],["region","TEXT"],["daddr","TEXT"],["gps","TEXT"],["notes","TEXT"],["dday","TEXT"],["slot","TEXT"],["fee","REAL"],["dstatus","TEXT"],["refund","TEXT"],["refund_ref","TEXT"],["cancel_note","TEXT"],["delivered","INTEGER"]])if(!db.prepare("PRAGMA table_info(orders)").all().some(c=>c.name==col))db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${ty}`);
for(const [col,ty] of [["agreed","INTEGER"],["payout_net","TEXT"],["payout_num","TEXT"],["payout_name","TEXT"]])if(!db.prepare("PRAGMA table_info(users)").all().some(c=>c.name==col))db.exec(`ALTER TABLE users ADD COLUMN ${col} ${ty}`);
if(!db.prepare("SELECT 1 FROM ads LIMIT 1").get()){
  const SEED=[["Toyota Highlander 2008",0,"Ashanti",55000,"Used","🚙",1],["Honda Civic 2009, clean",0,"Greater Accra",38000,"Used","🚗"],["Toyota Matrix, foreign used",0,"Greater Accra",42000,"Used","🚘"],["Honda Civic Sport 2018",0,"Ashanti",120000,"Used","🏎️",1],["3 bedroom house to let",1,"Greater Accra",2800,"Used","🏡"],["iPhone 13 128GB",2,"Greater Accra",5200,"Used","📱",1],["Samsung Galaxy Tab A8",2,"Central",1900,"Brand new","📲"],["HP Laptop 15, 8GB RAM",3,"Ashanti",3400,"Refurbished","💻"],["55 inch Smart TV",3,"Greater Accra",3900,"Brand new","📺",1],["Sofa set, 5 seater",4,"Western",2500,"Brand new","🛋️"],["Ankara dress, size M",5,"Volta",180,"Brand new","👗"],["Shea butter gift set",6,"Northern",95,"Brand new","🧴"]];
  const ins=db.prepare("INSERT INTO ads(t,c,l,p,k,e,f,s,created) VALUES(?,?,?,?,?,?,?,1,?)");
  SEED.forEach((a,i)=>ins.run(a[0],a[1],a[2],a[3],a[4],a[5],a[6]||0,Date.now()-i*1000-DAY));
}
const SAMPLE_EMAIL="sample@windowshopping.local";
let sampleRow=db.prepare("SELECT id FROM users WHERE email=?").get(SAMPLE_EMAIL);
if(!sampleRow)sampleRow={id:Number(db.prepare("INSERT INTO users(name,phone,email,pw,created) VALUES(?,?,?,?,?)").run("SampleShop","",SAMPLE_EMAIL,"!"+crypto.randomBytes(16).toString("hex"),Date.now()).lastInsertRowid)};
const SAMPLE_ID=sampleRow.id;
db.prepare("UPDATE ads SET owner=? WHERE s=1 AND owner IS NULL").run(SAMPLE_ID);
// sample ads use real photos when you add them to public/samples/ (1.jpg, 1-2.jpg, 1-3.jpg, 2.jpg ...); see samples/README.txt
{
  const pub=path.join(__dirname,"public"),upd=db.prepare("UPDATE ads SET imgs=? WHERE id=?");
  db.prepare("SELECT id FROM ads WHERE s=1 ORDER BY id").all().forEach((r,i)=>{
    const found=[];
    for(const suf of ["","-2","-3"])for(const e of ["jpg","jpeg","png","webp"]){const f=`samples/${i+1}${suf}.${e}`;if(fs.existsSync(path.join(pub,f))){found.push("/"+f);break}}
    upd.run(JSON.stringify(found),r.id);
  });
}
function autoReply(t,amt){
  if(t.seller!==SAMPLE_ID)return;const now=Date.now();
  if(amt){
    const ad=db.prepare("SELECT p FROM ads WHERE id=?").get(t.ad_id),m=db.prepare("SELECT id FROM msgs WHERE thread=? AND kind='offer' AND status='pending' ORDER BY id DESC LIMIT 1").get(t.id);
    if(!ad||!m)return;const ok=amt>=ad.p*0.85,label="GH₵ "+Number(amt).toLocaleString();
    db.prepare("UPDATE msgs SET status=? WHERE id=?").run(ok?"accepted":"declined",m.id);
    if(ok)db.prepare("UPDATE threads SET deal=? WHERE id=?").run(amt,t.id);
    db.prepare("INSERT INTO msgs(thread,sender,kind,body,created,seen) VALUES(?,0,'system',?,?,1)").run(t.id,ok?`Offer of ${label} accepted (automatic reply from a sample listing). The buyer can now order at this price.`:`Offer of ${label} declined (automatic reply from a sample listing). Sample sellers accept offers within 15% of the price.`,now);
  }else if(!db.prepare("SELECT 1 FROM msgs WHERE thread=? AND sender=?").get(t.id,SAMPLE_ID))
    db.prepare("INSERT INTO msgs(thread,sender,kind,body,created) VALUES(?,?,'text',?,?)").run(t.id,SAMPLE_ID,"Hi! This is a sample listing, so this reply is automatic. Real sellers will answer you themselves.",now);
}
const PS_SECRET=process.env.PAYSTACK_SECRET_KEY||CFG.paystackSecret||"",PS_BASE=process.env.PAYSTACK_BASE||"https://api.paystack.co";
const SITE=req=>String(process.env.SITE_URL||CFG.siteUrl||req.protocol+"://"+req.get("host")).replace(/\/$/,"");
async function ps(method,p,body){
  try{const r=await fetch(PS_BASE+p,{method,headers:{Authorization:"Bearer "+PS_SECRET,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});return await r.json()}
  catch{return{status:false}}
}
function markPaid(o){
  if(db.prepare("UPDATE orders SET status='paid' WHERE id=? AND status='awaiting_payment'").run(o.id).changes&&o.user_id){
    for(const it of JSON.parse(o.items))if(it.id)db.prepare("INSERT OR IGNORE INTO bought VALUES(?,?,?,?)").run(o.user_id,it.id,it.o??null,Date.now());
    orderAlerts(o);
  }
}
const paidOk=(o,d)=>!!d&&d.status=="success"&&d.reference===o.ref&&d.currency=="GHS"&&d.amount===Math.round(o.total*100);
const FIELDS=[
 [["make","Make","text"],["year","Year","number"],["mileage","Mileage (km)","number"],["trans","Transmission","select",["Manual","Automatic"]],["fuel","Fuel","select",["Petrol","Diesel","Hybrid","Electric"]]],
 [["ptype","Property type","select",["House","Apartment","Land","Commercial"]],["listing","For","select",["Sale","Rent"]],["beds","Bedrooms","number"],["baths","Bathrooms","number"]],
 [["brand","Brand","text"],["model","Model","text"],["storage","Storage","select",["32GB","64GB","128GB","256GB","512GB or more"]]],
 [["brand","Brand","text"],["model","Model","text"],["warranty","Warranty","select",["None","3 months","6 months","1 year or more"]]],
 [["ftype","Item type","text"],["material","Material","text"],["colour","Colour","text"]],
 [["size","Size","text"],["colour","Colour","text"],["for","For","select",["Men","Women","Kids","Unisex"]]],
 [["brand","Brand","text"],["volume","Size / volume","text"]]
];
function cleanAttrs(c,at){
  const out={};at=at&&typeof at=="object"?at:{};
  for(const [k,,type,opts] of FIELDS[c]||[]){
    let v=String(at[k]??"").trim().slice(0,40);if(!v)continue;
    if(type=="number"){v=Number(v);if(!Number.isFinite(v)||v<0||v>1e9)continue}
    else if(type=="select"&&!opts.includes(v))continue;
    out[k]=v;
  }
  return out;
}
let mailer=null;
if((CFG.smtp&&!/example\.com$/.test(CFG.smtp.host||""))||process.env.SMTP_URL){try{mailer=require("nodemailer").createTransport(process.env.SMTP_URL||CFG.smtp)}catch{console.log("Email is configured but the 'nodemailer' package is missing. Run: npm install")}}
async function mail(to,subject,text){
  if(!mailer){console.log(`[EMAIL to ${to}] ${subject}\n${text}\n`);return false}
  try{await mailer.sendMail({from:CFG.mailFrom||process.env.MAIL_FROM||`${COMPANY} <no-reply@localhost>`,to,subject,text});return true}
  catch(e){console.log("Email failed:",e.message);return false}
}
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const cookie=(req,k)=>(req.headers.cookie||"").split(/;\s*/).map(c=>c.split("=")).find(c=>c[0]==k)?.[1];
const startSession=(res,uid)=>{const t=crypto.randomBytes(32).toString("hex");db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(t),uid,Date.now()+30*DAY);
  res.setHeader("Set-Cookie",`sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30*86400}${process.env.NODE_ENV=="production"?"; Secure":""}`)};
const hits=new Map(),limit=(req,res,next)=>{const n=(hits.get(req.ip)||[]).filter(t=>t>Date.now()-9e5);if(n.length>=RATE_LIMIT)return res.status(429).json({error:"Too many attempts. Try again in a few minutes."});n.push(Date.now());hits.set(req.ip,n);next()};
const need=(req,res,next)=>req.user?next():res.status(401).json({error:"Please sign in first."});
const disp=n=>{const p=String(n||"").trim().split(/\s+/);return p.length>1?p[0]+" "+p[p.length-1][0]+".":p[0]};
const shape=r=>({id:r.id,t:r.t,c:r.c,l:r.l,p:r.p,k:r.k,d:r.d||"",ph:r.ph,imgs:JSON.parse(r.imgs||"[]"),e:r.e,f:r.f,n:!!r.n,x:!!r.x,s:!!r.s,o:r.owner,sn:r.sn?disp(r.sn):null,sv:!!r.sv,sa:r.sa||0,sc:r.sc||0,ra:r.ra||0,rn:r.rn||0,at:JSON.parse(r.attrs||"{}"),h:!!r.hidden,pm:!!r.pm});
const AD_SQL=`SELECT a.*,u.name sn,u.verified sv,(SELECT ROUND(AVG(stars),1) FROM item_reviews WHERE seller=a.owner) sa,(SELECT COUNT(*) FROM item_reviews WHERE seller=a.owner) sc,(SELECT ROUND(AVG(stars),1) FROM item_reviews WHERE ad_id=a.id) ra,(SELECT COUNT(*) FROM item_reviews WHERE ad_id=a.id) rn,(SELECT COUNT(*) FROM promos WHERE ad_id=a.id AND status='active' AND ends>CAST(strftime('%s','now') AS INTEGER)*1000) pm FROM ads a LEFT JOIN users u ON u.id=a.owner`;
const getAd=id=>{const r=db.prepare(AD_SQL+" WHERE a.id=?").get(id);return r&&shape(r)};
let webpush=null,VAPID=null;
try{
  webpush=require("web-push");const vf=path.join(DATA,"vapid.json");
  try{VAPID=JSON.parse(fs.readFileSync(vf,"utf8"))}catch{VAPID=webpush.generateVAPIDKeys();fs.writeFileSync(vf,JSON.stringify(VAPID))}
  webpush.setVapidDetails("mailto:"+(isValidEmail(SUPPORT_EMAIL)?SUPPORT_EMAIL:"admin@example.com"),VAPID.publicKey,VAPID.privateKey);
}catch(e){webpush=null;console.log("Phone alerts are off. Run: npm install")}
function push(uid,title,body){
  if(!webpush)return;
  for(const r of db.prepare("SELECT id,sub FROM push_subs WHERE user_id=?").all(uid))
    webpush.sendNotification(JSON.parse(r.sub),JSON.stringify({title,body:String(body).slice(0,180),url:"/"}),{TTL:86400}).catch(e=>{if(e.statusCode==404||e.statusCode==410)db.prepare("DELETE FROM push_subs WHERE id=?").run(r.id)});
}
const SITE_BASE=()=>String(process.env.SITE_URL||CFG.siteUrl||"http://localhost:"+PORT).replace(/\/$/,"");
const notifyAt=new Map();
// Email always (when the user has a real email); SMS only when o.sms. o.key+o.every throttles repeats. Never blocks or throws.
function notify(uid,subject,text,o={}){
  try{
    if(!uid||uid===SAMPLE_ID)return;
    if(o.key){const k=uid+":"+o.key;if(Date.now()-(notifyAt.get(k)||0)<(o.every||6e5))return;notifyAt.set(k,Date.now())}
    push(uid,subject,text);
    const u=db.prepare("SELECT name,email,phone FROM users WHERE id=?").get(uid);if(!u)return;
    if(u.email&&!u.email.endsWith(".local"))mail(u.email,subject,`Hi ${String(u.name||"there").split(" ")[0]},\n\n${text}\n\n${COMPANY}\n${SITE_BASE()}`).catch(()=>{});
    if(o.sms&&u.phone)sms(u.phone,subject+": "+text);
  }catch(e){console.log("Notify failed:",e.message)}
}
function orderAlerts(o){
  const when=o.dday?` Delivery: ${o.dday}, ${o.slot}.`:"",by={};
  notify(o.user_id,`Order ${o.no} confirmed`,`Thanks for your order ${o.no} (GH₵ ${Number(o.total).toLocaleString()}).${when} You can track it under My orders.`,{sms:true});
  for(const it of JSON.parse(o.items))if(it.o)(by[it.o]=by[it.o]||[]).push(it.t+" x"+it.q);
  for(const [sid,l] of Object.entries(by))notify(+sid,`New order ${o.no}`,`You have a new order: ${l.join(", ")}. Please get it ready for delivery.${when}`,{sms:true});
}
const sms=(to,msg)=>console.log(`[SMS to ${to}] ${msg}`); // TODO: replace with a real SMS provider (Hubtel, Twilio...) when going live

function saveImgs(list,keep){
  const out=[];
  for(const s of (Array.isArray(list)?list:[]).slice(0,5)){
    if(typeof s!="string")continue;
    const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(s);
    if(m){const buf=Buffer.from(m[2],"base64");if(buf.length>2e6)continue;
      const name=crypto.randomBytes(12).toString("hex")+"."+(m[1]=="jpeg"?"jpg":m[1]);fs.writeFileSync(path.join(UP,name),buf);out.push("/uploads/"+name)}
    else if(keep.includes(s))out.push(s);
  }
  return out;
}
const rmImgs=l=>l.forEach(u=>{try{fs.unlinkSync(path.join(UP,path.basename(u)))}catch{}});
function clean(b){
  const t=String(b.t||"").trim().slice(0,80),p=Number(b.p),ph=String(b.ph||"").trim(),c=Number(b.c);
  if(t.length<3)return"Enter a title of at least 3 characters.";
  if(!(p>=0&&p<1e9))return"Enter a valid price.";
  if(!/^[0-9+\s]{9,15}$/.test(ph))return"Enter a valid phone number.";
  if(!Number.isInteger(c)||c<0||c>6)return"Pick a category.";
  return{t,c,p,ph,l:LOCS.includes(b.l)?b.l:LOCS[0],k:KINDS.includes(b.k)?b.k:"Used",d:String(b.d||"").trim().slice(0,500),n:b.n?1:0,at:JSON.stringify(cleanAttrs(c,b.at))};
}

const app=express();
app.disable("x-powered-by");
if(PROD)app.set("trust proxy",1);
app.use((req,res,next)=>{
  if(PROD&&req.headers["x-forwarded-proto"]==="http")return res.redirect(301,"https://"+req.headers.host+req.originalUrl);
  res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","same-origin");res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=(self)");
  res.setHeader("Content-Security-Policy","default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
  if(req.secure)res.setHeader("Strict-Transport-Security","max-age=15552000");
  next();
});
app.get("/healthz",(req,res)=>res.json({ok:true}));
app.use(express.json({limit:"12mb",verify:(req,res,buf)=>{req.raw=buf}}));
app.use((req,res,next)=>{req.user=null;const t=cookie(req,"sid");
  if(t)req.user=db.prepare("SELECT u.id,u.name,u.phone,u.email,u.verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?").get(sha(t),Date.now())||null;next()});

app.post("/api/register",limit,(req,res)=>{
  const b=req.body||{},name=String(b.name||"").trim().slice(0,60),email=String(b.email||"").trim().toLowerCase().slice(0,120),phone=String(b.phone||"").trim().slice(0,20),pw=String(b.password||"");
  if(b.agree!==true)return res.status(400).json({error:"Please tick the box to accept the Terms and Privacy Policy."});
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||pw.length<MIN_PW)return res.status(400).json({error:`Enter a name, a valid email and a password of ${MIN_PW} or more characters.`});
  if(db.prepare("SELECT 1 FROM users WHERE email=?").get(email))return res.status(409).json({error:"That email is already registered."});
  const id=Number(db.prepare("INSERT INTO users(name,phone,email,pw,created,agreed) VALUES(?,?,?,?,?,?)").run(name,phone,email,bcrypt.hashSync(pw,10),Date.now(),Date.now()).lastInsertRowid);
  startSession(res,id);res.json({user:{id,name,phone,email,verified:false,admin:isAdmin({email})}});
});
const loginFails=new Map(),forgotHits=new Map();
app.post("/api/login",limit,(req,res)=>{
  const b=req.body||{},em=String(b.email||"").trim().toLowerCase(),u=db.prepare("SELECT * FROM users WHERE email=?").get(em);
  const recent=(loginFails.get(em)||[]).filter(t=>t>Date.now()-9e5);
  if(recent.length>=8)return res.status(429).json({error:"Too many wrong attempts on this account. Wait 15 minutes, or use Forgot password."});
  if(!u||!bcrypt.compareSync(String(b.password||""),u.pw)){recent.push(Date.now());loginFails.set(em,recent);return res.status(401).json({error:"Wrong email or password."})}
  loginFails.delete(em);
  startSession(res,u.id);res.json({user:{id:u.id,name:u.name,phone:u.phone,email:u.email,verified:!!u.verified,admin:isAdmin(u)}});
});
app.post("/api/logout",(req,res)=>{const t=cookie(req,"sid");if(t)db.prepare("DELETE FROM sessions WHERE token=?").run(sha(t));res.setHeader("Set-Cookie","sid=; Max-Age=0; Path=/");res.json({ok:true})});
app.get("/api/me",(req,res)=>res.json({user:req.user&&{...req.user,verified:!!req.user.verified,admin:isAdmin(req.user)}}));

app.get("/api/ads",(req,res)=>res.json({ads:db.prepare(AD_SQL+" WHERE (a.x=0 AND a.hidden=0"+(SHOW_SAMPLES?"":" AND a.s=0")+") OR a.owner=? ORDER BY pm DESC,a.created DESC").all(req.user?.id??-1).map(shape)}));
app.post("/api/ads",need,(req,res)=>{
  const d=clean(req.body||{});if(typeof d=="string")return res.status(400).json({error:d});
  const imgs=saveImgs(req.body.imgs,[]);
  const id=Number(db.prepare("INSERT INTO ads(owner,t,c,l,p,k,d,ph,imgs,n,attrs,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(req.user.id,d.t,d.c,d.l,d.p,d.k,d.d,d.ph,JSON.stringify(imgs),d.n,d.at,Date.now()).lastInsertRowid);
  res.json({ad:getAd(id)});
});
app.put("/api/ads/:id",need,(req,res)=>{
  const a=getAd(+req.params.id);if(!a||a.o!==req.user.id)return res.status(404).json({error:"Ad not found."});
  const d=clean(req.body||{});if(typeof d=="string")return res.status(400).json({error:d});
  const imgs=saveImgs(req.body.imgs,a.imgs);rmImgs(a.imgs.filter(u=>!imgs.includes(u)));
  db.prepare("UPDATE ads SET t=?,c=?,l=?,p=?,k=?,d=?,ph=?,imgs=?,n=?,attrs=? WHERE id=?").run(d.t,d.c,d.l,d.p,d.k,d.d,d.ph,JSON.stringify(imgs),d.n,d.at,a.id);
  res.json({ad:getAd(a.id)});
});
app.post("/api/ads/:id/sold",need,(req,res)=>{
  const a=getAd(+req.params.id);if(!a||a.o!==req.user.id)return res.status(404).json({error:"Ad not found."});
  db.prepare("UPDATE ads SET x=? WHERE id=?").run(a.x?0:1,a.id);res.json({ad:getAd(a.id)});
});
app.delete("/api/ads/:id",need,(req,res)=>{
  const a=getAd(+req.params.id);if(!a||a.o!==req.user.id)return res.status(404).json({error:"Ad not found."});
  rmImgs(a.imgs);db.prepare("DELETE FROM ads WHERE id=?").run(a.id);res.json({ok:true});
});

function cleanAddr(b){
  b=b&&typeof b=="object"?b:{};
  const name=String(b.name||"").trim().slice(0,60),phone=String(b.phone||"").trim(),region=String(b.region||""),addr=String(b.addr||"").trim().slice(0,160),gps=String(b.gps||"").trim().toUpperCase().slice(0,14),notes=String(b.notes||"").trim().slice(0,200);
  if(!name)return"Enter the receiver's name.";
  if(!/^[0-9+\s]{9,15}$/.test(phone))return"Enter a valid phone number.";
  if(!LOCS.includes(region))return"Choose a region.";
  if(addr.length<3)return"Enter a delivery address.";
  if(gps&&!/^[A-Z]{2,3}-?\d{3,4}-?\d{4}$/.test(gps))return"The GhanaPost digital address looks wrong. Example: GA-123-4567.";
  return{name,phone,region,addr,gps,notes};
}
app.post("/api/orders",need,async(req,res)=>{
  const b=req.body||{},ad=cleanAddr(b.address);
  if(typeof ad=="string")return res.status(400).json({error:ad});
  if(!freeDays().includes(b.day))return res.status(400).json({error:"Choose a delivery day."});
  if(!SLOTS.includes(b.slot))return res.status(400).json({error:"Choose a delivery time."});
  if(!PAYS.includes(b.pay))return res.status(400).json({error:"Choose a payment method."});
  const get=db.prepare("SELECT id,owner,t,p FROM ads WHERE id=? AND x=0 AND hidden=0"),dl=db.prepare("SELECT deal FROM threads WHERE ad_id=? AND buyer=? AND deal IS NOT NULL"),items=[],buy=[];
  for(const it of Array.isArray(b.items)?b.items.slice(0,50):[]){
    const a=get.get(+it.id),q=Math.min(Math.max(parseInt(it.q)||0,0),99);
    if(a&&q){const d=dl.get(a.id,req.user.id);items.push({t:a.t,p:d?d.deal:a.p,q,id:a.id,o:a.owner});buy.push([a.id,a.owner])}
  }
  if(!items.length)return res.status(400).json({error:"Your cart has no items that are still available."});
  const sub=items.reduce((n,i)=>n+i.p*i.q,0),fee=deliveryFee(items,ad.region),total=sub+fee,no="WS"+Date.now().toString().slice(-7),pay=b.pay;
  if(sub<MIN_ORDER)return res.status(400).json({error:`The minimum order is GH₵ ${MIN_ORDER} (items only, not counting delivery). Add GH₵ ${(MIN_ORDER-sub).toLocaleString()} more to check out.`});
  if(pay=="Cash on delivery"&&sub>COD_MAX)return res.status(400).json({error:`Cash on delivery is only available for orders of GH₵ ${COD_MAX} or less. Please choose Mobile Money or card.`});
  const online=pay!=="Cash on delivery";
  if(online&&!PS_SECRET)return res.status(400).json({error:"Online payments are not set up yet. Please choose another method or try again later."});
  const ref=online?"ws_"+crypto.randomBytes(10).toString("hex"):null,notes=String(b.notes||ad.notes||"").trim().slice(0,200);
  const oid=Number(db.prepare("INSERT INTO orders(no,user_id,items,total,pay,addr,created,status,ref,dname,dphone,region,daddr,gps,notes,dday,slot,fee,dstatus) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(no,req.user.id,JSON.stringify(items),total,pay,`${ad.addr}, ${ad.region}`,Date.now(),online?"awaiting_payment":"placed",ref,ad.name,ad.phone,ad.region,ad.addr,ad.gps,notes,b.day,b.slot,fee,"placed").lastInsertRowid);
  if(!online){
    for(const [aid,ow] of buy)db.prepare("INSERT OR IGNORE INTO bought VALUES(?,?,?,?)").run(req.user.id,aid,ow,Date.now());
    orderAlerts({no,user_id:req.user.id,items:JSON.stringify(items),total,dday:b.day,slot:b.slot});
    return res.json({no,total,fee,pay,dday:b.day,slot:b.slot});
  }
  const j=await ps("POST","/transaction/initialize",{email:req.user.email,amount:Math.round(total*100),currency:"GHS",reference:ref,callback_url:SITE(req)+"/",channels:[pay=="Card"?"card":"mobile_money"],metadata:{order:no}});
  if(!j.status||!j.data){db.prepare("DELETE FROM orders WHERE id=?").run(oid);return res.status(502).json({error:"Could not start the payment. Please try again."})}
  res.json({no,total,fee,pay,dday:b.day,slot:b.slot,online:true,url:j.data.authorization_url});
});
app.get("/api/orders",need,(req,res)=>res.json({orders:db.prepare("SELECT * FROM orders WHERE user_id=? AND (status IS NULL OR status!='awaiting_payment') ORDER BY created DESC").all(req.user.id).map(o=>({no:o.no,items:JSON.parse(o.items),total:o.total,fee:o.fee,pay:o.pay,created:o.created,status:o.status,refund:o.refund||"",delivered:o.delivered||null,dispute:dispOf(o.no,req.user.id),cancelBy:cancelBy(o),cancelHours:CANCEL_H,dstatus:o.dstatus||"placed",dday:o.dday,slot:o.slot,dname:o.dname,dphone:o.dphone,region:o.region,daddr:o.daddr,gps:o.gps,notes:o.notes}))}));

app.post("/api/verify/send",need,limit,(req,res)=>{
  const ph=String((req.body||{}).phone||req.user.phone||"").trim();
  if(!/^[0-9+\s]{9,15}$/.test(ph))return res.status(400).json({error:"Enter a valid phone number."});
  const code=String(crypto.randomInt(100000,1000000));
  db.prepare("INSERT OR REPLACE INTO codes VALUES(?,?,?,?)").run(req.user.id,sha(code),Date.now()+10*60000,ph);
  sms(ph,`Your DealMart code is ${code}`);res.json({ok:true,dev:!process.env.SMS_LIVE});
});
app.post("/api/verify/check",need,limit,(req,res)=>{
  const c=db.prepare("SELECT * FROM codes WHERE user_id=?").get(req.user.id);
  if(!c||c.expires<Date.now())return res.status(400).json({error:"That code has expired. Request a new one."});
  if(c.hash!==sha(String((req.body||{}).code||"").trim()))return res.status(400).json({error:"Wrong code. Please try again."});
  db.prepare("UPDATE users SET phone=?,verified=1 WHERE id=?").run(c.phone,req.user.id);db.prepare("DELETE FROM codes WHERE user_id=?").run(req.user.id);
  res.json({user:{id:req.user.id,name:req.user.name,phone:c.phone,email:req.user.email,verified:true,admin:isAdmin(req.user)}});
});
app.get("/api/sellers/:id",(req,res)=>{
  const u=db.prepare("SELECT id,name,created,verified FROM users WHERE id=?").get(+req.params.id);if(!u)return res.status(404).json({error:"Seller not found."});
  const st=db.prepare("SELECT ROUND(AVG(stars),1) avg,COUNT(*) n FROM item_reviews WHERE seller=?").get(u.id);
  const reviews=db.prepare("SELECT r.stars,r.text,r.photos,r.created,n.name,a.t title FROM item_reviews r JOIN users n ON n.id=r.reviewer LEFT JOIN ads a ON a.id=r.ad_id WHERE r.seller=? ORDER BY r.created DESC LIMIT 30").all(u.id).map(r=>({stars:r.stars,text:r.text||"",photos:JSON.parse(r.photos),created:r.created,name:disp(r.name),title:r.title||"Removed item"}));
  const ads=db.prepare(AD_SQL+" WHERE a.owner=? AND a.x=0 AND a.hidden=0 ORDER BY a.created DESC").all(u.id).map(shape);
  res.json({seller:{id:u.id,name:disp(u.name),since:u.created,verified:!!u.verified,avg:st.avg||0,n:st.n,ads},reviews});
});
app.get("/api/ads/:id/reviews",(req,res)=>{
  const id=+req.params.id,uid=req.user?.id??-1;
  const list=db.prepare("SELECT r.*,n.name,(SELECT COUNT(*) FROM votes WHERE review_id=r.id) h,(SELECT COUNT(*) FROM votes WHERE review_id=r.id AND user_id=?) v FROM item_reviews r JOIN users n ON n.id=r.reviewer WHERE r.ad_id=? ORDER BY h DESC,r.created DESC LIMIT 100").all(uid,id)
    .map(r=>({id:r.id,stars:r.stars,text:r.text||"",photos:JSON.parse(r.photos),created:r.created,name:disp(r.name),helpful:r.h,voted:!!r.v,mine:r.reviewer===uid}));
  const n=list.length,ad=db.prepare("SELECT owner FROM ads WHERE id=?").get(id);
  const canReview=!!req.user&&!!ad&&ad.owner!==uid&&!!db.prepare("SELECT 1 FROM bought WHERE user_id=? AND ad_id=?").get(uid,id);
  res.json({summary:{n,avg:n?Math.round(list.reduce((t,r)=>t+r.stars,0)/n*10)/10:0,counts:[1,2,3,4,5].map(i=>list.filter(r=>r.stars==i).length),photos:list.filter(r=>r.photos.length).length},reviews:list,canReview,mine:list.find(r=>r.mine)||null});
});
app.post("/api/ads/:id/reviews",need,limit,(req,res)=>{
  const id=+req.params.id,b=req.body||{},stars=parseInt(b.stars),text=String(b.text||"").trim().slice(0,300);
  const ad=db.prepare("SELECT owner FROM ads WHERE id=?").get(id);if(!ad)return res.status(404).json({error:"Item not found."});
  if(ad.owner===req.user.id||!db.prepare("SELECT 1 FROM bought WHERE user_id=? AND ad_id=?").get(req.user.id,id))return res.status(403).json({error:"Only people who bought this item through DealMart can review it."});
  if(!(stars>=1&&stars<=5))return res.status(400).json({error:"Tap a star to rate."});
  const old=db.prepare("SELECT photos FROM item_reviews WHERE ad_id=? AND reviewer=?").get(id,req.user.id),keep=old?JSON.parse(old.photos):[];
  const photos=saveImgs((Array.isArray(b.photos)?b.photos:[]).slice(0,3),keep);rmImgs(keep.filter(u=>!photos.includes(u)));
  db.prepare("INSERT INTO item_reviews(ad_id,seller,reviewer,stars,text,photos,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(ad_id,reviewer) DO UPDATE SET stars=excluded.stars,text=excluded.text,photos=excluded.photos,created=excluded.created").run(id,ad.owner,req.user.id,stars,text,JSON.stringify(photos),Date.now());
  res.json({ok:true});
});
app.post("/api/reviews/:id/helpful",need,(req,res)=>{
  const id=+req.params.id,r=db.prepare("SELECT reviewer FROM item_reviews WHERE id=?").get(id);
  if(!r)return res.status(404).json({error:"Review not found."});if(r.reviewer===req.user.id)return res.status(400).json({error:"You cannot vote on your own review."});
  if(db.prepare("SELECT 1 FROM votes WHERE review_id=? AND user_id=?").get(id,req.user.id))db.prepare("DELETE FROM votes WHERE review_id=? AND user_id=?").run(id,req.user.id);
  else db.prepare("INSERT INTO votes VALUES(?,?)").run(id,req.user.id);
  res.json({ok:true});
});
app.get("/api/fields",(req,res)=>res.json({fields:FIELDS,rules:{min:MIN_ORDER,cod:COD_MAX,fee:FEE,online:!!PS_SECRET}}));
const chatLimit=(()=>{const h=new Map();return(req,res,next)=>{const k=req.user.id,n=(h.get(k)||[]).filter(t=>t>Date.now()-6e4);if(n.length>=30)return res.status(429).json({error:"Slow down a little. Try again in a minute."});n.push(Date.now());h.set(k,n);next()}})();
const myThread=(req,res)=>{const t=db.prepare("SELECT * FROM threads WHERE id=?").get(+req.params.id);if(!t||(t.buyer!==req.user.id&&t.seller!==req.user.id)){res.status(404).json({error:"Conversation not found."});return null}return t};
app.post("/api/threads",need,chatLimit,(req,res)=>{
  const ad=db.prepare("SELECT id,owner FROM ads WHERE id=?").get(+(req.body||{}).adId);
  if(!ad)return res.status(404).json({error:"Item not found."});
  if(!ad.owner)return res.status(400).json({error:"This is a sample listing, so there is no seller to message."});
  if(ad.owner===req.user.id)return res.status(400).json({error:"This is your own ad."});
  const now=Date.now();db.prepare("INSERT OR IGNORE INTO threads(ad_id,buyer,seller,created,updated) VALUES(?,?,?,?,?)").run(ad.id,req.user.id,ad.owner,now,now);
  res.json({id:db.prepare("SELECT id FROM threads WHERE ad_id=? AND buyer=?").get(ad.id,req.user.id).id});
});
app.get("/api/threads",need,(req,res)=>{
  const u=req.user.id,rows=db.prepare(`SELECT t.id,t.updated,a.t title,o.name oname,(SELECT body FROM msgs WHERE thread=t.id ORDER BY id DESC LIMIT 1) last,(SELECT kind FROM msgs WHERE thread=t.id ORDER BY id DESC LIMIT 1) lk,(SELECT COUNT(*) FROM msgs WHERE thread=t.id AND sender!=? AND seen=0 AND kind!='system') unread FROM threads t LEFT JOIN ads a ON a.id=t.ad_id JOIN users o ON o.id=(CASE WHEN t.buyer=? THEN t.seller ELSE t.buyer END) WHERE t.buyer=? OR t.seller=? ORDER BY t.updated DESC`).all(u,u,u,u);
  const threads=rows.map(r=>({id:r.id,title:r.title||"Removed item",name:disp(r.oname),last:r.lk=="offer"?"🏷️ Offer":r.last||"",unread:r.unread,updated:r.updated}));
  res.json({threads,unread:threads.reduce((n,t)=>n+t.unread,0)});
});
app.get("/api/threads/:id",need,(req,res)=>{
  const t=myThread(req,res);if(!t)return;const u=req.user.id;
  db.prepare("UPDATE msgs SET seen=1 WHERE thread=? AND sender!=?").run(t.id,u);
  const ad=db.prepare("SELECT id,t,p,x FROM ads WHERE id=?").get(t.ad_id)||null,o=db.prepare("SELECT id,name,verified FROM users WHERE id=?").get(t.buyer===u?t.seller:t.buyer);
  const msgs=db.prepare("SELECT * FROM msgs WHERE thread=? ORDER BY id").all(t.id).map(m=>({id:m.id,mine:m.sender===u,kind:m.kind,body:m.body||"",amount:m.amount,status:m.status,created:m.created}));
  res.json({thread:{id:t.id,ad,other:{id:o.id,name:disp(o.name),verified:!!o.verified},deal:t.deal,iBuy:t.buyer===u},msgs});
});
app.post("/api/threads/:id/messages",need,chatLimit,(req,res)=>{
  const t=myThread(req,res);if(!t)return;const b=req.body||{},now=Date.now();
  if(b.offer!=null){
    const amt=Number(b.offer);if(!(amt>0&&amt<1e9))return res.status(400).json({error:"Enter a valid offer amount."});
    db.prepare("UPDATE msgs SET status='void' WHERE thread=? AND kind='offer' AND status='pending'").run(t.id);
    db.prepare("INSERT INTO msgs(thread,sender,kind,amount,status,created) VALUES(?,?,'offer',?,'pending',?)").run(t.id,req.user.id,amt,now);
  }else{
    const body=String(b.body||"").trim().slice(0,500);if(!body)return res.status(400).json({error:"Type a message first."});
    db.prepare("INSERT INTO msgs(thread,sender,kind,body,created) VALUES(?,?,'text',?,?)").run(t.id,req.user.id,body,now);
  }
  autoReply(t,b.offer!=null?Number(b.offer):0);
  {const to=t.buyer===req.user.id?t.seller:t.buyer,ttl=(db.prepare("SELECT t FROM ads WHERE id=?").get(t.ad_id)||{}).t||"an item";
  if(b.offer!=null)notify(to,"New offer on "+ttl,`${disp(req.user.name)} offered GH₵ ${Number(b.offer).toLocaleString()} for "${ttl}". Open ${COMPANY} and tap the Messages icon to accept or decline.`,{sms:true});
  else notify(to,"New message about "+ttl,`${disp(req.user.name)} sent you a message about "${ttl}". Open ${COMPANY} and tap the Messages icon to reply.`,{key:"m"+t.id,every:6e5})}
  db.prepare("UPDATE threads SET updated=? WHERE id=?").run(now,t.id);res.json({ok:true});
});
app.post("/api/messages/:id/respond",need,chatLimit,(req,res)=>{
  const m=db.prepare("SELECT * FROM msgs WHERE id=? AND kind='offer'").get(+req.params.id),t=m&&db.prepare("SELECT * FROM threads WHERE id=?").get(m.thread);
  if(!t||(t.buyer!==req.user.id&&t.seller!==req.user.id))return res.status(404).json({error:"Offer not found."});
  if(m.sender===req.user.id||m.status!=="pending")return res.status(400).json({error:"This offer cannot be answered."});
  const ok=!!(req.body||{}).accept,now=Date.now(),amt="GH₵ "+Number(m.amount).toLocaleString();
  db.prepare("UPDATE msgs SET status=? WHERE id=?").run(ok?"accepted":"declined",m.id);
  if(ok)db.prepare("UPDATE threads SET deal=? WHERE id=?").run(m.amount,t.id);
  db.prepare("INSERT INTO msgs(thread,sender,kind,body,created,seen) VALUES(?,0,'system',?,?,1)").run(t.id,ok?`Offer of ${amt} accepted. The buyer can now order at this price.`:`Offer of ${amt} declined.`,now);
  db.prepare("UPDATE threads SET updated=? WHERE id=?").run(now,t.id);{const ttl=(db.prepare("SELECT t FROM ads WHERE id=?").get(t.ad_id)||{}).t||"an item";
  notify(m.sender,`Offer ${ok?"accepted":"declined"}`,`Your offer of ${amt} on "${ttl}" was ${ok?"accepted. You can now order at this price.":"declined."}`,{sms:true})}
  res.json({ok:true});
});
app.get("/api/deals",need,(req,res)=>{const d={};for(const r of db.prepare("SELECT ad_id,deal FROM threads WHERE buyer=? AND deal IS NOT NULL").all(req.user.id))d[r.ad_id]=r.deal;res.json({deals:d})});
const REASONS=["Scam or fraud","Prohibited item","Wrong category","Duplicate ad","Offensive content","Other"];
const adm=(req,res,next)=>isAdmin(req.user)?next():res.status(403).json({error:"Admins only."});
app.get("/api/promo/plans",(req,res)=>res.json({plans:PLANS,pay:{number:PAY,name:PAYNAME}}));
app.get("/api/promos/mine",need,(req,res)=>{const o={};for(const r of db.prepare("SELECT * FROM promos WHERE owner=? ORDER BY id").all(req.user.id))o[r.ad_id]={status:r.status=="active"&&r.ends<Date.now()?"expired":r.status,ends:r.ends};res.json({promos:o})});
app.post("/api/ads/:id/promote",need,limit,(req,res)=>{
  const id=+req.params.id,b=req.body||{},plan=PLANS.find(p=>p.id==b.plan),ref=String(b.ref||"").trim().slice(0,40),ad=getAd(id);
  if(!ad||ad.o!==req.user.id)return res.status(404).json({error:"Ad not found."});
  if(ad.x||ad.h)return res.status(400).json({error:"Only live ads can be promoted."});
  if(!plan)return res.status(400).json({error:"Choose a promotion plan."});
  if(ref.length<4)return res.status(400).json({error:"Enter the Mobile Money transaction ID from your payment."});
  if(db.prepare("SELECT 1 FROM promos WHERE ad_id=? AND status='pending'").get(id))return res.status(400).json({error:"This ad already has a promotion waiting for approval."});
  db.prepare("INSERT INTO promos(ad_id,owner,days,price,status,ref,created) VALUES(?,?,?,?,'pending',?,?)").run(id,req.user.id,plan.days,plan.price,ref,Date.now());
  res.json({ok:true});
});
app.post("/api/ads/:id/report",need,chatLimit,(req,res)=>{
  const id=+req.params.id,b=req.body||{},ad=db.prepare("SELECT owner FROM ads WHERE id=?").get(id);
  if(!ad)return res.status(404).json({error:"Ad not found."});if(ad.owner===req.user.id)return res.status(400).json({error:"This is your own ad."});
  if(!REASONS.includes(b.reason))return res.status(400).json({error:"Choose a reason."});
  if(db.prepare("SELECT 1 FROM reports WHERE ad_id=? AND reporter=?").get(id,req.user.id))return res.status(400).json({error:"You have already reported this ad. Thank you."});
  db.prepare("INSERT INTO reports(ad_id,reporter,reason,note,status,created) VALUES(?,?,?,?,'open',?)").run(id,req.user.id,b.reason,String(b.note||"").trim().slice(0,300),Date.now());
  if(db.prepare("SELECT COUNT(*) n FROM reports WHERE ad_id=? AND status='open'").get(id).n>=5)db.prepare("UPDATE ads SET hidden=1 WHERE id=?").run(id);
  res.json({ok:true});
});
app.get("/api/admin/queue",need,adm,(req,res)=>res.json({
  promos:db.prepare("SELECT p.id,p.days,p.price,p.ref,p.created,a.t title,u.name uname FROM promos p JOIN ads a ON a.id=p.ad_id JOIN users u ON u.id=p.owner WHERE p.status='pending' ORDER BY p.id").all(),
  reports:db.prepare("SELECT r.id,r.ad_id,r.reason,r.note,r.created,a.t title,a.hidden hidden,(SELECT COUNT(*) FROM reports WHERE ad_id=r.ad_id AND status='open') n FROM reports r JOIN ads a ON a.id=r.ad_id WHERE r.status='open' ORDER BY r.ad_id,r.id").all()}));
app.post("/api/admin/promos/:id",need,adm,(req,res)=>{
  const p=db.prepare("SELECT * FROM promos WHERE id=? AND status='pending'").get(+req.params.id);if(!p)return res.status(404).json({error:"Request not found."});
  if((req.body||{}).approve){const now=Date.now();db.prepare("UPDATE promos SET status='active',starts=?,ends=? WHERE id=?").run(now,now+p.days*DAY,p.id)}
  else db.prepare("UPDATE promos SET status='rejected' WHERE id=?").run(p.id);
  res.json({ok:true});
});
app.post("/api/admin/reports/:id",need,adm,(req,res)=>{
  const r=db.prepare("SELECT * FROM reports WHERE id=?").get(+req.params.id);if(!r)return res.status(404).json({error:"Report not found."});
  const act=(req.body||{}).action;
  if(act=="hide"){db.prepare("UPDATE ads SET hidden=1 WHERE id=?").run(r.ad_id);db.prepare("UPDATE reports SET status='actioned' WHERE ad_id=? AND status='open'").run(r.ad_id)}
  else if(act=="restore"){db.prepare("UPDATE ads SET hidden=0 WHERE id=?").run(r.ad_id);db.prepare("UPDATE reports SET status='dismissed' WHERE ad_id=? AND status='open'").run(r.ad_id)}
  else db.prepare("UPDATE reports SET status='dismissed' WHERE id=?").run(r.id);
  res.json({ok:true});
});
app.post("/api/pay/verify",need,async(req,res)=>{
  const o=db.prepare("SELECT * FROM orders WHERE ref=? AND user_id=?").get(String((req.body||{}).reference||""),req.user.id);
  if(!o)return res.status(404).json({error:"We could not find that payment."});
  if(o.status!=="awaiting_payment")return res.json({paid:o.status=="paid",no:o.no,total:o.total,dday:o.dday,slot:o.slot,ids:JSON.parse(o.items).map(i=>i.id)});
  const j=await ps("GET","/transaction/verify/"+encodeURIComponent(o.ref));
  if(j.status&&paidOk(o,j.data)){markPaid(o);return res.json({paid:true,no:o.no,total:o.total,dday:o.dday,slot:o.slot,ids:JSON.parse(o.items).map(i=>i.id)})}
  res.json({paid:false});
});
app.post("/api/paystack/webhook",(req,res)=>{
  const sig=String(req.headers["x-paystack-signature"]||""),mac=crypto.createHmac("sha512",PS_SECRET||"x").update(req.raw||"").digest("hex");
  if(!PS_SECRET||sig.length!==mac.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(mac)))return res.sendStatus(401);
  const ev=req.body||{};
  if(ev.event=="charge.success"&&ev.data){const o=db.prepare("SELECT * FROM orders WHERE ref=? AND status='awaiting_payment'").get(String(ev.data.reference||""));if(o&&paidOk(o,ev.data))markPaid(o)}
  res.sendStatus(200);
});
app.get("/api/delivery",(req,res)=>res.json({days:freeDays(),slots:SLOTS,delivery:DEL,rules:{min:MIN_ORDER,cod:COD_MAX,online:!!PS_SECRET}}));
app.get("/api/addresses",need,(req,res)=>res.json({addresses:db.prepare("SELECT * FROM addresses WHERE user_id=? ORDER BY id DESC").all(req.user.id)}));
app.post("/api/addresses",need,(req,res)=>{
  const b=req.body||{},a=cleanAddr(b);if(typeof a=="string")return res.status(400).json({error:a});
  const label=String(b.label||"Home").trim().slice(0,20)||"Home",id=+b.id;
  if(id){
    if(!db.prepare("SELECT 1 FROM addresses WHERE id=? AND user_id=?").get(id,req.user.id))return res.status(404).json({error:"Address not found."});
    db.prepare("UPDATE addresses SET label=?,name=?,phone=?,region=?,addr=?,gps=? WHERE id=?").run(label,a.name,a.phone,a.region,a.addr,a.gps,id);return res.json({id});
  }
  if(db.prepare("SELECT COUNT(*) n FROM addresses WHERE user_id=?").get(req.user.id).n>=10)return res.status(400).json({error:"You can save up to 10 addresses. Delete one first."});
  res.json({id:Number(db.prepare("INSERT INTO addresses(user_id,label,name,phone,region,addr,gps) VALUES(?,?,?,?,?,?,?)").run(req.user.id,label,a.name,a.phone,a.region,a.addr,a.gps).lastInsertRowid)});
});
app.delete("/api/addresses/:id",need,(req,res)=>{db.prepare("DELETE FROM addresses WHERE id=? AND user_id=?").run(+req.params.id,req.user.id);res.json({ok:true})});
app.put("/api/orders/:no/delivery",need,(req,res)=>{
  const o=db.prepare("SELECT * FROM orders WHERE no=? AND user_id=?").get(String(req.params.no),req.user.id);
  if(!o||o.status=="awaiting_payment")return res.status(404).json({error:"Order not found."});
  if(!["placed","confirmed"].includes(o.dstatus||"placed"))return res.status(400).json({error:"This order is already on its way, so its delivery details can no longer be changed."});
  const b=req.body||{},a=cleanAddr({...(b.address||{}),region:o.region});if(typeof a=="string")return res.status(400).json({error:a});
  if(b.day!==o.dday&&!freeDays().includes(b.day))return res.status(400).json({error:"Choose a delivery day."});
  if(!SLOTS.includes(b.slot))return res.status(400).json({error:"Choose a delivery time."});
  db.prepare("UPDATE orders SET dname=?,dphone=?,daddr=?,gps=?,notes=?,dday=?,slot=?,addr=? WHERE id=?").run(a.name,a.phone,a.addr,a.gps,a.notes,b.day,b.slot,`${a.addr}, ${o.region}`,o.id);
  res.json({ok:true});
});
const FLOW=["placed","confirmed","out","delivered"];
function createEarnings(o){
  const ins=db.prepare("INSERT OR IGNORE INTO earnings(order_no,seller,ad_id,title,gross,commission,net,created) VALUES(?,?,?,?,?,?,?,?)");
  for(const it of JSON.parse(o.items)){
    if(!it.o||it.o===SAMPLE_ID)continue;
    const gross=Math.round(it.p*it.q*100)/100,com=Math.round(gross*COMM)/100;
    ins.run(o.no,it.o,it.id,it.t,gross,com,Math.round((gross-com)*100)/100,Date.now());
  }
}
app.get("/api/admin/orders",need,adm,(req,res)=>res.json({orders:db.prepare("SELECT o.*,u.name uname FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE (o.status IS NULL OR o.status!='awaiting_payment') AND (o.dstatus IS NULL OR o.dstatus NOT IN ('delivered','cancelled')) ORDER BY o.dday IS NULL,o.dday,o.slot,o.id").all().map(o=>({no:o.no,uname:o.uname,items:JSON.parse(o.items),total:o.total,pay:o.pay,status:o.status,dstatus:o.dstatus||"placed",dday:o.dday,slot:o.slot,dname:o.dname,dphone:o.dphone,region:o.region,daddr:o.daddr,gps:o.gps,notes:o.notes}))}));
app.post("/api/admin/orders/:no/advance",need,adm,(req,res)=>{
  const o=db.prepare("SELECT * FROM orders WHERE no=?").get(String(req.params.no));if(!o||o.status=="awaiting_payment")return res.status(404).json({error:"Order not found."});
  if(["cancelled","delivered"].includes(o.dstatus))return res.status(400).json({error:"This order can no longer be moved forward."});
  const next=FLOW[Math.min(FLOW.indexOf(o.dstatus||"placed")+1,3)];
  db.prepare("UPDATE orders SET dstatus=?"+(next=="delivered"&&o.status=="placed"?",status='paid'":"")+(next=="delivered"?",delivered="+Date.now():"")+" WHERE id=?").run(next,o.id);
  if(next=="delivered")createEarnings(o);
  if(next!==(o.dstatus||"placed")){
    const DM={confirmed:"has been confirmed and is being prepared.",out:"is out for delivery. Please keep your phone close.",delivered:"has been delivered. Thank you! You can now review the items you bought."};
    notify(o.user_id,`Order ${o.no} update`,`Your order ${o.no} ${DM[next]}`,{sms:next!="confirmed"});
    if(next=="delivered")for(const it of JSON.parse(o.items))if(it.o&&it.o!==SAMPLE_ID)notify(it.o,`Order ${o.no} delivered`,`Order ${o.no} was delivered. Your earnings for the items are now waiting to be paid out.`,{key:"d"+o.no,every:864e5});
  }
  res.json({ok:true,dstatus:next});
});
const BK=path.join(DATA,"backups");fs.mkdirSync(BK,{recursive:true});
async function snapshot(){
  const f=path.join(BK,"shop-"+new Date().toISOString().slice(0,10)+".db");
  if(fs.existsSync(f))return f;
  await db.backup(f);
  const all=fs.readdirSync(BK).filter(n=>/^shop-.*\.db$/.test(n)).sort();
  for(const n of all.slice(0,Math.max(0,all.length-14)))fs.unlinkSync(path.join(BK,n));
  return f;
}
function tarEntry(name,buf){
  const h=Buffer.alloc(512);h.write(name,0,100);h.write("0000644\0",100);h.write("0000000\0",108);h.write("0000000\0",116);
  h.write(buf.length.toString(8).padStart(11,"0")+"\0",124);h.write(Math.floor(Date.now()/1000).toString(8).padStart(11,"0")+"\0",136);
  h.write("        ",148);h.write("0",156);h.write("ustar\0",257);h.write("00",263);
  let sum=0;for(const b of h)sum+=b;h.write(sum.toString(8).padStart(6,"0")+"\0 ",148);
  return Buffer.concat([h,buf,Buffer.alloc((512-buf.length%512)%512)]);
}
async function backupArchive(){
  const tmp=path.join(BK,"tmp-"+Date.now()+".db");await db.backup(tmp);
  const parts=[tarEntry("shop.db",fs.readFileSync(tmp))];fs.unlinkSync(tmp);
  for(const n of fs.readdirSync(UP)){const p=path.join(UP,n);if(fs.statSync(p).isFile())parts.push(tarEntry("uploads/"+n,fs.readFileSync(p)))}
  if(fs.existsSync(path.join(DATA,"vapid.json")))parts.push(tarEntry("vapid.json",fs.readFileSync(path.join(DATA,"vapid.json"))));
  parts.push(Buffer.alloc(1024));return require("zlib").gzipSync(Buffer.concat(parts));
}
app.get("/api/admin/backup",need,adm,async(req,res)=>{
  const buf=await backupArchive();
  res.setHeader("Content-Type","application/gzip");res.setHeader("Content-Disposition",`attachment; filename="${COMPANY.toLowerCase().replace(/\W+/g,"-")}-backup-${new Date().toISOString().slice(0,10)}.tar.gz"`);res.send(buf);
});
// ---- forgot / change password ----
app.post("/api/forgot",limit,async(req,res)=>{
  const email=String((req.body||{}).email||"").trim().toLowerCase(),u=db.prepare("SELECT id,name,email FROM users WHERE email=? AND pw NOT LIKE '!%'").get(email);
  const sent=(forgotHits.get(email)||[]).filter(t=>t>Date.now()-36e5);
  if(u&&sent.length<5){
    sent.push(Date.now());forgotHits.set(email,sent);
    const code=String(crypto.randomInt(100000,1000000));
    db.prepare("INSERT OR REPLACE INTO resets VALUES(?,?,?,0)").run(u.id,sha(code),Date.now()+15*60000);
    await mail(u.email,`Your ${COMPANY} password reset code`,`Hi ${u.name.split(" ")[0]},\n\nYour ${COMPANY} password reset code is ${code}. It expires in 15 minutes.\n\nIf you did not ask for this, you can ignore this email.`);
  }
  res.json({ok:true});
});
app.post("/api/reset",limit,(req,res)=>{
  const b=req.body||{},u=db.prepare("SELECT * FROM users WHERE email=?").get(String(b.email||"").trim().toLowerCase()),pw=String(b.password||"");
  const bad=()=>res.status(400).json({error:"That code is wrong or has expired. Request a new one."});
  if(pw.length<MIN_PW)return res.status(400).json({error:`Choose a password of ${MIN_PW} or more characters.`});
  const r=u&&db.prepare("SELECT * FROM resets WHERE user_id=?").get(u.id);
  if(!r||r.expires<Date.now()||r.tries>=5)return bad();
  if(r.hash!==sha(String(b.code||"").trim())){db.prepare("UPDATE resets SET tries=tries+1 WHERE user_id=?").run(u.id);return bad()}
  db.prepare("UPDATE users SET pw=? WHERE id=?").run(bcrypt.hashSync(pw,10),u.id);
  db.prepare("DELETE FROM resets WHERE user_id=?").run(u.id);db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id);
  startSession(res,u.id);res.json({user:{id:u.id,name:u.name,phone:u.phone,email:u.email,verified:!!u.verified,admin:isAdmin(u)}});
});
app.post("/api/password",need,limit,(req,res)=>{
  const b=req.body||{},u=db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id),np=String(b.password||"");
  if(!bcrypt.compareSync(String(b.current||""),u.pw))return res.status(400).json({error:"Your current password is wrong."});
  if(np.length<MIN_PW)return res.status(400).json({error:`Choose a password of ${MIN_PW} or more characters.`});
  db.prepare("UPDATE users SET pw=? WHERE id=?").run(bcrypt.hashSync(np,10),u.id);
  db.prepare("DELETE FROM sessions WHERE user_id=? AND token!=?").run(u.id,sha(cookie(req,"sid")));
  res.json({ok:true});
});
// ---- support details and legal pages ----
app.get("/api/site",(req,res)=>res.json({whatsapp:SUPPORT_WA,email:SUPPORT_EMAIL,company:COMPANY}));
const fill=(h,req)=>h.replaceAll("%SITE%",SITE(req)).replaceAll("%COMPANY%",COMPANY).replaceAll("%EMAIL%",SUPPORT_EMAIL||"(support email not set yet)").replaceAll("%WHATSAPP%",SUPPORT_WA||"(WhatsApp number not set yet)").replaceAll("%HOURS%",SUPPORT_HOURS).replaceAll("%MIN_ORDER%",String(MIN_ORDER)).replaceAll("%COD_MAX%",String(COD_MAX)).replaceAll("%COMMISSION%",String(COMM)).replaceAll("%CANCEL_HOURS%",String(CANCEL_H));
for(const p of ["terms","privacy","contact","faq"])app.get(["/"+p,"/"+p+".html"],(req,res)=>res.type("html").send(fill(fs.readFileSync(path.join(__dirname,"public",p+".html"),"utf8"),req)));
// ---- seller earnings and payouts ----
const NETS=["MTN","Telecel","AirtelTigo"];
app.get("/api/payout",need,(req,res)=>{
  const u=db.prepare("SELECT payout_net n,payout_num p,payout_name a FROM users WHERE id=?").get(req.user.id);
  const sum=db.prepare("SELECT COALESCE(SUM(CASE WHEN status='pending' THEN net END),0) pending,COALESCE(SUM(CASE WHEN status='paid' THEN net END),0) paid FROM earnings WHERE seller=?").get(req.user.id);
  res.json({details:{net:u.n||"",number:u.p||"",name:u.a||""},pending:sum.pending,paid:sum.paid,rate:COMM,items:db.prepare("SELECT order_no,title,gross,commission,net,status,created FROM earnings WHERE seller=? ORDER BY id DESC LIMIT 20").all(req.user.id)});
});
app.post("/api/payout",need,(req,res)=>{
  const b=req.body||{},net=String(b.net||""),num=String(b.number||"").trim(),nm=String(b.name||"").trim().slice(0,60);
  if(!NETS.includes(net))return res.status(400).json({error:"Choose your Mobile Money network."});
  if(!/^[0-9+\s]{9,15}$/.test(num))return res.status(400).json({error:"Enter a valid Mobile Money number."});
  if(nm.length<2)return res.status(400).json({error:"Enter the name registered on that number."});
  db.prepare("UPDATE users SET payout_net=?,payout_num=?,payout_name=? WHERE id=?").run(net,num,nm,req.user.id);res.json({ok:true});
});
app.get("/api/admin/payouts",need,adm,(req,res)=>res.json({
  rate:COMM,
  sellers:db.prepare("SELECT u.id,u.name,u.payout_net net,u.payout_num num,u.payout_name pname,SUM(e.net) pending,COUNT(*) n FROM earnings e JOIN users u ON u.id=e.seller WHERE e.status='pending' GROUP BY u.id ORDER BY pending DESC").all(),
  totals:db.prepare("SELECT COALESCE(SUM(CASE WHEN status!='void' THEN commission END),0) commission,COALESCE(SUM(CASE WHEN status='pending' THEN net END),0) owed,COALESCE(SUM(CASE WHEN status='paid' THEN net END),0) paid FROM earnings").get(),
  fees:db.prepare("SELECT COALESCE(SUM(fee),0) v FROM orders WHERE dstatus='delivered'").get().v}));
app.post("/api/admin/payouts",need,adm,(req,res)=>{
  const b=req.body||{},sid=+b.seller,ref=String(b.ref||"").trim().slice(0,40);
  if(ref.length<4)return res.status(400).json({error:"Enter the Mobile Money transaction ID you paid with."});
  const rows=db.prepare("SELECT id,net FROM earnings WHERE seller=? AND status='pending'").all(sid);
  if(!rows.length)return res.status(400).json({error:"Nothing is waiting for this seller."});
  const amount=Math.round(rows.reduce((n,r)=>n+r.net,0)*100)/100;
  const pid=Number(db.prepare("INSERT INTO payouts(seller,amount,ref,created,by_user) VALUES(?,?,?,?,?)").run(sid,amount,ref,Date.now(),req.user.id).lastInsertRowid);
  db.prepare("UPDATE earnings SET status='paid',payout_id=? WHERE seller=? AND status='pending'").run(pid,sid);
  res.json({ok:true,amount});
});
const escA=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function indexHtml(req,ad){
  const site=SITE(req),m=ad?{title:`${ad.t} – GH₵ ${Number(ad.p).toLocaleString()} | ${COMPANY}`,desc:(ad.d||`${ad.k} in ${ad.l}. Buy and sell across Ghana on ${COMPANY}.`).slice(0,160),img:ad.imgs[0]?site+ad.imgs[0]:site+"/og-image.png",url:site+"/ad/"+ad.id}
    :{title:COMPANY+" – Great deals. Every day.",desc:COMPANY+": great deals every day. Buy and sell new and used items across Ghana.",img:site+"/og-image.png",url:site+"/"};
  return fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8").replaceAll("%SITE%",site).replaceAll("%OG_TITLE%",escA(m.title)).replaceAll("%OG_DESC%",escA(m.desc)).replaceAll("%OG_IMAGE%",escA(m.img)).replaceAll("%OG_URL%",escA(m.url));
}
app.get("/ad/:id",(req,res)=>{const a=getAd(+req.params.id);res.type("html").send(indexHtml(req,a&&!a.x&&!a.h?a:null))});
app.get(["/","/index.html"],(req,res)=>res.type("html").send(indexHtml(req,null)));
const dispOf=(no,uid)=>db.prepare("SELECT id,status,reason,resolution FROM disputes WHERE order_no=? AND user_id=? ORDER BY id DESC LIMIT 1").get(no,uid)||null;
const slotStart=(day,slot)=>{const m=/^(\d{1,2})\s*(am|pm)/i.exec(String(slot||"")),h=m?(+m[1]%12)+(/pm/i.test(m[2])?12:0):0,[y,mo,d]=String(day).split("-").map(Number),t=new Date(y,mo-1,d,h).getTime();return Number.isFinite(t)?t:null};
const cancelBy=o=>{const t=o.dday?slotStart(o.dday,o.slot):null;return t==null?null:t-CANCEL_H*36e5};
const CANCEL_WHY=["Changed my mind","Ordered by mistake","Found a better price","Delivery date does not suit me","Other"],DISPUTE_WHY=["Item not received","Not as described","Damaged","Wrong item","Other"],DISPUTE_HOURS=48;
const sellersOf=items=>[...new Set(items.map(i=>i.o).filter(Boolean))];
// after a cancel or refund the buyer loses review rights for those items, unless they bought them again in another live order
function dropBought(uid,items,exceptNo){
  const others=db.prepare("SELECT items FROM orders WHERE user_id=? AND no!=? AND (status IS NULL OR status!='awaiting_payment') AND (dstatus IS NULL OR dstatus!='cancelled')").all(uid,exceptNo).flatMap(r=>JSON.parse(r.items).map(i=>i.id));
  for(const it of items)if(it.id&&!others.includes(it.id))db.prepare("DELETE FROM bought WHERE user_id=? AND ad_id=?").run(uid,it.id);
}
app.post("/api/orders/:no/cancel",need,limit,(req,res)=>{
  const o=db.prepare("SELECT * FROM orders WHERE no=? AND user_id=?").get(String(req.params.no),req.user.id);
  if(!o||o.status=="awaiting_payment")return res.status(404).json({error:"Order not found."});
  if(!["placed","confirmed"].includes(o.dstatus||"placed"))return res.status(400).json({error:"This order can no longer be cancelled here. If something is wrong, use Report a problem or contact support."});
  const cb=cancelBy(o);
  if(cb!=null&&Date.now()>cb)return res.status(400).json({error:`Orders can only be cancelled at least ${CANCEL_H} hours before the delivery window starts, so this order can no longer be cancelled. Contact support if you need help.`});
  const why=CANCEL_WHY.includes((req.body||{}).reason)?req.body.reason:"Other",paid=o.status=="paid",items=JSON.parse(o.items);
  db.prepare("UPDATE orders SET dstatus='cancelled',cancel_note=?,refund=? WHERE id=?").run(why,paid?"pending":"none",o.id);
  dropBought(req.user.id,items,o.no);
  notify(req.user.id,`Order ${o.no} cancelled`,paid?`Your order ${o.no} was cancelled. Your refund of GH₵ ${Number(o.total).toLocaleString()} is being processed and will go back to your original payment method.`:`Your order ${o.no} was cancelled. You have not been charged.`,{sms:true});
  for(const s of sellersOf(items))notify(s,`Order ${o.no} cancelled`,`The buyer cancelled order ${o.no}. You do not need to deliver it.`);
  res.json({ok:true,refund:paid});
});
app.post("/api/orders/:no/dispute",need,limit,(req,res)=>{
  const o=db.prepare("SELECT * FROM orders WHERE no=? AND user_id=?").get(String(req.params.no),req.user.id),b=req.body||{},note=String(b.note||"").trim().slice(0,500);
  if(!o||o.dstatus!="delivered")return res.status(400).json({error:"You can report a problem once the order is marked delivered."});
  if(o.delivered&&Date.now()-o.delivered>DISPUTE_HOURS*36e5)return res.status(400).json({error:`The ${DISPUTE_HOURS}-hour window to report a problem has passed. Please contact support.`});
  if(!DISPUTE_WHY.includes(b.reason))return res.status(400).json({error:"Choose what went wrong."});
  if(note.length<5)return res.status(400).json({error:"Describe what happened (a few words is enough)."});
  if(db.prepare("SELECT 1 FROM disputes WHERE order_no=? AND user_id=?").get(o.no,req.user.id))return res.status(400).json({error:"You have already reported a problem with this order. We will get back to you."});
  db.prepare("INSERT INTO disputes(order_no,user_id,reason,note,status,created) VALUES(?,?,?,?,'open',?)").run(o.no,req.user.id,b.reason,note,Date.now());
  db.prepare("UPDATE earnings SET status='held' WHERE order_no=? AND status='pending'").run(o.no);
  notify(req.user.id,`We received your report on ${o.no}`,`We are looking into the problem you reported on order ${o.no} and will update you soon.`);
  for(const s of sellersOf(JSON.parse(o.items)))notify(s,`Problem reported on ${o.no}`,`A buyer reported a problem with order ${o.no}. Your earnings for it are on hold while we check.`);
  res.json({ok:true});
});
app.get("/api/admin/disputes",need,adm,(req,res)=>res.json({
  disputes:db.prepare("SELECT d.id,d.order_no,d.reason,d.note,d.created,u.name uname,o.total,o.pay,o.items FROM disputes d JOIN users u ON u.id=d.user_id JOIN orders o ON o.no=d.order_no WHERE d.status='open' ORDER BY d.id").all().map(d=>({...d,items:JSON.parse(d.items).map(i=>i.t+" x"+i.q)})),
  refunds:db.prepare("SELECT o.no,o.total,o.pay,o.ref,u.name uname FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE o.refund='pending' ORDER BY o.id").all(),online:!!PS_SECRET}));
app.post("/api/admin/disputes/:id",need,adm,(req,res)=>{
  const d=db.prepare("SELECT * FROM disputes WHERE id=? AND status='open'").get(+req.params.id);if(!d)return res.status(404).json({error:"Report not found."});
  const b=req.body||{},refund=!!b.refund,note=String(b.note||"").trim().slice(0,300),o=db.prepare("SELECT * FROM orders WHERE no=?").get(d.order_no),items=JSON.parse(o.items);
  const sellerPaid=!!db.prepare("SELECT 1 FROM earnings WHERE order_no=? AND status='paid'").get(d.order_no);
  db.prepare("UPDATE disputes SET status=?,resolution=?,resolved=? WHERE id=?").run(refund?"refunded":"rejected",note,Date.now(),d.id);
  if(refund){
    db.prepare("UPDATE earnings SET status='void' WHERE order_no=? AND status IN ('held','pending')").run(d.order_no);
    db.prepare("UPDATE orders SET refund='pending' WHERE no=?").run(d.order_no);dropBought(d.user_id,items,d.order_no);
  }else db.prepare("UPDATE earnings SET status='pending' WHERE order_no=? AND status='held'").run(d.order_no);
  notify(d.user_id,`Update on order ${d.order_no}`,refund?`Your report on order ${d.order_no} was approved. Your refund is being processed.${note?" "+note:""}`:`We reviewed your report on order ${d.order_no} and could not approve a refund.${note?" "+note:""} Contact support if you disagree.`,{sms:true});
  for(const s of sellersOf(items))notify(s,`Update on order ${d.order_no}`,refund?`The problem reported on order ${d.order_no} was upheld and the buyer is being refunded. Earnings for this order are cancelled.`:`The problem reported on order ${d.order_no} was reviewed and closed. Your earnings are released.`);
  res.json({ok:true,sellerPaid:refund&&sellerPaid});
});
app.post("/api/admin/orders/:no/refund",need,adm,async(req,res)=>{
  const o=db.prepare("SELECT * FROM orders WHERE no=? AND refund='pending'").get(String(req.params.no));if(!o)return res.status(404).json({error:"No refund is waiting for this order."});
  const b=req.body||{};let ref=String(b.ref||"").trim().slice(0,40);
  if(b.paystack){
    if(!PS_SECRET||!o.ref)return res.status(400).json({error:"This order was not paid through Paystack. Send the refund by Mobile Money and record the transaction ID."});
    const j=await ps("POST","/refund",{transaction:o.ref});if(!j.status)return res.status(502).json({error:"Paystack could not start the refund: "+(j.message||"try again, or refund from your Paystack dashboard.")});
    ref="paystack";
  }else if(ref.length<4)return res.status(400).json({error:"Enter the Mobile Money transaction ID you refunded with."});
  db.prepare("UPDATE orders SET refund='refunded',refund_ref=? WHERE id=?").run(ref,o.id);
  notify(o.user_id,`Refund sent for ${o.no}`,`Your refund of GH₵ ${Number(o.total).toLocaleString()} for order ${o.no} has been sent. It can take a little while to show.`,{sms:true});
  res.json({ok:true});
});
app.get("/api/push/key",(req,res)=>res.json({key:webpush?VAPID.publicKey:null}));
app.post("/api/push/subscribe",need,(req,res)=>{
  const s=(req.body||{}).sub;
  if(!webpush||!s||typeof s.endpoint!="string"||!/^https:\/\//.test(s.endpoint)||s.endpoint.length>600||!s.keys||!s.keys.p256dh||!s.keys.auth)return res.status(400).json({error:"Phone alerts could not be turned on."});
  db.prepare("INSERT OR REPLACE INTO push_subs(user_id,endpoint,sub,created) VALUES(?,?,?,?)").run(req.user.id,s.endpoint,JSON.stringify({endpoint:s.endpoint,keys:{p256dh:String(s.keys.p256dh),auth:String(s.keys.auth)}}),Date.now());
  db.prepare("DELETE FROM push_subs WHERE user_id=? AND id NOT IN (SELECT id FROM push_subs WHERE user_id=? ORDER BY id DESC LIMIT 5)").run(req.user.id,req.user.id);
  res.json({ok:true});
});
app.post("/api/push/unsubscribe",need,(req,res)=>{db.prepare("DELETE FROM push_subs WHERE user_id=? AND endpoint=?").run(req.user.id,String((req.body||{}).endpoint||""));res.json({ok:true})});
app.get("/sw.js",(req,res)=>{res.setHeader("Cache-Control","no-cache");res.type("js").sendFile(path.join(__dirname,"public","sw.js"))});
const seenV=new Map();
app.post("/api/ads/:id/view",(req,res)=>{
  const a=db.prepare("SELECT id,owner FROM ads WHERE id=? AND x=0 AND hidden=0").get(+req.params.id),k=req.ip+":"+(a&&a.id);
  if(a&&a.owner!==req.user?.id&&Date.now()-(seenV.get(k)||0)>18e5){seenV.set(k,Date.now());db.prepare("UPDATE ads SET views=views+1 WHERE id=?").run(a.id)}
  res.json({ok:true});
});
app.get("/api/seller/dashboard",need,(req,res)=>{
  const u=req.user.id,mine=db.prepare("SELECT id,t,views,x,hidden FROM ads WHERE owner=? ORDER BY created DESC").all(u),eb={};
  db.prepare("SELECT ad_id,COUNT(*) n,SUM(gross) gross FROM earnings WHERE seller=? GROUP BY ad_id").all(u).forEach(r=>eb[r.ad_id]=r);
  const tot=db.prepare("SELECT COUNT(*) n,COALESCE(SUM(gross),0) gross,COALESCE(SUM(CASE WHEN status='pending' THEN net END),0) pending,COALESCE(SUM(CASE WHEN status='paid' THEN net END),0) paid,COALESCE(SUM(CASE WHEN status='held' THEN net END),0) held FROM earnings WHERE seller=?").get(u),fulfil=[];
  for(const o of db.prepare("SELECT no,items,dday,slot,dstatus FROM orders WHERE (status IS NULL OR status!='awaiting_payment') AND (dstatus IS NULL OR dstatus NOT IN ('delivered','cancelled')) ORDER BY dday IS NULL,dday,slot,id").all()){
    const its=JSON.parse(o.items).filter(i=>i.o===u);
    if(its.length)fulfil.push({no:o.no,dday:o.dday,slot:o.slot,dstatus:o.dstatus||"placed",items:its.map(i=>({t:i.t,q:i.q,p:i.p}))});
  }
  res.json({totals:{ads:mine.length,live:mine.filter(a=>!a.x&&!a.hidden).length,views:mine.reduce((n,a)=>n+(a.views||0),0),sales:tot.n,gross:tot.gross,pending:tot.pending,paid:tot.paid,held:tot.held},ads:mine.map(a=>({id:a.id,t:a.t,views:a.views||0,live:!a.x&&!a.hidden,sales:eb[a.id]?eb[a.id].n:0,gross:eb[a.id]?eb[a.id].gross:0})),fulfil});
});
app.use("/uploads",express.static(UP,{maxAge:"7d"}));
app.use(express.static(path.join(__dirname,"public")));
app.use("/api",(req,res)=>res.status(404).json({error:"Not found."}));
app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.type=="entity.too.large"?"Photos are too large. Use fewer or smaller photos.":"Something went wrong. Please try again."}));
setInterval(()=>{snapshot().catch(()=>{});db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());db.prepare("DELETE FROM orders WHERE status='awaiting_payment' AND created<?").run(Date.now()-DAY)},36e5).unref();
app.listen(PORT,()=>{
  console.log(`DealMart running at http://localhost:${PORT}`);
  snapshot().then(f=>console.log("Daily backup: "+path.basename(f))).catch(e=>console.log("Backup failed:",e.message));
  console.log(mailer?"Email: on":"Email: not set up (password reset codes are printed in this window instead)");
  console.log(`Commission: ${COMM}%`+(SUPPORT_WA?"":" | Support WhatsApp not set"));
  console.log(ADMIN_EMAIL?`Admin account: ${ADMIN_EMAIL} (sign in with this email to see the admin buttons)`:"No admin set. Add \"adminEmail\" to config.json to turn on the admin buttons.");
  console.log(PS_SECRET?"Paystack: on":"Paystack: not set up (card and Mobile Money are switched off)");
});
