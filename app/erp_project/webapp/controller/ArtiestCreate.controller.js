sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
  "use strict";

  return Controller.extend("my.project.erpproject.controller.ArtiestCreate", {
    onInit: function () {
      var oCreateModel = new JSONModel({
        artiestNaam: "",
        genre: "TECHNO",
        land: "",
        nationaliteit: "",
        biografie: "",
        festivalDagId: "",
        stageId: "",
        startTijd: "",
        eindTijd: ""
      });
      this.getView().setModel(oCreateModel, "create");
    },

    onCancel: function () {
      this.getOwnerComponent().getRouter().navTo("RouteArtiestManagement");
    },

    onSave: async function () {
      var oView = this.getView();
      var oData = oView.getModel("create").getData();
      var oModel = oView.getModel();

      var sNaam = (oData.artiestNaam || "").trim();
      var sGenre = (oData.genre || "").trim();
      var sLand = (oData.land || "").trim();
      var sNat = (oData.nationaliteit || "").trim();
      var sBio = (oData.biografie || "").trim();
      var sFestivalDagId = (oData.festivalDagId || "").toString().trim();
      var sStageId = (oData.stageId || "").toString().trim();
      var sStart = (oData.startTijd || "").trim();
      var sEinde = (oData.eindTijd || "").trim();

      if (!sNaam || !sGenre) {
        MessageBox.warning("Vul minstens naam en genre in.");
        return;
      }
      if (!sLand && !sNat) {
        MessageBox.warning("Vul land of nationaliteit in.");
        return;
      }
      if (!sFestivalDagId || !sStageId || !sStart || !sEinde) {
        MessageBox.warning("Vul festivaldag, stage, start- en eindtijd in.");
        return;
      }

      // CAP OData Time verwacht meestal HH:mm:ss
      var sStartTime = sStart.length === 5 ? (sStart + ":00") : sStart;
      var sEndTime = sEinde.length === 5 ? (sEinde + ":00") : sEinde;

      try {
        oView.setBusy(true);

        // 1) Artiest aanmaken
        var oArtiestList = oModel.bindList("/Artiesten");
        var oArtiestCtx = oArtiestList.create({
          artiestNaam: sNaam,
          genre: sGenre,
          land: sLand,
          nationaliteit: sNat,
          populariteit: 0,
          biografie: sBio
        });

        await oArtiestCtx.created();
        var iNewArtiestId = oArtiestCtx.getProperty("ID");

        // 2) Eerste optreden aanmaken
        var oOptredenList = oModel.bindList("/Optredens");
        var oOptredenCtx = oOptredenList.create({
          artiest_ID: iNewArtiestId,
          festivalDag_ID: parseInt(sFestivalDagId, 10),
          stage_ID: parseInt(sStageId, 10),
          startTijd: sStartTime,
          eindTijd: sEndTime
        });
        await oOptredenCtx.created();

        MessageToast.show("Artiest aangemaakt");

        // navigeer naar detail
        this.getOwnerComponent().getRouter().navTo("RouteArtiestDetail", { ID: iNewArtiestId });
      } catch (e) {
        MessageBox.error("Aanmaken mislukt. Controleer je invoer en probeer opnieuw.");
        // eslint-disable-next-line no-console
        console.error(e);
      } finally {
        oView.setBusy(false);
      }
    }
  });
});
