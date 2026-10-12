/* DealMart service worker: lets the site be installed and shows phone alerts. */
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(clients.claim()));
self.addEventListener("fetch",()=>{});
self.addEventListener("push",e=>{
  let d={};try{d=e.data.json()}catch{}
  e.waitUntil(self.registration.showNotification(d.title||"DealMart",{body:d.body||"",icon:"/icon-192.png",badge:"/favicon-32.png",data:{url:d.url||"/"}}));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();const u=(e.notification.data&&e.notification.data.url)||"/";
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{
    for(const c of l)if("focus" in c)return c.focus();
    return clients.openWindow(u);
  }));
});
