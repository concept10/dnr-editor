/**
 * Copyright 2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

function initGui(){
  // GUI setup
  $('<div id="node-dialog-map" class="hide">\
        <div id="map" style="height: 300px;">\
        </div>\
    </div>').appendTo("body")
  
  /* Node Requirements button */ 
  $('<li><span class="deploy-button-group button-group">'+
    '<a id="btn-constraints" class="deploy-button" href="#"> <span>Node Requirements</span></a>'+
    '<a id="btn-constraints-options" data-toggle="dropdown" class="deploy-button" href="#"><i class="fa fa-caret-down"></i></a>'+
    '</span></li>').prependTo(".header-toolbar")
  
  /* Link Requirements button */ 
  $('<li><span class="deploy-button-group button-group">'+
    '<a id="btn-link-constraints" data-toggle="dropdown" class="deploy-button" href="#">'+
    'Link Requirements ' + 
    '<i class="fa fa-caret-down"></i></a>'+
    '</span></li>').prependTo(".header-toolbar")

  $('<div id="node-dialog-new-constraints" class="hide node-red-dialog">\
    <div class="form-row">\
        <label for="constraint-id" ><i class="fa"></i>Constraint Id:</label>\
        <input type="text" id="constraint-id">\
        <label for="device-id" ><i class="fa"></i>Device ID:</label>\
        <input type="text" id="device-id" placeholder="device s application scope unique ID">\
        <label><i class="fa"></i>Location:</label>\
        <input type="text" id="location-constraint">\
        <label for="memory-constraint"><i class="fa"></i>Min memory (MB):</label>\
        <input type="text" id="memory-constraint" placeholder="500">\
        <label for="cores-constraint"><i class="fa"></i>Min CPU cores:</label>\
        <input type="text" id="cores-constraint" placeholder="1000">\
    </div>\
  </div>').appendTo("body")

  $('<div id="seed-dialog" class="hide node-red-dialog">'+
    '<form class="dialog-form form-horizontal">'+
      '<div class="form-row">'+
        '<textarea readonly style="resize: none; width: 100%; border-radius: 4px;font-family: monospace; font-size: 12px; background:#f3f3f3; padding-left: 0.5em; box-sizing:border-box;" id="seed-export" rows="5"></textarea>'+
      '</div>'+
    '</form></div>').appendTo("body")
}


