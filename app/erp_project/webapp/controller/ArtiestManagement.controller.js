sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter"
], function (Controller, Filter, FilterOperator, Sorter) {
  "use strict";

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

  return Controller.extend("my.project.erpproject.controller.ArtiestManagement", {
    onInit: function () {
      this.byId("sorteerKeuze").setSelectedKey("artiestNaam");
      // Niet vroeg filteren; user acties triggeren dit sowieso.
      // Maar voor zekerheid na eerste render ook:
      this.getView().addEventDelegate({
        onAfterRendering: function () {
          this._pasFiltersEnSorteringToe();
        }.bind(this)
      });
    },

    // ===== Formatters voor tags (max 3) =====
    formatGenre1: function (sGenre) { return _splitGenres(sGenre)[0] || ""; },
    formatGenre2: function (sGenre) { return _splitGenres(sGenre)[1] || ""; },
    formatGenre3: function (sGenre) { return _splitGenres(sGenre)[2] || ""; },

    formatGenreVisible1: function (sGenre) { return !!(_splitGenres(sGenre)[0]); },
    formatGenreVisible2: function (sGenre) { return !!(_splitGenres(sGenre)[1]); },
    formatGenreVisible3: function (sGenre) { return !!(_splitGenres(sGenre)[2]); },

    formatGenreState1: function (sGenre) { return _stateForGenre(_splitGenres(sGenre)[0]); },
    formatGenreState2: function (sGenre) { return _stateForGenre(_splitGenres(sGenre)[1]); },
    formatGenreState3: function (sGenre) { return _stateForGenre(_splitGenres(sGenre)[2]); },

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

      this.getOwnerComponent().getRouter().navTo("RouteArtiestDetail", { ID: iID });
    },

    onNewArtiest: function () {
      this.getOwnerComponent().getRouter().navTo("RouteArtiestCreate");
    },

    naarOrders: function () {
      this.getOwnerComponent().getRouter().navTo("RouteOrders");
    },

    naarLineUp: function () {
      this.getOwnerComponent().getRouter().navTo("RouteLineUp");
    },

    naarLeaderboard: function () {
      this.getOwnerComponent().getRouter().navTo("RouteLeaderboard");
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

      // ✅ multi-genre: "TECHNO, HOUSE" => Contains werkt
      if (sGenre) {
        aFilters.push(new Filter("genre", FilterOperator.Contains, sGenre));
      }

      if (sLand) {
        aFilters.push(new Filter("land", FilterOperator.Contains, sLand));
      }

      // ✅ BELANGRIJK (OData V4): zet als Application-filters
      oBinding.filter(aFilters, "Application");

      var oSorter;
      if (sSorteer === "populariteit") {
        oSorter = new Sorter("populariteit", true);
      } else {
        oSorter = new Sorter("artiestNaam", false);
      }

      // ✅ sorteren
      oBinding.sort(oSorter);
    }
  });
});
