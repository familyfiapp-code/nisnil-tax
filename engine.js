/* Nisnil Income Tax – multi-year tax engine (individuals, resident).
   Covers AY 2023-24 to AY 2027-28: slabs, rebate 87A + marginal relief, capital gains rates (incl. the
   23-Jul-2024 split for AY 2025-26), surcharge, cess, interest u/s 234A/234B/234C, fee u/s 234F,
   additional tax on updated returns u/s 140B (ITR-U), filing-route checks and ITR form selection.
   Pure functions: works in the browser (window.TaxEngine) and in Node (module.exports). */
(function (root) {
  'use strict';
  var INF = Infinity;
  var N = function (v) { var x = Number(String(v == null ? '' : v).replace(/[,₹\s]/g, '')); return isFinite(x) ? x : 0; };
  var OLD = { below60: [[250000, 0], [500000, .05], [1000000, .20], [INF, .30]], '60to79': [[300000, 0], [500000, .05], [1000000, .20], [INF, .30]], '80plus': [[500000, 0], [1000000, .20], [INF, .30]] };
  var NEW_2223 = [[250000, 0], [500000, .05], [750000, .10], [1000000, .15], [1250000, .20], [1500000, .25], [INF, .30]];
  var NEW_2324 = [[300000, 0], [600000, .05], [900000, .10], [1200000, .15], [1500000, .20], [INF, .30]];
  var NEW_2425 = [[300000, 0], [700000, .05], [1000000, .10], [1200000, .15], [1500000, .20], [INF, .30]];
  var NEW_2526 = [[400000, 0], [800000, .05], [1200000, .10], [1600000, .15], [2000000, .20], [2400000, .25], [INF, .30]];
  var due = function (a, b) { return { 'ITR-1': a, 'ITR-2': a, 'ITR-3': b || a, 'ITR-4': b || a }; };
  var YEARS = {
    'AY 2023-24': { fy: '2022-23', start: 2023, newSlabs: NEW_2223, newStd: 0, rebLimitNew: 500000, rebMaxNew: 12500, mrNew: false, maxSurNew: .37, defaultNew: false, r111: .15, r112: .10, ex112: 100000, due: due('2023-07-31'), itr1Ltcg: false },
    'AY 2024-25': { fy: '2023-24', start: 2024, newSlabs: NEW_2324, newStd: 50000, rebLimitNew: 700000, rebMaxNew: 25000, mrNew: true, maxSurNew: .25, defaultNew: true, r111: .15, r112: .10, ex112: 100000, due: due('2024-07-31'), itr1Ltcg: false },
    'AY 2025-26': { fy: '2024-25', start: 2025, newSlabs: NEW_2425, newStd: 75000, rebLimitNew: 700000, rebMaxNew: 25000, mrNew: true, maxSurNew: .25, defaultNew: true, r111: .20, r112: .125, ex112: 125000, r111Pre: .15, r112Pre: .10, split: true, due: due('2025-09-16'), itr1Ltcg: true },
    'AY 2026-27': { fy: '2025-26', start: 2026, newSlabs: NEW_2526, newStd: 75000, rebLimitNew: 1200000, rebMaxNew: 60000, mrNew: true, maxSurNew: .25, defaultNew: true, r111: .20, r112: .125, ex112: 125000, due: due('2026-07-31', '2026-08-31'), itr1Ltcg: true },
    'AY 2027-28': { fy: '2026-27', start: 2027, newSlabs: NEW_2526, newStd: 75000, rebLimitNew: 1200000, rebMaxNew: 60000, mrNew: true, maxSurNew: .25, defaultNew: true, r111: .20, r112: .125, ex112: 125000, due: due('2027-07-31', '2027-08-31'), itr1Ltcg: true }
  };
  var AYS = Object.keys(YEARS);
  function rules(ay) { return YEARS[ay] || YEARS['AY 2026-27']; }
  function slab(inc, s) { var t = 0, prev = 0; for (var i = 0; i < s.length; i++) { var lim = s[i][0], r = s[i][1]; if (inc > prev) t += (Math.min(inc, lim) - prev) * r; prev = lim; } return t; }

  /* ---------- tax for one regime ---------- */
  function compute(f, regime, ayOverride) {
    var ay = ayOverride || f.ay || 'AY 2026-27', Y = rules(ay);
    var old = regime === 'old';
    var sl = old ? OLD[f.age] || OLD.below60 : Y.newSlabs, exLimit = sl[0][0];
    var sal = N(f.salary), std = sal > 0 ? Math.min(sal, old ? 50000 : Y.newStd) : 0;
    var exA = old ? N(f.exemptAllow) : 0, pt = old ? N(f.profTax) : 0;
    var salInc = Math.max(0, sal - exA - std - pt);
    var hp = 0;
    if (f.hpType === 'self') hp = old ? -Math.min(N(f.hpInterest), 200000) : 0;
    else if (f.hpType === 'let') { var nav = Math.max(0, N(f.rent) - N(f.municipal)); hp = nav * 0.7 - N(f.hpInterest); hp = old ? Math.max(hp, -200000) : Math.max(hp, 0); }
    var oth = N(f.savingsInt) + N(f.fdInt) + N(f.dividend) + N(f.otherInc);
    var biz = N(f.biz) + N(f.bizRegular), stO = N(f.stcgOther);
    var normal = Math.max(0, salInc + hp + oth + biz + stO);
    var s111 = N(f.stcg111A), l112 = N(f.ltcg112A), lO = N(f.ltcgOther);
    var special = s111 + l112 + lO, gti = normal + special;
    var ded = N(f.d80CCD2);
    if (old) {
      var tta = f.age === 'below60' ? Math.min(N(f.savingsInt), 10000) : Math.min(N(f.savingsInt) + N(f.fdInt), 50000);
      ded += Math.min(N(f.d80C), 150000) + Math.min(N(f.d80CCD1B), 50000) + N(f.d80D) + N(f.d80G) + N(f.dOther) + tta;
    }
    ded = Math.min(ded, normal);
    var normalTI = Math.round(Math.max(0, normal - ded) / 10) * 10;
    var total = normalTI + special;
    var taxN = slab(normalTI, sl);
    /* special-rate income: basic exemption shortfall (residents) is set off first */
    var unused = Math.max(0, exLimit - normalTI);
    var take = function (x) { var a = Math.min(unused, x); unused -= a; return x - a; };
    var t111 = 0, t112 = 0;
    if (Y.split) {
      var s111pre = Math.min(N(f.stcg111A_pre), s111), s111post = s111 - s111pre;
      t111 = Y.r111Pre * take(s111pre) + Y.r111 * take(s111post);
      var l112pre = Math.min(N(f.ltcg112A_pre), l112), l112post = l112 - l112pre;
      var ex = Y.ex112, e1 = Math.min(ex, l112post); ex -= e1; var e2 = Math.min(ex, l112pre);
      t112 = Y.r112 * take(l112post - e1) + Y.r112Pre * take(l112pre - e2);
    } else {
      t111 = Y.r111 * take(s111);
      t112 = Y.r112 * take(Math.max(0, l112 - Y.ex112));
    }
    var tLO = (Y.start >= 2025 ? .125 : .20) * take(lO);
    var taxS = t111 + t112 + tLO;
    /* rebate u/s 87A: never on 112A / other LTCG; new regime from AY 2024-25: slab income only */
    var reb = 0, mr = 0;
    if (old) { if (total <= 500000) reb = Math.min(taxN + t111, 12500); }
    else {
      var base = Y.start >= 2024 ? taxN : taxN + t111;
      if (total <= Y.rebLimitNew) reb = Math.min(base, Y.rebMaxNew);
      else if (Y.mrNew && special === 0 && taxN > total - Y.rebLimitNew) mr = taxN - (total - Y.rebLimitNew);
    }
    var before = Math.max(0, taxN + taxS - reb - mr);
    var sr = 0, maxS = old ? .37 : Y.maxSurNew;
    if (total > 50000000) sr = maxS; else if (total > 20000000) sr = .25; else if (total > 10000000) sr = .15; else if (total > 5000000) sr = .10;
    var srSp = Math.min(sr, .15);
    var surch = total > 5000000 ? Math.max(0, taxN - reb - mr + tLO) * sr + (t111 + t112) * srSp : 0;
    var cess = (before + surch) * 0.04;
    var liab = Math.round((before + surch + cess) / 10) * 10;
    var tds = N(f.tds) + N(f.tdsOthAmt), tcs = N(f.tcs), adv = N(f.advTax), sat = N(f.saTax);
    var paid = tds + tcs + adv + sat;
    var r = { ay: ay, regime: regime, sal: sal, exA: exA, std: std, pt: pt, salInc: salInc, hp: hp, oth: oth, biz: biz, stO: stO, special: special, s111: s111, l112: l112, lO: lO, gti: gti, ded: ded, total: total, taxN: taxN, taxS: taxS, t111: t111, t112: t112, tLO: tLO, reb: reb, mr: mr, surch: surch, cess: cess, liab: liab, tds: tds, tcs: tcs, adv: adv, sat: sat, paid: paid, surchargeNote: total > 5000000 };
    var x = charges(f, r, Y);
    for (var k in x) r[k] = x[k];
    r.net = r.liab + r.i234A + r.i234B + r.i234C + r.f234F + r.addTax - paid;
    return r;
  }

  /* ---------- dates ---------- */
  function D(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function iso(o) { return o.y + '-' + String(o.m).padStart(2, '0') + '-' + String(o.d).padStart(2, '0'); }
  function cmp(a, b) { return (a.y - b.y) * 10000 + (a.m - b.m) * 100 + (a.d - b.d); }
  function addDay(o) { var t = new Date(Date.UTC(o.y, o.m - 1, o.d + 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
  /* months or part of a month, start and end inclusive */
  function months(S, E) { if (cmp(E, S) < 0) return 0; var full = (E.y - S.y) * 12 + (E.m - S.m); return E.d >= S.d ? full + 1 : full; }
  var h100 = function (v) { return Math.max(0, Math.floor(v / 100) * 100); };
  function todayISO() { var t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }

  /* ---------- interest, fee, additional tax ---------- */
  function charges(f, r, Y) {
    var out = { i234A: 0, i234B: 0, i234C: 0, f234F: 0, addTax: 0, addRate: 0, months234A: 0, months234B: 0, monthsU: 0, notes: [], assessed: 0, dueDate: '', fileDate: '' };
    var itr = f.itr || 'ITR-1';
    var dueS = Y.due[itr] || Y.due['ITR-1'], due = D(dueS), fd = D(f.fileDate) || D(todayISO());
    out.dueDate = dueS; out.fileDate = iso(fd);
    var assessed = Math.max(0, r.liab - r.tds - r.tcs);
    out.assessed = assessed;
    var hasBiz = N(f.biz) + N(f.bizRegular) > 0;
    var noAdvTax = (f.age === '60to79' || f.age === '80plus') && !hasBiz;
    /* advance tax by instalment dates (cumulative). If not split, all advance tax counts as paid by 15 March. */
    var a1 = N(f.adv1), a2 = N(f.adv2), a3 = N(f.adv3), a4 = N(f.adv4), advT = r.adv;
    var split = a1 + a2 + a3 + a4 > 0;
    var c1 = split ? a1 : 0, c2 = split ? a1 + a2 : 0, c3 = split ? a1 + a2 + a3 : 0, c4 = split ? a1 + a2 + a3 + a4 : advT;
    if (split) advT = c4;
    if (!noAdvTax && assessed >= 10000) {
      /* 234C */
      var i = 0;
      if (c1 < .12 * assessed) i += h100(.15 * assessed - c1) * .03;
      if (c2 < .36 * assessed) i += h100(.45 * assessed - c2) * .03;
      if (c3 < .75 * assessed) i += h100(.75 * assessed - c3) * .03;
      if (c4 < assessed) i += h100(assessed - c4) * .01;
      out.i234C = Math.round(i);
      if (r.special > 0 || N(f.dividend) > 0) out.notes.push('234C assumes capital gains and dividends were known from the start of the year. If they arose later, 234C is lower: check the dates.');
      /* 234B */
      if (advT < .9 * assessed) {
        var start = { y: Y.start, m: 4, d: 1 }, satD = D(f.saTaxDate);
        var short = assessed - advT;
        if (r.sat > 0 && satD && cmp(satD, fd) < 0) {
          var m1 = months(start, satD); out.i234B = h100(short) * .01 * m1;
          var rest = short - r.sat;
          if (rest > 0) out.i234B += h100(rest) * .01 * Math.max(0, months(start, fd) - m1);
          out.months234B = months(start, fd);
        } else { out.months234B = months(start, fd); out.i234B = h100(short) * .01 * out.months234B; }
        out.i234B = Math.round(out.i234B);
      }
    }
    /* 234A + 234F: return filed after the due date */
    var late = cmp(fd, due) > 0;
    if (late) {
      var from = addDay(due), satD2 = D(f.saTaxDate);
      var paidByDue = r.sat > 0 && satD2 && cmp(satD2, due) <= 0 ? r.sat : 0;
      var base = Math.max(0, assessed - advT - paidByDue);
      if (base > 0) {
        if (r.sat > paidByDue && satD2 && cmp(satD2, due) > 0 && cmp(satD2, fd) < 0) {
          var m1a = months(from, satD2);
          out.i234A = h100(base) * .01 * m1a + h100(Math.max(0, base - r.sat)) * .01 * Math.max(0, months(from, fd) - m1a);
        } else out.i234A = h100(base) * .01 * months(from, fd);
        out.i234A = Math.round(out.i234A);
      }
      out.months234A = months(from, fd);
      var exLim = (r.regime === 'old' ? (OLD[f.age] || OLD.below60) : Y.newSlabs)[0][0];
      /* no fee where filing was not compulsory: income before Chapter VI-A deductions within the exemption limit */
      out.f234F = r.gti <= exLim ? 0 : r.total <= 500000 ? 1000 : 5000;
      if (!out.f234F) out.notes.push('No 234F fee: income is within the basic exemption limit, so filing was not compulsory.');
    }
    /* updated return u/s 139(8A): additional tax u/s 140B */
    if (String(f.fileSec) === 'U') {
      var endAY = { y: Y.start + 1, m: 3, d: 31 };
      var mU = months(addDay(endAY), fd); out.monthsU = cmp(fd, endAY) <= 0 ? 0 : mU;
      var rate = out.monthsU <= 12 ? .25 : out.monthsU <= 24 ? .50 : out.monthsU <= 36 ? .60 : out.monthsU <= 48 ? .70 : 0;
      out.addRate = rate;
      var payable = r.liab + out.i234A + out.i234B + out.i234C - r.tds - r.tcs - advT;
      var earlier = f.origFiled === 'Y' ? N(f.origTaxPaid) - N(f.origRefund) : 0;
      var baseU = payable - earlier;
      if (rate > 0 && baseU > 0) out.addTax = Math.round(baseU * rate);
      out.baseU = baseU;
    }
    return out;
  }

  /* ---------- filing routes allowed on a date ---------- */
  function routes(f, ay, itr, onDate) {
    var Y = rules(ay), fd = D(onDate) || D(todayISO()), due = D(Y.due[itr || 'ITR-1'] || Y.due['ITR-1']);
    var belatedEnd = { y: Y.start, m: 12, d: 31 }, endAY = { y: Y.start + 1, m: 3, d: 31 };
    var mU = cmp(fd, endAY) <= 0 ? 0 : months(addDay(endAY), fd);
    return {
      original: cmp(fd, due) <= 0,
      belated: cmp(fd, due) > 0 && cmp(fd, belatedEnd) <= 0,
      revised: cmp(fd, belatedEnd) <= 0,
      updated: mU <= 48 && cmp(fd, { y: Y.start, m: 4, d: 1 }) >= 0,
      updatedMonths: mU,
      updatedRate: mU <= 12 ? 25 : mU <= 24 ? 50 : mU <= 36 ? 60 : mU <= 48 ? 70 : 0,
      condonation: true,
      due: iso(due), belatedEnd: iso(belatedEnd), updatedEnd: (Y.start + 5) + '-03-31'
    };
  }

  /* ---------- checks for the chosen route ---------- */
  function checkRoute(f, comp) {
    var E = [], W = [], sec = String(f.fileSec || '11'), ay = f.ay || 'AY 2026-27';
    var rt = routes(f, ay, f.itr, f.fileDate || todayISO());
    if (sec === '11' && !rt.original) E.push('The due date (' + rt.due + ') has passed: choose Belated, Updated (ITR-U) or 119(2)(b).');
    if (sec === '12' && !rt.belated) E.push(rt.original ? 'Still before the due date: file as Original.' : 'The belated-return window closed on ' + rt.belatedEnd + '. Only an updated return (ITR-U) or a 119(2)(b) condonation is possible.');
    if (sec === '17' && !rt.revised) E.push('Revised returns closed on ' + rt.belatedEnd + '.');
    if (sec === 'U') {
      if (!rt.updated) E.push('ITR-U can be filed only within 48 months from the end of ' + ay + ' (until ' + rt.updatedEnd + ').');
      if (comp) {
        if (comp.baseU <= 0) E.push('ITR-U is not allowed: this return results in a refund or no extra tax (' + (comp.baseU < 0 ? 'refund ₹' + Math.round(-comp.baseU) : 'nil') + '). For a refund of an old year, apply for condonation of delay u/s 119(2)(b).');
        if (comp.total <= 0) E.push('ITR-U cannot be a nil or loss return.');
        W.push('Additional tax u/s 140B: ' + Math.round(comp.addRate * 100) + '% of tax + interest (₹' + comp.addTax + '), filed ' + comp.monthsU + ' months after the end of ' + ay + '.');
      }
      W.push('ITR-U is not allowed if a search, survey or reassessment notice is pending for this year, or if an updated return was already filed for it.');
    }
    if (sec === '20') W.push('119(2)(b): file the condonation request on the portal first. File this return only after it is approved, and quote the approval.');
    if (comp && comp.i234A + comp.i234B + comp.i234C > 0) W.push('Interest: 234A ₹' + comp.i234A + ' · 234B ₹' + comp.i234B + ' · 234C ₹' + comp.i234C + ' (filing date ' + comp.fileDate + ').');
    if (comp && comp.f234F) W.push('Late fee u/s 234F: ₹' + comp.f234F + '.');
    (comp && comp.notes || []).forEach(function (n) { W.push(n); });
    return { errors: E, warnings: W, routes: rt };
  }

  /* ---------- ITR form selection ---------- */
  function suggestITR(f) {
    var ay = f.ay || 'AY 2026-27', Y = rules(ay), why = [];
    var n = compute(f, 'new'), o = compute(f, 'old'), total = Math.max(n.total, o.total);
    var resident = f.residency !== 'NR';
    if (N(f.bizRegular) > 0) { why.push('business / profession with books or F&O / intraday income'); return { form: 'ITR-3', why: why }; }
    var cgOther = N(f.stcg111A) + N(f.ltcgOther) + N(f.stcgOther) > 0, l112 = N(f.ltcg112A);
    var smallLtcg = Y.itr1Ltcg && l112 <= 125000;
    var blockers = [];
    if (total > 5000000) blockers.push('total income above ₹50 lakh');
    if (!resident) blockers.push('non-resident');
    if (f.foreignAssets === 'Y') blockers.push('foreign assets or income');
    if (f.director === 'Y') blockers.push('director of a company');
    if (f.unlisted === 'Y') blockers.push('unlisted equity shares held');
    if (cgOther) blockers.push('capital gains other than small LTCG u/s 112A');
    if (l112 > 0 && !smallLtcg) blockers.push(Y.itr1Ltcg ? 'LTCG u/s 112A above ₹1.25 lakh' : 'LTCG u/s 112A (not allowed in ITR-1/4 before AY 2025-26)');
    if (N(f.agriInc) > 5000) blockers.push('agricultural income above ₹5,000');
    if (f.multiHP === 'Y') blockers.push('more than one house property');
    if (N(f.biz) > 0) {
      if (blockers.length) { why = ['presumptive business', 'but: ' + blockers.join(', ')]; return { form: 'ITR-3', why: why }; }
      return { form: 'ITR-4', why: ['presumptive business u/s 44AD / 44ADA'] };
    }
    if (blockers.length) return { form: 'ITR-2', why: blockers };
    return { form: 'ITR-1', why: ['salary / pension, one house property, other sources' + (l112 ? ', LTCG u/s 112A up to ₹1.25 lakh' : '')] };
  }

  /* ---------- which regime may be used (s.115BAC) ----------
     AY 2023-24: old regime is the default; new regime only if opted in a return filed u/s 139(1) by the due date
                 (business cases: Form 10-IE by the due date).
     AY 2024-25 on: new regime is the default; old regime only in a return filed u/s 139(1) by the due date
                 (business cases: Form 10-IEA filed by the due date).
     Belated, updated and condonation returns therefore use the default regime, unless the earlier
     on-time return (or Form 10-IE/10-IEA) already chose the other one. */
  function regimeRule(f) {
    var ay = f.ay || 'AY 2026-27', Y = rules(ay), sec = String(f.fileSec || '11');
    var def = Y.defaultNew ? 'new' : 'old', other = def === 'new' ? 'old' : 'new';
    var hasBiz = N(f.biz) + N(f.bizRegular) > 0;
    var fd = D(f.fileDate) || D(todayISO()), due = D(Y.due[f.itr || 'ITR-1'] || Y.due['ITR-1']);
    var onTime = sec === '11' ? cmp(fd, due) <= 0 : sec === '17' ? f.origOnTime !== 'N' : false;
    if (hasBiz && f.form10IE === 'Y') return { forced: f.form10IERegime === def ? def : other, why: 'Form 10-IE/10-IEA filed by the due date: its choice applies.' };
    if (f.origRegime === 'old' || f.origRegime === 'new') {
      if (sec === 'U' || sec === '17') return { forced: f.origRegime, why: 'Same regime as the earlier return.' };
    }
    if (onTime) return { forced: null, why: '' };
    return { forced: def, why: (def === 'new' ? 'Old' : 'New') + ' regime can be chosen only in a return filed on time u/s 139(1) for ' + ay + '. This return must use the ' + def + ' regime.' };
  }
  function both(f) {
    var o = compute(f, 'old'), n = compute(f, 'new'), rr = regimeRule(f);
    var best = rr.forced || (n.liab <= o.liab ? 'new' : 'old');
    return { o: o, n: n, best: best, forced: rr.forced, forcedWhy: rr.why, save: rr.forced ? 0 : Math.abs(o.liab - n.liab) };
  }

  var api = { regimeRule: regimeRule, YEARS: YEARS, AYS: AYS, rules: rules, compute: compute, both: both, routes: routes, checkRoute: checkRoute, suggestITR: suggestITR, months: months, todayISO: todayISO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaxEngine = api;
})(this);
