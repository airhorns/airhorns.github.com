class Harry.NetworkVisualizer
  width: 720
  height: 620
  clientMargin: 10
  labels: false
  nextValue: 0
  proposeEvery: 8500
  newRoundsOnPropose: true
  autoPropose: true
  replicaWidth: 30
  messageWidth: 6
  valueWidth: 20
  maxVelocity: 1

  constructor: ->
    Batman.extend(@, option) for option in arguments
    @count = @network.length
    @messageReceivedCallbacks = []
    @easer = d3.ease("cubic-in-out")

    @svg = d3.select(@selector)
      .append("svg:svg")
      .attr("width", @width)
      .attr("height", @height)

    @replicaRadiusStep = (Math.PI * 2) / @network.replicas.length
    @replicaMargin = @replicaWidth  + 10
    @replicaXScale = d3.scale.linear().domain([-1, 1]).range([@replicaMargin + (@clientMargin * 2 + 20), @width - @replicaMargin])
    @replicaYScale = d3.scale.linear().domain([-1, 1]).range([@replicaMargin, @height - @replicaMargin])

    @clientXScale  = => 20 + @clientMargin
    if @network.clients.length > 1
      @clientYScale  = d3.scale.linear().domain([@network.clients[0].id, @network.clients[@network.clients.length - 1].id]).range([60 + @clientMargin, @height - (60 + @clientMargin)])
    else
      @clientYScale  = => @height / 2 - 10

    @valueColorScale ?= d3.scale.ordinal().range(["#B3EECC", "#ecb3ee", "#eecbb3"])

    @holdingLinkLength = (@valueWidth / 2) + (@replicaWidth / 2) * 1.07
    @messageLinkLength = (@valueWidth / 2) + (@messageWidth / 2) * 1.07
    @drawReplicas()
    @drawReplicaLabels()
    @drawClients()
    @attachMessageHandlers()
    @attachValueHandlers()
    @setupForceLayout()
    @startVisualGC()

    @onStart?(@, @network)

    @setupInitialValues()

    propose = =>
      @network.startNewRound() if @newRoundsOnPropose
      @onPropose?(@, @network)
      @drawFlyingStuff()
      @network.clients[Math.floor(Math.random() * @network.clients.length)].propose() if @autoPropose

    setInterval propose, @proposeEvery
    propose()

  drawReplicas: ->
    for replica in @network.replicas
      replica.x = @entityX(replica.id)
      replica.y = @entityY(replica.id)
      replica.radius = (@replicaWidth / 2)
      replica.fixed = true

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

    @valueLabels = @svg.selectAll("text.value-label")
      .data(@network.replicas)
      .text((replica) -> replica.get('value'))
      .enter()
        .append("svg:text")
        .attr("class", "replica-label value-label")
        .attr("x", (replica) => @entityX(replica.id) + 23)
        .attr("y", (replica) => @entityY(replica.id) + 4)
        .text((replica) -> replica.get('value'))

    @stateLabels = @svg.selectAll("text.state-label")
      .data(@network.replicas)
      .text((replica) -> replica.get('state'))
      .enter()
        .append("svg:text")
        .attr("class", "replica-label state-label")
        .attr("x", (replica) => @entityX(replica.id) + 23)
        .attr("y", (replica) => @entityY(replica.id) + 16)
        .text((replica) -> replica.get('state'))


  drawClients: ->
    for client in @network.clients
      client.x = @entityX(client.id)
      client.y = @entityY(client.id)
      client.radius = @replicaWidth / 2
      client.fixed = true

    @clientCircles = @svg.selectAll("circle.client")
      .data(@network.clients)
      .enter()
        .append("svg:circle")
        .attr("fill", "#DE3961")
        .attr("class", "client")
        .attr("r",  (client) -> client.radius)
        .attr("cx", (client) -> client.x)
        .attr("cy", (client) -> client.y)

  drawValues: ->
    @valueCircles = @svg.selectAll("circle.value")
      .data(@nodes.filter (n) -> n instanceof Harry.Value)
      .attr("cx", (d) -> d.x)
      .attr("cy", (d) -> d.y)

    @valueCircles.enter()
      .append("svg:circle")
      .attr("class", "value")
      .attr("r", @valueWidth / 2)
      .attr("fill", (d) => @valueColorScale(d.value))
      .attr("cx", (d) -> d.x)
      .attr("cy", (d) -> d.y)

    @valueCircles.exit()
      .remove()

  drawMessages: ->
    messages = @svg.selectAll("circle.message")
      .data(@nodes.filter((n) -> n instanceof Harry.AbstractMessage))
      .attr("cx", (message) -> message.x)
      .attr("cy", (message) -> message.y)
    messages.enter()
        .append("svg:circle")
        .attr("class", "message")
        .attr("r", @messageWidth / 2)
        .attr("cx", (message) -> message.x)
        .attr("cy", (message) -> message.y)
        .attr("fill", "#A4E670")
    messages.exit()
        .remove()

  setupInitialValues: ->
    for replica in @network.replicas when replica.value?
      value = new Harry.Value(replica.value)
      value.radius = @valueWidth / 2
      @nodes.push value
      replica.valueLink = {source: value, target: replica, holding: false}
      @links.push replica.valueLink

  attachMessageHandlers: ->
    @network._deliverMessage = @messageSending

  messageSending: (message) =>
    message.radius = @messageWidth / 2
    message.x = @network.entitiesById[message.sender].x
    message.y = @network.entitiesById[message.sender].y
    message.link = {source: message, target: @network.entitiesById[message.destination]}

    @links.push message.link
    @nodes.push message
    @messageReceivedCallbacks[message.id] = => @network._processArrival(message)

    if message.constructor in [Harry.SetValueMessage, Harry.PrepareMessage, Harry.QueryResponseMessage]
      @animateSendValue(message)

    @updateForceItems()

  messageSent: (message) =>
    @nodes.splice(@nodes.indexOf(message), 1)
    @links.splice(@links.indexOf(message.link), 1)
    @links.splice(@links.indexOf(message.valueLink), 1) if message.valueLink?
    shouldStageValue = @messageReceivedCallbacks[message.id]()
    destination = @network.entitiesById[message.destination]

    switch message.constructor
      when Harry.SetValueMessage, Harry.PrepareMessage
        if shouldStageValue
          @animateStageValue(message, destination)
      when Harry.QueryResponseMessage
        if shouldStageValue
          @animateQueryResponse(destination)
        if value = message.valueLink?.source
          @nodes.splice(@nodes.indexOf(value), 1)

    @updateForceItems()

  animateSendValue: (message) ->
    if message.value?
      value = new Harry.Value(message.value)
      value.radius = @valueWidth / 2
      message.valueLink = {source: value, target: message}
      @links.push message.valueLink
      @nodes.push value

  animateStageValue: (message, replica) ->
    if message.valueLink?
      value = message.valueLink.source

      # remove an existing value if present
      if replica.valueLink && ~(index = @links.indexOf(replica.valueLink))
        @animateReleaseValue(value)
        @links.splice(index, 1)

      replica.valueLink = {source: value, target: replica, holding: true}
      @links.push replica.valueLink

  animateAcceptValue: (replica) ->
    replica.valueLink.holding = false

  animateReleaseValue: (value) ->
    value.obsolete = true

  animateQueryResponse: (client) ->
    value = new Harry.Value(client.readAttempt.readValue)
    value.radius = @valueWidth / 2
    client.valueLink = {source: value, target: client, holding: false}
    @links.push client.valueLink
    @nodes.push value

  attachValueHandlers: ->
    redraw = =>
      @drawReplicas()
      @drawReplicaLabels()
      @updateForceItems()

    @network.replicas.forEach (replica) =>
      for key in ['state', 'highestSeenSequenceNumber']
        replica.observe key, redraw

      replica.observe 'value', (newValue) =>
        redraw()
        if newValue != null
          @emitValueChange(replica)
          @animateAcceptValue(replica, newValue)

  emitReplicaOrb: (replica, klass, fill) ->
    orb = @svg.selectAll("circle.#{klass}.replica-#{replica.id}")
        .data([1])
        .enter()
        .insert("svg:circle", ":first-child")
        .attr("fill", fill)
        .attr("class", "#{klass} replica-#{replica.id}")
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

  emitValueChange: (replica) ->
    @emitReplicaOrb(replica, 'value-change', "#DE3961")

  drawLinks: ->
    @link = @svg.selectAll("line.link")
      .data(@links.filter((link) -> link.holding != false))
      .attr("x1", (d) -> d.source.x)
      .attr("y1", (d) -> d.source.y)
      .attr("x2", (d) -> d.target.x)
      .attr("y2", (d) -> d.target.y)

    @link.enter()
        .append("svg:line")
        .attr("x1", (d) -> d.source.x)
        .attr("y1", (d) -> d.source.y)
        .attr("x2", (d) -> d.target.x)
        .attr("y2", (d) -> d.target.y)
        .attr "class", (d) ->
          if d.source instanceof Harry.Value
            "link value"
          else if d.source instanceof Harry.AbstractMessage
            "link message"
          else
            debugger
            "link unknown"

    @link.exit()
      .remove()

  drawFlyingStuff: ->
    @drawMessages()
    @drawValues()
    @drawLinks()

  setupForceLayout: ->
    @nodes = @network.replicas.concat(@network.clients)
    @links = []

    if @force?
      @force.stop()
      delete @force

    @force = d3.layout.force()
      .size([@width, @height])
      .gravity(-0.005)
      .charge((d, i) -> if d instanceof Harry.Replica then 0 else -10)
      .friction(0.89)
      .linkDistance((d, i) =>
        if (d.target instanceof Harry.Replica || d.target instanceof Harry.Client) && d.source instanceof Harry.AbstractMessage
          0
        else if d.source instanceof Harry.Value && d.target instanceof Harry.Replica
          if d.holding then @holdingLinkLength else 0
        else
          @messageLinkLength # message in tow
      ).nodes(@nodes)
      .links(@links)
      .on 'tick', (e) =>
        @collideMessages(e.alpha)
        @drawFlyingStuff()

    @updateForceItems()

  updateForceItems: -> @force.start()

  collideMessages: (alpha) =>
    for node in @nodes.slice() when node instanceof Harry.AbstractMessage
      destination = @network.entitiesById[node.destination]
      y = node.y - destination.y
      x = node.x - destination.x
      distance = Math.sqrt(x * x + y * y)
      y = node.y - node.py
      x = node.x - node.px
      velocity = Math.sqrt(x * x + y * y)
      maxVelocity = @maxVelocity
      if velocity > maxVelocity
        angle = Math.atan2(y, x)
        node.x = node.px + Math.cos(angle) * maxVelocity
        node.y = node.py + Math.sin(angle) * maxVelocity

      if distance < 10 && velocity < 2
        @messageSent(node)

  startVisualGC: () ->
    maxEntitySize = Math.max(@valueWidth, @messageWidth, @replicaWidth)

    xBound = [-1 * maxEntitySize, @width + maxEntitySize]
    yBound = [-1 * maxEntitySize, @height + maxEntitySize]

    setInterval =>
      @svg.selectAll("circle.value")
          .filter((value) ->
            x = parseFloat(@getAttribute('cx'))
            y = parseFloat(@getAttribute('cy'))
            x < xBound[0] || x > xBound[1] || y < yBound[0] || y > yBound[1]
          ).each((value) =>
            @nodes.splice(@nodes.indexOf(value), 1)
          ).remove()
    , 1000

  entityX: (id) =>
    if id < 0
      @clientXScale(id)
    else
      @replicaXScale(Math.sin(id * @replicaRadiusStep + Math.PI))

  entityY: (id) =>
    if id < 0
      @clientYScale(id)
    else
      @replicaYScale(Math.cos(id * @replicaRadiusStep))
