"use strict";
/* Small script for the FAQ and Contact pages (they don't load script.js). */
(()=>{
  const isEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||"").trim());

  /* FAQ accordion */
  document.querySelectorAll(".faq-item").forEach(item=>{
    const btn=item.querySelector(".faq-button"),ans=item.querySelector(".faq-answer");
    if(!btn||!ans)return;
    const sync=()=>{
      const open=item.classList.contains("open");
      btn.setAttribute("aria-expanded",String(open));
      ans.hidden=!open;
      const ic=btn.querySelector(".faq-icon");if(ic)ic.textContent=open?"−":"+";
    };
    sync();
    btn.addEventListener("click",()=>{item.classList.toggle("open");sync()});
  });

  /* Contact form: validate, highlight what's wrong, then open the visitor's email app */
  const form=document.getElementById("support-contact-form");
  if(!form)return;
  const mail=document.querySelector('a[href^="mailto:"]');
  const to=mail?mail.getAttribute("href").replace(/^mailto:/,"").split("?")[0]:"";
  const box=form.querySelector("#support-form-error");
  const fields={name:form.querySelector("#support-name"),email:form.querySelector("#support-email"),message:form.querySelector("#support-message")};
  Object.values(fields).forEach(el=>{
    const fe=document.createElement("div");fe.className="fe";el.after(fe);
    el.addEventListener("input",()=>{el.classList.remove("field-invalid");el.removeAttribute("aria-invalid");fe.textContent="";box.textContent=""});
  });
  const bad=(el,msg)=>{
    el.classList.add("field-invalid");el.setAttribute("aria-invalid","true");
    el.nextElementSibling.textContent=msg;box.textContent="Please fix the highlighted field and try again.";
    el.scrollIntoView({block:"center",behavior:"smooth"});el.focus({preventScroll:true});
    return false;
  };
  form.addEventListener("submit",e=>{
    e.preventDefault();
    Object.values(fields).forEach(el=>{el.classList.remove("field-invalid");el.nextElementSibling.textContent=""});
    const name=fields.name.value.trim(),email=fields.email.value.trim(),msg=fields.message.value.trim();
    if(name.length<2)return bad(fields.name,"Please enter your name.");
    if(!isEmail(email))return bad(fields.email,"Please enter a valid email address.");
    if(msg.length<10)return bad(fields.message,"Please add a few more details so we can help (at least 10 characters).");
    box.textContent="";
    const body=msg+"\n\n— "+name+" ("+email+")";
    location.href="mailto:"+to+"?subject="+encodeURIComponent("Support request from "+name)+"&body="+encodeURIComponent(body);
    let ok=form.querySelector(".form-ok");
    if(!ok){ok=document.createElement("div");ok.className="form-ok";ok.setAttribute("role","status");form.append(ok)}
    ok.textContent="Opening your email app… If nothing opens, email us directly at "+to+" or message us on WhatsApp.";
  });
})();
