sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/ui/core/routing/History"
], function (Controller, JSONModel, MessageBox, History) {
  "use strict";

  return Controller.extend("my.project.erpproject.controller.Leaderboard", {
    onInit: function () {
      var oVM = new JSONModel({ items: [] });
      this.getView().setModel(oVM, "leaderboard");

      this._aAllItems = [];

      var oSort = this.byId("sorteerLeaderboard");
      if (oSort) {
        oSort.setSelectedKey("avgRating");
      }

      var oRouter = this.getOwnerComponent().getRouter();
      var oRoute = oRouter.getRoute("RouteLeaderboard");
      if (oRoute) {
        oRoute.attachPatternMatched(this._onRouteMatched, this);
      }

      this._loadLeaderboard();
    },

    _onRouteMatched: function () {
      this._loadLeaderboard();
    },

    onNavBack: function () {
      var oHistory = History.getInstance();
      var sPreviousHash = oHistory.getPreviousHash();

      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("RouteArtiestManagement", {}, true);
      }
    },

    onRefresh: function () {
      this._loadLeaderboard();
    },

    onSearchLiveChange: function () {
      this._applyClientFilters();
    },

    onSearch: function () {
      this._applyClientFilters();
    },

    onGenreChange: function () {
      this._applyClientFilters();
    },

    onSortChange: function () {
      this._applyClientFilters();
    },

    onRowPress: function (oEvent) {
      var oItem = oEvent.getSource();
      var oCtx = oItem.getBindingContext("leaderboard");
      if (!oCtx) {
        return;
      }

      var iID = oCtx.getProperty("artiest_ID");
      if (iID === undefined || iID === null) {
        return;
      }

      this.getOwnerComponent().getRouter().navTo("RouteArtiestDetail", { ID: iID });
    },

    _loadLeaderboard: function () {
      var oModel = this.getOwnerComponent().getModel();
      if (!oModel) {
        MessageBox.error("OData model ontbreekt. Controleer manifest.json models.");
        return;
      }

      var that = this;

      Promise.all([
        this._requestAll(oModel, "/Artiesten", { $$groupId: "$direct" }),
        this._requestAll(oModel, "/Reviews", { $expand: "artiest", $$groupId: "$direct" })
      ]).then(function (aResults) {
        var aArtiesten = aResults[0] || [];
        var aReviews = aResults[1] || [];

        that._aAllItems = that._buildLeaderboardFromReviews(aArtiesten, aReviews);
        that._applyClientFilters();
      }).catch(function (err) {
        MessageBox.error("Fout bij laden van leaderboard data.");
        /* eslint-disable no-console */
        console.error("Leaderboard load error:", err);
        /* eslint-enable no-console */
      });
    },

    _requestAll: function (oModel, sPath, mParameters) {
      var oListBinding;
      try {
        oListBinding = oModel.bindList(sPath, null, null, null, mParameters || {});
      } catch (e) {
        return Promise.reject(e);
      }

      return oListBinding.requestContexts(0, Infinity).then(function (aCtx) {
        return aCtx.map(function (c) { return c.getObject(); });
      });
    },

    _buildLeaderboardFromReviews: function (aArtiesten, aReviews) {
      var mArtiest = {};
      (aArtiesten || []).forEach(function (a) {
        if (a && a.ID !== undefined && a.ID !== null) {
          mArtiest[a.ID] = a;
        }
      });

      var mStats = {};
      (aReviews || []).forEach(function (r) {
        if (!r) { return; }

        var iArtiestID = r.artiest_ID;
        if (iArtiestID === undefined || iArtiestID === null) {
          if (r.artiest && r.artiest.ID !== undefined && r.artiest.ID !== null) {
            iArtiestID = r.artiest.ID;
          }
        }
        if (iArtiestID === undefined || iArtiestID === null) { return; }

        var v = (r.rating !== undefined && r.rating !== null) ? Number(r.rating) : 0;
        if (isNaN(v)) { v = 0; }

        if (!mStats[iArtiestID]) {
          mStats[iArtiestID] = { sum: 0, count: 0 };
        }
        mStats[iArtiestID].sum += v;
        mStats[iArtiestID].count += 1;

        if (!mArtiest[iArtiestID] && r.artiest) {
          mArtiest[iArtiestID] = r.artiest;
        }
      });

      var aResult = (aArtiesten || []).map(function (a) {
        var st = mStats[a.ID];
        var iCount = st ? st.count : 0;
        var fAvg = (iCount > 0) ? (st.sum / iCount) : 0;
        var fAvg1 = Math.round(fAvg * 10) / 10;

        return {
          artiest_ID: a.ID,
          artiestNaam: a.artiestNaam || "",
          genre: a.genre || "",
          land: a.land || "",
          avgRating: (iCount === 0) ? 0 : fAvg1,
          reviewCount: iCount,
          rank: 0
        };
      });

      return aResult;
    },

    _applyClientFilters: function () {
      var sZoek = (this.byId("zoekVeldLeaderboard").getValue() || "").trim().toLowerCase();
      var sGenre = this.byId("filterGenreLeaderboard").getSelectedKey() || "";
      var sSortKey = this.byId("sorteerLeaderboard").getSelectedKey() || "avgRating";

      var aFiltered = (this._aAllItems || []).filter(function (it) {
        if (sGenre && it.genre !== sGenre) {
          return false;
        }
        if (sZoek) {
          var sNaam = (it.artiestNaam || "").toLowerCase();
          return sNaam.indexOf(sZoek) !== -1;
        }
        return true;
      });

      aFiltered.sort(function (a, b) {
        var aNo = (a.reviewCount === 0);
        var bNo = (b.reviewCount === 0);
        if (aNo !== bNo) {
          return aNo ? 1 : -1;
        }

        if (sSortKey === "reviewCount") {
          if (b.reviewCount !== a.reviewCount) {
            return b.reviewCount - a.reviewCount;
          }
          if (b.avgRating !== a.avgRating) {
            return b.avgRating - a.avgRating;
          }
        } else {
          if (b.avgRating !== a.avgRating) {
            return b.avgRating - a.avgRating;
          }
          if (b.reviewCount !== a.reviewCount) {
            return b.reviewCount - a.reviewCount;
          }
        }

        var an = (a.artiestNaam || "").toLowerCase();
        var bn = (b.artiestNaam || "").toLowerCase();
        if (an < bn) { return -1; }
        if (an > bn) { return 1; }
        return 0;
      });

      aFiltered = aFiltered.map(function (it, idx) {
        var oCopy = Object.assign({}, it);
        oCopy.rank = idx + 1;
        return oCopy;
      });

      this.getView().getModel("leaderboard").setProperty("/items", aFiltered);
    }
  });
});
