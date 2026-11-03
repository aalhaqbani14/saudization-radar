/* Pure, conservative executive-report data model.
 * A classification is relative to the SELECTED decision groups, not a national
 * "not subject to Saudization" determination. No network or personal data.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SaudizationReportModel = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';
  const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
  const cleanExtra = input => String(input || '').split(/[\r\n,،;؛]+/)
    .map(x => x.trim()).filter(Boolean).slice(0, 150)
    .map(x => x.slice(0, 125));

  function build(decisions, occupations, graceRecords, selectedIds, extraText = '') {
    const allDecisions = Array.isArray(decisions) ? decisions : [];
    const allOccupations = Array.isArray(occupations) ? occupations : [];
    const selected = new Set(selectedIds || []);
    const picked = allDecisions.filter(d => selected.has(d.id));
    const choice = new Map(picked.map(d => [d.id, d]));
    const known = new Map(allDecisions.map(d => [d.id, d]));
    const targeted = [], outside = [];
    for (const item of allOccupations) {
      const matches = (item.decisionIds || []).filter(id => selected.has(id));
      if (matches.length) targeted.push({...item, matched: matches});
      else outside.push({...item, matched: []});
    }
    // Editorial summary job titles are supplementary, never claimed complete
    // and must not be treated as codes proven by ministerial tables.
    const indexedNames = new Set(targeted.map(o => normalize(o.title)));
    const mentioned = [];
    const seenMentioned = new Set();
    for (const d of picked) {
      for (const title of d.jobs || []) {
        const key = normalize(title);
        if (!key || indexedNames.has(key) || seenMentioned.has(d.id + ':' + key)) continue;
        seenMentioned.add(d.id + ':' + key);
        mentioned.push({decisionId:d.id, decisionTitle:d.title, title, note:'مسمى ورد في ملخص القرار، وليس إثباتاً لاكتمال الجدول الرسمي'});
      }
    }
    const grace = [];
    const byDecisionGrace = Array.isArray(graceRecords) ? graceRecords : [];
    const stages = [];
    for (const d of picked) {
      const matching = byDecisionGrace.filter(g => g.decisionId === d.id);
      if (matching.length) {
        for (const g of matching) grace.push({...g, decisionTitle:d.title});
      } else {
        grace.push({decisionId:d.id,decisionTitle:d.title,scope:d.scope || d.min || '',
          start:d.issueDate || null,end:d.effective || null,duration:'مدة السماح غير موثقة في السجل',
          basis:'تاريخ الإصدار والنفاذ لا يثبت وحده وجود مهلة سماح نظامية',
          status:'unverified',source:d.source});
      }
      const entries = Array.isArray(d.phases) && d.phases.length ? d.phases :
        Array.isArray(d.history) && d.history.length ? d.history : [{date:d.effective,label:'تاريخ النفاذ في الملخص',rate:d.rate}];
      for (const p of entries) {
        stages.push({decisionId:d.id, decisionTitle:d.title, date:p.date||null,
          rate:p.rate||d.rate||'', label:p.label||'مرحلة تطبيق',
          scope:p.scope||d.scope||'', note:p.note||'', verified:p.verified,
          source:p.source||d.source, stageKind:p.kind||'phase'});
      }
    }
    stages.sort((a,b) => (a.date||'9999').localeCompare(b.date||'9999') || a.decisionTitle.localeCompare(b.decisionTitle,'ar'));
    const manual = [];
    const seenManual = new Set();
    for (const text of cleanExtra(extraText)) {
      const key = normalize(text);
      if (seenManual.has(key)) continue;
      seenManual.add(key);
      const item = allOccupations.find(o => o.code === text || normalize(o.title) === key);
      const group = item ? (item.decisionIds||[]).filter(id => selected.has(id)) : [];
      const status = !item ? 'unknown' : group.length ? 'targeted' : 'out-of-scope';
      manual.push({input:text,code:item?.code||'غير موثق',title:item?.title||text,status,
        matched:group.map(id=>choice.get(id)?.title||id),
        otherDecisions:item && !group.length ? item.decisionIds.map(id=>known.get(id)?.title||id) : [],
        notice:status==='unknown'?'غير موجودة بالفهرس الجزئي؛ لا يمكن الحكم على خضوعها':
               status==='targeted'?'مذكورة ضمن مجموعة قرار مختارة في الفهرس؛ انطباق الحكم يتطلب تحقق الشروط':
               'خارج القرارات المختارة فقط، لكنها مرتبطة بقرارات أخرى في الفهرس'});
    }
    return {picked, targeted, outside, mentioned, grace, stages, manual,
      coverage: {indexCount:allOccupations.length, knownGroups:allDecisions.length,
        selectedGroups:picked.length, targetedCount:targeted.length,
        outsideCount:outside.length, unindexedSummaries:mentioned.length,
        unknownManual:manual.filter(x=>x.status==='unknown').length}};
  }
  return {build, cleanExtra, normalize};
});
