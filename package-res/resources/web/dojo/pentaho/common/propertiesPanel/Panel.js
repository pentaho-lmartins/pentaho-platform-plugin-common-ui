dojo.provide("pentaho.common.propertiesPanel.Panel");
dojo.require("dijit.layout.ContentPane");
dojo.require("dijit._Widget");
dojo.require("dijit._Templated");
dojo.require("dijit.form.HorizontalSlider");
dojo.require("dijit.form.TextBox");
dojo.require("dijit.form.ComboBox");
dojo.require("dojo.data.ItemFileReadStore");
dojo.require("dijit.form.Select");
dojo.require("dijit.form.CheckBox");
dojo.require("dojo.dnd.Source");
dojo.require("dijit.TitlePane");


dojo.declare(
    "pentaho.common.propertiesPanel.Panel",
    [dijit.layout.ContentPane],
    {
      captionTemplate: "<div class='caption'><span class='caption-text'>${ui.caption}</span></div>",
      propUIs: [],
      groups: {},
      baseClass: "pentahoPropertiesPanel",
      constructor:function (propertiesConfiguration) {
        this.configuration = propertiesConfiguration;
      },
      postCreate:function () {
        dojo.forEach(this.configuration.items, dojo.hitch(this, "initializeItem"));
        this.inherited(arguments);
      },
      initializeItem:function (item) {
        // Lookup class impl from map
        var layoutClass = pentaho.common.propertiesPanel.Panel.registeredTypes[item.ui.type];
        if (!layoutClass) {
          throw "No Properties Panel UI implementation found for " + item.ui.type;
        }

        var propUi;
        // check to see if it's a factory class
        if(layoutClass.create){
          propUi = layoutClass.create({model: item, propPanel: this});
        } else {
          propUi = new layoutClass({model: item, propPanel: this});
        }
        var targetNode = this.domNode;

        // If the property is grouped, create the group or add it to the existing one.
        if(item.ui.group){
          var group = this.groups[item.ui.group];
          var groupConfig = this.configuration.groups[item.ui.group];
          if(!group && groupConfig){
            var groupContents = document.createElement("div");

            group = new dijit.TitlePane({
              title: groupConfig.title,
              content: groupContents
            });
            this.groups[item.ui.group] = group;
          }
          targetNode = group.content;
          this.domNode.appendChild(group.domNode);
        }

        // Items can have a caption. If specified, create and add it before the property UI component
        if(item.ui.caption){
          var cap = dojo._toDom(dojo.string.substitute(this.captionTemplate, item));
          targetNode.appendChild(cap);
        }

        // Route UI events to onPropertyChange
        this.setupEventHandling(propUi);

        this.propUIs.push(propUi);
        this.connect(propUi, "onUIEvent", "onUIEvent");
        targetNode.appendChild(propUi.domNode);

      },

      onUIEvent: function(type, args){
      },
      setupEventHandling: function(ui){

        this.connect(ui, "onContextMenu", function(e){
          this.onUIEvent("onContextMenu", {item: ui, args: [ui, e]});
        });
        this.connect(ui, "onClick", function(e){
          this.onUIEvent("onClick", {item: ui, args: [ui, e]});
        });
        this.connect(ui, "onDblClick", function(e){
          this.onUIEvent("onDblClick", {item: ui, args: [ui, e]});
        });
      },

      setConfiguration: function(config){

        this.propUIs.forEach(function(widget){
          widget.destroyRecursive();
        });
        this.propUIs = [];
        this.groups = {},
            this.domNode.innerHTML = "";
        this.configuration = config;
        this.postCreate();
      },
      set: function(property, id, value){
        dojo.forEach(this.propUIs, function(prop){
          if(prop.model.id == id){
            prop.model.set(property, value);
          }
        })
      }
    }

);
pentaho.common.propertiesPanel.Panel.registeredTypes = {};


dojo.declare(
    "pentaho.common.propertiesPanel.StatefulUI",
    [],
    {
      constructor: function(options){
        this.model = options.model;
        this.propPanel = options.propPanel;
        var outterThis = this;
        this.model.watch(function(propName, prevVal, newVal){

          switch(propName){
            case "value":
            case "default":
              outterThis.set(propName, newVal);
              break;
          }
        });
      },
      onUIEvent: function(type, args){

      }
    }
);

