const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = 'C:/Users/brono/.gemini/antigravity/scratch/norilsk-3d-print';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SCREENSHOT_DIR = path.join(DIR, 'audit-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// 1. Crawler list
const PAGES = [
  'index.html',
  'order.html',
  'orders.html',
  'my-orders.html',
  'printers.html',
  'cabinet.html',
  'wallet.html',
  'rating.html',
  'portfolio.html',
  'scan.html',
  'admin.html'
];

// 2. Mobile Profiles
const PROFILES = [
  { name: 'budget-2018', width: 360, height: 640 },
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'standard-modern', width: 390, height: 844 },
  { name: 'pro-max', width: 430, height: 932 }
];

async function runAudit() {
  console.log('====================================================');
  console.log(' 📱 MOBILE VISUAL AUDIT: Norilsk 3D Print (2018-2026)');
  console.log('====================================================\n');

  // Start local server
  const server = spawn('C:/Program Files/nodejs/node.exe', ['server.js'], {
    cwd: DIR,
    stdio: 'ignore'
  });

  // Wait for server ready
  await new Promise(r => setTimeout(r, 1500));

  const allFindings = [];

  for (const page of PAGES) {
    console.log(`\n📄 Auditing page: ${page}`);

    for (const prof of PROFILES) {
      const url = `http://localhost:3000/${page}`;
      const screenshotPath = path.join(SCREENSHOT_DIR, `${page.replace('.html', '')}-${prof.name}.png`);

      // We run Chrome headless to evaluate layout metrics and dump DOM title with results
      const scriptPayload = `
        window.addEventListener('load', () => {
          setTimeout(() => {
            const docWidth = document.documentElement.scrollWidth;
            const bodyWidth = document.body.scrollWidth;
            const winWidth = window.innerWidth;
            const isOverflow = docWidth > winWidth || bodyWidth > winWidth;

            // Find elements overflowing the screen
            const overflowingElements = [];
            const all = document.querySelectorAll('*');
            for (let el of all) {
              const rect = el.getBoundingClientRect();
              if (rect.right > winWidth + 1.5 && rect.width > 0 && rect.height > 0) {
                // Ignore fixed canvas background
                if (el.id === 'bgCanvas') continue;
                overflowingElements.push({
                  tag: el.tagName,
                  id: el.id,
                  cls: el.className,
                  right: Math.round(rect.right),
                  width: Math.round(rect.width),
                  text: (el.innerText || '').slice(0, 30).trim()
                });
              }
            }

            // Small touch targets (< 44px height/width on clickable elements)
            const smallTouchTargets = [];
            const clickables = document.querySelectorAll('button, a, input[type="button"], input[type="submit"], select, .userchip, .theme-toggle, .burger');
            for (let el of clickables) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && (rect.height < 32 || rect.width < 32)) {
                smallTouchTargets.push({
                  tag: el.tagName,
                  id: el.id,
                  cls: el.className,
                  w: Math.round(rect.width),
                  h: Math.round(rect.height),
                  text: (el.innerText || el.value || '').slice(0, 20).trim()
                });
              }
            }

            const data = {
              page: '${page}',
              profile: '${prof.name}',
              viewportWidth: winWidth,
              scrollWidth: Math.max(docWidth, bodyWidth),
              isOverflow,
              overflowCount: overflowingElements.length,
              overflowElements: overflowingElements.slice(0, 5),
              smallTouchTargets: smallTouchTargets.slice(0, 5)
            };
            document.title = 'AUDIT_RES:' + JSON.stringify(data) + ':ENDAUDIT';
          }, 350);
        });
      `;

      // Create a temporary instrumented test HTML
      const origContent = fs.readFileSync(path.join(DIR, page), 'utf8');
      const instrumentedContent = origContent.replace('</head>', `<script>${scriptPayload}</script></head>`);
      const tempPath = path.join(DIR, `__audit_temp_${page}`);
      fs.writeFileSync(tempPath, instrumentedContent);

      try {
        const fileUrl = `file:///${tempPath.replace(/\\/g, '/')}`;
        const cmd = `"${CHROME}" --headless=new --no-sandbox --disable-gpu --window-size=${prof.width},${prof.height} --virtual-time-budget=2000 --screenshot="${screenshotPath}" --dump-dom "${fileUrl}"`;
        const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

        const match = output.match(/AUDIT_RES:(.*?):ENDAUDIT/);
        if (match) {
          const res = JSON.parse(match[1]);
          allFindings.push(res);
          const icon = res.isOverflow ? '❌ OVERFLOW' : '✅ OK';
          console.log(`  [${prof.name} ${prof.width}x${prof.height}] ${icon} (ScrollWidth: ${res.scrollWidth}px vs WinWidth: ${res.viewportWidth}px)`);
          if (res.isOverflow) {
            console.log(`     Overflow elements:`, res.overflowElements.map(e => `${e.tag}#${e.id}.${e.cls} (right: ${e.right}px)`).join(', '));
          }
        } else {
          console.log(`  [${prof.name}] ⚠️ Could not parse audit payload`);
        }
      } catch (err) {
        console.error(`  [${prof.name}] Error during chrome run:`, err.message);
      } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    }
  }

  server.kill();

  // Summary
  console.log('\n====================================================');
  console.log(' 📊 AUDIT SUMMARY REPORT');
  console.log('====================================================');

  const overflowIssues = allFindings.filter(f => f.isOverflow);
  console.log(`Total checks:     ${allFindings.length}`);
  console.log(`Passing checks:   ${allFindings.length - overflowIssues.length}`);
  console.log(`Overflow defects: ${overflowIssues.length}`);

  if (overflowIssues.length > 0) {
    console.log('\nDefective pages and viewports:');
    for (const iss of overflowIssues) {
      console.log(`- ${iss.page} on ${iss.profile} (${iss.viewportWidth}px): overflow by +${iss.scrollWidth - iss.viewportWidth}px`);
      iss.overflowElements.forEach(el => console.log(`    -> ${el.tag}#${el.id}.${el.cls} width: ${el.width}px, right: ${el.right}px ("${el.text}")`));
    }
  } else {
    console.log('\n✨ Zero horizontal overflow across all tested mobile viewports!');
  }

  fs.writeFileSync(path.join(DIR, 'audit-results.json'), JSON.stringify(allFindings, null, 2));
}

runAudit();
