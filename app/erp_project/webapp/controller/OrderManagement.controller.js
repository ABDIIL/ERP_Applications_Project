// app/erp_project/webapp/controller/OrderManagement.controller.js
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/model/Sorter",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, Sorter, MessageToast, MessageBox) {
  "use strict";

  function _escapeHtml(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function _fmtMoney(n) {
    var x = Number(n);
    if (isNaN(x)) {
      return "";
    }
    return x.toFixed(2);
  }

  return Controller.extend("my.project.erpproject.controller.OrderManagement", {
    onInit: function () {
      var oLayoutModel = new JSONModel({ layout: "OneColumn" });
      this.getView().setModel(oLayoutModel, "layoutModel");

      if (this.byId("sortOrder")) {
        this.byId("sortOrder").setSelectedKey("date_desc");
      }
      this._applyOrderFiltersAndSort();
    },

    onOrderPress: function (oEvent) {
      var oItem = oEvent.getSource();
      var oCtx = oItem.getBindingContext();
      if (!oCtx) {
        return;
      }

      this.byId("ordersDetailPage").bindElement({ path: oCtx.getPath() });
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
      this.getOwnerComponent().getRouter().navTo("RouteNewOrder");
    },

    onPrintOrder: function () {
      var oCtx = this.byId("ordersDetailPage").getBindingContext();
      if (!oCtx) {
        MessageToast.show("Selecteer eerst een order.");
        return;
      }

      var oOrder = {
        ID: oCtx.getProperty("ID"),
        orderDatum: oCtx.getProperty("orderDatum"),
        klantNaam: oCtx.getProperty("klant/klantNaam"),
        orderType: oCtx.getProperty("orderType"),
        status: oCtx.getProperty("status"),
        totaleBedrag: oCtx.getProperty("totaleBedrag")
      };

      var oItemsBinding = this.byId("tabelOrderItems").getBinding("items");
      if (!oItemsBinding) {
        MessageBox.error("Orderitems konden niet geladen worden.");
        return;
      }

      var that = this;

      var fnHandleItems = function (aItemCtxs) {
        var aItems = (aItemCtxs || []).map(function (c) {
          return {
            product: c.getProperty("product/naam"),
            aantal: c.getProperty("aantal"),
            prijs: c.getProperty("eenheidsPrijs"),
            subtotaal: c.getProperty("subtotaal")
          };
        });

        if (!aItems.length) {
          MessageBox.information("Dit order heeft geen items om af te drukken.");
          return;
        }

        that._openPrintWindow(oOrder, aItems);
      };

      if (typeof oItemsBinding.requestContexts === "function") {
        oItemsBinding.requestContexts(0, 9999)
          .then(fnHandleItems)
          .catch(function (e) {
            MessageBox.error("Orderitems konden niet geladen worden: " + (e && e.message ? e.message : e));
          });
      } else {
        fnHandleItems(oItemsBinding.getContexts ? oItemsBinding.getContexts(0, 9999) : []);
      }
    },

    _openPrintWindow: function (oOrder, aItems) {
      var sRows = aItems.map(function (it) {
        return (
          "<tr>" +
            "<td>" + _escapeHtml(it.product) + "</td>" +
            "<td style='text-align:right;'>" + _escapeHtml(it.aantal) + "</td>" +
            "<td style='text-align:right;'>" + _escapeHtml(_fmtMoney(it.prijs)) + "</td>" +
            "<td style='text-align:right;'>" + _escapeHtml(_fmtMoney(it.subtotaal)) + "</td>" +
          "</tr>"
        );
      }).join("");

      var sHtml =
        "<!doctype html><html><head><meta charset='utf-8'>" +
        "<title>Order_" + _escapeHtml(oOrder.ID) + "</title>" +
        "<style>" +
          "body{font-family:Arial,Helvetica,sans-serif;margin:24px;}" +
          "h1{font-size:18px;margin:0 0 12px 0;}" +
          ".meta{margin:0 0 12px 0;font-size:12px;}" +
          "table{width:100%;border-collapse:collapse;font-size:12px;}" +
          "th,td{border-bottom:1px solid #ddd;padding:6px 4px;}" +
          "th{text-align:left;}" +
          ".total{margin-top:12px;text-align:right;font-size:14px;font-weight:700;}" +
        "</style></head><body>" +
        "<h1>Orderbevestiging / Kassabon</h1>" +
        "<div class='meta'>" +
          "<div><b>Order:</b> " + _escapeHtml(oOrder.ID) + "</div>" +
          "<div><b>Datum:</b> " + _escapeHtml(oOrder.orderDatum) + "</div>" +
          "<div><b>Klant:</b> " + _escapeHtml(oOrder.klantNaam) + "</div>" +
          "<div><b>Type:</b> " + _escapeHtml(oOrder.orderType) + "</div>" +
          "<div><b>Status:</b> " + _escapeHtml(oOrder.status) + "</div>" +
        "</div>" +
        "<table>" +
          "<thead><tr><th>Product</th><th style='text-align:right;'>Aantal</th><th style='text-align:right;'>Prijs</th><th style='text-align:right;'>Subtotaal</th></tr></thead>" +
          "<tbody>" + sRows + "</tbody>" +
        "</table>" +
        "<div class='total'>Totaal: " + _escapeHtml(_fmtMoney(oOrder.totaleBedrag)) + " EUR</div>" +
        "<script>window.onload=function(){window.print();};<\/script>" +
        "</body></html>";

      var w = window.open("", "_blank");
      if (!w) {
        MessageBox.error("Popup geblokkeerd. Sta popups toe voor afdrukken.");
        return;
      }
      w.document.open();
      w.document.write(sHtml);
      w.document.close();
    },

    _applyOrderFiltersAndSort: function () {
      var oTable = this.byId("tabelOrders");
      var oBinding = oTable && oTable.getBinding("items");
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
