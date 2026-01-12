// webapp/controller/Leaderboard.controller.js
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox",
  "sap/ui/core/routing/History"
], function (Controller, JSONModel, MessageBox, History) {
  "use strict";

  function _toDateValue(s) {
    if (!s) { return 0; }
    var t = Date.parse(String(s));
    return isNaN(t) ? 0 : t;
  }

  function _normGenreList(vGenre) {
    if (!vGenre) { return []; }
    if (Array.isArray(vGenre)) {
      return vGenre.map(function (x) { return String(x || "").trim(); }).filter(Boolean);
    }
    return String(vGenre)
      .split(",")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function _buildTrendPointsFromScores(aPoints) {
    var a = (aPoints || []).slice();
    if (!a.length) { return []; }

    a.sort(function (p1, p2) {
      return _toDateValue(p1.datum) - _toDateValue(p2.datum);
    });

    if (a.length > 6) {
      a = a.slice(a.length - 6);
    }

    var n = a.length;
    var points = [];

    for (var i = 0; i < n; i++) {
      var y = (a[i] && a[i].score !== undefined && a[i].score !== null) ? Number(a[i].score) : 0;
      if (isNaN(y)) { y = 0; }

      var x = (n === 1) ? 0 : Math.round(i * (100 / (n - 1)));
      points.push({ x: x, y: Math.round(y * 100) / 100 });
    }

    if (points.length === 1) {
      points.push({ x: 100, y: points[0].y });
    }

    return points;
  }

  function _buildTrendPointsFromReviews(aReviews) {
    var a = (aReviews || []).slice();
    if (!a.length) { return []; }

    a.sort(function (r1, r2) {
      return _toDateValue(r1.datum) - _toDateValue(r2.datum);
    });

    if (a.length > 6) {
      a = a.slice(a.length - 6);
    }

    var sum = 0;
    var points = [];
    var n = a.length;

    for (var i = 0; i < n; i++) {
      var v = (a[i] && a[i].rating !== undefined && a[i].rating !== null) ? Number(a[i].rating) : 0;
      if (isNaN(v)) { v = 0; }
      sum += v;

      var avg = sum / (i + 1);
      if (avg < 0) { avg = 0; }
      if (avg > 5) { avg = 5; }

      var x = (n === 1) ? 0 : Math.round(i * (100 / (n - 1)));
      points.push({ x: x, y: Math.round(avg * 100) / 100 });
    }

    if (points.length === 1) {
      points.push({ x: 100, y: points[0].y });
    }

    return points;
  }

  function _computeMinMax(aPoints) {
    var minY = null;
    var maxY = null;

    (aPoints || []).forEach(function (pt) {
      if (!pt) { return; }
      var y = Number(pt.y);
      if (isNaN(y)) { return; }
      if (minY === null || y < minY) { minY = y; }
      if (maxY === null || y > maxY) { maxY = y; }
    });

    if (minY === null) { minY = 0; }
    if (maxY === null) { maxY = 10; }

    if (minY === maxY) {
      minY = Math.max(0, minY - 1);
      maxY = minY + 2;
    } else {
      var pad = (maxY - minY) * 0.15;
      minY = Math.max(0, minY - pad);
      maxY = maxY + pad;
    }

    // als je scores typisch 0..10 zijn, clamp zachtjes
    if (maxY <= 10.5 && minY >= -0.5) {
      minY = Math.max(0, minY);
      maxY = Math.min(10, maxY);
      if (maxY === minY) { maxY = Math.min(10, minY + 2); }
    }

    return {
      min: Math.round(minY * 100) / 100,
      max: Math.round(maxY * 100) / 100
    };
  }

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
      if (!oCtx) { return; }

      var iID = oCtx.getProperty("artiest_ID");
      if (iID === undefined || iID === null) { return; }

      this.getOwnerComponent().getRouter().navTo("RouteArtiestDetail", { ID: iID });
    },

    _loadLeaderboard: function () {
      var oModel = this.getOwnerComponent().getModel();
      if (!oModel) {
        MessageBox.error("OData model ontbreekt. Controleer manifest.json models.");
        return;
      }

      var that = this;

      var pArtiesten = this._requestAll(oModel, "/Artiesten", { $$groupId: "$direct" });
      var pReviews = this._requestAll(oModel, "/Reviews", { $expand: "artiest", $$groupId: "$direct" });

      // EntitySet naam volgens $metadata: "PopulariteitPunt"
      var pPunten = this._requestAll(oModel, "/PopulariteitPunt", { $$groupId: "$direct" })
        .catch(function () { return []; });

      Promise.all([pArtiesten, pReviews, pPunten]).then(function (aResults) {
        var aArtiesten = aResults[0] || [];
        var aReviews = aResults[1] || [];
        var aPunten = aResults[2] || [];

        that._aAllItems = that._buildLeaderboard(aArtiesten, aReviews, aPunten);
        that._applyClientFilters();
      }).catch(function (err) {
        /* eslint-disable no-console */
        console.error("Leaderboard load error:", err);
        /* eslint-enable no-console */
        MessageBox.error("Fout bij laden van leaderboard data.");
        that.getView().getModel("leaderboard").setProperty("/items", []);
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

    _buildLeaderboard: function (aArtiesten, aReviews, aPunten) {
      var mArtiest = {};
      (aArtiesten || []).forEach(function (a) {
        if (a && a.ID !== undefined && a.ID !== null) {
          mArtiest[a.ID] = a;
        }
      });

      var mStats = {};
      var mReviewsPerArtiest = {};

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

        if (!mReviewsPerArtiest[iArtiestID]) {
          mReviewsPerArtiest[iArtiestID] = [];
        }
        mReviewsPerArtiest[iArtiestID].push({
          datum: r.datum,
          rating: v
        });

        if (!mArtiest[iArtiestID] && r.artiest) {
          mArtiest[iArtiestID] = r.artiest;
        }
      });

      var mPuntenPerArtiest = {};
      (aPunten || []).forEach(function (p) {
        if (!p) { return; }

        var iAid = p.artiest_ID;
        if (iAid === undefined || iAid === null) {
          if (p.artiest && p.artiest.ID !== undefined && p.artiest.ID !== null) {
            iAid = p.artiest.ID;
          }
        }
        if (iAid === undefined || iAid === null) { return; }

        if (!mPuntenPerArtiest[iAid]) {
          mPuntenPerArtiest[iAid] = [];
        }
        mPuntenPerArtiest[iAid].push({
          datum: p.datum,
          score: p.score
        });
      });

      return (aArtiesten || []).map(function (a) {
        var st = mStats[a.ID];
        var iCount = st ? st.count : 0;
        var fAvg = (iCount > 0) ? (st.sum / iCount) : 0;
        var fAvg1 = Math.round(fAvg * 10) / 10;

        // Trend: enkel PopulariteitPunt gebruiken (6 per artiest). Fallback enkel als er echt geen punten zijn.
        var aPop = mPuntenPerArtiest[a.ID] || [];
        var aTrendPoints = aPop.length ? _buildTrendPointsFromScores(aPop) : _buildTrendPointsFromReviews(mReviewsPerArtiest[a.ID] || []);

        var mm = _computeMinMax(aTrendPoints);

        return {
          artiest_ID: a.ID,
          artiestNaam: a.artiestNaam || "",
          genre: a.genre || "",
          _genreList: _normGenreList(a.genre),
          land: a.land || "",
          avgRating: (iCount === 0) ? 0 : fAvg1,
          reviewCount: iCount,
          rank: 0,
          trendPoints: aTrendPoints,
          trendMin: mm.min,
          trendMax: mm.max
        };
      });
    },

    _applyClientFilters: function () {
      var sZoek = (this.byId("zoekVeldLeaderboard").getValue() || "").trim().toLowerCase();
      var sGenre = this.byId("filterGenreLeaderboard").getSelectedKey() || "";
      var sSortKey = this.byId("sorteerLeaderboard").getSelectedKey() || "avgRating";

      var aFiltered = (this._aAllItems || []).filter(function (it) {
        if (sGenre) {
          var aGenres = it._genreList || _normGenreList(it.genre);
          if (aGenres.indexOf(sGenre) === -1) {
            return false;
          }
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
          if (b.reviewCount !== a.reviewCount) { return b.reviewCount - a.reviewCount; }
          if (b.avgRating !== a.avgRating) { return b.avgRating - a.avgRating; }
        } else {
          if (b.avgRating !== a.avgRating) { return b.avgRating - a.avgRating; }
          if (b.reviewCount !== a.reviewCount) { return b.reviewCount - a.reviewCount; }
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
