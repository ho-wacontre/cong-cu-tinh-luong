(function () {
  "use strict";

  var BHTN_HISTORY_MONTHS = 12;
  var BHTN_MONTHS_MAX = 600;

  function getT() {
    return window.TNCN2026;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function getRegionKey() {
    var r = document.querySelector('input[name="region"]:checked');
    return r && r.value ? String(r.value) : "I";
  }

  function isWageRegimeState() {
    var w = document.querySelector('input[name="bhtn_wage_regime"]:checked');
    return !!(w && w.value === "state");
  }

  function syncWageRegimeRegionLock() {
    var lock = isWageRegimeState();
    var col = document.getElementById("bhtn-region-col");
    var radios = document.querySelectorAll('input[name="region"]');
    var hint = document.getElementById("bhtn-region-hint-btn");
    var group = document.getElementById("bhtn-region-radios");
    var i;
    for (i = 0; i < radios.length; i++) {
      radios[i].disabled = lock;
    }
    if (hint) {
      if (lock) {
        hint.setAttribute("disabled", "disabled");
        hint.setAttribute("aria-disabled", "true");
        hint.setAttribute("tabindex", "-1");
      } else {
        hint.removeAttribute("disabled");
        hint.removeAttribute("aria-disabled");
        hint.removeAttribute("tabindex");
      }
    }
    if (col) col.classList.toggle("bhtn-form-split__col--disabled", lock);
    if (group) group.setAttribute("aria-disabled", lock ? "true" : "false");
  }

  function isBh6mVarying() {
    var r = document.querySelector('input[name="bhtn_bh_6m"]:checked');
    return !!(r && r.value === "varying");
  }

  function syncBh6mSalaryPanels() {
    var varying = isBh6mVarying();
    var stableBlock = document.getElementById("bhtn-salary-stable-block");
    var varyingBlock = document.getElementById("bhtn-salary-varying-block");
    var row = document.getElementById("bhtn-salary-months-row");
    if (stableBlock) {
      stableBlock.hidden = varying;
      stableBlock.setAttribute("aria-hidden", varying ? "true" : "false");
    }
    if (varyingBlock) {
      varyingBlock.hidden = !varying;
      varyingBlock.setAttribute("aria-hidden", !varying ? "true" : "false");
    }
    if (row) {
      row.classList.toggle("bhtn-form-row--varying-active", varying);
    }
    if (varying) {
      hideSalaryError();
    } else {
      hideVaryingError();
    }
  }

  function hideVaryingError() {
    var msg = document.getElementById("bhtn-varying-error");
    if (msg) msg.hidden = true;
    var block = document.getElementById("bhtn-salary-varying-block");
    if (block) block.classList.remove("bhtn-salary-varying--error");
  }

  function showVaryingError() {
    var msg = document.getElementById("bhtn-varying-error");
    if (msg) msg.hidden = false;
    var block = document.getElementById("bhtn-salary-varying-block");
    if (block) block.classList.add("bhtn-salary-varying--error");
  }

  /** Thay ô tiền đơn bằng gross-ac + gợi ý giống ô lương ổn định (template #bhtn-varying-money-ac-template). */
  function upgradeBhtnVaryingMoneyComboboxesFromTemplate() {
    var tpl = document.getElementById("bhtn-varying-money-ac-template");
    if (!tpl) return;
    var m;
    for (m = 1; m <= 6; m++) {
      var inp = document.getElementById("bhtn-sal-m" + m);
      if (!inp) continue;
      var wrap = inp.closest(".bhtn-varying-item__input");
      if (!wrap || wrap.closest(".gross-ac")) continue;
      var html = tpl.innerHTML.split("{{M}}").join(String(m));
      var holder = document.createElement("div");
      holder.innerHTML = html.trim();
      var ac = holder.firstElementChild;
      if (!ac) continue;
      wrap.replaceWith(ac);
    }
  }

  function parseSixMonthSalariesAverage(T) {
    var order = [6, 5, 4, 3, 2, 1];
    var sum = 0;
    var i;
    for (i = 0; i < order.length; i++) {
      var el = document.getElementById("bhtn-sal-m" + order[i]);
      var v = T.parseMoneyInput(el && el.value);
      if (!v) return null;
      sum += v;
    }
    return Math.round(sum / 6);
  }

  function hideSalaryError() {
    var shell = document.getElementById("bhtn-salary-field-shell");
    var msg = document.getElementById("bhtn-salary-error");
    var inp = document.getElementById("bhtn-salary");
    if (shell) shell.classList.remove("field-tncn__shell--error");
    if (msg) msg.hidden = true;
    if (inp) {
      inp.setAttribute("aria-invalid", "false");
      inp.removeAttribute("aria-describedby");
    }
  }

  function showSalaryError() {
    var shell = document.getElementById("bhtn-salary-field-shell");
    var msg = document.getElementById("bhtn-salary-error");
    var inp = document.getElementById("bhtn-salary");
    if (shell) shell.classList.add("field-tncn__shell--error");
    if (msg) msg.hidden = false;
    if (inp) {
      inp.setAttribute("aria-invalid", "true");
      inp.setAttribute("aria-describedby", "bhtn-salary-error");
    }
  }

  function hideMonthsError() {
    var shell = document.getElementById("bhtn-months-field-shell");
    var msg = document.getElementById("bhtn-months-error");
    var inp = document.getElementById("bhtn-months");
    if (shell) shell.classList.remove("field-tncn__shell--error");
    if (msg) msg.hidden = true;
    if (inp) {
      inp.setAttribute("aria-invalid", "false");
      inp.removeAttribute("aria-describedby");
    }
  }

  function showMonthsError() {
    var shell = document.getElementById("bhtn-months-field-shell");
    var msg = document.getElementById("bhtn-months-error");
    var inp = document.getElementById("bhtn-months");
    if (shell) shell.classList.add("field-tncn__shell--error");
    if (msg) msg.hidden = false;
    if (inp) {
      inp.setAttribute("aria-invalid", "true");
      inp.setAttribute("aria-describedby", "bhtn-months-error");
    }
  }

  function parseContribMonths(str) {
    if (str == null) return NaN;
    var digits = String(str).replace(/\D/g, "");
    if (!digits) return NaN;
    return parseInt(digits, 10);
  }

  /** Gợi ý số tháng (dropdown giống gross-ac), không phụ thuộc app money combobox */
  function wireBhtnMonthsCombobox() {
    var root = document.getElementById("bhtn-months-ac");
    var input = document.getElementById("bhtn-months");
    var panel = document.getElementById("bhtn-months-panel");
    var list = document.getElementById("bhtn-months-listbox");
    if (!root || !input || !panel || !list) return;

    var presetItems = list.querySelectorAll(".gross-ac__preset[data-months]");
    var clearBtn = document.getElementById("bhtn-months-clear");
    var blurCloseTimer = null;

    function clearBlurTimer() {
      if (blurCloseTimer) {
        clearTimeout(blurCloseTimer);
        blurCloseTimer = null;
      }
    }

    function filterItems() {
      var q = input.value.replace(/\D/g, "");
      var visible = 0;
      var i;
      if (!q) {
        for (i = 0; i < presetItems.length; i++) {
          presetItems[i].hidden = false;
          visible++;
        }
        return visible;
      }
      for (i = 0; i < presetItems.length; i++) {
        var li = presetItems[i];
        var m = parseInt(li.getAttribute("data-months"), 10);
        var match = String(m).indexOf(q) === 0;
        li.hidden = !match;
        if (match) visible++;
      }
      return visible;
    }

    function syncPanel() {
      var n = filterItems();
      var show = n > 0;
      panel.hidden = !show;
      input.setAttribute("aria-expanded", show ? "true" : "false");
    }

    function closePanel() {
      panel.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }

    function normalizeMonthsInput() {
      var d = input.value.replace(/\D/g, "");
      if (!d) {
        input.value = "";
        return;
      }
      var n = parseInt(d, 10);
      input.value = isFinite(n) && n >= 0 ? String(n) : "";
    }

    /** Giống app.syncMoneyClearButtonVisibility — chỉ hiện khi có chữ số và giá trị > 0 */
    function syncMonthsClearButton() {
      if (!clearBtn) return;
      if (input.readOnly) {
        clearBtn.hidden = true;
        return;
      }
      var d = input.value.replace(/\D/g, "");
      var n = parseInt(d, 10) || 0;
      clearBtn.hidden = !(d.length > 0 && n > 0);
    }

    input.addEventListener("input", function () {
      hideMonthsError();
      syncPanel();
      syncMonthsClearButton();
    });

    input.addEventListener("focus", function () {
      clearBlurTimer();
      syncPanel();
      syncMonthsClearButton();
    });

    input.addEventListener("blur", function () {
      clearBlurTimer();
      blurCloseTimer = setTimeout(function () {
        blurCloseTimer = null;
        closePanel();
        normalizeMonthsInput();
        syncMonthsClearButton();
      }, 180);
    });

    list.addEventListener("mousedown", function (e) {
      var li = e.target && e.target.closest(".gross-ac__item[data-months]");
      if (!li || li.hidden) return;
      e.preventDefault();
      clearBlurTimer();
      var mo = parseInt(li.getAttribute("data-months"), 10);
      if (!isFinite(mo) || mo < 0) return;
      input.value = String(mo);
      hideMonthsError();
      syncMonthsClearButton();
      input.focus();
      setTimeout(function () {
        closePanel();
      }, 0);
    });

    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        clearBlurTimer();
        closePanel();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("mousedown", function (e) {
        e.preventDefault();
      });
      clearBtn.addEventListener("click", function (e) {
        e.preventDefault();
        clearBlurTimer();
        input.value = "";
        hideMonthsError();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        syncMonthsClearButton();
        input.focus();
      });
      syncMonthsClearButton();
    }
  }

  function renderHistoryTable(T, base, nld, nsd) {
    var tbody = document.getElementById("bhtn-history-tbody");
    if (!tbody) return;
    tbody.textContent = "";
    var frag = document.createDocumentFragment();
    var m;
    for (m = 1; m <= BHTN_HISTORY_MONTHS; m++) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.setAttribute("scope", "row");
      th.textContent = "Tháng " + pad2(m);
      var tdSal = document.createElement("td");
      tdSal.textContent = T.formatPlainVnd(base);
      var tdNld = document.createElement("td");
      tdNld.textContent = T.formatPlainVnd(nld);
      var tdNsd = document.createElement("td");
      tdNsd.textContent = T.formatPlainVnd(nsd);
      tr.appendChild(th);
      tr.appendChild(tdSal);
      tr.appendChild(tdNld);
      tr.appendChild(tdNsd);
      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
    var sumSal = base * BHTN_HISTORY_MONTHS;
    var sumNld = nld * BHTN_HISTORY_MONTHS;
    var sumNsd = nsd * BHTN_HISTORY_MONTHS;
    setText("bhtn-sum-salary-col", T.formatPlainVnd(sumSal));
    setText("bhtn-sum-nld-col", T.formatPlainVnd(sumNld));
    setText("bhtn-sum-nsd-col", T.formatPlainVnd(sumNsd));
  }

  document.addEventListener("DOMContentLoaded", function () {
    /* Mục lục gn-article: init trong app.js (tránh đăng ký click hai lần với bhtn.js) */

    var form = document.getElementById("bhtn-form");
    if (!form) return;

    wireBhtnMonthsCombobox();

    upgradeBhtnVaryingMoneyComboboxesFromTemplate();

    var T = getT();
    if (!T || !T.wireMoneyCombobox || !T.wireMoneyInputClear) return;

    T.wireMoneyCombobox({
      rootId: "bhtn-salary-ac",
      inputId: "bhtn-salary",
      panelId: "bhtn-salary-panel",
      listId: "bhtn-salary-listbox",
      customLiId: "bhtn-salary-custom",
      hideFieldError: hideSalaryError,
    });
    T.wireMoneyInputClear("bhtn-salary", "bhtn-salary-clear", hideSalaryError, null);

    var mi;
    for (mi = 1; mi <= 6; mi++) {
      (function (m) {
        var rootId = "bhtn-sal-m" + m + "-ac";
        if (!document.getElementById(rootId)) return;
        T.wireMoneyCombobox({
          rootId: rootId,
          inputId: "bhtn-sal-m" + m,
          panelId: "bhtn-sal-m" + m + "-panel",
          listId: "bhtn-sal-m" + m + "-listbox",
          customLiId: "bhtn-sal-m" + m + "-custom",
          hideFieldError: hideVaryingError,
        });
        T.wireMoneyInputClear(
          "bhtn-sal-m" + m,
          "bhtn-sal-m" + m + "-clear",
          hideVaryingError,
          null
        );
      })(mi);
    }

    document.querySelectorAll('input[name="bhtn_bh_6m"]').forEach(function (rad) {
      rad.addEventListener("change", syncBh6mSalaryPanels);
    });
    syncBh6mSalaryPanels();

    var monthsInp = document.getElementById("bhtn-months");

    document.querySelectorAll('input[name="bhtn_wage_regime"]').forEach(function (rad) {
      rad.addEventListener("change", syncWageRegimeRegionLock);
    });
    syncWageRegimeRegionLock();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errBox = document.getElementById("bhtn-form-error");
      if (errBox) {
        errBox.textContent = "";
        errBox.hidden = true;
      }
      hideSalaryError();
      hideMonthsError();
      hideVaryingError();

      var declared;
      var salaryInput = document.getElementById("bhtn-salary");
      if (isBh6mVarying()) {
        declared = parseSixMonthSalariesAverage(T);
        if (declared == null) {
          showVaryingError();
          return;
        }
      } else {
        declared = T.parseMoneyInput(salaryInput && salaryInput.value);
        if (!declared) {
          showSalaryError();
          return;
        }
      }

      var contribMonths = parseContribMonths(monthsInp && monthsInp.value);
      if (
        !isFinite(contribMonths) ||
        contribMonths < 0 ||
        contribMonths > BHTN_MONTHS_MAX
      ) {
        showMonthsError();
        return;
      }

      var regionKey = getRegionKey();
      var wageRegime = isWageRegimeState() ? "state" : "private";
      var insParts = T.calcInsurance(declared, regionKey, wageRegime);
      var empParts = T.calcEmployerInsurance
        ? T.calcEmployerInsurance(declared, regionKey, wageRegime)
        : null;
      var nld = insParts.bhtn;
      var nsd = empParts ? empParts.bhtn : nld;
      var base = insParts.baseBhtn;
      var monthlyBen =
        T.bhtnTctnMonthlyBenefit != null
          ? T.bhtnTctnMonthlyBenefit(base, regionKey, wageRegime)
          : Math.round(base * 0.6);
      var benefitMo =
        T.bhtnTctnBenefitMonths != null ? T.bhtnTctnBenefitMonths(contribMonths) : 0;
      var totalBen = Math.round(Number(monthlyBen) || 0) * benefitMo;

      var mlttMap = T.REGION_MIN_WAGE_MONTHLY || {};
      var rk = String(regionKey || "I").toUpperCase();
      var mltt = mlttMap[rk] || mlttMap.I || 0;
      var ceilingSoc = T.INSURANCE_SALARY_CEILING || 0;
      var ceilingTn =
        T.bhtnSalaryCeilingForRegion != null
          ? T.bhtnSalaryCeilingForRegion(regionKey, wageRegime)
          : wageRegime === "state"
            ? ceilingSoc
            : 20 * mltt;
      var capTctn =
        wageRegime === "state"
          ? 5 * (T.REFERENCE_WAGE_INSURANCE || 0)
          : 5 * mltt;

      setText("bhtn-result-monthly-benefit", T.formatPlainVnd(monthlyBen) + " VND");
      setText(
        "bhtn-result-benefit-months",
        benefitMo > 0 ? benefitMo + " Tháng" : "0 tháng"
      );
      setText("bhtn-result-total-benefit", T.formatPlainVnd(totalBen) + " VND");

      setText("bhtn-spec-d1", T.formatPlainVnd(declared));
      var lcs = T.REFERENCE_WAGE_INSURANCE || 0;
      if (wageRegime === "state") {
        setText("bhtn-spec-label-2", "(2) Mức lương cơ sở");
        setText("bhtn-spec-d2", T.formatPlainVnd(lcs));
        setText(
          "bhtn-spec-label-3",
          "(3) Mức lương tháng được đóng BHTN tối đa (= 20 * (2))"
        );
      } else {
        setText("bhtn-spec-label-2", "(2) Lương tối thiểu vùng");
        setText("bhtn-spec-d2", T.formatPlainVnd(mltt));
        setText(
          "bhtn-spec-label-3",
          "(3) Mức lương tháng được đóng BHTN tối đa (= 20 * (2))"
        );
      }
      setText("bhtn-spec-d3", T.formatPlainVnd(ceilingTn));
      setText("bhtn-spec-d4", T.formatPlainVnd(base));
      setText("bhtn-spec-d5", T.formatPlainVnd(capTctn));
      setText("bhtn-spec-d6", contribMonths + " tháng");
      setText(
        "bhtn-spec-d7",
        wageRegime === "state" ? "Doanh nghiệp nhà nước" : "Doanh nghiệp tư nhân"
      );
      setText("bhtn-spec-d8", T.formatPlainVnd(monthlyBen));
      setText(
        "bhtn-spec-d-pit",
        benefitMo > 0 ? benefitMo + " Tháng" : "—"
      );

      renderHistoryTable(T, base, nld, nsd);

      var pane = document.getElementById("bhtn-results-pane");
      if (pane) pane.hidden = false;
      try {
        pane && pane.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (ex2) {}
    });
  });
})();
