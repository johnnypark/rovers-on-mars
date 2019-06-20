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
let surface = L.tileLayer('https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/celestia_mars-shaded-16k_global/{z}/{x}/{y}.png', {
    attribution: 'Celestia/praesepe',
    tms: true
});
let minimap = L.tileLayer('https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/celestia_mars-shaded-16k_global/{z}/{x}/{y}.png', {
    attribution: 'Celestia/praesepe',
    tms: true,
    maxZoom: 5
});

// hillshade layer
let hillshade = L.tileLayer('https://s3.us-east-2.amazonaws.com/opmmarstiles/hillshade-tiles/{z}/{x}/{y}.png', {
    attribution: 'NASA/MOLA',
    tms: true
});

// shaded greyscale layer
let greyscale = L.tileLayer('https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/mola-gray/{z}/{x}/{y}.png', {
    attribution: 'NASA/MOLA',
    tms: true
});

// shaded color layer
let color = L.tileLayer('https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/mola-color/{z}/{x}/{y}.png', {
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
            [-90, 30],
            [90, 330]
        ],
        zoomControl: false
    }).setView([0, 0], 3);

    L.control.zoom({
        position:'bottomright'
    }).addTo(map);

    //map.fitBounds(bounds);

    L.control.scale({'position': 'bottomleft', 'metric': true, 'imperial': false}).addTo(map);

    map.addLayer(vector);

    let baseLayers = {
        "Vector": vector,
        "Shaded Surface": surface,
        "Shaded Greyscale": greyscale,
        "Hillshade": hillshade,
        "Color": color
    };
    let overlays = {
        "Gale Crater (Curiosity)": gale,
        "Gusev Crater (Spirit)": gusev
    };
    let mapPicker = L.control.layers(baseLayers, overlays).addTo(map);

    let miniMap = new L.Control.MiniMap(minimap, {position: "topleft", zoomAnimation: true, toggleDisplay: true, autoToggleDisplay: true}).addTo(map);

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

let data = {path: {}, points: {}, images: {}, manifest: {}};
function addGeoJSON()
{
    let paths = L.featureGroup().addTo(map);

    let promises = [];
    for(let rover of ['curiosity', 'spirit'])
    {
        let load_path = $.ajax({
            type: "GET",
            url: "geodata/" + rover + "-path.geojson",
            dataType: "json",
            success: function (response) {
                let path = L.featureGroup();
                data.path[rover] = L.geoJson(response).addTo(paths).addTo(path);

                L.edgeMarker({
                    rover: rover,
                    findEdge : function(map){ return L.bounds([200,120], [map.getSize().x - 50, map.getSize().y - 20])},
                    icon: L.divIcon({ className: 'pointer ' + rover , iconSize: [80, 80]}),
                    distanceOpacity: false,
                    rotateIcons: false,
                    layerGroup: path
                }).addTo(map);
            }
        });
        let load_points = $.ajax({
            type: "GET",
            url: "geodata/" + rover + "-points.geojson",
            dataType: "json",
            success: function (response) {
                data.points[rover] = L.geoJson(response,
                {
                    onEachFeature: function(feature, layer) {
                        feature.properties.rover = rover;
                        layer.on({
                            click: clickMarker
                        });
                    },
                    pointToLayer: function (feature, latlng) {
                        let tooltip = feature.properties.date_2 === null ? "Sol " + feature.properties.date_1 : "Sols " + feature.properties.date_1 + ' to ' + feature.properties.date_2;
                        return L.marker(latlng, {icon: makeIcon(rover)}).bindTooltip(tooltip);
                    }
                }).addTo(map);
            }
        });
        promises.push(load_path, load_points);
    }

    let load_manifest = $.ajax({
        type: "GET",
        url: "geodata/manifest.json",
        dataType: "json",
        success: function(response) {
            data.manifest = response;
        }
    });

    promises.push(load_manifest);

    $.when.apply($, promises).done(function() {
        map.fitBounds(paths.getBounds(), {padding: [50, 50]});
    });
}

function clickMarker(e)
{
    let p = e.target.feature.properties;

    if(p.date_2 === null)
        p.date_2 = p.date_1;

    let container = $(".overlay." + p.rover + " .sol-chooser");
    container.html("");
    for(let i = p.date_1; i <= p.date_2; i++)
    {
        container.append("<div class='s" + i + " " + (i === p.date_1 ? "selected" : "") + "' onclick=\"clickSol('" + p.rover + "', " + i + ")\">Sol " + i + "</div>");
    }

    $(".overlay." + p.rover).show();

    clickSol(p.rover, p.date_1);
}

function clickSol(rover, sol)
{
    let chooser = $(".overlay." + rover + " .sol-chooser");
    chooser.find("div").removeClass("selected");
    chooser.find(".s" + sol).addClass("selected");

    let photos = data.manifest[rover].photo_manifest.photos;
    let cameras = [];
    if(photos[sol] && photos[sol].cameras) cameras = photos[sol].cameras;

    let overlay = $(".overlay." + rover);
    let divs = overlay.find(".rover-cameras div");
    divs.addClass("disabled");

    for(let i = 0; i <= cameras.length; i++)
    {
        divs.filter("." + cameras[i]).removeClass("disabled");
    }

    overlay.attr("data-sol", sol);

    clickCamera(rover, "NAVCAM");
}

function clickCamera(rover, camera)
{
    let overlay = $(".overlay." + rover);
    let sol = overlay.attr("data-sol");

    if(!data.images[rover])
        data.images[rover] = {};

    if(!data.images[rover][camera])
        data.images[rover][camera] = {};

    let container = overlay.find(".image-sidebar");
    container.html("loading");

    let promise = getImage(rover, sol, camera);

    promise.done(function(){
        let html = '';
        html += '<h2>Sol ' + sol + '</h2>';
        html += '<h5>' + data.images[rover][camera][sol]['photos'].length + ' images</h5>';
        let j;
        for(j = 0; j < data.images[rover][camera][sol]['photos'].length; j++)
        {
            html += '<a href="' + data.images[rover][camera][sol]['photos'][j].img_src + '"><img src="' + data.images[rover][camera][sol]['photos'][j].img_src + '" class="rover"/></a>';
        }
        container.html(html);
        lightbox = container.find('a').simpleLightbox({});
    });
}

let api_key = "iitToTP7Vq0aSzwdZwfDCcR4tNR5aMgA23KRZn0x";
function getImage(rover, sol, camera, page)
{
    let promise = $.Deferred();
    if(!data.images[rover][camera][sol])
    {
        $.ajax({
            type: "GET",
            url: "https://api.nasa.gov/mars-photos/api/v1/rovers/" + rover + "/photos?api_key=" + api_key + "&sol=" + sol + (camera ? "&camera=" + camera : '') + (page ? "&page=" + page : ''),
            dataType: "json"
        }).done(function(response) {
            data.images[rover][camera][sol] = response;
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