#= require paxos/network_member

class Harry.Client extends Batman.Object
  @::mixin Harry.NetworkMember

  constructor: (@id, @network) ->
    super()

  propose: ->
    @network.nextValue += 1
    @sendMessage @replicaIDForMessages(), new Harry.SetValueMessage(@network.nextValue)

  read: (callback) ->
    @readAttempt = {count: 0, values: {}}

    for replica in @network.replicas
      @sendMessage replica.id, new Harry.QueryMessage()

  processMessage: (message) ->
    switch message.constructor
      when Harry.QueryResponseMessage   then @queryResponseReceived(message)

  replicaIDForMessages: ->
    Math.floor(Math.random() * @network.replicas.length) + 1

  queryResponseReceived: (message) ->
    if @readAttempt?
      @readAttempt.count += 1
      if @readAttempt.count == @network.replicas.length
        @readAttempt.readValue = message.value # sorry
        return true
