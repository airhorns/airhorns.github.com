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
  @messageTypeColor: d3.scale.category10()
  @valueScale: d3.scale.category10()

  width: 720
  height: 620
  clientMargin: 10
  labels: true
  nextValue: 0
  proposeEvery: 8500
  replicaWidth: 30

  constructor: (options) ->
    Batman.extend(@, options)
    @count = @network.length
    @inFlightMessages = []

    @svg = d3.select(@selector)
      .append("svg:svg")
      .attr("width", @width)
      .attr("height", @height)

    @replicaRadiusStep = (Math.PI * 2) / @network.replicas.length
    @replicaXScale = d3.scale.linear().domain([-1, 1]).range([20 + (16*2) + 30 + (@clientMargin * 2), @width - 60])
    @replicaYScale = d3.scale.linear().domain([-1, 1]).range([20, @height - 20])

    #@clientXScale  = d3.scale.linear().domain([@network.clients[0].id, @network.clients[@network.clients.length - 1].id]).range([20 + @clientMargin, 20 + @clientMargin])
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

    @onStart?(@, @network)

    propose = =>
      clientID = Math.floor(Math.random() * -1 * @network.clients.length) + 1
      @network.clients[clientID].propose()

    setInterval propose, @proposeEvery
    propose()

  drawReplicas: ->
    @replicaSquares = @svg.selectAll("rect.replica")
        .data(@network.replicas)
        .attr("fill", (replica) => @constructor.valueScale(replica.value))

    @replicaSquares.enter()
        .append("svg:rect")
        .attr("class", "replica")
        .attr("width", @replicaWidth)
        .attr("height", @replicaWidth)
        .attr("x", (replica) => @entityX(replica.id) - (@replicaWidth/2))
        .attr("y", (replica) => @entityY(replica.id) - (@replicaWidth/2))

  drawReplicaLabels: ->
    return unless @labels
    @sequenceNumberLabels = @svg.selectAll("text.sequence-number-label").data(@network.replicas)
    @sequenceNumberLabels
      .text((replica) -> replica.highestSeenSequenceNumber)
      .enter()
        .append("svg:text")
        .attr("class", "replica-label sequence-number-label")
        .attr("x", (replica) => @entityX(replica.id) + 23)
        .attr("y", (replica) => @entityY(replica.id) - 8)
        .text((replica) -> replica.highestSeenSequenceNumber)

    @stateLabels = @svg.selectAll("text.state-label").data(@network.replicas)
    @stateLabels
      .text((replica) -> replica.get('state'))
      .enter()
        .append("svg:text")
        .attr("class", "replica-label state-label")
        .attr("x", (replica) => @entityX(replica.id) + 23)
        .attr("y", (replica) => @entityY(replica.id) + 16)
        .text((replica) -> replica.get('state'))

    @valueLabels = @svg.selectAll("text.value-label").data(@network.replicas)
    @valueLabels
      .text((replica) -> replica.get('value'))
      .enter()
        .append("svg:text")
        .attr("class", "replica-label value-label")
        .attr("x", (replica) => @entityX(replica.id) + 23)
        .attr("y", (replica) => @entityY(replica.id) + 4)
        .text((replica) -> replica.get('value'))

  drawClients: ->
    @clientCircles = @svg.selectAll("circle.client")
      .data(@network.clients)

    @clientCircles
      .enter()
        .append("svg:circle")
        .attr("fill", "#FF00F0")
        .attr("class", "client")
        .attr("r", 20)
        .attr("cx", (client) => @entityX(client.id))
        .attr("cy", (client) => @entityY(client.id))

  attachMessageHandlers: ->
    @network.on 'messageSent', (message, flightTime) =>
      @inFlightMessages.push(message)
      @svg.selectAll("circle.message")
        .data(@inFlightMessages, (message) -> message.id)
        .enter()
          .append("svg:circle")
          .attr("class", "message")
          .attr("r", 8)
          .attr("cx", (message) => @entityX(message.sender))
          .attr("cy", (message) => @entityY(message.sender))
          .attr("fill", (message) => @constructor.messageTypeColor(message.type))
          .transition()
            .duration(flightTime)
            .attr("cx", (message) => @entityX(message.destination))
            .attr("cy", (message) => @entityY(message.destination))
            .remove()
            .each("end", (message) =>
              @inFlightMessages.splice(@inFlightMessages.indexOf(message), 1)
            ).ease()

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
    #TODO: z index below replica
    orb = @svg.selectAll("circle.value-change.replica-#{replica.id}")
        .data([1])
        .enter()
        .insert("svg:circle", ":first-child")
        .attr("fill", "#CC0000")
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
