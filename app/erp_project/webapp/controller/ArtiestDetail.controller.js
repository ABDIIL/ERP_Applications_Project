sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment",
  "sap/m/ColumnListItem",
  "sap/m/Text",
  "sap/m/ObjectNumber",
  "sap/m/ObjectListItem",
  "sap/m/ObjectAttribute",
  "sap/m/MessageToast"
], function (Controller, History, JSONModel, Fragment, ColumnListItem, Text, ObjectNumber, ObjectListItem, ObjectAttribute, MessageToast) {
  "use strict";

  function _formatEdmDate() {
    var oNow = new Date();
    var y = oNow.getFullYear();
    var m = String(oNow.getMonth() + 1).padStart(2, "0");
    var d = String(oNow.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function _splitGenres(sGenre) {
    if (!sGenre) {
      return [];
    }
    return String(sGenre)
      .split(",")
      .map(function (g) { return g.trim(); })
      .filter(Boolean)
      .slice(0, 3);
  }

  function _stateForGenre(s) {
    var g = String(s || "").toUpperCase();
    switch (g) {
      case "TECHNO": return "Information";
      case "HOUSE": return "Success";
      case "POP": return "Success";
      case "INDIE": return "Warning";
      case "HARDSTYLE": return "Error";
      case "ANDERS": return "None";
      default: return "None";
    }
  }

  return Controller.extend("my.project.erpproject.controller.ArtiestDetail", {
    onInit: function () {
      this.getView().setModel(new JSONModel({ avgRating: 0, reviewCount: 0 }), "vm");

      this._sArtiestId = null;
      this._oReviewDialog = null;

      this.getOwnerComponent().getRouter().getRoute("RouteArtiestDetail")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var sId = oEvent.getParameter("arguments").ID;
      var iId = parseInt(sId, 10);
      if (Number.isNaN(iId)) {
        return;
      }
      this._sArtiestId = iId;

      this.getView().bindElement({ path: "/Artiesten(" + iId + ")" });

      this._bindOptredens(iId);
      this._bindReviews(iId);
    },

    // ===== Profile helpers =====
    formatInitials: function (sName) {
      if (!sName) {
        return "";
      }
      var a = String(sName).trim().split(/\s+/).filter(Boolean);
      if (a.length === 0) {
        return "";
      }
      var s1 = a[0].charAt(0).toUpperCase();
      var s2 = a.length > 1 ? a[1].charAt(0).toUpperCase() : "";
      return (s1 + s2).slice(0, 2);
    },

    formatSpotifyUrl: function (sName) {
      return "https://open.spotify.com/search/" + encodeURIComponent((sName || "").trim());
    },

    formatInstagramUrl: function (sName) {
      return "https://www.instagram.com/" + encodeURIComponent((sName || "").trim()) + "/";
    },

    formatArtistLabel: function (vPopulariteit) {
      var f = parseFloat(vPopulariteit);
      if (!Number.isFinite(f)) {
        return "Rising Star";
      }
      return f >= 8.5 ? "Headliner" : "Rising Star";
    },

    formatArtistLabelState: function (vPopulariteit) {
      var f = parseFloat(vPopulariteit);
      return (Number.isFinite(f) && f >= 8.5) ? "Success" : "Information";
    },

    // ===== Genre tags (max 3) =====
    formatGenre1: function (sGenre) { return _splitGenres(sGenre)[0] || ""; },
    formatGenre2: function (sGenre) { return _splitGenres(sGenre)[1] || ""; },
    formatGenre3: function (sGenre) { return _splitGenres(sGenre)[2] || ""; },

    formatGenreVisible1: function (sGenre) { return !!(_splitGenres(sGenre)[0]); },
    formatGenreVisible2: function (sGenre) { return !!(_splitGenres(sGenre)[1]); },
    formatGenreVisible3: function (sGenre) { return !!(_splitGenres(sGenre)[2]); },

    formatGenreState1: function (sGenre) { return _stateForGenre(_splitGenres(sGenre)[0]); },
    formatGenreState2: function (sGenre) { return _stateForGenre(_splitGenres(sGenre)[1]); },
    formatGenreState3: function (sGenre) { return _stateForGenre(_splitGenres(sGenre)[2]); },

    // ===== Navigation =====
    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
        return;
      }

      this.getOwnerComponent().getRouter().navTo("RouteArtiestManagement", {}, true);
    },

    // ===== Existing logic =====
    _bindOptredens: function (iArtiestId) {
      var oTable = this.byId("optredensTable");

      oTable.bindItems({
        path: "/Optredens",
        parameters: {
          $filter: "artiest_ID eq " + iArtiestId,
          $expand: "stage,festivalDag",
          $orderby: "festivalDag/datum,startTijd"
        },
        template: new ColumnListItem({
          cells: [
            new Text({ text: "{festivalDag/datum}" }),
            new Text({ text: "{stage/stageNaam}" }),
            new Text({ text: "{startTijd}" }),
            new Text({ text: "{eindTijd}" })
          ]
        })
      });
    },

    _bindReviews: function (iArtiestId) {
      var oList = this.byId("reviewsList");

      oList.bindItems({
        path: "/Reviews",
        parameters: {
          $filter: "artiest_ID eq " + iArtiestId,
          $orderby: "datum desc"
        },
        template: new ObjectListItem({
          title: "{klantNaam}",
          number: "{rating}",
          numberUnit: "/ 5",
          attributes: [
            new ObjectAttribute({ text: "{commentaar}" }),
            new ObjectAttribute({ text: "{datum}" })
          ]
        })
      });

      var oBinding = oList.getBinding("items");
      if (oBinding) {
        oBinding.attachChange(this._recalcReviewStats, this);
      }
    },

    _recalcReviewStats: async function () {
      var oList = this.byId("reviewsList");
      var oBinding = oList.getBinding("items");
      if (!oBinding) {
        return;
      }

      try {
        var aCtx = await oBinding.requestContexts(0, 999);
        var aRatings = aCtx
          .map(function (c) { return c.getObject().rating; })
          .filter(function (r) { return typeof r === "number"; });

        var iCount = aRatings.length;
        var fAvg = 0;
        if (iCount > 0) {
          var iSum = aRatings.reduce(function (acc, r) { return acc + r; }, 0);
          fAvg = Math.round((iSum / iCount) * 10) / 10;
        }

        this.getView().getModel("vm").setProperty("/reviewCount", iCount);
        this.getView().getModel("vm").setProperty("/avgRating", fAvg);
      } catch (e) {
        // ignore
      }
    },

    onOpenReviewDialog: async function () {
      if (!this._oReviewDialog) {
        this._oReviewDialog = await Fragment.load({
          id: this.getView().getId(),
          name: "my.project.erpproject.view.fragments.ReviewDialog",
          controller: this
        });
        this.getView().addDependent(this._oReviewDialog);
      }

      var oInpNaam = this.byId("inpReviewKlantNaam");
      var oRating = this.byId("riReviewRating");
      var oComment = this.byId("taReviewCommentaar");

      if (oInpNaam) { oInpNaam.setValue(""); }
      if (oRating) { oRating.setValue(0); }
      if (oComment) { oComment.setValue(""); }

      this._oReviewDialog.open();
    },

    onCancelReviewDialog: function () {
      if (this._oReviewDialog) {
        this._oReviewDialog.close();
      }
    },

    onSaveReviewDialog: function () {
      var iArtiestId = this._sArtiestId;
      if (iArtiestId === null || iArtiestId === undefined) {
        return;
      }

      var sKlantNaam = (this.byId("inpReviewKlantNaam").getValue() || "").trim();
      var iRating = parseInt(this.byId("riReviewRating").getValue(), 10);
      var sCommentaar = (this.byId("taReviewCommentaar").getValue() || "").trim();

      if (!sKlantNaam) {
        sKlantNaam = "Anoniem";
      }
      if (!iRating || iRating < 1 || iRating > 5) {
        MessageToast.show("Kies een rating van 1 tot 5");
        return;
      }

      var oList = this.byId("reviewsList");
      var oBinding = oList.getBinding("items");
      if (!oBinding || !oBinding.create) {
        MessageToast.show("Kan review niet opslaan");
        return;
      }

      try {
        var oCreatedCtx = oBinding.create({
          rating: iRating,
          commentaar: sCommentaar,
          datum: _formatEdmDate(),
          klantNaam: sKlantNaam,
          artiest_ID: iArtiestId
        });

        Promise.resolve(oCreatedCtx && oCreatedCtx.created ? oCreatedCtx.created() : null)
          .then(function () {
            this._oReviewDialog.close();
            if (oBinding.refresh) {
              oBinding.refresh();
            }
            this._recalcReviewStats();
            MessageToast.show("Review toegevoegd");
          }.bind(this))
          .catch(function () {
            MessageToast.show("Opslaan mislukt");
          });
      } catch (e) {
        MessageToast.show("Opslaan mislukt");
      }
    }
  });
});
