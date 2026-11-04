import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, Bell, Bookmark, CalendarDays, Check, ChevronRight,
  Coffee, Compass, LocateFixed, MapPin, ShieldCheck, Star, Users, Wifi, Zap,
} from "lucide-react";

const c = {
  night: "#101a20", deep: "#14232a", panel: "#1d2b30", edge: "rgba(210,237,226,.14)",
  text: "#eff7f1", soft: "#b7c8c0", dim: "#81938d", mint: "#a3dfc2",
  gold: "#e1bd82", coral: "#eea889",
};

function Phone({ children, label }: { children: ReactNode; label: string }) {
  return <section style={{ width: 354, flexShrink: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 7px 10px", color: "#8ca29b", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700 }}>
      <span>{label}</span><span style={{ letterSpacing: ".04em", textTransform: "none", fontWeight: 500 }}>Met · sample view</span>
    </div>
    <div style={{ height: 766, borderRadius: 37, background: "#090f12", padding: 7, boxShadow: "0 28px 74px rgba(3,12,15,.55), 0 0 0 1px rgba(208,238,226,.23)", position: "relative" }}>
      <div style={{ height: "100%", borderRadius: 30, overflow: "hidden", background: c.night, position: "relative", color: c.text }}>
        <div style={{ height: 22, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 19px", fontSize: 9, color: c.text, fontWeight: 700, background: c.night, position: "relative", zIndex: 5 }}>
          <span>9:41</span><span style={{ display: "flex", gap: 4, alignItems: "center" }}><Wifi size={11}/><span style={{ width: 15, height: 8, border: "1px solid #b8d2c5", borderRadius: 2, display: "inline-block" }} /></span>
        </div>
        {children}
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 104, height: 4, borderRadius: 9, background: "#d6e8dd", opacity: .76, zIndex: 9 }} />
      </div>
    </div>
  </section>;
}

function NeonMap({ venue = false }: { venue?: boolean }) {
  return <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "radial-gradient(ellipse at 54% 47%, #29433e 0, #172b31 38%, #101a20 78%)" }}>
    <svg viewBox="0 0 350 500" preserveAspectRatio="none" style={{ position: "absolute", width: "100%", height: "100%", opacity: .9 }}>
      <path d="M-20 80 C49 104 75 53 139 78 S239 130 372 86M-15 205 C50 175 87 213 143 188 S266 158 365 213M-20 348 C54 308 94 342 156 314 S271 286 376 349M-10 452 C48 421 101 446 162 411 S279 396 370 444" fill="none" stroke="#36504c" strokeWidth="18"/>
      <path d="M-20 80 C49 104 75 53 139 78 S239 130 372 86M-15 205 C50 175 87 213 143 188 S266 158 365 213M-20 348 C54 308 94 342 156 314 S271 286 376 349M-10 452 C48 421 101 446 162 411 S279 396 370 444" fill="none" stroke="#637772" strokeWidth="1.2"/>
      <path d="M52 -20 C77 49 29 114 63 178 S100 285 58 359 S57 454 87 525M223 -20 C190 54 241 108 214 179 S195 296 243 355 S263 455 231 525M321 -25 C277 48 323 127 294 189 S281 285 319 355 S321 450 294 520" fill="none" stroke="#48635d" strokeWidth="11"/>
      <path d="M52 -20 C77 49 29 114 63 178 S100 285 58 359 S57 454 87 525M223 -20 C190 54 241 108 214 179 S195 296 243 355 S263 455 231 525M321 -25 C277 48 323 127 294 189 S281 285 319 355 S321 450 294 520" fill="none" stroke="#80918a" strokeWidth=".8"/>
      <path d="M18 284 Q91 237 154 263 T333 254" fill="none" stroke="#9ed9b7" strokeWidth="2" strokeDasharray="3 7" opacity=".76"/>
      <path d="M125 100 L156 91 L169 129 L137 139Z M261 229 L301 218 L316 253 L278 267Z M112 371 L146 359 L166 394 L129 407Z" fill="#1e3837" stroke="#35514a" strokeWidth="1"/>
      {[ [94,139],[182,170],[281,307],[78,325],[255,113],[307,399],[155,448],[32,234] ].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===1?2.7:1.5} fill={i===1?"#f0c88c":"#a8d9bb"} opacity={i===1?1:.56}/>)}
    </svg>
    <div style={{ position: "absolute", left: "48%", top: "43%", transform: "translate(-50%,-50%)", width: 116, height: 116, border: "1px solid rgba(172,229,198,.22)", borderRadius: "50%", boxShadow: "0 0 38px rgba(119,202,163,.09), inset 0 0 30px rgba(119,202,163,.06)" }}/>
    <div style={{ position: "absolute", left: "48%", top: "43%", transform: "translate(-50%,-50%)", width: 69, height: 69, border: "1px solid rgba(172,229,198,.35)", borderRadius: "50%" }}/>
    <div style={{ position: "absolute", left: "48%", top: "43%", transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: 20, background: c.mint, boxShadow: "0 0 0 7px rgba(163,223,194,.14),0 0 23px #9ce6bd" }}/>
    <div style={{ position: "absolute", left: "60%", top: "31%", padding: "7px 9px", border: "1px solid rgba(228,240,225,.2)", borderRadius: 8, color: c.text, background: "rgba(22,39,42,.86)", fontSize: 9, fontWeight: 700, boxShadow: "0 8px 22px #0005" }}><span style={{ color: c.gold }}>●</span> Mira House <span style={{ color: c.soft, fontWeight: 500 }}>· 86 this week</span></div>
    <div style={{ position: "absolute", left: "8%", top: "58%", padding: "7px 9px", border: "1px solid rgba(228,240,225,.14)", borderRadius: 8, color: c.soft, background: "rgba(22,39,42,.84)", fontSize: 8, fontWeight: 700 }}>Juniper Market · 64</div>
    <div style={{ position: "absolute", right: "6%", top: "70%", padding: "7px 9px", border: "1px solid rgba(228,240,225,.14)", borderRadius: 8, color: c.soft, background: "rgba(22,39,42,.84)", fontSize: 8, fontWeight: 700 }}>Cypress Books · 42</div>
    <div style={{ position: "absolute", bottom: venue ? 310 : 0, left: 0, right: 0, height: 100, background: "linear-gradient(transparent,rgba(12,22,26,.75))" }}/>
  </div>;
}

