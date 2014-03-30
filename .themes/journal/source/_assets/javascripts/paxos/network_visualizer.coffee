class Harry.NetworkVisualizer
  width: 720
  height: 620
  clientMargin: 10
  labels: true
  nextValue: 0
  proposeEvery: 8500
  replicaWidth: 30
  messageWidth: 6
  valueWidth: 20
  maxVelocity: 1

  constructor: (options) ->
    Batman.extend(@, options)
    @count = @network.length
    @messageReceivedCallbacks = []
    @easer = d3.ease("cubic-in-out")

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
      @network.startNewRound()
      clientID = Math.floor(Math.random() * -1 * @network.clients.length) + 1
      @network.clients[clientID].propose()

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
      .enter()
        .append("svg:circle")
        .attr("class", "value")
        .attr("r", @valueWidth / 2)
        .attr("fill", "#B3EECC")
        .attr("cx", (d) -> d.x)
        .attr("cy", (d) -> d.y)

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

    switch message.constructor
       # new message to broadcast
      when Harry.SetValueMessage then @animateSendValue(message)
      # new message with a new value to hold in temporary storage
      when Harry.PrepareMessage then @animateSendValue(message)
      # telling others its time to accept the given value
      when Harry.AcceptMessage
        true

    @updateForceItems()

  messageSent: (message) =>
    @nodes.splice(@nodes.indexOf(message), 1)
    @links.splice(@links.indexOf(message.link), 1)
    destination = @network.entitiesById[message.destination]
    switch message.constructor
      # new message to broadcast
      when Harry.SetValueMessage then @animateStageValue(message, destination)
      # new message with a new value to hold in temporary storage
      when Harry.PrepareMessage then @animateStageValue(message, destination)
      # time to accept the given value
      when Harry.AcceptMessage then true

    @updateForceItems()
    @messageReceivedCallbacks[message.id]()

  animateSendValue: (message) ->
    value = new Harry.Value(message.value)
    value.radius = @valueWidth / 2
    message.valueLink = {source: value, target: message}
    message.valuePresenter = value
    @links.push message.valueLink
    @nodes.push value

  animateStageValue: (message, replica) ->
    value = message.valueLink.source
    @links.splice(@links.indexOf(message.valueLink), 1)

    # remove an existing value if present
    if replica.valueLink && ~(index = @links.indexOf(replica.valueLink))
      @links.splice(index, 1)
      # TODO: animate destroy value

    replica.valueLink = {source: value, target: replica, holding: true}
    @links.push replica.valueLink

  animateAcceptValue: (replica) -> replica.valueLink.holding = false

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
          @animateAcceptValue(replica)
        else
          @emitValueReset(replica)

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

  setupForceLayout: ->
    @nodes = @network.replicas.concat(@network.clients)
    @links = []

    @force = d3.layout.force()
      .size([@width, @height])
      .gravity(0)
      .charge((d, i) -> if d instanceof Harry.Replica then 0 else -10)
      .friction(0.89)
      .linkDistance((d, i) ->
        if (d.target instanceof Harry.Replica || d.target instanceof Harry.Client) && d.source instanceof Harry.AbstractMessage
          0
        else if d.source instanceof Harry.Value && d.target instanceof Harry.Replica
          if d.holding then 20 else 0
        else
          20
      ).nodes(@nodes)
      .links(@links)
      .on 'tick', (e) =>
        @collideMessages(e.alpha)
        @drawMessages()
        @drawValues()
        @drawLinks()

    @updateForceItems()

  updateForceItems: ->
    @force.start()

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
