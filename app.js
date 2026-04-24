(function () {
  "use strict";

  var PERSONAL_DEDUCTION = 15500000;
  var DEPENDENT_DEDUCTION = 6200000;
  var RATE_BHXH = 0.08;
  var RATE_BHYT = 0.015;
  var RATE_BHTN = 0.01;

  /** Người sử dụng lao động — cùng mức căn cứ đóng BH với NLĐ; tỷ lệ tham chiếu công cụ TopCV / Luật BHXH */
  var RATE_BHXH_EMPLOYER = 0.175;
  /** Tách hiển thị: BHXH (17%) + TNLĐ-BNN (0,5%) = 17,5% trên cùng mức căn cứ */
  var RATE_BHXH_EMPLOYER_SOC = 0.17;
  var RATE_BHYT_EMPLOYER = 0.03;
  var RATE_BHTN_EMPLOYER = 0.01;

  /**
   * Trần BHXH/BHYT bắt buộc = 20 × LCS — Luật BHXH 2024 / NĐ 73/2024.
   * Trần lương đóng BHTN (căn cứ tính 1% NLĐ / 1% NSDLĐ trong công cụ):
   * - Chế độ DN nhà nước (tiền lương do Nhà nước quy định): 20 × LCS — cùng trần tham chiếu với BHXH bắt buộc.
   * - Chế độ DN tư nhân: 20 × MLTT vùng — Luật Việc làm (có thể khác 20×LCS).
   */
  var REFERENCE_WAGE_INSURANCE = 2340000;
  var INSURANCE_SALARY_CEILING = 20 * REFERENCE_WAGE_INSURANCE;

  /** MLTT vùng từ 01/01/2026 (NĐ 293/2025), khớp bảng trong #regionWageModal */
  var REGION_MIN_WAGE_MONTHLY = {
    I: 5310000,
    II: 4730000,
    III: 4140000,
    IV: 3700000,
  };

  /** Ngưỡng trên của từng bậc (VND/tháng); bậc cuối không giới hạn trên */
  var BRACKET_CAPS = [10000000, 30000000, 60000000, 100000000, Infinity];
  var BRACKET_RATES = [0.05, 0.1, 0.2, 0.3, 0.35];

  /** Nhãn bậc đúng copy Figma (node 40182:18544) */
  var FIGMA_BRACKET_LABELS = [
    "Đến 10 triệu VNĐ",
    "Trên 10 triệu VNĐ đến 30 triệu VNĐ",
    "Trên 30 triệu VNĐ đến 60 triệu VNĐ",
    "Trên 60 triệu VNĐ đến 100 triệu VNĐ",
    "Trên 100 triệu VNĐ",
  ];

  /** Tooltip — Figma 40023:150979 (Lương Gross); Gross–Net (Lương Net) */
  var TNCN_FIELD_TOOLTIPS = {
    gross:
      "Lương gross là tổng tiền lương của bạn mà công ty chi trả mỗi kỳ trả lương. Bao gồm thuế và các khoản bảo hiểm.",
    net: "Lương net là tiền lương thực lãnh của bạn mỗi kỳ trả lương, là số tiền bạn có thể bỏ túi",
  };

  /**
   * Popover — Viecoi Figma: NPT 40026-168227; BH khác 40034-168873.
   * Vùng: desktop modal #regionWageModal; mobile bottom sheet (cùng nội dung #regionWageModalBodyHost).
   */
  var TNCN_FIELD_POPOVERS = {
    dependents: {
      title: "Người phụ thuộc là gì?",
      content:
        '<p class="tncn-popover-p tncn-popover-p--lead">Người phụ thuộc (NPT) là người mà đối tượng nộp thuế thu nhập cá nhân có trách nhiệm nuôi dưỡng.</p>' +
        '<div class="tncn-popover-detail">' +
        '<p class="tncn-popover-p"><strong>Con cái:</strong> Con đẻ, con nuôi hợp pháp, con ngoài giá thú, con riêng dưới 18 tuổi hoặc con trên 18 tuổi bị khuyết tật/đang học tập không có thu nhập.</p>' +
        '<p class="tncn-popover-p tncn-popover-p--last"><strong>Người thân khác:</strong> Vợ/Chồng, Cha mẹ, Anh chị em ruột... hết tuổi lao động hoặc không có khả năng lao động và không có thu nhập (hoặc thu nhập thấp).</p>' +
        "</div>",
    },
    insuranceOther: {
      title: "Mức đóng bảo hiểm khác là gì?",
      content:
        '<p class="tncn-popover-p">Bạn sẽ điền mức đóng bảo hiểm khi mức lương đóng bảo hiểm khác với mức lương chính thức.</p>' +
        '<p class="tncn-popover-p">Công cụ còn áp dụng trần lương đóng BHXH bắt buộc (20 lần mức tham chiếu theo luật), giống các máy tính thuế phổ biến.</p>' +
        '<p class="tncn-popover-p tncn-popover-p--last tncn-popover-p--example"><strong>Ví dụ:</strong><br>Lương chính thức của bạn là 10.000.000 VND<br>Mức lương đóng bảo hiểm là 8.000.000 VND</p>',
    },
  };

  function initTncnFieldTooltips() {
    if (typeof bootstrap === "undefined" || !bootstrap.Tooltip) return;
    var narrow =
      typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767.98px)").matches;
    document.querySelectorAll("[data-tncn-tooltip]").forEach(function (el) {
      var key = el.getAttribute("data-tncn-tooltip");
      if ((key === "gross" || key === "net") && narrow) return;
      var title = TNCN_FIELD_TOOLTIPS[key];
      if (!title) return;
      new bootstrap.Tooltip(el, {
        title: title,
        placement: "top",
        customClass: "tncn-field-tooltip",
        trigger: "hover",
        container: "body",
        html: false,
      });
    });
  }

  function initTncnFieldPopovers() {
    if (typeof bootstrap === "undefined" || !bootstrap.Popover) return;

    var mq =
      typeof window.matchMedia === "function"
        ? function (q) {
            return window.matchMedia(q).matches;
          }
        : function () {
            return false;
          };

    /** Hover không ổn trên cảm ứng; màn hẹp dùng click + đóng khi chạm ra ngoài (Figma mobile NPT). */
    var useClickTrigger =
      mq("(max-width: 767.98px)") || mq("(hover: none)") || mq("(pointer: coarse)");
    var preferBottomPlacement = mq("(max-width: 767.98px)") || useClickTrigger;

    if (useClickTrigger) {
      document.addEventListener(
        "pointerdown",
        function (e) {
          document.querySelectorAll("[data-tncn-popover]").forEach(function (btn) {
            var inst = bootstrap.Popover.getInstance(btn);
            if (!inst || typeof inst.isShown !== "function" || !inst.isShown()) return;
            if (btn.contains(e.target)) return;
            var tip = inst.tip;
            if (tip && tip.contains(e.target)) return;
            inst.hide();
          });
        },
        true
      );
    }

    document.querySelectorAll("[data-tncn-popover]").forEach(function (el) {
      var key = el.getAttribute("data-tncn-popover");
      var spec = TNCN_FIELD_POPOVERS[key];
      if (!spec) return;
      new bootstrap.Popover(el, {
        title: spec.title,
        content: spec.content,
        html: true,
        sanitize: false,
        placement: preferBottomPlacement ? "bottom" : "top",
        customClass: "tncn-field-popover tncn-field-popover--" + key,
        container: "body",
        trigger: useClickTrigger ? "click" : "hover",
        delay: useClickTrigger ? 0 : { show: 50, hide: 200 },
        /* Tránh popover bị cắt bởi overflow trên mobile; Popper vẫn dùng modifier mặc định của Bootstrap */
        popperConfig: { strategy: "fixed" },
      });
      el.addEventListener("shown.bs.popover", function () {
        el.setAttribute("aria-expanded", "true");
      });
      el.addEventListener("hidden.bs.popover", function () {
        el.setAttribute("aria-expanded", "false");
      });
    });
  }

  var tncnMobileSheetLockDepth = 0;

  function tncnMobileSheetPushBodyLock() {
    tncnMobileSheetLockDepth++;
    if (tncnMobileSheetLockDepth === 1) {
      document.body.classList.add("tncn-mobile-sheet-open");
    }
  }

  function tncnMobileSheetPopBodyLock() {
    tncnMobileSheetLockDepth = Math.max(0, tncnMobileSheetLockDepth - 1);
    if (tncnMobileSheetLockDepth === 0) {
      document.body.classList.remove("tncn-mobile-sheet-open");
    }
  }

  function tncnRegionWageMountBodyInSheet() {
    var bodyHost = document.getElementById("regionWageModalBodyHost");
    var shell = document.getElementById("tncn-region-sheet-body-shell");
    if (!bodyHost || !shell) return;
    if (bodyHost.parentElement === shell) return;
    shell.appendChild(bodyHost);
  }

  function tncnRegionWageEnsureBodyInModal() {
    var bodyHost = document.getElementById("regionWageModalBodyHost");
    var modalContent = document.querySelector("#regionWageModal .region-wage-modal__content");
    if (!bodyHost || !modalContent || bodyHost.parentElement === modalContent) return;
    var header = modalContent.querySelector(".region-wage-modal__header");
    if (header) {
      header.insertAdjacentElement("afterend", bodyHost);
    } else {
      modalContent.appendChild(bodyHost);
    }
  }

  /**
   * Bottom sheet trượt từ dưới (mobile ≤768): NPT, Gross, BH khác, Vùng (Vùng: nội dung modal gắn vào sheet).
   * @param {HTMLElement} sheet
   * @param {HTMLElement|null} trigger
   * @param {{ skipPopover?: boolean, interceptModal?: boolean, beforeSheetOpen?: function(HTMLElement): void, afterSheetHidden?: function(HTMLElement): void }} options
   */
  function wireTncnMobileSheet(sheet, trigger, options) {
    options = options || {};
    if (!sheet || !trigger) return;

    var skipPopover = !!options.skipPopover;
    var interceptModal = !!options.interceptModal;
    var beforeSheetOpen = typeof options.beforeSheetOpen === "function" ? options.beforeSheetOpen : null;
    var afterSheetHidden = typeof options.afterSheetHidden === "function" ? options.afterSheetHidden : null;

    var dismissers = sheet.querySelectorAll("[data-tncn-mobile-sheet-dismiss]");
    var panel = sheet.querySelector(".tncn-mobile-sheet__panel");
    var lastFocus = null;
    var closeFallbackTimer = null;
    var closeAnimHandler = null;
    var openAnimHandler = null;
    var openFocusFallbackTimer = null;

    function isNarrowViewport() {
      return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767.98px)").matches;
    }

    function prefersReducedMotion() {
      return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function restoreFocusAfterClose() {
      if (lastFocus && typeof lastFocus.focus === "function") {
        try {
          lastFocus.focus();
        } catch (ex) {}
      } else {
        try {
          trigger.focus();
        } catch (ex2) {}
      }
    }

    function finalizeClose() {
      if (sheet.hidden) return;
      if (closeFallbackTimer) {
        clearTimeout(closeFallbackTimer);
        closeFallbackTimer = null;
      }
      if (panel && closeAnimHandler) {
        try {
          panel.removeEventListener("transitionend", closeAnimHandler);
        } catch (exR) {}
        closeAnimHandler = null;
      }
      if (panel && openAnimHandler) {
        try {
          panel.removeEventListener("transitionend", openAnimHandler);
        } catch (exO) {}
        openAnimHandler = null;
      }
      if (openFocusFallbackTimer) {
        clearTimeout(openFocusFallbackTimer);
        openFocusFallbackTimer = null;
      }
      sheet.hidden = true;
      sheet.setAttribute("aria-hidden", "true");
      sheet.classList.remove("tncn-mobile-sheet--open");
      if (afterSheetHidden) {
        try {
          afterSheetHidden(sheet);
        } catch (exH) {}
      }
      tncnMobileSheetPopBodyLock();
      trigger.setAttribute("aria-expanded", "false");
      restoreFocusAfterClose();
    }

    function openSheet() {
      if (closeFallbackTimer) {
        clearTimeout(closeFallbackTimer);
        closeFallbackTimer = null;
      }
      if (openFocusFallbackTimer) {
        clearTimeout(openFocusFallbackTimer);
        openFocusFallbackTimer = null;
      }
      if (panel && openAnimHandler) {
        try {
          panel.removeEventListener("transitionend", openAnimHandler);
        } catch (exOp) {}
        openAnimHandler = null;
      }

      lastFocus = document.activeElement;
      if (beforeSheetOpen) {
        try {
          beforeSheetOpen(sheet);
        } catch (exO) {}
      }
      sheet.hidden = false;
      sheet.setAttribute("aria-hidden", "false");
      tncnMobileSheetPushBodyLock();
      trigger.setAttribute("aria-expanded", "true");
      sheet.classList.remove("tncn-mobile-sheet--open");

      var closeBtn = sheet.querySelector(".tncn-mobile-sheet__close");

      function focusCloseButton() {
        if (closeBtn) closeBtn.focus();
      }

      if (prefersReducedMotion() || !panel) {
        sheet.classList.add("tncn-mobile-sheet--open");
        focusCloseButton();
        return;
      }

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          sheet.classList.add("tncn-mobile-sheet--open");
        });
      });

      openAnimHandler = function onOpenEnd(e) {
        if (e.target !== panel || e.propertyName !== "transform") return;
        panel.removeEventListener("transitionend", openAnimHandler);
        openAnimHandler = null;
        if (!sheet.hidden && sheet.classList.contains("tncn-mobile-sheet--open")) focusCloseButton();
      };
      panel.addEventListener("transitionend", openAnimHandler);
      openFocusFallbackTimer = window.setTimeout(function () {
        openFocusFallbackTimer = null;
        if (panel && openAnimHandler) {
          panel.removeEventListener("transitionend", openAnimHandler);
          openAnimHandler = null;
        }
        if (!sheet.hidden && sheet.classList.contains("tncn-mobile-sheet--open")) focusCloseButton();
      }, 400);
    }

    function closeSheet() {
      if (sheet.hidden) return;
      if (openFocusFallbackTimer) {
        clearTimeout(openFocusFallbackTimer);
        openFocusFallbackTimer = null;
      }
      if (closeFallbackTimer) {
        clearTimeout(closeFallbackTimer);
        closeFallbackTimer = null;
      }
      if (panel && openAnimHandler) {
        try {
          panel.removeEventListener("transitionend", openAnimHandler);
        } catch (exCl) {}
        openAnimHandler = null;
      }

      if (!sheet.classList.contains("tncn-mobile-sheet--open")) {
        finalizeClose();
        return;
      }

      sheet.classList.remove("tncn-mobile-sheet--open");

      if (prefersReducedMotion() || !panel) {
        finalizeClose();
        return;
      }

      var closed = false;
      function finishCloseOnce() {
        if (closed) return;
        closed = true;
        finalizeClose();
      }

      closeAnimHandler = function onCloseEnd(e) {
        if (e.target !== panel || e.propertyName !== "transform") return;
        panel.removeEventListener("transitionend", closeAnimHandler);
        closeAnimHandler = null;
        finishCloseOnce();
      };
      panel.addEventListener("transitionend", closeAnimHandler);
      closeFallbackTimer = window.setTimeout(function () {
        if (panel && closeAnimHandler) {
          panel.removeEventListener("transitionend", closeAnimHandler);
          closeAnimHandler = null;
        }
        finishCloseOnce();
        closeFallbackTimer = null;
      }, 400);
    }

    function onKeyDown(e) {
      if (sheet.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeSheet();
      }
    }

    trigger.addEventListener(
      "click",
      function (e) {
        if (!isNarrowViewport()) return;
        if (interceptModal) {
          e.preventDefault();
          e.stopImmediatePropagation();
        } else {
          e.preventDefault();
          e.stopPropagation();
        }
        if (!skipPopover && typeof bootstrap !== "undefined" && bootstrap.Popover) {
          var inst = bootstrap.Popover.getInstance(trigger);
          if (inst && typeof inst.isShown === "function" && inst.isShown()) {
            try {
              inst.hide();
            } catch (ex0) {}
          }
        }
        if (sheet.classList.contains("tncn-mobile-sheet--open")) {
          closeSheet();
          return;
        }
        if (!sheet.hidden) return;
        openSheet();
      },
      true
    );

    dismissers.forEach(function (d) {
      d.addEventListener("click", function (e) {
        e.preventDefault();
        closeSheet();
      });
    });

    if (panel) {
      panel.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    document.addEventListener("keydown", onKeyDown);
    sheet._tncnCloseSheet = closeSheet;
  }

  function initTncnMobileSheets() {
    wireTncnMobileSheet(
      document.getElementById("tncn-deps-sheet"),
      document.querySelector('[data-tncn-popover="dependents"]'),
      {}
    );
    wireTncnMobileSheet(
      document.getElementById("tncn-gross-sheet"),
      document.querySelector('[data-tncn-tooltip="gross"]'),
      { skipPopover: true }
    );
    var netSheet = document.getElementById("tncn-net-sheet");
    var netSheetTrigger = document.querySelector('[data-tncn-tooltip="net"]');
    if (netSheet && netSheetTrigger) {
      wireTncnMobileSheet(netSheet, netSheetTrigger, { skipPopover: true });
    }
    wireTncnMobileSheet(
      document.getElementById("tncn-insurance-sheet"),
      document.querySelector('[data-tncn-popover="insuranceOther"]'),
      {}
    );
    wireTncnMobileSheet(
      document.getElementById("tncn-region-sheet"),
      document.querySelector(".field-label__hint--region-modal"),
      {
        skipPopover: true,
        interceptModal: true,
        beforeSheetOpen: tncnRegionWageMountBodyInSheet,
        afterSheetHidden: tncnRegionWageEnsureBodyInModal,
      }
    );
  }

  /**
   * Modal “Giải thích mức lương theo vùng” — desktop ≥768: mở modal (mobile dùng bottom sheet, nội dung chung #regionWageModalBodyHost).
   */
  function initRegionWageModal() {
    var modalEl = document.getElementById("regionWageModal");
    var trigger = document.querySelector(".field-label__hint--region-modal");
    if (!modalEl || !trigger || typeof bootstrap === "undefined" || !bootstrap.Modal) return;

    function isDesktopForRegionModal() {
      return typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches;
    }

    trigger.addEventListener("click", function () {
      if (!isDesktopForRegionModal()) return;
      tncnRegionWageEnsureBodyInModal();
      try {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
      } catch (ex) {}
    });

    modalEl.addEventListener("hidden.bs.modal", function () {
      if (trigger) trigger.focus();
    });
  }

  function formatPlainVnd(amount) {
    var n = Math.round(Number(amount));
    if (!isFinite(n)) n = 0;
    return n.toLocaleString("vi-VN");
  }

  function formatCurrency(amount) {
    return formatPlainVnd(amount) + " đ";
  }

  /** Dòng kết quả hero Figma: "120.000 VND" */
  function formatHeroVnd(amount) {
    return formatPlainVnd(amount) + " VND";
  }

  function parseMoneyInput(str) {
    if (str == null) return 0;
    var digits = String(str).replace(/\D/g, "");
    if (!digits) return 0;
    return parseInt(digits, 10) || 0;
  }

  function formatMoneyInput(value) {
    var n = Math.floor(Number(value));
    if (!isFinite(n) || n < 0) n = 0;
    return n.toLocaleString("vi-VN");
  }

  function roundMoney(n) {
    return Math.round(Number(n));
  }

  /**
   * @param {string} [regionKey] I | II | III | IV
   * @param {string} [wageRegime] "state" | "private" — mặc định private (20×MLTT)
   */
  function bhtnSalaryCeilingForRegion(regionKey, wageRegime) {
    if (String(wageRegime) === "state") {
      return INSURANCE_SALARY_CEILING;
    }
    var k = String(regionKey || "I").toUpperCase();
    var minWage = REGION_MIN_WAGE_MONTHLY[k];
    if (!minWage) minWage = REGION_MIN_WAGE_MONTHLY.I;
    return 20 * minWage;
  }

  /** Thời gian hưởng TCTN (tháng) theo tổng thời gian đóng BHTN chưa hưởng — Luật Việc làm (bậc phổ biến). */
  function bhtnTctnBenefitMonths(contributionMonths) {
    var m = Math.floor(Number(contributionMonths) || 0);
    if (m < 12) return 0;
    if (m < 36) return 3;
    if (m < 72) return 6;
    if (m < 120) return 9;
    return 12;
  }

  /**
   * Mức hưởng TCTN một tháng ≈ 60% mức căn cứ đóng BHTN (bình quân 6 tháng khi nhập một mức).
   * Trần hưởng: DN nhà nước (tiền lương do Nhà nước quy định) — 5 × LCS;
   * DN tư nhân / do NSDLĐ quyết định — 5 × MLTT vùng (tham khảo cách các trang tính BHTN 2026, vd. bejob.vn, joboko).
   * @param {number} baseBhtnSalary
   * @param {string} [regionKey] I | II | III | IV
   * @param {string} [wageRegime] "state" | "private"
   */
  function bhtnTctnMonthlyBenefit(baseBhtnSalary, regionKey, wageRegime) {
    var base = Math.max(0, Math.round(Number(baseBhtnSalary) || 0));
    var raw = roundMoney(base * 0.6);
    var k = String(regionKey || "I").toUpperCase();
    var mltt = REGION_MIN_WAGE_MONTHLY[k] || REGION_MIN_WAGE_MONTHLY.I;
    var cap =
      String(wageRegime) === "state"
        ? 5 * REFERENCE_WAGE_INSURANCE
        : 5 * mltt;
    return Math.min(raw, cap);
  }

  /**
   * @param {number} insDeclared - Tiền lương làm căn cứ đóng BH (đã min với gross, nhập “Khác” nếu có)
   * @param {string} [regionKey] - I | II | III | IV (radio Vùng MLTT)
   * @param {string} [wageRegime] "state" | "private" — chỉ ảnh hưởng trần BHTN; mặc định private
   * @returns {{ bhxh: number, bhyt: number, bhtn: number, total: number, baseBhxhBhyt: number, baseBhtn: number }}
   */
  function calcInsurance(insDeclared, regionKey, wageRegime) {
    var d = Math.max(0, Number(insDeclared) || 0);
    var ceilingSoc = INSURANCE_SALARY_CEILING;
    var ceilingTn = bhtnSalaryCeilingForRegion(regionKey, wageRegime);
    var baseSoc = Math.min(d, ceilingSoc);
    var baseTn = Math.min(d, ceilingTn);
    var bhxh = roundMoney(baseSoc * RATE_BHXH);
    var bhyt = roundMoney(baseSoc * RATE_BHYT);
    var bhtn = roundMoney(baseTn * RATE_BHTN);
    return {
      bhxh: bhxh,
      bhyt: bhyt,
      bhtn: bhtn,
      total: bhxh + bhyt + bhtn,
      baseBhxhBhyt: baseSoc,
      baseBhtn: baseTn,
    };
  }

  /**
   * BH bắt buộc do NSDLĐ đóng (cùng căn cứ NLĐ; trần BHTN theo wageRegime như calcInsurance).
   * @param {string} [wageRegime] "state" | "private"
   * @returns {{ bhxh: number, tnldBnn: number, bhyt: number, bhtn: number, total: number, baseBhxhBhyt: number, baseBhtn: number }}
   */
  function calcEmployerInsurance(insDeclared, regionKey, wageRegime) {
    var d = Math.max(0, Number(insDeclared) || 0);
    var ceilingSoc = INSURANCE_SALARY_CEILING;
    var ceilingTn = bhtnSalaryCeilingForRegion(regionKey, wageRegime);
    var baseSoc = Math.min(d, ceilingSoc);
    var baseTn = Math.min(d, ceilingTn);
    var employerSocFull = roundMoney(baseSoc * RATE_BHXH_EMPLOYER);
    var bhxh = roundMoney(baseSoc * RATE_BHXH_EMPLOYER_SOC);
    var tnldBnn = Math.max(0, employerSocFull - bhxh);
    var bhyt = roundMoney(baseSoc * RATE_BHYT_EMPLOYER);
    var bhtn = roundMoney(baseTn * RATE_BHTN_EMPLOYER);
    return {
      bhxh: bhxh,
      tnldBnn: tnldBnn,
      bhyt: bhyt,
      bhtn: bhtn,
      total: bhxh + tnldBnn + bhyt + bhtn,
      baseBhxhBhyt: baseSoc,
      baseBhtn: baseTn,
    };
  }

  function calcTaxableIncome(grossSalary, employeeInsuranceTotal, dependentCount, otherDeductions) {
    var g = Math.max(0, Number(grossSalary) || 0);
    var ins = Math.max(0, Number(employeeInsuranceTotal) || 0);
    var deps = Math.max(0, Math.floor(Number(dependentCount) || 0));
    var other = Math.max(0, Number(otherDeductions) || 0);
    var raw =
      g -
      ins -
      PERSONAL_DEDUCTION -
      deps * DEPENDENT_DEDUCTION -
      other;
    return Math.max(0, Math.round(raw));
  }

  /**
   * Thuế TNCN theo biểu lũy tiến tháng (theo spec: 5%, 10%, 20%, 30%, 35%).
   * @returns {{ tax: number, bands: Array<{label:string,rate:number,amountInBand:number,taxInBand:number}> }}
   */
  function calcPersonalIncomeTaxDetailed(taxableMonthly) {
    var taxable = Math.max(0, Math.round(Number(taxableMonthly) || 0));
    var remaining = taxable;
    var cursor = 0;
    var totalTax = 0;
    var bands = [];

    for (var i = 0; i < BRACKET_CAPS.length; i++) {
      var cap = BRACKET_CAPS[i];
      var rate = BRACKET_RATES[i];
      var width =
        cap === Infinity ? Math.max(0, remaining) : Math.max(0, cap - cursor);
      var amountInBand = Math.min(remaining, width);
      var taxInBand = roundMoney(amountInBand * rate);
      totalTax += taxInBand;

      bands.push({
        label: FIGMA_BRACKET_LABELS[i] || "",
        rate: rate,
        amountInBand: amountInBand,
        taxInBand: taxInBand,
      });

      remaining -= amountInBand;
      cursor = cap === Infinity ? cursor + amountInBand : cap;
    }

    return { tax: totalTax, bands: bands };
  }

  function calcPersonalIncomeTax(taxableMonthly) {
    return calcPersonalIncomeTaxDetailed(taxableMonthly).tax;
  }

  function calcNetSalary(grossSalary, employeeInsuranceTotal, personalIncomeTax) {
    var g = Math.max(0, Number(grossSalary) || 0);
    var ins = Math.max(0, Number(employeeInsuranceTotal) || 0);
    var tax = Math.max(0, Number(personalIncomeTax) || 0);
    return Math.max(0, Math.round(g - ins - tax));
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function showFormError(message) {
    var el = document.getElementById("tncn-form-error");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function hideFormError() {
    var el = document.getElementById("tncn-form-error");
    if (!el) return;
    el.textContent = "";
    el.hidden = true;
  }

  function showGrossFieldError() {
    var shell = document.getElementById("gross-field-shell");
    var msg = document.getElementById("gross-error");
    var inp = document.getElementById("gross");
    if (shell) shell.classList.add("field-tncn__shell--error");
    if (msg) msg.hidden = false;
    if (inp) {
      inp.setAttribute("aria-invalid", "true");
      inp.setAttribute("aria-describedby", "gross-error");
    }
  }

  function hideGrossFieldError() {
    var shell = document.getElementById("gross-field-shell");
    var msg = document.getElementById("gross-error");
    var inp = document.getElementById("gross");
    if (shell) shell.classList.remove("field-tncn__shell--error");
    if (msg) msg.hidden = true;
    if (inp) {
      inp.setAttribute("aria-invalid", "false");
      inp.removeAttribute("aria-describedby");
    }
  }

  function showInsuranceOtherError() {
    var card = document.getElementById("insurance-other-card");
    var shell = document.getElementById("insurance-other-shell");
    var msg = document.getElementById("insurance-other-error");
    var inp = document.getElementById("insurance_other");
    if (card) card.classList.add("radio-card--other--invalid");
    if (shell) shell.classList.add("field-tncn__shell--error");
    if (msg) msg.hidden = false;
    if (inp) {
      inp.setAttribute("aria-invalid", "true");
      inp.setAttribute("aria-describedby", "insurance-other-error");
    }
  }

  function hideInsuranceOtherError() {
    var card = document.getElementById("insurance-other-card");
    var shell = document.getElementById("insurance-other-shell");
    var msg = document.getElementById("insurance-other-error");
    var inp = document.getElementById("insurance_other");
    if (card) card.classList.remove("radio-card--other--invalid");
    if (shell) shell.classList.remove("field-tncn__shell--error");
    if (msg) msg.hidden = true;
    if (inp) {
      inp.setAttribute("aria-invalid", "false");
      inp.removeAttribute("aria-describedby");
    }
  }

  function resetGnResultsAfterAmountClear() {
    var pane = document.getElementById("gn-results-pane");
    if (pane) pane.hidden = true;
  }

  function hideGnFormError() {
    var el = document.getElementById("gn-form-error");
    if (!el) return;
    el.textContent = "";
    el.hidden = true;
  }

  function showGnFormError(message) {
    var el = document.getElementById("gn-form-error");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function hideGnAmountFieldError() {
    var shell = document.getElementById("gn-amount-field-shell");
    var msg = document.getElementById("gn-amount-error");
    var inp = document.getElementById("gn-amount");
    if (shell) shell.classList.remove("field-tncn__shell--error");
    if (msg) msg.hidden = true;
    if (inp) {
      inp.setAttribute("aria-invalid", "false");
      inp.removeAttribute("aria-describedby");
    }
  }

  function showGnAmountFieldError() {
    var shell = document.getElementById("gn-amount-field-shell");
    var msg = document.getElementById("gn-amount-error");
    var inp = document.getElementById("gn-amount");
    if (shell) shell.classList.add("field-tncn__shell--error");
    if (msg) msg.hidden = false;
    if (inp) {
      inp.setAttribute("aria-invalid", "true");
      inp.setAttribute("aria-describedby", "gn-amount-error");
    }
  }

  function hideGnInsuranceOtherError() {
    var card = document.getElementById("gn-insurance-other-card");
    var shell = document.getElementById("gn-insurance-other-shell");
    var msg = document.getElementById("gn-insurance-other-error");
    var inp = document.getElementById("gn-insurance_other");
    if (card) card.classList.remove("radio-card--other--invalid");
    if (shell) shell.classList.remove("field-tncn__shell--error");
    if (msg) msg.hidden = true;
    if (inp) {
      inp.setAttribute("aria-invalid", "false");
      inp.removeAttribute("aria-describedby");
    }
  }

  function showGnInsuranceOtherError() {
    var card = document.getElementById("gn-insurance-other-card");
    var shell = document.getElementById("gn-insurance-other-shell");
    var msg = document.getElementById("gn-insurance-other-error");
    var inp = document.getElementById("gn-insurance_other");
    if (card) card.classList.add("radio-card--other--invalid");
    if (shell) shell.classList.add("field-tncn__shell--error");
    if (msg) msg.hidden = false;
    if (inp) {
      inp.setAttribute("aria-invalid", "true");
      inp.setAttribute("aria-describedby", "gn-insurance-other-error");
    }
  }

  function clearBracketGrid() {
    var grid = document.getElementById("tncn-bracket-grid");
    if (grid) grid.innerHTML = "";
  }

  /**
   * Giống VietnamWorks khi xóa ô lương: đưa kết quả về trạng thái chưa tính,
   * ẩn vùng kết quả (tool này tính theo nút submit, không auto-recalc từng ký tự).
   */
  function resetTncnResultsAfterGrossClear() {
    hideFormError();
    clearBracketGrid();
    setText("tncn-hero-tax", "—");
    setText("tncn-val-gross", "—");
    setText("tncn-val-bhxh", "—");
    setText("tncn-val-bhyt", "—");
    setText("tncn-val-bhtn", "—");
    setText("tncn-val-pretax", "—");
    setText("tncn-val-deduct-self", formatPlainVnd(PERSONAL_DEDUCTION));
    setText("tncn-val-deduct-dep", "—");
    setText("tncn-val-taxable", "—");
    setText("tncn-val-tax", "—");
    var pane = document.getElementById("tncn-results-pane");
    if (pane) pane.hidden = true;
  }

  function bracketMakeCell(text, isHead, isTierCol) {
    var c = document.createElement("div");
    c.className =
      "tncn-bracket-figma__cell" +
      (isHead ? " tncn-bracket-figma__cell--head" : "");
    if (isTierCol) {
      var span = document.createElement("span");
      span.className = "tncn-bracket-figma__tier-text";
      span.textContent = text;
      span.setAttribute("title", text);
      c.appendChild(span);
    } else {
      c.textContent = text;
    }
    return c;
  }

  /**
   * Thanh cuộn ngang luôn hiện (mobile): đồng bộ thumb với .tncn-bracket-figma-scroll.
   * Gọi sau mỗi lần render bảng bậc thuế; chỉ gắn listener một lần / phần tử.
   */
  function bindTncnBracketHScrollIndicator(scrollEl) {
    if (!scrollEl || scrollEl.dataset.bracketHScrollBound === "1") return;
    scrollEl.dataset.bracketHScrollBound = "1";
    var outer = scrollEl.parentElement;
    if (!outer || !outer.classList.contains("tncn-bracket-figma-outer")) return;
    var track = outer.querySelector(".tncn-bracket-figma-hscroll__track");
    var thumb = outer.querySelector(".tncn-bracket-figma-hscroll__thumb");
    if (!track || !thumb) return;

    function sync() {
      var sw = scrollEl.scrollWidth;
      var cw = scrollEl.clientWidth;
      var maxScroll = Math.max(0, sw - cw);
      var tw = track.clientWidth;
      if (tw <= 0) return;
      if (maxScroll <= 0) {
        thumb.style.width = tw + "px";
        thumb.style.transform = "translateX(0)";
        return;
      }
      var thumbW = Math.max(28, Math.round((cw / sw) * tw));
      var maxThumbLeft = Math.max(0, tw - thumbW);
      var ratio = maxScroll > 0 ? scrollEl.scrollLeft / maxScroll : 0;
      var left = Math.round(ratio * maxThumbLeft);
      thumb.style.width = thumbW + "px";
      thumb.style.transform = "translateX(" + left + "px)";
    }

    scrollEl.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(sync);
      ro.observe(scrollEl);
      var inner = scrollEl.querySelector(".tncn-bracket-figma");
      if (inner) ro.observe(inner);
    }
    sync();
  }

  /** Mỗi hàng = một grid 4 cột — căn hàng đúng trên mobile (không dùng 4 cột flex dọc). */
  function renderBracketGrid(detail) {
    var grid = document.getElementById("tncn-bracket-grid");
    if (!grid) return;
    grid.innerHTML = "";

    var headRow = document.createElement("div");
    headRow.className =
      "tncn-bracket-figma__row tncn-bracket-figma__row--head";
    headRow.appendChild(bracketMakeCell("Mức chịu thuế", true, true));
    headRow.appendChild(bracketMakeCell("Thuế suất", true, false));
    headRow.appendChild(bracketMakeCell("Lương chịu thuế", true, false));
    headRow.appendChild(bracketMakeCell("Tiền nộp", true, false));
    grid.appendChild(headRow);

    detail.bands.forEach(function (b) {
      var row = document.createElement("div");
      row.className = "tncn-bracket-figma__row";
      row.appendChild(bracketMakeCell(b.label, false, true));
      row.appendChild(
        bracketMakeCell(
          (b.rate * 100).toLocaleString("vi-VN") + "%",
          false
        )
      );
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
    if (
      scrollHost &&
      scrollHost.classList &&
      scrollHost.classList.contains("tncn-bracket-figma-scroll")
    ) {
      bindTncnBracketHScrollIndicator(scrollHost);
    }
  }

  function wireMoneyInput(input) {
    if (!input) return;
    input.addEventListener("input", function () {
      var raw = input.value.replace(/\D/g, "");
      if (!raw) {
        input.value = "";
        return;
      }
      input.value = formatMoneyInput(parseInt(raw, 10));
    });
    input.addEventListener("blur", function () {
      var v = parseMoneyInput(input.value);
      input.value = v ? formatMoneyInput(v) : "";
    });
  }

  /** Trần gợi ý gross (VND/tháng) — tối đa dưới 1 tỷ, đủ phạm vi lương thường gặp */
  var GROSS_SUGGEST_MAX = 999999999;

  /**
   * Gợi ý theo hàng triệu từ chữ số đang gõ (tối đa dưới 1 tỷ):
   * "14" → 1.400.000, 14.000.000, 140.000.000; "155" thêm 15.500.000 (×10⁵ trước bội triệu).
   * Nếu đã gõ đủ một số ≥ 1.000.000 thì chỉ gợi ý đúng số đó (không nhân thêm).
   */
  function grossPrefixMoneySuggestions(q) {
    var base = parseInt(q, 10);
    if (!isFinite(base) || base <= 0) return [];
    var seen = {};
    var out = [];

    function tryPush(amt) {
      var a = Math.round(Number(amt));
      if (!isFinite(a) || a < 1000000 || a > GROSS_SUGGEST_MAX) return;
      var ds = String(a);
      if (ds.indexOf(q) !== 0) return;
      if (seen[a]) return;
      seen[a] = true;
      out.push(a);
    }

    if (base < 1000000) {
      tryPush(base * Math.pow(10, 5));
      var k;
      for (k = 6; k <= 8; k++) {
        tryPush(base * Math.pow(10, k));
      }
    } else {
      tryPush(base);
    }

    out.sort(function (x, y) {
      return x - y;
    });
    return out;
  }

  /**
   * @param {{ rootId: string, inputId: string, panelId: string, listId: string, customLiId: string, hideFieldError?: function(): void }} opts
   */
  function wireMoneyCombobox(opts) {
    var root = document.getElementById(opts.rootId);
    var input = document.getElementById(opts.inputId);
    var panel = document.getElementById(opts.panelId);
    var list = document.getElementById(opts.listId);
    if (!root || !input || !panel || !list) return;

    var customLi = document.getElementById(opts.customLiId);
    var presetItems = list.querySelectorAll(".gross-ac__preset[data-amount]");
    var blurCloseTimer = null;
    var hideFieldError = opts.hideFieldError || function () {};

    function clearBlurTimer() {
      if (blurCloseTimer) {
        clearTimeout(blurCloseTimer);
        blurCloseTimer = null;
      }
    }

    function formatComboboxDigits() {
      var raw = input.value.replace(/\D/g, "");
      if (!raw) {
        input.value = "";
        return;
      }
      input.value = formatMoneyInput(parseInt(raw, 10));
    }

    function clearDynSuggestions() {
      var nodes = list.querySelectorAll(".gross-ac__dyn");
      var r = nodes.length;
      while (r--) {
        nodes[r].parentNode.removeChild(nodes[r]);
      }
    }

    function renderDynSuggestions(amounts) {
      clearDynSuggestions();
      if (!customLi || !amounts.length) return;
      var frag = document.createDocumentFragment();
      var idx;
      for (idx = 0; idx < amounts.length; idx++) {
        var li = document.createElement("li");
        li.className = "gross-ac__item gross-ac__item--dyn gross-ac__dyn";
        li.setAttribute("role", "option");
        li.setAttribute("tabindex", "-1");
        li.setAttribute("data-amount", String(amounts[idx]));
        li.textContent = formatPlainVnd(amounts[idx]);
        frag.appendChild(li);
      }
      customLi.parentNode.insertBefore(frag, customLi.nextSibling);
    }

    function filterItems() {
      var q = input.value.replace(/\D/g, "");
      var visible = 0;

      if (!q) {
        clearDynSuggestions();
        if (customLi) customLi.hidden = true;
        for (var a = 0; a < presetItems.length; a++) {
          presetItems[a].hidden = false;
          visible++;
        }
        return visible;
      }

      var n = parseInt(q, 10);
      if (!isFinite(n) || n <= 0) {
        clearDynSuggestions();
        if (customLi) customLi.hidden = true;
        for (var b = 0; b < presetItems.length; b++) {
          presetItems[b].hidden = true;
        }
        return 0;
      }

      var dynAmounts = grossPrefixMoneySuggestions(q);
      var sugSet = {};
      var s;
      for (s = 0; s < dynAmounts.length; s++) {
        sugSet[dynAmounts[s]] = true;
      }
      renderDynSuggestions(dynAmounts);
      if (customLi) {
        customLi.hidden = true;
      }
      visible += dynAmounts.length;

      for (var i = 0; i < presetItems.length; i++) {
        var li = presetItems[i];
        var amt = li.getAttribute("data-amount") || "";
        var amtNum = parseInt(amt, 10);
        var match = amt.indexOf(q) === 0;
        if (sugSet[amtNum]) match = false;
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

    function onComboboxInput() {
      formatComboboxDigits();
      hideFieldError();
      syncPanel();
    }

    input.addEventListener("input", onComboboxInput);

    input.addEventListener("focus", function () {
      if (input.readOnly) return;
      clearBlurTimer();
      syncPanel();
    });

    input.addEventListener("blur", function () {
      clearBlurTimer();
      blurCloseTimer = setTimeout(function () {
        blurCloseTimer = null;
        closePanel();
        var v = parseMoneyInput(input.value);
        input.value = v ? formatMoneyInput(v) : "";
      }, 180);
    });

    list.addEventListener("mousedown", function (e) {
      var li = e.target && e.target.closest(".gross-ac__item[data-amount]");
      if (!li || li.hidden) return;
      e.preventDefault();
      clearBlurTimer();
      var amt = parseInt(li.getAttribute("data-amount"), 10);
      if (!isFinite(amt) || amt <= 0) return;
      input.value = formatMoneyInput(amt);
      hideFieldError();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      /* input + focus gọi syncPanel() và mở lại list — đóng sau một nhịp */
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
  }

  function wireGrossCombobox() {
    wireMoneyCombobox({
      rootId: "gross-ac",
      inputId: "gross",
      panelId: "gross-ac-panel",
      listId: "gross-ac-listbox",
      customLiId: "gross-ac-custom",
      hideFieldError: hideGrossFieldError,
    });
  }

  function wireInsuranceOtherCombobox() {
    wireMoneyCombobox({
      rootId: "insurance-ac",
      inputId: "insurance_other",
      panelId: "insurance-ac-panel",
      listId: "insurance-ac-listbox",
      customLiId: "insurance-ac-custom",
      hideFieldError: hideInsuranceOtherError,
    });
  }

  function syncMoneyClearButtonVisibility(input, button) {
    if (!input || !button) return;
    if (input.readOnly) {
      button.hidden = true;
      return;
    }
    var d = input.value.replace(/\D/g, "");
    var n = parseInt(d, 10) || 0;
    button.hidden = !(d.length > 0 && n > 0);
  }

  function wireMoneyInputClear(inputId, buttonId, hideFieldError, onClear) {
    var input = document.getElementById(inputId);
    var btn = document.getElementById(buttonId);
    if (!input || !btn) return;

    function syncBtn() {
      syncMoneyClearButtonVisibility(input, btn);
    }

    input.addEventListener("input", syncBtn);
    input.addEventListener("focus", syncBtn);
    input.addEventListener("blur", function () {
      setTimeout(syncBtn, 200);
    });

    btn.addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      input.value = "";
      if (hideFieldError) hideFieldError();
      if (typeof onClear === "function") onClear();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      syncBtn();
      input.focus();
    });

    syncBtn();
  }

  function getDependents() {
    var el = document.getElementById("dependents");
    if (!el) return 0;
    var n = parseInt(String(el.value).replace(/\D/g, ""), 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  function syncInsuranceMode() {
    var other = document.querySelector('input[name="insurance_salary"][value="other"]');
    var inp = document.getElementById("insurance_other");
    var wrap = document.getElementById("insurance-other-wrap");
    var insPanel = document.getElementById("insurance-ac-panel");
    if (!inp) return;

    var isOther = other && other.checked;
    inp.readOnly = !isOther;
    if (wrap) {
      wrap.classList.toggle("input-figma--muted", !isOther);
    }
    if (!isOther) {
      if (insPanel) insPanel.hidden = true;
      inp.setAttribute("aria-expanded", "false");
      inp.blur();
      hideInsuranceOtherError();
      inp.value = formatMoneyInput(0);
    } else if (parseMoneyInput(inp.value) === 0) {
      inp.value = "";
    }
    var insClearBtn = document.getElementById("insurance_other-clear");
    syncMoneyClearButtonVisibility(inp, insClearBtn);
  }

  function getGnDependents() {
    var el = document.getElementById("gn-dependents");
    if (!el) return 0;
    var n = parseInt(String(el.value).replace(/\D/g, ""), 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  function syncGnStepperButtons() {
    var minus = document.getElementById("gn-dep-minus");
    if (minus) minus.disabled = getGnDependents() <= 0;
  }

  function syncGnInsuranceMode() {
    var other = document.querySelector('input[name="gn_insurance_salary"][value="other"]');
    var inp = document.getElementById("gn-insurance_other");
    var wrap = document.getElementById("gn-insurance-other-wrap");
    var insPanel = document.getElementById("gn-insurance-ac-panel");
    if (!inp) return;

    var isOther = other && other.checked;
    inp.readOnly = !isOther;
    if (wrap) {
      wrap.classList.toggle("input-figma--muted", !isOther);
    }
    if (!isOther) {
      if (insPanel) insPanel.hidden = true;
      inp.setAttribute("aria-expanded", "false");
      inp.blur();
      hideGnInsuranceOtherError();
      inp.value = formatMoneyInput(0);
    } else if (parseMoneyInput(inp.value) === 0) {
      inp.value = "";
    }
    var insClearBtn = document.getElementById("gn-insurance_other-clear");
    syncMoneyClearButtonVisibility(inp, insClearBtn);
  }

  function wireGrossNetPage() {
    if (!document.getElementById("gn-form")) return;

    wireMoneyCombobox({
      rootId: "gn-gross-ac",
      inputId: "gn-amount",
      panelId: "gn-gross-ac-panel",
      listId: "gn-gross-ac-listbox",
      customLiId: "gn-gross-ac-custom",
      hideFieldError: hideGnAmountFieldError,
    });
    wireMoneyCombobox({
      rootId: "gn-insurance-ac",
      inputId: "gn-insurance_other",
      panelId: "gn-insurance-ac-panel",
      listId: "gn-insurance-ac-listbox",
      customLiId: "gn-insurance-ac-custom",
      hideFieldError: hideGnInsuranceOtherError,
    });
    wireMoneyInputClear(
      "gn-amount",
      "gn-amount-clear",
      hideGnAmountFieldError,
      resetGnResultsAfterAmountClear
    );
    wireMoneyInputClear(
      "gn-insurance_other",
      "gn-insurance_other-clear",
      hideGnInsuranceOtherError,
      null
    );

    document.querySelectorAll('input[name="gn_insurance_salary"]').forEach(function (r) {
      r.addEventListener("change", syncGnInsuranceMode);
    });
    syncGnInsuranceMode();

    var depMinus = document.getElementById("gn-dep-minus");
    var depPlus = document.getElementById("gn-dep-plus");
    var depInput = document.getElementById("gn-dependents");
    if (depMinus && depPlus && depInput) {
      depMinus.addEventListener("click", function () {
        var v = getGnDependents();
        if (v > 0) {
          depInput.value = String(v - 1);
          syncGnStepperButtons();
        }
      });
      depPlus.addEventListener("click", function () {
        depInput.value = String(getGnDependents() + 1);
        syncGnStepperButtons();
      });
      depInput.addEventListener("input", function () {
        var d = String(depInput.value).replace(/\D/g, "");
        depInput.value = d === "" ? "" : String(parseInt(d, 10) || 0);
        syncGnStepperButtons();
      });
      syncGnStepperButtons();
    }
  }

  function syncStepperButtons() {
    var minus = document.getElementById("dep-minus");
    if (minus) minus.disabled = getDependents() <= 0;
  }

  /** Căn padding-top body theo chiều cao header fixed (đổi theo responsive). */
  function syncSiteHeaderFixedOffset() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    function apply() {
      var h = Math.ceil(header.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty("--site-header-offset", h + "px");
      }
    }
    apply();
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () {
        apply();
      });
      ro.observe(header);
    } else {
      window.addEventListener("resize", apply);
    }
    window.addEventListener("load", apply, { once: true });
  }

  /** Menu “Công cụ” header — Figma 20233-22115 */
  function initSiteHeaderToolDropdown() {
    var item = document.querySelector(".site-nav__item--dropdown");
    var btn = document.getElementById("site-nav-tools-trigger");
    var menu = document.getElementById("site-nav-tools-menu");
    if (!item || !btn || !menu) return;

    function setOpen(open) {
      item.classList.toggle("site-nav__item--open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      menu.hidden = !open;
      menu.setAttribute("aria-hidden", open ? "false" : "true");
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!!menu.hidden);
    });

    menu.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (a) setOpen(false);
    });

    document.addEventListener("click", function (e) {
      if (!item.contains(e.target)) setOpen(false);
    });

    window.addEventListener("resize", function () {
      setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    syncSiteHeaderFixedOffset();
    initSiteHeaderToolDropdown();
    initTncnFieldTooltips();
    initTncnFieldPopovers();
    initTncnMobileSheets();
    initRegionWageModal();

    if (document.getElementById("gross-ac")) {
      wireGrossCombobox();
      wireMoneyInputClear(
        "gross",
        "gross-clear",
        hideGrossFieldError,
        resetTncnResultsAfterGrossClear
      );
    }

    if (document.getElementById("insurance-ac")) {
      wireInsuranceOtherCombobox();
      wireMoneyInputClear(
        "insurance_other",
        "insurance_other-clear",
        hideInsuranceOtherError,
        null
      );
      document.querySelectorAll('input[name="insurance_salary"]').forEach(function (r) {
        r.addEventListener("change", syncInsuranceMode);
      });
      syncInsuranceMode();
    }

    var depMinus = document.getElementById("dep-minus");
    var depPlus = document.getElementById("dep-plus");
    var depInput = document.getElementById("dependents");
    if (depMinus && depPlus && depInput) {
      depMinus.addEventListener("click", function () {
        var v = getDependents();
        if (v > 0) {
          depInput.value = String(v - 1);
          syncStepperButtons();
        }
      });
      depPlus.addEventListener("click", function () {
        depInput.value = String(getDependents() + 1);
        syncStepperButtons();
      });
      depInput.addEventListener("input", function () {
        var d = String(depInput.value).replace(/\D/g, "");
        depInput.value = d === "" ? "" : String(parseInt(d, 10) || 0);
        syncStepperButtons();
      });
      syncStepperButtons();
    }

    wireGrossNetPage();

    var form = document.getElementById("tncn-form");
    if (form) {
      form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideFormError();
      hideGrossFieldError();
      hideInsuranceOtherError();

      var grossInput = document.getElementById("gross");
      var insInput = document.getElementById("insurance_other");
      var gross = parseMoneyInput(grossInput && grossInput.value);

      if (!gross) {
        showGrossFieldError();
        return;
      }

      var modeOther = document.querySelector(
        'input[name="insurance_salary"][value="other"]'
      );
      var insuranceSalary = gross;
      if (modeOther && modeOther.checked) {
        var insSalary = parseMoneyInput(insInput && insInput.value);
        if (!insSalary) {
          showInsuranceOtherError();
          return;
        }
        insuranceSalary = Math.min(gross, insSalary);
      }
      var regionRadio = document.querySelector('input[name="region"]:checked');
      var regionKey = regionRadio && regionRadio.value ? String(regionRadio.value) : "I";

      var dependents = getDependents();
      var otherDeductions = 0;

      var insParts = calcInsurance(insuranceSalary, regionKey);
      var taxable = calcTaxableIncome(
        gross,
        insParts.total,
        dependents,
        otherDeductions
      );
      var taxDetail = calcPersonalIncomeTaxDetailed(taxable);
      var tax = taxDetail.tax;

      var pretax = Math.max(0, Math.round(gross - insParts.total));
      var depDeduct = dependents * DEPENDENT_DEDUCTION;

      setText("tncn-hero-tax", formatHeroVnd(tax));

      setText("tncn-val-gross", formatPlainVnd(gross));
      setText("tncn-val-bhxh", formatPlainVnd(insParts.bhxh));
      setText("tncn-val-bhyt", formatPlainVnd(insParts.bhyt));
      setText("tncn-val-bhtn", formatPlainVnd(insParts.bhtn));
      setText("tncn-val-pretax", formatPlainVnd(pretax));
      setText("tncn-val-deduct-self", formatPlainVnd(PERSONAL_DEDUCTION));
      setText("tncn-val-deduct-dep", formatPlainVnd(depDeduct));
      setText("tncn-val-taxable", formatPlainVnd(taxable));
      setText("tncn-val-tax", formatPlainVnd(tax));

      clearBracketGrid();
      renderBracketGrid(taxDetail);

      var pane = document.getElementById("tncn-results-pane");
      if (pane) pane.hidden = false;

      try {
        pane && pane.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (ex) {}
      });
    }
  });

  window.TNCN2026 = {
    formatCurrency: formatCurrency,
    formatPlainVnd: formatPlainVnd,
    formatHeroVnd: formatHeroVnd,
    parseMoneyInput: parseMoneyInput,
    formatMoneyInput: formatMoneyInput,
    calcInsurance: calcInsurance,
    calcEmployerInsurance: calcEmployerInsurance,
    calcTaxableIncome: calcTaxableIncome,
    calcPersonalIncomeTax: calcPersonalIncomeTax,
    calcPersonalIncomeTaxDetailed: calcPersonalIncomeTaxDetailed,
    calcNetSalary: calcNetSalary,
    PERSONAL_DEDUCTION: PERSONAL_DEDUCTION,
    DEPENDENT_DEDUCTION: DEPENDENT_DEDUCTION,
    INSURANCE_SALARY_CEILING: INSURANCE_SALARY_CEILING,
    REGION_MIN_WAGE_MONTHLY: REGION_MIN_WAGE_MONTHLY,
    REFERENCE_WAGE_INSURANCE: REFERENCE_WAGE_INSURANCE,
    bhtnSalaryCeilingForRegion: bhtnSalaryCeilingForRegion,
    bhtnTctnBenefitMonths: bhtnTctnBenefitMonths,
    bhtnTctnMonthlyBenefit: bhtnTctnMonthlyBenefit,
    gnHideAmountFieldError: hideGnAmountFieldError,
    gnShowAmountFieldError: showGnAmountFieldError,
    gnHideInsuranceOtherError: hideGnInsuranceOtherError,
    gnShowInsuranceOtherError: showGnInsuranceOtherError,
    gnHideFormError: hideGnFormError,
    gnShowFormError: showGnFormError,
    wireMoneyCombobox: wireMoneyCombobox,
    wireMoneyInputClear: wireMoneyInputClear,
    bindTncnBracketHScrollIndicator: bindTncnBracketHScrollIndicator,
  };
})();
