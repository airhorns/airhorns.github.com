#= require vendor/d3.v2
#= require vendor/batman.statemachine
#= require vendor/async.min
#= require_tree .

removeValues = (visualization) ->
  # This algorithm stinks cause different browsers behave differently when mutating an array during traversal.
  while visualization.nodes.filter((node) -> node instanceof Harry.Value || node instanceof Harry.AbstractMessage).length != 0
    for node, i in visualization.nodes
      if node instanceof Harry.Value || node instanceof Harry.AbstractMessage
        visualization.nodes.splice(i, 1)

  visualization.links.splice(0, visualization.links.length)
  return

mainVisualization = new Harry.NetworkVisualizer
  selector: "#main_demo"
  network: new Harry.Network
    replicaCount: 15
    clientCount: 2
  width: 720
  height: 540
  clientMargin: 50
  autoPropose: false
  proposeEvery: 11000
  onPropose: (visualization, network) ->
    network.clients[0].propose()
    setTimeout ->
      network.clients[1].propose()
    , 3000


#readOnlyVisualization = new Harry.NetworkVisualizer
  #selector: "#read_demo"
  #width: 340
  #height: 260
  #labels: false
  #replicaWidth: 50
  #messageWidth: 12
  #valueWidth: 30
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #autoPropose: false
  #proposeEvery: 4500
  #newRoundsOnPropose: false
  #onStart: (visualization, network) ->
    #for replica in network.replicas
      #replica.value = 1
  #onPropose: (visualization, network) ->
    #client = network.clients[0]

    ## remove an existing value if present
    #if client.valueLink && ~(index = readOnlyVisualization.links.indexOf(client.valueLink))
      #value = client.valueLink.source
      #readOnlyVisualization.animateReleaseValue(value)
      #readOnlyVisualization.links.splice(index, 1)

    #network.clients[0].read()

#clientOnlyVisualization = new Harry.NetworkVisualizer
  #selector: "#client_demo"
  #width: 340
  #height: 260
  #labels: false
  #replicaWidth: 50
  #messageWidth: 12
  #valueWidth: 30
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #proposeEvery: 3000
  #onStart: (visualization, network) ->
    #for replica in network.replicas
      #replica.startTransition('mute')
  #onPropose: (visualization, network) ->
    #removeValues(visualization)

#prepareOnlyVisualization = new Harry.NetworkVisualizer
  #selector: "#prepare_demo"
  #width: 340
  #height: 280
  #labels: false
  #replicaWidth: 50
  #messageWidth: 12
  #valueWidth: 30
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #proposeEvery: 3000
  #onStart: (visualization, network) ->
    #firstReplica = network.replicas[0]
    #network.clients[0].replicaIDForMessages = -> firstReplica.id

    #for replica in network.replicas when replica.id != firstReplica.id
      #replica.startTransition('mute')

#prepareCompareOptions =
  #width: 500
  #height: 500
  #labels: false
  #replicaWidth: 50
  #messageWidth: 12
  #valueWidth: 30
  #network: new Harry.Network
    #replicaCount: 10
    #clientCount: 2
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #proposeEvery: 10000
  #autoPropose: false
  #newRoundsOnPropose: false
  #onStart: (visualization, network) ->
    #topReplica = network.replicas[4]
    #console.log(topReplica)
    #bottomReplica = network.replicas[9]
    #network.clients[0].replicaIDForMessages = -> topReplica.id
    #network.clients[1].replicaIDForMessages = -> bottomReplica.id

    #for replica in network.replicas when replica.id != topReplica.id and replica.id != bottomReplica.id
      #replica.startTransition('mute')

  #onPropose: (visualization, network) ->
    #network.clients[0].propose()
    #network.clients[1].propose()

#prepareNetwork = (replicaClass) ->
  #new Harry.Network
    #replicaCount: 10
    #clientCount: 2
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
    #replicaClass: replicaClass

#prepareRightVisualization = new Harry.NetworkVisualizer(prepareCompareOptions, {
  #selector: "#prepare_right_demo .viz"
  #network: prepareNetwork(Harry.Replica)
#})

#prepareWrongVisualization = new Harry.NetworkVisualizer(prepareCompareOptions, {
  #selector: "#prepare_wrong_demo .viz"
  #network: prepareNetwork(Harry.TimePrecedenceReplica)
#})

#promiseVisualization = new Harry.NetworkVisualizer
  #selector: "#promise_demo"
  #width: 340
  #height: 280
  #labels: false
  #replicaWidth: 50
  #messageWidth: 12
  #valueWidth: 30
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #proposeEvery: 4000
  #onStart: (visualization, network) ->
    #firstReplica = network.replicas[0]
    #network.clients[0].replicaIDForMessages = -> firstReplica.id

    #firstReplica.promiseReceived = ->
      #@roundAttempt.promisesReceived += 1
      #if @roundAttempt.promisesReceived >= @quorum
        #@startTransition 'mute'
        #@startTransition 'unmute'

#acceptVisualization = new Harry.NetworkVisualizer
  #selector: "#accept_demo"
  #width: 340
  #height: 280
  #labels: false
  #replicaWidth: 50
  #messageWidth: 12
  #valueWidth: 30
  #network: new Harry.Network
    #replicaCount: 3
    #baseNetworkDelay: 1000
    #networkDelayVariability: 0
  #proposeEvery: 5000
  #onStart: (visualization, network) ->
    #for replica in network.replicas
      #replica.acceptReceived = (message) ->
        #if message.sequenceNumber >= @get('highestSeenSequenceNumber')
          #@set('highestSeenSequenceNumber', message.sequenceNumber)
          #@set 'value', message.value

    #firstReplica = network.replicas[0]
    #network.clients[0].replicaIDForMessages = -> firstReplica.id

    #firstReplica.on 'proposalSucceeded', ->
      #clearTimeout @timeout
      #@startTransition 'mute'
      #@startTransition 'unmute'
