/**
 * @fileoverview This file provides the layer manager directive. That directive
 * is used to create the list of selected layers in the page.
 *
 * Example:
 *
 * <app-layermanager app-layermanager-map="::mainCtrl.map"
 *     app-layermanager-layers="::mainCtrl.selectedLayers">
 * </app-layermanager>
 *
 * Note the use of the one-time binding operator (::) in the map and layers
 * expressions. One-time binding is used because we know the map and the array
 * of layers are not going to change during the lifetime of the application.
 * The content of the array of layers may change, but not the array itself.
 */
goog.provide('app.LayermanagerController');
goog.provide('app.layermanagerDirective');

goog.require('app');
goog.require('ngeo.sortableDirective');


/**
 * @param {string} appLayermanagerTemplateUrl Url to layermanager template
 * @return {angular.Directive} The Directive Definition Object.
 * @ngInject
 */
app.layermanagerDirective = function(appLayermanagerTemplateUrl) {
  return {
    restrict: 'E',
    scope: {
      'map': '=appLayermanagerMap',
      'layers': '=appLayermanagerLayers'
    },
    controller: 'AppLayermanagerController',
    controllerAs: 'ctrl',
    bindToController: true,
    templateUrl: appLayermanagerTemplateUrl
  };
};


app.module.directive('appLayermanager', app.layermanagerDirective);


/**
 * @constructor
 * @export
 */
app.LayermanagerController = function() {
  this['uid'] = goog.getUid(this);

  /**
   * Hash array to keep track of opacities set on layers.
   * @type {Object.<number, number>}
   * @private
   */
  this.opacities_ = {};
};


/**
 * @param {ol.layer.Layer} layer Layer.
 * @export
 */
app.LayermanagerController.prototype.removeLayer = function(layer) {
  this['map'].removeLayer(layer);

};


/**
 * @param {ol.layer.Layer} layer Layer.
 * @export
 */
app.LayermanagerController.prototype.changeVisibility = function(layer) {
  var currentOpacity = layer.getOpacity();
  var newOpacity;
  var uid = goog.getUid(layer);
  if (currentOpacity === 0) {
    if (goog.isDef(this.opacities_[uid])) {
      newOpacity = this.opacities_[uid];
    } else {
      newOpacity = 1;
    }
    // reset old opacity for later use
    delete this.opacities_[uid];
  } else {
    this.opacities_[uid] = currentOpacity;
    newOpacity = 0;
  }
  layer.setOpacity(newOpacity);
};


app.module.controller('AppLayermanagerController', app.LayermanagerController);
