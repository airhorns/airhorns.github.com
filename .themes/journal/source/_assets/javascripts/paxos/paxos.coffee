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

muteProposer = (proposer) ->

window.mainVisualization = new Harry.NetworkVisualizer
  selector: "#main_demo"
  network: new Harry.Network(15)
  width: 720
  height: 540
  clientMargin: 50

clientOnlyVisualization = new Harry.NetworkVisualizer
  selector: "#client_demo"
  width: 340
  height: 260
  labels: false
  replicaWidth: 50
  messageWidth: 12
  valueWidth: 30
  network: new Harry.Network
    replicaCount: 3
    baseNetworkDelay: 1000
    networkDelayVariability: 0
  proposeEvery: 3000
  onStart: (visualization, network) ->
    for replica in network.replicas
      replica.startTransition('mute')
  onPropose: (visualization, network) ->
    removeValues(visualization)

prepareOnlyVisualization = new Harry.NetworkVisualizer
  selector: "#prepare_demo"
  width: 340
  height: 280
  labels: false
  replicaWidth: 50
  messageWidth: 12
  valueWidth: 30
  network: new Harry.Network
    replicaCount: 3
    baseNetworkDelay: 1000
    networkDelayVariability: 0
  proposeEvery: 3000
  onStart: (visualization, network) ->
    firstReplica = network.replicas[0]
    network.clients[0].replicaIDForMessages = -> firstReplica.id

    for replica in network.replicas when replica.id != firstReplica.id
      replica.startTransition('mute')

    muteProposer(firstReplica)

  onPropose: (visualization, network) ->
    removeValues(visualization)

sideBySideWidth = 500
sideBySideHeight = 500
sideBySideProposeEvery = 6000
sideBySideStart = (visualization, network) ->

    leftReplica = network.replicas[1]
    rightReplica = network.replicas[3]
    network.clients[0].replicaIDForMessages = -> leftReplica.id
    network.clients[1].replicaIDForMessages = -> rightReplica.id

    # cheat and don't broadcast to the dueler
    network.broadcastMessage = (originID, message) ->
      for replica in @replicas when replica.id != originID && replica.id != leftReplica.id && replica.id != rightReplica.id
        @sendMessage(originID, replica.id, message.clone())

    for replica in network.replicas when replica.id != leftReplica.id and replica.id != rightReplica.id
      replica.startTransition('mute')

    muteProposer(leftReplica)
    muteProposer(rightReplica)

sideBySidePropose = (visualization, network) ->
  network.clients[0].propose()
  setTimeout ->
    network.clients[1].propose()
  , sideBySideProposeEvery / 2

prepareWrongVisualization = new Harry.NetworkVisualizer
  selector: "#prepare_wrong_demo"
  width: sideBySideWidth
  height: sideBySideHeight
  labels: true
  replicaWidth: 50
  messageWidth: 12
  valueWidth: 30
  network: new Harry.Network
    replicaCount: 4
    clientCount: 2
    baseNetworkDelay: 1000
    networkDelayVariability: 0
  proposeEvery: sideBySideProposeEvery
  autoPropose: false
  newRoundsOnPropose: false
  onStart: (visualization, network) ->
    sideBySideStart(visualization, network)
  onPropose: sideBySidePropose

prepareRightVisualization = new Harry.NetworkVisualizer
  selector: "#prepare_right_demo"
  width: sideBySideWidth
  height: sideBySideHeight
  labels: false
  replicaWidth: 50
  messageWidth: 12
  valueWidth: 30
  network: new Harry.Network
    replicaCount: 4
    clientCount: 2
    baseNetworkDelay: 1000
    networkDelayVariability: 0
  proposeEvery: sideBySideProposeEvery
  autoPropose: false
  newRoundsOnPropose: false
  onStart: sideBySideStart
  onPropose: sideBySidePropose

promiseVisualization = new Harry.NetworkVisualizer
  selector: "#promise_demo"
  width: 340
  height: 280
  labels: false
  replicaWidth: 50
  messageWidth: 12
  valueWidth: 30
  network: new Harry.Network
    replicaCount: 3
    baseNetworkDelay: 1000
    networkDelayVariability: 0
  proposeEvery: 4000
  onStart: (visualization, network) ->
    firstReplica = network.replicas[0]
    network.clients[0].replicaIDForMessages = -> firstReplica.id

    firstReplica.promiseReceived = ->
      @roundAttempt.promisesReceived += 1
      if @roundAttempt.promisesReceived >= @quorum
        @startTransition 'mute'
        @startTransition 'unmute'

acceptVisualization = new Harry.NetworkVisualizer
  selector: "#accept_demo"
  width: 340
  height: 280
  labels: false
  replicaWidth: 50
  messageWidth: 12
  valueWidth: 30
  network: new Harry.Network
    replicaCount: 3
    baseNetworkDelay: 1000
    networkDelayVariability: 0
  proposeEvery: 5000
  onStart: (visualization, network) ->
    for replica in network.replicas
      replica.acceptReceived = (message) ->
        if message.sequenceNumber >= @get('highestSeenSequenceNumber')
          @set('highestSeenSequenceNumber', message.sequenceNumber)
          @set 'value', message.value

    firstReplica = network.replicas[0]
    network.clients[0].replicaIDForMessages = -> firstReplica.id

    firstReplica.on 'proposalSucceeded', ->
      clearTimeout @timeout
      @startTransition 'mute'
      @startTransition 'unmute'
