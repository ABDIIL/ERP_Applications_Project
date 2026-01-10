sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter"
], function (Controller, Filter, FilterOperator, Sorter) {
  "use strict";

  return Controller.extend("my.project.erpproject.controller.ArtiestManagement", {
    onInit: function () {
      // standaard sortering op naam
      this.byId("sorteerKeuze").setSelectedKey("artiestNaam");
      this._pasFiltersEnSorteringToe();
    },

    onArtiestPress: function (oEvent) {
      var oItem = oEvent.getSource();
      var oCtx = oItem.getBindingContext();
      if (!oCtx) {
        return;
      }

      var iID = oCtx.getProperty("ID");
      if (iID === undefined || iID === null) {
        return;
      }

      this.getOwnerComponent().getRouter().navTo("RouteArtiestDetail", {
        ID: iID
      });
    },

    bijZoekVerandering: function () {
      this._pasFiltersEnSorteringToe();
    },

    bijZoekActie: function () {
      this._pasFiltersEnSorteringToe();
    },

    bijFilterWijziging: function () {
      this._pasFiltersEnSorteringToe();
    },

    bijSorteerWijziging: function () {
      this._pasFiltersEnSorteringToe();
    },

    _pasFiltersEnSorteringToe: function () {
      var oTabel = this.byId("tabelArtiesten");
      var oBinding = oTabel.getBinding("items");
      if (!oBinding) {
        return;
      }

      var sZoekterm = (this.byId("zoekVeldArtiest").getValue() || "").trim();
      var sGenre = this.byId("filterGenre").getSelectedKey();
      var sLand = (this.byId("filterLand").getValue() || "").trim();
      var sSorteer = this.byId("sorteerKeuze").getSelectedKey();

      var aFilters = [];

      if (sZoekterm) {
        aFilters.push(new Filter("artiestNaam", FilterOperator.Contains, sZoekterm));
      }
      if (sGenre) {
        aFilters.push(new Filter("genre", FilterOperator.EQ, sGenre));
      }
      if (sLand) {
        aFilters.push(new Filter("land", FilterOperator.Contains, sLand));
      }

      oBinding.filter(aFilters);

      var oSorter;
      if (sSorteer === "populariteit") {
        oSorter = new Sorter("populariteit", true); // true = aflopend
      } else {
        oSorter = new Sorter("artiestNaam", false);
      }

      oBinding.sort([oSorter]);
    }
  });
});