RED.dnr = (function() {
  var constraints = [];
  var linkConstraints = {};

  // location constraints GUI
  function mapInit(){
    var VANCOUVER = {lat: 49.269801, lng: -123.109489}
    var currentOverlay = null
    var overlayVisible = false

    $("#node-dialog-map").dialog({
      title:"Set location constraint",
      modal: true,
      autoOpen: false,
      width: 500,
      open: function(e) {},
      close: function(e) {},
      buttons: 
      {
        Set: function (){
          if (!overlayVisible){
            $('#location-constraint').val("")
            $(this ).dialog( "close");
            return
          }

          var bounds = currentOverlay.getBounds();
          var start = bounds.getNorthEast();
          var end = bounds.getSouthWest();

          $('#location-constraint').val( 
            JSON.stringify({
              ne: [start.lat(), start.lng()],
              sw: [end.lat(), end.lng()]
          }));

          $(this).dialog( "close" );
        },
        Reset: function(){
          clearOverlay()
        },
        Cancel: function() {
          $(this).dialog( "close" );
        }
      }
    })

    var map = new google.maps.Map(document.getElementById('map'), {
      center: VANCOUVER, 
      zoom: 10
    })

    var drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.MARKER,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: ['rectangle']
      }
    })

    drawingManager.setMap(map)

    google.maps.event.addListener(map, 'click', function(event) {
      clearOverlay()
    });

    google.maps.event.addListener(drawingManager, 'overlaycomplete', function(e) {
      clearOverlay()
      currentOverlay = e.overlay
      overlayVisible = true
    })

    $('#location-constraint').click(function() { 
      $("#node-dialog-map").dialog( "open" )
      if (overlayVisible){
        map.setCenter({
          lat: currentOverlay.getBounds().getCenter().lat(), 
          lng: currentOverlay.getBounds().getCenter().lng()})
      }
      
      google.maps.event.trigger(map, 'resize') // to make map visible
      drawingManager.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE)
    })

    function clearOverlay(){
      if (currentOverlay){
        currentOverlay.setMap(null)
        overlayVisible = false
      }
    }
  }

  function init() {
    initGui()
    mapInit()
    RED.sidebar.devices.init()

    $('#btn-constraints').click(function() { 
      $( "#node-dialog-new-constraints" ).dialog( "open" ) })

    $("#node-dialog-new-constraints")
    .dialog({
      modal: true,
      autoOpen: false,
      width: 500,
      open: function(e) {
        var constraintId = $('#constraint-id').val()
        if (!constraintId){
          $(this).dialog('option', 'title', 'Create a node requirement');
          $("#createConstraintBtn").text('Create')
          return
        }

        // editing existing constraint
        for (var i = 0; i < constraints.length; i++){
          if (constraints[i].id === constraintId){
            var c = constraints[i]
          }
        }

        if (!c){
          return
        }

        if (c['deviceId']){
          $( "#device-id" ).val(c['deviceId'])
        }
        if (c['location']){
          $( "#location-constraint" ).val(c['location'])
        }
        if (c['memory']){
          $( "#memory-constraint" ).val(c['memory'])
        }
        if (c['cores']){
          $( "#cores-constraint" ).val(c['cores'])
        }
        $(this).dialog('option', 'title', 'Editing existed constraint');
        $("#createConstraintBtn").text('Save edit')
      },
      close: function(e) {
        resetConstraintsDialog()
      },
      buttons: {
        Create: {
          id: "createConstraintBtn",
          click: createConstraint
        },
        Cancel: function() {
          $(this).dialog("close")
        }
      }
    })

    $("#seed-dialog")
    .dialog({
      title: 'Export DNR Seed',
      modal: true,
      autoOpen: false,
      width: 500,
      resizable: false,
      buttons: [
        {
          id: "clipboard-dialog-cancel",
          text: RED._("common.label.cancel"),
          click: function() {
            $(this).dialog("close");
          }
        },
        {
          id: "clipboard-dialog-copy",
          class: "primary",
          text: RED._("clipboard.export.copy"),
          click: function() {
            $("#seed-export").select();
            document.execCommand("copy");
            document.getSelection().removeAllRanges();
            RED.notify(RED._("clipboard.nodesExported"));
            $(this).dialog( "close" );
          }
        }
      ],
      open: function(e) {
          $(this).parent().find(".ui-dialog-titlebar-close").hide();
      }
    })

    RED.menu.init({id:"btn-constraints-options",
      options: []
    })

    RED.menu.init({id:"btn-link-constraints",
        options: [
            {id:"1-1",label:'1-1',onselect:function(){setLinkConstraint('11')}},
            {id:"1-N",label:'1-N',onselect:function(){setLinkConstraint('1N')}},
            {id:"N-1",label:'N-1',onselect:function(){setLinkConstraint('N1')}},
            {id:"N-N",label:'N-N',onselect:function(){setLinkConstraint('NN')}}
        ]
    })

    RED.menu.addItem("btn-sidemenu", {
      id:"menu-item-dnr",
      toggle:false,
      // selected: true,
      label: 'DNR',
      options: [
        {
          id:"menu-item-constraints",
          toggle:true,
          selected: true,
          label: 'Show constraints',
          onselect:function(s) { toggleConstraints(s)}
        },
        {
          id:"menu-item-dnr-seed",
          toggle:false,
          // selected: true,  
          label: 'Export DNR Seed',
          onselect:function() { showDnrSeed()}
        },
        {
          id:"menu-item-dnr-devices",
          toggle:false,
          // selected: true,
          label: 'Show devices',
          onselect:"dnr:show-devices-tab"
        }
      ]
    })

    RED.events.on("deploy",function(){
      $.ajax({
        url: "dnr/flows/"+RED.workspaces.active(),
        type:"POST",
        success: function(resp) {
        },
        error: function(jqXHR,textStatus,errorThrown) {
          console.log('cannot notify new flow')  
        }
      })
    })
  }// end init

  function resetConstraintsDialog(){
    $("#constraint-id").val("")
    $("#device-id").val("")
    $("#location-constraint").val("")
    $("#memory-constraint").val("")
    $("#cores-constraint").val("")
  }

  function showDnrSeed(){
    var host = document.location.hostname;
    var port = document.location.port;
    var protocol = document.location.protocol

    var operatorUrl = protocol + "//" + host + (port ? (":"+port) : "")
    var dnrSeed = [
      {
        "id": "af25fe8d.debf5",
        "type": "tab",
        "label": "DNR Seed"
      },
      {
        "id":"f14195aa.25e298",
        "operatorUrl": operatorUrl,
        "type": "dnr-daemon",
        "x":100,"y":100,
        "z": "af25fe8d.debf5"
      }
    ]
    $("#seed-export").val(JSON.stringify(dnrSeed))
    $("#seed-dialog").dialog( "open" )
  }

  function toggleConstraints(checked) {
    d3.selectAll('.node_constraints_group').style("display", checked ? "inline" : "none")
    d3.selectAll('.link_constraint_group').style("display", checked ? "inline" : "none")
  }

  function createConstraint(){
    var constraintId = $( "#constraint-id" ).val();
    if (!constraintId){
        alert('constrantId is required');
        return;
    }
        
    var deviceId = $( "#device-id" ).val();
    var location = $( "#location-constraint" ).val();
    var memory = $( "#memory-constraint" ).val();
    var cores = $( "#cores-constraint" ).val();
    // var network = $( "#network-constraint" ).val();
    // var custom = $( "#custom-constraint" ).val();
    
    var creatingConstraint = {
      id:constraintId
    };  
    if (deviceId)
        creatingConstraint['deviceId'] = deviceId;
    if (location)
        creatingConstraint['location'] = location;
    if (memory)
        creatingConstraint['memory'] = memory;
    if (cores)
        creatingConstraint['cores'] = cores;

    addConstraintToGui(creatingConstraint);

    $(this).dialog( "close" );
  }

  // add a constraint to constraint drowdown list
  function addConstraintToGui(c){
    // check if c id is unique (exist or not)
    for (var i = 0; i < constraints.length; i++){
      if (c.id && c.id === constraints[i].id){
        // updating existing constraint
        constraints[i] = c
        return
      }
    }  

    // add it to the constraints list
    c.fill = c.fill ? c.fill : randomColor();
    c.text = c.text ? c.text : c.id;
    constraints.push(c);

    RED.menu.addItem("btn-constraints-options", {
      id:c.id,
      label:c.id,
      onselect:function(s) { 
        var nodeSelected = false

        RED.nodes.eachNode(function(node){
          if (node.selected){
            nodeSelected = true
            return
          }
        })

        if (!nodeSelected){
          // no node is selected, allow to edit current constraint
          $( "#constraint-id" ).val(c['id'])
          $( "#node-dialog-new-constraints" ).dialog( "open" )
        } else {
          // reset these fields to blank
          resetConstraintsDialog()
          setNodeConstraint(c)
        }
      }
    })
  }

  /* Link constraints */

  /** 
   * Applying a link type to selected link, called from drop-down menu
   * @param {linkType} wt - The link type being applyed to 
   */
  function setLinkConstraint(linkType){
    var link = d3.select('.link_selected')
    if (link.data().length > 1){
      console.log('WARNING, choosing 2 links at the same time!!!')
      return;
    }
    if (!link.data()[0]){
      return
    }

    var d = link.data()[0]

    var source = d.source
    var sourcePort = d.sourcePort
    var target = d.target
    var midX = (d.x1+d.x2) / 2
    var midY = (d.y1+d.y2) / 2

    linkConstraints[source.id + '_' + sourcePort + '_' + target.id] = linkType

    link.selectAll('.link_constraint_group').remove();
    link.append("svg:g")
      .style({display:'inline',fill: 'brown', 'font-size': 12})
      .attr("class","link_constraint_group")
      .attr("transform","translate(" + midX + "," + midY+ ")")
      .append("svg:text")
      .text(linkType)
      .on("click", (function(){
        return function(){
          link.selectAll('.link_constraint_group').remove();
          delete linkConstraints[source.id + 
                      '_' + sourcePort + '_' + target.id]
          RED.nodes.dirty(true);
        }
      })())

    RED.nodes.dirty(true);// enabling deploy
  }

  // called from view, append link constraint to a link (e.g when editor is loaded)
  function appendLinkConstraint(link){
    var d = link.data()[0]
    
    var source = d.source
    var sourcePort = d.sourcePort
    var target = d.target
    var midX = (d.x1+d.x2) / 2 || 0
    var midY = (d.y1+d.y2) / 2 || 0

    var sourceLink, linkType

    try {
      sourceLink = source.constraints.link
      linkType = sourceLink[sourcePort + '_' + target.id]
      // clear the node's constraint for editor
      delete sourceLink[sourcePort + '_' + target.id]
      // set the temporary constraints store
      linkConstraints[source.id + '_' + sourcePort + '_' + target.id] = linkType
    } catch(e){}
    
    if (!linkType){
      return
    }

    link.selectAll('.link_constraint_group').remove();
    link.append("svg:g")
      .style({display:'inline',fill: 'brown', 'font-size': 12})
      .attr("class","link_constraint_group")
      .attr("transform","translate(" + midX + "," + midY+ ")")
      .append("svg:text")
      .text(linkType)
      .on("click", (function(){
        return function(){
          link.selectAll('.link_constraint_group').remove();
          // delete sourceLink[sourcePort + '_' + target.id]
          delete linkConstraints[source.id + 
                      '_' + sourcePort + '_' + target.id]
          RED.nodes.dirty(true);
        }
      })())
  }

  // called on deploying to send link constraints to server
  function addLinkConstraintsToData(data){
    var flows = data.flows
    for (var o in flows){
      var obj = flows[o]

      if (!obj.wires){
        continue
      }

      for (var i = 0; i< obj.wires.length; i++){
        for (var j = 0; j < obj.wires[i].length; j++){
          if (!obj.wires[i][j]){
            continue
          }

          var link = obj.id + '_' + i + '_' + obj.wires[i][j]
          var linkType = linkConstraints[link]
          if (!linkType){
            continue
          }

          if (!obj.constraints){
            obj.constraints = {}
          }

          if (!obj.constraints.link){
            obj.constraints.link = {}
          }

          obj.constraints.link[i + '_' + obj.wires[i][j]] = linkType
        }
      }
    }
  }

  /*
    called by view whenever a node is moved, to update the location of label
    according to the location of link
  */
  function redrawLinkConstraint(l){
    if (l.attr('class').indexOf('link_background') === -1){
      return
    }

    var aLink = d3.select(l[0][0].parentNode).selectAll('.link_constraint_group')
    if (!aLink.data()[0]){
      return
    }

    var d = aLink.data()[0]
    var midX = (d.x1+d.x2) / 2
    var midY = (d.y1+d.y2) / 2

    aLink.attr("transform","translate(" + midX + "," + midY+ ")")
  }

  /** 
   * Applying a constraint to selected nodes, it will be shown on redrawing, after
   * clicking on the canvas
   * Constraints and Nodes are Many to Many relationship
   * @param {constraint} c - The constraint being applyed to 
   */
  function setNodeConstraint(c){
    var appliedTo = 0;

    d3.selectAll('.node_selected').each(function(node){
      if (!node['constraints'])
        node['constraints'] = {}

      if (node.constraints[c.id])
        return

      node.constraints[c.id] = c
      redrawConstraints(d3.select(this.parentNode))
      RED.nodes.dirty(true)
    })
  }

  // n: d3 data object, node: node JSON object
  function prepareConstraints(n, node){
    if (n.constraints)
      node['constraints'] = n.constraints;
  }

  // when server starts, load constraints to constraints list 
  function loadConstraints(nodes){
    for (var i = 0; i < nodes.length; i++){
      if (!nodes[i]['constraints'])
        continue;

      var nConstraints = nodes[i].constraints;
      for (c in nConstraints){
        if (c !== 'link'){
          addConstraintToGui(nConstraints[c]);
        }
      }
    }
  }

  function redrawConstraints(thisNode){
    var d = thisNode.data()[0]
    var node_constraints_group = thisNode.selectAll('.node_constraints_group');
    
    if (node_constraints_group[0].length === 0){
      node_constraints_group = thisNode.append("svg:g").attr("class","node_constraints_group")
    }

    var node_constraints_list = thisNode.selectAll('.node_constraint');

    node_constraints_group.style("display","inline");

    var nodeConstraints = [];

    for (c in d.constraints){
      if (!d.constraints.hasOwnProperty(c))
        continue;

      nodeConstraints.push(d.constraints[c]);
    }

    // TODO: weak check on array matching, should check with constraint id (data) and text label (view)
    if (node_constraints_list[0].length === nodeConstraints.length)
      return;

    // create new nodes with a fresh start (avoid mix and match)
    node_constraints_list.remove();

    node_constraints_group
      .attr("transform","translate(3, -" + nodeConstraints.length * 12 + ")")
      .style({"font-style": "italic", "font-size": 12});

    for (var j = 0; j < nodeConstraints.length; j++){

      var constraintData = nodeConstraints[j];
      var fill = constraintData.fill || "black";
      // var shape = constraintData.shape;

      var node_constraint = node_constraints_group.append("svg:g");
      var makeCallback = function(id, node_constraint){
        return function(){
          delete d.constraints[id];
          node_constraint.remove();
          RED.nodes.dirty(true);
        }
      };
      node_constraint.style({fill: fill, stroke: fill})
        .attr("class","node_constraint")
        .attr("transform","translate(0, " + j*17 + ")")
        .on("click", makeCallback(constraintData.id, node_constraint));

      node_constraint.append("svg:text")
        .attr("class","node_constraint_label")
        .text(constraintData.text ? constraintData.text : "");
    } 
  }

  function randomColor(){
    var possibleColor = ["#4286f4", "#f404e0", "#f40440", "#f42404", 
          "#f4a804", "#2d9906", "#069959", "#068c99", "#8f0699",
          "#5103c6", "#c66803", "#c64325", "#c425c6", "#7625c6", "#c62543",
          "#25c6a1", "#187f67", "#407266", "#567240", "#bf3338", "#bf337b"];

    var result = possibleColor[Math.ceil(Math.random() * possibleColor.length) - 1];

    return result;
  }

  // function showFlowMetadata(){
  //   var thisFlowId = RED.workspaces.active();

  //   $( "#flow-id" ).val(thisFlowId);
  //   $( "#flow-trackers" ).val('');

  //   RED.nodes.eachWorkspace(function(flow){
  //     if (flow.id === thisFlowId && flow.metadata)
  //       $( "#flow-trackers" ).val(flow.metadata.trackers.toString());
  //   });

  //   $( "#node-dialog-flow-metadata" ).dialog( "open" ); 
  // }


  // function newFlowMetadataDialog(){
  //   var flowId = $( "#flow-id" ).val();
  //   var trackers = $( "#flow-trackers" ).val().split(',');
  //   var flowMetadata = {};

  //   if (trackers){
  //     flowMetadata['trackers'] = trackers;
  //     RED.nodes.eachWorkspace(function(flow){
  //       console.log(flow);
  //       if (flow.id === flowId)
  //         flow['metadata'] = flowMetadata;
  //     });
  //   }

  //   $( this ).dialog( "close" );
  // }

  return {
     addLinkConstraintsToData: addLinkConstraintsToData,
     appendLinkConstraint: appendLinkConstraint,
     redrawLinkConstraint: redrawLinkConstraint,
     prepareConstraints: prepareConstraints,
     loadConstraints: loadConstraints,
     redrawConstraints: redrawConstraints,
     init: init
  }
 })()