export function Smooth() {
  const [visible, setVisible] = useState(true);
  const [toast, setToast] = useState("");
  const [rsvp, setRsvp] = useState(false);
  const [saved, setSaved] = useState(false);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 1800); };
  const action = (label: string, run: () => void, main = false) => <button onClick={run} style={{ border: main ? "1px solid #b4e4c9" : `1px solid ${c.edge}`, background: main ? c.mint : "rgba(25,44,48,.92)", color: main ? "#142820" : c.text, borderRadius: 12, padding: "9px 11px", fontSize: 10, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{label}</button>;
  const pane: CSSProperties = { background: "rgba(24,42,46,.94)", border: `1px solid ${c.edge}`, borderRadius: 15, boxShadow: "0 10px 28px rgba(1,9,12,.28)", backdropFilter: "blur(14px)" };
  const title = (name: string, meta?: string) => <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",margin:"14px 1px 8px" }}><b style={{ fontSize:15,letterSpacing:"-.03em",color:c.text }}>{name}</b>{meta && <span style={{ fontSize:8,letterSpacing:".1em",fontWeight:800,color:c.mint }}>{meta}</span>}</div>;
  const mapHeight = "calc(100% - 22px)";

  return <main style={{ width:1120,height:900,boxSizing:"border-box",overflow:"hidden",padding:"23px 36px 25px",color:c.text,background:"radial-gradient(ellipse at 50% -30%,#33514c 0,#1a2c31 35%,#111a1f 83%)",fontFamily:"'DM Sans','Avenir Next',sans-serif",position:"relative" }}>
    <style>{`@keyframes breathe { 0%,100% { transform:scale(1);opacity:.78 } 50% { transform:scale(1.045);opacity:1 } } @keyframes arrive { from {opacity:0;transform:translateY(10px)} to {opacity:1;transform:translateY(0)} } * {box-sizing:border-box} button {font-family:inherit}`}</style>
    <header style={{width:780,margin:"0 auto 13px",display:"flex",justifyContent:"space-between",alignItems:"end"}}>
      <div><div style={{fontSize:10,fontWeight:800,letterSpacing:".23em",color:c.mint}}>MET / AFTER HOURS</div><h1 style={{margin:"5px 0 0",fontSize:27,fontWeight:600,letterSpacing:"-.05em",color:"#f0f7f1"}}>The city, softly lit.</h1></div>
      <div style={{textAlign:"right",fontSize:9,lineHeight:1.55,color:"#93a9a0",letterSpacing:".05em"}}>A QUIET GLOW BETWEEN PLACES<br/><span style={{color:c.mint,fontWeight:700}}>SMOOTH · IMMERSIVE DISCOVERY</span></div>
    </header>
    <div style={{display:"flex",justifyContent:"center",gap:30}}>
      <Phone label="01 · Home / ambient map">
        <div style={{height:mapHeight,position:"relative",overflowY:"auto",scrollbarWidth:"none",background:c.night}}>
          <NeonMap/>
          <div style={{position:"absolute",inset:"0 0 auto",height:166,background:"linear-gradient(180deg,rgba(14,23,27,.96),rgba(14,23,27,.55) 70%,transparent)",padding:"8px 15px 0",zIndex:2}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:8,letterSpacing:".16em",color:c.mint,fontWeight:800}}>RIVER DISTRICT · 9:41 PM</div><div style={{fontSize:23,fontWeight:650,letterSpacing:"-.055em",marginTop:4}}>Out here, together.</div></div>
              <button onClick={()=>notify("Sample request · review privately")} style={{position:"relative",border:`1px solid ${c.edge}`,background:"rgba(26,44,48,.9)",width:36,height:36,borderRadius:50,color:c.text,display:"grid",placeItems:"center",cursor:"pointer"}}><Bell size={15}/><i style={{position:"absolute",right:6,top:6,width:7,height:7,background:c.coral,borderRadius:10,border:"1px solid #17252a"}}/></button>
            </div>
            <div style={{display:"flex",gap:7,alignItems:"center",marginTop:10}}>
              <button onClick={()=>setVisible(!visible)} style={{border:`1px solid ${visible?"rgba(163,223,194,.4)":c.edge}`,background:"rgba(20,39,42,.92)",borderRadius:20,color:c.text,padding:"6px 9px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><span style={{width:7,height:7,borderRadius:10,background:visible?c.mint:"#8b9692",boxShadow:visible?"0 0 9px #a2e7c3":"none"}}/>{visible?"Beacon on":"Beacon off"}<span style={{color:c.dim}}>· toggle</span></button>
              <span style={{fontSize:8,color:c.soft,display:"flex",alignItems:"center",gap:4}}><ShieldCheck size={11} color={c.mint}/> private by choice</span>
            </div>
          </div>
          <div style={{position:"absolute",top:150,left:14,right:14,zIndex:2,display:"flex",gap:9,alignItems:"stretch"}}>
            <div style={{...pane,flex:1,padding:"10px 12px"}}>
              <div style={{fontSize:8,letterSpacing:".12em",color:c.soft,fontWeight:700}}>NEARBY INTERACTIONS</div>
              <div style={{display:"flex",alignItems:"baseline",gap:7,marginTop:2}}><b style={{fontSize:27,letterSpacing:"-.06em"}}>{visible?"8":"—"}</b><span style={{fontSize:9,color:c.dim}}>within 500 m</span></div>
            </div>
            <div style={{...pane,width:88,padding:"9px 10px",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:5}}>
              <div style={{display:"flex",alignItems:"center"}}><span style={{display:"flex"}}><span style={{width:24,height:24,borderRadius:50,display:"grid",placeItems:"center",background:"#567c6d",fontSize:7,fontWeight:800,border:"1px solid #263b3e"}}>JM</span><span style={{width:24,height:24,marginLeft:-6,borderRadius:50,display:"grid",placeItems:"center",background:"#8b6d61",fontSize:7,fontWeight:800,border:"1px solid #263b3e"}}>RK</span></span></div>
              <span style={{fontSize:8,color:c.soft,textAlign:"center"}}>1 request <ChevronRight size={9}/></span>
            </div>
          </div>
          <div style={{position:"absolute",top:"41%",right:12,zIndex:2,display:"flex",flexDirection:"column",gap:6}}>
            <button onClick={()=>notify("Map orientation reset")} style={{height:33,width:33,borderRadius:11,border:`1px solid ${c.edge}`,background:"rgba(22,39,43,.92)",color:c.text,display:"grid",placeItems:"center",cursor:"pointer"}}><LocateFixed size={14}/></button>
            <button onClick={()=>notify("Activity is pooled by venue")} style={{height:33,width:33,borderRadius:11,border:`1px solid ${c.edge}`,background:"rgba(22,39,43,.92)",color:c.mint,display:"grid",placeItems:"center",cursor:"pointer"}}><Compass size={14}/></button>
          </div>
          <div style={{position:"absolute",top:"48%",left:13,zIndex:2,fontSize:8,color:"#bbcdc3",background:"rgba(12,23,27,.76)",border:"1px solid rgba(204,229,213,.12)",borderRadius:9,padding:"6px 8px"}}>Aggregated venue activity only<br/>No individual live positions</div>
          <div style={{position:"relative",zIndex:3,marginTop:392,padding:"0 13px 28px",background:"linear-gradient(180deg,transparent 0,rgba(14,24,28,.83) 6%,#121e23 18%)"}}>
            <div style={{height:3,width:34,borderRadius:5,background:"#92aaa0",opacity:.48,margin:"0 auto 10px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:8,letterSpacing:".14em",color:c.mint,fontWeight:800}}>NEAR THE GLOW</div><div style={{fontSize:17,fontWeight:650,letterSpacing:"-.04em",marginTop:3}}>A place to drift into</div></div><ArrowDownRight size={17} color={c.mint}/></div>
            <div onClick={()=>notify("Opening Mira House · sample venue")} style={{...pane,marginTop:10,padding:0,overflow:"hidden",display:"flex",cursor:"pointer"}}>
              <img src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee sample" style={{width:92,height:82,objectFit:"cover"}}/>
              <div style={{padding:"9px 10px",flex:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b style={{fontSize:12}}>Mira House Coffee</b><ArrowRight size={13} color={c.mint}/></div><div style={{fontSize:8,color:c.soft,marginTop:4}}>Coffee & bakery · River District</div><div style={{fontSize:8,color:c.gold,marginTop:7}}>● 86 weekly interactions <span style={{color:c.dim}}>· sample</span></div></div>
            </div>
            <div style={{display:"flex",gap:7,marginTop:9}}>{action("Check in",()=>notify("Demo check-in · nothing saved"),true)}{action("Leaderboard",()=>notify("Sample local leaderboard"))}<span style={{fontSize:8,color:c.dim,alignSelf:"center",marginLeft:"auto"}}><Check size={10} color={c.mint}/> Location + Bluetooth ready</span></div>
            <div style={{display:"flex",gap:8,marginTop:9}}>
              <div style={{...pane,flex:1,padding:"8px 10px"}}><span style={{fontSize:8,color:c.dim}}>THIS WEEK</span><div style={{fontSize:9,marginTop:3}}><b>3 new</b><span style={{color:c.dim}}> · </span><b>2 repeat</b></div></div>
              <div style={{...pane,flex:1,padding:"8px 10px",display:"flex",alignItems:"center",gap:7}}><Users size={13} color={c.mint}/><span style={{fontSize:8,color:c.soft}}>1 incoming<br/>request to review</span></div>
            </div>
            <div style={{fontSize:8,color:c.dim,margin:"11px 2px 5px",letterSpacing:".1em",fontWeight:800}}>COMMUNITY, RECENTLY</div>
            <div style={{...pane,padding:"9px 10px",fontSize:9,color:c.soft,lineHeight:1.5}}>Mira House · “The community table is open all weekend.”</div>
          </div>
        </div>
        {toast&&<div style={{position:"absolute",zIndex:8,bottom:19,left:"50%",transform:"translateX(-50%)",whiteSpace:"nowrap",background:"#d9f0df",color:"#183126",padding:"9px 13px",borderRadius:18,fontSize:9,fontWeight:700}}>{toast}</div>}
      </Phone>

      <Phone label="02 · Venue / Mira House Coffee">
        <div style={{height:mapHeight,overflowY:"auto",scrollbarWidth:"none",background:c.night,position:"relative"}}>
          <div style={{height:238,position:"relative",overflow:"hidden"}}>
            <img src="/__mockup/images/coffee-shop.png" alt="Mira House Coffee sample cover photo" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center 45%",filter:"saturate(.8) brightness(.82)"}}/>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(8,17,20,.45),rgba(12,23,26,.08) 37%,rgba(12,22,26,.97))"}}/>
            <button onClick={()=>notify("Back to the sample neighborhood map")} style={{position:"absolute",top:11,left:12,width:32,height:32,border:0,borderRadius:50,background:"rgba(16,29,32,.82)",color:c.text,display:"grid",placeItems:"center",cursor:"pointer"}}><ArrowLeft size={15}/></button>
            <button onClick={()=>{setSaved(!saved);notify(saved?"Removed from saved places":"Saved for another visit")}} style={{position:"absolute",top:11,right:12,width:32,height:32,border:0,borderRadius:50,background:"rgba(16,29,32,.82)",color:saved?c.gold:c.text,display:"grid",placeItems:"center",cursor:"pointer"}}><Bookmark size={14} fill={saved?c.gold:"none"}/></button>
            <div style={{position:"absolute",left:15,right:12,bottom:15}}>
              <div style={{fontSize:8,fontWeight:800,letterSpacing:".17em",color:c.mint}}>A PLACE THAT HOLDS THE NIGHT</div>
              <div style={{fontSize:25,fontWeight:700,letterSpacing:"-.055em",marginTop:4}}>Mira House Coffee</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:7,fontSize:9,color:"#d6e1da"}}><span style={{display:"flex",gap:5,alignItems:"center"}}><Coffee size={11} color={c.mint}/> Coffee & bakery · River District</span><span style={{display:"flex",gap:3,alignItems:"center",color:c.gold}}><Star size={11} fill={c.gold}/> 4.9 <span style={{color:"#d6e1da"}}>(128)</span></span></div>
            </div>
          </div>
          <div style={{padding:"0 13px 24px",marginTop:-1}}>
            <div style={{display:"flex",gap:7,padding:"10px 0 1px"}}>{action("Check in here",()=>notify("Demo check-in · nothing saved"),true)}{action("Directions",()=>notify("Sample directions only"))}<span style={{fontSize:8,color:c.dim,alignSelf:"center",marginLeft:"auto"}}>1.2 km</span></div>
            <div style={{...pane,marginTop:10,padding:"10px 11px",display:"flex",gap:10,alignItems:"center",background:"linear-gradient(120deg,#263a3b,#1c2d31)"}}>
              <div style={{width:34,height:34,borderRadius:11,background:"rgba(225,189,130,.12)",display:"grid",placeItems:"center",color:c.gold,flexShrink:0}}><Zap size={15}/></div>
              <div style={{flex:1}}><div style={{fontSize:8,color:c.gold,fontWeight:800,letterSpacing:".11em"}}>MIRA HOUSE REGULAR · ACTIVE</div><div style={{fontSize:13,fontWeight:700,marginTop:3}}>Coffee & pastry for two</div><div style={{fontSize:8,color:c.soft,marginTop:3}}>A little thank-you for showing up.</div></div>
            </div>
            <div style={{fontSize:9,lineHeight:1.5,color:c.soft,padding:"9px 2px 1px"}}><b style={{color:c.text}}>A neighborhood living room.</b> Mira House brings local makers and regulars together over careful coffee and a shared table.</div>
            <div style={{...pane,marginTop:8,padding:"9px 10px",display:"flex",gap:8,borderColor:"rgba(163,223,194,.2)"}}>
              <span style={{fontSize:8,letterSpacing:".1em",color:c.mint,fontWeight:800}}>PINNED</span><div><b style={{fontSize:10}}>A note from the team</b><div style={{fontSize:9,color:c.soft,lineHeight:1.45,marginTop:3}}>The community table is open all weekend. Come say hello.</div></div>
            </div>
            {title("Regulars this month","LOCAL LEADERBOARD")}
            <div style={{...pane,padding:"8px 7px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {[["01","Taylor M.","12","#799783"],["02","Jordan E.","9","#9a7868"],["03","Alex H.","7","#748c9b"]].map(([rank,name,count,color])=><div key={rank} style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:7,color:c.gold,fontWeight:800}}>{rank}</span><span style={{width:23,height:23,borderRadius:50,background:color,display:"grid",placeItems:"center",fontSize:7,fontWeight:800}}>{name.split(" ").map(x=>x[0]).join("")}</span><span><b style={{display:"block",fontSize:7}}>{name}</b><small style={{fontSize:7,color:c.dim}}>{count} visits</small></span></div>)}
              <button onClick={()=>notify("Sample leaderboard")} style={{border:0,background:"none",color:c.mint,cursor:"pointer"}}><ChevronRight size={13}/></button>
            </div>
            {title("On the calendar","UPCOMING")}
            <div style={{...pane,overflow:"hidden"}}>
              <img src="/__mockup/images/coffee-shop.png" alt="A warm evening gathering at Mira House" style={{width:"100%",height:68,objectFit:"cover",objectPosition:"center 56%",filter:"brightness(.78) saturate(.8)"}}/>
              <div style={{padding:"8px 9px 9px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><b style={{fontSize:12}}>Saturday Vinyl & Slow Pour</b><CalendarDays size={12} color={c.mint}/></div><div style={{fontSize:8,color:c.soft,marginTop:4}}>Sat · 10 am · 31 going</div><div style={{fontSize:8,color:c.dim,marginTop:3}}>Bring a record, meet a neighbor, stay for a cup.</div><div style={{marginTop:7}}>{action(rsvp?"You’re on the list":"RSVP · free",()=>setRsvp(!rsvp),rsvp)}</div></div>
            </div>
            <div style={{...pane,marginTop:6,padding:"8px 10px",display:"flex",alignItems:"center",gap:8}}><CalendarDays size={13} color={c.mint}/><div style={{flex:1}}><b style={{fontSize:9}}>Meet the Makers Morning</b><div style={{fontSize:8,color:c.dim,marginTop:2}}>Next week · neighborhood artists & makers</div></div><button onClick={()=>notify("Sample event details")} style={{border:0,background:"none",color:c.mint,cursor:"pointer"}}><ChevronRight size={13}/></button></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",margin:"13px 1px 7px"}}><b style={{fontSize:15,letterSpacing:"-.03em"}}>Guestbook</b><span style={{fontSize:8,color:c.mint,fontWeight:800}}>4.9 · 128 REVIEWS</span></div>
            <div style={{...pane,padding:"9px 10px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:23,height:23,borderRadius:50,background:"#799783",display:"grid",placeItems:"center",fontSize:7,fontWeight:800}}>TM</span><b style={{fontSize:9}}>Taylor M.</b><span style={{fontSize:8,color:c.gold}}>★★★★★</span><span style={{marginLeft:"auto",fontSize:7,color:c.dim}}>2 days ago</span></div><div style={{fontSize:9,lineHeight:1.45,color:c.soft,margin:"6px 0 0 29px"}}>A lovely place to slow down and meet the neighborhood.</div></div>
            <div style={{fontSize:8,color:c.dim,marginTop:8,display:"flex",alignItems:"center",gap:5}}><ShieldCheck size={10} color={c.mint}/> Illustrative guestbook · sample only</div>
            <div style={{marginTop:10,padding:"9px 10px",borderTop:`1px solid ${c.edge}`,fontSize:8,color:c.dim,lineHeight:1.45}}>TODAY · OPEN UNTIL 8 PM<br/>CONTACT · (415) 555-0142 · mirahouse.example</div>
          </div>
        </div>
        {toast&&<div style={{position:"absolute",zIndex:8,bottom:19,left:"50%",transform:"translateX(-50%)",whiteSpace:"nowrap",background:"#d9f0df",color:"#183126",padding:"9px 13px",borderRadius:18,fontSize:9,fontWeight:700}}>{toast}</div>}
      </Phone>
    </div>
    <footer style={{position:"absolute",bottom:14,left:0,right:0,textAlign:"center",fontSize:8,color:"#8fa39a",letterSpacing:".08em"}}>SAFE SAMPLE CONTENT · POOLED VENUE ACTIVITY ONLY · PREVIEW INTERACTIONS STAY LOCAL</footer>
  </main>;
}
