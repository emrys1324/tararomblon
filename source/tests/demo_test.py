import asyncio, sys
from playwright.async_api import async_playwright
import os
P='file://'+os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','out','preview')+'/'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); errs=[]
    ctx=await b.new_context(viewport={'width':400,'height':860}); pg=await ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(P+'index.html'); await pg.wait_for_timeout(1200)
    t=await pg.inner_text('body'); assert 'Where to eat' in t and 'Ride around Romblon' in t, 'home'
    # customer core calls via api() in demo, including concurrent ones
    r=await pg.evaluate("""async()=>{ const a=await api('sendOtp',{email:'ana@demo.ph'}); const v=await api('verifyOtp',{email:'ana@demo.ph',code:a.demoCode});
      await api('saveProfile',{token:v.token,profile:{name:'Ana',phone:'09171234567',address:'Makati'}});
      const [x,y,z]=await Promise.all([api('me',{token:v.token}),api('getCatalog',{}),api('send',{token:v.token,inquiryBizId:'pahuway',cartBizIds:['pahuway'],text:'hello'})]);
      const it=CAT.food.items.find(i=>i.available!==false);
      const f=await api('createBooking',{token:v.token,kind:'food',fulfillment:'pickup',payMethod:'pickup',lines:[{itemId:it.id,qty:1,addons:[]}]});
      return [x.profile.name, f.bookings[0].status, (await api('myBookings',{token:v.token})).bookings.length] }""")
    print('customer api', r); assert r[0]=='Ana' and r[1]=='New'
    for page,email,portal in (('admin.html','admin1@mjv.demo','admin'),('merchant.html','staff@pahuway.demo','merchant'),('rider.html','rider1@rider.demo','rider')):
      q=await ctx.new_page(); q.on('pageerror',lambda e:errs.append(page+': '+str(e)))
      await q.goto(P+page); await q.wait_for_timeout(800)
      tok=await q.evaluate(f"""async()=>{{ const a=await api('staffSendOtp',{{email:'{email}',portal:'{portal}'}}); return (await api('staffVerifyOtp',{{email:'{email}',code:a.demoCode}})).token }}""")
      n=await q.evaluate("async(t)=>{ const r=await api('feed',{token:t,since:''}); return r.events.length }", tok)
      print(page,'signed in, feed events',n)
      # sign in through the UI and use the main screens
      await q.evaluate("localStorage.removeItem('tr5_staff_admin');localStorage.removeItem('tr5_staff_merchant');localStorage.removeItem('tr5_staff_rider')"); await q.reload(); await q.wait_for_timeout(600)
      await q.fill('#lgE', email); await q.click('#lgBtn'); await q.wait_for_selector('#lgV'); await q.click('#lgV'); await q.wait_for_timeout(1500)
      txt=' '.join((await q.inner_text('#root')).split()); print('  ui:', txt[:150]); assert 'Send code' not in txt
      tabs=q.locator('.tabs button, .ptabs button, nav button')
      for i in range(min(await tabs.count(),9)):
        try: await tabs.nth(i).click(timeout=1500); await q.wait_for_timeout(350)
        except Exception as e: pass
    print('errors:',errs); await b.close(); sys.exit(1 if errs else 0)
asyncio.run(main())
