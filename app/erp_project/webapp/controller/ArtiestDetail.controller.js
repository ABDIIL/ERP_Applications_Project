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
    // EDM.Date expects YYYY-MM-DD
    var oNow = new Date();
    var y = oNow.getFullYear();
    var m = String(oNow.getMonth() + 1).padStart(2, "0");
    var d = String(oNow.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
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

      // Bind de pagina aan de gekozen artiest
      this.getView().bindElement({
        path: "/Artiesten(" + iId + ")"
      });

      this._bindOptredens(iId);
      this._bindReviews(iId);
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
        return;
      }

      this.getOwnerComponent().getRouter().navTo("RouteArtiestManagement", {}, true);
    },

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

      // Stats opnieuw berekenen wanneer data binnenkomt
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
          fAvg = Math.round((iSum / iCount) * 10) / 10; // 1 decimaal
        }

        this.getView().getModel("vm").setProperty("/reviewCount", iCount);
        this.getView().getModel("vm").setProperty("/avgRating", fAvg);
      } catch (e) {
        // stil falen
      }
    },

    onOpenReviewDialog: async function () {
      if (!this._oReviewDialog) {
        this._oReviewDialog = await Fragment.load({
          name: "my.project.erpproject.view.fragments.ReviewDialog",
          controller: this
        });
        this.getView().addDependent(this._oReviewDialog);
      }

      // reset velden
      this.byId("inpReviewKlantNaam").setValue("");
      this.byId("riReviewRating").setValue(0);
      this.byId("taReviewCommentaar").setValue("");

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
        MessageToast.show("Vul een klantnaam in");
        return;
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
        oBinding.create({
          rating: iRating,
          commentaar: sCommentaar,
          datum: _formatEdmDate(),
          klantNaam: sKlantNaam,
          artiest_ID: iArtiestId
        });

        this._oReviewDialog.close();
        MessageToast.show("Review toegevoegd");
      } catch (e) {
        MessageToast.show("Opslaan mislukt");
      }
    }
  });
});
