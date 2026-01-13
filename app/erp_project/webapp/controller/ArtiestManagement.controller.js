sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/ui/core/Fragment"
], function (Controller, Filter, FilterOperator, Sorter, Fragment) {
  "use strict";

  function _splitGenres(sGenre) {
    if (!sGenre) { return []; }
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

      // bij terugkeer naar deze view: herladen zodat nieuwe records zichtbaar zijn
      this.getOwnerComponent().getRouter().getRoute("RouteArtiestManagement")
        .attachPatternMatched(this._onRouteMatched, this);

      this.getView().addEventDelegate({
        onAfterRendering: function () {
          this._pasFiltersEnSorteringToe();
        }.bind(this)
      });

      // menu instance (zelfde patroon als andere pagina's)
      this._oNavMenu = null;
    },

    _onRouteMatched: function () {
      var oTabel = this.byId("tabelArtiesten");
      var oBinding = oTabel && oTabel.getBinding("items");

      this._pasFiltersEnSorteringToe();

      // OData V4: expliciet refreshen om nieuwe entries op te halen
      if (oBinding && typeof oBinding.refresh === "function") {
        oBinding.refresh();
      }
    },

    onExit: function () {
      if (this._oNavMenu && !this._oNavMenu.bIsDestroyed) {
        this._oNavMenu.destroy();
      }
      this._oNavMenu = null;
    },

    // ===== Menu (Pagina's) - identiek gedrag =====
    onOpenNavMenu: function (oEvent) {
      var oButton = oEvent.getSource();
      var oView = this.getView();

      if (!this._oNavMenu) {
        Fragment.load({
          id: oView.getId(),
          name: "my.project.erpproject.view.fragments.NavMenu",
          controller: this
        }).then(function (oMenu) {
          this._oNavMenu = oMenu;
          oView.addDependent(this._oNavMenu);
          this._oNavMenu.openBy(oButton);
        }.bind(this));
        return;
      }

      if (this._oNavMenu.isOpen && this._oNavMenu.isOpen()) {
        this._oNavMenu.close();
      } else {
        this._oNavMenu.openBy(oButton);
      }
    },

    onNavMenuAction: function (oEvent) {
      var oItem = oEvent.getParameter("item");
      if (!oItem || !oItem.getKey) { return; }

      var sRoute = oItem.getKey();
      if (!sRoute || sRoute === "RouteArtiestManagement") { return; }

      this.getOwnerComponent().getRouter().navTo(sRoute);
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
      if (!oCtx) { return; }

      var iID = oCtx.getProperty("ID");
      if (iID === undefined || iID === null) { return; }

      this.getOwnerComponent().getRouter().navTo("RouteArtiestDetail", { ID: iID });
    },

    onNewArtiest: function () {
      this.getOwnerComponent().getRouter().navTo("RouteArtiestCreate");
    },

    // (mag blijven bestaan; niet meer gebruikt door knoppen)
    naarOrders: function () { this.getOwnerComponent().getRouter().navTo("RouteOrders"); },
    naarLineUp: function () { this.getOwnerComponent().getRouter().navTo("RouteLineUp"); },
    naarLeaderboard: function () { this.getOwnerComponent().getRouter().navTo("RouteLeaderboard"); },

    bijZoekVerandering: function () { this._pasFiltersEnSorteringToe(); },
    bijZoekActie: function () { this._pasFiltersEnSorteringToe(); },
    bijFilterWijziging: function () { this._pasFiltersEnSorteringToe(); },
    bijSorteerWijziging: function () { this._pasFiltersEnSorteringToe(); },

    _pasFiltersEnSorteringToe: function () {
      var oTabel = this.byId("tabelArtiesten");
      var oBinding = oTabel.getBinding("items");
      if (!oBinding) { return; }

      var sZoekterm = (this.byId("zoekVeldArtiest").getValue() || "").trim();
      var sGenre = this.byId("filterGenre").getSelectedKey();
      var sLand = (this.byId("filterLand").getValue() || "").trim();
      var sSorteer = this.byId("sorteerKeuze").getSelectedKey();

      var aFilters = [];

      if (sZoekterm) {
        aFilters.push(new Filter("artiestNaam", FilterOperator.Contains, sZoekterm));
      }
      if (sGenre) {
        aFilters.push(new Filter("genre", FilterOperator.Contains, sGenre));
      }
      if (sLand) {
        aFilters.push(new Filter("land", FilterOperator.Contains, sLand));
      }

      oBinding.filter(aFilters, "Application");

      var oSorter = (sSorteer === "populariteit")
        ? new Sorter("populariteit", true)
        : new Sorter("artiestNaam", false);

      oBinding.sort(oSorter);
    }
  });
});