dojo.declare("pentaho.common.propertiesPanel.GemBarUISource", [dojo.dnd.Source],{


  onDrop:function (source, nodes, copy) {

    if (!nodes || nodes.length == 0 || !this.gemBar.checkAcceptance(this, nodes)) {
      return false;
    }
    var droppedNode = nodes[0];
    var gemUI = dijit.byId(droppedNode.id);
    var gem;
    if(gemUI){
      gem = gemUI.model;
      // gemUI.gemBar.remove(gemUI);
      if(gemUI.gemBar == this.gemBar){ //Reorder, notify model so it can fire an event
        gem.gemBar.reordered();
      } else {
        gemUI.gemBar.remove(gemUI);
        gemUI.gemBar = this.gemBar;
        this.gemBar.add(gemUI);
      }
    } else {
      var gem = this.createGemFromNode(nodes[0]);
      gemUI = this.createGemUI(gem, nodes[0]);
      nodes[0] = gemUI.domNode;
      this.gemBar.add(gemUI);
    }

    var newId = nodes[0].id;
    nodes[0].id = droppedNode.id; // need to ensure the original id is used when calling superclass
    this.inherited(arguments);
    nodes[0].id = newId;
    this.sync();
    source.sync();
    return true;

  },

  createGemFromNode:function (sourceNode) {

    var modelClass = pentaho.common.propertiesPanel.Configuration.registeredTypes["gem"];
    var options = {id: sourceNode.id, value: sourceNode.innerHTML, gemBar: this.gemBar.model, sourceNode: sourceNode};

    // check to see if it's a factory class
    if(modelClass.create){
      return modelClass.create(options)
    } else {
      return new modelClass(options);
    }
  },
  createGemUI:function (gem, sourceNode) {
    var uiClass = pentaho.common.propertiesPanel.Panel.registeredTypes["gem"];
    var options = {id: gem.id, model: gem, gemBar: this.gemBar, dndType: this.gemBar.model.ui.dndType, sourceNode : sourceNode};
    if(uiClass.create){
      return uiClass.create(options);
    } else {
      return new uiClass(options);
    }
  }
});

dojo.declare(
    "pentaho.common.propertiesPanel.GemBarUI",
    [dijit._Widget, dijit._Templated, pentaho.common.propertiesPanel.StatefulUI],
    {
      className:"propPanel_gemBar",
      gemLimit:-1,
      widgetsInTemplate: true,
      templateString:"<div class='${className}'></div>",
      gems: [],
      handles: [],
      accept: ["gem"],
      constructor:function (options) {
        this.id = this.model.id+"_ui";
      },
      postCreate: function(){

        this.dropZone = new pentaho.common.propertiesPanel.GemBarUISource(this.domNode, {accept: this.model.ui.dndType, gemBar: this});
        // this.handles.push[dojo.connect(this.dropZone, "onDrop", this, "onDrop")];
        this.handles.push[dojo.connect(this.dropZone, "createDropIndicator", this, "createDropIndicator")];
        this.handles.push[dojo.connect(this.dropZone, "placeDropIndicator", this, "placeDropIndicator")];
        this.handles.push[dojo.connect(this.dropZone, "onMouseOver", this, "onMouseOver")];
        this.handles.push[dojo.connect(this.dropZone, "onMouseOut", this, "onMouseOut")];
        this.handles.push[dojo.connect(this.dropZone, "onDraggingOver", this, "onDraggingOver")];
        this.handles.push[dojo.connect(this.dropZone, "onDraggingOver", this, "onDraggingOut")];
        this.handles.push[dojo.connect(this.dropZone, "checkAcceptance", this, "checkAcceptance")];
        this.handles.push[dojo.connect(this.dropZone, "insertNodes", this, "insertNodes")];

        dojo.forEach(this.model.gems, function(gem){
          var uiClass = pentaho.common.propertiesPanel.Panel.registeredTypes["gem"];
          var options = {sourceNode: gem.sourceNode, id: gem.id, model: gem, gemBar: this, dndType: this.model.ui.dndType};
          var gemUI;
          if(uiClass.create){
            gemUI = uiClass.create(options);
          } else {
            gemUI = new uiClass(options);
          }
          this.domNode.appendChild(gemUI.domNode);
          this.add(gemUI);
        }, this);
        this.dropZone.sync();

      },
      insertNodes: function(addSelected, data, before, anchor) {
        this.onUIEvent("insertNodes", {item: this, args: arguments});
      },
      add: function(gemUI){
        gemUI.model.gemBar = this.model;
        this.model.add(gemUI.model);
        this.gems.push(gemUI);
        gemUI.gemBar = this;
        this.propPanel.setupEventHandling(gemUI);
      },
      remove: function(gemUI){
        this.domNode.removeChild(gemUI.domNode);
      },
      onContextMenu: function(event, gem){
        // to be overwritten
      },
      createDropIndicator:function () {

      },
      placeDropIndicator:function (e) {

      },
      onMouseOver:function () {
        // this.mouseMoveHandle = this.connect(window, "onMouseMove", this, "placeDropIndicator");
      },
      onMouseOut:function () {
        // if (this.mouseMoveHandle) {
        //   dojo.disconnect(this.mouseMoveHandle);
        // }
      },
      onDraggingOver:function () {
        return this.inherited(arguments);

      },
      onDraggingOut: function(){

      },
      checkAcceptance: function(source, nodes){
        return true;
      },


      // onDrop:function (source, nodes, copy) {
      //   if (!nodes || nodes.length == 0) {
      //     return false;
      //   }
      //   var droppedNode = nodes[0];
      //   var gem = (droppedNode.isGem) ? droppedNode.gem : this.createGemFromNode(nodes[0]);
      //   this.gems.push(gem);
      //   var gemUI = (droppedNode.isGem) ? droppedNode : this.createGemUI(gem);
      //   this.gems.push(gemUI);
      //   this.domNode.appendChild(gemUI.domNode);
      //   return true;
      // },
      init:function () {
        dojo.forEach(this.model.gems, dojo.hitch(this, "createGems"));
      },
      createGems:function (gem) {
        var gemUI = createGemUI(gem);
        this.domNode.appendChild(gemUI.domNode);

        this.propPanel.setupEventHandling(gemUI);
      },


      /* extension points */
      validateGem:function (gem) {
        return true;
      },
      createGemFromNode:function (sourceNode) {
        return new pentaho.common.propertiesPanel.Configuration.registeredTypes["gem"]({id: sourceNode.innerHTML});
      },
      createGemUI:function (gem) {
        return new pentaho.common.propertiesPanel.GemUI(gem, this.className);
      },
      destroyRecursive: function(){
        this.inherited(arguments);
        // destroyRecursive should do this, investigate
        dojo.forEach(this.gems, function(gem){
          gem.destroy();
        });
        this.destroy();
        dojo.forEach(this.handles, dojo.disconnect);
      }
    }
);

