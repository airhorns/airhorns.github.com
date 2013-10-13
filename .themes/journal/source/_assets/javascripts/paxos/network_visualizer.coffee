glower = (goBrighter) ->
  destination = if goBrighter
    "rgb(158, 0, 250)"
  else
    "rgb(98, 0, 156)"

  return (selection) ->
    started = false

    selection.transition()
      .duration(1000)
      .ease('qubic')
      .attr('fill', destination)
      .each "end", ->
        return false if started
        started = true
        selection.call glower(!goBrighter)

class Harry.NetworkVisualizer
  width: 720
  height: 620
  clientMargin: 10
  labels: true
  nextValue: 0
  proposeEvery: 500
  replicaWidth: 30
  messageWidth: 6
  valueWidth: 20

  constructor: (options) ->
    Batman.extend(@, options)
    @count = @network.length
    @inFlightMessages = []
    @inFlightValues = []
    @messageReceivedCallbacks = []

    @svg = d3.select(@selector)
      .append("svg:svg")
      .attr("width", @width)
      .attr("height", @height)

    @replicaRadiusStep = (Math.PI * 2) / @network.replicas.length
    @replicaXScale = d3.scale.linear().domain([-1, 1]).range([20 + (16*2) + 30 + (@clientMargin * 2), @width - 60])
    @replicaYScale = d3.scale.linear().domain([-1, 1]).range([20, @height - 20])

    @clientXScale  = => 20 + @clientMargin
    if @network.clients.length > 1
      @clientYScale  = d3.scale.linear().domain([@network.clients[0].id, @network.clients[@network.clients.length - 1].id]).range([60 + @clientMargin, @height - (60 + @clientMargin)])
    else
      @clientYScale  = => @height / 2 - 10

    @drawReplicas()
    @drawReplicaLabels()
    @drawClients()
    @attachMessageHandlers()
    @attachValueHandlers()
    @setupForceLayout()

    @onStart?(@, @network)

    propose = =>
      clientID = Math.floor(Math.random() * -1 * @network.clients.length) + 1
      @network.clients[clientID].propose()

    setInterval propose, @proposeEvery
    propose()

  drawReplicas: ->
    for replica in @network.replicas
      replica.x = @entityX(replica.id)
      replica.y = @entityY(replica.id)
      replica.radius = @replicaWidth / 2

    @replicaCircles = @svg.selectAll("circle.replica")
      .data(@network.replicas)
      .enter()
        .append("svg:circle")
        .attr("fill", "#00ADA7")
        .attr("class", "replica")
        .attr("r",  (replica) => replica.radius)
        .attr("cx", (replica) => replica.x)
        .attr("cy", (replica) => replica.y)

  drawReplicaLabels: ->
    return unless @labels
    @sequenceNumberLabels = @svg.selectAll("text.sequence-number-label")
      .data(@network.replicas)
      .text((replica) -> replica.highestSeenSequenceNumber)
      .enter()
        .append("svg:text")
        .attr("class", "replica-label sequence-number-label")
        .attr("x", (replica) => replica.x + 23)
        .attr("y", (replica) => replica.y - 8)
        .text((replica) -> replica.highestSeenSequenceNumber)

    @stateLabels = @svg.selectAll("text.state-label")
      .data(@network.replicas)
      .text((replica) -> replica.get('state'))
      .enter()
        .append("svg:text")
        .attr("class", "replica-label state-label")
        .attr("x", (replica) => @entityX(replica.id) + 23)
        .attr("y", (replica) => @entityY(replica.id) + 16)
        .text((replica) -> replica.get('state'))

    @valueLabels = @svg.selectAll("text.value-label")
      .data(@network.replicas)
      .text((replica) -> replica.get('value'))
      .enter()
        .append("svg:text")
        .attr("class", "replica-label value-label")
        .attr("x", (replica) => @entityX(replica.id) + 23)
        .attr("y", (replica) => @entityY(replica.id) + 4)
        .text((replica) -> replica.get('value'))

  drawClients: ->
    for client in @network.clients
      client.x = @entityX(client.id)
      client.y = @entityY(client.id)
      client.radius = @replicaWidth / 2

    @clientCircles = @svg.selectAll("circle.client")
      .data(@network.clients)
      .enter()
        .append("svg:circle")
        .attr("fill", "#DE3961")
        .attr("class", "client")
        .attr("r",  (client) => client.radius)
        .attr("cx", (client) => client.x)
        .attr("cy", (client) => client.y)

  drawValues: ->
    @valueCircles = @svg.selectAll("circle.value")
      .data(@inFlightValues)
      .attr("cx", (d) -> d.x)
      .attr("cy", (d) -> d.y)
      .enter()
        .append("svg:circle")
        .attr("class", "value")
        .attr("r", @valueWidth / 2)
        .attr("fill", "#B3EECC")
        .attr("cx", (d) -> d.x)
        .attr("cy", (d) -> d.y)

  drawMessages: ->
    messages = @svg.selectAll("circle.message")
      .data(@inFlightMessages, (message) -> message.id)
    messages.enter()
        .append("svg:circle")
        .attr("class", "message")
        .attr("r", @messageWidth / 2)
        .attr("cx", (message) => message.x)
        .attr("cy", (message) => message.y)
        .attr("fill", "#A4E670")
    messages.exit()
        .remove()

  attachMessageHandlers: ->
    @network._deliverMessage = @messageSending

  messageSending: (message) =>
    message.radius = @messageWidth / 2
    message.x = @network.entitiesById[message.sender].x
    message.y = @network.entitiesById[message.sender].y
    debugger unless message.x && message.y

    @inFlightMessages.push(message)
    @nodes.push(message)
    @links.push {source: message, target: @network.entitiesById[message.destination]}
    @messageReceivedCallbacks[message.id] = => @network._processArrival(message)

    switch message.constructor
      when Harry.SetValueMessage # new message to broadcast
        value = {value: message.value, radius: @valueWidth / 2}
        @inFlightValues.push value
        @nodes.push value
        @links.push {source: value, target: message}
        message.valuePresenter = value
      when Harry.PrepareMessage # new message with a new value to hold in temporary storage
        true
      when Harry.AcceptMessage # time to accept the given value
        true

    @updateForceItems()

  messageSent: (message) =>
    @inFlightMessages.splice(@inFlightMessages.indexOf(message), 1)
    @nodes.splice(@nodes.indexOf(message), 1)
    @updateForceItems()

    switch message.constructor
      when Harry.SetValueMessage # new message to broadcast
        @inFlightValues.splice(@inFlightValues.indexOf(message.valuePresenter), 1)
      when Harry.PrepareMessage # new message with a new value to hold in temporary storage
        true
      when Harry.AcceptMessage # time to accept the given value
        true

    @messageReceivedCallbacks[message.id]()

  attachValueHandlers: ->
    redraw = =>
      @drawReplicas()
      @drawReplicaLabels()

    @network.replicas.forEach (replica) =>
      for key in ['state', 'highestSeenSequenceNumber']
        replica.observe key, redraw

      replica.observe 'value', =>
        redraw()
        @emitValueChange(replica)

  emitValueChange: (replica) ->
    orb = @svg.selectAll("circle.value-change.replica-#{replica.id}")
        .data([1])
        .enter()
        .insert("svg:circle", ":first-child")
        .attr("fill", "#DE3961")
        .attr("class", "value-change replica-#{replica.id}")
        .attr("r", 17)
        .attr("opacity", 0.6)
        .attr("cx", @entityX(replica.id))
        .attr("cy", @entityY(replica.id))
        .transition()
          .duration(1000)
          .attr("r", 40)
          .attr("opacity", 0)
          .remove()
          .ease()

  drawLinks: ->
    link = @svg.selectAll(".link")
      .data(@links)
      .attr("x1", (d) -> debugger unless d.source.x; d.source.x)
      .attr("y1", (d) -> debugger unless d.source.y; d.source.y)
      .attr("x2", (d) -> debugger unless d.target.x; d.target.x)
      .attr("y2", (d) -> debugger unless d.target.y; d.target.y)
      .enter()
        .append("line")
        .attr("class", "link");

  setupForceLayout: ->
    @nodes = @network.replicas.slice(0)
    @links = []

    @force = d3.layout.force()
      .size([@width, @height])
      .nodes(@nodes)
      .links(@links)
      .on 'tick', =>
        @collideMessages()
        @drawMessages()
        @drawValues()
        @drawLinks()

    @updateForceItems()

  updateForceItems: ->
    @force.start()

  collideMessages: =>
    tree = d3.geom.quadtree(@nodes)
    for node in @nodes
      r = node.radius + 16
      nx1 = node.x - r
      nx2 = node.x + r
      ny1 = node.y - r
      ny2 = node.y + r

      tree.visit (quad, x1, y1, x2, y2) ->
        if (quad.point && (quad.point != node))
          x = node.x - quad.point.x
          y = node.y - quad.point.y
          l = Math.sqrt(x * x + y * y)
          r = node.radius + quad.point.radius
          debugger if isNaN(x) || isNaN(y) || isNaN(r)

          if (l < r)
            l = (l - r) / l * .5
            node.x -= x *= l
            node.y -= y *= l
            quad.point.x += x
            quad.point.y += y

        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1

  entityX: (id) =>
    if id < 0
      @clientXScale(id)
    else
      @replicaXScale(Math.sin(id * @replicaRadiusStep))

  entityY: (id) =>
    if id < 0
      @clientYScale(id)
    else
      @replicaYScale(Math.cos(id * @replicaRadiusStep + Math.PI))
