'use strict';
(() => {
  const q = document.getElementById('query');
  const group = document.getElementById('group');
  const results = document.getElementById('results');
  const summary = document.getElementById('summary');
  const more = document.getElementById('more');
  const get = id => document.getElementById(id);
  const safe = value => String(value == null ? '' : value);
  const normalize = value => safe(value).normalize('NFKC')
    .replace(/[\u064b-\u065f\u0670]/g, '').replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim().toLowerCase();
  const create = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = safe(text);
    if (className) el.className = className;
    return el;
  };
  let items = [], groups = new Map(), timeout = null;
  const officialRoot = 'https://www.hrsd.gov.sa/skills-taxonomy/occupations/';
  function validGroupUrl(value) {
    return typeof value === 'string' && value.startsWith(officialRoot) &&
      /^[a-z-]+$/.test(value.slice(officialRoot.length));
  }
  function drawGroups(source) {
    const container = get('groups');
    const fragment = document.createDocumentFragment();
    source.forEach(g => {
      if (!/^[0-9]$/.test(safe(g.id)) || !validGroupUrl(g.url)) return;
      const a = create('a', null, 'group-link');
      a.href = g.url; a.rel = 'noopener noreferrer'; a.target = '_blank';
      a.append(create('strong', g.name), create('span', safe(g.count) + ' مهنة مُعلنة'));
      fragment.append(a);
      const option = create('option', g.name);
      option.value = g.id;
      group.append(option);
      groups.set(g.id, g);
    });
    container.replaceChildren(fragment);
  }
  function render() {
    const term = normalize(q.value);
    const selected = group.value;
    const found = items.filter(r => (!selected || r.group === selected) &&
      (!term || normalize(r.code).includes(term) || normalize(r.title).includes(term)));
    const fragment = document.createDocumentFragment();
    found.slice(0,60).forEach(item => {
      const g = groups.get(item.group);
      const row = create('div', null, 'result');
      const details = create('div');
      details.append(create('strong', item.title), create('small', g ? g.name : 'مجموعة غير محددة'));
      if (item.decisionIds && item.decisionIds.length) {
        details.append(create('div','مرجع قرار توطين مرتبط — الانطباق يحتاج تحققًا','tags'));
      }
      const meta = create('div');
      meta.append(create('code', item.code));
      if (g && validGroupUrl(g.url)) {
        const a = create('a', 'المصدر الوزاري');
        a.href = g.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        const linkWrap = create('div'); linkWrap.append(a); meta.append(linkWrap);
      }
      row.append(details, meta);
      fragment.append(row);
    });
    results.replaceChildren(fragment);
    summary.textContent = found.length ? 'عدد النتائج المطابقة: ' + found.length : 'لا توجد نتائج في النسخة المحلية. تحقق من القائمة الرسمية للوزارة.';
    more.hidden = found.length <= 60;
  }
  async function load() {
    try {
      const response = await fetch('data/occupation-catalog.json');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const db = await response.json();
      if (db.schema !== 1 || !Array.isArray(db.groups) || !Array.isArray(db.items) ||
          !['seed_guides_only','official_group_pages_verified'].includes(db.status)) {
        throw new Error('Invalid catalog metadata');
      }
      const distinct = new Set();
      const filtered = [];
      db.items.forEach(item => {
        if (!/^\d{5,6}$/.test(safe(item.code)) || !safe(item.title).trim() ||
            !/^[0-9]$/.test(safe(item.group)) || distinct.has(item.code)) return;
        distinct.add(item.code);
        filtered.push(item);
      });
      items = filtered;
      drawGroups(db.groups);
      get('loaded-count').textContent = items.length.toLocaleString('en-US');
      get('headline-count').textContent = Number(db.headlineTotal || 2047).toLocaleString('en-US');
      const verified = db.status === 'official_group_pages_verified';
      get('catalog-status').textContent = verified ? 'مكتمل للمجموعات' : 'جزئي';
      get('catalog-status').style.color = verified ? '#087f78' : '#a46c14';
      get('method-note').textContent = verified
        ? 'نسخة مفهرسة من صفحات مجموعات الوزارة؛ التحديث بتاريخ ' + safe(db.updatedAt) +
          '. لا تثبت انطباق قرارات التوطين على SALIC أو صحة الرمز المسجل في قوى.'
        : 'النسخة الحالية جزئية ومستمدة من أدلة قرارات التوطين، وليست فهرس الوزارة الكامل. المهن غير الموجودة هنا ليست بالضرورة غير مستهدفة. استخدم روابط المجموعات الرسمية للتحقق.';
      q.disabled = false; group.disabled = false;
      render();
    } catch(error) {
      get('loaded-count').textContent = '—';
      get('catalog-status').textContent = 'تعذر التحميل';
      summary.textContent = 'تعذر فتح نسخة الرموز المحلية. استخدم رابط الوزارة أعلاه مباشرة.';
    }
  }
  q.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(render, 130);
  });
  group.addEventListener('change', render);
  load();
})();
