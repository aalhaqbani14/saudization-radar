import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const page = await browser.newPage({locale:'ar-SA',timezoneId:'Asia/Riyadh'});
const url = 'https://www.hrsd.gov.sa/skills-taxonomy/occupations/elementary-occupations';
page.on('request',r=>{if(/occupation|skills|view|api|ajax|pager/i.test(r.url())&&!r.url().includes('fonts'))console.log('REQUEST',r.method(),r.url().slice(0,240));});
page.on('response',r=>{if(/occupation|skills|view|api|ajax|pager/i.test(r.url())&&!r.url().includes('fonts'))console.log('RESPONSE',r.status(),r.url().slice(0,240));});
try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  console.log('TITLE',await page.title());
  await page.waitForSelector('table tbody tr',{timeout:40000});
  const before=await page.locator('table tbody tr').allTextContents();
  console.log('FIRST',JSON.stringify(before.slice(0,3)));
  console.log('NAV',JSON.stringify((await page.locator('nav.pager').first().innerText()).slice(0,250)));
  await page.waitForTimeout(2000);
  console.log('BUTTON COUNT',await page.locator('nav.pager a[data-page="1"]').count());
  await page.locator('nav.pager a[data-page="1"]').first().click({timeout:18000});
  await page.waitForTimeout(5000);
  console.log('URL AFTER',page.url());
  const after=await page.locator('table tbody tr').allTextContents();
  console.log('AFTER',JSON.stringify(after.slice(0,3)));
  console.log('NAV AFTER',JSON.stringify((await page.locator('nav.pager').first().innerText()).slice(0,260)));
  if(before[0]===after[0])throw new Error('Browser pagination did not change official table rows');
}finally{await browser.close();}