RED.sidebar.devices = (function() {
  var content = $('<div class="sidebar-devices">')
  var toolbar = $('<div>'+
      '<a class="sidebar-footer-button" id="workspace-devices-map-view" href="#"><i id="workspaces-devices-list" class="fa fa-map-marker"></i></a></div>')

  var searchDiv = $('<div>',{class:"palette-search"}).appendTo(content);
  var searchInput = $('<input type="text" placeholder="Search devices"></input>')
    .appendTo(searchDiv)
    .searchBox({
        delay: 300,
        change: function() {
          var searchTerm = $(this).val().toLowerCase();
          if (searchTerm.length > 0) {
              
          } else {
              searchInput.searchBox('count',loadedList.length);
          }
        }
    });

  var mapView = $('<div id="deviceMap">').css({
    "position": "absolute",
    "top": "35px",
    "bottom": 0,
    "left": 0,
    "right": 0,
    "z-index": 900
  }).appendTo(content).hide()

  var devicesList = $('<ol>',{style:"position: absolute;top: 35px;bottom: 0;left: 0;right: 0px;"}).appendTo(content).editableList({
      addButton: false,
      scrollOnAdd: false,
      sort: function(device1,device2) {
        return device1.id.localeCompare(device2.id);
      },
      filter: function(data) {
        if (activeFilter === "" ) {
          return true;
        }

        return (activeFilter==="")||(data.index.indexOf(activeFilter) > -1);
      },
      addItem: function(container,i,device) {
        var entry = device;
        if (entry) {
          var headerRow = $('<div class="device-header">').appendTo(container)
          //.css("cursor","pointer")

          var titleRow = $('<div class="device-meta device-id"><i class="fa fa-podcast" style="margin-right: 5px;"></i></div>').appendTo(headerRow);
          $('<span>').html(entry.id).appendTo(titleRow);
          var metaRow = $('<div class="device-meta device-lastSeen"><i class="fa fa-clock-o" style="margin-right: 5px;"></i></div>').appendTo(headerRow);

          var lastSeenText = $('<span>').html(entry.lastSeen).appendTo(metaRow)

          var statusText = $('<span>').html(entry.status).css({"float":"right",
            "color": entry.status == 'disconnected' ? 'red' : 'green'
          }).appendTo(metaRow)

          var shade = $('<div class="device-shade hide"><img src="red/images/spin.svg" class="palette-spinner"/></div>').appendTo(container);

          device.elements = {
            statusText: statusText,
            lastSeenText: lastSeenText,
            container: container,
            headerRow: headerRow,
            shade: shade
          }
        } else {
            $('<div>',{class:"red-ui-search-empty"}).html(RED._('search.empty')).appendTo(container);
        }
      }
  })

  var devices = {}
  var markers = []
  var MAP_ZOOM = 10
  var map

  RED.sidebar.addTab({
    id: "devices",
    label: "devices",
    name: "device tab name",
    content: content,
    toolbar: toolbar,
    closeable: true,
    visible: false,
    onchange: function() { }
  })

  RED.actions.add("dnr:show-devices-tab",function() {RED.sidebar.show('devices')});

  function init(){
    map = new google.maps.Map(document.getElementById('deviceMap'), {
      zoom: MAP_ZOOM,
      center: {lat: 49.269801, lng: -123.109489}
    })

    $("#workspace-devices-map-view").on("click", function(e) {
      // e.preventDefault()
      updateMap()
      devicesList.toggle()
      mapView.toggle()
      google.maps.event.trigger(map, 'resize')
    })

    $.ajax({
      url: "dnr/devices",
      type:"GET",
      success: function(resp) {
        for (var i = 0; i< resp.length; i++){
          var aDev = resp[i]
          addOrUpdateNewDevice(aDev)
        }
      },
      error: function(jqXHR,textStatus,errorThrown) {
        console.log('cannot get devices')  
      }
    })

    RED.comms.subscribe("devices/#",function(topic,device) {
      if (topic === 'devices/connected'){
        addOrUpdateNewDevice(device)
      }

      if (topic === 'devices/disconnected'){
        devices[device.id].elements.statusText.html('disconnected').css({
          "float":"right", "color": 'red'
        })
        devices[device.id].destroyTimer = setTimeout(function(){
          devicesList.editableList('removeItem', devices[device.id]);
          delete devices[device.id]
        },2000)
      }

      if (topic === 'devices/heartbeat'){
        var ctx = JSON.stringify(device.context)
        devices[device.id].context = device.context
        devices[device.id].lastSeen = device.lastSeen
        devices[device.id].elements.lastSeenText.html(device.lastSeen)
        devices[device.id].elements.headerRow.attr("title", ctx)
        updateMap()
      }
    })
  }

  function addOrUpdateNewDevice(device){
    if (!devices[device.id]){
      devices[device.id] = {
        id: device.id,
        lastSeen: Date.now(),
        status: 'connected'
      }
      devicesList.editableList('addItem', devices[device.id]);
    } else {
      devices[device.id].status = 'connected'
      devices[device.id].lastSeen = Date.now()
      devices[device.id].elements.statusText.html('connected').css({
        "float":"right", "color": 'green'
      })
      devices[device.id].elements.lastSeenText.html(Date.now())
      clearTimeout(devices[device.id].destroyTimer)
    }
  }

  function updateMap(){
    for (var i = 0; i < markers.length; i++) {
      markers[i].setMap(null)
    }

    var latlngs = []

    for (var id in devices){
      if (!devices[id].context || 
          !devices[id].context.location ||
          Object.keys(devices[id].context.location).length !== 2){
        continue
      }

      latlngs.push({
        id: id,
        freeMem: devices[id].context.freeMem,
        cores: devices[id].context.cores,
        lat: devices[id].context.location.lat,
        lng: devices[id].context.location.lng
      })
    }

    markers = latlngs.map(function(el, i) {
      var marker = new google.maps.Marker({
        position: el,
        map: map,
        id: id
      })
      google.maps.event.addListener(marker , 'click', function(){
        var infowindow = new google.maps.InfoWindow({
          content:'Device Id: ' + el.id + ', freeMem: ' + el.freeMem + ', cores: ' + el.cores,
          position: el,
        })
        infowindow.open(map);
        setTimeout(function () { infowindow.close(); }, 2000);
      })
      return marker
    })
  }

  return {
    init: init
  }
})()


