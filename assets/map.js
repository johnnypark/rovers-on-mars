let map;

function initMap() {
    // works but width = 2*height
    // https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg

    // works but slooooow
    // https://api.nasa.gov/mars-wmts/catalog/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg

    // OpenPlanetary tiles - nice!
    let mars = L.tileLayer('https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-1/0,1,2,3,4/{z}/{x}/{y}.png', {
        attribution: '<a href="https://github.com/openplanetary/" target="_blank">OpenPlanetaryMap</a>'
    });

    map = L.map('map', {
        maxBounds: [
            [-90, -180],
            [90, 180]
        ]
    }).setView([0, 0], 1);

    //map.fitBounds(bounds);

    L.control.scale({'position': 'bottomleft', 'metric': true, 'imperial': false}).addTo(map);

    map.addLayer(mars);

    //var baseLayers = {"Mars Vector": mars};
    //L.control.layers(baseLayers, {}).addTo(map);
}

/*
 * Workaround for 1px lines appearing in some browsers due to fractional transforms
 * and resulting anti-aliasing.
 * https://github.com/Leaflet/Leaflet/issues/3575
 */
(function(){
    var originalInitTile = L.GridLayer.prototype._initTile;
    L.GridLayer.include({
        _initTile: function (tile) {
            originalInitTile.call(this, tile);

            var tileSize = this.getTileSize();

            tile.style.width = tileSize.x + 1 + 'px';
            tile.style.height = tileSize.y + 1 + 'px';
        }
    });
})();