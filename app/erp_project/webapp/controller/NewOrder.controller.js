sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast) {
  "use strict";

  function toNumber(v) {
    var n = Number(String(v === undefined || v === null ? "" : v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  return Controller.extend("my.project.erpproject.controller.NewOrder", {

    onInit: function () {
      var vm = new JSONModel({
        klant_ID: "",
        klantDisplay: "",
        newKlantNaam: "",

        orderType: "TICKETS",

        currentProductId: "",
        currentProductName: "",
        currentAantal: 1,
        currentPrijs: 0,

        items: [],
        totaleBedrag: 0
      });

      this.getView().setModel(vm, "vm");

      this._wizard = this.byId("orderWizard");
      this._nav = this.byId("wizardNavContainer");
      this._wizardContentPage = this.byId("wizardContentPage");

      this._applyProductFilter();
      this._validateAll();
    },

    // --- Step 1: klant ---
    onStepCustomerActivate: function () {
      // Cruciaal: als de eerste klant al zichtbaar geselecteerd is, maar geen change-event trigget,
      // dan zetten we die hier expliciet in het model.
      var vm = this.getView().getModel("vm");
      if (vm.getProperty("/klant_ID")) {
        this._validateAll();
        return;
      }

      var oSel = this.byId("selKlant");
      if (oSel) {
        var sKey = oSel.getSelectedKey();
        var oItem = oSel.getSelectedItem();
        if (sKey) {
          vm.setProperty("/klant_ID", sKey);
          vm.setProperty("/newKlantNaam", "");
          vm.setProperty("/klantDisplay", oItem ? oItem.getText() : "");
        }
      }
      this._validateAll();
    },

    onKlantSelectChange: function (oEvent) {
      var vm = this.getView().getModel("vm");
      var sId = oEvent.getSource().getSelectedKey();
      var oItem = oEvent.getSource().getSelectedItem();

      vm.setProperty("/klant_ID", sId);
      vm.setProperty("/newKlantNaam", "");
      vm.setProperty("/klantDisplay", oItem ? oItem.getText() : "");

      var oInp = this.byId("inpNieuweKlant");
      if (oInp) {
        oInp.setValue("");
      }

      this._validateAll();
    },

    onNewKlantNaamChange: function (oEvent) {
      var vm = this.getView().getModel("vm");
      var s = String(oEvent.getSource().getValue() || "").trim();

      vm.setProperty("/newKlantNaam", s);
      if (s) {
        vm.setProperty("/klant_ID", "");
        vm.setProperty("/klantDisplay", s);

        var oSel = this.byId("selKlant");
        if (oSel) {
          oSel.setSelectedKey("");
        }
      } else {
        vm.setProperty("/klantDisplay", "");
      }

      this._validateAll();
    },

    // --- Step 2: type ---
    onOrderTypeChange: function (oEvent) {
      var vm = this.getView().getModel("vm");
      var sType = oEvent.getSource().getSelectedKey();

      vm.setProperty("/orderType", sType);

      vm.setProperty("/currentProductId", "");
      vm.setProperty("/currentProductName", "");
      vm.setProperty("/currentAantal", 1);
      vm.setProperty("/currentPrijs", 0);
      vm.setProperty("/items", []);
      vm.setProperty("/totaleBedrag", 0);

      this._applyProductFilter();
      this._validateAll();
    },

    // --- Step 3: items ---
    onStepItemsActivate: function () {
      this._applyProductFilter();
      this._validateAll();
    },

    onProductChange: function (oEvent) {
      var vm = this.getView().getModel("vm");
      var sId = oEvent.getSource().getSelectedKey();
      var oItem = oEvent.getSource().getSelectedItem();

      vm.setProperty("/currentProductId", sId);
      vm.setProperty("/currentProductName", oItem ? oItem.getText() : "");

      var oCtx = oItem && oItem.getBindingContext();
      var nPrijs = oCtx ? toNumber(oCtx.getProperty("prijs")) : 0;
      vm.setProperty("/currentPrijs", round2(nPrijs));

      this._validateAll();
    },

    onAantalChange: function () {
      var vm = this.getView().getModel("vm");
      var n = Math.max(1, Math.floor(toNumber(vm.getProperty("/currentAantal"))));
      vm.setProperty("/currentAantal", n);
      this._validateAll();
    },

    onAddItem: function () {
      var vm = this.getView().getModel("vm");
      var sProductId = String(vm.getProperty("/currentProductId") || "");
      var sNaam = String(vm.getProperty("/currentProductName") || "").trim();
      var nAantal = Math.max(1, Math.floor(toNumber(vm.getProperty("/currentAantal"))));
      var nPrijs = Math.max(0, toNumber(vm.getProperty("/currentPrijs")));

      if (!sProductId) {
        MessageBox.error("Selecteer eerst een item.");
        return;
      }

      var aItems = (vm.getProperty("/items") || []).slice();
      var nSub = round2(nAantal * nPrijs);

      aItems.push({
        product_ID: Number(sProductId),
        naam: sNaam,
        aantal: nAantal,
        eenheidsPrijs: round2(nPrijs),
        subtotaal: nSub
      });

      vm.setProperty("/items", aItems);
      vm.setProperty("/currentAantal", 1);

      this._recalcTotal();
      this._validateAll();
      MessageToast.show("Item toegevoegd");
    },

    onRemoveItem: function (oEvent) {
      var vm = this.getView().getModel("vm");
      var oCtx = oEvent.getSource().getParent().getBindingContext("vm");
      if (!oCtx) {
        return;
      }

      var i = Number(oCtx.getPath().split("/").pop());
      var aItems = (vm.getProperty("/items") || []).slice();
      aItems.splice(i, 1);

      vm.setProperty("/items", aItems);
      this._recalcTotal();
      this._validateAll();
    },

    // --- Wizard nav ---
    wizardCompletedHandler: function () {
      this._nav.to(this.byId("wizardReviewPage"));
    },

    onCancel: function () {
      this.getOwnerComponent().getRouter().navTo("RouteOrders", {}, true);
    },

    // --- Submit ---
    onSubmit: async function () {
      var vm = this.getView().getModel("vm");
      var oModel = this.getView().getModel();

      try {
        var sExistingKlantId = String(vm.getProperty("/klant_ID") || "").trim();
        var sNewKlantNaam = String(vm.getProperty("/newKlantNaam") || "").trim();

        var sKlantId = sExistingKlantId;
        if (!sKlantId) {
          if (!sNewKlantNaam) {
            MessageBox.error("Kies een klant of vul een nieuwe klantnaam in.");
            return;
          }
          sKlantId = await this._createKlant(oModel, sNewKlantNaam);
        }

        var aItems = vm.getProperty("/items") || [];
        if (!aItems.length) {
          MessageBox.error("Voeg minstens één item toe.");
          return;
        }

        var iNextOrderId = await this._getNextId(oModel, "/Orders", "ID");

        var oPayload = {
          ID: iNextOrderId,
          orderDatum: new Date().toISOString().split("T")[0],
          orderType: vm.getProperty("/orderType"),
          status: "OPEN",
          totaleBedrag: round2(toNumber(vm.getProperty("/totaleBedrag"))),
          klant_ID: Number(sKlantId),
          items: aItems.map(function (it, idx) {
            return {
              pos: idx + 1,
              product_ID: it.product_ID,
              aantal: it.aantal,
              eenheidsPrijs: it.eenheidsPrijs,
              subtotaal: it.subtotaal
            };
          })
        };

        var oList = oModel.bindList("/Orders");
        var oCtx = oList.create(oPayload);
        await oCtx.created();

        if (typeof oModel.refresh === "function") {
          oModel.refresh();
        }

        MessageToast.show("Order aangemaakt");
        this.getOwnerComponent().getRouter().navTo("RouteOrders", {}, true);
      } catch (e) {
        try { oModel.resetChanges(); } catch (ignore) {}
        MessageBox.error("Order aanmaken mislukt.");
      }
    },

    // --- helpers ---
    async _createKlant(oModel, sKlantNaam) {
      var iNextKlantId = await this._getNextId(oModel, "/Klanten", "ID");
      var oPayload = { ID: iNextKlantId, klantNaam: sKlantNaam };

      var oList = oModel.bindList("/Klanten");
      var oCtx = oList.create(oPayload);
      await oCtx.created();

      return String(iNextKlantId);
    },

    async _getNextId(oModel, sSetPath, sKeyProp) {
      var oList = oModel.bindList(sSetPath);
      var aCtxs = await oList.requestContexts(0, 10000);

      var iMax = 0;
      (aCtxs || []).forEach(function (c) {
        var n = Number(c.getProperty(sKeyProp));
        if (Number.isFinite(n) && n > iMax) {
          iMax = n;
        }
      });

      return iMax + 1;
    },

    _recalcTotal: function () {
      var vm = this.getView().getModel("vm");
      var a = vm.getProperty("/items") || [];
      var t = round2(a.reduce(function (s, it) { return s + (toNumber(it.subtotaal) || 0); }, 0));
      vm.setProperty("/totaleBedrag", t);
    },

    _applyProductFilter: function () {
      var oSel = this.byId("selProduct");
      if (!oSel) {
        return;
      }
      var oBinding = oSel.getBinding("items");
      if (!oBinding) {
        return;
      }

      var sType = String(this.getView().getModel("vm").getProperty("/orderType") || "TICKETS");
      oBinding.filter([new Filter("categorie", FilterOperator.EQ, sType)]);

      var vm = this.getView().getModel("vm");
      vm.setProperty("/currentProductId", "");
      vm.setProperty("/currentProductName", "");
      vm.setProperty("/currentPrijs", 0);
    },

    _validateAll: function () {
      var vm = this.getView().getModel("vm");

      var bStep1 = !!String(vm.getProperty("/klant_ID") || "").trim() || !!String(vm.getProperty("/newKlantNaam") || "").trim();
      var bStep2 = !!String(vm.getProperty("/orderType") || "").trim();
      var bStep3 = (vm.getProperty("/items") || []).length > 0;

      if (this._wizard) {
        bStep1 ? this._wizard.validateStep(this.byId("stepCustomer")) : this._wizard.invalidateStep(this.byId("stepCustomer"));
        bStep2 ? this._wizard.validateStep(this.byId("stepType")) : this._wizard.invalidateStep(this.byId("stepType"));
        bStep3 ? this._wizard.validateStep(this.byId("stepItems")) : this._wizard.invalidateStep(this.byId("stepItems"));
      }
    }

  });
});
