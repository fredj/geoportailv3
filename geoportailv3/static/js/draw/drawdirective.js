/**
 * @fileoverview This file provides a draw directive. This directive is used
 * to create a draw panel in the page.
 *
 * Example:
 *
 * <app-draw app-draw-map="::mainCtrl.map"
 *           app-draw-active="mainCtrl.drawOpen"
 *           app-draw-features="mainCtrl.drawnFeatures"></app-draw>
 *
 * Note the use of the one-time binding operator (::) in the map expression.
 * One-time binding is used because we know the map is not going to change
 * during the lifetime of the application.
 */
goog.provide('app.DrawController');
goog.provide('app.drawDirective');

goog.require('app');
goog.require('goog.asserts');
goog.require('ngeo.DecorateInteraction');
goog.require('ngeo.Location');
goog.require('ngeo.format.FeatureHash');
goog.require('ol.CollectionEventType');
goog.require('ol.FeatureStyleFunction');
goog.require('ol.events.condition');
goog.require('ol.geom.GeometryType');
goog.require('ol.interaction.Draw');
goog.require('ol.interaction.Modify');
goog.require('ol.interaction.Select');
goog.require('ol.style.RegularShape');


/**
 * @param {string} appDrawTemplateUrl Url to draw template
 * @return {angular.Directive} The Directive Definition Object.
 * @ngInject
 */
app.drawDirective = function(appDrawTemplateUrl) {
  return {
    restrict: 'E',
    scope: {
      'map': '=appDrawMap',
      'features': '=appDrawFeatures',
      'active': '=appDrawActive',
      'selectedFeatures': '=appDrawSelectedfeatures'
    },
    controller: 'AppDrawController',
    controllerAs: 'ctrl',
    bindToController: true,
    templateUrl: appDrawTemplateUrl
  };
};


app.module.directive('appDraw', app.drawDirective);



/**
 * @param {!angular.Scope} $scope Scope.
 * @param {ngeo.DecorateInteraction} ngeoDecorateInteraction Decorate
 *     interaction service.
 * @param {ngeo.Location} ngeoLocation Location service.
 * @param {app.FeaturePopup} appFeaturePopup Feature popup service.
 * @constructor
 * @export
 * @ngInject
 */
