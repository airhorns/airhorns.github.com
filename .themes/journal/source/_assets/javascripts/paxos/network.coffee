#= require paxos/replica

class Harry.Network extends Batman.Object
  baseNetworkDelay: 1000
  networkDelayVariability: 2
  clientCount: 1
  replicaCount: 10
  roundNumber: 0
  nextValue: 0
  replicaClass: Harry.Replica

  constructor: (optionsOrReplicaCount) ->
    if Batman.typeOf(optionsOrReplicaCount) is 'Number'
      super({replicaCount: optionsOrReplicaCount})
    else
      super(optionsOrReplicaCount)

    @quorum ?= Math.ceil(@replicaCount / 2)
    @maxAdditionalNetworkDelay ?= @networkDelayVariability * @baseNetworkDelay
    @nextMessageID = 0

    @replicas = (new @replicaClass(i, @quorum, @) for i in [1..@replicaCount])
    @clients = (new Harry.Client(-1 * i, @) for i in [1..@clientCount])

    @entitiesById = @replicas.concat(@clients).reduce (acc, entity) ->
      acc[entity.id] = entity
      acc
    , {}

    @startNewRound()

  startNewRound: ->
    @roundNumber += 1
    for client in @clients
      client.startNewRound(@roundNumber)

    for replica in @replicas
      replica.startNewRound(@roundNumber)

    return

  sendMessage: (originID, destinationID, message) ->
    if @canSend(originID, destinationID)
      message.id = ++@nextMessageID
      message.sender = originID
      message.destination = destinationID
      @_deliverMessage(message)

  broadcastMessage: (originID, message) ->
    for replica in @replicas when replica.id != originID
      @sendMessage(originID, replica.id, message.clone())

  canSend: (originID, destinationID) -> true

  _deliverMessage: (message) ->
    flightTime = @baseNetworkDelay + Math.floor(Math.random() * @maxAdditionalNetworkDelay)
    @fire 'messageSent', message, flightTime
    setTimeout @_processArrival.bind(@, message), flightTime

  _processArrival: (message) -> @entitiesById[message.destination].processMessage(message)
