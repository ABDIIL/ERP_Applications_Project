sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/UIComponent",
  "sap/ui/core/routing/History",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox"
], function (Controller, JSONModel, UIComponent, History, Filter, FilterOperator, MessageBox) {
  "use strict";

  return Controller.extend("my.project.erpproject.controller.LineUp", {
    onInit: function () {
      var oView = this.getView();

      this._oFixedStart = new Date(2026, 0, 1, 11, 0, 0);

      var oFiltersModel = new JSONModel({
        stages: [{ ID: "", stageNaam: "Alle stages" }],
        artiesten: [{ ID: "", artiestNaam: "Alle artiesten" }],
        views: [
          { key: "Day", text: "Dag" },
          { key: "Week", text: "Week" }
        ],
        selectedStageId: "",
        selectedArtiestId: ""
      });
      oView.setModel(oFiltersModel, "filters");

      var oLineUpModel = new JSONModel({
        startDate: this._oFixedStart,
        viewKey: "Day",
        rows: []
      });
      oView.setModel(oLineUpModel, "lineup");

      this._oDetailsModel = new JSONModel({});
      oView.setModel(this._oDetailsModel, "details");

      this._initLineUp();
    },

    _initLineUp: async function () {
      try {
        await this._loadFilterData();
        await this._loadLineUp();
        this._applyFixedStart();
      } catch (e) {
        console.error("LineUp init error:", e);
        MessageBox.error("Fout bij initialisatie van Line-up.");
      }
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPrevHash = oHistory.getPreviousHash();

      if (sPrevHash !== undefined) {
        window.history.go(-1);
        return;
      }

      UIComponent.getRouterFor(this).navTo("RouteArtiestManagement", {}, true);
    },

    onRefresh: function () {
      this._loadLineUp().then(this._applyFixedStart.bind(this));
    },

    onFilterChange: function () {
      this._loadLineUp().then(this._applyFixedStart.bind(this));
    },

    onViewChange: function (oEvent) {
      var sKey = oEvent.getSource().getSelectedKey();
      this.getView().getModel("lineup").setProperty("/viewKey", sKey);
      this._applyFixedStart();
    },

    onAppointmentSelect: function (oEvent) {
      var oAppt = oEvent.getParameter("appointment");
      if (!oAppt) {
        return;
      }

      var oCtx = oAppt.getBindingContext("lineup");
      if (!oCtx) {
        return;
      }

      this._openDetailsDialog(oCtx.getObject());
    },

    onCloseDetails: function () {
      if (this._oDialog) {
        this._oDialog.close();
      }
    },

    _openDetailsDialog: function (oDetails) {
      var oView = this.getView();

      this._oDetailsModel.setData(oDetails || {});

      if (!this._oDialog) {
        this._oDialog = sap.ui.xmlfragment(
          "my.project.erpproject.view.fragments.OptredenDetails",
          this
        );
        oView.addDependent(this._oDialog);
      }

      this._oDialog.open();
    },

    _applyFixedStart: function () {
      var oCal = this.byId("pcLineUp");
      var oLineUpModel = this.getView().getModel("lineup");

      if (oLineUpModel) {
        oLineUpModel.setProperty("/startDate", this._oFixedStart);
      }
      if (oCal && oCal.setStartDate) {
        oCal.setStartDate(this._oFixedStart);
      }
    },

    _getODataModel: function () {
      var oComponent = this.getOwnerComponent();
      return oComponent ? oComponent.getModel() : null;
    },

    _loadFilterData: async function () {
      var oModel = this._getODataModel();
      if (!oModel) {
        throw new Error("Geen OData model beschikbaar (default model ontbreekt).");
      }

      var oFiltersModel = this.getView().getModel("filters");

      var aStages = await this._requestAll(oModel, "/Stages", null, null, 2000);
      var aArtiesten = await this._requestAll(oModel, "/Artiesten", null, null, 5000);

      oFiltersModel.setProperty(
        "/stages",
        [{ ID: "", stageNaam: "Alle stages" }].concat(
          aStages.map(function (o) {
            return { ID: String(o.ID), stageNaam: o.stageNaam };
          })
        )
      );

      oFiltersModel.setProperty(
        "/artiesten",
        [{ ID: "", artiestNaam: "Alle artiesten" }].concat(
          aArtiesten.map(function (o) {
            return { ID: String(o.ID), artiestNaam: o.artiestNaam };
          })
        )
      );
    },

    _loadLineUp: async function () {
      var oModel = this._getODataModel();
      if (!oModel) {
        throw new Error("Geen OData model beschikbaar (default model ontbreekt).");
      }

      var oView = this.getView();
      var oFiltersModel = oView.getModel("filters");
      var oLineUpModel = oView.getModel("lineup");

      var sStageId = oFiltersModel.getProperty("/selectedStageId");
      var sArtiestId = oFiltersModel.getProperty("/selectedArtiestId");

      var aFilters = [];
      if (sStageId) {
        aFilters.push(new Filter("stage_ID", FilterOperator.EQ, parseInt(sStageId, 10)));
      }
      if (sArtiestId) {
        aFilters.push(new Filter("artiest_ID", FilterOperator.EQ, parseInt(sArtiestId, 10)));
      }

      var aOptredens = await this._requestAll(
        oModel,
        "/Optredens",
        { $expand: "artiest,stage,festivalDag" },
        aFilters,
        10000
      );

      var mByStage = new Map();

      aOptredens.forEach(function (oOptreden) {
        var oStage = oOptreden.stage;
        var oArtiest = oOptreden.artiest;
        var oFestivalDag = oOptreden.festivalDag;

        if (!oStage || !oArtiest || !oFestivalDag) {
          return;
        }

        var sStageKey = String(oStage.ID);

        if (!mByStage.has(sStageKey)) {
          mByStage.set(sStageKey, {
            stageId: oStage.ID,
            stageNaam: oStage.stageNaam,
            stageSubText: "",
            appointments: []
          });
        }

        var oDates = this._buildStartEnd(oFestivalDag.datum, oOptreden.startTijd, oOptreden.eindTijd);
        if (!oDates) {
          return;
        }

        var sTime = this._fmtTimeRange(oOptreden.startTijd, oOptreden.eindTijd);
        var sGenre = (oArtiest.genre || "").toString();

        mByStage.get(sStageKey).appointments.push({
          title: oArtiest.artiestNaam + "  (" + sTime + ")",
          text: sGenre,
          startDate: oDates.start,
          endDate: oDates.end,
          artiestNaam: oArtiest.artiestNaam,
          genre: oArtiest.genre,
          stageNaam: oStage.stageNaam,
          datum: oFestivalDag.datum,
          startTijd: oOptreden.startTijd,
          eindTijd: oOptreden.eindTijd
        });
      }.bind(this));

      var aRows = Array.from(mByStage.values());

      aRows.sort(function (a, b) {
        return String(a.stageNaam || "").localeCompare(String(b.stageNaam || ""));
      });

      aRows.forEach(function (oRow) {
        oRow.appointments.sort(function (a, b) {
          return a.startDate - b.startDate;
        });
      });

      oLineUpModel.setProperty("/rows", aRows);
      oLineUpModel.setProperty("/startDate", this._oFixedStart);
    },

    _requestAll: async function (oModel, sPath, mQueryOptions, aFilters, iMax) {
      var mParameters = Object.assign(
        { $$operationMode: "Server" },
        mQueryOptions || {}
      );

      var oBind = oModel.bindList(sPath, null, null, aFilters || [], mParameters);
      var aCtx = await oBind.requestContexts(0, iMax || 1000);

      return aCtx.map(function (oCtx) {
        return oCtx.getObject();
      });
    },

    _buildStartEnd: function (sDate, sStartTime, sEndTime) {
      if (!sDate || !sStartTime || !sEndTime) {
        return null;
      }

      var aDate = String(sDate).split("-");
      if (aDate.length !== 3) {
        return null;
      }

      var iY = parseInt(aDate[0], 10);
      var iM = parseInt(aDate[1], 10) - 1;
      var iD = parseInt(aDate[2], 10);

      var oStart = this._dateWithTime(iY, iM, iD, sStartTime);
      var oEnd = this._dateWithTime(iY, iM, iD, sEndTime);

      if (!oStart || !oEnd) {
        return null;
      }

      if (oEnd.getTime() <= oStart.getTime()) {
        oEnd = new Date(oEnd.getTime());
        oEnd.setDate(oEnd.getDate() + 1);
      }

      return { start: oStart, end: oEnd };
    },

    _dateWithTime: function (iY, iM, iD, sTime) {
      var aParts = String(sTime).split(":");
      if (aParts.length < 2) {
        return null;
      }

      var iH = parseInt(aParts[0], 10);
      var iMin = parseInt(aParts[1], 10);

      var sSecPart = aParts[2] || "0";
      var iSec = parseInt(String(sSecPart).split(".")[0], 10);

      if (isNaN(iH) || isNaN(iMin) || isNaN(iSec)) {
        return null;
      }

      return new Date(iY, iM, iD, iH, iMin, iSec);
    },

    _fmtTimeRange: function (sStartTime, sEndTime) {
      var s1 = this._hhmm(sStartTime);
      var s2 = this._hhmm(sEndTime);
      return s1 + "–" + s2;
    },

    _hhmm: function (sTime) {
      var a = String(sTime).split(":");
      if (a.length < 2) {
        return String(sTime);
      }
      return a[0].padStart(2, "0") + ":" + a[1].padStart(2, "0");
    }
  });
});
