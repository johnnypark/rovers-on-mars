let map, lightbox;

// works but width = 2*height
// https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg

// works but slooooow
// https://api.nasa.gov/mars-wmts/catalog/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg

// OpenPlanetary tiles - nice!
// Vector
let vector = L.tileLayer('https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-1/0,1,2,3,4/{z}/{x}/{y}.png', {
    attribution: '<a href="https://github.com/openplanetary/" target="_blank">OpenPlanetaryMap</a>'
});

// Shaded surface layer
let surface = L.tileLayer('http://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/celestia_mars-shaded-16k_global/{z}/{x}/{y}.png', {
    attribution: 'Celestia/praesepe',
    tms: true
});

// hillshade layer
let hillshade = L.tileLayer('https://s3.us-east-2.amazonaws.com/opmmarstiles/hillshade-tiles/{z}/{x}/{y}.png', {
    attribution: 'NASA/MOLA',
    tms: true
});

// shaded greyscale layer
let greyscale = L.tileLayer('http://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/mola-gray/{z}/{x}/{y}.png', {
    attribution: 'NASA/MOLA',
    tms: true
});

// shaded color layer
let color = L.tileLayer('http://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/mola-color/{z}/{x}/{y}.png', {
    attribution: 'NASA/MOLA',
    tms: true
});

// image overlays
let gusev = L.imageOverlay( "img/gusev-crater.jpg",[[-16.81938, 173.14051], [-12.86162, 178.11655]], {opacity: 0.8});
let gale = L.imageOverlay( "img/gale-crater.jpg",[[-6.99038,136.10456], [-3.78708, 139.47267]], {opacity: 0.8});

// A control to show a message
L.Control.Message = L.Control.extend({
    onAdd: function(map) {
        let div = L.DomUtil.create('div', 'message-control');
        div.innerHTML = 'No imagery available for this layer and zoom.<br>Please use a different layer or activate the imagery.';
        return div;
    },

    onRemove: function(map) {
        // Nothing to do here
    }
});

L.control.message = function(opts) {
    return new L.Control.Message(opts);
};

function initMap() {

    map = L.map('map', {
        maxBounds: [
            [-90, -90],
            [90, 270]
        ],
        zoomControl: false
    }).setView([0, 0], 3);

    L.control.zoom({
        position:'bottomright'
    }).addTo(map);

    //map.fitBounds(bounds);

    L.control.scale({'position': 'bottomleft', 'metric': true, 'imperial': false}).addTo(map);

    map.addLayer(vector);

    var baseLayers = {
        "Vector": vector,
        "Shaded Surface": surface,
        "Shaded Greyscale": greyscale,
        "Hillshade": hillshade,
        "Color": color
    };
    var overlays = {
        "Gusev Crater (Spirit)": gusev,
        "Gale Crater (Curiosity)": gale
    };
    let mapPicker = L.control.layers(baseLayers, overlays).addTo(map);

    map.activeBaseLayer = vector;
    map.on("baselayerchange", function(e) {
        map.activeBaseLayer = e.layer;
        checkZoom();
    });

    map.on("zoomend", checkZoom);

    let messageControl = L.control.message({ position: 'bottomleft' }).addTo(map);

    addGeoJSON();
}

function checkZoom()
{
    let msgc = $(".message-control");
    msgc.hide();

    let message = false;
    if(map.activeBaseLayer === surface && map.getZoom() > 5)
        message = true;
    else if(map.activeBaseLayer === greyscale && map.getZoom() > 9)
        message = true;
    else if(map.activeBaseLayer === hillshade && map.getZoom() > 6)
        message = true;
    else if(map.activeBaseLayer === color && map.getZoom() > 6)
        message = true;

    if(message)
        msgc.show();
}

function makeIcon(rover)
{
    return L.divIcon({ className: 'circle ' + rover});
}

let data = {path: {}, points: {}, images: {}};
function addGeoJSON()
{
    let promises = [];
    for(let rover of ['curiosity', 'spirit'])
    {
        $.ajax({
            type: "GET",
            url: "geodata/" + rover + "-path.geojson",
            dataType: "json",
            success: function (response) {
                data.path[rover] = L.geoJson(response).addTo(map);
                if(rover === 'curiosity')
                    map.fitBounds(data.path[rover].getBounds())
            }
        });
        $.ajax({
            type: "GET",
            url: "geodata/" + rover + "-points.geojson",
            dataType: "json",
            success: function (response) {
                data.points[rover] = L.geoJson(response,
                {
                    onEachFeature: function(feature, layer) {
                        feature.properties.rover = rover;
                        layer.on({
                            click: doclick
                        });
                    },
                    pointToLayer: function (feature, latlng) {
                        let tooltip = feature.properties.date_2 === null ? "Sol " + feature.properties.date_1 : "Sols " + feature.properties.date_1 + ' to ' + feature.properties.date_2;
                        return L.marker(latlng, {icon: makeIcon(rover)}).bindTooltip(tooltip);
                    }
                }).addTo(map);
            }
        });
    }
}

function doclick(e)
{
    let p = e.target.feature.properties;

    if(p.date_2 === null)
        p.date_2 = p.date_1;

    if(!data.images[p.rover])
        data.images[p.rover] = {};

    $(".sidebar").html("loading");

    let promises = [];
    for(let i = p.date_1; i <= p.date_2; i++)
    {
        promises.push(getImage(p.rover, i)); // "NAVCAM"
    }

    $.when.apply($, promises).done(function(){
        let html = '';
        for(let i = p.date_1; i <= p.date_2; i++)
        {
            html += '<h2>Sol ' + i + '</h2>';
            html += '<h5>' + data.images[p.rover][i]['photos'].length + ' images</h5>';
            let j;
            for(j = 0; j < Math.min(24, data.images[p.rover][i]['photos'].length); j++)
            {
                html += '<a href="' + data.images[p.rover][i]['photos'][j].img_src + '"><img src="' + data.images[p.rover][i]['photos'][j].img_src + '" class="rover"/></a>';
            }

            if(j < data.images[p.rover][i]['photos'].length)
            {
                html += (data.images[p.rover][i]['photos'].length - j) + " images more";
            }
        }
        $(".sidebar").html(html);
        lightbox = $('.sidebar a').simpleLightbox({});
    });
}

function getImage(rover, sol, camera, page)
{
    let api_key = "iitToTP7Vq0aSzwdZwfDCcR4tNR5aMgA23KRZn0x";
    let promise = $.Deferred();
    if(!data.images[rover][sol])
    {
        $.ajax({
            type: "GET",
            url: "https://api.nasa.gov/mars-photos/api/v1/rovers/" + rover + "/photos?api_key=" + api_key + "&sol=" + sol + (camera ? "&camera=" + camera : '') + (page ? "&page=" + page : ''),
            dataType: "json"
        }).done(function(response) {
            data.images[rover][sol] = response;
            promise.resolve();
        });
    }
    else
    {
        promise.resolve();
    }
    return promise.promise();
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