pentaho.common.propertiesPanel.Panel.registeredTypes["gemBar"] = pentaho.common.propertiesPanel.GemBarUI;

dojo.declare(
    "pentaho.common.propertiesPanel.GemUI",
    [dijit._Widget, dijit._Templated,pentaho.common.propertiesPanel.StatefulUI],
    {
      className: "gem",

      templateString: "<div id='${id}' class='${className} dojoDndItem' dndType='${dndType}'>${model.value}</div>",
      constructor:function (options) {
        this.gemBar = options.gemBar;
        this.dndType = options.dndType;
      },
      detach: function(){
        model.detach();
      },
      postCreate: function(){
        dojo.connect(this.domNode, "oncontextmenu", this, "onContextMenu");
      },


      // to be overwritten by container
      onContextMenu: function(e){
        console.log("onContextMenu called");
      }
    }
);

pentaho.common.propertiesPanel.Panel.registeredTypes["gem"] = pentaho.common.propertiesPanel.GemUI;

dojo.declare(
    "pentaho.common.propertiesPanel.ComboUI",
    [dijit.form.Select, pentaho.common.propertiesPanel.StatefulUI],
    {
      className:"propPanel_combobox",
      options: [],
      constructor:function (options) {
        this.inherited(arguments);

        this.name = options.id;

        dojo.forEach(this.model.values, function(val){
          this.options.push({label: val, value: val});
        }, this);


      },
      onChange: function(){
        this.model.set('value', this.value);
      }
    }
);
pentaho.common.propertiesPanel.Panel.registeredTypes["combo"] = pentaho.common.propertiesPanel.ComboUI;

dojo.declare(
    "pentaho.common.propertiesPanel.SliderUI",
    [dijit.form.HorizontalSlider, pentaho.common.propertiesPanel.StatefulUI],
    {
      className:"propPanel_slider",
      minimum: 0,
      maximum: 100,
      style: "width: 100%",
      intermediateChanges: true,
      constructor:function (options) {
        this.inherited(arguments);
        this.value = this.model.value;
        this.id = this.model.id+"_slider";
      },
      onChange: function(){
        this.model.set('value', this.value);
      }
    }
);
pentaho.common.propertiesPanel.Panel.registeredTypes["slider"] = pentaho.common.propertiesPanel.SliderUI;

dojo.declare(
    "pentaho.common.propertiesPanel.TextboxUI",
    [dijit.form.TextBox, pentaho.common.propertiesPanel.StatefulUI],
    {
      constructor:function (options) {
        this.disabled = this.model.disabled;
        this.inherited(arguments);
      },
      onChange: function(){
        this.model.set('value', this.value);
      }
    }
);
pentaho.common.propertiesPanel.Panel.registeredTypes["textbox"] = pentaho.common.propertiesPanel.TextboxUI;


dojo.declare(
    "pentaho.common.propertiesPanel.CheckBoxUI",
    [dijit._Widget, dijit._Templated, pentaho.common.propertiesPanel.StatefulUI],
    {
      className: "propPanel_checkbox",
      widgetsInTemplate: true,
      templateString: "<div class='${className}'><input id='${model.id}_checkbox' name='${model.id}_checkbox' dojoType='dijit.form.CheckBox' checked='${model.value}'/> <label for='${model.id}_checkbox'>${model.label}</label></div>",
      constructor:function (options) {
        this.inherited(arguments);
      },
      postCreate: function(){
        this.checkbox = dijit.byId(this.model.id+"_checkbox");
        var outterThis = this;
        this.connect(this.checkbox, "onChange", function(){
          outterThis.model.set('value', outterThis.checkbox.checked);
        });

      },
      set: function(prop, newVal){
        if(this.checkbox){
          this.checkbox.set(prop, newVal);
        }

      },
      onChange: function(){

      }
    }
);
pentaho.common.propertiesPanel.Panel.registeredTypes["checkbox"] = pentaho.common.propertiesPanel.CheckBoxUI;
