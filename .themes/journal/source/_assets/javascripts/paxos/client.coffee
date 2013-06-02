#= require paxos/network_member

class Harry.Client extends Batman.Object
  @::mixin Harry.NetworkMember

  nextValue: 0
  constructor: (@id, @network) ->
    super()

  propose: ->
    @nextValue += 10
    @sendMessage @replicaIDForMessages(), new Harry.SetValueMessage(@nextValue)

  replicaIDForMessages: ->
    Math.floor(Math.random() * (@network.replicas.length)) + 1
