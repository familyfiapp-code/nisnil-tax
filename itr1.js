/* Nisnil Income Tax – ITR-1 (Sahaj) JSON builder for AY 2026-27 (FY 2025-26).
   Follows the official schema ITR-1_2026_Main_V1.1.json published on incometax.gov.in.
   buildITR1(f, comp, opts) -> { json, errors:[], warnings:[] }
   f    : the client's fields (console form), comp : the saved computation (engine output). */
(function (root) {
  'use strict';
  var N = function (v) { var x = Number(String(v == null ? '' : v).replace(/[,₹\s]/g, '')); return isFinite(x) ? x : 0; };
  var R = function (v) { return Math.round(N(v)); };
  var S = function (v) { return String(v == null ? '' : v).trim(); };
  var STATES = { '01':'Andaman and Nicobar Islands','02':'Andhra Pradesh','03':'Arunachal Pradesh','04':'Assam','05':'Bihar','06':'Chandigarh','07':'Dadra Nagar and Haveli','08':'Daman and Diu','09':'Delhi','10':'Goa','11':'Gujarat','12':'Haryana','13':'Himachal Pradesh','14':'Jammu and Kashmir','15':'Karnataka','16':'Kerala','17':'Lakshadweep','18':'Madhya Pradesh','19':'Maharashtra','20':'Manipur','21':'Meghalaya','22':'Mizoram','23':'Nagaland','24':'Odisha','25':'Puducherry','26':'Punjab','27':'Rajasthan','28':'Sikkim','29':'Tamil Nadu','30':'Tripura','31':'Uttar Pradesh','32':'West Bengal','33':'Chhattisgarh','34':'Uttarakhand','35':'Jharkhand','36':'Telangana','37':'Ladakh','99':'Foreign' };
  var EMP_CATS = [['PE','Private (non-government)'],['CGOV','Central Government'],['SGOV','State Government'],['PSU','Public Sector Undertaking'],['PEPS','Pensioner – Others'],['PESG','Pensioner – State Govt'],['PEO','Pensioner – Central Govt'],['OTH','Others'],['NA','Not applicable (no salary)']];
  var TAN_RE = /^(HYD|VPN|BBN|BPL|JBP|CHE|CMB|MRI|DEL|CAL|MRT|AHM|BRD|RKT|SRT|BLR|AGR|KNP|CHN|TVD|ALD|LKN|MUM|NGP|AMR|JLD|PTL|RTK|KLP|NSK|PNE|PTN|RCH|JDH|JPR|SHL)[A-Z][0-9]{5}[A-Z]$/;

  function buildITR1(f, comp, opts) {
    opts = opts || {};
    var E = [], W = [];
    var need = function (cond, msg) { if (!cond) E.push(msg); };
    if (!comp) { return { json: null, errors: ['Save & compute first.'], warnings: [] }; }
    var old = comp.regime === 'old';

    /* ---------- eligibility for ITR-1 ---------- */
    if (comp.total > 5000000 + 125000) E.push('Total income is above ₹50 lakh: ITR-1 not allowed (use ITR-2).');
    if (N(f.biz) > 0) E.push('Business income: use ITR-3 or ITR-4, not ITR-1.');
    if (N(f.stcg111A) > 0 || N(f.ltcgOther) > 0 || N(f.stcgOther) > 0) E.push('Capital gains other than LTCG u/s 112A: use ITR-2.');
    if (N(f.ltcg112A) > 125000) E.push('LTCG u/s 112A above ₹1.25 lakh: use ITR-2.');
    if (N(f.dOther) > 0) E.push('“Other Chapter VI-A” cannot be mapped automatically: move it to a named section, or finish in the official utility.');
    if (N(f.d80G) > 0) E.push('80G needs donee name, PAN and address (Schedule 80G): finish this return in the official utility.');
    if (N(f.tcs) > 0) E.push('TCS needs collector details (Schedule TCS): finish this return in the official utility.');
    if (old && N(f.d80D) > 0) W.push('80D: schedule filled as self & family premium. If parents or senior citizens are involved, adjust in the official utility.');

    /* ---------- personal ---------- */
    var pan = S(f.pan).toUpperCase();
    need(/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan), 'PAN is missing or invalid.');
    var parts = S(f.name).split(/\s+/).filter(Boolean);
    need(parts.length >= 1, 'Name is missing.');
    var sur = S(f.surname) || (parts.length > 1 ? parts[parts.length - 1] : parts[0] || '');
    var first = S(f.firstName) || (parts.length > 1 ? parts.slice(0, -1).join(' ') : '');
    var dob = S(f.dob);
    need(/^[12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dob), 'Date of birth (YYYY-MM-DD) is missing.');
    var aad = S(f.aadhaar).replace(/\s/g, '');
    if (aad) need(/^[0-9]{12}$/.test(aad), 'Aadhaar must be 12 digits.');
    var mob = S(f.phone).replace(/\D/g, '').slice(-10);
    need(/^[1-9][0-9]{9}$/.test(mob), 'Mobile number (10 digits) is missing.');
    var email = S(f.email);
    need(/^[\.a-zA-Z0-9_\-]+@[a-zA-Z0-9_\-]+(\.[a-zA-Z0-9_\-]+)+$/.test(email), 'Email is missing or invalid.');
    need(S(f.addrRes), 'Address: flat / house no. is missing.');
    need(S(f.addrArea), 'Address: area / locality is missing.');
    need(S(f.addrCity), 'Address: city / district is missing.');
    need(STATES[S(f.addrState)], 'Address: state is missing.');
    need(/^[1-9][0-9]{5}$/.test(S(f.addrPin)), 'Address: PIN code (6 digits) is missing.');
    need(S(f.fatherName), 'Father’s name (for verification) is missing.');
    var empCat = S(f.empCat) || (N(f.salary) > 0 ? '' : 'NA');
    need(EMP_CATS.some(function (x) { return x[0] === empCat; }), 'Employer category is missing.');

    /* ---------- filing status ---------- */
    var sec = Number(f.fileSec || 11);
    var fs = { ReturnFileSec: sec, OptOutNewTaxRegime: old ? 'Y' : 'N', SeventhProvisio139: 'N', AsseseeRepFlg: 'N', ItrFilingDueDate: '2026-07-31' };
    if (sec === 17) {
      need(/^[0-9]{15}$/.test(S(f.origAck)), 'Revised return: original acknowledgement number (15 digits) is missing.');
      need(/^\d{4}-\d{2}-\d{2}$/.test(S(f.origDate)), 'Revised return: original filing date is missing.');
      fs.ReceiptNo = S(f.origAck); fs.OrigRetFiledDate = S(f.origDate);
    }
    if (old) W.push('Old regime: Form 10-IEA is not needed for salaried taxpayers, but the client must opt out of the new regime in the return (done in this file).');

    /* ---------- salary ---------- */
    var gross = R(f.salary), exA = old ? R(f.exemptAllow) : 0, std = R(comp.std), pt = old ? Math.min(R(f.profTax), 5000) : 0;
    var inc = { GrossSalary: gross, Salary: gross, PerquisitesValue: 0, ProfitsInSalary: 0 };
    var allw = [];
    var scheduleEA = null;
    if (exA > 0) {
      var nat = S(f.exemptNature) || '10(13A)';
      allw.push({ SalNatureDesc: nat, SalOthAmount: exA });
      if (nat === '10(13A)') {
        var basic = R(f.hraBasic), hra = R(f.hraRecv), rent = R(f.hraRent), metro = S(f.hraMetro) || '2';
        need(basic > 0 && hra > 0 && rent > 0, 'HRA exemption: enter basic salary + DA, HRA received and rent paid.');
        var rent10 = Math.max(0, rent - Math.round(basic * 0.1)), pct = Math.round(basic * (metro === '1' ? 0.5 : 0.4));
        var elig = Math.max(0, Math.min(hra, rent10, pct));
        if (elig !== exA) E.push('HRA exemption by the rule is ' + elig + ', but ' + exA + ' was entered. Correct the exempt allowance and recompute.');
        scheduleEA = { Placeofwork: metro, ActlHRARecv: hra, ActlRentPaid: rent, DtlsSalUsSec171: basic, BasicSalary: basic, ActlRentPaid10Per: rent10, Sal40Or50Per: pct, EligbleExmpAllwncUs13A: elig };
      }
    }
    inc.AllwncExemptUs10 = { AllwncExemptUs10Dtls: allw, TotalAllwncExemptUs10: exA };
    inc.NetSalary = Math.max(0, gross - exA);
    inc.DeductionUs16 = std + pt;
    inc.DeductionUs16ia = std;
    inc.EntertainmentAlw16ii = 0;
    inc.ProfessionalTaxUs16iii = pt;
    inc.IncomeFromSal = R(comp.salInc);

    /* ---------- house property ---------- */
    var hp = R(comp.hp);
    if (f.hpType === 'self' || f.hpType === 'let') {
      var addr = { AddrDetail: (S(f.addrRes) + ' ' + S(f.addrArea)).trim().slice(0, 50) || '-', CityOrTownOrDistrict: S(f.addrCity) || '-', StateCode: S(f.addrState) || '11', CountryCode: '91', PinCode: N(f.addrPin) || 380001 };
      var rd;
      if (f.hpType === 'self') {
        var int = old ? Math.min(R(f.hpInterest), 200000) : 0;
        rd = { AnnualLetableValue: 0, RentNotRealized: 0, LocalTaxes: 0, TotalUnrealizedAndTax: 0, BalanceALV: 0, AnnualOfPropOwned: 0, ThirtyPercentOfBalance: 0, IntOnBorwCap: int, TotalDeduct: int, ArrearsUnrealizedRentRcvd: 0, IncomeOfHP: -int };
      } else {
        var alv = R(f.rent), tax = R(f.municipal), bal = Math.max(0, alv - tax), thirty = Math.round(bal * 0.3), ii = R(f.hpInterest);
        rd = { AnnualLetableValue: alv, RentNotRealized: 0, LocalTaxes: tax, TotalUnrealizedAndTax: tax, BalanceALV: bal, AnnualOfPropOwned: bal, ThirtyPercentOfBalance: thirty, IntOnBorwCap: ii, TotalDeduct: thirty + ii, ArrearsUnrealizedRentRcvd: 0, IncomeOfHP: bal - thirty - ii };
        if (rd.IncomeOfHP !== hp) W.push('House property: loss is capped in the computation (' + hp + ') while the schedule shows ' + rd.IncomeOfHP + '. Check in the official utility.');
      }
      inc.PropertyDetails = [{ HPSNo: 1, AddressDetailWithZipCode: addr, PropertyOwner: 'SE', PropCoOwnedFlg: 'NO', AsseseeShareProperty: 100, ifLetOut: f.hpType === 'self' ? 'S' : 'L', Rentdetails: rd }];
    }
    inc.TotalIncomeChargeableUnHP = hp;

    /* ---------- other sources ---------- */
    var oth = [];
    if (R(f.savingsInt)) oth.push({ OthSrcNatureDesc: 'SAV', OthSrcOthAmount: R(f.savingsInt) });
    if (R(f.fdInt)) oth.push({ OthSrcNatureDesc: 'IFD', OthSrcOthAmount: R(f.fdInt) });
    if (R(f.dividend)) { oth.push({ OthSrcNatureDesc: 'DIV', OthSrcOthAmount: R(f.dividend) }); W.push('Dividend: quarter-wise dates (for interest u/s 234C) are not filled. Add them in the official utility if interest applies.'); }
    if (R(f.otherInc)) oth.push({ OthSrcNatureDesc: 'OTH', OthSrcOthNatOfInc: 'Other income', OthSrcOthAmount: R(f.otherInc) });
    inc.IncomeOthSrc = R(comp.oth);
    inc.OthersInc = { OthersIncDtlsOthSrc: oth };
    inc.DeductionUs57iia = 0;

    var l112 = R(f.ltcg112A);
    inc.GrossTotIncome = R(comp.gti) - l112;
    inc.GrossTotIncomeIncLTCG112A = R(comp.gti);

    /* ---------- Chapter VI-A ---------- */
    var d = { Section80C: 0, Section80CCC: 0, Section80CCDEmployeeOrSE: 0, Section80CCD1B: 0, Section80CCDEmployer: R(f.d80CCD2), Section80D: 0, Section80DD: 0, Section80DDB: 0, Section80E: 0, Section80EE: 0, Section80EEA: 0, Section80EEB: 0, Section80G: 0, Section80GG: 0, Section80GGA: 0, Section80GGC: 0, Section80U: 0, Section80TTA: 0, Section80TTB: 0, AnyOthSec80CCH: 0 };
    var claimed = Object.assign({}, d);
    if (old) {
      claimed.Section80C = R(f.d80C); d.Section80C = Math.min(R(f.d80C), 150000);
      claimed.Section80CCD1B = R(f.d80CCD1B); d.Section80CCD1B = Math.min(R(f.d80CCD1B), 50000);
      claimed.Section80D = R(f.d80D); d.Section80D = Math.min(R(f.d80D), 100000);
      if (f.age === 'below60') { claimed.Section80TTA = R(f.savingsInt); d.Section80TTA = Math.min(R(f.savingsInt), 10000); }
      else { claimed.Section80TTB = R(f.savingsInt) + R(f.fdInt); d.Section80TTB = Math.min(R(f.savingsInt) + R(f.fdInt), 50000); }
    }
    var sum = function (o) { return Object.keys(o).reduce(function (a, k) { return a + (k === 'TotalChapVIADeductions' ? 0 : o[k]); }, 0); };
    claimed.TotalChapVIADeductions = sum(claimed);
    var dsum = sum(d), cap = Math.max(0, inc.GrossTotIncome);
    if (dsum > cap) W.push('Deductions exceed gross total income: the allowed total is capped at ' + cap + '.');
    d.TotalChapVIADeductions = Math.min(dsum, cap);
    if (d.TotalChapVIADeductions !== R(comp.ded)) W.push('Deduction total (' + d.TotalChapVIADeductions + ') differs from the computation (' + R(comp.ded) + '). Recompute after checking the inputs.');
    var usr = {}; ['Section80C','Section80CCC','Section80CCDEmployeeOrSE','Section80CCD1B','Section80CCDEmployer','Section80D','Section80DD','Section80DDB','Section80E','Section80EE','Section80EEA','Section80EEB','Section80G','Section80GG','Section80GGA','Section80GGC','Section80U','Section80TTA','Section80TTB','AnyOthSec80CCH','TotalChapVIADeductions'].forEach(function (k) { usr[k] = claimed[k] || 0; });
    inc.UsrDeductUndChapVIA = usr;
    inc.DeductUndChapVIA = d;
    inc.TotalIncome = R(comp.total);
    inc.ExemptIncAgriOthUs10 = { ExemptIncAgriOthUs10Total: 0 };

    /* ---------- tax computation ---------- */
    var taxOnInc = R(comp.taxN + comp.taxS);
    var reb = Math.min(R(comp.reb + comp.mr), taxOnInc, 60000);
    var afterReb = taxOnInc - reb, cess = Math.round(afterReb * 0.04), gtl = afterReb + cess;
    var tc = { TotalTaxPayable: taxOnInc, Rebate87A: reb, TaxPayableOnRebate: afterReb, EducationCess: cess, GrossTaxLiability: gtl, Section89: 0, NetTaxLiability: gtl, TotalIntrstPay: 0, IntrstPay: { IntrstPayUs234A: 0, IntrstPayUs234B: 0, IntrstPayUs234C: 0, LateFilingFee234F: 0 }, TotTaxPlusIntrstPay: gtl };
    if (sec === 12) { var fee = inc.TotalIncome > 500000 ? 5000 : (inc.TotalIncome > 250000 ? 1000 : 0); tc.IntrstPay.LateFilingFee234F = fee; W.push('Belated return: late fee u/s 234F of ₹' + fee + ' added. Interest u/s 234A/B/C is not calculated: check in the official utility.'); }
    else W.push('Interest u/s 234A/B/C is not calculated: if advance tax was short, check in the official utility.');
    tc.TotalIntrstPay = tc.IntrstPay.IntrstPayUs234A + tc.IntrstPay.IntrstPayUs234B + tc.IntrstPay.IntrstPayUs234C + tc.IntrstPay.LateFilingFee234F;
    tc.TotTaxPlusIntrstPay = gtl + tc.TotalIntrstPay;

    /* ---------- taxes paid + schedules ---------- */
    var tdsSal = R(f.tds), tdsOth = R(f.tdsOthAmt), adv = R(f.advTax), sat = R(f.saTax);
    var paid = adv + tdsSal + tdsOth + sat;
    var tp = { TaxesPaid: { AdvanceTax: adv, TDS: tdsSal + tdsOth, TCS: 0, SelfAssessmentTax: sat, TotalTaxesPaid: paid }, BalTaxPayable: Math.max(0, tc.TotTaxPlusIntrstPay - paid) };
    var refund = Math.max(0, paid - tc.TotTaxPlusIntrstPay);
    if (tp.BalTaxPayable > 0) E.push('Tax of ₹' + tp.BalTaxPayable + ' is still payable: pay self-assessment tax, enter the challan below, then generate again.');

    var tdsS = { TotalTDSonSalaries: tdsSal };
    if (tdsSal > 0) {
      need(TAN_RE.test(S(f.empTAN).toUpperCase()), 'Employer TAN (from Form 16) is missing or invalid.');
      need(S(f.empName), 'Employer name is missing.');
      tdsS.TDSonSalary = [{ EmployerOrDeductorOrCollectDetl: { TAN: S(f.empTAN).toUpperCase(), EmployerOrDeductorOrCollecterName: S(f.empName).slice(0, 125) }, IncChrgSal: inc.IncomeFromSal, TotalTDSSal: tdsSal }];
    }
    var tdsO = { TotalTDSonOthThanSals: tdsOth };
    if (tdsOth > 0) {
      need(TAN_RE.test(S(f.tdsOthTAN).toUpperCase()), 'TAN of the bank / deductor (other TDS) is missing or invalid.');
      need(S(f.tdsOthName), 'Name of the bank / deductor (other TDS) is missing.');
      tdsO.TDSonOthThanSal = [{ EmployerOrDeductorOrCollectDetl: { TAN: S(f.tdsOthTAN).toUpperCase(), EmployerOrDeductorOrCollecterName: S(f.tdsOthName).slice(0, 125) }, TDSSection: '94A', AmtForTaxDeduct: R(f.tdsOthIncome) || R(f.fdInt), DeductedYr: '2025', TotTDSOnAmtPaid: tdsOth, ClaimOutOfTotTDSOnAmtPaid: tdsOth }];
    }
    var tpay = { TotalTaxPayments: adv + sat };
    if (adv + sat > 0) {
      need(/^[0-9]{3}[0-9A-Z]{4}$/.test(S(f.chBSR)), 'Challan BSR code (7 characters) is missing.');
      need(/^\d{4}-\d{2}-\d{2}$/.test(S(f.chDate)), 'Challan date is missing.');
      need(N(f.chSerial) > 0, 'Challan serial number is missing.');
      tpay.TaxPayment = [{ BSRCode: S(f.chBSR).toUpperCase(), DateDep: S(f.chDate), SrlNoOfChaln: R(f.chSerial), Amt: adv + sat }];
      W.push('Advance + self-assessment tax entered as one challan. If there were several challans, add them in the official utility.');
    }

    /* ---------- bank ---------- */
    var ifsc = S(f.bankIFSC).toUpperCase(), acc = S(f.bankAcc).replace(/\s/g, '');
    need(/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc), 'Bank IFSC is missing or invalid.');
    need(/^[a-zA-Z0-9\/-]{1,20}$/.test(acc) && /[1-9]/.test(acc), 'Bank account number is missing or invalid.');
    need(S(f.bankName), 'Bank name is missing.');

    var itr = {
      CreationInfo: { SWVersionNo: '1.0', SWCreatedBy: opts.swId || 'SW00000000', JSONCreatedBy: opts.swId || 'SW00000000', JSONCreationDate: new Date().toISOString().slice(0, 10), IntermediaryCity: (opts.city || 'Ahmedabad').slice(0, 25), Digest: '-' },
      Form_ITR1: { FormName: 'ITR-1', Description: 'For Indls having Income from Salary, Pension, family pension and Interest', AssessmentYear: '2026', SchemaVer: 'Ver1.0', FormVer: 'Ver1.0' },
      PersonalInfo: {
        AssesseeName: Object.assign(first ? { FirstName: first.slice(0, 25) } : {}, { SurNameOrOrgName: sur.slice(0, 75) }),
        PAN: pan,
        Address: { ResidenceNo: S(f.addrRes).slice(0, 50), LocalityOrArea: S(f.addrArea).slice(0, 50), CityOrTownOrDistrict: S(f.addrCity).slice(0, 50), StateCode: S(f.addrState), CountryCode: '91', PinCode: N(f.addrPin), CountryCodeMobile: 91, MobileNo: N(mob), EmailAddress: email },
        SecondaryAdd: 'N', DOB: dob, EmployerCategory: empCat
      },
      FilingStatus: fs,
      ITR1_IncomeDeductions: inc,
      ITR1_TaxComputation: tc,
      TaxPaid: tp,
      Refund: { RefundDue: refund, BankAccountDtls: { AddtnlBankDetails: [{ IFSCCode: ifsc, BankName: S(f.bankName).slice(0, 125), BankAccountNo: acc, AccountType: S(f.bankType) || 'SB', UseForRefund: 'true' }] } },
      TDSonSalaries: tdsS,
      TDSonOthThanSals: tdsO,
      ScheduleTCS: { TotalSchTCS: 0 },
      TaxPayments: tpay,
      Verification: { Declaration: { AssesseeVerName: S(f.name).slice(0, 127), FatherName: S(f.fatherName).slice(0, 125), AssesseeVerPAN: pan }, Capacity: 'S', Place: (S(f.addrCity) || 'Ahmedabad').slice(0, 50) }
    };
    if (aad) itr.PersonalInfo.AadhaarCardNo = aad;
    if (scheduleEA) itr.ScheduleEA10_13A = scheduleEA;
    if (old && d.Section80C > 0) itr.Schedule80C = { Schedule80CDtls: [{ Amount: d.Section80C, IdentificationNo: S(f.d80CRef) || 'Investments as per proofs' }], TotalAmt: d.Section80C };
    if (old && d.Section80D > 0) itr.Schedule80D = { Sec80DSelfFamSrCtznHealth: { SeniorCitizenFlag: f.age === 'below60' ? 'N' : 'Y', SelfAndFamily: f.age === 'below60' ? Math.min(d.Section80D, 25000) : 0, HealthInsPremSlfFam: f.age === 'below60' ? Math.min(d.Section80D, 25000) : 0, PrevHlthChckUpSlfFam: 0, SelfAndFamilySeniorCitizen: f.age === 'below60' ? 0 : Math.min(d.Section80D, 50000), HlthInsPremSlfFamSrCtzn: f.age === 'below60' ? 0 : Math.min(d.Section80D, 50000), PrevHlthChckUpSlfFamSrCtzn: 0, MedicalExpSlfFamSrCtzn: 0, ParentsSeniorCitizenFlag: 'P', Parents: 0, HlthInsPremParents: 0, PrevHlthChckUpParents: 0, ParentsSeniorCitizen: 0, HlthInsPremParentsSrCtzn: 0, PrevHlthChckUpParentsSrCtzn: 0, MedicalExpParentsSrCtzn: 0, EligibleAmountOfDedn: d.Section80D } };
    if (l112 > 0) {
      need(R(f.ltcgSale) > 0, 'LTCG u/s 112A: total sale value is missing.');
      itr.LTCG112A = { TotSaleCnsdrn: R(f.ltcgSale), TotCstAcqisn: Math.max(0, R(f.ltcgSale) - l112), LongCap112A: l112 };
    }
    W.push('Upload route: open this file in the official Common Offline Utility (Open saved JSON), let it validate, then file from there. Direct upload may be refused because the software ID is not an ERI-registered one.');
    return { json: { ITR: { ITR1: itr } }, errors: E, warnings: W };
  }
  var api = { buildITR1: buildITR1, STATES: STATES, EMP_CATS: EMP_CATS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ITR1 = api;
})(this);
