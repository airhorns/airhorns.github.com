#= require paxos/network_member

class Harry.Client extends Batman.Object
  @::mixin Harry.NetworkMember

  constructor: (@id, @network) ->
    super()

  propose: ->
    @network.nextValue += 1
    @sendMessage @replicaIDForMessages(), new Harry.SetValueMessage(@network.nextValue)

  replicaIDForMessages: ->
    Math.floor(Math.random() * @network.replicas.length) + 1
