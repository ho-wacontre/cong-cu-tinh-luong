(function () {
  "use strict";

  function getT() {
    return window.TNCN2026;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function bracketMakeCell(text, isHead, isTierCol) {
    var c = document.createElement("div");
    c.className = "tncn-bracket-figma__cell" + (isHead ? " tncn-bracket-figma__cell--head" : "");
    if (isTierCol) {
      var span = document.createElement("span");
      span.className = "tncn-bracket-figma__tier-text";
      span.textContent = text;
      c.appendChild(span);
    } else {
      c.textContent = text;
    }
    return c;
  }

  function renderBracketGrid(detail) {
    var grid = document.getElementById("gn-bracket-grid");
    if (!grid || !detail || !detail.bands) return;
    var T = getT();
    var formatPlainVnd = T && T.formatPlainVnd ? T.formatPlainVnd : function (n) { return String(n); };
    grid.innerHTML = "";
    var headRow = document.createElement("div");
    headRow.className = "tncn-bracket-figma__row tncn-bracket-figma__row--head";
    headRow.appendChild(bracketMakeCell("Mức chịu thuế", true, true));
    headRow.appendChild(bracketMakeCell("Thuế suất", true, false));
    headRow.appendChild(bracketMakeCell("Lương chịu thuế", true, false));
    headRow.appendChild(bracketMakeCell("Tiền nộp", true, false));
    grid.appendChild(headRow);
    detail.bands.forEach(function (b) {
      var row = document.createElement("div");
      row.className = "tncn-bracket-figma__row";
      row.appendChild(bracketMakeCell(b.label, false, true));
      row.appendChild(bracketMakeCell((b.rate * 100).toLocaleString("vi-VN") + "%", false));
      var amtStr = formatPlainVnd(b.amountInBand);
      var taxStr = formatPlainVnd(b.taxInBand);
      var cAmt = bracketMakeCell(amtStr, false);
      var cTax = bracketMakeCell(taxStr, false);
      cAmt.setAttribute("title", amtStr);
      cTax.setAttribute("title", taxStr);
      row.appendChild(cAmt);
      row.appendChild(cTax);
      grid.appendChild(row);
    });

    var scrollHost = grid.parentElement;
    var T = getT();
    if (
      scrollHost &&
      scrollHost.classList &&
      scrollHost.classList.contains("tncn-bracket-figma-scroll") &&
      T &&
      typeof T.bindTncnBracketHScrollIndicator === "function"
    ) {
      T.bindTncnBracketHScrollIndicator(scrollHost);
    }
  }

  function computeFromGross(gross, insMode, insOther, region, deps) {
    var T = getT();
    if (!T) return null;
    var insDeclared = gross;
    if (insMode === "other") insDeclared = Math.min(gross, insOther || 0);
    var parts = T.calcInsurance(insDeclared, region);
    var empParts = T.calcEmployerInsurance ? T.calcEmployerInsurance(insDeclared, region) : null;
    var taxable = T.calcTaxableIncome(gross, parts.total, deps, 0);
    var taxDetail = T.calcPersonalIncomeTaxDetailed(taxable);
    var tax = taxDetail.tax;
    var net = T.calcNetSalary(gross, parts.total, tax);
    var pretax = Math.max(0, Math.round(gross - parts.total));
    return {
      gross: gross,
      insBasis: insDeclared,
      insParts: parts,
      empParts: empParts,
      pretax: pretax,
      taxable: taxable,
      tax: tax,
      net: net,
      taxDetail: taxDetail,
      depDeduct: deps * T.DEPENDENT_DEDUCTION,
    };
  }

  function netAtGross(gross, insMode, insOther, region, deps) {
    var r = computeFromGross(gross, insMode, insOther, region, deps);
    return r ? r.net : 0;
  }

  function solveGrossFromNet(targetNet, insMode, insOther, region, deps) {
    var N = Math.round(Number(targetNet) || 0);
    if (N <= 0) return null;
    var lo = 0;
    var hi = Math.max(Math.ceil(N * 1.5), N + 5000000);
    var maxHi = 999999999;
    var guard = 0;
    while (netAtGross(hi, insMode, insOther, region, deps) < N && hi < maxHi && guard < 48) {
      hi = Math.min(Math.ceil(hi * 1.35), maxHi);
      guard++;
    }
    if (netAtGross(hi, insMode, insOther, region, deps) < N) return null;
    while (lo + 1 < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (netAtGross(mid, insMode, insOther, region, deps) >= N) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  function getDependents() {
    var el = document.getElementById("gn-dependents");
    if (!el) return 0;
    var n = parseInt(String(el.value).replace(/\D/g, ""), 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var mode = "g2n";
    var gnButtonsPrimed = false;
    var amountLabel = document.getElementById("gn-amount-label");
    var amountInput = document.getElementById("gn-amount");
    var grossHintWrap = document.getElementById("gn-gross-hint-wrap");
    var netHintWrap = document.getElementById("gn-net-hint-wrap");
    var btnG2n = document.getElementById("gn-calc-g2n");
    var btnN2g = document.getElementById("gn-calc-n2g");

    function syncCalcButtons() {
      if (!btnG2n || !btnN2g) return;
      btnG2n.classList.remove("gn-calc-actions__btn--selected", "gn-calc-actions__btn--idle");
      btnN2g.classList.remove("gn-calc-actions__btn--selected", "gn-calc-actions__btn--idle");
      if (!gnButtonsPrimed) {
        btnG2n.classList.add("gn-calc-actions__btn--idle");
        btnN2g.classList.add("gn-calc-actions__btn--idle");
        return;
      }
      if (mode === "g2n") {
        btnG2n.classList.add("gn-calc-actions__btn--selected");
        btnN2g.classList.add("gn-calc-actions__btn--idle");
      } else {
        btnN2g.classList.add("gn-calc-actions__btn--selected");
        btnG2n.classList.add("gn-calc-actions__btn--idle");
      }
    }

    function gnDetailMinusAmount(T, n) {
      var v = Math.max(0, Math.round(Number(n) || 0));
      if (v === 0) return "- 0";
      return "- " + T.formatPlainVnd(v);
    }

    function gnDetailTaxDisplay(T, tax) {
      var t = Math.round(Number(tax) || 0);
      if (t <= 0) return "0";
      return "- " + T.formatPlainVnd(t);
    }

    function syncDetailGridMode() {
      var grid = document.getElementById("gn-detail-grid");
      if (!grid) return;
      grid.classList.remove("gn-detail-grid--g2n", "gn-detail-grid--n2g");
      grid.classList.add(mode === "g2n" ? "gn-detail-grid--g2n" : "gn-detail-grid--n2g");
    }

    function syncGnHeroCompareOrder() {
      var row = document.getElementById("gn-hero-compare");
      if (!row) return;
      row.classList.toggle("tncn-result-hero__compare--gn-reverse", mode === "n2g");
    }

    function setVisualMode(m) {
      mode = m;
      if (amountLabel) {
        amountLabel.textContent = m === "g2n" ? "Lương Gross" : "Lương Net";
      }
      if (grossHintWrap) grossHintWrap.hidden = m !== "g2n";
      if (netHintWrap) netHintWrap.hidden = m !== "n2g";
      syncCalcButtons();
      syncDetailGridMode();
      syncGnHeroCompareOrder();
    }

    function runGrossNetCalculation() {
      var T = getT();
      if (!T) return;

      if (T.gnHideFormError) T.gnHideFormError();
      if (T.gnHideAmountFieldError) T.gnHideAmountFieldError();
      if (T.gnHideInsuranceOtherError) T.gnHideInsuranceOtherError();

      var amt = T.parseMoneyInput(amountInput && amountInput.value);
      if (!amt) {
        if (T.gnShowAmountFieldError) T.gnShowAmountFieldError();
        return;
      }

      var modeOther = document.querySelector('input[name="gn_insurance_salary"][value="other"]');
      var insOtherVal = 0;
      var insMode = "full";
      if (modeOther && modeOther.checked) {
        insMode = "other";
        insOtherVal = T.parseMoneyInput(
          document.getElementById("gn-insurance_other") && document.getElementById("gn-insurance_other").value
        );
        if (!insOtherVal) {
          if (T.gnShowInsuranceOtherError) T.gnShowInsuranceOtherError();
          return;
        }
      }

      var regionRadio = document.querySelector('input[name="gn_region"]:checked');
      var regionKey = regionRadio && regionRadio.value ? String(regionRadio.value) : "I";
      var deps = getDependents();

      var gross;
      var result;
      if (mode === "g2n") {
        gross = amt;
        result = computeFromGross(gross, insMode, insOtherVal, regionKey, deps);
      } else {
        gross = solveGrossFromNet(amt, insMode, insOtherVal, regionKey, deps);
        if (gross == null || !gross) {
          if (T.gnShowFormError) {
            T.gnShowFormError(
              "Không quy đổi được mức Gross phù hợp với Net đã nhập. Vui lòng kiểm tra lại số liệu hoặc thử Net thấp hơn."
            );
          }
          if (T.gnShowAmountFieldError) T.gnShowAmountFieldError();
          return;
        }
        result = computeFromGross(gross, insMode, insOtherVal, regionKey, deps);
      }

      if (!result) return;

      var mainIncomeLabel = document.getElementById("gn-detail-label-main-income");
     

      setText("gn-val-gross", T.formatPlainVnd(result.gross));
      setText("gn-val-bhxh", gnDetailMinusAmount(T, result.insParts.bhxh));
      setText("gn-val-bhyt", gnDetailMinusAmount(T, result.insParts.bhyt));
      setText("gn-val-bhtn", gnDetailMinusAmount(T, result.insParts.bhtn));
      setText("gn-val-pretax", T.formatPlainVnd(result.pretax));
      setText("gn-val-deduct-self", gnDetailMinusAmount(T, T.PERSONAL_DEDUCTION));
      setText("gn-val-deduct-dep", gnDetailMinusAmount(T, result.depDeduct));
      setText("gn-val-taxable", T.formatPlainVnd(result.taxable));
      setText("gn-val-tax", gnDetailTaxDisplay(T, result.tax));
      setText("gn-val-net", T.formatPlainVnd(result.net));
      syncDetailGridMode();

      setText("gn-hero-net", T.formatHeroVnd(result.net));
      setText("gn-hero-gross", T.formatHeroVnd(result.gross));
      syncGnHeroCompareOrder();

      renderBracketGrid(result.taxDetail);

      setText("gn-val-emp-gross", T.formatPlainVnd(result.gross));
      var emp = result.empParts;
      if (emp) {
        setText("gn-val-emp-bhxh", T.formatPlainVnd(emp.bhxh));
        setText("gn-val-emp-tnld", T.formatPlainVnd(emp.tnldBnn));
        setText("gn-val-emp-bhyt", T.formatPlainVnd(emp.bhyt));
        setText("gn-val-emp-bhtn", T.formatPlainVnd(emp.bhtn));
        setText("gn-val-emp-total", T.formatPlainVnd(emp.total));
      } else {
        setText("gn-val-emp-bhxh", "—");
        setText("gn-val-emp-tnld", "—");
        setText("gn-val-emp-bhyt", "—");
        setText("gn-val-emp-bhtn", "—");
        setText("gn-val-emp-total", "—");
      }

      var pane = document.getElementById("gn-results-pane");
      if (pane) pane.hidden = false;
      try {
        pane && pane.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (ex) {}
    }

    var form = document.getElementById("gn-form");
    if (!form) return;

    mode = "g2n";
    if (amountLabel) amountLabel.textContent = "Lương Gross";
    if (grossHintWrap) grossHintWrap.hidden = false;
    if (netHintWrap) netHintWrap.hidden = true;
    syncCalcButtons();
    syncDetailGridMode();
    syncGnHeroCompareOrder();

    if (btnG2n) {
      btnG2n.addEventListener("click", function () {
        gnButtonsPrimed = true;
        setVisualMode("g2n");
        runGrossNetCalculation();
      });
    }
    if (btnN2g) {
      btnN2g.addEventListener("click", function () {
        gnButtonsPrimed = true;
        setVisualMode("n2g");
        runGrossNetCalculation();
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
    });
  });
})();