app.DrawController = function($scope, ngeoDecorateInteraction, ngeoLocation,
    appFeaturePopup) {

  /**
   * @type {ol.Map}
   *  @export
   */
  this.map;

  /**
   * @type {boolean}
   *  @export
   */
  this.active;

  /**
   * @type {number}
   * @private
   */
  this.featureSeq_ = 0;

  /**
   * @type {ol.Collection.<ol.Feature>}
   * @export
   */
  this.features;

  /**
   * @type {ol.interaction.Select}
   *  @export
   */
  this.selectInteraction;

  /**
   * @type {app.FeaturePopup}
   * @private
   */
  this.featurePopup_ = appFeaturePopup;

  /**
   * @type {angular.Scope}
   * @private
   */
  this.scope_ = $scope;

  /**
   * @type {ngeo.Location}
   * @private
   */
  this.ngeoLocation_ = ngeoLocation;

  /**
   * @type {ngeo.format.FeatureHash}
   * @private
   */
  this.fhFormat_ = new ngeo.format.FeatureHash();

  var drawPoint = new ol.interaction.Draw({
    features: this.features,
    type: ol.geom.GeometryType.POINT
  });

  /**
   * @type {ol.interaction.Draw}
   * @export
   */
  this.drawPoint = drawPoint;

  drawPoint.setActive(false);
  ngeoDecorateInteraction(drawPoint);
  this.map.addInteraction(drawPoint);
  goog.events.listen(drawPoint, ol.interaction.DrawEventType.DRAWEND,
      this.onDrawEnd_, false, this);

  var drawLine = new ol.interaction.Draw({
    features: this.features,
    type: ol.geom.GeometryType.LINE_STRING
  });

  /**
   * @type {ol.interaction.Draw}
   * @export
   */
  this.drawLine = drawLine;

  drawLine.setActive(false);
  ngeoDecorateInteraction(drawLine);
  this.map.addInteraction(drawLine);
  goog.events.listen(drawLine, ol.interaction.DrawEventType.DRAWEND,
      this.onDrawEnd_, false, this);

  var drawPolygon = new ol.interaction.Draw({
    features: this.features,
    type: ol.geom.GeometryType.POLYGON
  });

  /**
   * @type {ol.interaction.Draw}
   * @export
   */
  this.drawPolygon = drawPolygon;

  drawPolygon.setActive(false);
  ngeoDecorateInteraction(drawPolygon);
  this.map.addInteraction(drawPolygon);
  goog.events.listen(drawPolygon, ol.interaction.DrawEventType.DRAWEND,
      this.onDrawEnd_, false, this);


  // Watch the "active" property, and disable the draw interactions
  // when "active" gets set to false.
  $scope.$watch(goog.bind(function() {
    return this.active;
  }, this), goog.bind(function(newVal) {
    if (newVal === false) {
      this.drawPoint.setActive(false);
      this.drawLine.setActive(false);
    }
  }, this));

  // Decode the features encoded in the URL and add them to the collection
  // of drawn features.
  var encodedFeatures = ngeoLocation.getParam('features');
  if (goog.isDef(encodedFeatures)) {
    var features = this.fhFormat_.readFeatures(encodedFeatures);
    goog.asserts.assert(!goog.isNull(features));
    this.features.extend(features);
  }

  /**
   * @param {number} resolution The map resolution.
   * @this {ol.Feature}
   * @return {Array<ol.style.Style>}
   * @private
   */
  this.styleFunction_ = function(resolution) {
    var styles = [];

    if (this.get('__editable__') && this.get('__selected__')) {
      // The vertex style display a black and white circle on the existing
      // vertices, and also when the user can add a new vertices.
      styles.push(new ol.style.Style({
        image: new ol.style.RegularShape(
            /** @type {olx.style.RegularShapeOptions} */ ({
              radius: 6,
              points: 4,
              angle: Math.PI / 4,
              fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.5)'
              }),
              stroke: new ol.style.Stroke({
                color: 'rgba(0, 0, 0, 1)'
              })
            })
        ),
        geometry: function(feature) {
          var geom = feature.getGeometry();
          var coordinates;
          if (geom instanceof ol.geom.LineString) {
            coordinates = feature.getGeometry().getCoordinates();
            return new ol.geom.MultiPoint(coordinates);
          } else if (geom instanceof ol.geom.Polygon) {
            coordinates = feature.getGeometry().getCoordinates()[0];
            return new ol.geom.MultiPoint(coordinates);
          } else {
            return feature.getGeometry();
          }
        }
      }));
    }

    // goog.asserts.assert(goog.isDef(this.get('__style__'));
    var style = this.get('__style__');
    var color = style['color'];
    var rgb = goog.color.hexToRgb(color);
    var fillColor = goog.color.alpha.rgbaToRgbaStyle(rgb[0], rgb[1], rgb[2],
        style['opacity']);
    var fill = new ol.style.Fill({
      color: fillColor
    });

    var lineDash;
    if (style['lineDash']) {
      switch (style['lineDash']) {
        case 'dashed':
          lineDash = [10, 10];
          break;
        case 'dotted':
          lineDash = [1, 6];
          break;
      }
    }

    var stroke;

    if (style['size'] > 0) {
      stroke = new ol.style.Stroke({
        color: color,
        width: style['size'],
        lineDash: lineDash
      });
    }
    var imageOptions = {
      fill: fill,
      stroke: new ol.style.Stroke({
        color: color,
        width: style['size'] / 7
      }),
      radius: style['size']
    };
    var image = new ol.style.Circle(imageOptions);
    if (style['shape'] && style['shape'] != 'circle') {
      goog.object.extend(imageOptions, ({
        points: 4,
        angle: Math.PI / 4,
        rotation: style['rotation']
      }));
      image = new ol.style.RegularShape(
          /** @type {olx.style.RegularShapeOptions} */ (imageOptions));
    }

    if (style['text']) {
      styles = [new ol.style.Style({
        text: new ol.style.Text(/** @type {olx.style.TextOptions} */ ({
          text: this.get('name'),
          font: style['size'] + 'px Sans-serif',
          rotation: style['rotation'],
          fill: new ol.style.Fill({
            color: color
          }),
          stroke: new ol.style.Stroke({
            color: 'white',
            width: 2
          })
        }))
      })];
    } else {
      styles.push(new ol.style.Style({
        image: image,
        fill: fill,
        stroke: stroke
      }));
    }

    return styles;
  };


  var selectInteraction = new ol.interaction.Select({
    features: this.selectedFeatures,
    filter: goog.bind(function(feature, layer) {
      return this.features.getArray().indexOf(feature) != -1;
    }, this)
  });
  this.map.addInteraction(selectInteraction);

  /**
   * @type {ol.interaction.Select}
   * @export
   */
  this.selectInteraction = selectInteraction;

  appFeaturePopup.init(this.map, selectInteraction.getFeatures());

  /**
   * The selected features.
   * @type {ol.Collection.<ol.Feature>}
   * @export
   */
  this.selectedFeatures = selectInteraction.getFeatures();

  goog.events.listen(this.selectedFeatures, ol.CollectionEventType.ADD,
      /**
       * @param {ol.CollectionEvent} evt
       */
      function(evt) {
        goog.asserts.assertInstanceof(evt.element, ol.Feature);
        var feature = evt.element;
        feature.set('__selected__', true);
      });

  goog.events.listen(this.selectedFeatures, ol.CollectionEventType.REMOVE,
      /**
       * @param {ol.CollectionEvent} evt
       */
      function(evt) {
        goog.asserts.assertInstanceof(evt.element, ol.Feature);
        var feature = evt.element;
        feature.set('__selected__', false);
      });

  goog.events.listen(this.selectInteraction,
      ol.interaction.SelectEventType.SELECT,
      /**
       * @param {ol.interaction.SelectEvent} evt
       */
      function(evt) {
        if (evt.selected.length > 0) {
          this.featurePopup_.show(evt.selected[0],
              evt.mapBrowserEvent.coordinate);
        } else {
          this.featurePopup_.hide();
        }
        $scope.$apply();
      }, true, this);

  var modifyInteraction = new ol.interaction.Modify({
    features: this.selectedFeatures
  });
  this.map.addInteraction(modifyInteraction);
};


/**
 * @param {ol.interaction.DrawEvent} event
 * @private
 */
app.DrawController.prototype.onDrawEnd_ = function(event) {
  var feature = event.feature;
  feature.set('name', 'element ' + (++this.featureSeq_));
  feature.set('__editable__', true);
  feature.set('__style__', {
    color: '#ed1c24',
    opacity: 0.2,
    size: feature.getGeometry().getType() == ol.geom.GeometryType.POINT ?
        10 : 1.25,
    shape: 'circle',
    rotation: 0,
    lineDash: 'plain'
  });
  feature.setStyle(this.styleFunction_);

  // Deactivating asynchronosly to prevent dbl-click to zoom in
  window.setTimeout(goog.bind(function() {
    this.scope_.$apply(function() {
      event.target.setActive(false);
    });
  }, this), 0);

  // Encode the features in the URL.
  // warning: the drawn feature is not yet in the collection when the
  // "drawend" event is triggered. So we create a new array and append
  // the drawn feature to that array.
  var features = this.features.getArray().slice();
  features.push(feature);
  this.ngeoLocation_.updateParams({
    'features': this.fhFormat_.writeFeatures(features)
  });
};

app.module.controller('AppDrawController', app.DrawController);
