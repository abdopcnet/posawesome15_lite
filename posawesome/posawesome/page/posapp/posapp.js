/*
 * onScan.js - scan-events for hardware barcodes scanners in javascript
 */
(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory())
    : typeof define === "function" && define.amd
    ? define(factory())
    : (global.onScan = factory());
})(this, function () {
  var onScan = {
    attachTo: function (oDomElement, oOptions) {
      if (oDomElement.scannerDetectionData !== undefined) {
        throw new Error(
          "onScan.js is already initialized for DOM element " + oDomElement
        );
      }

      var oDefaults = {
        onScan: function (sScanned, iQty) {},
        onScanError: function (oDebug) {},
        onKeyProcess: function (sChar, oEvent) {},
        onKeyDetect: function (iKeyCode, oEvent) {},
        onPaste: function (sPasted, oEvent) {},
        keyCodeMapper: function (oEvent) {
          return onScan.decodeKeyEvent(oEvent);
        },
        onScanButtonLongPress: function () {},
        scanButtonKeyCode: false,
        scanButtonLongPressTime: 500,
        timeBeforeScanTest: 100,
        avgTimeByChar: 30,
        minLength: 6,
        suffixKeyCodes: [9, 13],
        prefixKeyCodes: [],
        ignoreIfFocusOn: false,
        stopPropagation: false,
        preventDefault: false,
        captureEvents: false,
        reactToKeydown: true,
        reactToPaste: false,
        singleScanQty: 1,
      };

      oOptions = this._mergeOptions(oDefaults, oOptions);

      oDomElement.scannerDetectionData = {
        options: oOptions,
        vars: {
          firstCharTime: 0,
          lastCharTime: 0,
          accumulatedString: "",
          testTimer: false,
          longPressTimeStart: 0,
          longPressed: false,
        },
      };

      if (oOptions.reactToPaste === true) {
        oDomElement.addEventListener(
          "paste",
          this._handlePaste,
          oOptions.captureEvents
        );
      }
      if (oOptions.scanButtonKeyCode !== false) {
        oDomElement.addEventListener(
          "keyup",
          this._handleKeyUp,
          oOptions.captureEvents
        );
      }
      if (
        oOptions.reactToKeydown === true ||
        oOptions.scanButtonKeyCode !== false
      ) {
        oDomElement.addEventListener(
          "keydown",
          this._handleKeyDown,
          oOptions.captureEvents
        );
      }
      return this;
    },

    detachFrom: function (oDomElement) {
      if (oDomElement.scannerDetectionData.options.reactToPaste) {
        oDomElement.removeEventListener("paste", this._handlePaste);
      }
      if (
        oDomElement.scannerDetectionData.options.scanButtonKeyCode !== false
      ) {
        oDomElement.removeEventListener("keyup", this._handleKeyUp);
      }
      oDomElement.removeEventListener("keydown", this._handleKeyDown);
      oDomElement.scannerDetectionData = undefined;
      return;
    },

    getOptions: function (oDomElement) {
      return oDomElement.scannerDetectionData.options;
    },

    setOptions: function (oDomElement, oOptions) {
      switch (oDomElement.scannerDetectionData.options.reactToPaste) {
        case true:
          if (oOptions.reactToPaste === false) {
            oDomElement.removeEventListener("paste", this._handlePaste);
          }
          break;
        case false:
          if (oOptions.reactToPaste === true) {
            oDomElement.addEventListener("paste", this._handlePaste);
          }
          break;
      }

      switch (oDomElement.scannerDetectionData.options.scanButtonKeyCode) {
        case false:
          if (oOptions.scanButtonKeyCode !== false) {
            oDomElement.addEventListener("keyup", this._handleKeyUp);
          }
          break;
        default:
          if (oOptions.scanButtonKeyCode === false) {
            oDomElement.removeEventListener("keyup", this._handleKeyUp);
          }
          break;
      }

      oDomElement.scannerDetectionData.options = this._mergeOptions(
        oDomElement.scannerDetectionData.options,
        oOptions
      );

      this._reinitialize(oDomElement);
      return this;
    },

    decodeKeyEvent: function (oEvent) {
      var iCode = this._getNormalizedKeyNum(oEvent);
      switch (true) {
        case iCode >= 48 && iCode <= 90:
        case iCode >= 106 && iCode <= 111:
          if (oEvent.key !== undefined && oEvent.key !== "") {
            return oEvent.key;
          }

          var sDecoded = String.fromCharCode(iCode);
          switch (oEvent.shiftKey) {
            case false:
              sDecoded = sDecoded.toLowerCase();
              break;
            case true:
              sDecoded = sDecoded.toUpperCase();
              break;
          }
          return sDecoded;
        case iCode >= 96 && iCode <= 105:
          return 0 + (iCode - 96);
      }
      return "";
    },

    simulate: function (oDomElement, mStringOrArray) {
      this._reinitialize(oDomElement);
      if (Array.isArray(mStringOrArray)) {
        mStringOrArray.forEach(function (mKey) {
          var oEventProps = {};
          if (
            (typeof mKey === "object" || typeof mKey === "function") &&
            mKey !== null
          ) {
            oEventProps = mKey;
          } else {
            oEventProps.keyCode = parseInt(mKey);
          }
          var oEvent = new KeyboardEvent("keydown", oEventProps);
          document.dispatchEvent(oEvent);
        });
      } else {
        this._validateScanCode(oDomElement, mStringOrArray);
      }
      return this;
    },

    _reinitialize: function (oDomElement) {
      var oVars = oDomElement.scannerDetectionData.vars;
      oVars.firstCharTime = 0;
      oVars.lastCharTime = 0;
      oVars.accumulatedString = "";
      return;
    },

    _isFocusOnIgnoredElement: function (oDomElement) {
      var ignoreSelectors =
        oDomElement.scannerDetectionData.options.ignoreIfFocusOn;

      if (!ignoreSelectors) {
        return false;
      }

      var oFocused = document.activeElement;

      if (Array.isArray(ignoreSelectors)) {
        for (var i = 0; i < ignoreSelectors.length; i++) {
          if (oFocused.matches(ignoreSelectors[i]) === true) {
            return true;
          }
        }
      } else if (oFocused.matches(ignoreSelectors)) {
        return true;
      }

      return false;
    },

    _validateScanCode: function (oDomElement, sScanCode) {
      var oScannerData = oDomElement.scannerDetectionData;
      var oOptions = oScannerData.options;
      var iSingleScanQty = oScannerData.options.singleScanQty;
      var iFirstCharTime = oScannerData.vars.firstCharTime;
      var iLastCharTime = oScannerData.vars.lastCharTime;
      var oScanError = {};
      var oEvent;

      switch (true) {
        case sScanCode.length < oOptions.minLength:
          oScanError = {
            message: "Receieved code is shorter then minimal length",
          };
          break;

        case iLastCharTime - iFirstCharTime >
          sScanCode.length * oOptions.avgTimeByChar:
          oScanError = {
            message: "Receieved code was not entered in time",
          };
          break;

        default:
          oOptions.onScan.call(oDomElement, sScanCode, iSingleScanQty);
          oEvent = new CustomEvent("scan", {
            detail: {
              scanCode: sScanCode,
              qty: iSingleScanQty,
            },
          });
          oDomElement.dispatchEvent(oEvent);
          onScan._reinitialize(oDomElement);
          return true;
      }

      oScanError.scanCode = sScanCode;
      oScanError.scanDuration = iLastCharTime - iFirstCharTime;
      oScanError.avgTimeByChar = oOptions.avgTimeByChar;
      oScanError.minLength = oOptions.minLength;

      oOptions.onScanError.call(oDomElement, oScanError);

      oEvent = new CustomEvent("scanError", { detail: oScanError });
      oDomElement.dispatchEvent(oEvent);

      onScan._reinitialize(oDomElement);
      return false;
    },

    _mergeOptions: function (oDefaults, oOptions) {
      var oExtended = {};
      var prop;
      for (prop in oDefaults) {
        if (Object.prototype.hasOwnProperty.call(oDefaults, prop)) {
          oExtended[prop] = oDefaults[prop];
        }
      }
      for (prop in oOptions) {
        if (Object.prototype.hasOwnProperty.call(oOptions, prop)) {
          oExtended[prop] = oOptions[prop];
        }
      }
      return oExtended;
    },

    _getNormalizedKeyNum: function (e) {
      return e.which || e.keyCode;
    },

    _handleKeyDown: function (e) {
      var iKeyCode = onScan._getNormalizedKeyNum(e);
      var oOptions = this.scannerDetectionData.options;
      var oVars = this.scannerDetectionData.vars;
      var bScanFinished = false;

      if (oOptions.onKeyDetect.call(this, iKeyCode, e) === false) {
        return;
      }

      if (onScan._isFocusOnIgnoredElement(this)) {
        return;
      }

      if (
        oOptions.scanButtonKeyCode !== false &&
        iKeyCode == oOptions.scanButtonKeyCode
      ) {
        if (!oVars.longPressed) {
          oVars.longPressTimer = setTimeout(
            oOptions.onScanButtonLongPress,
            oOptions.scanButtonLongPressTime,
            this
          );
          oVars.longPressed = true;
        }

        return;
      }

      switch (true) {
        case oVars.firstCharTime &&
          oOptions.suffixKeyCodes.indexOf(iKeyCode) !== -1:
          e.preventDefault();
          e.stopImmediatePropagation();
          bScanFinished = true;
          break;

        case !oVars.firstCharTime &&
          oOptions.prefixKeyCodes.indexOf(iKeyCode) !== -1:
          e.preventDefault();
          e.stopImmediatePropagation();
          bScanFinished = false;
          break;

        default:
          var character = oOptions.keyCodeMapper.call(this, e);
          if (character === null) {
            return;
          }
          oVars.accumulatedString += character;

          if (oOptions.preventDefault) {
            e.preventDefault();
          }
          if (oOptions.stopPropagation) {
            e.stopImmediatePropagation();
          }

          bScanFinished = false;
          break;
      }

      if (!oVars.firstCharTime) {
        oVars.firstCharTime = Date.now();
      }

      oVars.lastCharTime = Date.now();

      if (oVars.testTimer) {
        clearTimeout(oVars.testTimer);
      }

      if (bScanFinished) {
        onScan._validateScanCode(this, oVars.accumulatedString);
        oVars.testTimer = false;
      } else {
        oVars.testTimer = setTimeout(
          onScan._validateScanCode,
          oOptions.timeBeforeScanTest,
          this,
          oVars.accumulatedString
        );
      }

      oOptions.onKeyProcess.call(this, character, e);
      return;
    },

    _handlePaste: function (e) {
      var oOptions = this.scannerDetectionData.options;
      var oVars = this.scannerDetectionData.vars;
      var sPasteString = (event.clipboardData || window.clipboardData).getData(
        "text"
      );

      if (onScan._isFocusOnIgnoredElement(this)) {
        return;
      }

      e.preventDefault();

      if (oOptions.stopPropagation) {
        e.stopImmediatePropagation();
      }

      oOptions.onPaste.call(this, sPasteString, event);

      oVars.firstCharTime = 0;
      oVars.lastCharTime = 0;

      onScan._validateScanCode(this, sPasteString);
      return;
    },

    _handleKeyUp: function (e) {
      if (onScan._isFocusOnIgnoredElement(this)) {
        return;
      }

      var iKeyCode = onScan._getNormalizedKeyNum(e);

      if (iKeyCode == this.scannerDetectionData.options.scanButtonKeyCode) {
        clearTimeout(this.scannerDetectionData.vars.longPressTimer);
        this.scannerDetectionData.vars.longPressed = false;
      }
      return;
    },

    isScanInProgressFor: function (oDomElement) {
      return oDomElement.scannerDetectionData.vars.firstCharTime > 0;
    },

    isAttachedTo: function (oDomElement) {
      return oDomElement.scannerDetectionData !== undefined;
    },
  };

  return onScan;
});

// =============================================================================
// PAGE SETUP
// =============================================================================

frappe.pages["posapp"].on_page_load = function (wrapper) {
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: "Andalus Group",
    single_column: true,
  });

  this.page.$PosApp = new frappe.PosApp.posapp(this.page);

  $("div.navbar-fixed-top").find(".container").css("padding", "0");

  $("head").append(
    "<link rel='stylesheet' href='/assets/posawesome/css/materialdesignicons.css' class='posapp-mdi-css'>"
  );
  $("head").append(
    "<style>.layout-main-section { display: none !important; }</style>"
  );
};

frappe.pages["posapp"].on_page_leave = function () {
  $("head").find("link.posapp-mdi-css").remove();
};
