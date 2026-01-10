sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, Sorter, MessageToast) {
  "use strict";

  return Controller.extend("my.project.erpproject.controller.OrderManagement", {
    onInit: function () {
      var oLayoutModel = new JSONModel({
        layout: "OneColumn"
      });
      this.getView().setModel(oLayoutModel, "layoutModel");

      this.byId("sortOrder").setSelectedKey("date_desc");
      this._applyOrderFiltersAndSort();
    },

    onOrderPress: function (oEvent) {
      var oItem = oEvent.getSource();
      var oCtx = oItem.getBindingContext();
      if (!oCtx) {
        return;
      }

      this.byId("ordersDetailPage").bindElement({
        path: oCtx.getPath()
      });

      this.getView().getModel("layoutModel").setProperty("/layout", "TwoColumnsMidExpanded");
    },

    onCloseDetail: function () {
      this.getView().getModel("layoutModel").setProperty("/layout", "OneColumn");
      this.byId("ordersDetailPage").unbindElement();
    },

    onOrderSearch: function () {
      this._applyOrderFiltersAndSort();
    },

    onOrderFilterChange: function () {
      this._applyOrderFiltersAndSort();
    },

    onOrderSortChange: function () {
      this._applyOrderFiltersAndSort();
    },

    onNewOrder: function () {
      MessageToast.show("Nieuwe order: wizard komt hier (volgende stap).");
    },

    _applyOrderFiltersAndSort: function () {
      var oTable = this.byId("tabelOrders");
      var oBinding = oTable.getBinding("items");
      if (!oBinding) {
        return;
      }

      var sZoek = (this.byId("zoekOrderKlant").getValue() || "").trim();
      var sStatus = this.byId("filterOrderStatus").getSelectedKey();
      var sType = this.byId("filterOrderType").getSelectedKey();
      var sSort = this.byId("sortOrder").getSelectedKey();

      var aFilters = [];

      if (sZoek) {
        aFilters.push(new Filter("klant/klantNaam", FilterOperator.Contains, sZoek));
      }
      if (sStatus) {
        aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
      }
      if (sType) {
        aFilters.push(new Filter("orderType", FilterOperator.EQ, sType));
      }

      oBinding.filter(aFilters);

      var bDesc = (sSort !== "date_asc");
      oBinding.sort([new Sorter("orderDatum", bDesc)]);
    }
  });
});
